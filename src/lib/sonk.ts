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
  hidden?: boolean;
  blacklisted?: boolean;
}

export type VerifyCategory = "individual" | "business" | "institution";
export type VerifyStatus = "pending" | "approved" | "denied";
export type BadgeKind = "staff" | "official" | "media" | "music";
export type SonkTarget = "post" | "comment";
export type ReportStatus = "open" | "actioned" | "dismissed";
export type AdStatus = "draft" | "pending_payment" | "active" | "paused" | "ended";

export const VERIFY_CATEGORIES: { value: VerifyCategory; label: string; help: string }[] = [
  {
    value: "individual",
    label: "Individual",
    help: "Full name, date of birth, country and city, plus a link to a photo ID.",
  },
  {
    value: "business",
    label: "Business",
    help: "A link to registered company documents.",
  },
  {
    value: "institution",
    label: "Government / Institution",
    help: "A written request explaining the institution and who is applying.",
  },
];

export const VERIFY_LABEL: Record<VerifyCategory, string> = {
  individual: "Verified individual",
  business: "Verified business",
  institution: "Verified government or institution",
};

export const BADGE_LABEL: Record<BadgeKind, string> = {
  staff: "Bamboo staff",
  official: "Official account",
  media: "Media account",
  music: "Music account",
};

export interface SonkVerification {
  user_id: string;
  category: VerifyCategory;
}

export interface SonkBadge {
  id: string;
  user_id: string;
  badge: BadgeKind;
}

export interface SonkStatusRow {
  user_id: string;
  warning_count: number;
  banned: boolean;
}

/** Baseline eligibility that every verification category shares. */
export interface EligibilityInput {
  hasBio: boolean;
  hasAvatar: boolean;
  hasUsername: boolean;
  postCount: number;
  articleCount: number;
  category: VerifyCategory;
}

export function eligibilityIssues(i: EligibilityInput): string[] {
  const missing: string[] = [];
  if (!i.hasBio) missing.push("Add a bio");
  if (!i.hasAvatar) missing.push("Add a profile picture");
  if (!i.hasUsername) missing.push("Pick a username");
  if (i.postCount < 10) missing.push(`Publish at least 10 Sonk posts (${i.postCount}/10)`);
  if (i.category === "individual" && i.articleCount < 2)
    missing.push(`Publish at least 2 news articles (${i.articleCount}/2)`);
  return missing;
}

export const MUSIC_MIN_SONGS = 10;
export const MUSIC_MIN_VIEWS = 5_000_000;

/** Warning ladder effects, applied to the *author* of the content being viewed. */
export interface WarningEffects {
  /** 1st warning: the like button becomes a dislike button on their videos. */
  dislikeOnly: boolean;
  /** 2nd warning: their videos are dropped from the algorithm and only found by direct search. */
  deranked: boolean;
  /** 3rd warning: they cannot post new videos. */
  postingBlocked: boolean;
  /** After the 3rd warning the account is banned. */
  banned: boolean;
}

export function warningEffects(count: number): WarningEffects {
  return {
    dislikeOnly: count >= 1,
    deranked: count >= 2,
    postingBlocked: count >= 3,
    banned: count > 3,
  };
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
