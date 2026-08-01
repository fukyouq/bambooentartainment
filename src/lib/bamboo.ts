export type AppRole =
  | "overseer_company"
  | "overseer_entertainment"
  | "sonk_admin"
  | "supervisor"
  | "sonk_supervisor"
  | "journalist"
  | "sonk_moderator"
  | "user";

export const ROLE_LABELS: Record<AppRole, string> = {
  overseer_company: "Overseer of Bamboo Company",
  overseer_entertainment: "Overseer of Bamboo Entertainment",
  sonk_admin: "Sonk Administrator",
  supervisor: "Supervisor",
  sonk_supervisor: "Sonk Supervisor",
  journalist: "Journalist",
  sonk_moderator: "Moderator",
  user: "Reader",
};

export const ROLE_RANK: Record<AppRole, number> = {
  overseer_company: 4,
  overseer_entertainment: 3,
  sonk_admin: 2,
  supervisor: 2,
  sonk_supervisor: 2,
  journalist: 1,
  sonk_moderator: 1,
  user: 0,
};

/** Sonk-side ladder: Moderator < Sonk Supervisor < Sonk Administrator < Overseers. */
export const SONK_ROLE_RANK: Record<AppRole, number> = {
  overseer_company: 5,
  overseer_entertainment: 4,
  sonk_admin: 3,
  sonk_supervisor: 2,
  supervisor: 2,
  sonk_moderator: 1,
  journalist: 1,
  user: 0,
};

export const ASSIGNABLE_ROLES: AppRole[] = [
  "overseer_entertainment",
  "sonk_admin",
  "supervisor",
  "sonk_supervisor",
  "journalist",
  "sonk_moderator",
  "user",
];

export type Category =
  | "breaking_news"
  | "trending"
  | "sports"
  | "global"
  | "health"
  | "food"
  | "conflicts"
  | "other";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "breaking_news", label: "BREAKING NEWS" },
  { value: "trending", label: "Trending" },
  { value: "sports", label: "Sports" },
  { value: "global", label: "Global" },
  { value: "health", label: "Health" },
  { value: "food", label: "Food" },
  { value: "conflicts", label: "Conflicts" },
  { value: "other", label: "Other" },
];

export type SportsSubcategory = "football" | "basketball" | "formula_1" | "individual_athletes";

export const SPORTS_SUBCATEGORIES: { value: SportsSubcategory; label: string }[] = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "formula_1", label: "Formula 1" },
  { value: "individual_athletes", label: "Individual Athletes" },
];

export const EMPTY_CATEGORY_MESSAGE: Partial<Record<Category, string>> = {
  conflicts: "Fortunatly no wars or civil wars!",
};

export interface Article {
  id: string;
  title: string;
  description: string;
  category: Category;
  sports_subcategory: SportsSubcategory | null;
  event_date: string;
  image_url: string | null;
  keywords: string[];
  author_id: string | null;
  author_name: string;
  blacklisted: boolean;
  created_at: string;
  status: ArticleStatus;
}

export type ArticleStatus = "draft" | "published";

export interface AuditEntry {
  id: string;
  article_id: string | null;
  article_title: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created_draft: "Draft created",
  published: "Published",
  unpublished: "Moved back to draft",
  blacklisted: "Blacklisted",
  restored: "Restored from blacklist",
  edited: "Edited",
};

const STOP_WORDS = new Set([
  "the","a","an","of","in","on","for","to","and","or","is","are","was","were","with","at","by","from","as","it","this","that",
]);

export function extractKeywords(...parts: string[]): string[] {
  const words = parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, 40);
}

/** Keyword-based search scoring: matches query tokens against keywords, title and body. */
export function searchArticles(articles: Article[], query: string): Article[] {
  const tokens = extractKeywords(query);
  if (tokens.length === 0) return articles;
  return articles
    .map((article) => {
      const haystack = `${article.title} ${article.description}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (article.keywords.some((k) => k.includes(token) || token.includes(k))) score += 5;
        if (article.title.toLowerCase().includes(token)) score += 4;
        if (haystack.includes(token)) score += 1;
      }
      return { article, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);
}

export interface NewsFilters {
  category: Category | "all";
  sub: SportsSubcategory | "all";
  author: string;
  query: string;
}

export const EMPTY_FILTERS: NewsFilters = {
  category: "breaking_news",
  sub: "all",
  author: "all",
  query: "",
};

/** Applies category / sport / author filters, then keyword scoring for the query. */
export function filterArticles(articles: Article[], f: NewsFilters): Article[] {
  let list = articles;
  if (f.category !== "all") list = list.filter((a) => a.category === f.category);
  if (f.sub !== "all") list = list.filter((a) => a.sports_subcategory === f.sub);
  if (f.author !== "all") list = list.filter((a) => a.author_name === f.author);
  if (f.query.trim()) list = searchArticles(list, f.query);
  return list;
}

export function authorsOf(articles: Article[]): string[] {
  return Array.from(new Set(articles.map((a) => a.author_name))).sort();
}

/** Autocomplete suggestions drawn from headlines, keywords and authors. */
export function suggestFor(articles: Article[], raw: string, limit = 8): string[] {
  const q = raw.trim().toLowerCase();
  if (q.length < 2) return [];
  const pool = new Set<string>();
  for (const a of articles) {
    for (const k of a.keywords) if (k.startsWith(q)) pool.add(k);
    if (a.title.toLowerCase().includes(q)) pool.add(a.title);
    if (a.author_name.toLowerCase().includes(q)) pool.add(a.author_name);
  }
  return Array.from(pool)
    .sort((a, b) => a.length - b.length)
    .slice(0, limit);
}