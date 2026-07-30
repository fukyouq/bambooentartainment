import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface Props {
  to: string;
  label: string;
  icon: ReactNode;
  variant: "ember" | "bamboo";
  align?: "left" | "right";
}

export function SquareIconButton({ to, label, icon, variant, align = "right" }: Props) {
  const tooltipId = `tip-${to.replace(/\W+/g, "-")}-${variant}`;
  return (
    <div className="group relative shrink-0">
      <Link
        to={to}
        aria-label={label}
        aria-describedby={tooltipId}
        className={cn(
          "flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-sm border-2 transition-transform hover:scale-105 active:scale-95",
          variant === "ember"
            ? "border-ember-foreground/30 bg-ember text-ember-foreground"
            : "border-bamboo-foreground/25 bg-bamboo text-bamboo-foreground",
        )}
      >
        <span aria-hidden="true">{icon}</span>
      </Link>
      <span
        id={tooltipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-20 mt-2 whitespace-nowrap rounded-sm bg-foreground px-2 py-1 font-typewriter text-xs font-bold text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {label}
      </span>
    </div>
  );
}