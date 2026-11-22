"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Plus, Search, UserRound, X } from "lucide-react";
import { Alert, Button, Checkbox, IconButton, Input, Spinner } from "@store/ui";
import { createCustomerSchema } from "@store/shared/schemas/customer";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import type { Customer, CustomerSummary } from "@store/shared/types/customer";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { ShopPhoneInput } from "@/components/sell/customer-phone-field";
import { NumericInput } from "@/components/fields/numeric-input";
import { SHEET_ACTION } from "@/components/sell/sheet-styles";
import { useCreateCustomer, useCustomerSearch } from "@/hooks/use-customer-search";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useTranslateError } from "@/hooks/use-translate-error";
import { ApiError } from "@/lib/api/errors";
import { localize } from "@/lib/i18n-content";
import { ERROR_CODES } from "@store/shared/constants/errors";
import type { CartLine } from "@/types/cart";
import type { CreditCheckout } from "@/types/customer";

interface CreditOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: readonly CartLine[];
  total: string;
  isSubmitting: boolean;
  errorCode: string | null;
  onConfirm: (credit: CreditCheckout) => void;
}

// Selling on credit at the counter: pick or add the customer, take what they pay now (maybe nothing), mark pieces kept.
export function CreditOrderSheet(props: CreditOrderSheetProps) {
  // Mounted only while open, so every sale starts blank.
  return props.open ? <CreditOrderForm {...props} /> : null;
}

function CreditOrderForm({
  open,
  onOpenChange,
  lines,
  total,
  isSubmitting,
  errorCode,
  onConfirm,
}: CreditOrderSheetProps) {
  const t = useTranslations("sell.credit");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const translateError = useTranslateError();
  const [customer, setCustomer] = useState<Customer | CustomerSummary | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [paidNow, setPaidNow] = useState("");
  const [keptKeys, setKeptKeys] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const search = useCustomerSearch(query, customer === null && !adding);
  const create = useCreateCustomer();

  const paid = Number(paidNow || 0);
  const tooMuch = paid > Number(total);
  const remaining = Math.max(0, Number(total) - paid);
  const newCustomer = createCustomerSchema.safeParse({ name: newName.trim(), phone: newPhone });

  async function addCustomer() {
    if (!newCustomer.success) {
      return;
    }
    try {
      setCustomer(await create.mutateAsync(newCustomer.data));
      setAdding(false);
    } catch {
      // Shown under the form from create.error.
    }
  }

  function confirm() {
    setSubmitted(true);
    if (!customer || tooMuch) {
      return;
    }
    onConfirm({ customerId: customer.id, paidNow, keptKeys });
  }

  const owes = customer && "balance" in customer && Number(customer.balance) > 0 ? customer.balance : null;
  const createErrorCode = create.error
    ? create.error instanceof ApiError
      ? create.error.code
      : ERROR_CODES.INTERNAL
    : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      name="credit-order"
      className="max-h-[92dvh]"
      headerClassName="pb-0"
      title={
        <span className="flex items-center gap-2">
          <Clock className="size-5 shrink-0 text-danger-700" aria-hidden="true" />
          {t("title")}
        </span>
      }
      description={t("subtitle")}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
        <section className="flex flex-col gap-2" data-test-selector="pos-credit-customer">
          <h3 className="text-label font-medium text-ink">{t("customer")}</h3>
          {customer ? (
            <div className="flex items-center gap-3 rounded-panel border border-primary-200 bg-primary-50 px-4 py-3">
              <UserRound className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="break-words text-value font-semibold text-ink">{customer.name}</span>
                <span dir="ltr" className="self-start text-label tabular-nums text-ink-muted">
                  {customer.phone}
                </span>
                {owes && (
                  <span className="text-label text-danger-700">{t("alreadyOwes", { amount: formatMoney(owes) })}</span>
                )}
              </span>
              <IconButton
                data-testid="pos-credit-customer-clear"
                label={t("changeCustomer")}
                icon={<X className="size-5" aria-hidden="true" />}
                onClick={() => setCustomer(null)}
              />
            </div>
          ) : adding ? (
            <div className="flex flex-col gap-3 rounded-panel border border-line p-3">
              <label htmlFor="pos-credit-new-name" className="text-label text-ink">
                {t("newName")}
              </label>
              <Input
                id="pos-credit-new-name"
                data-testid={fieldTestSelector("pos-credit-new-name")}
                className="h-12"
                autoFocus
                value={newName}
                placeholder={t("newNamePlaceholder")}
                onChange={(event) => setNewName(event.target.value)}
              />
              <label htmlFor="pos-credit-new-phone" className="text-label text-ink">
                {t("newPhone")}
              </label>
              <ShopPhoneInput
                id="pos-credit-new-phone"
                value={newPhone}
                onChange={setNewPhone}
                onBlur={() => {}}
                invalid={newPhone !== "" && !newCustomer.success && newName.trim() !== ""}
              />
              {createErrorCode && (
                <Alert tone="danger" data-testid="pos-credit-new-error">
                  {translateError(createErrorCode)}
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className={`${SHEET_ACTION} flex-1`}
                  onClick={() => setAdding(false)}
                  disabled={create.isPending}
                >
                  {t("back")}
                </Button>
                <Button
                  type="button"
                  className={`${SHEET_ACTION} flex-1`}
                  data-testid="pos-credit-new-save"
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
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <Input
                  id="pos-credit-search"
                  aria-label={t("searchLabel")}
                  data-testid={fieldTestSelector("pos-credit-search")}
                  className="h-12 ps-10"
                  value={query}
                  placeholder={t("searchPlaceholder")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              {search.isLooking && (
                <p className="flex items-center gap-2 text-label text-ink-muted">
                  <Spinner />
                  {t("searching")}
                </p>
              )}
              {search.isActive && !search.isLooking && search.customers.length === 0 && (
                <p className="text-label text-ink-muted">{t("noMatches")}</p>
              )}
              {search.customers.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {search.customers.map((found) => (
                    <li key={found.id}>
                      <button
                        type="button"
                        onClick={() => setCustomer(found)}
                        data-test-selector={testSelectorFor("pos-credit-customer-result", found.id)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-line-strong bg-surface px-4 py-3 text-start transition-colors hover:bg-row-hover focus-visible:bg-neutral-200"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="break-words text-value font-semibold text-ink">{found.name}</span>
                          <span dir="ltr" className="self-start text-label tabular-nums text-ink-muted">
                            {found.phone}
                          </span>
                        </span>
                        {Number(found.balance) > 0 && (
                          <span className="shrink-0 text-label tabular-nums text-danger-700">
                            {formatMoney(found.balance)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="secondary"
                className={`${SHEET_ACTION} self-start`}
                data-testid="pos-credit-new-customer"
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
          {submitted && !customer && (
            <p role="alert" className="text-label text-danger-700" data-test-selector="pos-credit-customer-error">
              {t("customerRequired")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <label htmlFor="pos-credit-paid-now" className="text-label font-medium text-ink">
            {t("paidNow")}
          </label>
          <NumericInput
            id="pos-credit-paid-now"
            data-testid={fieldTestSelector("pos-credit-paid-now")}
            allowDecimal
            dir="ltr"
            className="h-12 text-lg tabular-nums"
            placeholder="0"
            value={paidNow}
            onChange={(event) => setPaidNow(event.target.value)}
          />
          <p className={tooMuch ? "text-label text-danger-700" : "text-micro text-ink-muted"}>
            {tooMuch ? t("paidNowTooMuch") : t("paidNowHint")}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
            <span className="text-value text-ink-muted">{t("remaining")}</span>
            <span className="text-xl font-bold tabular-nums text-danger-700" data-test-selector="pos-credit-remaining">
              {formatMoney(remaining)}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-label font-medium text-ink">{t("keptTitle")}</h3>
          <p className="text-micro text-ink-muted">{t("keptHint")}</p>
          <ul className="flex flex-col divide-y divide-line rounded-panel border border-line">
            {lines.map((line) => {
              const name = localize(line.name, locale);
              const variant = line.variantName ? ` · ${localize(line.variantName, locale)}` : "";
              return (
                <li key={line.key} className="px-4 py-3">
                  <Checkbox
                    id={`pos-credit-kept-${line.key}`}
                    data-testid={testSelectorFor("pos-credit-kept", line.key)}
                    label={`${name}${variant}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`}
                    checked={keptKeys.includes(line.key)}
                    onCheckedChange={(checked) =>
                      setKeptKeys((current) =>
                        checked ? [...current, line.key] : current.filter((key) => key !== line.key),
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-5 pt-4">
        {errorCode && (
          <Alert tone="danger" data-testid="alert-destructive">
            {translateError(errorCode)}
          </Alert>
        )}
        <div className="flex items-stretch gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            data-testid="pos-credit-cancel"
            disabled={isSubmitting}
            className={`${SHEET_ACTION} min-w-28 flex-1`}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            data-testid="pos-credit-confirm"
            isLoading={isSubmitting}
            icon={<Clock aria-hidden="true" />}
            className={`${SHEET_ACTION} min-w-0 flex-1`}
          >
            {isSubmitting ? t("saving") : t("confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
