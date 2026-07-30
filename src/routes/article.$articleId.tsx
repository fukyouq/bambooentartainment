import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrangeHeader } from "@/components/OrangeHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ArticleActions } from "@/components/ArticleActions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Article } from "@/lib/bamboo";

export const Route = createFileRoute("/article/$articleId")({
  head: () => ({
    meta: [
      { title: "Article — Bamboo News" },
      { name: "description", content: "Read the full story on Bamboo News." },
      { property: "og:title", content: "Article — Bamboo News" },
      { property: "og:description", content: "Read the full story on Bamboo News." },
    ],
  }),
  component: ArticlePage,
});

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
}

function ArticlePage() {
  const { articleId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .maybeSingle();
      if (error) throw error;
      return data as Article | null;
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", articleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id")
        .eq("article_id", articleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from("public_profiles").select("id, username").in("id", ids)
        : { data: [] };
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
      return rows.map((r) => ({ ...r, username: nameById.get(r.user_id) ?? "Reader" })) as CommentRow[];
    },
  });

  const postComment = async () => {
    if (!user) return toast.error("Sign in to comment.");
    const content = text.trim();
    if (!content) return toast.error("Write something first.");
    const { error } = await supabase
      .from("comments")
      .insert({ article_id: articleId, user_id: user.id, content: content.slice(0, 1000) });
    if (error) return toast.error(error.message);
    setText("");
    void qc.invalidateQueries({ queryKey: ["comments", articleId] });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OrangeHeader asHeading={false} />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : !article ? (
          <p className="font-typewriter text-lg font-bold">Article not found.</p>
        ) : (
          <article>
            {article.status === "draft" && (
              <p className="mb-4 border-l-4 border-ember bg-muted px-3 py-2 text-xs font-bold uppercase tracking-wide">
                Draft preview — not visible to the public yet
              </p>
            )}
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight">{article.title}</h1>
            <p className="mt-3 border-b border-border pb-3 text-xs text-muted-foreground">
              By {article.author_name} ·{" "}
              <time dateTime={article.created_at}>
                {new Date(article.created_at).toLocaleDateString()}
              </time>
            </p>
            <ArticleActions articleId={article.id} title={article.title} />
            {article.image_url && (
              <img
                src={article.image_url}
                alt={`Illustration for “${article.title}”`}
                loading="lazy"
                className="mt-5 w-full object-cover"
              />
            )}
            <p className="mt-5 whitespace-pre-line text-lg leading-relaxed text-foreground/85">
              {article.description}
            </p>
            <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
              <p>Event date: {article.event_date}</p>
              <p>
                Released on {new Date(article.created_at).toLocaleDateString()} · Author:{" "}
                {article.author_name}
              </p>
            </footer>
          </article>
        )}

        <section className="mt-10" aria-labelledby="comments-heading">
          <h2
            id="comments-heading"
            className="border-t-4 border-bamboo pt-2 text-lg font-bold tracking-tight"
          >
            Comments
          </h2>
          {user ? (
            <div className="mt-3 space-y-2">
              <label htmlFor="comment-input" className="sr-only">
                Add a comment
              </label>
              <Textarea
                id="comment-input"
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment"
              />
              <Button className="min-h-11" onClick={() => void postComment()}>
                Post comment
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              <Link to="/auth" className="underline">
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
          <ul className="mt-6 space-y-4">
            {comments.map((c) => (
              <li key={c.id} className="border border-border bg-card p-3">
                <p className="text-xs font-semibold">
                  {c.username} ·{" "}
                  <time dateTime={c.created_at} className="font-normal text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </time>
                </p>
                <p className="mt-1 text-sm">{c.content}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}