import { hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { PUSH_MESSAGES_NAMESPACE } from "@/constants/pwa";

// The notification wording, per language, for the service worker.
//
// Notifications are drawn by public/sw.js, which runs outside the bundle and
// cannot import next-intl — and the API sends translation keys rather than
// sentences (CLAUDE.md rule 12), so somebody has to turn one into the other.
// That happens here rather than by copying strings into the worker: the text
// stays in src/messages/*.json with everything else, and a wording change is
// a translation change like any other.
//
// Public on purpose (see the matcher in proxy.ts, which skips /api): these
// are UI labels, identical for everyone, and a service worker handling a
// push has no session to send.

/** Flattens `{ sale: { title } }` into `{ "push.sale.title": ... }` — the keys the payload names. */
function flatten(value: unknown, prefix: string, target: Record<string, string> = {}): Record<string, string> {
  if (typeof value === "string") {
    target[prefix] = value;
    return target;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, `${prefix}.${key}`, target);
    }
  }
  return target;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// `params` is typed explicitly rather than through the generated
// `RouteContext` helper, because `npm run typecheck` runs tsc on its own and
// those types only exist after a dev/build/typegen run.
export async function GET(_request: Request, ctx: { params: Promise<{ locale: string }> }) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale)) {
    return new Response(null, { status: 404 });
  }

  const messages = (await getMessages({ locale })) as Record<string, unknown>;
  return Response.json(flatten(messages[PUSH_MESSAGES_NAMESPACE] ?? {}, PUSH_MESSAGES_NAMESPACE));
}
