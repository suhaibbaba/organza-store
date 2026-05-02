import { useTranslation } from "react-i18next";

export function useCurrency(currencyCode?: string) {
  const { i18n } = useTranslation();
  const locale = i18n.language === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const code = (currencyCode || "USD").toUpperCase();

  const format = (amount: number): string => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${code}`;
    }
  };

  return { format };
}
