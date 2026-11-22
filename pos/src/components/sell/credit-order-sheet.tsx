"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Plus, UserRound, X } from "lucide-react";
import {
  Alert,
  Button,
  CardButton,
  Checkbox,
  FormField,
  IconButton,
  Input,
  SearchField,
  Spinner,
  Typography,
} from "@store/ui";
import { createCustomerSchema } from "@store/shared/schemas/customer";
import { fieldTestSelector, testSelectorFor } from "@store/shared/lib/testSelector";
import type { Customer, CustomerSummary } from "@store/shared/types/customer";
import { BottomSheet } from "@/components/sell/bottom-sheet";
import { ShopPhoneInput } from "@/components/sell/customer-phone-field";
import { NumericInput } from "@/components/fields/numeric-input";
import { useCreateCustomer, useCustomerSearch } from "@/hooks/use-customer-search";
import { useMoneyFormatter } from "@/hooks/use-money-formatter";
import { useCurrencySymbol } from "@/hooks/use-currency-symbol";
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
  const tSearch = useTranslations("sell.search");
  const locale = useLocale();
  const formatMoney = useMoneyFormatter();
  const currency = useCurrencySymbol();
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
          <Typography as="h3" variant="small" weight="medium">
            {t("customer")}
          </Typography>
          {customer ? (
            <div className="flex items-center gap-3 rounded-panel border border-primary-200 bg-primary-50 px-4 py-3">
              <UserRound className="size-5 shrink-0 text-primary-700" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <Typography variant="body" weight="semibold" className="break-words">
                  {customer.name}
                </Typography>
                <Typography as="span" variant="small" tone="muted" dir="ltr" className="tabular-nums">
                  {customer.phone}
                </Typography>
                {owes && (
                  <Typography as="span" variant="small" tone="error">
                    {t("alreadyOwes", { amount: formatMoney(owes) })}
                  </Typography>
                )}
              </div>
              <IconButton
                data-testid="pos-credit-customer-clear"
                label={t("changeCustomer")}
                icon={<X className="size-5" aria-hidden="true" />}
                onClick={() => setCustomer(null)}
              />
            </div>
          ) : adding ? (
            <div className="flex flex-col gap-3 rounded-panel border border-line p-3">
              <FormField label="sell.credit.newName" htmlFor="pos-credit-new-name" required>
                <Input
                  id="pos-credit-new-name"
                  data-testid={fieldTestSelector("pos-credit-new-name")}

                  autoFocus
                  value={newName}
                  placeholder={t("newNamePlaceholder")}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </FormField>
              <FormField label="sell.credit.newPhone" htmlFor="pos-credit-new-phone" required>
                <ShopPhoneInput
                  id="pos-credit-new-phone"
                  value={newPhone}
                  onChange={setNewPhone}
                  onBlur={() => {}}
                  invalid={newPhone !== "" && !newCustomer.success && newName.trim() !== ""}
                />
              </FormField>
              {createErrorCode && (
                <Alert tone="danger" data-testid="pos-credit-new-error">
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
              <SearchField
                id="pos-credit-search"
                label={t("searchLabel")}
                data-testid={fieldTestSelector("pos-credit-search")}

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
                        onClick={() => setCustomer(found)}
                        data-testid={testSelectorFor("pos-credit-customer-result", found.id)}
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
            <Typography role="alert" variant="small" tone="error" data-test-selector="pos-credit-customer-error">
              {t("customerRequired")}
            </Typography>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <FormField
            label="sell.credit.paidNow"
            htmlFor="pos-credit-paid-now"
            optional
            note="sell.credit.paidNowHint"
            error={tooMuch ? { type: "max" } : undefined}
            errorKey="sell.credit.paidNowTooMuch"
          >
            <NumericInput
              id="pos-credit-paid-now"
              data-testid={fieldTestSelector("pos-credit-paid-now")}
              allowDecimal
              dir="ltr"
              suffix={currency}
              className=" tabular-nums"
              placeholder="0"
              value={paidNow}
              onChange={(event) => setPaidNow(event.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between gap-3 rounded-panel bg-sunken px-4 py-3">
            <Typography as="span" variant="body" tone="muted">
              {t("remaining")}
            </Typography>
            <Typography
              as="span"
              variant="h2"
              weight="bold"
              tone="error"
              className="tabular-nums"
              data-test-selector="pos-credit-remaining"
            >
              {formatMoney(remaining)}
            </Typography>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <Typography as="h3" variant="small" weight="medium">
            {t("keptTitle")}
          </Typography>
          <Typography variant="caption" tone="muted">
            {t("keptHint")}
          </Typography>
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
            className={"min-w-28 flex-1"}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            data-testid="pos-credit-confirm"
            isLoading={isSubmitting}
            icon={<Clock aria-hidden="true" />}
            className={"min-w-0 flex-1"}
          >
            {isSubmitting ? t("saving") : t("confirm")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
