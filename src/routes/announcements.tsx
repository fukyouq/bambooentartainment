import { createFileRoute } from "@tanstack/react-router";
import { RedHeader } from "@/components/RedHeader";
import { NewsNav } from "@/components/NewsNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Bamboo Entartainment" },
      {
        name: "description",
        content:
          "Official announcements and notices from the Bamboo Entartainment newsroom and company.",
      },
      { property: "og:title", content: "Announcements — Bamboo Entartainment" },
      {
        property: "og:description",
        content:
          "Official announcements and notices from the Bamboo Entartainment newsroom and company.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RedHeader />
      <NewsNav />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <section className="border-t-4 border-news-red pt-4">
          <h2 className="text-2xl font-bold tracking-tight">Latest announcements</h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/80">
            This is where Bamboo Entartainment posts official notices — newsroom updates, service
            changes and company statements. Nothing has been announced yet.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}