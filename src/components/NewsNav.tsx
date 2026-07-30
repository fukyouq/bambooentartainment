import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/news", label: "News" },
  { to: "/profile", label: "Profile" },
] as const;

/** BBC-style secondary navigation strip that sits under the masthead. */
export function NewsNav() {
  return (
    <nav aria-label="Primary" className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-stretch gap-0 overflow-x-auto px-4">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-bamboo text-foreground", "aria-current": "page" }}
            inactiveProps={{ className: "border-transparent text-foreground/70" }}
            className="min-h-11 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-bold tracking-tight hover:bg-muted"
          >
            {l.label}
          </Link>
        ))}
        <Link
          to="/auth"
          activeProps={{ className: "border-bamboo text-foreground", "aria-current": "page" }}
          inactiveProps={{ className: "border-transparent text-foreground/70" }}
          className="ml-auto min-h-11 whitespace-nowrap border-b-4 px-4 py-3 text-sm font-bold tracking-tight hover:bg-muted"
        >
          Your account
        </Link>
      </div>
    </nav>
  );
}