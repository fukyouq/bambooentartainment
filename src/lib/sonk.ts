export type SonkKind = "video" | "short" | "post";

export interface SonkPost {
  id: string;
  author_id: string;
  kind: SonkKind;
  title: string | null;
  body: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface SonkAuthor {
  id: string;
  username: string;
  avatar_url: string | null;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set((text.match(/#[\p{L}\d_]+/gu) ?? []).map((t) => t.toLowerCase())));
}
