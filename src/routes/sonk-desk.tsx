import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RedHeader } from "@/components/RedHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SonkBadgeMark, VerifiedMark } from "@/components/sonk/Badges";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  BADGE_LABEL,
  timeAgo,
  type BadgeKind,
  type ReportStatus,
  type VerifyCategory,
} from "@/lib/sonk";

export const Route = createFileRoute("/sonk-desk")({
  head: () => ({
    meta: [
      { title: "Sonk moderation desk — Bamboo Entartainment" },
      {
        name: "description",
        content:
          "Sonk moderation desk: reports, warnings, verification and badge decisions, blacklist and blocks.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sonk moderation desk" },
      { property: "og:description", content: "Review Sonk reports, warnings and verification requests." },
    ],
  }),
  component: DeskPage,
});

const box = "border-2 border-border p-4";
const btn =
  "min-h-11 rounded-sm border-2 border-border px-3 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnRed = "min-h-11 rounded-sm bg-news-red px-3 text-sm font-bold text-news-red-foreground";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RedHeader title="Sonk moderation desk" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function DeskPage() {
  const { user, sonkRank, loading } = useAuth();
  if (loading) return <Shell>Loading…</Shell>;
  if (!user)
    return (
      <Shell>
        <p className="text-sm">
          <Link to="/auth" className="font-bold underline">
            Sign in
          </Link>{" "}
          to use the moderation desk.
        </p>
      </Shell>
    );
  if (sonkRank < 1)
    return <Shell>Only Sonk Moderators and above can use the moderation desk.</Shell>;

  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Moderator tools. Sonk Supervisors and above can decide verification requests; Sonk
        Administrators and above can grant badges and verify without a request.
      </p>
      <Reports />
      <Warnings />
      <VerificationRequests rank={sonkRank} />
      <MusicRequests rank={sonkRank} />
      <BadgeGrants rank={sonkRank} />
      <Blacklist />
      <Blocks />
    </Shell>
  );
}

function useMembers() {
  return useQuery({
    queryKey: ["desk-members"],
    queryFn: async () => {
      const { data } = await supabase.from("public_profiles").select("id, username");
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.id] = p.username;
      return map;
    },
  });
}

function Reports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const { data: reports = [] } = useQuery({
    queryKey: ["desk-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_reports")
        .select("id, target_type, target_id, reporter_id, reason, status, created_at")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = async (id: string, status: ReportStatus) => {
    const { error } = await supabase
      .from("sonk_reports")
      .update({ status, handled_by: user!.id, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "actioned" ? "Report actioned" : "Report dismissed");
    void qc.invalidateQueries({ queryKey: ["desk-reports"] });
  };

  const hideTarget = async (target: "post" | "comment", id: string) => {
    const { error } = await supabase
      .from(target === "post" ? "sonk_posts" : "sonk_comments")
      .update({ hidden: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Content hidden");
  };

  const open = reports.filter((r) => r.status === "open");

  return (
    <section className={box} aria-labelledby="reports">
      <h2 id="reports" className="font-typewriter text-xl font-bold">
        Reports ({open.length} open)
      </h2>
      {reports.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No reports.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {reports.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {r.target_type} · reported by @{names[r.reporter_id] ?? "member"} ·{" "}
                  {timeAgo(r.created_at)}
                </p>
                <p className="text-sm text-muted-foreground">{r.reason}</p>
                <p className="text-xs uppercase tracking-wide">{r.status}</p>
              </div>
              {r.status === "open" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btn}
                    onClick={() => void hideTarget(r.target_type as "post" | "comment", r.target_id)}
                  >
                    Hide content
                  </button>
                  <button type="button" className={btnRed} onClick={() => void decide(r.id, "actioned")}>
                    Action
                  </button>
                  <button type="button" className={btn} onClick={() => void decide(r.id, "dismissed")}>
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Warnings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");

  const { data: warnings = [] } = useQuery({
    queryKey: ["desk-warnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_warnings")
        .select("id, user_id, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["desk-warnings"] });
  };

  const issue = async () => {
    if (!target.trim() || !reason.trim()) return toast.error("Pick an account and give a reason.");
    const { error } = await supabase
      .from("sonk_warnings")
      .insert({ user_id: target, issued_by: user!.id, reason: reason.trim() });
    if (error) return toast.error(error.message);
    toast.success("Warning issued");
    setReason("");
    refresh();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("sonk_warnings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Warning removed");
    refresh();
  };

  return (
    <section className={box} aria-labelledby="warnings">
      <h2 id="warnings" className="font-typewriter text-xl font-bold">
        Warnings
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        1st warning: likes become dislikes and the bio and picture are cleared. 2nd: videos drop out
        of the algorithm. 3rd: posting is blocked. A fourth warning bans the account.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
        <div>
          <label className="block text-xs font-bold uppercase" htmlFor="warn-user">
            Account
          </label>
          <select
            id="warn-user"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-h-11 w-full rounded-sm border-2 border-border bg-background px-2 text-sm"
          >
            <option value="">Select an account</option>
            {Object.entries(names).map(([id, name]) => (
              <option key={id} value={id}>
                @{name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase" htmlFor="warn-reason">
            Reason
          </label>
          <input
            id="warn-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm"
          />
        </div>
        <button type="button" className={`${btnRed} self-end`} onClick={() => void issue()}>
          Issue warning
        </button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {warnings.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">No warnings on record.</li>
        )}
        {warnings.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              <span className="font-bold">@{names[w.user_id] ?? "member"}</span> — {w.reason}{" "}
              <span className="text-xs text-muted-foreground">{timeAgo(w.created_at)}</span>
            </span>
            <button type="button" className={btn} onClick={() => void revoke(w.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VerificationRequests({ rank }: { rank: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const { data: requests = [] } = useQuery({
    queryKey: ["desk-verify"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_verification_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = async (
    id: string,
    userId: string,
    category: VerifyCategory,
    approve: boolean,
  ) => {
    const note = window.prompt(approve ? "Note for the applicant (optional)" : "Why is this denied?");
    if (!approve && !note?.trim()) return;
    const { error } = await supabase
      .from("sonk_verification_requests")
      .update({
        status: approve ? "approved" : "denied",
        decision_note: note?.trim() || null,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (approve) {
      const { error: vErr } = await supabase
        .from("sonk_verification")
        .insert({ user_id: userId, category, verified_by: user!.id });
      if (vErr) toast.error(vErr.message);
    }
    toast.success(approve ? "Account verified" : "Request denied");
    void qc.invalidateQueries({ queryKey: ["desk-verify"] });
  };

  const verifyDirect = async (userId: string, category: VerifyCategory) => {
    const { error } = await supabase
      .from("sonk_verification")
      .insert({ user_id: userId, category, verified_by: user!.id });
    if (error) return toast.error(error.message);
    toast.success("Account verified");
  };

  const removeVerification = async (userId: string) => {
    if (!window.confirm("Remove verification from this account?")) return;
    const { error } = await supabase.from("sonk_verification").delete().eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Verification removed");
  };

  const [directUser, setDirectUser] = useState("");
  const [directCat, setDirectCat] = useState<VerifyCategory>("individual");

  return (
    <section className={box} aria-labelledby="verify-requests">
      <h2 id="verify-requests" className="font-typewriter text-xl font-bold">
        Verification requests
      </h2>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-center gap-2 font-bold">
                  <VerifiedMark category={r.category as VerifyCategory} />@
                  {names[r.user_id] ?? "member"} · {r.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[r.full_name, r.date_of_birth, r.country, r.city].filter(Boolean).join(" · ")}
                </p>
                {r.id_document_url && (
                  <a href={r.id_document_url} className="text-xs underline" target="_blank" rel="noreferrer">
                    Photo ID
                  </a>
                )}
                {r.company_documents_url && (
                  <a
                    href={r.company_documents_url}
                    className="ml-3 text-xs underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Company documents
                  </a>
                )}
                {r.written_request && (
                  <p className="mt-1 whitespace-pre-wrap text-xs">{r.written_request}</p>
                )}
                <p className="text-xs uppercase tracking-wide">{r.status}</p>
              </div>
              {r.status === "pending" &&
                (rank >= 2 ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnRed}
                      onClick={() => void decide(r.id, r.user_id, r.category as VerifyCategory, true)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className={btn}
                      onClick={() => void decide(r.id, r.user_id, r.category as VerifyCategory, false)}
                    >
                      Deny
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sonk Supervisors and above decide these.
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}

      {rank >= 3 && (
        <div className="mt-5 border-t-2 border-border pt-4">
          <h3 className="text-xs font-bold uppercase">Verify without a request</h3>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold uppercase" htmlFor="direct-user">
                Account
              </label>
              <select
                id="direct-user"
                value={directUser}
                onChange={(e) => setDirectUser(e.target.value)}
                className="min-h-11 rounded-sm border-2 border-border bg-background px-2 text-sm"
              >
                <option value="">Select an account</option>
                {Object.entries(names).map(([id, name]) => (
                  <option key={id} value={id}>
                    @{name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase" htmlFor="direct-cat">
                Category
              </label>
              <select
                id="direct-cat"
                value={directCat}
                onChange={(e) => setDirectCat(e.target.value as VerifyCategory)}
                className="min-h-11 rounded-sm border-2 border-border bg-background px-2 text-sm"
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="institution">Government / Institution</option>
              </select>
            </div>
            <button
              type="button"
              className={btnRed}
              onClick={() => directUser && void verifyDirect(directUser, directCat)}
            >
              Verify account
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => directUser && void removeVerification(directUser)}
            >
              Remove verification
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MusicRequests({ rank }: { rank: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const { data: requests = [] } = useQuery({
    queryKey: ["desk-music"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_music_requests")
        .select("id, user_id, song_count, total_views, catalogue_url, status")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = async (id: string, userId: string, approve: boolean) => {
    const note = window.prompt(approve ? "Note (optional)" : "Why is this denied?");
    if (!approve && !note?.trim()) return;
    const { error } = await supabase
      .from("sonk_music_requests")
      .update({
        status: approve ? "approved" : "denied",
        decision_note: note?.trim() || null,
        reviewed_by: user!.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    if (approve) {
      const { error: bErr } = await supabase
        .from("sonk_badges")
        .insert({ user_id: userId, badge: "music", granted_by: user!.id });
      if (bErr) toast.error(bErr.message);
    }
    toast.success(approve ? "Music badge granted — featured sounds unlocked" : "Request denied");
    void qc.invalidateQueries({ queryKey: ["desk-music"] });
  };

  return (
    <section className={box} aria-labelledby="music-requests">
      <h2 id="music-requests" className="font-typewriter text-xl font-bold">
        Music verification requests
      </h2>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing waiting for review.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">@{names[r.user_id] ?? "member"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.song_count} songs · {r.total_views.toLocaleString()} views ·{" "}
                  {r.status}
                </p>
                {r.catalogue_url && (
                  <a href={r.catalogue_url} className="text-xs underline" target="_blank" rel="noreferrer">
                    Catalogue
                  </a>
                )}
              </div>
              {r.status === "pending" &&
                (rank >= 3 ? (
                  <div className="flex gap-2">
                    <button type="button" className={btnRed} onClick={() => void decide(r.id, r.user_id, true)}>
                      Grant badge
                    </button>
                    <button type="button" className={btn} onClick={() => void decide(r.id, r.user_id, false)}>
                      Deny
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sonk Administrators decide these.</p>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BadgeGrants({ rank }: { rank: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const [target, setTarget] = useState("");
  const [badge, setBadge] = useState<BadgeKind>("staff");

  const { data: granted = [] } = useQuery({
    queryKey: ["desk-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sonk_badges").select("id, user_id, badge");
      if (error) throw error;
      return data ?? [];
    },
  });

  const allowed = (b: BadgeKind) => (b === "staff" ? rank >= 2 : rank >= 3);

  const grant = async () => {
    if (!target) return toast.error("Pick an account.");
    if (!allowed(badge))
      return toast.error("Your role cannot grant that badge.");
    const { error } = await supabase
      .from("sonk_badges")
      .insert({ user_id: target, badge, granted_by: user!.id });
    if (error) return toast.error(error.message);
    toast.success(`${BADGE_LABEL[badge]} granted`);
    void qc.invalidateQueries({ queryKey: ["desk-badges"] });
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("sonk_badges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Badge removed");
    void qc.invalidateQueries({ queryKey: ["desk-badges"] });
  };

  return (
    <section className={box} aria-labelledby="badges">
      <h2 id="badges" className="font-typewriter text-xl font-bold">
        Badges
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Supervisors and above grant the staff badge. Sonk Administrators and above grant official,
        media and music badges.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold uppercase" htmlFor="badge-user">
            Account
          </label>
          <select
            id="badge-user"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-h-11 rounded-sm border-2 border-border bg-background px-2 text-sm"
          >
            <option value="">Select an account</option>
            {Object.entries(names).map(([id, name]) => (
              <option key={id} value={id}>
                @{name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase" htmlFor="badge-kind">
            Badge
          </label>
          <select
            id="badge-kind"
            value={badge}
            onChange={(e) => setBadge(e.target.value as BadgeKind)}
            className="min-h-11 rounded-sm border-2 border-border bg-background px-2 text-sm"
          >
            {(["staff", "official", "media", "music"] as BadgeKind[]).map((b) => (
              <option key={b} value={b}>
                {BADGE_LABEL[b]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={btnRed} onClick={() => void grant()}>
          Grant badge
        </button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {granted.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">No badges granted yet.</li>
        )}
        {granted.map((g) => (
          <li key={g.id} className="flex items-center gap-3 py-2 text-sm">
            <SonkBadgeMark badge={g.badge as BadgeKind} />
            <span className="min-w-0 flex-1">
              @{names[g.user_id] ?? "member"} — {BADGE_LABEL[g.badge as BadgeKind]}
            </span>
            <button type="button" className={btn} onClick={() => void revoke(g.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Blacklist() {
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const { data: posts = [] } = useQuery({
    queryKey: ["desk-blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_posts")
        .select("id, author_id, kind, title, body, hidden, blacklisted, created_at")
        .or("hidden.eq.true,blacklisted.eq.true")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  const set = async (id: string, patch: { hidden?: boolean; blacklisted?: boolean }) => {
    const { error } = await supabase.from("sonk_posts").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    void qc.invalidateQueries({ queryKey: ["desk-blacklist"] });
  };

  return (
    <section className={box} aria-labelledby="blacklist">
      <h2 id="blacklist" className="font-typewriter text-xl font-bold">
        Hidden &amp; blacklisted posts
      </h2>
      {posts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing hidden or blacklisted.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{p.title ?? p.body?.slice(0, 80) ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground">
                  @{names[p.author_id] ?? "member"} · {p.kind} ·{" "}
                  {[p.hidden ? "hidden" : null, p.blacklisted ? "blacklisted" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => void set(p.id, { hidden: !p.hidden })}>
                  {p.hidden ? "Unhide" : "Hide"}
                </button>
                <button
                  type="button"
                  className={btn}
                  onClick={() => void set(p.id, { blacklisted: !p.blacklisted })}
                >
                  {p.blacklisted ? "Un-blacklist" : "Blacklist"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Blocks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: names = {} } = useMembers();
  const { data: blocks = [] } = useQuery({
    queryKey: ["desk-blocks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sonk_blocks")
        .select("blocked_id, created_at")
        .eq("blocker_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unblock = async (id: string) => {
    const { error } = await supabase
      .from("sonk_blocks")
      .delete()
      .eq("blocker_id", user!.id)
      .eq("blocked_id", id);
    if (error) return toast.error(error.message);
    toast.success("Account unblocked");
    void qc.invalidateQueries({ queryKey: ["desk-blocks"] });
  };

  return (
    <section className={box} aria-labelledby="blocks">
      <h2 id="blocks" className="font-typewriter text-xl font-bold">
        Your blocked accounts
      </h2>
      {blocks.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">You have not blocked anyone.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {blocks.map((b) => (
            <li key={b.blocked_id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">@{names[b.blocked_id] ?? "member"}</span>
              <button type="button" className={btn} onClick={() => void unblock(b.blocked_id)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
