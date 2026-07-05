# SpartaFlow — AI Architecture

> Design document only. **No application code was modified.** This is the target
> design for SpartaFlow's provider-agnostic AI Assistant, derived from
> `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_DESIGN.md`, `docs/SERVICES.md`,
> and the **existing** AI code in `src/services/ai/` (`ai.service.ts`, `types.ts`).
> It **extends** that code — it does not regenerate it.
>
> Snapshot date: 2026-07-01.

---

## 0. What already exists (do not regenerate)

The AI boundary is partially built. This design extends it in place:

| Artifact | Status | Role |
| --- | --- | --- |
| `src/services/ai/types.ts` | ✅ exists | `AiRole`, `AiMessage`, `AiConversation`, `AiCompletionRequest`, `AiCompletionResponse` |
| `src/services/ai/ai.service.ts` | ✅ exists | `AiService extends BaseService<AiConversation>` — CRUD on `ai_conversations`, `listMessages`, `ask()` |
| `AiService.ask()` | ✅ exists | Invokes the **`ai-assistant` Edge Function**; keys never reach the browser |
| `ai_conversations` table | 🆕 to add | Bound by `AiService.table` |
| `ai_messages` table | 🆕 to add | Read by `AiService.listMessages()` |
| `ai-assistant` Edge Function | 🆕 to add | Where **all** provider-agnostic logic lives |
| `ai_token_usage`, `ai_settings`, `ai_provider_config` | 🆕 to add | This document |

**Design invariant already set by the code:** the browser only ever calls
`aiService`. The model call is delegated server-side. Every new component below
respects that boundary — provider SDKs, keys, prompt assembly and context
fetching all live in the Edge Function, never in the client bundle.

### Legend
✅ exists · 🆕 new · 🔁 extend existing.

---

## 1. Goals & Principles

- **Provider-agnostic.** The app never names a provider. A single `AiProvider`
  interface is implemented by swappable adapters (Anthropic, OpenAI, Gemini,
  Local). Switching providers is a config change, not a code change.
- **Server-only secrets.** Provider API keys live only in Edge Function secrets.
  Per CLAUDE.md ("Never expose service keys") and the existing `ask()` contract.
- **One boundary.** Components → `aiService` → Edge Function → provider. No
  component ever imports a provider SDK or builds a prompt (CLAUDE.md API Rules).
- **RBAC-scoped grounding.** The Context Builder only ever reads rows the *asking
  user* is allowed to see. AI never becomes a privilege-escalation path.
- **Auditable & metered.** Every completion records token usage and (for
  sensitive surfaces) an audit event.
- **Default to the best Claude models, stay swappable.** The default adapter is
  Anthropic (`claude-opus-4-8` / `claude-sonnet-5` / `claude-haiku-4-5-20251001`),
  but the default is data (`ai_provider_config`), not hard-coded.
- **Additive.** Extends the existing `AiService` and `types.ts`; reuses
  `BaseService`, `ServiceError`, `ListParams`. Nothing is duplicated.

---

## 2. Layered Overview

```
┌───────────────────────────── Browser (client bundle) ─────────────────────────────┐
│  features/ai/*  (UI: assistant panel, message list, composer)                       │
│      │  TanStack Query hooks (useConversations, useMessages, useAsk)                 │
│      ▼                                                                               │
│  src/services/ai/AiService   ← the ONLY AI entry point for the app                  │
│      • CRUD ai_conversations       • listMessages()                                 │
│      • ask() ──────────────► supabase.functions.invoke("ai-assistant")              │
└──────────────────────────────────────┼──────────────────────────────────────────────┘
                                        │  authenticated (user bearer)
┌───────────────────────── Supabase Edge Function: ai-assistant ────────────────────┐
│  1. AuthGate         verify JWT, resolve userId + roles                             │
│  2. AiSettings       load per-user + workspace settings (provider, model, temp)     │
│  3. ContextBuilder   RBAC-scoped grounding (tasks, projects, reports, …)            │
│  4. PromptBuilder    system prompt + context block + conversation history           │
│  5. ProviderRegistry resolve AiProvider from ai_provider_config                     │
│  6. AiProvider       .generate() / .stream()  ──►  provider HTTP API                │
│  7. ConversationMgr  persist user + assistant messages, bump conversation           │
│  8. TokenUsage       record normalized usage + estimated cost                       │
│  9. Audit            log_ai_event for sensitive surfaces                            │
└──────────────────────────────────────┼──────────────────────────────────────────────┘
                                        ▼
              Anthropic API │ OpenAI API │ Google Gemini API │ Local LLM (Ollama/vLLM)
```

The seven requested components map to layers **3–8** (server) plus the client
`AiService`. Each is specified below.

---

## 3. AI Provider Interface

The heart of provider-agnosticism. Lives **server-side** in the Edge Function
(`supabase/functions/ai-assistant/providers/`). A provider adapter is a thin
translator: it maps the neutral `AiGenerateParams` onto one vendor's HTTP API and
normalizes the response (text, usage, finish reason) back to a neutral shape.

```ts
// supabase/functions/ai-assistant/providers/provider.ts

export type AiProviderId = "anthropic" | "openai" | "google" | "local";

/** Neutral message shape passed to every provider (system carried separately). */
export interface AiProviderMessage {
  role: "user" | "assistant";
  content: string;
}

/** Neutral generation request — no vendor-specific fields. */
export interface AiGenerateParams {
  model: string;                 // resolved model id for the chosen provider
  system: string;                // system prompt (PromptBuilder output)
  messages: AiProviderMessage[]; // ordered conversation turns
  maxOutputTokens: number;
  temperature?: number;
  stopSequences?: string[];
  signal?: AbortSignal;          // for cancellation / timeouts
}

/** Provider-normalized token accounting. */
export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AiFinishReason =
  | "stop" | "length" | "content_filter" | "tool_use" | "error";

export interface AiGenerateResult {
  text: string;
  usage: AiUsage;
  provider: AiProviderId;
  model: string;
  finishReason: AiFinishReason;
}

/** One streamed delta. */
export interface AiStreamChunk {
  delta: string;
  usage?: AiUsage;          // final chunk carries usage
  finishReason?: AiFinishReason;
}

/** Static description of a model a provider exposes. */
export interface AiModelDescriptor {
  id: string;               // e.g. "claude-opus-4-8"
  label: string;            // human-facing
  contextWindow: number;    // input token budget
  maxOutputTokens: number;
  inputCostPerMTok: number; // USD per 1M input tokens (for cost estimates)
  outputCostPerMTok: number;
  default?: boolean;
}

/** The contract every provider adapter implements. */
export interface AiProvider {
  readonly id: AiProviderId;
  readonly models: AiModelDescriptor[];
  generate(params: AiGenerateParams): Promise<AiGenerateResult>;
  stream(params: AiGenerateParams): AsyncIterable<AiStreamChunk>;
  /** Optional pre-flight token estimate; falls back to a heuristic if absent. */
  countTokens?(
    params: Pick<AiGenerateParams, "model" | "system" | "messages">,
  ): Promise<number>;
}
```

### 3.1 Adapters

| Adapter | File | Notes |
| --- | --- | --- |
| `AnthropicProvider` | `providers/anthropic.ts` | **Default.** Maps `system` → top-level `system`, `messages` → Messages API. Models: `claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`. Usage from `response.usage`. |
| `OpenAiProvider` | `providers/openai.ts` | Prepends `system` as a `role:"system"` message (Chat Completions / Responses API). Usage from `usage.prompt_tokens` / `completion_tokens`. |
| `GeminiProvider` | `providers/google.ts` | Maps `system` → `systemInstruction`, roles `assistant`→`model`. Usage from `usageMetadata`. |
| `LocalProvider` | `providers/local.ts` | **Future.** OpenAI-compatible endpoint (Ollama / vLLM / LM Studio) at a configurable base URL; usage estimated if the endpoint omits it. |

Each adapter reads its own key from Edge Function secrets
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `LOCAL_LLM_BASE_URL`)
and is only constructed when selected — an unconfigured provider is never
instantiated.

### 3.2 Provider Registry

```ts
// providers/registry.ts
const factories: Record<AiProviderId, () => AiProvider> = {
  anthropic: () => new AnthropicProvider(env("ANTHROPIC_API_KEY")),
  openai:    () => new OpenAiProvider(env("OPENAI_API_KEY")),
  google:    () => new GeminiProvider(env("GOOGLE_API_KEY")),
  local:     () => new LocalProvider(env("LOCAL_LLM_BASE_URL")),
};

/** Resolve the active provider from ai_provider_config (never hard-coded). */
export function resolveProvider(cfg: AiProviderConfig): AiProvider {
  const make = factories[cfg.providerId];
  if (!make) throw new AiError("unknown_provider", cfg.providerId);
  return make();
}
```

Model selection resolves through the config too: an incoming request may name a
*tier* (`fast` | `balanced` | `deep`) rather than a raw model id, and the config
maps each tier to a concrete model for the active provider. This keeps feature
code from ever hard-coding `claude-...` strings.

**Adding a provider = one adapter file + one registry entry + one config row.**
No change to `AiService`, the UI, prompts, or the DB.

---

## 4. Prompt Builder

Deterministic, testable assembly of the final request. Pure functions — no I/O,
no provider knowledge. Lives in `ai-assistant/prompt/`.

```ts
export interface PromptInput {
  surface: string | null;          // "tasks" | "analytics" | null (global)
  user: { id: string; displayName: string; roles: string[] };
  context: ContextBlock;           // from Context Builder (§5)
  history: AiProviderMessage[];    // prior turns (windowed)
  prompt: string;                  // the new user message
  settings: ResolvedAiSettings;    // persona, verbosity, language
}

export interface BuiltPrompt {
  system: string;
  messages: AiProviderMessage[];
}
```

Responsibilities:

- **System prompt composition** — base SpartaFlow persona + surface-specific
  instructions (from a `SYSTEM_PROMPTS` registry keyed by `surface`) + guardrails
  ("only use the provided context; never invent SpartaFlow data; refuse actions
  outside the user's role"). Surface prompts are small templates, not free text.
- **Context injection** — the `ContextBlock` is rendered into a delimited,
  clearly-labeled section (`<context>…</context>`) so the model can distinguish
  grounding data from instructions.
- **History windowing** — trims `history` to fit the model's `contextWindow`
  minus a reserved `maxOutputTokens`, keeping the most recent turns and always the
  first user turn. Uses `provider.countTokens?()` when available, else a
  ~4-chars-per-token heuristic.
- **Localization** — honors `settings.language` (from AI Settings / profile
  locale).
- **PII / injection hygiene** — strips known secret patterns and neutralizes
  obvious prompt-injection markers from *context* rows before they reach `system`.

The Prompt Builder never talks to a provider; it emits a neutral `BuiltPrompt`
that any adapter can consume.

---

## 5. Context Builder

Turns a request's `surface` + `context` hints into **grounding data the user is
authorized to see**. This is the security-critical layer.

```ts
export interface ContextRequest {
  surface: string | null;
  hints: Record<string, unknown>;   // AiCompletionRequest.context (entity ids, filters)
  userId: string;
}

export interface ContextBlock {
  summary: string;                  // short natural-language framing
  entities: ContextEntity[];        // structured, cited rows
  truncated: boolean;
}
```

Rules:

- **RLS is the enforcement point.** The Context Builder fetches through a Supabase
  client scoped to the **caller's JWT** (not the service role), so Postgres RLS
  (see `DATABASE_DESIGN.md`) filters every row. The AI can never read a task,
  report, or project the user couldn't open in the UI.
- **Surface resolvers.** A registry maps `surface` → a resolver that knows which
  tables to read and how to summarize them:

  | Surface | Reads (RLS-scoped) | Produces |
  | --- | --- | --- |
  | `tasks` | `tasks`, `task_activity`, `comments` | current task + thread summary |
  | `projects` | `projects`, `project_stats` view, `milestones` | health/progress digest |
  | `analytics` | `analytics_*` views, `time_log_totals` | KPI snapshot |
  | `reports` | `daily_checkins`, `midday_reports`, `eod_reports` | the user's own reports |
  | `dependencies` | `dependencies`, `dependency_activity` | blocker state |
  | `null` (global) | lightweight profile + assigned work | personal digest |

- **Bounded.** Each resolver caps rows/tokens and sets `truncated` so the Prompt
  Builder can note omissions. Never dumps whole tables.
- **Cited.** Entities carry `{ type, id, ref }` so the assistant can deep-link
  (`ETB-142`) and the UI can render source chips.
- **No writes.** The Context Builder is read-only. Any "AI does an action" feature
  is a separate, explicitly-authorized tool path (out of scope here; see §12).

---

## 6. AI Service (client) — 🔁 extend existing

`src/services/ai/ai.service.ts` already provides the client boundary. The design
**adds methods**, it does not rewrite the class. Signatures below compose the
existing `ask()` / `listMessages()` and reuse `BaseService` CRUD + `ServiceError`.

```ts
export class AiService extends BaseService<AiConversation, …> {
  // ── existing (do not change) ─────────────────────────────
  listForUser(userId, params?): Promise<AiConversation[]>
  listMessages(conversationId): Promise<AiMessage[]>
  ask(request: AiCompletionRequest): Promise<AiCompletionResponse>

  // ── new (additive) ───────────────────────────────────────
  /** Streamed variant of ask(); yields deltas from the Edge Function (SSE). */
  askStream(request: AiCompletionRequest): AsyncIterable<AiStreamChunk>

  /** Rename / retitle a conversation (reuses BaseService.update). */
  rename(conversationId: string, title: string): Promise<AiConversation>

  /** Soft-archive a conversation (sets archivedAt). */
  archive(conversationId: string): Promise<AiConversation>

  /** Per-user + workspace AI settings (§10). */
  getSettings(userId: string): Promise<ResolvedAiSettings>
  updateSettings(userId: string, patch: AiSettingsUpdate): Promise<AiSettings>

  /** Token usage rollup for a user / workspace (§9). */
  getUsage(params: UsageQuery): Promise<AiUsageSummary>
}
```

Extend `src/services/ai/types.ts` with `AiStreamChunk`, `AiSettings`,
`AiSettingsUpdate`, `ResolvedAiSettings`, `AiUsageSummary`, `UsageQuery`, and add
an optional `usage?: AiUsage` / `model?: string` / `provider?: AiProviderId` to
`AiCompletionResponse` so the UI can show which model answered and its cost. All
are provider-neutral. Re-export the new types from `src/services/ai/index.ts` and
`src/services/index.ts` (already re-exports `aiService`).

**UI layer (`src/features/ai/`)** — the only new feature module. Follows the
feature-first shape (`components/`, `hooks/`, `types.ts`) and consumes `aiService`
through TanStack Query hooks (`useConversations`, `useMessages`, `useAsk`). Uses
only existing `ui/` primitives (Sheet/Dialog for the panel, Card, Button, Avatar,
Badge) — no new UI primitives (CLAUDE.md UI Rules).

---

## 7. Conversation Manager

Server-side orchestration inside the Edge Function that owns message persistence
and history assembly. Keeps the client `AiService` thin.

Responsibilities per `ask()` call:

1. **Resolve or create** the conversation. If `AiCompletionRequest.conversationId`
   is absent, insert an `ai_conversations` row (title derived from the first
   prompt, e.g. first ~48 chars; `surface` from the request).
2. **Load history** — `ai_messages` for the conversation, oldest-first, windowed
   for the model budget (delegated to the Prompt Builder).
3. **Persist the user turn** — insert the user `ai_message` *before* calling the
   provider (so a provider failure still records the question).
4. **Persist the assistant turn** — after `generate()`/`stream()` completes, insert
   the assistant `ai_message` (with `model`, `provider`, `finishReason` in
   `context`), then bump `ai_conversations.updatedAt` (drives the
   most-recent-first list the existing `listForUser` orders by).
5. **Return** `AiCompletionResponse { conversationId, message, usage, model, provider }`
   — a superset of today's shape, backward compatible.

For streaming, steps 3–4 wrap the stream: the user turn is persisted up front, the
assistant turn is persisted from the accumulated deltas when the stream closes
(and on cancellation, whatever was produced is saved with `finishReason:"error"`).

Concurrency/idempotency: an optional client `requestId` (UUID) is carried in
`context` and stored on the user message with a partial-unique guard to make
retries safe.

---

## 8. Token Usage Tracking

Every completion records normalized usage so the workspace can meter cost,
enforce quotas, and show per-user spend. Provider usage shapes differ; the adapter
normalizes them to `AiUsage` (§3) and the Edge Function writes one row.

Written by the Edge Function (service-role) after each completion — see the
`ai_token_usage` table (§11.3). Cost is computed from the model's
`inputCostPerMTok` / `outputCostPerMTok` in the model catalog, so historical rows
stay accurate even if pricing later changes.

- **Quota enforcement** (optional): before calling the provider, the Edge Function
  sums the period's `ai_token_usage` for the user/workspace and, if a configured
  cap in `ai_settings` is exceeded, returns a `quota_exceeded` `ServiceError`
  instead of calling the model.
- **Rollups**: `ai_usage_daily` view aggregates tokens + cost per user / provider /
  model / day for the Owner Dashboard and Analytics module (mirrors the
  "derived numbers are views" rule in `DATABASE_DESIGN.md §20`).
- `AiService.getUsage()` reads the rollup (RBAC-gated: self, or `owner:access`).

---

## 9. AI Settings

Two scopes, resolved into one effective `ResolvedAiSettings` per request
(user overrides workspace; workspace overrides system defaults).

**Workspace scope** — `ai_provider_config` (§11.5), owner/admin only:
active `providerId`, tier→model map, default temperature, max output tokens,
enabled surfaces, monthly workspace token cap, data-retention window for
`ai_messages`.

**User scope** — `ai_settings` (§11.4), self-service:
persona/verbosity, response language, per-user model tier preference (constrained
to what the workspace enables), streaming on/off, "include my reports/tasks as
context" consent toggles, personal token cap.

```ts
export interface ResolvedAiSettings {
  providerId: AiProviderId;      // from workspace config
  model: string;                 // resolved tier → model
  temperature: number;
  maxOutputTokens: number;
  persona: "concise" | "balanced" | "detailed";
  language: string;              // BCP-47, defaults to profile locale
  streaming: boolean;
  contextConsent: { reports: boolean; tasks: boolean; analytics: boolean };
  quota: { userCap: number | null; workspaceCap: number | null };
}
```

Resolution order: **system defaults → `ai_provider_config` → `ai_settings`**. The
client never picks the provider; it may only choose among workspace-enabled tiers.

---

## 10. Data flow (sequence)

```mermaid
sequenceDiagram
    participant UI as features/ai (UI)
    participant Svc as AiService (client)
    participant Fn as ai-assistant (Edge Fn)
    participant Ctx as ContextBuilder (RLS-scoped)
    participant Prov as AiProvider adapter
    participant DB as Postgres

    UI->>Svc: ask({ prompt, surface, context, conversationId? })
    Svc->>Fn: functions.invoke("ai-assistant", body) + user bearer
    Fn->>Fn: AuthGate (verify JWT → userId, roles)
    Fn->>DB: load ai_settings + ai_provider_config
    Fn->>Ctx: build(surface, hints, userId)
    Ctx->>DB: SELECT (caller-scoped, RLS enforced)
    Ctx-->>Fn: ContextBlock (authorized rows only)
    Fn->>DB: ensure ai_conversations; INSERT user ai_message
    Fn->>Fn: PromptBuilder → { system, messages }
    Fn->>Prov: generate() / stream()
    Prov-->>Fn: text + normalized AiUsage
    Fn->>DB: INSERT assistant ai_message; bump conversation.updatedAt
    Fn->>DB: INSERT ai_token_usage; log_ai_event (if sensitive)
    Fn-->>Svc: { conversationId, message, usage, model, provider }
    Svc-->>UI: AiCompletionResponse
```

---

## 11. Database schema

Follows every convention in `DATABASE_DESIGN.md`: `uuid` PKs
(`gen_random_uuid()`), `created_at`/`updated_at` via the existing
`tg_set_updated_at()` trigger, `ENABLE ROW LEVEL SECURITY` on every table, grants
to `authenticated`/`service_role` only (never `anon`), soft-delete via
`archivedAt`/`deletedAt`.

> **Column naming.** The **existing** `ai.service.ts` already queries camelCase
> columns (`conversationId`, `userId`, `createdAt`, `updatedAt`). To stay
> implementable against that shipped code without modifying it, the `ai_*` tables
> use quoted camelCase identifiers. This is a deliberate, localized exception to
> the snake_case convention, scoped to the AI tables only.

### 11.1 `ai_conversations` 🆕 (bound by `AiService.table`)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | `gen_random_uuid()` |
| "userId" | uuid NOT NULL | → `auth.users(id)` CASCADE |
| title | text NOT NULL | derived from first prompt |
| surface | text | feature that opened the assistant; nullable = global |
| "archivedAt" | timestamptz | soft archive |
| "createdAt" | timestamptz NOT NULL | default `now()` |
| "updatedAt" | timestamptz NOT NULL | trigger-maintained (drives recent-first list) |

- **Indexes**: `("userId", "updatedAt" DESC)`, partial `("userId") WHERE "archivedAt" IS NULL`.
- **RLS**: `USING ("userId" = auth.uid())` for select/insert/update/delete
  (a conversation is private to its owner). Admins do **not** read others'
  conversations by default (privacy); usage/audit rollups cover oversight.

### 11.2 `ai_messages` 🆕 (read by `AiService.listMessages`)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| "conversationId" | uuid NOT NULL | → `ai_conversations(id)` CASCADE |
| "userId" | uuid NOT NULL | denormalized owner (cheap RLS, per DB convention) |
| role | text NOT NULL | `user` \| `assistant` \| `system` (`AiRole`) |
| content | text NOT NULL | |
| context | jsonb | UI grounding hints / `{ model, provider, finishReason, requestId }` |
| "createdAt" | timestamptz NOT NULL | ordered oldest-first by `listMessages` |

- **Indexes**: `("conversationId", "createdAt")`; partial unique
  `("userId", (context->>'requestId')) WHERE context ? 'requestId'` for retry idempotency.
- **RLS**: `USING ("userId" = auth.uid())`. **Inserts via service-role only** (the
  Edge Function writes both turns) — users never insert assistant messages directly.
- **Retention**: a scheduled job purges messages older than the workspace
  retention window from `ai_provider_config`.

### 11.3 `ai_token_usage` 🆕 (append-only)

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid PK | |
| "userId" | uuid NOT NULL | → `auth.users(id)` SET NULL on delete (preserve metering) |
| "conversationId" | uuid | → `ai_conversations(id)` SET NULL |
| "messageId" | uuid | → `ai_messages(id)` SET NULL |
| provider | text NOT NULL | `AiProviderId` |
| model | text NOT NULL | resolved model id |
| surface | text | for per-feature cost analytics |
| "inputTokens" | int NOT NULL | |
| "outputTokens" | int NOT NULL | |
| "estimatedCostUsd" | numeric(10,6) | from model catalog at call time |
| "finishReason" | text | |
| "createdAt" | timestamptz NOT NULL | |

- **Indexes**: `("userId", "createdAt" DESC)`, `(provider, model, "createdAt")`.
- **Write path**: service-role only (Edge Function). **No UPDATE/DELETE grants** —
  append-only, like `audit_events`.
- **RLS**: self read own; `owner`/`super_admin` read all (cost oversight).
- **Rollup**: `ai_usage_daily` view — tokens + cost per `("userId", provider, model, day)`.

### 11.4 `ai_settings` 🆕 (per user)

| Column | Type | Notes |
| --- | --- | --- |
| "userId" | uuid PK | → `auth.users(id)` CASCADE (one row per user) |
| persona | text | `concise` \| `balanced` \| `detailed` (default `balanced`) |
| language | text | BCP-47; falls back to `profiles.locale` |
| "modelTier" | text | `fast` \| `balanced` \| `deep` (constrained by workspace) |
| streaming | boolean | default true |
| "contextConsent" | jsonb | `{ reports, tasks, analytics }` booleans |
| "monthlyTokenCap" | int | nullable personal quota |
| "createdAt" / "updatedAt" | timestamptz | trigger |

- **RLS**: `USING ("userId" = auth.uid())` — self read/write only.

### 11.5 `ai_provider_config` 🆕 (workspace singleton)

Mirrors the `company_settings` singleton pattern (`DATABASE_DESIGN.md §19`).

| Column | Type | Notes |
| --- | --- | --- |
| id | boolean PK `= true` | singleton |
| "providerId" | text NOT NULL | active `AiProviderId` (default `anthropic`) |
| "tierModels" | jsonb NOT NULL | `{ fast, balanced, deep }` → model ids per provider |
| temperature | numeric | default `0.3` |
| "maxOutputTokens" | int NOT NULL | default `2048` |
| "enabledSurfaces" | text[] | which features may open the assistant |
| "monthlyTokenCap" | int | workspace quota, nullable |
| "retentionDays" | int | `ai_messages` retention window |
| "createdAt" / "updatedAt" | timestamptz | trigger |

- **RLS**: read for all `authenticated` (clients need enabled tiers/surfaces);
  write only `owner`/`super_admin`. **API keys are NOT stored here** — they live
  in Edge Function secrets. This table only names the provider and non-secret
  routing/limits.
- **Seed** (default): `providerId='anthropic'`,
  `tierModels = { fast:'claude-haiku-4-5-20251001', balanced:'claude-sonnet-5', deep:'claude-opus-4-8' }`.

---

## 12. Edge Function `ai-assistant`

```
supabase/functions/ai-assistant/
  index.ts              # entry: AuthGate → orchestration (§7) → response (JSON or SSE)
  settings.ts           # resolve ai_provider_config + ai_settings → ResolvedAiSettings
  context/
    index.ts            # ContextBuilder (§5)
    resolvers/          # per-surface resolvers (tasks, projects, analytics, …)
  prompt/
    index.ts            # PromptBuilder (§4)
    system-prompts.ts   # base persona + per-surface templates + guardrails
  providers/
    provider.ts         # AiProvider interface + shared types (§3)
    registry.ts         # resolveProvider() + tier→model
    anthropic.ts        # default adapter
    openai.ts  google.ts  local.ts
  conversation.ts       # ConversationManager (§7)
  usage.ts              # token usage write + quota check (§8)
  audit.ts              # log_ai_event wrapper
  errors.ts             # AiError → HTTP status mapping (aligns with ServiceError codes)
```

- **Auth**: reuses the same JWT the app sends via `attachSupabaseAuth`
  (`ARCHITECTURE.md §10`); the function verifies claims and builds a caller-scoped
  client for the Context Builder, and a service-role client only for privileged
  writes (`ai_messages`, `ai_token_usage`, audit).
- **Secrets**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`,
  `LOCAL_LLM_BASE_URL` — set via `supabase secrets set`, never in the repo or
  client bundle.
- **Streaming**: when `settings.streaming`, the function responds with SSE; the
  client `askStream()` consumes deltas. Non-streaming path returns the existing
  JSON `AiCompletionResponse` shape (backward compatible with today's `ask()`).
- **Tool use / actions (future):** a guarded tool-call path can let the assistant
  *propose* SpartaFlow mutations (create task, update status). Every tool executes
  through the **existing domain services / RPCs** (RLS + validation reused), never
  raw SQL, and each action is `audit_events`-logged and requires the user's role.
  Out of scope for v1; the provider interface's `finishReason:"tool_use"` reserves
  room for it.

---

## 13. Security, RBAC & Audit

- **Keys server-only.** Provider keys never enter the client bundle
  (CLAUDE.md Security; existing `ask()` contract).
- **RLS everywhere.** All `ai_*` tables enable RLS; context reads go through the
  caller-scoped client so the AI inherits the user's row visibility — no
  escalation path.
- **RBAC.** `ai_provider_config` writes gated to `owner`/`super_admin`; usage
  oversight gated to `owner:access`; surface availability gated by
  `enabledSurfaces` + the user's role. Reuses `has_role` / `has_any_role` /
  `has_permission` helpers from `DATABASE_DESIGN.md`.
- **Input validation.** `AiCompletionRequest` is validated (zod on the client;
  re-validated in the Edge Function): prompt length caps, `surface` allowlist,
  `context` hint schema. Rejects oversized or malformed payloads before any model
  call (CLAUDE.md "Validate all inputs").
- **Audit.** Sensitive surfaces (analytics/owner data, any future tool action)
  write an `audit_events` row via `log_ai_event` (`action='ai_query'`,
  `entity_type=surface`), satisfying "Audit important actions".
- **Prompt-injection hygiene.** Context rows are treated as data, delimited in the
  prompt, and never interpreted as instructions; secret-pattern scrubbing runs
  before assembly (§4).
- **Cost safety.** Per-user and workspace token caps enforced before the provider
  call (§8).

---

## 14. Extensibility — adding a provider

1. Implement `AiProvider` in `providers/<vendor>.ts` (map params, normalize usage).
2. Register it in `providers/registry.ts` and add its key to Edge Function secrets.
3. Add its models to the catalog (ids, context window, pricing).
4. Set `ai_provider_config.providerId` (+ `tierModels`) — owner action, no deploy
   of client code.

No change to `AiService`, `features/ai`, prompts, context resolvers, or the DB
schema. That is the payoff of the neutral interface.

---

## 15. Build order

1. **Schema** — `ai_conversations`, `ai_messages` (unblocks the existing
   `AiService` CRUD + `listMessages`), with RLS + indexes.
2. **Edge Function skeleton** — AuthGate + ConversationManager + `AnthropicProvider`
   (default), non-streaming; wire the existing `ask()`.
3. **Prompt + Context (global surface)** — base system prompt + personal digest
   resolver.
4. **Settings + Usage** — `ai_settings`, `ai_provider_config`, `ai_token_usage`,
   `ai_usage_daily` view; `getSettings`/`updateSettings`/`getUsage` on `AiService`.
5. **UI** — `src/features/ai/` panel over existing `ui/` primitives + TanStack
   Query hooks; add streaming (`askStream`) + SSE.
6. **Surface resolvers** — tasks, projects, analytics, reports, dependencies.
7. **Additional providers** — OpenAI, Gemini adapters (§14).
8. **Local LLM + tool-use** — future waves.

---

*Design derived from the existing `src/services/ai/` code and the established
Supabase/RLS conventions. When implemented, regenerate
`src/integrations/supabase/types.ts` after each migration; never hand-edit it.
Update `docs/SERVICES.md` §AI and `docs/ARCHITECTURE.md` §5 to reference the live
AI boundary.*
