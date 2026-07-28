import { ArrowLeft } from "lucide-react";
import { SquareIconButton } from "./SquareIconButton";

export function OrangeHeader({ title = "Bamboo News" }: { title?: string }) {
  return (
    <header className="bg-ember text-ember-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
        <h1 className="truncate font-typewriter text-xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
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