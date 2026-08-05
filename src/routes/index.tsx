import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { GreenHeader } from "@/components/GreenHeader";
import { ProfileGuide } from "@/components/ProfileGuide";
import { NewsNav } from "@/components/NewsNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo, type SonkPost } from "@/lib/sonk";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bamboo Entartainment — News & Social Media" },
      {
        name: "description",
        content:
          "Bamboo Entartainment is a news medium and a social media app and site, all in one place.",
      },
      { property: "og:title", content: "Bamboo Entartainment — News & Social Media" },
      {
        property: "og:description",
        content:
          "Bamboo Entartainment is a news medium and a social media app and site, all in one place.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bambooentartainment.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://bambooentartainment.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Bamboo Entartainment",
              url: "https://bambooentartainment.lovable.app/",
              description:
                "Bamboo Entartainment is a news medium and a social media app and site, all in one place.",
            },
            {
              "@type": "WebSite",
              name: "Bamboo Entartainment",
              url: "https://bambooentartainment.lovable.app/",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://bambooentartainment.lovable.app/news?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <GreenHeader />
      <NewsNav />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ProfileGuide />
        <section className="grid gap-8 border-t-4 border-bamboo pt-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight">
              Bamboo Entartainment — Independent News &amp; Social Media
            </h1>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">Who are we?</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/80">
              We are Bamboo Entartainment, we are a News Medium and a Social Media app and site, our
              Social Media site is like "Youtube", "Tiktok" and "Twitter/X" at the same time.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to="/news"
                className="inline-flex min-h-11 items-center bg-ember px-5 py-2.5 text-sm font-bold text-ember-foreground hover:opacity-90"
              >
                Read Bamboo News
              </Link>
              <Link
                to="/announcements"
                className="inline-flex min-h-11 items-center gap-2 bg-news-red px-5 py-2.5 text-sm font-bold text-news-red-foreground hover:opacity-90"
              >
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                Sonk
              </Link>
            </div>
            <SonkArticleSection />
          </div>
          <div className="border-t-4 border-news-red pt-2 lg:border-l lg:border-t-0 lg:border-l-border lg:pl-6 lg:pt-0">
            <h2 className="text-lg font-bold tracking-tight">Bamboo News</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Breaking news, trending stories, sport, global affairs, health, food and conflicts —
              updated by our newsroom.
            </p>
            <Link to="/news" className="mt-3 inline-block text-sm font-bold hover:underline">
              Go to the news front page →
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** Latest Sonk posts, with navigation into the Sonk newsroom. */
function SonkArticleSection() {
  const { data: posts = [] } = useQuery({
    queryKey: ["home-sonk-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sonk_posts")
        .select("id, author_id, kind, title, body, media_url, thumbnail_url, created_at")
        .eq("hidden", false)
        .eq("blacklisted", false)
        .order("created_at", { ascending: false })
        .limit(3);
      return (data ?? []) as SonkPost[];
    },
  });

  return (
    <section className="mt-10 border-t-4 border-news-red pt-3" aria-labelledby="sonk-article">
      <h2 id="sonk-article" className="font-typewriter text-2xl font-bold tracking-tight">
        Sonk Article
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Sonk is our social platform — long-form video, vertical shorts and a fast text feed in one
        place. Here is what the Sonk newsroom is talking about right now.
      </p>
      <ul className="mt-4 divide-y divide-border border-b border-border">
        {posts.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">
            Nothing on Sonk yet — be the first to post.
          </li>
        ) : (
          posts.map((p) => (
            <li key={p.id} className="py-3">
              <p className="text-sm font-bold leading-snug">
                {p.title ?? p.body?.slice(0, 90) ?? "Untitled"}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {p.kind} · {timeAgo(p.created_at)}
              </p>
            </li>
          ))
        )}
      </ul>
      <Link
        to="/announcements"
        className="mt-3 inline-block text-sm font-bold text-news-red hover:underline"
      >
        Go to the Sonk newsroom →
      </Link>
    </section>
  );
}
