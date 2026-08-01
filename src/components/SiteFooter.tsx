import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-4 border-bamboo bg-bamboo text-bamboo-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="font-typewriter text-lg font-bold">Bamboo Entartainment</p>
        <p className="mt-1 text-sm text-bamboo-foreground/60">Managed by Bamboo Company.</p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/" className="hover:underline">
            Home
          </Link>
          <Link to="/news" className="hover:underline">
            Bamboo News
          </Link>
          <Link to="/announcements" className="hover:underline">
            Sonk
          </Link>
          <Link to="/auth" className="hover:underline">
            Sign in / Sign up
          </Link>
          <Link to="/profile" className="hover:underline">
            Your profile
          </Link>
        </div>
        <p className="mt-6 text-xs opacity-70">
          Bamboo Entartainment is a news medium and a social media platform.
        </p>
      </div>
    </footer>
  );
}