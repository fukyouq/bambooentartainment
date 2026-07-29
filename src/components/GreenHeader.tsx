import { Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import logoAsset from "@/assets/bamboo-mark.png.asset.json";
import { SquareIconButton } from "./SquareIconButton";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/bamboo";

export function GreenHeader() {
  const { user, profile, role, rank, signOut } = useAuth();

  return (
    <header className="border-b-4 border-bamboo-light bg-bamboo text-bamboo-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src={logoAsset.url}
            alt="Bamboo Entartainment logo"
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
            <div className="hidden items-center gap-3 sm:flex">
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
                onClick={() => void signOut()}
                className="font-typewriter text-xs font-bold underline underline-offset-4"
              >
                Sign out
              </button>
            </div>
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
        </div>
      </div>
    </header>
  );
}