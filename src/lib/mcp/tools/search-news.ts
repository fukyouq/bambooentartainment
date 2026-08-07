import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth } from "../supabase";

export default defineTool({
  name: "search_news",
  title: "Search Bamboo News",
  description:
    "Search published Bamboo News articles by keyword and optionally filter by category. Returns titles, categories, authors and ids.",
  inputSchema: {
    query: z.string().trim().optional().describe("Keyword to match in the title or description."),
    category: z
      .enum(["breaking_news", "sports", "global", "health", "food", "conflicts", "other"])
      .optional()
      .describe("Restrict results to one news category."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let request = supabase
      .from("articles")
      .select("id, title, description, category, sports_subcategory, author_name, event_date, created_at")
      .eq("status", "published")
      .eq("blacklisted", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (category) request = request.eq("category", category);
    if (query) request = request.or(`title.ilike.%${query}%,description.ilike.%${query}%`);

    const { data, error } = await request;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { articles: data ?? [] },
    };
  },
});