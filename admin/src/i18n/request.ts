import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { MESSAGE_FORMATS } from "@organza/shared/constants/formatting";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    // How a figure inside a sentence is written. Named rather than left to
    // the device — see @organza/shared/constants/formatting. The client
    // provider inherits this from here, so both halves of the app agree.
    formats: MESSAGE_FORMATS,
  };
});
