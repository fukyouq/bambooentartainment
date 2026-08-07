import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth } from "../supabase";

export default defineTool({
  name: "get_article",
  title: "Get news article",
  description: "Read one published Bamboo News article in full, including its comments.",
  inputSchema: { article_id: z.string().uuid().describe("The article id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ article_id }, ctx) => {
    const supabase = requireAuth(ctx);
    const { data: article, error } = await supabase
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!article) throw new ToolError("Article not found or not visible to you.");

    const { data: comments } = await supabase
      .from("comments")
      .select("id, content, created_at")
      .eq("article_id", article_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      content: [{ type: "text", text: JSON.stringify({ article, comments: comments ?? [] }, null, 2) }],
      structuredContent: { article, comments: comments ?? [] },
    };
  },
});