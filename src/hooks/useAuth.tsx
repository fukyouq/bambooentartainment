import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_RANK, SONK_ROLE_RANK, type AppRole } from "@/lib/bamboo";

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole;
  rank: number;
  /** Highest rank on the Sonk ladder (Moderator 1, Sonk Supervisor 2, Sonk Admin 3, Overseers 4-5). */
  sonkRank: number;
  /** Sonk handle, or null when the user has not created a Sonk account yet. */
  sonkHandle: string | null;
  warningCount: number;
  banned: boolean;
  canPostSonk: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole>("user");
  const [sonkRank, setSonkRank] = useState(0);
  const [sonkHandle, setSonkHandle] = useState<string | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [banned, setBanned] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRole("user");
      setSonkRank(0);
      setSonkHandle(null);
      setWarningCount(0);
      setBanned(false);
      return;
    }
    const [{ data: p }, { data: roles }, { data: acc }, { data: status }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, full_name, bio, avatar_url, email")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("sonk_accounts").select("handle").eq("user_id", userId).maybeSingle(),
      supabase
        .from("sonk_status")
        .select("warning_count, banned")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    setProfile((p as Profile | null) ?? null);
    const best = (roles ?? []).reduce<AppRole>(
      (acc, r) =>
        ROLE_RANK[r.role as AppRole] > ROLE_RANK[acc] ? (r.role as AppRole) : acc,
      "user",
    );
    setRole(best);
    setSonkRank(
      (roles ?? []).reduce((acc, r) => Math.max(acc, SONK_ROLE_RANK[r.role as AppRole] ?? 0), 0),
    );
    setSonkHandle(acc?.handle ?? null);
    setWarningCount(status?.warning_count ?? 0);
    setBanned(status?.banned ?? false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setTimeout(() => void load(next?.user?.id), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session?.user?.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    rank: ROLE_RANK[role],
    sonkRank,
    sonkHandle,
    warningCount,
    banned,
    canPostSonk: !!sonkHandle && warningCount < 3 && !banned,
    loading,
    refreshProfile: () => load(session?.user?.id),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setRole("user");
      setSonkRank(0);
      setSonkHandle(null);
      setWarningCount(0);
      setBanned(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}