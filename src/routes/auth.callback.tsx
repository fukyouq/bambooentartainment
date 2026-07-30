import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GreenHeader } from "@/components/GreenHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Confirming email — Bamboo Entartainment" },
      { name: "description", content: "Confirm your Bamboo Entartainment account email." },
      { property: "og:title", content: "Confirming email — Bamboo Entartainment" },
      { property: "og:description", content: "Confirm your Bamboo Entartainment account email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallbackPage,
});

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/")) return "/profile";
  if (value.startsWith("//")) return "/profile";
  return value;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    const finish = async () => {
      const url = new URL(window.location.href);
      const next = safeNext(url.searchParams.get("next"));
      const code = url.searchParams.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("This confirmation link could not be used. Please resend the confirmation email.");
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage("This confirmation link could not be used. Please resend the confirmation email.");
          return;
        }
      }

      await navigate({ to: next });
    };

    void finish();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <GreenHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-typewriter text-2xl font-bold text-bamboo">Email confirmation</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </main>
    </div>
  );
}