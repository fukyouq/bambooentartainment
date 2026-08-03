import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Heart, MessageCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { RedHeader } from "@/components/RedHeader";
import { AccountMarks, EMPTY_MARKS } from "@/components/sonk/Badges";
import { MediaPicker } from "@/components/sonk/MediaPicker";
import { SonkComposer } from "@/components/sonk/SonkFeed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo, type SonkKind, type SonkPost } from "@/lib/sonk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sonk-studio")({
  head: () => ({
    meta: [
      { title: "Sonk Studio — your channel & video tools" },
      {
        name: "description",
        content:
          "Sonk Studio: your channel overview, upload tools and per-video editing, visibility and analytics.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sonk Studio" },
      { property: "og:description", content: "Manage your Sonk channel, uploads and videos." },
    ],
  }),
  component: StudioPage,
});

const box = "rounded-xl border-2 border-border p-4";
const btn =
  "min-h-11 rounded-full border-2 border-border px-3 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const btnRed =
  "min-h-11 rounded-full bg-news-red px-4 text-sm font-bold text-news-red-foreground disabled:opacity-60";
const input = "min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <RedHeader title="Sonk Studio" />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 space-y-8 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function StudioPage() {
  const { user, loading, sonkHandle, profile } = useAuth();
  const [uploadKind, setUploadKind] = useState<SonkKind>("video");

  const { data: posts = [], refetch } = useQuery({
    queryKey: ["studio-posts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_posts")
        .select("id, author_id, kind, title, body, media_url, thumbnail_url, created_at, hidden, blacklisted")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as SonkPost[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["studio-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const ids = posts.map((p) => p.id);
      if (!ids.length) return { likes: 0, comments: 0 };
      const [{ count: likes }, { count: comments }] = await Promise.all([
        supabase.from("sonk_likes").select("post_id", { count: "exact", head: true }).in("post_id", ids),
        supabase.from("sonk_comments").select("id", { count: "exact", head: true }).in("post_id", ids),
      ]);
      return { likes: likes ?? 0, comments: comments ?? 0 };
    },
  });

  if (loading) return <Shell>Loading…</Shell>;
  if (!user)
    return (
      <Shell>
        <p className="text-sm">
          <Link to="/auth" className="font-bold underline">
            Sign in
          </Link>{" "}
          to open your Sonk Studio.
        </p>
      </Shell>
    );
  if (!sonkHandle)
    return (
      <Shell>
        <p className="text-sm">
          Create your Sonk handle in{" "}
          <Link to="/settings" className="font-bold underline">
            Settings
          </Link>{" "}
          to open the Studio.
        </p>
      </Shell>
    );

  const videos = posts.filter((p) => p.kind === "video");
  const shorts = posts.filter((p) => p.kind === "short");

  return (
    <Shell>
      {/* Channel banner */}
      <section className={box} aria-labelledby="channel">
        <div className="flex flex-wrap items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-bamboo font-typewriter text-xl font-bold text-bamboo-foreground"
            >
              {sonkHandle.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 id="channel" className="flex items-center gap-2 font-typewriter text-2xl font-bold">
              @{sonkHandle}
              <AccountMarks userId={user.id} marks={EMPTY_MARKS} />
            </h2>
            <p className="text-sm text-muted-foreground">{profile?.bio ?? "No bio yet."}</p>
          </div>
          <Link to="/announcements" className={cn(btn, "ml-auto flex items-center")}>
            View channel on Sonk
          </Link>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Videos" value={videos.length} />
          <Stat label="Shorts" value={shorts.length} />
          <Stat label="Likes" value={stats?.likes ?? 0} icon={<Heart className="h-4 w-4" aria-hidden="true" />} />
          <Stat
            label="Comments"
            value={stats?.comments ?? 0}
            icon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
          />
        </dl>
      </section>

      {/* Upload */}
      <section className={box} aria-labelledby="upload">
        <h2 id="upload" className="flex items-center gap-2 font-typewriter text-xl font-bold">
          <Upload className="h-5 w-5" aria-hidden="true" />
          Upload
        </h2>
        <div className="mt-3 flex gap-2">
          {(["video", "short", "post"] as SonkKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setUploadKind(k)}
              aria-pressed={uploadKind === k}
              className={cn(btn, uploadKind === k && "bg-muted text-news-red")}
            >
              {k === "video" ? "Long-form" : k === "short" ? "Short" : "Post"}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <SonkComposer kind={uploadKind} onDone={() => void refetch()} />
        </div>
      </section>

      {/* Content tools */}
      <section className={box} aria-labelledby="content">
        <h2 id="content" className="font-typewriter text-xl font-bold">
          Your content
        </h2>
        {posts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {posts.map((p) => (
              <StudioRow key={p.id} post={p} onChanged={() => void refetch()} />
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="font-typewriter text-2xl font-bold">{value}</dd>
    </div>
  );
}

/** Per-video tools: rename, rewrite the description, swap the thumbnail, hide or delete. */
function StudioRow({ post, onChanged }: { post: SonkPost; onChanged: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title ?? "");
  const [body, setBody] = useState(post.body ?? "");
  const [thumb, setThumb] = useState(post.thumbnail_url ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("sonk_posts")
      .update({
        title: title.trim() || null,
        body: body.trim() || null,
        thumbnail_url: thumb.trim() || null,
      })
      .eq("id", post.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Changes saved");
    setEditing(false);
    onChanged();
    void qc.invalidateQueries({ queryKey: ["studio-stats"] });
  };

  const setHidden = async (hidden: boolean) => {
    const { error } = await supabase.from("sonk_posts").update({ hidden }).eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success(hidden ? "Set to private" : "Set to public");
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm("Delete this permanently?")) return;
    const { error } = await supabase.from("sonk_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="block h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : post.media_url ? (
            <video src={post.media_url} muted className="h-full w-full object-cover" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{post.title ?? post.body?.slice(0, 60) ?? "Untitled"}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {post.kind} · {timeAgo(post.created_at)} · {post.hidden ? "Private" : "Public"}
            {post.blacklisted ? " · removed from recommendations" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => setEditing((e) => !e)}>
            {editing ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => void setHidden(!post.hidden)}
            aria-label={post.hidden ? "Make public" : "Make private"}
          >
            {post.hidden ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button type="button" className={btn} onClick={() => void remove()} aria-label="Delete">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 rounded-lg bg-muted p-3">
          <div>
            <label className="block text-xs font-bold uppercase" htmlFor={`t-${post.id}`}>
              Title
            </label>
            <input id={`t-${post.id}`} className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase" htmlFor={`d-${post.id}`}>
              Description
            </label>
            <textarea
              id={`d-${post.id}`}
              rows={3}
              className="w-full rounded-sm border-2 border-border bg-background p-3 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          {user && (
            <MediaPicker
              userId={user.id}
              label="Thumbnail"
              accept="image/*"
              value={thumb}
              onChange={setThumb}
            />
          )}
          <button type="button" className={btnRed} disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </li>
  );
}
