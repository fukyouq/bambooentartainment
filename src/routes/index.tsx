import { createFileRoute, Link } from "@tanstack/react-router";
import { GreenHeader } from "@/components/GreenHeader";
import { ProfileGuide } from "@/components/ProfileGuide";
import { NewsNav } from "@/components/NewsNav";
import { SiteFooter } from "@/components/SiteFooter";

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
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <GreenHeader />
      <NewsNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <ProfileGuide />
        <section className="grid gap-8 border-t-4 border-bamboo pt-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h2 className="text-4xl font-bold leading-[1.1] tracking-tight">Who are we?</h2>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/80">
              We are Bamboo Entartainment, we are a News Medium and a Social Media app and site, our
              Social Media site is like "Youtube", "Tiktok" and "Twitter/X" at the same time.
            </p>
            <Link
              to="/news"
              className="mt-6 inline-flex bg-ember px-5 py-2.5 text-sm font-bold text-ember-foreground hover:opacity-90"
            >
              Read Bamboo News
            </Link>
          </div>
          <aside className="border-t-4 border-news-red pt-2 lg:border-l lg:border-t-0 lg:border-l-border lg:pl-6 lg:pt-0">
            <h3 className="text-lg font-bold tracking-tight">Bamboo News</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Breaking news, trending stories, sport, global affairs, health, food and conflicts —
              updated by our newsroom.
            </p>
            <Link to="/news" className="mt-3 inline-block text-sm font-bold hover:underline">
              Go to the news front page →
            </Link>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
