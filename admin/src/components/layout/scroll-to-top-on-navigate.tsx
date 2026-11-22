"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Next keeps the scroll position when the new page is in view, so a new page could open half-way down; Back keeps the browser's own restore.
export function ScrollToTopOnNavigate() {
  const pathname = usePathname();
  const isHistoryStep = useRef(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    const markHistoryStep = () => {
      isHistoryStep.current = true;
    };
    window.addEventListener("popstate", markHistoryStep);
    return () => window.removeEventListener("popstate", markHistoryStep);
  }, []);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }
    previousPathname.current = pathname;
    if (isHistoryStep.current) {
      isHistoryStep.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
