import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { requireAuth } from "../supabase";

export default defineTool({
  name: "list_reading_list",
  title: "List reading list",
  description: "List the articles the signed-in user has saved to their Bamboo News reading list.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const supabase = requireAuth(ctx);
    const { data, error } = await supabase
      .from("saved_articles")
      .select("article_id, created_at, articles(id, title, category, author_name)")
      .order("created_at", { ascending: false });
    if (error) throw new ToolError(error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { saved: data ?? [] },
    };
  },
});