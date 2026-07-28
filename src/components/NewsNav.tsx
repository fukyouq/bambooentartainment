import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/news", label: "News" },
  { to: "/news", label: "Sport", search: undefined },
] as const;

/** BBC-style secondary navigation strip that sits under the masthead. */
export function NewsNav() {
  return (
    <nav className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-stretch gap-0 overflow-x-auto px-4">
        {LINKS.map((l, i) => (
          <Link
            key={`${l.to}-${i}`}
            to={l.to}
            activeOptions={{ exact: true }}
            activeProps={{ className: "border-bamboo text-foreground" }}
            inactiveProps={{ className: "border-transparent text-foreground/70" }}
            className="whitespace-nowrap border-b-4 px-4 py-3 text-sm font-bold tracking-tight hover:bg-muted"
          >
            {l.label}
          </Link>
        ))}
        <Link
          to="/auth"
          activeProps={{ className: "border-bamboo text-foreground" }}
          inactiveProps={{ className: "border-transparent text-foreground/70" }}
          className="ml-auto whitespace-nowrap border-b-4 px-4 py-3 text-sm font-bold tracking-tight hover:bg-muted"
        >
          Your account
        </Link>
      </div>
    </nav>
  );
}