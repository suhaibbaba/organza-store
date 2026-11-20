import type { ReactNode } from "react";

// A card's heading with the short teal bar at its start, as every card on the
// selling screen draws it.
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-base font-bold">
      <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </h2>
  );
}
