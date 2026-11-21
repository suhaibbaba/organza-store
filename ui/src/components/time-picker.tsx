import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import {
  FIELD_BUTTON,
  FIELD_TEXT,
  FieldDivider,
  FieldLock,
  fieldShell,
} from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { openOnArrowDown, usePickerOpen } from "@ui/lib/picker-open";
import { Popover } from "@ui/components/popover";
import { cn } from "@ui/lib/cn";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function to12Hour(value: string): string {
  const match = TIME.exec(value);
  if (!match) {
    return value;
  }

  const hour = Number(match[1]);
  const period = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12}:${match[2]} ${period}`;
}

export function timeSlots(from = "00:00", to = "23:45", stepMinutes = 15): readonly string[] {
  const minutes = (value: string): number => {
    const [h = "0", m = "0"] = value.split(":");
    return Number(h) * 60 + Number(m);
  };

  const start = minutes(from);
  const end = minutes(to);
  const slots: string[] = [];

  for (let at = start; at <= end; at += stepMinutes) {
    const h = String(Math.floor(at / 60)).padStart(2, "0");
    const m = String(at % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
  }

  return slots;
}

function scrollToCurrent(list: HTMLUListElement | null): void {
  const current = list?.querySelector<HTMLElement>("[aria-current]");
  if (list && current) {
    list.scrollTop = current.offsetTop - (list.clientHeight - current.offsetHeight) / 2;
  }
}

export interface TimePickerProps extends TestIdProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly stepMinutes?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

export function TimePicker({
  id,
  value,
  onChange,
  label,
  min,
  max,
  stepMinutes = 15,
  disabled = false,
  hasError = false,
  className,
  "data-testid": testId,
}: TimePickerProps): JSX.Element {
  const { t } = useTranslation();
  const picker = usePickerOpen();
  const part = parts("time-picker", testId ?? id);
  const slots = timeSlots(min ?? "00:00", max ?? "23:45", stepMinutes);

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      {...part("popover")}
      anchor={
        <button
          type="button"
          id={id}
          {...part()}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={picker.open}
          aria-invalid={hasError || undefined}
          {...picker.opens(true)}
          onKeyDown={openOnArrowDown(picker.show)}
          className={cn(
            fieldShell({ hasError, disabled }),
            "cursor-pointer disabled:cursor-not-allowed",
            className,
          )}
        >
          <span
            {...part("value")}
            dir={value === "" ? undefined : "ltr"}
            className={cn(
              FIELD_TEXT,
              "self-center page-rtl:text-right page-ltr:text-left tabular-nums",
              value === "" && "text-ink-subtle",
            )}
          >
            {value === "" ? t("ui.common.placeholders.time") : to12Hour(value)}
          </span>

          {disabled ? (
            <FieldLock {...part("lock")} />
          ) : (
            <>
              <FieldDivider />
              <span {...part("icon")} aria-hidden="true" className={FIELD_BUTTON}>
                <Icon name="clock" className="size-4" />
              </span>
            </>
          )}
        </button>
      }
    >
      <ul
        {...part("list")}
        ref={scrollToCurrent}
        aria-label={label}
        className="relative max-h-64 w-full min-w-40 overflow-y-auto md:max-h-72"
      >
        {slots.map((slot) => (
          <li key={slot}>
            <button
              type="button"
              data-part="time-picker-slot"
              {...testid(testId ?? id, `slot-${slot}`)}
              onClick={() => {
                onChange(slot);
                picker.onOpenChange(false);
              }}
              aria-current={slot === value || undefined}
              dir="ltr"
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-control px-3 py-2",
                "text-start text-value tabular-nums transition-colors duration-150",
                slot === value
                  ? "bg-primary-600 text-ink-inverse focus-visible:bg-primary-900"
                  : "text-ink hover:bg-inset focus-visible:bg-neutral-300",
              )}
            >
              {to12Hour(slot)}
              {slot === value && <Icon name="check" className="size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
