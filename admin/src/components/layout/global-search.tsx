"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { FileText, ReceiptText, Search, Shirt, UserRound, X, type LucideIcon } from "lucide-react";
import { SearchField, Spinner } from "@store/ui";
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useGlobalSearch } from "@/hooks/use-global-search";
import { ProductImage } from "@/components/products/product-image";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import {
  GLOBAL_SEARCH_COMMAND_KEY,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_SHORTCUT,
  GLOBAL_SEARCH_THUMB_SIZES,
} from "@/constants/search";
import { cn } from "@/lib/utils";
import type { GlobalSearchGroup, GlobalSearchGroupKey, GlobalSearchItem } from "@/types/search";

const GROUP_ICONS: Record<GlobalSearchGroupKey, LucideIcon> = {
  pages: FileText,
  orders: ReceiptText,
  products: Shirt,
  customers: UserRound,
};

const DESKTOP_QUERY = "(min-width: 768px)";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// One box for the whole shop: "/" or ⌘K / Ctrl+K focuses it from anywhere.
export function GlobalSearch() {
  const t = useTranslations("globalSearch");
  const router = useRouter();
  const pathname = usePathname();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [seenPath, setSeenPath] = useState(pathname);

  const debounced = useDebouncedValue(value, GLOBAL_SEARCH_DEBOUNCE_MS);
  const search = useGlobalSearch(debounced);
  const flat = search.groups.flatMap((group) => group.items);
  const active = flat.length === 0 ? -1 : Math.min(activeIndex, flat.length - 1);

  if (pathname !== seenPath) {
    setSeenPath(pathname);
    setOpen(false);
    setMobileOpen(false);
    setValue("");
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === GLOBAL_SEARCH_COMMAND_KEY;
      const slash = event.key === GLOBAL_SEARCH_SHORTCUT && !isTypingTarget(event.target);
      if (!command && !slash) return;
      event.preventDefault();
      if (window.matchMedia(DESKTOP_QUERY).matches) {
        desktopInputRef.current?.focus();
        setOpen(true);
      } else {
        setMobileOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function change(next: string) {
    setValue(next);
    setActiveIndex(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setMobileOpen(false);
    setValue("");
  }

  function go(item: GlobalSearchItem) {
    close();
    router.push(item.href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && flat.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((active + 1) % flat.length);
    } else if (event.key === "ArrowUp" && flat.length > 0) {
      event.preventDefault();
      setActiveIndex((active - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(flat[active]!);
    } else if (event.key === "Escape") {
      if (value) change("");
      else event.currentTarget.blur();
      setOpen(false);
      setMobileOpen(false);
    }
  }

  const comboboxProps = {
    role: "combobox",
    "aria-expanded": open && value.trim() !== "",
    "aria-controls": listboxId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": active >= 0 ? `${listboxId}-${active}` : undefined,
    autoComplete: "off",
    value,
    placeholder: t("placeholder"),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => change(event.target.value),
    onKeyDown: onInputKeyDown,
    onClear: () => change(""),
    clearLabel: t("clear"),
    label: t("label"),
  };

  const results = (
    <SearchResults
      query={debounced.trim()}
      search={search}
      active={active}
      listboxId={listboxId}
      onHover={setActiveIndex}
      onNavigate={close}
    />
  );

  return (
    <>
      <div
        ref={containerRef}
        className="relative hidden w-full max-w-xl md:block"
        data-test-selector="global-search"
      >
        <SearchField
          ref={desktopInputRef}
          data-testid="global-search-input"
          shortcut={GLOBAL_SEARCH_SHORTCUT}
          onFocus={() => setOpen(true)}
          {...comboboxProps}
        />
        {open && value.trim() !== "" && (
          <div className="absolute start-1/2 top-full z-50 mt-2 w-[max(100%,30rem)] overflow-hidden ltr:-translate-x-1/2 rtl:translate-x-1/2 rounded-panel border border-line bg-surface shadow-float">
            <div className="max-h-[min(70vh,32rem)] overflow-y-auto">{results}</div>
            <p className="border-t border-line bg-sunken px-4 py-2 text-micro text-ink-subtle">{t("hint")}</p>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t("open")}
        data-test-selector="global-search-open"
        className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink transition-colors hover:bg-inset hover:text-primary-700 focus-visible:bg-neutral-200 focus-visible:text-primary-800 md:hidden"
      >
        <Search className="size-5" aria-hidden="true" />
      </button>

      {mobileOpen &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col bg-canvas pt-[var(--safe-top)] md:hidden"
          data-test-selector="global-search-sheet"
        >
          <div className="flex items-center gap-2 border-b border-line bg-surface p-3">
            <SearchField data-testid="global-search-sheet-input" className="flex-1" autoFocus {...comboboxProps} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t("close")}
              data-test-selector="global-search-close"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-inset hover:text-primary-700 focus-visible:bg-neutral-200 focus-visible:text-primary-800"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {value.trim() !== "" && <div className="min-h-0 flex-1 overflow-y-auto bg-surface">{results}</div>}
        </div>
      , document.body)}
    </>
  );
}

interface SearchResultsProps {
  query: string;
  search: ReturnType<typeof useGlobalSearch>;
  active: number;
  listboxId: string;
  onHover: (index: number) => void;
  onNavigate: () => void;
}

function SearchResults({ query, search, active, listboxId, onHover, onNavigate }: SearchResultsProps) {
  const t = useTranslations("globalSearch");

  if (!search.ready && search.groups.length === 0) {
    return <SearchMessage>{t("minChars")}</SearchMessage>;
  }
  if (search.groups.length === 0) {
    if (search.isFetching) {
      return (
        <SearchMessage>
          <Spinner className="size-4" /> {t("searching")}
        </SearchMessage>
      );
    }
    return <SearchMessage>{search.isError ? t("error") : t("noResults", { query })}</SearchMessage>;
  }

  const offsets = search.groups.map((_, groupIndex) =>
    search.groups.slice(0, groupIndex).reduce((sum, group) => sum + group.items.length, 0)
  );

  return (
    <div id={listboxId} role="listbox" aria-label={t("label")} data-test-selector="global-search-results" className="py-1">
      {search.groups.map((group, groupIndex) => (
        <ResultGroup key={group.key} group={group} onNavigate={onNavigate}>
          {group.items.map((item, itemIndex) => {
            const position = offsets[groupIndex]! + itemIndex;
            return (
              <ResultRow
                key={item.id}
                id={`${listboxId}-${position}`}
                group={group.key}
                item={item}
                isActive={position === active}
                onHover={() => onHover(position)}
                onNavigate={onNavigate}
              />
            );
          })}
        </ResultGroup>
      ))}
    </div>
  );
}

function SearchMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-4 py-6 text-label text-ink-muted" data-test-selector="global-search-message">
      {children}
    </p>
  );
}

function ResultGroup({
  group,
  onNavigate,
  children,
}: {
  group: GlobalSearchGroup;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("globalSearch");
  const hasMore = group.seeAllHref !== undefined && group.total > group.items.length;

  return (
    <div role="group" aria-label={t(`groups.${group.key}`)} data-test-selector={testSelectorFor("global-search-group", group.key)}>
      <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-3">
        <span className="text-micro font-medium text-ink-subtle">{t(`groups.${group.key}`)}</span>
        {hasMore && (
          <Link
            onClick={onNavigate}
            href={group.seeAllHref!}
            className="text-micro text-primary-600 transition-colors hover:text-primary-700 focus-link"
            data-test-selector={testSelectorFor("global-search-see-all", group.key)}
          >
            {t("seeAll", { count: group.total })}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

interface ResultRowProps {
  id: string;
  group: GlobalSearchGroupKey;
  item: GlobalSearchItem;
  isActive: boolean;
  onHover: () => void;
  onNavigate: () => void;
}

function ResultRow({ id, group, item, isActive, onHover, onNavigate }: ResultRowProps) {
  const Icon = GROUP_ICONS[group];
  const hasPhoto = item.thumbnailUrl !== undefined;

  return (
    <Link
      id={id}
      href={item.href}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      onPointerMove={onHover}
      onClick={onNavigate}
      data-test-selector={testSelectorFor(`global-search-${group}-option`, item.id)}
      className={cn(
        "mx-1.5 flex items-center gap-3 rounded-control px-2.5 py-2 transition-colors",
        isActive ? "bg-primary-50" : "hover:bg-row-hover"
      )}
    >
      {hasPhoto ? (
        <ProductImage
          src={item.thumbnailUrl}
          alt=""
          className="size-10 shrink-0 rounded-control"
          sizes={GLOBAL_SEARCH_THUMB_SIZES}
        />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-sunken text-ink-muted">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline gap-3">
          <span className={cn("min-w-0 flex-1 truncate text-value", isActive ? "text-primary-900" : "text-ink")}>
            {item.title}
          </span>
          {item.meta && <span className="shrink-0 text-label tabular-nums text-ink">{item.meta}</span>}
        </span>
        {(item.subtitle || item.status) && (
          <span className="flex items-center gap-2">
            {item.subtitle && (
              <span className="min-w-0 truncate text-label text-ink-muted">
                {group === "customers" ? <bdi dir="ltr">{item.subtitle}</bdi> : item.subtitle}
              </span>
            )}
            {item.status && <OrderStatusBadge status={item.status} className="ms-auto" />}
          </span>
        )}
      </span>
    </Link>
  );
}
