import { EARLIEST_YEAR, LATEST_YEAR, foldDigits } from "@ui/lib/support";
import { format, isValid, parse } from "date-fns";
import { useState, type JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Button } from "@ui/components/button";
import { Calendar, dateLocale } from "@ui/components/calendar";
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

const ISO = "yyyy-MM-dd";
const TYPED = "dd/MM/yyyy";
const FIRST_DAY = `${EARLIEST_YEAR}-01-01`;
const LAST_DAY = `${LATEST_YEAR}-12-31`;

export const toIsoDate = (date: Date): string => format(date, ISO);

export function parseTypedDate(value: string): Date | null {
  const parsed = parse(value, TYPED, new Date());

  return isValid(parsed) && format(parsed, TYPED) === value ? parsed : null;
}

export function fromIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, ISO, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export interface DatePickerProps extends TestIdProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  readonly min?: string | undefined;
  readonly max?: string | undefined;
  readonly hasError?: boolean | undefined;
  readonly className?: string | undefined;
}

export function DatePicker({
  id,
  value,
  onChange,
  label,
  disabled = false,
  min,
  max,
  hasError = false,
  className,
  "data-testid": testId,
}: DatePickerProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const picker = usePickerOpen();
  const id_ = testId ?? id;
  const part = parts("date-picker", id_);
  const selected = fromIsoDate(value);
  const lowest = min !== undefined && min > FIRST_DAY ? min : FIRST_DAY;
  const highest = max !== undefined && max < LAST_DAY ? max : LAST_DAY;
  const earliest = fromIsoDate(lowest);
  const latest = fromIsoDate(highest);
  const [typed, setTyped] = useState(() => (selected ? format(selected, TYPED) : value));

  const valueOf = (text: string): string => {
    const parsed = text.trim() === "" ? null : parseTypedDate(text);

    return text.trim() === "" ? "" : parsed ? toIsoDate(parsed) : text;
  };

  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);

    if (value !== valueOf(typed)) {
      setTyped(selected ? format(selected, TYPED) : value);
    }
  }

  const committed = valueOf(typed);
  const outOfRange = committed !== "" && (!selected || value < lowest || value > highest);

  const commit = (text: string): void => {
    setTyped(text);
    onChange(valueOf(text));
  };

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      {...part("popover")}
      anchor={
        <div
          {...part()}
          className={cn(fieldShell({ hasError: hasError || outOfRange, disabled }), className)}
        >
          <input
            id={id}
            {...part("input")}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={hasError || outOfRange || undefined}
            placeholder={t("ui.common.placeholders.date")}
            value={typed}
            onChange={(event) => commit(foldDigits(event.target.value).replace(/[^\d/]/g, ""))}
            {...picker.opens(false)}
            onKeyDown={openOnArrowDown(picker.show)}
            className={cn(FIELD_TEXT, "page-rtl:text-right page-ltr:text-left", "tabular-nums")}
          />

          {disabled ? (
            <FieldLock {...part("lock")} />
          ) : (
            <>
              <FieldDivider />
              <button
                type="button"
                {...part("trigger")}
                aria-label={t("ui.common.openCalendar")}
                {...picker.opens(true)}
                className={FIELD_BUTTON}
              >
                <Icon name="calendar" className="size-4" />
              </button>
            </>
          )}
        </div>
      }
    >
      <Calendar
        mode="single"
        {...(selected && { selected, defaultMonth: selected })}
        disabled={[
          ...(earliest ? [{ before: earliest }] : []),
          ...(latest ? [{ after: latest }] : []),
        ]}
        {...(earliest && { startMonth: earliest })}
        {...(latest && { endMonth: latest })}
        onSelect={(date: Date | undefined) => {
          if (date) {
            onChange(toIsoDate(date));
            picker.onOpenChange(false);
          }
        }}
      />

      <div
        data-part="picker-footer"
        {...testid(id_, "footer")}
        className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2"
      >
        <Button
          size="sm"
          variant="quiet"
          icon={<Icon name="x" />}
          {...testid(id_, "clear")}
          onClick={() => {
            onChange("");
            picker.onOpenChange(false);
          }}
        >
          {t("ui.common.clear")}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="calendar" />}
          {...testid(id_, "today")}
          onClick={() => {
            onChange(toIsoDate(new Date()));
            picker.onOpenChange(false);
          }}
        >
          {t("ui.common.today")}
        </Button>
      </div>

      <p className="sr-only">
        {selected ? format(selected, "PPP", { locale: dateLocale(i18n.language) }) : ""}
      </p>
    </Popover>
  );
}
