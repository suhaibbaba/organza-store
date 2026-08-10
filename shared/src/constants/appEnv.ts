// Which deployment a running process belongs to: the sandbox stack, or the
// live shop.
//
// This is deliberately NOT `NODE_ENV`. Both stacks are built and started the
// same way — `next build` / `next start` and a compiled backend — so both run
// with `NODE_ENV=production`, and nothing in the running system could tell
// them apart. That gap is why the sandbox and the live shop shipped identical
// home-screen tiles, and why `db:reset`'s "that is the LIVE SHOP" refusal
// fired on the sandbox as well (backend/src/lib/dangerousCommands.ts): a
// refusal that fires everywhere is one people learn to type past.
//
// So the environment is stated, not inferred:
//   backend   APP_ENV
//   admin/pos NEXT_PUBLIC_APP_ENV   (inlined into the bundle at build time)
export const APP_ENVS = ["sandbox", "production"] as const;

/**
 * What an unset — or misspelled — value means.
 *
 * "production", because every consequence of guessing runs one way. Guessing
 * "sandbox" would put a SANDBOX chip on the live shop's screens (staff told
 * the real orders in front of them are practice data), hand the live shop the
 * sandbox's tile, and quietly drop `db:reset`'s second confirmation on the
 * one database that cannot be rebuilt. Guessing "production" costs the
 * sandbox its amber band and one extra confirmation — an inconvenience, on
 * the stack built to be thrown away.
 *
 * A developer's own machine is a sandbox and says so in `.env.example`; the
 * default is what protects a deployment whose env file was missed.
 */
export const DEFAULT_APP_ENV = "production";

/**
 * How the sandbox says so in one or two characters.
 *
 * The same three letters the amber band on the sandbox icons carries, so the
 * home-screen tile and the label under it agree — "Organza Admin (SBX)" next
 * to a tile with SBX printed across it. Short because iOS truncates the name
 * under an icon hard, and this has to survive that.
 */
export const SANDBOX_NAME_SUFFIX = "SBX";

/** Normalizes whatever the environment actually holds — see DEFAULT_APP_ENV. */
export function resolveAppEnv(value: string | null | undefined): (typeof APP_ENVS)[number] {
  const normalized = (value ?? "").trim().toLowerCase();
  return APP_ENVS.find((appEnv) => appEnv === normalized) ?? DEFAULT_APP_ENV;
}

/**
 * Where the admin and the POS keep their app icons: one folder per
 * environment, holding the same file names, under each app's `public/`.
 *
 * Written down here rather than in each app because the backend needs it too
 * — the logo at the top of a password email is fetched from the admin's
 * public folder over HTTP (constants/email.ts), and a path built by hand
 * there would be a broken image in somebody's inbox the next time these
 * folders move. Nothing warns you: the mail just arrives without its logo.
 */
export const appIconBasePath = (appEnv: (typeof APP_ENVS)[number]): string => `/app_icon/${appEnv}`;

/** `<base>/icon-<size>.png`, the square PNG of that size. */
export const appIconPath = (appEnv: (typeof APP_ENVS)[number], size: number): string =>
  `${appIconBasePath(appEnv)}/icon-${size}.png`;
