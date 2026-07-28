import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GreenHeader } from "@/components/GreenHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { createStaffUser } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ASSIGNABLE_ROLES,
  AUDIT_ACTION_LABELS,
  CATEGORIES,
  ROLE_LABELS,
  ROLE_RANK,
  SPORTS_SUBCATEGORIES,
  extractKeywords,
  type Article,
  type ArticleStatus,
  type AuditEntry,
  type Category,
  type SportsSubcategory,
} from "@/lib/bamboo";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Newsroom — Bamboo Entartainment" },
      { name: "description", content: "Staff newsroom for publishing and managing Bamboo News." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Newsroom — Bamboo Entartainment" },
      { property: "og:description", content: "Staff newsroom for Bamboo News." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, profile, role, rank, loading } = useAuth();

  if (loading) return <Shell>Loading…</Shell>;
  if (!user)
    return (
      <Shell>
        You must{" "}
        <Link to="/auth" className="underline">
          sign in
        </Link>{" "}
        to access the newsroom.
      </Shell>
    );
  if (rank < 1) return <Shell>Your account does not have newsroom access.</Shell>;

  return (
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <div>
          <h1 className="font-typewriter text-3xl font-bold text-bamboo">Newsroom</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {profile?.username} — {ROLE_LABELS[role]}
          </p>
        </div>
        {rank >= 4 && <SiteControl />}
        <ArticleForm authorName={profile?.username ?? "Bamboo Newsroom"} userId={user.id} />
        <ArticleList rank={rank} />
        <ModerationQueue rank={rank} />
        <UserForm rank={rank} />
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-sm">{children}</main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-typewriter text-xl font-bold text-bamboo">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SiteControl() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("is_open").maybeSingle();
      return data;
    },
  });

  const toggle = async (next: boolean) => {
    const { error } = await supabase
      .from("site_settings")
      .update({ is_open: next, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success(next ? "Site opened" : "Site closed");
    void qc.invalidateQueries({ queryKey: ["site-settings"] });
  };

  return (
    <Section title="Site status">
      <div className="flex items-center gap-3">
        <Switch checked={data?.is_open ?? true} onCheckedChange={(v) => void toggle(v)} />
        <span className="text-sm">{data?.is_open ? "Site is open" : "Site is closed"}</span>
      </div>
    </Section>
  );
}

function ArticleForm({ authorName, userId }: { authorName: string; userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    eventDate: "",
    imageUrl: "",
    category: "" as Category | "",
    sub: "" as SportsSubcategory | "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.eventDate || !form.category) {
      return toast.error("Title, description, event date and category are required.");
    }
    if (form.category === "sports" && !form.sub) {
      return toast.error("Pick a sports sub-category.");
    }
    setBusy(true);
    const { error } = await supabase.from("articles").insert({
      title: form.title.trim().slice(0, 200),
      description: form.description.trim(),
      event_date: form.eventDate,
      image_url: form.imageUrl.trim() || null,
      category: form.category,
      sports_subcategory:
        form.category === "sports" && form.sub ? (form.sub as SportsSubcategory) : null,
      keywords: extractKeywords(form.title, form.description),
      author_id: userId,
      author_name: authorName,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Article published");
    setForm({ title: "", description: "", eventDate: "", imageUrl: "", category: "", sub: "" });
    void qc.invalidateQueries({ queryKey: ["articles"] });
    void qc.invalidateQueries({ queryKey: ["all-articles"] });
  };

  return (
    <Section title="Add a news article">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            maxLength={200}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={6}
            value={form.description}
            maxLength={20000}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="eventDate">Date of when this happened</Label>
            <Input
              id="eventDate"
              type="date"
              value={form.eventDate}
              onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="imageUrl">Picture URL (optional)</Label>
            <Input
              id="imageUrl"
              value={form.imageUrl}
              maxLength={500}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {form.category === "sports" && (
            <div>
              <Label htmlFor="sub">Sports sub-category</Label>
              <select
                id="sub"
                value={form.sub}
                onChange={(e) => setForm({ ...form, sub: e.target.value as SportsSubcategory })}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a sport</option>
                {SPORTS_SUBCATEGORIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Publish article"}
        </Button>
      </form>
    </Section>
  );
}

function ArticleList({ rank }: { rank: number }) {
  const qc = useQueryClient();
  const { data: articles = [] } = useQuery({
    queryKey: ["all-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Article[];
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["all-articles"] });
    void qc.invalidateQueries({ queryKey: ["articles"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Article deleted");
    refresh();
  };

  const blacklist = async (id: string, next: boolean) => {
    const { error } = await supabase.from("articles").update({ blacklisted: next }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Article blacklisted" : "Article restored");
    refresh();
  };

  return (
    <Section title="Manage articles">
      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No articles yet.</p>
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.category} · {a.event_date} · {a.author_name}
                  {a.blacklisted ? " · blacklisted" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {rank >= 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void blacklist(a.id, !a.blacklisted)}
                  >
                    {a.blacklisted ? "Un-blacklist" : "Blacklist"}
                  </Button>
                )}
                {rank >= 2 && (
                  <Button size="sm" variant="destructive" onClick={() => void remove(a.id)}>
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function UserForm({ rank }: { rank: number }) {
  const addUser = useServerFn(createStaffUser);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    dateOfBirth: "",
    role: "",
  });
  const [busy, setBusy] = useState(false);

  const options = ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] < rank);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addUser({
        data: {
          email: form.email.trim(),
          password: form.password,
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          dateOfBirth: form.dateOfBirth,
          role: form.role as (typeof ASSIGNABLE_ROLES)[number],
        },
      });
      toast.success("User created");
      setForm({ fullName: "", username: "", email: "", password: "", dateOfBirth: "", role: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Add a user">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Names</Label>
            <Input
              id="fullName"
              value={form.fullName}
              maxLength={120}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="newUsername">Username</Label>
            <Input
              id="newUsername"
              value={form.username}
              maxLength={60}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="dob">Date of birth</Label>
            <Input
              id="dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select a role</option>
              {options.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="newEmail">Email</Label>
            <Input
              id="newEmail"
              type="email"
              value={form.email}
              maxLength={255}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">Temporary password</Label>
            <Input
              id="newPassword"
              value={form.password}
              maxLength={128}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          You cannot assign your own role or a role above yours.
        </p>
        <Button type="submit" disabled={busy || !form.role}>
          {busy ? "Creating…" : "Create user"}
        </Button>
      </form>
    </Section>
  );
}