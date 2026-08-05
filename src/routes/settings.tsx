import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeCheck, Music2, Palette, ShieldCheck, User, Video } from "lucide-react";
import { RedHeader } from "@/components/RedHeader";
import { VerifiedMark, SonkBadgeMark } from "@/components/sonk/Badges";
import { MediaPicker } from "@/components/sonk/MediaPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle, useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  MUSIC_MIN_SONGS,
  MUSIC_MIN_VIEWS,
  VERIFY_CATEGORIES,
  VERIFY_LABEL,
  eligibilityIssues,
  type BadgeKind,
  type VerifyCategory,
  type VerifyStatus,
} from "@/lib/sonk";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account settings & verification — Sonk" },
      {
        name: "description",
        content:
          "Create your Sonk handle, apply for individual, business or government verification, request the music badge and switch to dark mode.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Account settings & verification — Sonk" },
      {
        property: "og:description",
        content: "Manage your Sonk account, verification requests, music verification and theme.",
      },
    ],
  }),
  component: SettingsPage,
});

const input = "min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm";
const box = "rounded-xl border-2 border-border p-4";
const btnRed =
  "min-h-11 rounded-full bg-news-red px-4 text-sm font-bold text-news-red-foreground disabled:opacity-60";
const btn =
  "min-h-11 rounded-full border-2 border-border px-4 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Section = "account" | "verification" | "music" | "badges" | "appearance";

const SECTIONS: { id: Section; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "music", label: "Music verification", icon: Music2 },
  { id: "badges", label: "Your badges", icon: BadgeCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <RedHeader title="Settings" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8"
      >
        {children}
      </main>
    </div>
  );
}

function SettingsPage() {
  const { user, loading } = useAuth();
  const [section, setSection] = useState<Section>("account");

  if (loading) return <Shell>Loading…</Shell>;
  if (!user)
    return (
      <Shell>
        <p className="text-sm">
          <Link to="/auth" className="font-bold underline">
            Sign in
          </Link>{" "}
          to manage your Sonk account.
        </p>
      </Shell>
    );

  return (
    <Shell>
      <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex flex-col gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-full px-3 text-left text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === id && "bg-muted text-news-red",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
          <Link
            to="/sonk-studio"
            className="mt-2 flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-bold hover:bg-muted"
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            Open Sonk Studio
          </Link>
        </nav>

        <div className="space-y-6">
          {section === "account" && <SonkAccount />}
          {section === "verification" && <VerificationPanel />}
          {section === "music" && <MusicPanel />}
          {section === "badges" && <MarksPanel />}
          {section === "appearance" && <AppearancePanel />}
        </div>
      </div>
    </Shell>
  );
}

function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  return (
    <section className={box} aria-labelledby="appearance">
      <h2 id="appearance" className="font-typewriter text-xl font-bold">
        Appearance
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Dark mode applies across Bamboo Entartainment and is remembered on this device.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className={cn(btn, theme === t && "bg-muted text-news-red")}
          >
            {t === "light" ? "Light" : "Dark"}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <ThemeToggle className="border-2 border-border" />
      </div>
    </section>
  );
}

/** Create the Sonk handle — required before anyone can post on Sonk. */
function SonkAccount() {
  const { user, sonkHandle, profile, refreshProfile, warningCount, banned } = useAuth();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const clean = handle.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean))
      return toast.error("Handles are 3–20 letters, numbers or underscores.");
    setBusy(true);
    const { error } = await supabase
      .from("sonk_accounts")
      .insert({ user_id: user!.id, handle: clean });
    setBusy(false);
    if (error)
      return toast.error(error.message.includes("duplicate") ? "That handle is taken." : error.message);
    toast.success("Sonk account created — you can post now");
    await refreshProfile();
  };

  return (
    <section className={box} aria-labelledby="sonk-account">
      <h2 id="sonk-account" className="font-typewriter text-xl font-bold">
        Sonk account
      </h2>
      {sonkHandle ? (
        <p className="mt-2 text-sm">
          Your handle is <span className="font-bold">@{sonkHandle}</span>
          {banned
            ? " — this account is banned after a fourth warning."
            : warningCount > 0
              ? ` — you are on warning ${warningCount} of 3.`
              : " — you are in good standing."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Pick a handle to start posting videos, shorts and feed posts on Sonk.
          </p>
          <label className="block text-xs font-bold uppercase" htmlFor="sonk-handle">
            Handle
          </label>
          <input
            id="sonk-handle"
            className={input}
            value={handle}
            maxLength={20}
            placeholder={profile?.username ?? "yourname"}
            onChange={(e) => setHandle(e.target.value)}
          />
          <button type="button" disabled={busy} onClick={() => void create()} className={btnRed}>
            {busy ? "Creating…" : "Create Sonk account"}
          </button>
        </div>
      )}
    </section>
  );
}

function StatusLine({ status, note }: { status: VerifyStatus; note?: string | null }) {
  const label =
    status === "pending"
      ? "Waiting for a Sonk Supervisor to review your request"
      : status === "approved"
        ? "Approved"
        : "Denied";
  return (
    <p
      className={cn(
        "mt-2 text-sm font-bold",
        status === "denied" ? "text-news-red" : status === "approved" ? "text-bamboo" : "",
      )}
    >
      {label}
      {note ? <span className="block font-normal text-muted-foreground">{note}</span> : null}
    </p>
  );
}

const STEPS = ["Requirements", "Category", "Documents", "Review"] as const;

/** Settings → Verification: a staged Business / Individual / Government application. */
function VerificationPanel() {
  const { user, profile, sonkHandle } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<VerifyCategory>("individual");
  const [form, setForm] = useState({
    fullName: "",
    dob: "",
    country: "",
    city: "",
    idUrl: "",
    companyUrl: "",
    request: "",
  });
  const [busy, setBusy] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["my-verify-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_verification_requests")
        .select("id, category, status, decision_note, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: verified } = useQuery({
    queryKey: ["my-verification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_verification")
        .select("category")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["my-eligibility", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: postCount }, { count: articleCount }] = await Promise.all([
        supabase.from("sonk_posts").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
        supabase.from("articles").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
      ]);
      return { postCount: postCount ?? 0, articleCount: articleCount ?? 0 };
    },
  });

  const issues = eligibilityIssues({
    hasBio: !!profile?.bio,
    hasAvatar: !!profile?.avatar_url,
    hasUsername: !!sonkHandle || !!profile?.username,
    postCount: counts?.postCount ?? 0,
    articleCount: counts?.articleCount ?? 0,
    category,
  });

  const documentsComplete =
    category === "individual"
      ? !!(form.fullName.trim() && form.dob && form.country.trim() && form.city.trim() && form.idUrl.trim())
      : category === "business"
        ? !!form.companyUrl.trim()
        : form.request.trim().length >= 40;

  const submit = async () => {
    if (issues.length) return toast.error("You do not meet the requirements yet.");
    if (!documentsComplete) return toast.error("Complete every document field first.");
    setBusy(true);
    const { error } = await supabase.from("sonk_verification_requests").insert({
      user_id: user!.id,
      category,
      full_name: form.fullName.trim() || null,
      date_of_birth: form.dob || null,
      country: form.country.trim() || null,
      city: form.city.trim() || null,
      id_document_url: form.idUrl.trim() || null,
      company_documents_url: form.companyUrl.trim() || null,
      written_request: form.request.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Verification request sent");
    void qc.invalidateQueries({ queryKey: ["my-verify-request"] });
  };

  if (verified)
    return (
      <section className={box} aria-labelledby="verification">
        <h2 id="verification" className="font-typewriter text-xl font-bold">
          Verification
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold">
          <VerifiedMark category={verified.category as VerifyCategory} />
          {VERIFY_LABEL[verified.category as VerifyCategory]}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Sonk staff can remove verification if the account stops meeting the requirements.
        </p>
      </section>
    );

  if (existing && existing.status !== "denied")
    return (
      <section className={box} aria-labelledby="verification">
        <h2 id="verification" className="font-typewriter text-xl font-bold">
          Verification
        </h2>
        <p className="mt-2 text-sm">
          Request category: <span className="font-bold">{existing.category}</span>
        </p>
        <StatusLine status={existing.status as VerifyStatus} note={existing.decision_note} />
      </section>
    );

  const canAdvance =
    step === 0 ? issues.length === 0 : step === 1 ? true : step === 2 ? documentsComplete : true;

  return (
    <section className={box} aria-labelledby="verification">
      <h2 id="verification" className="font-typewriter text-xl font-bold">
        Verification
      </h2>
      {existing?.status === "denied" && (
        <StatusLine status="denied" note={existing.decision_note} />
      )}

      <ol className="mt-3 flex flex-wrap gap-2" aria-label="Verification stages">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-bold uppercase",
              i === step
                ? "bg-news-red text-news-red-foreground"
                : i < step
                  ? "bg-bamboo text-bamboo-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-4">
        {step === 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase">Stage 1 — Requirements</h3>
            {issues.length === 0 ? (
              <p className="mt-1 text-sm font-bold text-bamboo">
                You meet every requirement — continue to choose a category.
              </p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase">Stage 2 — Category</h3>
            {VERIFY_CATEGORIES.map((c) => (
              <label key={c.value} className="flex min-h-11 items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="verify-category"
                  className="mt-1"
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                />
                <span>
                  <span className="flex items-center gap-2 font-bold">
                    <VerifiedMark category={c.value} />
                    {c.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{c.help}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase">Stage 3 — Documents</h3>
            {category === "individual" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
                <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
                <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <div className="sm:col-span-2">
                  {user && (
                    <MediaPicker
                      userId={user.id}
                      label="Photo of your ID"
                      accept="image/*"
                      value={form.idUrl}
                      onChange={(v) => setForm({ ...form, idUrl: v })}
                    />
                  )}
                  {form.idUrl && (
                    <img
                      src={form.idUrl}
                      alt="Preview of the ID image you uploaded"
                      className="mt-2 max-h-48 rounded-lg border-2 border-border object-contain"
                    />
                  )}
                </div>
              </div>
            )}
            {category === "business" && (
              <>
                {user && (
                  <MediaPicker
                    userId={user.id}
                    label="Registered company documents"
                    accept="image/*,application/pdf"
                    value={form.companyUrl}
                    onChange={(v) => setForm({ ...form, companyUrl: v })}
                  />
                )}
              </>
            )}
            {category === "institution" && (
              <div>
                <label className="block text-xs font-bold uppercase" htmlFor="verify-request">
                  Written request
                </label>
                <textarea
                  id="verify-request"
                  rows={5}
                  maxLength={2000}
                  value={form.request}
                  onChange={(e) => setForm({ ...form, request: e.target.value })}
                  className="w-full rounded-sm border-2 border-border bg-background p-3 text-sm"
                  placeholder="Explain the institution and who is applying."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.request.trim().length}/40 characters minimum
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-bold uppercase">Stage 4 — Review</h3>
            <p className="flex items-center gap-2 font-bold">
              <VerifiedMark category={category} />
              {VERIFY_LABEL[category]}
            </p>
            {category === "individual" && (
              <p className="text-muted-foreground">
                {[form.fullName, form.dob, form.country, form.city].filter(Boolean).join(" · ")}
              </p>
            )}
            {form.idUrl && <p className="text-muted-foreground">ID image attached</p>}
            {form.companyUrl && <p className="text-muted-foreground">Company documents attached</p>}
            {form.request && <p className="whitespace-pre-wrap text-muted-foreground">{form.request}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {step > 0 && (
            <button type="button" className={btn} onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className={btnRed}
              disabled={!canAdvance}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          ) : (
            <button type="button" className={btnRed} disabled={busy} onClick={() => void submit()}>
              {busy ? "Sending…" : "Send verification request"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="block text-xs font-bold uppercase" htmlFor={id}>
        {label}
      </label>
      <input id={id} type={type} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Music verification: 10+ songs with 5M+ combined views unlocks featured sounds. */
function MusicPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [songs, setSongs] = useState("");
  const [views, setViews] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: request } = useQuery({
    queryKey: ["my-music-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_music_requests")
        .select("id, song_count, total_views, status, decision_note")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: hasBadge } = useQuery({
    queryKey: ["my-music-badge", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_badges")
        .select("badge")
        .eq("user_id", user!.id)
        .eq("badge", "music")
        .maybeSingle();
      return !!data;
    },
  });

  const songCount = Number(songs) || 0;
  const viewCount = Number(views) || 0;
  const meets = songCount >= MUSIC_MIN_SONGS && viewCount >= MUSIC_MIN_VIEWS;

  const revoke = async () => {
    if (!window.confirm("Remove your music verification? You can request it again later.")) return;
    setBusy(true);
    const { error } = await supabase
      .from("sonk_badges")
      .delete()
      .eq("user_id", user!.id)
      .eq("badge", "music");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Music verification removed");
    void qc.invalidateQueries({ queryKey: ["my-music-badge"] });
    void qc.invalidateQueries({ queryKey: ["my-badges"] });
  };

  const submit = async () => {
    if (!meets)
      return toast.error(
        `You need ${MUSIC_MIN_SONGS}+ songs and ${MUSIC_MIN_VIEWS.toLocaleString()}+ combined views.`,
      );
    setBusy(true);
    const { error } = await supabase.from("sonk_music_requests").insert({
      user_id: user!.id,
      song_count: songCount,
      total_views: viewCount,
      catalogue_url: url.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Music verification request sent");
    void qc.invalidateQueries({ queryKey: ["my-music-request"] });
  };

  return (
    <section className={box} aria-labelledby="music-verification">
      <h2 id="music-verification" className="font-typewriter text-xl font-bold">
        Music verification
      </h2>
      {hasBadge ? (
        <div className="mt-2 space-y-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <SonkBadgeMark badge={"music" as BadgeKind} />
            Approved — music badge granted and featured sounds unlocked.
          </p>
          {request && (
            <p className="text-sm text-muted-foreground">
              Verified with {request.song_count} songs ·{" "}
              {request.total_views.toLocaleString()} combined views
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Removing verification takes the badge off your account and locks featured sounds again.
          </p>
          <button type="button" disabled={busy} onClick={() => void revoke()} className={btnRed}>
            {busy ? "Removing…" : "Remove music verification"}
          </button>
        </div>
      ) : request && request.status !== "denied" ? (
        <>
          <p className="mt-2 text-sm">
            {request.song_count} songs · {request.total_views.toLocaleString()} combined views
          </p>
          <StatusLine status={request.status as VerifyStatus} note={request.decision_note} />
        </>
      ) : (
        <div className="mt-3 space-y-3">
          {request?.status === "denied" && <StatusLine status="denied" note={request.decision_note} />}
          <p className="text-sm text-muted-foreground">
            Requires {MUSIC_MIN_SONGS}+ released songs with {MUSIC_MIN_VIEWS.toLocaleString()}+
            combined views. Approval grants the music badge and unlocks featured sounds.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Number of songs" type="number" value={songs} onChange={setSongs} />
            <Field label="Combined views" type="number" value={views} onChange={setViews} />
            <div className="sm:col-span-2">
              <Field label="Link to your catalogue" value={url} onChange={setUrl} />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wide">
            {meets
              ? "Thresholds met"
              : `${songCount}/${MUSIC_MIN_SONGS} songs · ${viewCount.toLocaleString()}/${MUSIC_MIN_VIEWS.toLocaleString()} views`}
          </p>
          <button type="button" disabled={busy || !meets} onClick={() => void submit()} className={btnRed}>
            {busy ? "Sending…" : "Request music verification"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Read-only view of the badges already granted to this account. */
function MarksPanel() {
  const { user } = useAuth();
  const { data: badges = [] } = useQuery({
    queryKey: ["my-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("sonk_badges").select("badge").eq("user_id", user!.id);
      return (data ?? []).map((b) => b.badge as BadgeKind);
    },
  });
  return (
    <section className={box} aria-labelledby="my-badges">
      <h2 id="my-badges" className="font-typewriter text-xl font-bold">
        Your badges
      </h2>
      {badges.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No badges yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-3">
          {badges.map((b) => (
            <li key={b}>
              <SonkBadgeMark badge={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
