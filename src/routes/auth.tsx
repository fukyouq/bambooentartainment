import { useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
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
  const location = useLocation();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ username: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  if (location.pathname === "/auth/callback") {
    return <Outlet />;
  }

  useEffect(() => {
    if (user) void navigate({ to: "/" });
  }, [user, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

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
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile`,
            data: {
              username: parsed.data.username,
              phone_number: parsed.data.phone || null,
            },
          },
        });
        if (error) throw error;
        setSentTo(parsed.data.email);
        setCooldown(60);
        toast.success(
          "Confirmation email sent — check your inbox and spam folder. If the button in the email doesn't work, copy the full link into your browser's address bar.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) {
          if (/confirm/i.test(error.message)) {
            throw new Error(
              "Your email is not confirmed yet. Use “Resend confirmation email” below, then check your inbox and spam folder.",
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
    if (cooldown > 0) {
      return toast.error(`Please wait ${cooldown}s before requesting another email.`);
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile` },
    });
    if (error) {
      if (/security purposes|rate limit/i.test(error.message)) {
        setCooldown(60);
        return toast.error("Too many requests — please wait a minute and try again.");
      }
      return toast.error(error.message);
    }
    setSentTo(email);
    setCooldown(60);
    toast.success("Confirmation email sent — check your inbox and spam folder.");
  };

  return (
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-md px-4 py-12">
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
            disabled={cooldown > 0}
            className="mt-2 w-full text-center text-xs text-muted-foreground underline disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend confirmation email (${cooldown}s)` : "Resend confirmation email"}
          </button>
          {sentTo && (
            <div
              aria-live="polite"
              className="mt-4 border-l-4 border-ember bg-muted p-3 text-xs leading-relaxed"
            >
              <p className="font-bold">We emailed {sentTo}.</p>
              <p className="mt-1 text-muted-foreground">
                Check your inbox <strong>and your spam/junk folder</strong>. The email contains a
                confirmation button and, underneath it, the same link as plain text — if the button
                doesn't open, copy that full link and paste it into your browser's address bar. It
                brings you back to{" "}
                <span className="break-all font-mono">
                  {typeof window === "undefined" ? "" : `${window.location.origin}/auth/callback`}
                </span>
                .
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}