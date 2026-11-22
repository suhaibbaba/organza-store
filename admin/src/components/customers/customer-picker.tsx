"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, UserRound, X } from "lucide-react";
import { Button, CardButton, IconButton, SearchField, Spinner, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { useSession } from "@/components/providers/session-provider";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { useCustomersQuery } from "@/hooks/use-customers";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import {
  CUSTOMER_PICKER_PAGE_SIZE,
  CUSTOMER_SEARCH_DEBOUNCE_MS,
  DEFAULT_CUSTOMER_FILTERS,
} from "@/constants/customers";
import type { Customer } from "@/types/customer";

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
}

// Find a customer by name or phone, or add one on the spot; what they already owe shows before the sale.
export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const t = useTranslations("customers.picker");
  const { user } = useSession();
  const formatMoney = useMoneyFormatter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(query.trim(), CUSTOMER_SEARCH_DEBOUNCE_MS);
  const results = useCustomersQuery(
    { ...DEFAULT_CUSTOMER_FILTERS, q, pageSize: CUSTOMER_PICKER_PAGE_SIZE },
    q.length > 0 && value === null,
  );

  if (value) {
    const balance = "balance" in value ? String(value.balance) : null;
    return (
      <div
        className="flex items-center gap-3 rounded-panel border border-primary-200 bg-primary-50 px-3 py-2.5"
        data-test-selector="customer-picker-selected"
      >
        <UserRound className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Typography variant="body" weight="medium" as="span" className="break-words">
            {value.name}
          </Typography>
          <Typography variant="small" tone="muted" as="span" dir="ltr" className="self-start tabular-nums">
            {value.phone}
          </Typography>
          {balance !== null && Number(balance) > 0 && (
            <Typography variant="small" as="span" className="text-danger-700">
              {t("alreadyOwes", { amount: formatMoney(balance) })}
            </Typography>
          )}
        </div>
        <IconButton
          data-testid="customer-picker-clear"
          label={t("change")}
          icon={<X className="size-4" aria-hidden="true" />}
          onClick={() => onChange(null)}
        />
      </div>
    );
  }

  const customers = results.data?.customers ?? [];

  return (
    <div className="flex flex-col gap-2" data-test-selector="customer-picker">
      <SearchField
        data-testid="customer-picker-search"
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
          }
        }}
        onClear={() => setQuery("")}
        clearLabel={t("clear")}
      />
      {results.isFetching && (
        <Typography variant="small" tone="muted" as="p" className="flex items-center gap-2">
          <Spinner />
          {t("searching")}
        </Typography>
      )}
      {q.length > 0 && !results.isFetching && customers.length === 0 && (
        <Typography variant="small" tone="muted" as="p">
          {t("noMatches")}
        </Typography>
      )}
      {customers.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {customers.map((customer) => (
            <li key={customer.id}>
              <CardButton
                data-testid={testSelectorFor("customer-picker-result", customer.id)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start"
                onClick={() => onChange(customer)}
              >
                <span className="flex min-w-0 flex-col">
                  <Typography variant="body" as="span" className="break-words">
                    {customer.name}
                  </Typography>
                  <Typography variant="small" tone="muted" as="span" dir="ltr" className="self-start tabular-nums">
                    {customer.phone}
                  </Typography>
                </span>
                {Number(customer.balance) > 0 && (
                  <Typography variant="small" as="span" className="shrink-0 tabular-nums text-danger-700">
                    {formatMoney(customer.balance)}
                  </Typography>
                )}
              </CardButton>
            </li>
          ))}
        </ul>
      )}
      {can(user, "customer.manage") && (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          data-test-selector="customer-picker-new"
          icon={<Plus className="size-4" aria-hidden="true" />}
          onClick={() => setCreating(true)}
        >
          {t("newCustomer")}
        </Button>
      )}
      <CustomerFormModal
        target={creating ? { mode: "create" } : null}
        onClose={() => setCreating(false)}
        onSaved={onChange}
      />
    </div>
  );
}
