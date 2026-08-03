import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Clapperboard,
  Flame,
  Home,
  Newspaper,
  Search,
  Settings,
  Shield,
  Sparkles,
  Video,
} from "lucide-react";
import { RedHeader } from "@/components/RedHeader";
import { ThemeToggle } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export type SonkTab = "foryou" | "shorts" | "videos";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const railItem =
  "flex min-h-11 items-center gap-3 rounded-full px-3 font-typewriter text-[15px] font-bold hover:bg-muted";

/**
 * X-style three column chrome for Sonk: persistent left rail, centre column and a
 * right rail that only carries search. No footer — Sonk is an app surface.
 */
export function SonkShell({
  tab,
  onTab,
  query,
  onQuery,
  children,
}: {
  tab: SonkTab;
  onTab: (t: SonkTab) => void;
  query: string;
  onQuery: (q: string) => void;
  children: ReactNode;
}) {
  const { sonkRank, sonkHandle } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const tabs: { id: SonkTab; label: string; icon: typeof Home }[] = [
    { id: "foryou", label: "For you", icon: Sparkles },
    { id: "shorts", label: "Shorts", icon: Flame },
    { id: "videos", label: "Videos", icon: Clapperboard },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <RedHeader title="Sonk" />
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-4">
        <nav
          aria-label="Sonk navigation"
          className="sticky top-4 hidden h-fit w-56 shrink-0 flex-col gap-1 md:flex"
        >
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onTab(id)}
              aria-current={tab === id && path === "/announcements" ? "page" : undefined}
              className={cn(
                railItem,
                focus,
                tab === id && path === "/announcements" && "bg-muted text-news-red",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </button>
          ))}
          <span className="my-2 border-t border-border" />
          <Link to="/sonk-studio" className={cn(railItem, focus)}>
            <Video className="h-5 w-5" aria-hidden="true" />
            Studio
          </Link>
          <Link to="/settings" className={cn(railItem, focus)}>
            <Settings className="h-5 w-5" aria-hidden="true" />
            Settings
          </Link>
          {sonkRank >= 1 && (
            <Link to="/sonk-desk" className={cn(railItem, focus, "text-news-red")}>
              <Shield className="h-5 w-5" aria-hidden="true" />
              Moderation desk
            </Link>
          )}
          <Link to="/news" className={cn(railItem, focus)}>
            <Newspaper className="h-5 w-5" aria-hidden="true" />
            Bamboo News
          </Link>
          <Link to="/" className={cn(railItem, focus)}>
            <Home className="h-5 w-5" aria-hidden="true" />
            Home
          </Link>
          <span className="my-2 border-t border-border" />
          <ThemeToggle />
          {sonkHandle && (
            <p className="px-3 pt-2 text-xs text-muted-foreground">Signed in as @{sonkHandle}</p>
          )}
        </nav>

        <div className="min-w-0 flex-1">
          <nav
            aria-label="Sonk sections"
            className="mb-4 flex gap-1 border-b-2 border-border md:hidden"
          >
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-pressed={tab === id}
                className={cn(
                  "min-h-11 flex-1 border-b-4 font-typewriter text-sm font-bold",
                  focus,
                  tab === id ? "border-news-red text-news-red" : "border-transparent",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </div>

        <aside className="sticky top-4 hidden h-fit w-72 shrink-0 lg:block">
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="sonk-search" className="sr-only">
              Search Sonk
            </label>
            <div className="flex items-center gap-2 rounded-full bg-muted px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="sonk-search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search Sonk"
                className={cn("min-h-11 w-full bg-transparent text-sm outline-none", focus)}
              />
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
