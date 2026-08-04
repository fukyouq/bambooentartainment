import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GreenHeader } from "@/components/GreenHeader";
import { NewsNav } from "@/components/NewsNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABELS, type Article } from "@/lib/bamboo";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile & reading list — Bamboo Entartainment" },
      {
        name: "description",
        content: "Manage your Bamboo Entartainment profile and read the articles you saved.",
      },
      { property: "og:title", content: "Your profile & reading list — Bamboo Entartainment" },
      {
        property: "og:description",
        content: "Manage your profile and revisit the stories you saved on Bamboo News.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, role, loading, refreshProfile, signOut } = useAuth();
  const qc = useQueryClient();
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBio(profile?.bio ?? "");
    setAvatar(profile?.avatar_url ?? "");
  }, [profile?.bio, profile?.avatar_url]);

  const { data: saved = [], isLoading: savedLoading } = useQuery({
    queryKey: ["saved-articles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_articles")
        .select("article_id, created_at, articles(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r) => r.articles as Article | null)
        .filter((a): a is Article => !!a);
    },
  });

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio.trim() || null, avatar_url: avatar.trim() || null })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    await refreshProfile();
  };

  const unsave = async (articleId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("saved_articles")
      .delete()
      .eq("user_id", user.id)
      .eq("article_id", articleId);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["saved-articles"] });
    void qc.invalidateQueries({ queryKey: ["saved"] });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <GreenHeader />
      <NewsNav />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading…
          </p>
        ) : !user ? (
          <>
            <h1 className="font-typewriter text-3xl font-bold text-bamboo">Your profile</h1>
            <p className="mt-3 text-sm">
              <Link to="/auth" className="underline">
                Sign in
              </Link>{" "}
              to see your profile and reading list.
            </p>
          </>
        ) : (
          <div className="space-y-10">
            <section className="border-t-4 border-bamboo pt-4">
              <div className="flex flex-wrap items-center gap-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`${profile.username} profile picture`}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-muted font-typewriter text-xl font-bold">
                    {(profile?.username ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="font-typewriter text-3xl font-bold text-bamboo">
                    {profile?.username ?? "Your profile"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_LABELS[role]} · {profile?.email}
                  </p>
                </div>
                <Button variant="outline" className="ml-auto" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    rows={3}
                    maxLength={500}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell readers about yourself"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="avatar">Profile picture</Label>
                  <div id="avatar" className="mt-2">
                    <AvatarUpload userId={user.id} value={avatar} onChange={setAvatar} />
                  </div>
                </div>
              </div>
              <Button className="mt-4" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save profile"}
              </Button>
            </section>

            <section className="border-t-4 border-news-red pt-4">
              <h2 className="text-2xl font-bold tracking-tight">Your reading list</h2>
              {savedLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading saved stories…</p>
              ) : saved.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing saved yet — hit “Save” on any article to keep it here.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border border-b border-border">
                  {saved.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-4 py-3">
                      {a.image_url && (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          loading="lazy"
                          className="h-16 w-24 object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/article/$articleId"
                          params={{ articleId: a.id }}
                          className="block text-base font-bold leading-snug tracking-tight hover:underline"
                        >
                          {a.title}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {a.category} · {a.event_date} · {a.author_name}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void unsave(a.id)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}