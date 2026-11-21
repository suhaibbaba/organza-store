import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { MESSAGE_FORMATS } from "@store/shared/constants/formatting";
import { routing } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Plus @store/ui's own strings under `ui`.
    messages: {
      ...(await import(`../messages/${locale}.json`)).default,
      ui: (await import(`@store/ui/messages/${locale}.json`)).default,
    },

    // Named number formats (shared/constants/formatting), inherited by the client provider.
    formats: MESSAGE_FORMATS,
  };
});
