"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FEEDBACK_TIMEOUT_MS } from "@/constants/feedback";

export interface TransientMessage {
  variant: "success" | "destructive";
  text: string;
}

// Short-lived feedback for actions that have no other visible result — a
// scan that landed in the cart, a code that matched nothing. Every action
// on the selling screen has to say what happened (CLAUDE.md "Clear feedback
// always"), but a cashier should not have to dismiss anything mid-sale, so
// these clear themselves.
export function useTransientMessage() {
  const [message, setMessage] = useState<TransientMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(null);
  }, []);

  const show = useCallback((next: TransientMessage) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), FEEDBACK_TIMEOUT_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { message, show, clear };
}
