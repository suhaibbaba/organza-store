import { useCallback, useEffect, useId, useState, type JSX, type ReactNode } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Button } from "@ui/components/button";
import { Icon } from "@ui/components/icon";
import { Modal } from "@ui/components/modal";
import { Switch } from "@ui/components/switch";
import { Textarea } from "@ui/components/textarea";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface ConfirmDialogProps extends TestIdProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly titleValues?: Record<string, string | number> | undefined;
  readonly consequences?: readonly ReactNode[] | undefined;
  readonly confirmLabel?: string | undefined;
  readonly tone?: "danger" | "primary" | undefined;
  readonly toggle?: { readonly label: string } | undefined;
  readonly note?: { readonly label: string; readonly placeholder?: string } | undefined;
  readonly onConfirm: (choice: {
    readonly toggled: boolean;
    readonly note: string;
  }) => Promise<void>;
}

const NOTE_MIN = 3;

const NOTE_MAX = 500;

const HOLD_SECONDS = 3;

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  titleValues,
  consequences,
  confirmLabel,
  tone = "danger",
  toggle,
  note,
  onConfirm,
  "data-testid": testId = "confirm-dialog",
}: ConfirmDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [written, setWritten] = useState("");
  const [holding, setHolding] = useState(HOLD_SECONDS);
  const noteId = useId();
  const consequencesId = useId();
  const ready = holding === 0 && (note === undefined || written.trim().length >= NOTE_MIN);

  useEffect(() => {
    if (open) {
      setToggled(false);
      setWritten("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const until = Date.now() + HOLD_SECONDS * 1000;
    setHolding(HOLD_SECONDS);

    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));

      setHolding(left);
      if (left === 0) {
        clearInterval(tick);
      }
    }, 250);

    return () => clearInterval(tick);
  }, [open]);

  const hasConsequences = consequences !== undefined && consequences.length > 0;

  const confirm = async (): Promise<void> => {
    if (busy || !ready) {
      return;
    }

    setBusy(true);

    try {
      await onConfirm({ toggled, note: written.trim() });
      onOpenChange(false);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      data-testid={testId}
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      title={title}
      titleValues={titleValues}
      role="alertdialog"
      describedBy={hasConsequences ? consequencesId : undefined}
      onEnter={() => void confirm()}
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Icon name="x" />}
            {...testid(testId, "cancel")}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("ui.common.cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            icon={<Icon name={tone === "danger" ? "trash" : "check"} />}
            {...testid(testId, "confirm")}
            isLoading={busy}
            disabled={!ready}
            aria-keyshortcuts="Enter"
            onClick={() => void confirm()}
          >
            {t(confirmLabel ?? (tone === "danger" ? "ui.common.deleteForever" : "ui.common.confirm"))}
            {holding > 0 && (
              <span {...testid(testId, "hold")} aria-hidden className="tabular-nums">
                {holding}
              </span>
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {hasConsequences && (
          <ul
            id={consequencesId}
            {...testid(testId, "consequences")}
            className="flex flex-col gap-1.5"
          >
            {consequences.map((line, index) => (
              <li key={index} className="flex items-start gap-2 text-value text-ink-muted">
                <Icon
                  name={tone === "danger" ? "alert" : "info"}
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    tone === "danger" ? "text-danger-600" : "text-primary-600",
                  )}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
        {note !== undefined && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteId} className="text-label font-medium text-ink">
              {t(note.label)}
            </label>
            <Textarea
              id={noteId}
              {...testid(testId, "note")}
              rows={3}
              required
              maxLength={NOTE_MAX}
              disabled={busy}
              {...(note.placeholder !== undefined && { placeholder: t(note.placeholder) })}
              value={written}
              onChange={(event) => setWritten(event.target.value)}
            />
          </div>
        )}
        {toggle !== undefined && (
          <Switch
            {...testid(testId, "toggle")}
            checked={toggled}
            onCheckedChange={setToggled}
            disabled={busy}
            label={t(toggle.label)}
          />
        )}
      </div>
    </Modal>
  );
}

export type ConfirmRequest = Pick<
  ConfirmDialogProps,
  | "title"
  | "titleValues"
  | "consequences"
  | "confirmLabel"
  | "tone"
  | "toggle"
  | "note"
  | "onConfirm"
>;

export function useConfirm(testId?: string): {
  readonly confirm: (request: ConfirmRequest) => void;
  readonly dialog: JSX.Element;
} {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);

  return {
    confirm,
    dialog: (
      <ConfirmDialog
        {...(testId !== undefined && { "data-testid": testId })}
        open={request !== null}
        onOpenChange={(open) => !open && setRequest(null)}
        title={request?.title ?? ""}
        titleValues={request?.titleValues}
        consequences={request?.consequences}
        confirmLabel={request?.confirmLabel}
        tone={request?.tone}
        toggle={request?.toggle}
        note={request?.note}
        onConfirm={request?.onConfirm ?? (async () => undefined)}
      />
    ),
  };
}
