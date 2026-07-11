/**
 * Invitations store — localStorage-backed reactive facade.
 *
 * Owns the full invitation lifecycle for the HR module: an Owner/Admin/HR
 * creates an employee record and sends an invitation, resends or cancels it,
 * and the invitee later accepts it. Mirrors the future Supabase repository
 * surface (an `invitations` table + an edge function that mails the setup
 * link) so swapping the internals for real server calls does not touch the
 * consuming components.
 *
 * UI reads via `useInvitations` / `useInvitationSettings`; mutations call the
 * exported verbs. Expiry is *derived* at read time from `expiresAt` so a
 * pending invite flips to "expired" the moment its window elapses — no
 * background job required.
 */
import { useSyncExternalStore } from "react";

import { recordAudit } from "@/features/audit/audit-store";
import { acceptInvitationRedirectUrl, inviteEmployeeFn } from "./invite.functions";
import {
  invitations as seedInvitations,
  type Department,
  type EmployeeRole,
  type HrInvitation,
  type InvitationStatus,
} from "./mock-data";

const KEY = "spartaflow:hr:invitations:v1";

/** Selectable expiry windows (days) offered in the UI. */
export const EXPIRY_OPTIONS = [3, 7, 14, 30] as const;
export type ExpiryDays = (typeof EXPIRY_OPTIONS)[number];

export interface InvitationSettings {
  /** Days an invitation stays valid before it auto-expires. */
  expiryDays: number;
}

const DEFAULT_SETTINGS: InvitationSettings = { expiryDays: 7 };

interface State {
  invitations: HrInvitation[];
  settings: InvitationSettings;
}

// ---------- ids / time ----------

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** Seeds ship without tokens; backfill one so every invite has a setup link. */
function defaultState(): State {
  return {
    invitations: seedInvitations.map((i) => ({ ...i, token: i.token ?? uid("tok") })),
    settings: DEFAULT_SETTINGS,
  };
}

function load(): State {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      invitations: parsed.invitations ?? defaultState().invitations,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------- derivation ----------

/**
 * The stored status is canonical; a *pending* invite whose window has elapsed
 * reads as "expired" without mutating the record.
 */
export function effectiveStatus(inv: HrInvitation, now: Date = new Date()): InvitationStatus {
  if (inv.status === "pending" && new Date(inv.expiresAt).getTime() < now.getTime()) {
    return "expired";
  }
  return inv.status;
}

function withEffectiveStatus(inv: HrInvitation, now: Date): HrInvitation {
  const status = effectiveStatus(inv, now);
  return status === inv.status ? inv : { ...inv, status };
}

// ---------- reads ----------

/** All invitations, most recently invited first, with expiry derived. */
export function listInvitations(): HrInvitation[] {
  const now = new Date();
  return [...state.invitations]
    .map((i) => withEffectiveStatus(i, now))
    .sort((a, b) => (a.invitedAt < b.invitedAt ? 1 : -1));
}

export function getInvitation(id: string): HrInvitation | null {
  const found = state.invitations.find((i) => i.id === id);
  return found ? withEffectiveStatus(found, new Date()) : null;
}

/** Invitations grouped by their (derived) status — the manager's tab shape. */
export function groupInvitations(): Record<InvitationStatus, HrInvitation[]> {
  const groups: Record<InvitationStatus, HrInvitation[]> = {
    pending: [],
    accepted: [],
    expired: [],
    cancelled: [],
  };
  for (const inv of listInvitations()) groups[inv.status].push(inv);
  return groups;
}

export function getSettings(): InvitationSettings {
  return state.settings;
}

/**
 * `listInvitations()` derives a fresh array on every call (map + sort), which
 * violates `useSyncExternalStore`'s getSnapshot stability contract and throws
 * "The result of getSnapshot should be cached to avoid an infinite loop". Memoize
 * on the current `state` reference (reassigned immutably by every mutation) so the
 * hook returns a stable array between renders and only recomputes when state changes.
 */
let listSnapshot: { state: State; list: HrInvitation[] } | null = null;

function invitationsSnapshot(): HrInvitation[] {
  if (!listSnapshot || listSnapshot.state !== state) {
    listSnapshot = { state, list: listInvitations() };
  }
  return listSnapshot.list;
}

// getServerSnapshot must likewise return a cached value, computed once.
const serverInvitations = defaultState().invitations;

export function useInvitations(): HrInvitation[] {
  return useSyncExternalStore(subscribe, invitationsSnapshot, () => serverInvitations);
}

export function useInvitationSettings(): InvitationSettings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
}

// ---------- writes ----------

export interface CreateInvitationInput {
  email: string;
  role: EmployeeRole;
  department: Department;
  /** Invitee's name, captured with the employee record. */
  name?: string;
  /** Optional position/job title to attach to the employee record. */
  positionTitle?: string;
  /** Override the configured default expiry window for this invite. */
  expiryDays?: number;
  invitedBy?: string;
}

/**
 * Append the local tracking record for an invitation. This owns only the
 * lifecycle state the UI renders (pending/expired/resent/cancelled + the setup
 * token); the real auth user, profile and employee row are created server-side
 * by {@link issueInvitation}. `invitedBy` defaults to "System" but issuance
 * always passes the real authenticated actor returned by the server.
 */
export function createInvitation(input: CreateInvitationInput): HrInvitation {
  const now = new Date();
  const days = input.expiryDays ?? state.settings.expiryDays;
  const invitation: HrInvitation = {
    id: uid("inv"),
    email: input.email.trim().toLowerCase(),
    name: input.name?.trim() || undefined,
    role: input.role,
    department: input.department,
    invitedBy: input.invitedBy ?? "System",
    invitedAt: now.toISOString(),
    expiresAt: addDays(now, days).toISOString(),
    status: "pending",
    token: uid("tok"),
  };
  state = { ...state, invitations: [invitation, ...state.invitations] };
  emit();
  return invitation;
}

/**
 * Issue a real invitation: create the Supabase auth user + profile + role +
 * employee row via the server function (`inviteEmployeeFn`), then record the
 * local tracking invite attributed to the **server-verified** acting user.
 *
 * This replaces the former mock issuance (which fabricated the record locally
 * with a hardcoded inviter). Throws if the caller is unauthenticated,
 * unauthorized, or the backend provisioning fails — the caller surfaces it.
 */
export async function issueInvitation(input: CreateInvitationInput): Promise<HrInvitation> {
  const result = await inviteEmployeeFn({
    data: {
      email: input.email,
      role: input.role,
      department: input.department,
      fullName: input.name,
      positionTitle: input.positionTitle,
      redirectTo: acceptInvitationRedirectUrl(),
    },
  });

  const invitation = createInvitation({ ...input, invitedBy: result.actor.name });

  recordAudit({
    action: "employee_created",
    target: invitation.email,
    targetType: "employee",
    newValue: `Invited as ${result.appRole}`,
    actor: result.actor.name,
    actorId: result.actor.id,
  });

  return invitation;
}

/**
 * Re-send a pending/expired invitation's **email** for real. Runs the same
 * server round trip as issuance — which now re-sends by recreating a
 * still-pending invitee (see `invitations.server.ts`) — then refreshes the local
 * tracking record. Previously the UI only called {@link resendInvitation}, which
 * updated local state without emailing anything ("Resend" did nothing).
 * Throws if the server can't send (surfaced by the caller).
 */
export async function resendInvitationEmail(inv: HrInvitation): Promise<HrInvitation | null> {
  await inviteEmployeeFn({
    data: {
      email: inv.email,
      role: inv.role,
      department: inv.department,
      fullName: inv.name,
      redirectTo: acceptInvitationRedirectUrl(),
    },
  });
  return resendInvitation(inv.id);
}

/**
 * Resend a pending/expired invitation: refresh the window (using the current
 * default expiry), reset it to pending, and mint a fresh token so the old
 * link stops working. Local-record only — {@link resendInvitationEmail} wraps
 * this with the server round trip that actually re-sends the email.
 */
export function resendInvitation(id: string): HrInvitation | null {
  const now = new Date();
  let updated: HrInvitation | null = null;
  state = {
    ...state,
    invitations: state.invitations.map((i) => {
      if (i.id !== id) return i;
      updated = {
        ...i,
        status: "pending",
        invitedAt: now.toISOString(),
        expiresAt: addDays(now, state.settings.expiryDays).toISOString(),
        resentAt: now.toISOString(),
        token: uid("tok"),
      };
      return updated;
    }),
  };
  if (updated) emit();
  return updated;
}

/** Revoke a pending invitation so its link can no longer be used. */
export function cancelInvitation(id: string): HrInvitation | null {
  let updated: HrInvitation | null = null;
  state = {
    ...state,
    invitations: state.invitations.map((i) => {
      if (i.id !== id) return i;
      updated = { ...i, status: "cancelled" };
      return updated;
    }),
  };
  if (updated) emit();
  return updated;
}

/**
 * Mark an invitation accepted — called when the invitee completes setup.
 * Idempotent and a no-op for cancelled/expired invites.
 */
export function acceptInvitation(id: string): HrInvitation | null {
  const now = new Date();
  let updated: HrInvitation | null = null;
  state = {
    ...state,
    invitations: state.invitations.map((i) => {
      if (i.id !== id || effectiveStatus(i, now) !== "pending") return i;
      updated = { ...i, status: "accepted", acceptedAt: now.toISOString() };
      return updated;
    }),
  };
  if (updated) emit();
  return updated;
}

/** Update the default expiry window applied to new/resent invitations. */
export function updateSettings(patch: Partial<InvitationSettings>): InvitationSettings {
  const prev = state.settings;
  state = { ...state, settings: { ...state.settings, ...patch } };
  if (patch.expiryDays !== undefined && patch.expiryDays !== prev.expiryDays) {
    recordAudit({
      action: "settings_changed",
      target: "Invitation settings",
      targetType: "settings",
      oldValue: `${prev.expiryDays} days`,
      newValue: `${state.settings.expiryDays} days`,
    });
  }
  emit();
  return state.settings;
}

/** Test/support helper — reset to seeds. */
export function __resetInvitations() {
  state = defaultState();
  emit();
}
