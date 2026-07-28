import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OrangeHeader } from "@/components/OrangeHeader";
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
        ? await supabase.from("profiles").select("id, username").in("id", ids)
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
    <div className="min-h-screen bg-background">
      <OrangeHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !article ? (
          <p className="font-typewriter text-lg font-bold">Article not found.</p>
        ) : (
          <article>
            <h1 className="font-typewriter text-3xl font-bold leading-tight">{article.title}</h1>
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="mt-5 w-full rounded-md object-cover"
              />
            )}
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-foreground/85">
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

        <section className="mt-10">
          <h2 className="font-typewriter text-lg font-bold text-bamboo">Comments</h2>
          {user ? (
            <div className="mt-3 space-y-2">
              <Textarea
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment"
              />
              <Button onClick={() => void postComment()}>Post comment</Button>
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
              <li key={c.id} className="rounded-md border border-border bg-card p-3">
                <p className="text-xs font-semibold">{c.username}</p>
                <p className="mt-1 text-sm">{c.content}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}