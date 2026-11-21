"use client";

import { useEffect, useRef, useState } from "react";

// The search box types freely; the query string (`committed`) gets the text once typing pauses.
export function useUrlSearch(
  committed: string,
  onCommit: (value: string) => void,
  delayMs: number,
): [string, (value: string) => void] {
  const [input, setInput] = useState(committed);
  const [seen, setSeen] = useState(committed);
  const [sent, setSent] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new ?q= from elsewhere (header search, Back) replaces the box; our own write must not undo newer typing.
  if (committed !== seen) {
    setSeen(committed);
    if (committed !== sent) {
      setInput(committed);
    }
  }

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function change(value: string) {
    setInput(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setSent(value);
      onCommit(value);
    }, delayMs);
  }

  return [input, change];
}
