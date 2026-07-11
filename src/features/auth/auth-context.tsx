import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { setCurrentActor } from "@/features/audit/audit-store";
import {
  fetchEmploymentType,
  fetchProfile,
  fetchRoles,
  signOut as serviceSignOut,
} from "./auth-service";
import { permissionsForRoles } from "./permissions";
import type { AppRole, AuthState, Permission, Profile } from "./types";

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [employmentType, setEmploymentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  const loadIdentity = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setProfile(null);
      setRoles([]);
      setEmploymentType(null);
      setCurrentActor(null);
      return;
    }
    try {
      const [p, r, et] = await Promise.all([
        fetchProfile(nextUser.id),
        fetchRoles(nextUser.id),
        fetchEmploymentType(nextUser.id),
      ]);
      setProfile(p);
      setRoles(r);
      setEmploymentType(et);
      // Attribute subsequent audit events to this user.
      setCurrentActor({
        id: nextUser.id,
        name: p?.full_name || p?.display_name || p?.email || nextUser.email || "Unknown",
      });
    } catch (err) {
      console.error("[auth] failed to load identity", err);
      setProfile(null);
      setRoles([]);
      setEmploymentType(null);
    }
  }, []);

  // Bootstrap + subscribe. Subscribe FIRST, then read the existing session.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore noisy refresh / initial-session events for identity reloads
      const nextUser = session?.user ?? null;
      const nextId = nextUser?.id ?? null;
      const prevId = lastUserIdRef.current;
      lastUserIdRef.current = nextId;

      setUser(nextUser);

      if (event === "SIGNED_OUT") {
        setProfile(null);
        setRoles([]);
        setEmploymentType(null);
        return;
      }

      // Only refetch identity when the user actually changed
      if (nextId && nextId !== prevId) {
        // Defer the supabase call out of the auth callback to avoid deadlocks
        setTimeout(() => {
          void loadIdentity(nextUser);
        }, 0);
      }
    });

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUser = session?.user ?? null;
      lastUserIdRef.current = sessionUser?.id ?? null;
      setUser(sessionUser);
      await loadIdentity(sessionUser);
      setLoading(false);
      setInitialized(true);
    })();

    return () => subscription.unsubscribe();
  }, [loadIdentity]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      setUser(u);
      await loadIdentity(u);
    } finally {
      setLoading(false);
    }
  }, [loadIdentity]);

  const signOut = useCallback(async () => {
    await serviceSignOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setEmploymentType(null);
    setCurrentActor(null);
  }, []);

  const value = useMemo<AuthState>(() => {
    const roleSet = new Set(roles);
    const permSet = permissionsForRoles(roles);
    const hasRole = (r: AppRole) => roleSet.has(r);
    const hasAnyRole = (rs: AppRole[]) => rs.some((r) => roleSet.has(r));
    const hasPermission = (p: Permission) => permSet.has(p);
    const hasAnyPermission = (ps: Permission[]) => ps.some((p) => permSet.has(p));
    return {
      user,
      profile,
      roles,
      employmentType,
      loading,
      initialized,
      isAuthenticated: !!user,
      hasRole,
      hasAnyRole,
      hasPermission,
      hasAnyPermission,
      refresh,
      signOut,
    };
  }, [user, profile, roles, employmentType, loading, initialized, refresh, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export type { Session };
