import type { ReactNode } from "react";
import { Card } from "@store/ui";

interface ShowcaseSectionProps {
  id: string;
  title: string;
  hint: string;
  children: ReactNode;
}

export function ShowcaseSection({ id, title, hint, children }: ShowcaseSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-24 flex-col gap-3"
      data-test-selector={`design-system-section-${id}`}
    >
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-title`} className="text-section font-bold text-ink">
          {title}
        </h2>
        <p className="text-meta text-ink-muted">{hint}</p>
      </div>
      <Card className="flex flex-col gap-5 p-4 sm:p-5">{children}</Card>
    </section>
  );
}

// A labelled row of samples inside a section.
export function ShowcaseRow({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-meta font-semibold text-ink-subtle">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
