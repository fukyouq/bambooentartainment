import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_sonk_posts",
  title: "List Sonk posts",
  description: "List recent visible Sonk posts (text posts, shorts or videos) from the social feed.",
  inputSchema: {
    kind: z.enum(["post", "short", "video"]).optional().describe("Filter by post kind."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, limit }, ctx) => {
    const supabase = requireAuth(ctx);
    let request = supabase
      .from("sonk_posts")
      .select("id, kind, title, body, media_url, thumbnail_url, created_at")
      .eq("hidden", false)
      .eq("blacklisted", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (kind) request = request.eq("kind", kind);

    const { data, error } = await request;
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});