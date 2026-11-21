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
import { Icon } from "@ui/components/icon";
import { NOTICE_TONES, type NoticeTone } from "@ui/components/tone";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";

type ToastTone = "success" | "warning" | "error" | "info" | "neutral";

const TONES: Record<ToastTone, NoticeTone> = {
  error: NOTICE_TONES.danger,
  warning: NOTICE_TONES.warning,
  success: NOTICE_TONES.success,
  info: NOTICE_TONES.info,
  neutral: NOTICE_TONES.neutral,
};

// Errors stay until dismissed; Infinity is Radix's "never auto-close".
const TOAST_DURATION_MS: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  neutral: 5000,
  warning: 7000,
  error: Infinity,
};

const TOAST_WITH_ACTION_MS = 6000;

function toastDuration(tone: ToastTone, hasAction: boolean): number {
  return hasAction ? Math.max(TOAST_DURATION_MS[tone], TOAST_WITH_ACTION_MS) : TOAST_DURATION_MS[tone];
}

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
      info: (messageKey, values, description, action) =>
        push(messageKey, "info", values, description, action),
      neutral: (messageKey, values, description, action) =>
        push(messageKey, "neutral", values, description, action),
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
        duration={TOAST_DURATION_MS.success}
      >
        {children}

        {messages.map((message) => {
          const tone = TONES[message.tone];
          const compact = message.descriptionKey === undefined && !message.action;

          return (
            <ToastPrimitive.Root
              key={message.id}
              data-part="toast"
              data-testid="toast"
              data-tone={message.tone}
              open
              type={message.tone === "error" ? "foreground" : "background"}
              duration={toastDuration(message.tone, message.action !== undefined)}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(message.id);
                }
              }}
              className={cn(
                "flex rounded-toast shadow-toast",
                compact ? "items-center gap-3 p-4" : "items-start gap-5 p-4 sm:px-6 sm:py-5",
                tone.surface,
                "data-[state=open]:animate-[toast-in_200ms_ease-out]",
                "data-[state=closed]:animate-[toast-out_150ms_ease-in]",
                "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
              )}
            >
              <span
                data-part="toast-chip"
                data-testid="toast-chip"
                aria-hidden="true"
                className={cn("flex shrink-0 items-center", !compact && "h-6 sm:h-[27px]", tone.icon)}
              >
                <Icon name={tone.glyph} className={cn("[stroke-width:2]", compact ? "size-5" : "size-6")} />
              </span>

              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title
                  data-part="toast-title"
                  data-testid="toast-title"
                  className={cn(
                    compact
                      ? "text-sm leading-[1.5] font-medium"
                      : "text-base leading-[1.5] font-semibold sm:text-lg sm:leading-[1.5]",
                    tone.title,
                  )}
                >
                  {t(message.messageKey, message.values ?? {})}
                </ToastPrimitive.Title>

                {message.descriptionKey !== undefined && (
                  <ToastPrimitive.Description
                    data-part="toast-message"
                    data-testid="toast-message"
                    className={cn("mt-1.5 text-sm leading-[1.5] font-normal sm:text-[15px]", tone.text)}
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
                      "mt-1.5 inline-flex min-h-(--control-h-sm) cursor-pointer items-center rounded-chip",
                      "text-sm font-semibold underline underline-offset-4 sm:text-[15px]",
                      "transition-colors hover:bg-white/10 focus-visible:bg-black/30",
                      tone.title,
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
                  "-me-1 inline-grid size-(--control-h-sm) shrink-0 cursor-pointer place-items-center",
                  !compact && "sm:mt-px",
                  "rounded-control transition-colors duration-[250ms] ease-in-out",
                  "hover:bg-white/10 focus-visible:bg-black/30",
                  tone.text,
                )}
              >
                <Icon name="x" className="size-5 [stroke-width:2]" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}

        <ToastPrimitive.Viewport
          data-part="toast-viewport"
          data-testid="toast-viewport"
          className="fixed top-4 end-4 z-[60] flex w-[calc(100vw-2rem)] max-w-[480px] flex-col gap-3 outline-none"
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
