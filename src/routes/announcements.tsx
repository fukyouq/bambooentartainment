import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SonkShell, type SonkTab } from "@/components/sonk/SonkShell";
import { ShortsPlayer } from "@/components/sonk/ShortsPlayer";
import {
  CombinedFeed,
  ShortsReel,
  SonkComposer,
  VideoGrid,
  useSonk,
} from "@/components/sonk/SonkFeed";

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

function SonkPage() {
  const [query, setQuery] = useState("");
  const sonk = useSonk(query);
  const [tab, setTab] = useState<SonkTab>("foryou");
  const [shortId, setShortId] = useState<string | null>(null);

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

  const shorts = filtered.posts.filter((p) => p.kind === "short");
  const playing = shortId ? shorts.findIndex((s) => s.id === shortId) : -1;

  return (
    <SonkShell tab={tab} onTab={setTab} query={query} onQuery={setQuery}>
      <h1 className="sr-only">Sonk</h1>

      {tab !== "shorts" && (
        <div className="mb-6">
          <SonkComposer kind={tab === "videos" ? "video" : "post"} onDone={() => void sonk.reload()} />
        </div>
      )}

      {sonk.loading ? (
        <p className="py-10 text-center text-muted-foreground">Loading Sonk…</p>
      ) : tab === "foryou" ? (
        <CombinedFeed data={filtered} onOpenShort={setShortId} />
      ) : tab === "shorts" ? (
        <ShortsReel data={filtered} />
      ) : (
        <VideoGrid data={filtered} />
      )}

      {playing >= 0 && (
        <ShortsPlayer
          posts={shorts}
          startIndex={playing}
          data={filtered}
          onClose={() => setShortId(null)}
          onOpenReplies={() => setShortId(null)}
        />
      )}
    </SonkShell>
  );
}
