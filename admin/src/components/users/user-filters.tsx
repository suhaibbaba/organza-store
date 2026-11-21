"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button, Chip, ChipGroup, Drawer, FormField, Select, Typography } from "@store/ui";
import { ROLES } from "@organza/shared/constants/roles";
import type { Role } from "@organza/shared/types/role";
import { fieldTestSelector } from "@organza/shared/lib/testSelector";
import { USER_SORT_OPTIONS, USER_STATUS_OPTIONS } from "@/constants/users";
import type {
  UserFilterChipsProps,
  UserFiltersProps,
  UserFiltersValue,
  UserRoleFilterProps,
} from "@/types/user";

export const EMPTY_USER_FILTERS: UserFiltersValue = { role: null, isActive: null };

export function countUserFilters(value: UserFiltersValue): number {
  return [value.role !== null, value.isActive !== null].filter(Boolean).length;
}

function toStatus(isActive: boolean | null): string {
  return isActive === null ? "" : isActive ? "active" : "inactive";
}

function fromStatus(status: string): boolean | null {
  return status === "" ? null : status === "active";
}

function useRoleOptions() {
  const tRole = useTranslations("users.role");
  return ROLES.map((role) => ({ value: role, label: tRole(role) }));
}

// Role is the filter reached for most: desktop gets it in the toolbar, applied at once; phones keep it in the drawer.
export function UserRoleFilter({ value, onChange }: UserRoleFilterProps) {
  const t = useTranslations("users.filters");
  const roles = useRoleOptions();
  return (
    <div className="hidden w-48 shrink-0 md:block">
      <Select
        aria-label={t("role")}
        data-testid="users-role"
        value={value ?? ""}
        placeholder={t("allRoles")}
        options={roles}
        onChange={(event) => onChange(event.target.value ? (event.target.value as Role) : null)}
      />
    </div>
  );
}

export function UserFilters({ value, sort, onApply }: UserFiltersProps) {
  const t = useTranslations("users.filters");
  const tSort = useTranslations("users.sort");
  const roles = useRoleOptions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [draftSort, setDraftSort] = useState(sort);
  const activeCount = countUserFilters(value);

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(value);
      setDraftSort(sort);
    }
    setOpen(next);
  }

  function apply(next: UserFiltersValue) {
    onApply(next, draftSort);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => handleOpenChange(true)}
        data-test-selector="user-filters-open"
        className="relative shrink-0"
        icon={<SlidersHorizontal className="size-4" aria-hidden="true" />}
      >
        {t("trigger")}
        {activeCount > 0 && (
          <Typography
            variant="caption"
            as="span"
            className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-pill bg-primary-600 text-ink-inverse"
          >
            {activeCount}
          </Typography>
        )}
      </Button>

      <Drawer
        data-testid="sheet-user-filters"
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        descriptionKey="users.filters.title"
        footer={
          <>
            <Button variant="secondary" onClick={() => apply(EMPTY_USER_FILTERS)} data-test-selector="user-filters-reset">
              {t("reset")}
            </Button>
            <Button onClick={() => apply(draft)} data-test-selector="user-filters-apply">
              {t("apply")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <FormField label="users.sort.label" hint="users.filters.sortHint" htmlFor="user-filter-sort">
            <Select
              id="user-filter-sort"
              data-testid="users-sort"
              value={`${draftSort.sortBy}-${draftSort.sortDir}`}
              options={USER_SORT_OPTIONS.map((option) => ({ value: option.value, label: tSort(option.labelKey) }))}
              onChange={(event) => {
                const option = USER_SORT_OPTIONS.find((one) => one.value === event.target.value);
                if (option) setDraftSort({ sortBy: option.sortBy, sortDir: option.sortDir });
              }}
            />
          </FormField>

          <FormField label="users.filters.role" hint="users.filters.roleHint" htmlFor="user-filter-role">
            <Select
              id="user-filter-role"
              data-testid={fieldTestSelector("filter-role")}
              value={draft.role ?? ""}
              placeholder={t("allRoles")}
              options={roles}
              onChange={(event) =>
                setDraft((d) => ({ ...d, role: event.target.value ? (event.target.value as Role) : null }))
              }
            />
          </FormField>

          <FormField label="users.filters.status" hint="users.filters.statusHint" htmlFor="user-filter-status">
            <Select
              id="user-filter-status"
              data-testid={fieldTestSelector("filter-status")}
              value={toStatus(draft.isActive)}
              placeholder={t("statusAll")}
              options={USER_STATUS_OPTIONS.map((status) => ({
                value: status,
                label: t(status === "active" ? "statusActive" : "statusInactive"),
              }))}
              onChange={(event) => setDraft((d) => ({ ...d, isActive: fromStatus(event.target.value) }))}
            />
          </FormField>
        </div>
      </Drawer>
    </>
  );
}

export function UserFilterChips({ value, onChange }: UserFilterChipsProps) {
  const t = useTranslations("users.filters");
  const tRole = useTranslations("users.role");

  if (countUserFilters(value) === 0) return null;

  const chips: { key: string; label: string; clear: UserFiltersValue }[] = [];
  if (value.role) {
    chips.push({ key: "role", label: t("chipRole", { name: tRole(value.role) }), clear: { ...value, role: null } });
  }
  if (value.isActive !== null) {
    const name = t(value.isActive ? "statusActive" : "statusInactive");
    chips.push({ key: "status", label: t("chipStatus", { name }), clear: { ...value, isActive: null } });
  }

  return (
    <ChipGroup data-testid="user-filter-chips">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          data-testid={`user-filter-chip-${chip.key}`}
          onRemove={() => onChange(chip.clear)}
          removeLabel={t("removeFilter", { name: chip.label })}
        >
          {chip.label}
        </Chip>
      ))}
    </ChipGroup>
  );
}
