import { createFileRoute, Link } from "@tanstack/react-router";
import { GreenHeader } from "@/components/GreenHeader";
import { ProfileGuide } from "@/components/ProfileGuide";

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
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <ProfileGuide />
        <section className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h2 className="font-typewriter text-3xl font-bold text-bamboo">Who are we?</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/80">
            We are Bamboo Entartainment, we are a News Medium and a Social Media app and site, our
            Social Media site is like "Youtube", "Tiktok" and "Twitter/X" at the same time.
          </p>
          <Link
            to="/news"
            className="mt-6 inline-flex rounded-sm bg-ember px-5 py-2.5 font-typewriter text-sm font-bold text-ember-foreground"
          >
            Read Bamboo News
          </Link>
        </section>
      </main>
    </div>
  );
}
