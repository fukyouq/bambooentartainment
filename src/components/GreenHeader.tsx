import { Link } from "@tanstack/react-router";
import { Megaphone, Newspaper } from "lucide-react";
import logoAsset from "@/assets/bamboo-mark.png.asset.json";
import { SquareIconButton } from "./SquareIconButton";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/bamboo";

export function GreenHeader() {
  const { user, profile, role, rank, signOut } = useAuth();

  return (
    <header role="banner" className="border-b-4 border-bamboo-light bg-bamboo text-bamboo-foreground">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5">
        <Link
          to="/"
          aria-label="Bamboo Entartainment — go to the home page"
          className="flex min-w-0 items-center gap-2 sm:gap-3"
        >
          <img
            src={logoAsset.url}
            alt=""
            aria-hidden="true"
            width={48}
            height={48}
            className="h-11 w-11 shrink-0 border border-bamboo-light bg-bamboo-light object-contain p-1.5 sm:h-12 sm:w-12"
          />
          <span className="truncate font-typewriter text-base font-bold sm:text-2xl">
            Bamboo Entartainment
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <nav aria-label="Account" className="hidden items-center gap-3 sm:flex">
              {rank >= 1 && (
                <Link
                  to="/admin"
                  className="font-typewriter text-xs font-bold underline underline-offset-4"
                >
                  Newsroom
                </Link>
              )}
              <span className="text-xs opacity-80">
                {profile?.username ?? "Reader"} · {ROLE_LABELS[role]}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="font-typewriter text-xs font-bold underline underline-offset-4"
              >
                Sign out
              </button>
            </nav>
          ) : (
            <Link
              to="/auth"
              className="hidden font-typewriter text-xs font-bold underline underline-offset-4 sm:block"
            >
              Sign in / Sign up
            </Link>
          )}
          <SquareIconButton
            to="/news"
            label="Bamboo News"
            variant="ember"
            icon={<Newspaper className="h-5 w-5" />}
          />
          <SquareIconButton
            to="/announcements"
            label="Sonk"
            variant="news-red"
            icon={<Megaphone className="h-5 w-5" />}
          />
        </div>
      </div>
    </header>
  );
}