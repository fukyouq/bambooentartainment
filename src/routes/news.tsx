import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { OrangeHeader } from "@/components/OrangeHeader";
import { NewsNav } from "@/components/NewsNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  EMPTY_CATEGORY_MESSAGE,
  SPORTS_SUBCATEGORIES,
  searchArticles,
  type Article,
  type Category,
  type SportsSubcategory,
} from "@/lib/bamboo";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Bamboo News — Breaking, Global, Sports & More" },
      {
        name: "description",
        content:
          "Breaking news, trending stories, sports, global affairs, health, food and conflicts from Bamboo News.",
      },
      { property: "og:title", content: "Bamboo News" },
      {
        property: "og:description",
        content: "Breaking news, trending stories, sports, global affairs and more.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const [category, setCategory] = useState<Category>("breaking_news");
  const [sub, setSub] = useState<SportsSubcategory | "all">("all");
  const [query, setQuery] = useState("");

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("blacklisted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Article[];
    },
  });

  const visible = useMemo(() => {
    if (query.trim()) return searchArticles(articles, query);
    let list = articles.filter((a) => a.category === category);
    if (category === "sports" && sub !== "all") {
      list = list.filter((a) => a.sports_subcategory === sub);
    }
    return list;
  }, [articles, category, sub, query]);

  const [lead, ...rest] = visible;
  const withPictures = rest.filter((a) => a.image_url);
  const withoutPictures = rest.filter((a) => !a.image_url);

  return (
    <div className="min-h-screen bg-background">
      <OrangeHeader />
      <NewsNav />

      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setCategory(c.value);
                setQuery("");
              }}
              className={cn(
                "border-b-4 px-3 py-2 text-sm font-bold tracking-tight transition-colors hover:bg-muted",
                category === c.value && !query
                  ? "border-bamboo text-foreground"
                  : "border-transparent text-foreground/70",
                c.value === "breaking_news" && "text-news-red",
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              maxLength={120}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search news by keywords"
              className="pl-8"
            />
          </div>
        </div>

        {category === "sports" && !query && (
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-3">
            {[{ value: "all", label: "All Sports" }, ...SPORTS_SUBCATEGORIES].map((s) => (
              <button
                key={s.value}
                onClick={() => setSub(s.value as SportsSubcategory | "all")}
                className={cn(
                  "border px-3 py-1 text-xs font-bold",
                  sub === s.value
                    ? "border-ember bg-ember text-ember-foreground"
                    : "border-border bg-background text-foreground/70",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading news…</p>
        ) : visible.length === 0 ? (
          <p className="border border-border bg-card p-8 text-center font-typewriter text-lg font-bold">
            {query.trim()
              ? `No articles match "${query}".`
              : (EMPTY_CATEGORY_MESSAGE[category] ?? "No articles in this category yet.")}
          </p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
            <aside className="order-2 lg:order-1">
              <h2 className="border-t-4 border-bamboo pt-2 text-lg font-bold tracking-tight">
                More stories
              </h2>
              {withPictures.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground">No illustrated stories.</p>
              )}
              <div className="mt-3 divide-y divide-border border-b border-border">
                {withPictures.map((a) => (
                  <Link
                    key={a.id}
                    to="/article/$articleId"
                    params={{ articleId: a.id }}
                    className="group block py-3"
                  >
                    <img
                      src={a.image_url!}
                      alt={a.title}
                      loading="lazy"
                      className="h-28 w-full object-cover"
                    />
                    <p className="mt-2 text-base font-bold leading-snug tracking-tight group-hover:underline">
                      {a.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.event_date}</p>
                  </Link>
                ))}
              </div>
            </aside>

            <article className="order-1 lg:order-2">
              <Link to="/article/$articleId" params={{ articleId: lead.id }} className="block">
                {lead.image_url && (
                  <img
                    src={lead.image_url}
                    alt={lead.title}
                    className="mb-4 h-80 w-full object-cover"
                  />
                )}
                {category === "breaking_news" ? (
                  <span className="inline-block bg-news-red px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-news-red-foreground">
                    Breaking
                  </span>
                ) : (
                  <span className="inline-block bg-ember px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ember-foreground">
                    Latest
                  </span>
                )}
                <h2 className="mt-2 text-4xl font-bold leading-[1.1] tracking-tight hover:underline">
                  {lead.title}
                </h2>
                <p className="mt-3 line-clamp-6 whitespace-pre-line text-base leading-relaxed text-foreground/80">
                  {lead.description}
                </p>
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  Happened {lead.event_date} · By {lead.author_name}
                </p>
              </Link>
            </article>

            <aside className="order-3">
              <h2 className="border-t-4 border-news-red pt-2 text-lg font-bold tracking-tight">
                Most read
              </h2>
              {withoutPictures.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground">Nothing in brief right now.</p>
              )}
              <ol className="mt-3 divide-y divide-border border-b border-border">
                {withoutPictures.map((a, i) => (
                  <li key={a.id}>
                    <Link
                      to="/article/$articleId"
                      params={{ articleId: a.id }}
                      className="group flex gap-3 py-3"
                    >
                      <span className="text-2xl font-bold leading-none text-muted-foreground/50">
                        {i + 1}
                      </span>
                      <span>
                        <span className="block text-base font-bold leading-snug tracking-tight group-hover:underline">
                          {a.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {a.event_date}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}