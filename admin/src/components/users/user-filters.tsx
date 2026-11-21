"use client";

import { useTranslations } from "next-intl";
import { Select } from "@store/ui";
import { ROLES } from "@organza/shared/constants/roles";
import type { Role } from "@organza/shared/types/role";

interface UserFiltersProps {
  role: Role | null;
  isActive: boolean | null;
  onRoleChange: (role: Role | null) => void;
  onIsActiveChange: (isActive: boolean | null) => void;
}

export function UserFilters({ role, isActive, onRoleChange, onIsActiveChange }: UserFiltersProps) {
  const t = useTranslations("users.filters");
  const tRole = useTranslations("users.role");

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Select
          aria-label={t("role")}
          placeholder={t("allRoles")}
          options={ROLES.map((r) => ({ value: r, label: tRole(r) }))}
          value={role ?? ""}
          onChange={(e) => onRoleChange(e.target.value ? (e.target.value as Role) : null)}
        />
      </div>
      <div className="flex-1">
        <Select
          aria-label={t("status")}
          placeholder={t("statusAll")}
          options={[
            { value: "active", label: t("statusActive") },
            { value: "inactive", label: t("statusInactive") },
          ]}
          value={isActive === null ? "" : isActive ? "active" : "inactive"}
          onChange={(e) => onIsActiveChange(e.target.value === "" ? null : e.target.value === "active")}
        />
      </div>
    </div>
  );
}
