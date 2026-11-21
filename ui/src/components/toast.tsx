import * as ToastPrimitive from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon, type IconName } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";

type ToastTone = "success" | "warning" | "error";

const TONES: Record<ToastTone, { chip: string; tint: string; line: string; icon: IconName }> = {
  success: {
    chip: "bg-success-800",
    tint: "[--toast-tint:var(--color-success-100)]",
    line: "bg-success-500",
    icon: "check",
  },
  warning: {
    chip: "bg-warning-500",
    tint: "[--toast-tint:var(--color-warning-100)]",
    line: "bg-warning-500",
    icon: "alert",
  },
  error: {
    chip: "bg-danger-600",
    tint: "[--toast-tint:var(--color-danger-100)]",
    line: "bg-danger-500",
    icon: "x",
  },
};

const TOAST_MS = 2500;
const TOAST_ERROR_MS = 6000;

const TOAST_WITH_ACTION_MS = 6000;

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
}

type Values = Record<string, string | number>;
type Notify = (
  messageKey: string,
  values?: Values,
  descriptionKey?: string,
  action?: ToastAction,
) => void;

interface ToastApi {
  success: Notify;
  warning: Notify;
  error: Notify;
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
    (
      messageKey: string,
      tone: ToastTone,
      values?: Values,
      descriptionKey?: string,
      action?: ToastAction,
    ) => {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + current.length,
          messageKey,
          tone,
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
      success: (messageKey, values, description, action) =>
        push(messageKey, "success", values, description, action),
      warning: (messageKey, values, description, action) =>
        push(messageKey, "warning", values, description, action),
      error: (messageKey, values, description, action) =>
        push(messageKey, "error", values, description, action),
    }),
    [push],
  );

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider
        swipeDirection={documentDirection() === "rtl" ? "left" : "right"}
        duration={TOAST_MS}
      >
        {children}

        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            data-part="toast"
            data-testid="toast"
            data-tone={message.tone}
            open
            duration={
              message.action
                ? TOAST_WITH_ACTION_MS
                : message.tone === "error"
                  ? TOAST_ERROR_MS
                  : TOAST_MS
            }
            onOpenChange={(open) => {
              if (!open) {
                dismiss(message.id);
              }
            }}
            className={cn(
              "group relative flex gap-3 overflow-hidden rounded-card border border-line",
              message.descriptionKey === undefined && !message.action
                ? "items-center"
                : "items-start",
              "toast-wash px-4 py-3.5 shadow-float",
              TONES[message.tone].tint,
              "data-[state=open]:animate-[toast-in_200ms_ease-out]",
              "data-[state=closed]:animate-[toast-out_150ms_ease-in]",
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
            )}
          >
            <span
              data-part="toast-chip"
              data-testid="toast-chip"
              aria-hidden="true"
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-pill text-ink-inverse",
                (message.descriptionKey !== undefined || message.action) && "mt-0.5",
                TONES[message.tone].chip,
              )}
            >
              <Icon name={TONES[message.tone].icon} className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title
                data-part="toast-title"
                data-testid="toast-title"
                className="text-value font-medium text-ink"
              >
                {t(message.messageKey, message.values ?? {})}
              </ToastPrimitive.Title>

              {message.descriptionKey !== undefined && (
                <ToastPrimitive.Description
                  data-part="toast-message"
                  data-testid="toast-message"
                  className="mt-0.5 text-label text-ink-muted"
                >
                  {t(message.descriptionKey, message.values ?? {})}
                </ToastPrimitive.Description>
              )}

              {message.action && (
                <ToastPrimitive.Action
                  data-part="toast-action"
                  data-testid="toast-action"
                  altText={t(message.action.labelKey)}
                  onClick={message.action.onClick}
                  className={cn(
                    "mt-1 inline-flex min-h-(--control-h-sm) cursor-pointer items-center",
                    "text-label font-medium text-primary-700",
                    "transition-colors hover:text-primary-900 focus-link",
                  )}
                >
                  {t(message.action.labelKey)}
                </ToastPrimitive.Action>
              )}
            </div>

            <ToastPrimitive.Close
              data-part="toast-close"
              data-testid="toast-close"
              aria-label={t("ui.common.close")}
              className={cn(
                "inline-grid size-(--control-h-sm) shrink-0 cursor-pointer place-items-center",
                "rounded-control text-ink-subtle",
                "transition-colors duration-[250ms] ease-in-out hover:bg-inset hover:text-ink",
                "focus-visible:bg-neutral-300 focus-visible:text-ink",
              )}
            >
              <Icon name="x" className="size-4" />
            </ToastPrimitive.Close>

            <span
              data-part="toast-life"
              data-testid="toast-life"
              aria-hidden="true"
              style={{
                animationDuration: `${message.action ? TOAST_WITH_ACTION_MS : TOAST_MS}ms`,
              }}
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 animate-[toast-life_linear_forwards]",
                "page-rtl:origin-right page-ltr:origin-left group-hover:animate-none",
                TONES[message.tone].line,
              )}
            />
          </ToastPrimitive.Root>
        ))}

        <ToastPrimitive.Viewport
          data-part="toast-viewport"
          data-testid="toast-viewport"
          className="fixed top-4 end-4 z-[60] flex w-80 max-w-[calc(100dvw-2rem)] flex-col gap-2 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
