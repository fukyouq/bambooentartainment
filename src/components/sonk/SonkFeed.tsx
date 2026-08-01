import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  ShieldAlert,
  ThumbsDown,
  Trash2,
  UserX,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  extractHashtags,
  timeAgo,
  warningEffects,
  type BadgeKind,
  type SonkAuthor,
  type SonkKind,
  type SonkPost,
  type SonkTarget,
  type VerifyCategory,
} from "@/lib/sonk";
import { AccountMarks, EMPTY_MARKS, type MarkSet } from "./Badges";
import { MediaPicker } from "./MediaPicker";
import { toast } from "sonner";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  hidden?: boolean;
}

export interface SonkData {
  posts: SonkPost[];
  authors: Record<string, SonkAuthor>;
  likes: Record<string, number>;
  liked: Set<string>;
  marks: MarkSet;
  /** Warning count per account, used to apply the warning ladder. */
  warnings: Record<string, number>;
  blocked: Set<string>;
  reload: () => void;
  toggleLike: (id: string) => void;
  remove: (id: string) => void;
  canDelete: (post: SonkPost) => boolean;
  canModerate: boolean;
  dislikeOnly: (authorId: string) => boolean;
  likeIcon: (authorId: string, isLiked: boolean) => ReactNode;
  report: (target: SonkTarget, id: string) => void;
  hide: (target: SonkTarget, id: string, hidden: boolean) => void;
  block: (authorId: string) => void;
}

/**
 * Loads the Sonk timeline plus everything the moderation and badge systems need.
 * When `search` is empty, accounts on their 2nd warning are dropped from the
 * algorithm; a direct search still surfaces them.
 */
export function useSonk(search = ""): SonkData & { loading: boolean } {
  const { user, sonkRank } = useAuth();
  const [posts, setPosts] = useState<SonkPost[]>([]);
  const [authors, setAuthors] = useState<Record<string, SonkAuthor>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<MarkSet>(EMPTY_MARKS);
  const [warnings, setWarnings] = useState<Record<string, number>>({});
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const { data: rows } = await supabase
      .from("sonk_posts")
      .select(
        "id, author_id, kind, title, body, media_url, thumbnail_url, created_at, hidden, blacklisted",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (rows ?? []) as SonkPost[];
    setPosts(list);

    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    if (ids.length) {
      const [{ data: profs }, { data: verifs }, { data: badgeRows }, { data: statuses }] =
        await Promise.all([
          supabase.from("public_profiles").select("id, username, avatar_url").in("id", ids),
          supabase.from("sonk_verification").select("user_id, category").in("user_id", ids),
          supabase.from("sonk_badges").select("user_id, badge").in("user_id", ids),
          supabase.from("sonk_status").select("user_id, warning_count").in("user_id", ids),
        ]);
      const map: Record<string, SonkAuthor> = {};
      for (const p of (profs ?? []) as SonkAuthor[]) map[p.id] = p;
      setAuthors(map);

      const verification: Record<string, VerifyCategory> = {};
      for (const v of verifs ?? []) verification[v.user_id] = v.category as VerifyCategory;
      const badges: Record<string, BadgeKind[]> = {};
      for (const b of badgeRows ?? [])
        badges[b.user_id] = [...(badges[b.user_id] ?? []), b.badge as BadgeKind];
      setMarks({ verification, badges });

      const warn: Record<string, number> = {};
      for (const s of statuses ?? []) warn[s.user_id] = s.warning_count;
      setWarnings(warn);
    }

    const { data: likeRows } = await supabase.from("sonk_likes").select("post_id, user_id");
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const l of (likeRows ?? []) as { post_id: string; user_id: string }[]) {
      counts[l.post_id] = (counts[l.post_id] ?? 0) + 1;
      if (user && l.user_id === user.id) mine.add(l.post_id);
    }
    setLikes(counts);
    setLiked(mine);

    if (user) {
      const { data: blocks } = await supabase
        .from("sonk_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);
      setBlocked(new Set((blocks ?? []).map((b) => b.blocked_id)));
    } else {
      setBlocked(new Set());
    }
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggleLike = async (id: string) => {
    if (!user) {
      toast.error("Sign in to like posts");
      return;
    }
    if (liked.has(id)) {
      setLiked((s) => new Set([...s].filter((x) => x !== id)));
      setLikes((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 1) - 1) }));
      await supabase.from("sonk_likes").delete().eq("post_id", id).eq("user_id", user.id);
    } else {
      setLiked((s) => new Set(s).add(id));
      setLikes((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
      await supabase.from("sonk_likes").insert({ post_id: id, user_id: user.id });
    }
  };

  const canModerate = sonkRank >= 1;
  const canDelete = (post: SonkPost) => !!user && (post.author_id === user.id || canModerate);

  const dislikeOnly = (authorId: string) => warningEffects(warnings[authorId] ?? 0).dislikeOnly;

  const likeIcon = (authorId: string, isLiked: boolean) =>
    dislikeOnly(authorId) ? (
      <ThumbsDown className={cn("h-5 w-5", isLiked && "fill-current")} aria-hidden="true" />
    ) : (
      <Heart className={cn("h-5 w-5", isLiked && "fill-current")} aria-hidden="true" />
    );

  const report = async (target: SonkTarget, id: string) => {
    if (!user) return toast.error("Sign in to report content");
    const reason = window.prompt("What is wrong with this content?")?.trim();
    if (!reason) return;
    const { error } = await supabase.from("sonk_reports").insert({
      target_type: target,
      target_id: id,
      reporter_id: user.id,
      reason,
    });
    if (error) toast.error(error.message);
    else toast.success("Report sent to the Sonk moderators");
  };

  const hide = async (target: SonkTarget, id: string, hidden: boolean) => {
    const table = target === "post" ? "sonk_posts" : "sonk_comments";
    const { error } = await supabase.from(table).update({ hidden }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(hidden ? "Content hidden" : "Content restored");
    if (target === "post")
      setPosts((p) => p.map((x) => (x.id === id ? { ...x, hidden } : x)));
  };

  const block = async (authorId: string) => {
    if (!user) return toast.error("Sign in to block accounts");
    if (blocked.has(authorId)) {
      await supabase
        .from("sonk_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", authorId);
      setBlocked((s) => new Set([...s].filter((x) => x !== authorId)));
      toast.success("Account unblocked");
      return;
    }
    const { error } = await supabase
      .from("sonk_blocks")
      .insert({ blocker_id: user.id, blocked_id: authorId });
    if (error) return toast.error(error.message);
    setBlocked((s) => new Set(s).add(authorId));
    toast.success("Account blocked");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("sonk_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Post deleted");
      setPosts((p) => p.filter((x) => x.id !== id));
    }
  };

  const searching = search.trim().length > 0;
  const visible = useMemo(
    () =>
      posts.filter((p) => {
        if (blocked.has(p.author_id)) return false;
        if (p.hidden && !(user && (p.author_id === user.id || canModerate))) return false;
        if (!searching && warningEffects(warnings[p.author_id] ?? 0).deranked) return false;
        if (!searching && p.blacklisted) return false;
        return true;
      }),
    [posts, blocked, warnings, searching, user, canModerate],
  );

  return {
    posts: visible,
    authors,
    likes,
    liked,
    marks,
    warnings,
    blocked,
    reload,
    toggleLike,
    remove,
    canDelete,
    canModerate,
    dislikeOnly,
    likeIcon,
    report,
    hide,
    block,
    loading,
  };
}

function Avatar({ author }: { author?: SonkAuthor }) {
  return author?.avatar_url ? (
    <img
      src={author.avatar_url}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full object-cover"
      loading="lazy"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bamboo font-typewriter text-sm font-bold text-bamboo-foreground"
    >
      {(author?.username ?? "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function CommentBox({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<Record<string, SonkAuthor>>({});
  const [text, setText] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("sonk_comments")
      .select("id, post_id, author_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const list = (data ?? []) as Comment[];
    setItems(list);
    const ids = Array.from(new Set(list.map((c) => c.author_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url")
        .in("id", ids);
      const map: Record<string, SonkAuthor> = {};
      for (const p of (profs ?? []) as SonkAuthor[]) map[p.id] = p;
      setAuthors(map);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error("Sign in to reply");
    if (!text.trim()) return;
    const { error } = await supabase
      .from("sonk_comments")
      .insert({ post_id: postId, author_id: user.id, body: text.trim() });
    if (error) toast.error(error.message);
    else {
      setText("");
      void load();
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            <span className="font-bold">{authors[c.author_id]?.username ?? "member"}</span>
            <span className="text-foreground/80">{c.body}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {timeAgo(c.created_at)}
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">No replies yet.</li>}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`reply-${postId}`}>
          Write a reply
        </label>
        <input
          id={`reply-${postId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? "Write a reply…" : "Sign in to reply"}
          className="min-h-11 flex-1 rounded-sm border-2 border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="flex h-11 min-w-11 items-center justify-center rounded-sm bg-news-red px-3 text-news-red-foreground"
          aria-label="Send reply"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function PostActions({
  post,
  data,
  onToggleComments,
  vertical = false,
}: {
  post: SonkPost;
  data: SonkData;
  onToggleComments: () => void;
  vertical?: boolean;
}) {
  const share = async () => {
    const url = `${window.location.origin}/announcements#${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: post.title ?? "Sonk", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };
  const isLiked = data.liked.has(post.id);
  return (
    <div className={cn("flex items-center gap-4", vertical && "flex-col gap-5")}>
      <button
        type="button"
        onClick={() => data.toggleLike(post.id)}
        aria-pressed={isLiked}
        aria-label={isLiked ? "Unlike" : "Like"}
        className={cn(
          "flex min-h-11 items-center gap-1.5 text-sm font-bold",
          vertical && "flex-col",
          isLiked ? "text-news-red" : "text-foreground/70",
        )}
      >
        <Heart className={cn("h-5 w-5", isLiked && "fill-current")} aria-hidden="true" />
        {data.likes[post.id] ?? 0}
      </button>
      <button
        type="button"
        onClick={onToggleComments}
        aria-label="Show replies"
        className={cn(
          "flex min-h-11 items-center gap-1.5 text-sm font-bold text-foreground/70",
          vertical && "flex-col",
        )}
      >
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={share}
        aria-label="Share"
        className={cn(
          "flex min-h-11 items-center gap-1.5 text-sm font-bold text-foreground/70",
          vertical && "flex-col",
        )}
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </button>
      {data.canDelete(post) && (
        <button
          type="button"
          onClick={() => data.remove(post.id)}
          aria-label="Delete post"
          className={cn(
            "flex min-h-11 items-center text-foreground/50 hover:text-news-red",
            vertical && "flex-col",
          )}
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function TweetList({ data }: { data: SonkData }) {
  const posts = data.posts.filter((p) => p.kind === "post");
  const [open, setOpen] = useState<string | null>(null);
  if (!posts.length)
    return <p className="py-10 text-center text-muted-foreground">No posts yet. Be the first.</p>;
  return (
    <ul className="divide-y divide-border border-t-4 border-news-red">
      {posts.map((p) => (
        <li key={p.id} id={p.id} className="flex gap-3 py-4">
          <Avatar author={data.authors[p.author_id]} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-typewriter font-bold">
                {data.authors[p.author_id]?.username ?? "member"}
              </span>
              <span className="text-muted-foreground">· {timeAgo(p.created_at)}</span>
            </p>
            {p.title && <p className="mt-0.5 font-bold">{p.title}</p>}
            <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {p.body}
            </p>
            {p.media_url && (
              <img
                src={p.media_url}
                alt=""
                loading="lazy"
                className="mt-3 max-h-96 w-full rounded-sm border-2 border-border object-cover"
              />
            )}
            <div className="mt-2">
              <PostActions
                post={p}
                data={data}
                onToggleComments={() => setOpen(open === p.id ? null : p.id)}
              />
            </div>
            {open === p.id && <CommentBox postId={p.id} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ShortsReel({ data }: { data: SonkData }) {
  const shorts = data.posts.filter((p) => p.kind === "short");
  const [muted, setMuted] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  if (!shorts.length)
    return <p className="py-10 text-center text-muted-foreground">No shorts yet.</p>;
  return (
    <div className="mx-auto max-w-md">
      <div className="h-[70vh] snap-y snap-mandatory overflow-y-auto rounded-sm border-2 border-border bg-foreground/95">
        {shorts.map((p) => (
          <article key={p.id} id={p.id} className="relative h-[70vh] snap-start">
            {p.media_url ? (
              <video
                src={p.media_url}
                poster={p.thumbnail_url ?? undefined}
                className="h-full w-full object-cover"
                loop
                muted={muted}
                playsInline
                autoPlay
              />
            ) : (
              <img
                src={p.thumbnail_url ?? ""}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Unmute" : "Mute"}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-background/80"
            >
              {muted ? (
                <VolumeX className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/90 to-transparent p-4 text-background">
              <p className="font-typewriter text-sm font-bold">
                @{data.authors[p.author_id]?.username ?? "member"}
              </p>
              {p.title && <p className="mt-1 font-bold">{p.title}</p>}
              {p.body && <p className="mt-1 text-sm">{p.body}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {extractHashtags(p.body).map((t) => (
                  <span key={t} className="text-xs font-bold text-ember">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute bottom-24 right-2 rounded-sm bg-background/85 p-2">
              <PostActions
                post={p}
                data={data}
                vertical
                onToggleComments={() => setOpen(open === p.id ? null : p.id)}
              />
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="mt-4 border-2 border-border p-3">
          <CommentBox postId={open} />
        </div>
      )}
    </div>
  );
}

export function VideoGrid({ data }: { data: SonkData }) {
  const videos = data.posts.filter((p) => p.kind === "video");
  const [active, setActive] = useState<SonkPost | null>(null);
  const current = active ?? videos[0] ?? null;
  const rest = useMemo(() => videos.filter((v) => v.id !== current?.id), [videos, current]);
  if (!videos.length)
    return <p className="py-10 text-center text-muted-foreground">No videos yet.</p>;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {current && (
        <div id={current.id}>
          <div className="aspect-video w-full border-2 border-border bg-foreground">
            {current.media_url ? (
              <video
                src={current.media_url}
                poster={current.thumbnail_url ?? undefined}
                controls
                className="h-full w-full"
              />
            ) : (
              <img src={current.thumbnail_url ?? ""} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <h3 className="mt-3 text-xl font-bold tracking-tight">{current.title ?? "Untitled"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            @{data.authors[current.author_id]?.username ?? "member"} · {timeAgo(current.created_at)}
          </p>
          {current.body && (
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{current.body}</p>
          )}
          <div className="mt-3">
            <PostActions post={current} data={data} onToggleComments={() => undefined} />
          </div>
          <CommentBox postId={current.id} />
        </div>
      )}
      <aside>
        <h3 className="border-t-4 border-news-red pt-2 font-typewriter text-sm font-bold uppercase tracking-wide">
          Up next
        </h3>
        <ul className="mt-3 space-y-3">
          {rest.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setActive(v)}
                className="flex w-full gap-3 text-left hover:bg-muted"
              >
                <span className="relative block h-16 w-28 shrink-0 border-2 border-border bg-muted">
                  {v.thumbnail_url ? (
                    <img
                      src={v.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Play
                      className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-bold">
                    {v.title ?? "Untitled"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    @{data.authors[v.author_id]?.username ?? "member"} · {timeAgo(v.created_at)}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {rest.length === 0 && <li className="text-sm text-muted-foreground">Nothing else yet.</li>}
        </ul>
      </aside>
    </div>
  );
}

export function SonkComposer({ kind, onDone }: { kind: SonkKind; onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user)
    return (
      <p className="border-2 border-dashed border-border p-4 text-sm">
        <Link to="/auth" className="font-bold underline">
          Sign in
        </Link>{" "}
        to post on Sonk.
      </p>
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !media.trim()) return toast.error("Add some text or a media link");
    setBusy(true);
    const { error } = await supabase.from("sonk_posts").insert({
      author_id: user.id,
      kind,
      title: title.trim() || null,
      body: body.trim() || null,
      media_url: media.trim() || null,
      thumbnail_url: thumb.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setBody("");
    setMedia("");
    setThumb("");
    toast.success("Posted to Sonk");
    onDone();
  };

  const input = "min-h-11 w-full rounded-sm border-2 border-border bg-background px-3 text-sm";

  return (
    <form onSubmit={submit} className="space-y-3 border-2 border-border p-4">
      {kind !== "post" && (
        <>
          <label className="block text-xs font-bold uppercase" htmlFor="sonk-title">
            Title
          </label>
          <input
            id="sonk-title"
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </>
      )}
      <label className="block text-xs font-bold uppercase" htmlFor="sonk-body">
        {kind === "post" ? "What's happening?" : "Description"}
      </label>
      <textarea
        id="sonk-body"
        rows={kind === "post" ? 3 : 2}
        className="w-full rounded-sm border-2 border-border bg-background p-3 text-sm"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Use #hashtags to help people find this"
      />
      <label className="block text-xs font-bold uppercase" htmlFor="sonk-media">
        {kind === "post" ? "Image URL (optional)" : "Video URL"}
      </label>
      <input
        id="sonk-media"
        className={input}
        value={media}
        onChange={(e) => setMedia(e.target.value)}
        placeholder="https://…"
      />
      {kind !== "post" && (
        <>
          <label className="block text-xs font-bold uppercase" htmlFor="sonk-thumb">
            Thumbnail URL (optional)
          </label>
          <input
            id="sonk-thumb"
            className={input}
            value={thumb}
            onChange={(e) => setThumb(e.target.value)}
            placeholder="https://…"
          />
        </>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-sm bg-news-red px-5 font-typewriter text-sm font-bold text-news-red-foreground disabled:opacity-60"
      >
        {busy ? "Posting…" : "Post to Sonk"}
      </button>
    </form>
  );
}
