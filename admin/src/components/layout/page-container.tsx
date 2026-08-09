import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

// The one width a page is allowed to be.
//
// On a phone — which is ~95% of use — this is just the page: full width, the
// same 1rem of side padding the shell used to give it, and nothing else. It
// earns its keep on a desktop, where a single column of figures stretched to
// a 2560px monitor puts a card's label and its value a foot apart. The cap is
// generous (1440px) because the tables in this app are wide; the point is to
// stop the stretch, not to squeeze the content into a column.
//
// It carries `data-page-container` so the shell can drop its own padding for
// the pages that use this (globals.css, "PAGE CONTAINER") — two containers
// each adding 1rem is a phone screen with 2rem of margin and less room for
// the thing being read.
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div data-page-container="" className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
