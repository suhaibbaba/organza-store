import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { DEFAULT_LANDING_HREF } from "@/constants/routes";

// This runs on the server, before anything has read the session, so it cannot
// know the role — see DEFAULT_LANDING_HREF for what that means and who
// forwards whom from there.
export default async function RootPage() {
  const locale = await getLocale();
  redirect({ href: DEFAULT_LANDING_HREF, locale });
}
