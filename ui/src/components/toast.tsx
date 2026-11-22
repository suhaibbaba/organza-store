import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";

type ToastTone = "success" | "warning" | "error" | "info" | "neutral";

// Solid and dark so white text passes WCAG AA on each in the shipped theme (title ≥ 6:1, second line ≥ 5:1).
const SURFACES: Record<ToastTone, string> = {
  success: "bg-success-800",
  error: "bg-danger-700",
  warning: "bg-warning-800",
  info: "bg-primary-800",
  neutral: "bg-neutral-900",
};

// More than this and the oldest makes way; a stack taller than three hides the screen it reports on.
const MAX_VISIBLE_TOASTS = 3;

// Every toast, whatever its tone, shows for three seconds; hovering or focusing it pauses the clock (Radix).
const TOAST_DURATION_MS = 3000;

// Longer than the toast-out animation (180ms), so a closed toast leaves the list only after it has finished sliding down.
const TOAST_EXIT_MS = 250;

export interface ToastAction {
  readonly labelKey: string;
  readonly onClick: () => void;
}

interface ToastMessage {
  readonly id: number;
  readonly messageKey: string;
  readonly values?: Record<string, string | number>;
  readonly descriptionKey?: string;
  readonly tone: ToastTone;
  readonly action?: ToastAction;
  readonly open: boolean;
}

type Values = Record<string, string | number>;
type Notify = (messageKey: string, values?: Values, descriptionKey?: string, action?: ToastAction) => void;

interface ToastApi {
  success: Notify;
  warning: Notify;
  error: Notify;
  info: Notify;
  neutral: Notify;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback(
    (messageKey: string, tone: ToastTone, values?: Values, descriptionKey?: string, action?: ToastAction) => {
      setMessages((current) => [
        ...current.slice(-(MAX_VISIBLE_TOASTS - 1)),
        {
          id: Date.now() + current.length,
          messageKey,
          tone,
          open: true,
          ...(values && { values }),
          ...(descriptionKey !== undefined && { descriptionKey }),
          ...(action && { action }),
        },
      ]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (messageKey, values, description, action) => push(messageKey, "success", values, description, action),
      warning: (messageKey, values, description, action) => push(messageKey, "warning", values, description, action),
      error: (messageKey, values, description, action) => push(messageKey, "error", values, description, action),
      info: (messageKey, values, description, action) => push(messageKey, "info", values, description, action),
      neutral: (messageKey, values, description, action) => push(messageKey, "neutral", values, description, action),
    }),
    [push],
  );

  // Closed first so Radix plays the exit animation, removed once it has run.
  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, open: false } : message)));
    setTimeout(() => setMessages((current) => current.filter((message) => message.id !== id)), TOAST_EXIT_MS);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="down" duration={TOAST_DURATION_MS}>
        {children}

        {messages.map((message) => {
          return (
            <ToastPrimitive.Root
              key={message.id}
              data-part="toast"
              data-testid="toast"
              data-tone={message.tone}
              open={message.open}
              type={message.tone === "error" ? "foreground" : "background"}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(message.id);
                }
              }}
              className={cn(
                "flex w-fit max-w-full items-start gap-2 rounded-full py-2.5 ps-5 pe-2.5 text-white shadow-toast",
                SURFACES[message.tone],
                "data-[state=open]:animate-[toast-in_220ms_ease-out]",
                "data-[state=closed]:animate-[toast-out_180ms_ease-in]",
                "data-[swipe=move]:translate-y-(--radix-toast-swipe-move-y)",
                "data-[swipe=end]:animate-[toast-out_180ms_ease-in]",
              )}
            >
              <div className="min-w-0 flex-1 py-1">
                <ToastPrimitive.Title
                  data-part="toast-title"
                  data-testid="toast-title"
                  className="text-sm leading-5 font-medium"
                >
                  {t(message.messageKey, message.values ?? {})}
                </ToastPrimitive.Title>

                {message.descriptionKey !== undefined && (
                  <ToastPrimitive.Description
                    data-part="toast-message"
                    data-testid="toast-message"
                    className="text-[13px] leading-5 text-white/90"
                  >
                    {t(message.descriptionKey, message.values ?? {})}
                  </ToastPrimitive.Description>
                )}
              </div>

              {message.action && (
                <ToastPrimitive.Action
                  data-part="toast-action"
                  data-testid="toast-action"
                  altText={t(message.action.labelKey)}
                  onClick={message.action.onClick}
                  className={cn(
                    "flex h-7 shrink-0 cursor-pointer items-center rounded-full bg-black/25 px-3 text-xs font-semibold",
                    "whitespace-nowrap transition-colors hover:bg-black/35 focus-visible:bg-black/45",
                  )}
                >
                  {t(message.action.labelKey)}
                </ToastPrimitive.Action>
              )}

              <ToastPrimitive.Close
                data-part="toast-close"
                data-testid="toast-close"
                aria-label={t("ui.common.close")}
                className={cn(
                  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/85",
                  "transition-colors hover:bg-black/25 hover:text-white focus-visible:bg-black/35",
                )}
              >
                <Icon name="x" className="size-4 [stroke-width:2]" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        {/* Bottom centre, above the home bar and any bottom bar an app declares through --toast-offset. */}
        <ToastPrimitive.Viewport
          data-part="toast-viewport"
          data-testid="toast-viewport"
          className={cn(
            "fixed inset-x-0 bottom-[calc(var(--safe-bottom,0px)+var(--toast-offset,0px)+1rem)] z-[60] mx-auto",
            "flex w-[calc(100vw-2rem)] max-w-[30rem] flex-col items-center gap-2 outline-none",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
