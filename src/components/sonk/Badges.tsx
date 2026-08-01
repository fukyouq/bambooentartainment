import { BadgeCheck, Check, Hammer, Megaphone, Music } from "lucide-react";
import institutionIcon from "@/assets/institution-check.png";
import { cn } from "@/lib/utils";
import {
  BADGE_LABEL,
  VERIFY_LABEL,
  type BadgeKind,
  type VerifyCategory,
} from "@/lib/sonk";

const VERIFY_BG: Record<VerifyCategory, string> = {
  individual: "bg-verify-individual",
  business: "bg-verify-business",
  institution: "bg-verify-institution",
};

/** Coloured verification checkmark: individual = yellow, business = orange, institution = purple. */
export function VerifiedMark({
  category,
  className,
}: {
  category: VerifyCategory;
  className?: string;
}) {
  return (
    <span
      title={VERIFY_LABEL[category]}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        VERIFY_BG[category],
        className,
      )}
    >
      <span className="sr-only">{VERIFY_LABEL[category]}</span>
      {category === "institution" ? (
        <img src={institutionIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5 text-background" aria-hidden="true" strokeWidth={3} />
      )}
    </span>
  );
}

function CrossedHammers() {
  return (
    <span aria-hidden="true" className="relative block h-3.5 w-3.5">
      <Hammer className="absolute inset-0 h-3.5 w-3.5 -rotate-12" />
      <Hammer className="absolute inset-0 h-3.5 w-3.5 scale-x-[-1] rotate-12" />
    </span>
  );
}

export function SonkBadgeMark({ badge, className }: { badge: BadgeKind; className?: string }) {
  const shell = "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full";
  const label = BADGE_LABEL[badge];
  return (
    <span title={label} className={cn(shell, badgeShell(badge), className)}>
      <span className="sr-only">{label}</span>
      {badge === "staff" && <CrossedHammers />}
      {badge === "official" && (
        <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
      )}
      {badge === "media" && <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />}
      {badge === "music" && <Music className="h-3.5 w-3.5" aria-hidden="true" />}
    </span>
  );
}

function badgeShell(badge: BadgeKind) {
  switch (badge) {
    case "staff":
      return "bg-badge-staff text-news-red-foreground";
    case "official":
      return "bg-badge-official text-background";
    case "media":
      return "bg-badge-media text-background";
    case "music":
      return "bg-badge-music text-badge-music-foreground border border-border";
  }
}

export interface MarkSet {
  verification: Record<string, VerifyCategory>;
  badges: Record<string, BadgeKind[]>;
}

export const EMPTY_MARKS: MarkSet = { verification: {}, badges: {} };

/** All marks for one account, rendered inline after their name. */
export function AccountMarks({
  userId,
  marks,
  className,
}: {
  userId: string;
  marks: MarkSet;
  className?: string;
}) {
  const category = marks.verification[userId];
  const badges = marks.badges[userId] ?? [];
  if (!category && badges.length === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 align-middle", className)}>
      {category && <VerifiedMark category={category} />}
      {badges.map((b) => (
        <SonkBadgeMark key={b} badge={b} />
      ))}
    </span>
  );
}

export function VerificationLegend() {
  return (
    <ul className="space-y-2 text-sm">
      {(["individual", "business", "institution"] as VerifyCategory[]).map((c) => (
        <li key={c} className="flex items-center gap-2">
          <VerifiedMark category={c} />
          <span>{VERIFY_LABEL[c]}</span>
        </li>
      ))}
      {(["staff", "official", "media", "music"] as BadgeKind[]).map((b) => (
        <li key={b} className="flex items-center gap-2">
          <SonkBadgeMark badge={b} />
          <span>{BADGE_LABEL[b]}</span>
        </li>
      ))}
      <li className="flex items-center gap-2 text-muted-foreground">
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        <span>Request verification in Settings → Account → Verification.</span>
      </li>
    </ul>
  );
}