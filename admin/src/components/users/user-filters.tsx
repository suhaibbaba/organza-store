"use client";

import { useTranslations } from "next-intl";
import { ROLES } from "@shared/constants/roles";
import type { Role } from "@shared/types/role";
import { Select } from "@/components/ui/select";

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
          value={role ?? ""}
          onChange={(e) => onRoleChange(e.target.value ? (e.target.value as Role) : null)}
        >
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tRole(r)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex-1">
        <Select
          aria-label={t("status")}
          value={isActive === null ? "" : isActive ? "active" : "inactive"}
          onChange={(e) => onIsActiveChange(e.target.value === "" ? null : e.target.value === "active")}
        >
          <option value="">{t("statusAll")}</option>
          <option value="active">{t("statusActive")}</option>
          <option value="inactive">{t("statusInactive")}</option>
        </Select>
      </div>
    </div>
  );
}
