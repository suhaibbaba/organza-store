"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, UserRound, X } from "lucide-react";
import { Alert, Button, CardButton, FormField, IconButton, Input, SearchField, Spinner, Typography } from "@store/ui";
import { createCustomerSchema } from "@store/shared/schemas/customer";
import { ERROR_CODES } from "@store/shared/constants/errors";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import type { Customer, CustomerSummary } from "@store/shared/types/customer";
import { ShopPhoneInput } from "@/components/sell/customer-phone-field";
import { useCreateCustomer, useCustomerSearch } from "@/hooks/use-customer-search";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";

export type PickedCustomer = Pick<Customer, "id" | "name" | "phone"> & Partial<Pick<CustomerSummary, "balance">>;

interface CustomerPickerProps {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  // Set once the cashier tried to go on without one.
  showRequired: boolean;
  // Names the fields `pos-<name>-…`, so each sheet keeps its own selectors.
  name: string;
}

// Who owes the money: search by name or phone, or add them on the spot (the credit sale and the exchange both ask this).
export function CustomerPicker({ value, onChange, showRequired, name }: CustomerPickerProps) {
  const t = useTranslations("sell.credit");
  const tSearch = useTranslations("sell.search");
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const search = useCustomerSearch(query, value === null && !adding);
  const create = useCreateCustomer();
  const sel = (part: string) => `pos-${name}-${part}`;

  const newCustomer = createCustomerSchema.safeParse({ name: newName.trim(), phone: newPhone });

  async function addCustomer() {
    if (!newCustomer.success) {
      return;
    }
    try {
      onChange(await create.mutateAsync(newCustomer.data));
      setAdding(false);
    } catch {
      // Shown under the form from create.error.
    }
  }

  const owes = value?.balance && Number(value.balance) > 0 ? value.balance : null;
  const createErrorCode = create.error
    ? create.error instanceof ApiError
      ? create.error.code
      : ERROR_CODES.INTERNAL
    : null;

  return (
    <section className="flex flex-col gap-2" data-test-selector={sel("customer")}>
      <Typography as="h3" variant="small" weight="medium">
        {t("customer")}
      </Typography>
      {value ? (
        <div className="flex items-center gap-3 rounded-panel border border-primary-200 bg-primary-50 px-4 py-3">
          <UserRound className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <Typography variant="body" weight="semibold" className="break-words">
              {value.name}
            </Typography>
            <Typography as="span" variant="small" tone="muted" dir="ltr" className="tabular-nums">
              {value.phone}
            </Typography>
            {owes && (
              <Typography as="span" variant="small" tone="error">
                {t("alreadyOwes", { amount: formatMoney(owes) })}
              </Typography>
            )}
          </div>
          <IconButton
            data-testid={sel("customer-clear")}
            label={t("changeCustomer")}
            icon={<X className="size-5" aria-hidden="true" />}
            onClick={() => onChange(null)}
          />
        </div>
      ) : adding ? (
        <div className="flex flex-col gap-3 rounded-panel border border-line p-3">
          <FormField label="sell.credit.newName" htmlFor={sel("new-name")} required>
            <Input
              id={sel("new-name")}
              data-testid={fieldTestSelector(sel("new-name"))}
              autoFocus
              value={newName}
              placeholder={t("newNamePlaceholder")}
              onChange={(event) => setNewName(event.target.value)}
            />
          </FormField>
          <FormField label="sell.credit.newPhone" htmlFor={sel("new-phone")} required>
            <ShopPhoneInput
              id={sel("new-phone")}
              value={newPhone}
              onChange={setNewPhone}
              onBlur={() => {}}
              invalid={newPhone !== "" && !newCustomer.success && newName.trim() !== ""}
            />
          </FormField>
          {createErrorCode && (
            <Alert tone="danger" data-testid={sel("new-error")}>
              {translateError(createErrorCode)}
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className={"flex-1"}
              onClick={() => setAdding(false)}
              disabled={create.isPending}
            >
              {t("back")}
            </Button>
            <Button
              type="button"
              className={"flex-1"}
              data-testid={sel("new-save")}
              disabled={!newCustomer.success}
              isLoading={create.isPending}
              onClick={() => void addCustomer()}
            >
              {t("addCustomer")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SearchField
            id={sel("search")}
            label={t("searchLabel")}
            data-testid={fieldTestSelector(sel("search"))}
            value={query}
            placeholder={t("searchPlaceholder")}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            clearLabel={tSearch("clear")}
          />
          {search.isLooking && (
            <div className="flex items-center gap-2">
              <Spinner />
              <Typography as="span" variant="small" tone="muted">
                {t("searching")}
              </Typography>
            </div>
          )}
          {search.isActive && !search.isLooking && search.customers.length === 0 && (
            <Typography variant="small" tone="muted">
              {t("noMatches")}
            </Typography>
          )}
          {search.customers.length > 0 && (
            <ul className="flex flex-col gap-2">
              {search.customers.map((found) => (
                <li key={found.id}>
                  <CardButton
                    onClick={() => onChange(found)}
                    data-testid={testSelectorFor(sel("customer-result"), found.id)}
                    className="items-center justify-between gap-3 px-4 py-3 focus-darken"
                  >
                    <span className="flex min-w-0 flex-col items-start">
                      <Typography as="span" variant="body" weight="semibold" className="break-words">
                        {found.name}
                      </Typography>
                      <Typography as="span" variant="small" tone="muted" dir="ltr" className="tabular-nums">
                        {found.phone}
                      </Typography>
                    </span>
                    {Number(found.balance) > 0 && (
                      <Typography as="span" variant="small" tone="error" className="shrink-0 tabular-nums">
                        {formatMoney(found.balance)}
                      </Typography>
                    )}
                  </CardButton>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="secondary"
            className={"self-start"}
            data-testid={sel("new-customer")}
            icon={<Plus aria-hidden="true" />}
            onClick={() => {
              setAdding(true);
              create.reset();
            }}
          >
            {t("newCustomer")}
          </Button>
        </>
      )}
      {showRequired && !value && (
        <Typography role="alert" variant="small" tone="error" data-test-selector={sel("customer-error")}>
          {t("customerRequired")}
        </Typography>
      )}
    </section>
  );
}
