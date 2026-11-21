import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  useId,
  useState,
  type ChangeEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useTranslation } from "@ui/lib/i18n";
import { useDialogLayer } from "@ui/components/dialog-layer";
import { FieldLock, fieldShell } from "@ui/components/field";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, testid, type TestIdProps } from "@ui/lib/testid";
import { documentDirection } from "@ui/lib/direction";
import { useMediaQuery } from "@ui/lib/use-media-query";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode | undefined;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value">, TestIdProps {
  options: readonly SelectOption[];
  placeholder?: string | undefined;
  value?: string | undefined;
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
  onBlur?: (() => void) | undefined;
  hasError?: boolean | undefined;
  renderValue?: ((option: SelectOption) => ReactNode) | undefined;
  listClassName?: string | undefined;
  searchable?: boolean | undefined;
  bare?: boolean | undefined;
  onCreate?: ((text: string) => void) | undefined;
}

const NONE = "__none__";

export function Select(props: SelectProps): JSX.Element {
  return props.searchable === true ? <SearchableSelect {...props} /> : <PlainSelect {...props} />;
}

function PlainSelect({
  options,
  placeholder,
  className,
  hasError = false,
  value,
  onChange,
  disabled = false,
  onBlur,
  id,
  required,
  renderValue,
  listClassName,
  bare = false,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "data-testid": testId,
}: SelectProps): JSX.Element {
  const part = parts("select", testId);
  const dialogLayer = useDialogLayer();
  const finePointer = useMediaQuery("(pointer: fine)");
  const empty = value === "" || value === undefined;
  const shown =
    renderValue && !empty ? options.find((option) => option.value === value) : undefined;

  const emit = (next: string): void => {
    const chosen = next === NONE ? "" : next;

    onChange?.({
      target: { value: chosen },
      currentTarget: { value: chosen },
    } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <SelectPrimitive.Root
      dir={documentDirection()}
      value={empty ? NONE : value}
      onValueChange={emit}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        {...part()}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        className={cn(
          bare
            ? "flex shrink-0 items-center gap-1.5 self-stretch rounded-control bg-transparent focus-visible:bg-neutral-200"
            : fieldShell({ hasError, disabled }),
          "cursor-pointer text-start text-field",
          "focus-visible:outline-none",
          disabled && "cursor-not-allowed text-ink-faint",
          className,
        )}
      >
        <span
          {...part("value")}
          className={cn(
            "min-w-0 flex-1 truncate [unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left",
            disabled ? "text-ink-faint" : empty ? "text-ink-subtle" : "text-ink",
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder}>
            {shown && renderValue?.(shown)}
          </SelectPrimitive.Value>
        </span>

        {disabled ? (
          !bare && <FieldLock {...testid(testId, "lock")} />
        ) : (
          <SelectPrimitive.Icon asChild>
            <Icon
              name="chevron-down"
              {...part("chevron")}
              className={cn(
                "size-4 shrink-0 transition-colors duration-150",
                hasError ? "text-danger-600" : "text-ink-faint",
              )}
            />
          </SelectPrimitive.Icon>
        )}
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <SelectPrimitive.Content
          {...part("list")}
          position="popper"
          sideOffset={6}
          className={cn(
            "z-50 max-h-[min(24rem,var(--radix-select-content-available-height))]",
            "w-[var(--radix-select-trigger-width)] overflow-hidden rounded-panel border border-line bg-surface p-1 shadow-float",
            "origin-(--radix-select-content-transform-origin)",
            listClassName,
            "data-[state=open]:animate-[menu-in_150ms_ease-out]",
            "data-[state=closed]:animate-[menu-out_150ms_ease-in]",
          )}
        >
          {finePointer && (
            <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ink-subtle">
              <Icon name="chevron-up" className="size-4" />
            </SelectPrimitive.ScrollUpButton>
          )}

          <SelectPrimitive.Viewport className="overscroll-contain">
            {placeholder !== undefined && (
              <Row value={NONE} label={placeholder} muted testId={testId} />
            )}

            {options.map((option) => (
              <Row
                key={option.value}
                value={option.value}
                label={option.label}
                icon={option.icon}
                testId={testId}
              />
            ))}
          </SelectPrimitive.Viewport>

          {finePointer && (
            <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ink-subtle">
              <Icon name="chevron-down" className="size-4" />
            </SelectPrimitive.ScrollDownButton>
          )}
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Row({
  value,
  label,
  icon,
  muted = false,
  testId,
}: {
  readonly value: string;
  readonly label: string;
  readonly icon?: ReactNode | undefined;
  readonly muted?: boolean | undefined;
  readonly testId?: string | undefined;
}): JSX.Element {
  return (
    <SelectPrimitive.Item
      value={value}
      data-part="select-option"
      {...testid(testId, `option-${value}`)}
      className={cn(
        "flex min-h-(--control-h) cursor-pointer items-center justify-between gap-2 rounded-control",
        "lg:min-h-(--control-h-sm) px-3 py-2 text-start text-field outline-none select-none",
        "transition-colors duration-150",
        "data-[highlighted]:bg-primary-100 data-[highlighted]:text-primary-900 data-[state=checked]:font-medium",
        muted ? "text-ink-subtle" : "text-ink",
      )}
    >
      <SelectPrimitive.ItemText>
        {icon === undefined ? (
          label
        ) : (
          <span className="inline-flex items-center gap-2">
            {icon}
            {label}
          </span>
        )}
      </SelectPrimitive.ItemText>

      <SelectPrimitive.ItemIndicator asChild>
        <Icon
          name="check"
          data-part="select-tick"
          {...testid(testId, `option-${value}-tick`)}
          className="size-4 shrink-0 text-primary-600"
        />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SearchableSelect({
  options,
  placeholder,
  className,
  hasError = false,
  value,
  onChange,
  disabled = false,
  onBlur,
  id,
  required,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "data-testid": testId,
  onCreate,
}: SelectProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("select", testId);
  const dialogLayer = useDialogLayer();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const term = query.trim().toLowerCase();
  const shown = options.filter((option) => option.label.toLowerCase().includes(term));
  const chosen = options.find((option) => option.value === value);
  const rows = shown.length + (onCreate ? 1 : 0);

  const create = (): void => {
    setOpen(false);
    onCreate?.(query.trim());
  };

  const choose = (next: string): void => {
    onChange?.({
      target: { value: next },
      currentTarget: { value: next },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const openList = (): void => {
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (["Enter", " ", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + rows) % Math.max(rows, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = shown[active];
      if (option) choose(option.value);
      else if (onCreate && active === shown.length) create();
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? openList() : setOpen(false))}
    >
      <PopoverPrimitive.Trigger
        id={id}
        type="button"
        role="combobox"
        {...part()}
        disabled={disabled}
        onBlur={onBlur}
        onKeyDown={onTriggerKey}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-invalid={hasError || undefined}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          fieldShell({ hasError, disabled }),
          "cursor-pointer text-start text-field focus-visible:outline-none",
          className,
        )}
      >
        <span
          {...part("value")}
          title={chosen?.label}
          className={cn(
            "min-w-0 flex-1 truncate [unicode-bidi:plaintext] page-rtl:text-right page-ltr:text-left",
            chosen ? "text-ink" : "text-ink-subtle",
          )}
        >
          {chosen?.label ?? placeholder}
        </span>
        {disabled ? (
          <FieldLock {...testid(testId, "lock")} />
        ) : (
          <Icon
            name="chevron-down"
            {...part("chevron")}
            className="size-4 shrink-0 text-ink-faint"
          />
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal {...(dialogLayer && { container: dialogLayer })}>
        <PopoverPrimitive.Content
          {...part("list")}
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col",
            "w-[var(--radix-popover-trigger-width)] rounded-panel border border-line bg-surface p-1 shadow-float",
            "data-[state=open]:animate-[menu-in_150ms_ease-out]",
          )}
        >
          <input
            {...part("search")}
            type="search"
            autoFocus
            dir={documentDirection()}
            value={query}
            aria-label={t("ui.common.search")}
            aria-controls={listId}
            placeholder={t("ui.common.search")}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onSearchKey}
            className="mb-1 h-(--control-h) w-full shrink-0 rounded-control border border-line bg-surface px-3 text-field text-ink outline-none focus:border-primary-600"
          />

          <ul id={listId} role="listbox" className="scroll-lane overflow-y-auto">
            {shown.length === 0 && !onCreate && (
              <li {...part("empty")} className="px-3 py-2 text-label text-ink-subtle">
                {t("ui.common.noMatches")}
              </li>
            )}
            {shown.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                data-part="select-option"
                data-highlighted={index === active ? "" : undefined}
                {...testid(testId, `option-${option.value}`)}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.value)}
                className={cn(
                  "flex min-h-(--control-h) cursor-pointer items-center justify-between gap-2 rounded-control",
                  "lg:min-h-(--control-h-sm) px-3 py-2 text-start text-field text-ink select-none",
                  "transition-colors duration-150 data-[highlighted]:bg-primary-100 data-[highlighted]:text-primary-900",
                  option.value === value && "font-medium",
                )}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  {option.icon}
                  <span className="truncate [unicode-bidi:plaintext]">{option.label}</span>
                </span>
                {option.value === value && (
                  <Icon name="check" className="size-4 shrink-0 text-primary-600" />
                )}
              </li>
            ))}
            {onCreate && (
              <li
                role="option"
                aria-selected={false}
                data-part="select-create"
                data-highlighted={active === shown.length ? "" : undefined}
                {...testid(testId, "create")}
                onMouseEnter={() => setActive(shown.length)}
                onClick={create}
                className={cn(
                  "flex min-h-(--control-h) cursor-pointer items-center gap-2 rounded-control",
                  "lg:min-h-(--control-h-sm) px-3 py-2 text-start text-field font-medium text-primary-700 select-none",
                  "transition-colors duration-150 data-[highlighted]:bg-primary-100 data-[highlighted]:text-primary-900",
                )}
              >
                <Icon name="plus" className="size-4 shrink-0" />
                <span className="truncate">
                  {term === "" ? t("ui.common.addNew") : t("ui.common.addNamed", { name: query.trim() })}
                </span>
              </li>
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
