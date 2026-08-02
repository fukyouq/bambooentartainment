import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Clapperboard, Flame, Search, Sparkles } from "lucide-react";
import { RedHeader } from "@/components/RedHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import {
  ShortsReel,
  SonkComposer,
  TweetList,
  VideoGrid,
  useSonk,
} from "@/components/sonk/SonkFeed";
import { extractHashtags, type SonkKind } from "@/lib/sonk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Sonk — Video, Shorts & Feed by Bamboo Entartainment" },
      {
        name: "description",
        content:
          "Sonk is Bamboo Entartainment's social platform: long-form video, vertical shorts and a fast text feed in one place.",
      },
      { property: "og:title", content: "Sonk — Video, Shorts & Feed" },
      {
        property: "og:description",
        content:
          "Watch videos, scroll shorts and follow the live feed on Sonk by Bamboo Entartainment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SonkPage,
});

const TABS: { id: SonkKind; label: string; icon: typeof Flame }[] = [
  { id: "post", label: "Feed", icon: Sparkles },
  { id: "short", label: "Shorts", icon: Flame },
  { id: "video", label: "Videos", icon: Clapperboard },
];

function SonkPage() {
  const sonk = useSonk();
  const { sonkRank } = useAuth();
  const [tab, setTab] = useState<SonkKind>("post");
  const [query, setQuery] = useState("");

  const trending = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of sonk.posts)
      for (const t of extractHashtags(`${p.title ?? ""} ${p.body ?? ""}`))
        counts[t] = (counts[t] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [sonk.posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sonk;
    return {
      ...sonk,
      posts: sonk.posts.filter((p) =>
        `${p.title ?? ""} ${p.body ?? ""}`.toLowerCase().includes(q),
      ),
    };
  }, [sonk, query]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RedHeader title="Sonk" />

      <nav aria-label="Sonk sections" className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                "flex min-h-11 items-center gap-2 border-b-4 px-4 font-typewriter text-sm font-bold",
                tab === id
                  ? "border-news-red text-news-red"
                  : "border-transparent text-foreground/70 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-4">
            <Link
              to="/settings"
              className="font-typewriter text-xs font-bold underline underline-offset-4"
            >
              Account &amp; verification
            </Link>
            {sonkRank >= 1 && (
              <Link
                to="/sonk-desk"
                className="font-typewriter text-xs font-bold text-news-red underline underline-offset-4"
              >
                Moderation desk
              </Link>
            )}
          </span>
        </div>
      </nav>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
      >
        <div>
          <h2 className="sr-only">Sonk {tab}</h2>
          <div className="mb-6">
            <SonkComposer kind={tab} onDone={() => void sonk.reload()} />
          </div>

          {sonk.loading ? (
            <p className="py-10 text-center text-muted-foreground">Loading Sonk…</p>
          ) : tab === "post" ? (
            <TweetList data={filtered} />
          ) : tab === "short" ? (
            <ShortsReel data={filtered} />
          ) : (
            <VideoGrid data={filtered} />
          )}
        </div>

        <aside className="space-y-6">
          <form role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="sonk-search" className="sr-only">
              Search Sonk
            </label>
            <div className="flex items-center gap-2 border-2 border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                id="sonk-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Sonk"
                className="min-h-11 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </form>

          <section>
            <h3 className="border-t-4 border-news-red pt-2 font-typewriter text-sm font-bold uppercase tracking-wide">
              Trending
            </h3>
            <ul className="mt-3 space-y-2">
              {trending.map(([tag, count]) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => setQuery(tag)}
                    className="min-h-11 text-left text-sm font-bold hover:underline"
                  >
                    {tag}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {count} post{count === 1 ? "" : "s"}
                    </span>
                  </button>
                </li>
              ))}
              {trending.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing trending yet — add #hashtags to your posts.
                </li>
              )}
            </ul>
          </section>

          <section className="border-2 border-border p-4">
            <h3 className="font-typewriter text-sm font-bold uppercase">What is Sonk?</h3>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              Sonk is Bamboo Entartainment's social platform — long-form video, vertical shorts and a
              fast text feed, all in one place.
            </p>
          </section>
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
