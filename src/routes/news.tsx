import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { OrangeHeader } from "@/components/OrangeHeader";
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

      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setCategory(c.value);
                setQuery("");
              }}
              className={cn(
                "rounded-sm px-3 py-1.5 font-typewriter text-xs font-bold uppercase tracking-wide transition-colors",
                category === c.value && !query
                  ? "bg-bamboo text-bamboo-foreground"
                  : "bg-muted text-foreground/70 hover:bg-muted/70",
                c.value === "breaking_news" && "text-destructive",
                c.value === "breaking_news" && category === c.value && !query && "text-bamboo-foreground",
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
                  "rounded-sm border px-3 py-1 text-xs font-medium",
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

      <main className="mx-auto max-w-6xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading news…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-8 text-center font-typewriter text-lg font-bold">
            {query.trim()
              ? `No articles match "${query}".`
              : (EMPTY_CATEGORY_MESSAGE[category] ?? "No articles in this category yet.")}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
            <aside className="order-2 space-y-4 lg:order-1">
              <h2 className="font-typewriter text-sm font-bold uppercase text-bamboo">More stories</h2>
              {withPictures.length === 0 && (
                <p className="text-xs text-muted-foreground">No illustrated stories.</p>
              )}
              {withPictures.map((a) => (
                <Link
                  key={a.id}
                  to="/article/$articleId"
                  params={{ articleId: a.id }}
                  className="block overflow-hidden rounded-md border border-border bg-card"
                >
                  <img src={a.image_url!} alt={a.title} className="h-28 w-full object-cover" />
                  <p className="p-3 text-sm font-semibold leading-snug">{a.title}</p>
                </Link>
              ))}
            </aside>

            <article className="order-1 lg:order-2">
              <Link to="/article/$articleId" params={{ articleId: lead.id }} className="block">
                {lead.image_url && (
                  <img
                    src={lead.image_url}
                    alt={lead.title}
                    className="mb-4 h-72 w-full rounded-md object-cover"
                  />
                )}
                <p className="font-typewriter text-xs font-bold uppercase text-ember">Latest</p>
                <h2 className="mt-1 font-typewriter text-3xl font-bold leading-tight">
                  {lead.title}
                </h2>
                <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                  {lead.description}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  Happened {lead.event_date} · By {lead.author_name}
                </p>
              </Link>
            </article>

            <aside className="order-3 space-y-4">
              <h2 className="font-typewriter text-sm font-bold uppercase text-bamboo">In brief</h2>
              {withoutPictures.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing in brief right now.</p>
              )}
              {withoutPictures.map((a) => (
                <Link
                  key={a.id}
                  to="/article/$articleId"
                  params={{ articleId: a.id }}
                  className="block border-b border-border pb-3"
                >
                  <p className="text-sm font-semibold leading-snug">{a.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.event_date}</p>
                </Link>
              ))}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}