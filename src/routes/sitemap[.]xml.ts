import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://bambooentartainment.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

async function publishedArticlePaths(): Promise<string[]> {
  const url = import.meta.env['VITE_SUPABASE_URL'];
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return [];
  try {
    const res = await fetch(
      `${url}/rest/v1/articles?select=id&status=eq.published&blacklisted=eq.false`,
      { headers: { apikey: key } },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.map((r) => `/article/${r.id}`);
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/news", changefreq: "hourly", priority: "0.9" },
          { path: "/announcements", changefreq: "hourly", priority: "0.8" },
          { path: "/auth", changefreq: "yearly", priority: "0.3" },
        ];
        for (const path of await publishedArticlePaths()) {
          entries.push({ path, changefreq: "weekly", priority: "0.7" });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});