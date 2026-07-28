export type AppRole =
  | "overseer_company"
  | "overseer_entertainment"
  | "supervisor"
  | "journalist"
  | "user";

export const ROLE_LABELS: Record<AppRole, string> = {
  overseer_company: "Overseer of Bamboo Company",
  overseer_entertainment: "Overseer of Bamboo Entertainment",
  supervisor: "Supervisor",
  journalist: "Journalist",
  user: "Reader",
};

export const ROLE_RANK: Record<AppRole, number> = {
  overseer_company: 4,
  overseer_entertainment: 3,
  supervisor: 2,
  journalist: 1,
  user: 0,
};

export const ASSIGNABLE_ROLES: AppRole[] = [
  "overseer_entertainment",
  "supervisor",
  "journalist",
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