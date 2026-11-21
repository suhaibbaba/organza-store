import {
  addMonths,
  addYears,
  endOfYear,
  format,
  max as latestOf,
  min as earliestOf,
  setMonth,
  setYear,
  startOfMonth,
} from "date-fns";
import { isRtlLanguage } from "@ui/lib/support";
import { ar, enGB, tr, type Locale } from "date-fns/locale";
import { useEffect, useRef, useState, type JSX, type ReactNode } from "react";
import { DayPicker, type DayButtonProps, type DayPickerProps, type Modifiers } from "react-day-picker";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { useLocaleFormat } from "@ui/components/locale-format";
import { cn } from "@ui/lib/cn";

const DATE_LOCALES: Readonly<Record<string, Locale>> = { ar, en: enGB, tr };

export function dateLocale(language: string): Locale {
  return DATE_LOCALES[language.split("-")[0] ?? ""] ?? enGB;
}

const FIRST_YEAR = 1900;

type CalendarView = "days" | "months" | "years";

interface DayState {
  readonly cell?: string;
  readonly button: string;
}

const DAY_STATES = {
  plain: { button: "text-ink hover:bg-inset focus-visible:bg-neutral-300" },
  outside: { button: "text-ink-subtle hover:bg-inset focus-visible:bg-neutral-300 focus-visible:text-ink" },
  disabled: {
    button: "cursor-not-allowed text-ink-faint line-through decoration-ink-faint focus-visible:bg-neutral-200",
  },
  today: {
    button:
      "border-[1.5px] border-success-600 text-success-800 hover:bg-success-50 focus-visible:bg-success-100 focus-visible:text-success-900",
  },
  selected: { button: "bg-primary-600 text-ink-inverse hover:bg-primary-700 focus-visible:bg-primary-900" },
  todaySelected: {
    button: cn(
      "bg-linear-to-br from-success-700 to-success-900 text-ink-inverse",
      "hover:from-success-800 hover:to-success-900 focus-darken",
    ),
  },
  rangeMiddle: {
    cell: "bg-selected",
    button: "text-ink hover:bg-primary-200 focus-visible:bg-primary-300 focus-visible:text-primary-900",
  },
} satisfies Record<string, DayState>;

const TODAY_DOT = cn(
  "after:absolute after:inset-x-0 after:bottom-1 after:mx-auto",
  'after:size-1 after:rounded-pill after:content-[""]',
);

function rangeRounding(isStart: boolean, isEnd: boolean): string {
  if (isStart === isEnd) {
    return "rounded-control";
  }

  return isStart ? "rounded-s-control" : "rounded-e-control";
}

function dayInk(modifiers: Modifiers): string {
  const isToday = modifiers["today"] === true;

  if (modifiers["disabled"] === true) {
    return cn(DAY_STATES.disabled.button, "rounded-control");
  }

  if (modifiers["range_middle"] === true) {
    return cn(DAY_STATES.rangeMiddle.button, isToday && cn(TODAY_DOT, "after:bg-success-600"));
  }

  if (modifiers["selected"] === true) {
    return cn(
      isToday ? DAY_STATES.todaySelected.button : DAY_STATES.selected.button,
      rangeRounding(modifiers["range_start"] === true, modifiers["range_end"] === true),
    );
  }

  if (isToday) {
    return cn(DAY_STATES.today.button, "rounded-control");
  }

  return cn(modifiers["outside"] === true ? DAY_STATES.outside.button : DAY_STATES.plain.button, "rounded-control");
}

function CalendarDayButton({ day, modifiers, className, ...props }: DayButtonProps): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const isFocused = modifiers["focused"] === true;

  useEffect(() => {
    if (isFocused) {
      ref.current?.focus();
    }
  }, [isFocused]);

  return (
    <button
      ref={ref}
      data-part="day-cell"
      data-testid={`calendar-day-${format(day.date, "yyyy-MM-dd")}`}
      {...(modifiers["selected"] === true
        ? { "data-initial-focus": "selected" }
        : modifiers["today"] === true && { "data-initial-focus": "today" })}
      {...props}
      className={cn(className, dayInk(modifiers))}
    />
  );
}

const NAV_BUTTON = cn(
  "inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center rounded-control",
  "text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink",
  "focus-visible:bg-neutral-300 focus-visible:text-ink",
  "disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:bg-transparent",
);

const CAPTION_BUTTON = cn(
  "inline-flex h-(--control-h-sm) cursor-pointer items-center gap-2 rounded-control px-3",
  "text-value font-medium text-ink transition-colors duration-150 hover:bg-inset focus-visible:bg-neutral-300",
);

const PERIOD_CELL = cn(
  "inline-flex h-(--control-h) w-full cursor-pointer items-center justify-center rounded-pill",
  "text-value tabular-nums transition-colors duration-150",
);

interface CalendarHeaderProps {
  readonly label: ReactNode;
  readonly zoomOut: { readonly label: string; readonly onClick: () => void } | null;
  readonly previous?: CalendarStep | undefined;
  readonly next?: CalendarStep | undefined;
}

interface CalendarStep {
  readonly label: string;
  readonly onClick: () => void;
  readonly can: boolean;
}

const NAV_SPACER = <span aria-hidden="true" className="size-(--control-h-sm) shrink-0" />;

function CalendarHeader({ label, zoomOut, previous, next }: CalendarHeaderProps): JSX.Element {
  return (
    <div
      data-part="calendar-header"
      data-testid="calendar-header"
      className="flex h-(--control-h-sm) items-center justify-between gap-2"
    >
      {previous ? (
        <button
          type="button"
          data-part="calendar-previous"
          data-testid="calendar-previous"
          aria-label={previous.label}
          disabled={!previous.can}
          onClick={previous.onClick}
          className={NAV_BUTTON}
        >
          <Icon name="chevron-start" className="size-4" />
        </button>
      ) : (
        NAV_SPACER
      )}

      {zoomOut ? (
        <button
          type="button"
          data-part="calendar-caption"
          data-testid="calendar-caption"
          aria-label={zoomOut.label}
          onClick={zoomOut.onClick}
          className={CAPTION_BUTTON}
        >
          {label}
          <Icon name="chevron-down" className="size-4 text-ink-subtle" />
        </button>
      ) : (
        <span data-part="calendar-caption" data-testid="calendar-caption" className="text-value font-medium text-ink">
          {label}
        </span>
      )}

      {next ? (
        <button
          type="button"
          data-part="calendar-next"
          data-testid="calendar-next"
          aria-label={next.label}
          disabled={!next.can}
          onClick={next.onClick}
          className={NAV_BUTTON}
        >
          <Icon name="chevron-end" className="size-4" />
        </button>
      ) : (
        NAV_SPACER
      )}
    </div>
  );
}

interface PeriodOption {
  readonly key: number;
  readonly label: string;
  readonly isSelected: boolean;
  readonly isCurrent: boolean;
  readonly isDisabled?: boolean | undefined;
}

function periodInk(option: PeriodOption): string {
  if (option.isDisabled === true) {
    return DAY_STATES.disabled.button;
  }

  if (option.isSelected) {
    return cn(option.isCurrent ? DAY_STATES.todaySelected.button : DAY_STATES.selected.button, "font-medium");
  }

  return option.isCurrent ? DAY_STATES.today.button : DAY_STATES.plain.button;
}

interface PeriodGridProps {
  readonly label: string;
  readonly columns: 3 | 4;
  readonly options: readonly PeriodOption[];
  readonly onPick: (key: number) => void;
  readonly scrolls?: boolean | undefined;
}

function PeriodGrid({ label, columns, options, onPick, scrolls = false }: PeriodGridProps): JSX.Element {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = list.current;
    const chosen = container?.querySelector<HTMLElement>('[aria-current="true"]');

    if (scrolls && container && chosen) {
      container.scrollTop = chosen.offsetTop - (container.clientHeight - chosen.clientHeight) / 2;
    }
  }, [scrolls]);

  return (
    <div
      ref={list}
      data-part="calendar-periods"
      data-testid="calendar-periods"
      role="group"
      aria-label={label}
      className={cn(
        "relative mt-3 grid gap-x-2 gap-y-2.5",
        columns === 3 ? "grid-cols-3" : "grid-cols-4",
        scrolls && "scroll-lane max-h-60 overflow-y-auto overscroll-contain py-1 pe-2.5",
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          data-part="calendar-period"
          data-testid={`calendar-period-${String(option.key)}`}
          aria-current={option.isSelected ? "true" : undefined}
          aria-disabled={option.isDisabled === true || undefined}
          onClick={() => option.isDisabled !== true && onPick(option.key)}
          className={cn(PERIOD_CELL, periodInk(option))}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Calendar(props: DayPickerProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const isRtl = isRtlLanguage(i18n.language);
  const { weekStartsOn } = useLocaleFormat();

  const lastYear = new Date().getFullYear() + 1;
  const firstMonth = startOfMonth(props.startMonth ?? new Date(FIRST_YEAR, 0, 1));
  const lastMonth = startOfMonth(props.endMonth ?? endOfYear(new Date(lastYear, 0, 1)));
  const within = (date: Date): Date => latestOf([firstMonth, earliestOf([lastMonth, startOfMonth(date)])]);

  const [view, setView] = useState<CalendarView>("days");
  const [shown, setShown] = useState(() => startOfMonth(props.month ?? props.defaultMonth ?? new Date()));
  const month = within(shown);
  const goToMonth = (date: Date): void => setShown(within(date));

  const shownOn = (props.month ?? props.defaultMonth)?.getTime();

  useEffect(() => {
    if (shownOn !== undefined) {
      setShown(startOfMonth(new Date(shownOn)));
    }
  }, [shownOn]);

  const year = month.getFullYear();
  const firstYear = firstMonth.getFullYear();
  const finalYear = lastMonth.getFullYear();

  const body =
    view === "days" ? (
      <DayPicker
        showOutsideDays
        {...props}
        month={month}
        onMonthChange={goToMonth}
        hideNavigation
        locale={locale}
        {...(weekStartsOn !== undefined && { weekStartsOn })}
        dir={isRtl ? "rtl" : "ltr"}
        components={{ DayButton: CalendarDayButton }}
        formatters={{
          formatDay: (date: Date) => String(date.getDate()),
          formatWeekdayName: (date: Date) => format(date, "EEEEEE", { locale }),
        }}
        classNames={{
          root: "text-value text-ink",
          month: "w-full",
          month_caption: "hidden",
          month_grid: "w-full border-collapse",
          weekdays: "flex",
          weekday: "flex-1 pt-2 pb-1 text-micro font-medium text-ink-subtle",
          week: "flex w-full",
          day: "flex flex-1 justify-center p-0.5",
          day_button: cn(
            "relative inline-flex size-(--control-h-sm) cursor-pointer items-center justify-center",
            "text-value tabular-nums transition-colors duration-150",
          ),
          selected: "",
          today: "",
          outside: "",
          disabled: "",
          range_start: cn(DAY_STATES.rangeMiddle.cell, "rounded-s-chip"),
          range_end: cn(DAY_STATES.rangeMiddle.cell, "rounded-e-chip"),
          range_middle: DAY_STATES.rangeMiddle.cell,
          hidden: "invisible",
        }}
      />
    ) : view === "months" ? (
      <PeriodGrid
        label={t("ui.common.calendar.chooseMonth")}
        columns={3}
        options={Array.from({ length: 12 }, (_, index) => ({
          key: index,
          label: format(setMonth(month, index), "LLL", { locale }),
          isSelected: month.getMonth() === index,
          isCurrent: new Date().getFullYear() === year && new Date().getMonth() === index,
          isDisabled: setMonth(month, index) < firstMonth || setMonth(month, index) > lastMonth,
        }))}
        onPick={(index) => {
          goToMonth(startOfMonth(setMonth(month, index)));
          setView("days");
        }}
      />
    ) : (
      <PeriodGrid
        label={t("ui.common.calendar.chooseYear")}
        columns={4}
        scrolls
        options={Array.from({ length: finalYear - firstYear + 1 }, (_, index) => {
          const value = firstYear + index;

          return {
            key: value,
            label: String(value),
            isSelected: value === year,
            isCurrent: value === new Date().getFullYear(),
          };
        })}
        onPick={(value) => {
          goToMonth(startOfMonth(setYear(month, value)));
          setView("months");
        }}
      />
    );

  const header: CalendarHeaderProps =
    view === "days"
      ? {
          label: `${format(month, "LLLL", { locale })} ${year}`,
          zoomOut: { label: t("ui.common.calendar.chooseMonth"), onClick: () => setView("months") },
          previous: {
            label: t("ui.common.calendar.previousMonth"),
            onClick: () => goToMonth(addMonths(month, -1)),
            can: month > firstMonth,
          },
          next: {
            label: t("ui.common.calendar.nextMonth"),
            onClick: () => goToMonth(addMonths(month, 1)),
            can: month < lastMonth,
          },
        }
      : view === "months"
        ? {
            label: String(year),
            zoomOut: { label: t("ui.common.calendar.chooseYear"), onClick: () => setView("years") },
            previous: {
              label: t("ui.common.calendar.previousYear"),
              onClick: () => goToMonth(addYears(month, -1)),
              can: year > firstYear,
            },
            next: {
              label: t("ui.common.calendar.nextYear"),
              onClick: () => goToMonth(addYears(month, 1)),
              can: year < finalYear,
            },
          }
        : { label: t("ui.common.calendar.chooseYear"), zoomOut: null };

  return (
    <div data-part="calendar" data-testid="calendar" className="w-70">
      <CalendarHeader {...header} />
      {body}
    </div>
  );
}
