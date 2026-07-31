import { ArrowLeft } from "lucide-react";
import { SquareIconButton } from "./SquareIconButton";

interface RedHeaderProps {
  title?: string;
  /** Render the masthead title as the page's <h1>. Set false when the page owns its own h1. */
  asHeading?: boolean;
}

export function RedHeader({ title = "Bamboo Announcements", asHeading = true }: RedHeaderProps) {
  const Title = asHeading ? "h1" : "p";
  return (
    <header
      role="banner"
      className="border-b-4 border-news-red/70 bg-news-red text-news-red-foreground"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5">
        <Title className="truncate font-typewriter text-xl font-bold tracking-tight sm:text-3xl">
          {title}
        </Title>
        <SquareIconButton
          to="/"
          label="Go back to home page"
          variant="bamboo"
          icon={<ArrowLeft className="h-5 w-5" />}
        />
      </div>
    </header>
  );
}