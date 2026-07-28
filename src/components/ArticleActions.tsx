import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface Props {
  articleId: string;
  title: string;
}

/** Save-to-reading-list and share controls shown on an article page. */
export function ArticleActions({ articleId, title }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: saved } = useQuery({
    queryKey: ["saved", user?.id, articleId],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_articles")
        .select("id")
        .eq("user_id", user!.id)
        .eq("article_id", articleId)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleSave = async () => {
    if (!user) return toast.error("Sign in to save articles to your reading list.");
    setBusy(true);
    const { error } = saved
      ? await supabase
          .from("saved_articles")
          .delete()
          .eq("user_id", user.id)
          .eq("article_id", articleId)
      : await supabase.from("saved_articles").insert({ user_id: user.id, article_id: articleId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(saved ? "Removed from your reading list" : "Saved to your reading list");
    void qc.invalidateQueries({ queryKey: ["saved"] });
    void qc.invalidateQueries({ queryKey: ["saved-articles"] });
  };

  const share = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not share this article");
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void toggleSave()}>
        {saved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
        {saved ? "Saved" : "Save"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => void share()}>
        {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
        Share
      </Button>
    </div>
  );
}