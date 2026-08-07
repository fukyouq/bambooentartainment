import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth } from "../supabase";

export default defineTool({
  name: "save_article",
  title: "Save or unsave article",
  description: "Add an article to the signed-in user's reading list, or remove it.",
  inputSchema: {
    article_id: z.string().uuid().describe("The article id."),
    saved: z.boolean().describe("true to save the article, false to remove it from the reading list."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ article_id, saved }, ctx) => {
    const supabase = requireAuth(ctx);
    const userId = ctx.getUserId();
    if (!userId) throw new ToolError("Missing user identity");

    if (saved) {
      const { error } = await supabase
        .from("saved_articles")
        .upsert({ user_id: userId, article_id }, { onConflict: "user_id,article_id" });
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: "Saved to your reading list." }] };
    }

    const { error } = await supabase
      .from("saved_articles")
      .delete()
      .eq("user_id", userId)
      .eq("article_id", article_id);
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: "Removed from your reading list." }] };
  },
});