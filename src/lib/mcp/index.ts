import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchNews from "./tools/search-news";
import getArticle from "./tools/get-article";
import listReadingList from "./tools/list-reading-list";
import saveArticle from "./tools/save-article";
import listSonkPosts from "./tools/list-sonk-posts";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "bamboo-news-hub",
  title: "Bamboo News Hub",
  version: "0.1.0",
  instructions:
    "Tools for Bamboo Entartainment. Use `search_news` and `get_article` to read published Bamboo News stories, `list_reading_list` and `save_article` to manage the signed-in user's saved stories, and `list_sonk_posts` to browse the Sonk social feed.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchNews, getArticle, listReadingList, saveArticle, listSonkPosts],
});