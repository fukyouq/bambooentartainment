import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractHashtags, timeAgo, type SonkPost } from "@/lib/sonk";
import { AccountMarks } from "./Badges";
import type { SonkData } from "./SonkFeed";

interface Props {
  posts: SonkPost[];
  startIndex: number;
  data: SonkData;
  onClose: () => void;
  onOpenReplies: (postId: string) => void;
}

/**
 * Full-screen shorts player: swipe (or arrow keys) up/down to move between
 * clips, single tap to like, double tap — or the reply button — to reply.
 */
export function ShortsPlayer({ posts, startIndex, data, onClose, onOpenReplies }: Props) {
  const [index, setIndex] = useState(startIndex);
  const touchStart = useRef<number | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const post = posts[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(posts.length - 1, Math.max(0, i + delta)));
    },
    [posts.length],
  );

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === "j") go(1);
      if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "k") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(
    () => () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

  if (!post) return null;

  const handleTap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onOpenReplies(post.id);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      data.toggleLike(post.id);
    }, 240);
  };

  const isLiked = data.liked.has(post.id);
  const dislikeOnly = data.dislikeOnly(post.author_id);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Shorts player"
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-foreground focus-visible:outline-none"
      onTouchStart={(e) => {
        touchStart.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        const end = e.changedTouches[0]?.clientY ?? null;
        touchStart.current = null;
        if (start === null || end === null) return;
        const diff = start - end;
        if (Math.abs(diff) > 60) go(diff > 0 ? 1 : -1);
      }}
    >
      <div className="relative mx-auto h-full w-full max-w-md">
        <button
          type="button"
          onClick={handleTap}
          aria-label={
            dislikeOnly
              ? "Tap to dislike, double tap to reply"
              : "Tap to like, double tap to reply"
          }
          className="block h-full w-full"
        >
          {post.media_url ? (
            <video
              key={post.id}
              src={post.media_url}
              poster={post.thumbnail_url ?? undefined}
              className="h-full w-full object-cover"
              loop
              autoPlay
              playsInline
            />
          ) : (
            <img
              src={post.thumbnail_url ?? ""}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/95 to-transparent p-4 pb-24 text-background">
          <p className="flex items-center gap-1.5 font-typewriter text-sm font-bold">
            @{data.authors[post.author_id]?.username ?? "member"}
            <AccountMarks userId={post.author_id} marks={data.marks} />
            <span className="font-normal opacity-70">· {timeAgo(post.created_at)}</span>
          </p>
          {post.title && <p className="mt-1 font-bold">{post.title}</p>}
          {post.body && <p className="mt-1 text-sm">{post.body}</p>}
          <p className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-ember">
            {extractHashtags(post.body).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </p>
          <p className="mt-3 text-xs opacity-70">
            {index + 1} of {posts.length} · swipe or use the arrow keys
          </p>
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <PlayerButton label="Close player" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </PlayerButton>
          <PlayerButton label="Previous short" onClick={() => go(-1)} disabled={index === 0}>
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          </PlayerButton>
          <PlayerButton
            label="Next short"
            onClick={() => go(1)}
            disabled={index === posts.length - 1}
          >
            <ChevronDown className="h-5 w-5" aria-hidden="true" />
          </PlayerButton>
        </div>

        <div className="absolute bottom-6 right-3 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => data.toggleLike(post.id)}
            aria-pressed={isLiked}
            aria-label={dislikeOnly ? "Dislike" : isLiked ? "Remove like" : "Like"}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full bg-background/85 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isLiked && "text-news-red",
            )}
          >
            {data.likeIcon(post.author_id, isLiked)}
          </button>
          <span className="text-xs font-bold text-background">{data.likes[post.id] ?? 0}</span>
          <PlayerButton label="Reply to this short" onClick={() => onOpenReplies(post.id)}>
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
          </PlayerButton>
        </div>
      </div>
    </div>
  );
}

function PlayerButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-background/85 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}