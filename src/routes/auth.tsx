import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { GreenHeader } from "@/components/GreenHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or Sign up — Bamboo Entartainment" },
      { name: "description", content: "Create a Bamboo Entartainment account or sign in." },
      { property: "og:title", content: "Sign in or Sign up — Bamboo Entartainment" },
      { property: "og:description", content: "Create a Bamboo Entartainment account or sign in." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  username: z.string().trim().min(2, "Username is too short").max(60),
  email: z.string().trim().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z.string().trim().max(30).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ username: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: parsed.data.username,
              phone_number: parsed.data.phone || null,
            },
          },
        });
        if (error) throw error;
        toast.success("Account created! Next: add a bio and a profile picture.");
        void navigate({ to: "/profile" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) {
          if (/confirm/i.test(error.message)) {
            throw new Error(
              "Your email is not confirmed yet. Use “Resend confirmation email” below.",
            );
          }
          throw error;
        }
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const email = form.email.trim();
    if (!email) return toast.error("Enter your email address first.");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/profile` },
    });
    if (error) return toast.error(error.message);
    toast.success("Confirmation email sent — check your inbox.");
  };

  return (
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="font-typewriter text-2xl font-bold text-bamboo">
            {mode === "signin" ? "Sign in" : "Sign up"}
          </h1>
          <form onSubmit={submit} className="mt-5 space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                maxLength={255}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                maxLength={128}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {mode === "signup" && (
              <div>
                <Label htmlFor="phone">Phone number (optional)</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  maxLength={30}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs underline"
          >
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
          <button
            type="button"
            onClick={() => void resendConfirmation()}
            className="mt-2 w-full text-center text-xs text-muted-foreground underline"
          >
            Resend confirmation email
          </button>
        </div>
      </main>
    </div>
  );
}