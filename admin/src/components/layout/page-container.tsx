import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div data-page-container="" className={cn("mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 pt-3", className)}>
      {children}
    </div>
  );
}
