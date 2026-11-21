import { format } from "date-fns";
import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Button } from "@ui/components/button";
import { Calendar } from "@ui/components/calendar";
import { fromIsoDate, toIsoDate } from "@ui/components/date-picker";
import { FieldDivider, fieldShell } from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { openOnArrowDown, usePickerOpen } from "@ui/lib/picker-open";
import { Popover } from "@ui/components/popover";
import { cn } from "@ui/lib/cn";
import { Ltr } from "@ui/components/ltr";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface DateRangePickerProps extends TestIdProps {
  readonly id: string;
  readonly value: DateRange;
  readonly onChange: (value: DateRange) => void;
  readonly label: string;
  readonly className?: string | undefined;
}

export function DateRangePicker({
  id,
  value,
  onChange,
  label,
  className,
  "data-testid": testId,
}: DateRangePickerProps): JSX.Element {
  const { t } = useTranslation();
  const picker = usePickerOpen();
  const id_ = testId ?? id;
  const part = parts("date-range-picker", id_);

  const from = fromIsoDate(value.from);
  const to = fromIsoDate(value.to);
  const dates = [from ? format(from, "dd/MM/yyyy") : "…", to ? format(to, "dd/MM/yyyy") : "…"].join(" — ");

  return (
    <Popover
      open={picker.open}
      onOpenChange={picker.onOpenChange}
      focusOnOpen={picker.focusOnOpen}
      title={label}
      {...part("popover")}
      anchor={
        <button
          {...part()}
          id={id}
          type="button"
          aria-label={label}
          {...picker.opens(true)}
          onKeyDown={openOnArrowDown(picker.show)}
          className={cn(
            fieldShell({}),
            "cursor-pointer text-start text-field focus-visible:outline-none",
            from || to ? "text-ink" : "text-ink-subtle",
            className,
          )}
        >
          <span {...part("value")} className="min-w-0 flex-1 truncate">
            {from || to ? (
              <Ltr className="truncate align-top tabular-nums">{dates}</Ltr>
            ) : (
              t("ui.common.placeholders.dateRange")
            )}
          </span>
          <FieldDivider />
          <Icon name="calendar" className="size-4 shrink-0 text-ink-faint" />
        </button>
      }
    >
      <Calendar
        mode="range"
        selected={from ? { from, ...(to && { to }) } : undefined}
        defaultMonth={from ?? to ?? new Date()}
        onSelect={(range) => {
          onChange({
            from: range?.from ? toIsoDate(range.from) : "",
            to: range?.to ? toIsoDate(range.to) : "",
          });
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
            onChange({ from: "", to: "" });
            picker.onOpenChange(false);
          }}
        >
          {t("ui.common.clear")}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          icon={<Icon name="check" />}
          {...testid(id_, "done")}
          onClick={() => picker.onOpenChange(false)}
        >
          {t("ui.common.done")}
        </Button>
      </div>
    </Popover>
  );
}
