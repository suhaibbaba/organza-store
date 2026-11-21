"use client";

import { useTranslations } from "next-intl";
import { SearchField } from "@store/ui";

interface UserSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function UserSearch({ value, onChange }: UserSearchProps) {
  const t = useTranslations("users");

  return (
    <SearchField
      label={t("search.label")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClear={() => onChange("")}
      clearLabel={t("search.clear")}
      placeholder={t("search.placeholder")}
    />
  );
}
