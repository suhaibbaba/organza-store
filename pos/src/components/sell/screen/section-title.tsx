import type { ReactNode } from "react";
import { Typography } from "@store/ui";

export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Typography as="h2" id={id} variant="h3" weight="semibold">
      {children}
    </Typography>
  );
}
