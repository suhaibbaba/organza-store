import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { MESSAGE_FORMATS } from "@store/shared/constants/formatting";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // @store/ui ships its own strings (cancel, pagination, validation) under `ui`.
    messages: {
      ...(await import(`../messages/${locale}.json`)).default,
      ui: (await import(`@store/ui/messages/${locale}.json`)).default,
    },

    // Named formats, not the device's (shared constants/formatting); the client provider inherits them.
    formats: MESSAGE_FORMATS,
  };
});
