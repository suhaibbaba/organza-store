import "dotenv/config";
import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { TRUSTED_PROXY_IPS } from "@/lib/proxyTrust";
import {
  ACCOUNT_INACTIVE_AUTH_CODE,
  DEFAULT_SESSION_EXPIRES_IN_DAYS,
  SIGN_IN_EMAIL_PATH,
  SIGN_IN_RATE_LIMIT_MAX,
  SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants";

// Central Better Auth instance — serves admin, pos, and (later) the storefront.
// Login is email + password only (phone is a contact field, not a login method).
// This is a STAFF system: there is no such thing as a self-registered account.
// Every account is created by an Admin (routes/users.ts) or by `npm run init`.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // THE DOOR THAT WAS STANDING OPEN.
    //
    // `enabled: true` turns on Better Auth's whole email+password surface, and
    // that surface includes POST /sign-up/email — mounted publicly by
    // `app.all("/api/auth/*")` in index.ts. Better Auth refuses a sign-up only
    // when `!enabled || disableSignUp`, and `disableSignUp` defaults to FALSE,
    // so leaving it unsaid meant anybody on the internet could POST an email,
    // a password and a phone number and be handed a signed-in account. `role`
    // is `input: false` below, so they could not choose their role — they got
    // the default, EMPLOYEE, which is the POS, the catalogue, and every order
    // in the shop with every customer's name and phone number on it.
    //
    // The file used to SAY "public sign-up stays disabled". Saying it is not
    // configuring it; this line is.
    //
    // Staff accounts are created through createStaffUser (lib/credentials.ts),
    // which writes through Better Auth's own internal adapter rather than
    // through this endpoint — so closing the public door does not close the
    // Admin's.
    disableSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * Number(process.env.SESSION_EXPIRES_IN_DAYS ?? DEFAULT_SESSION_EXPIRES_IN_DAYS),
  },
  // Better Auth's built-in limit for this path is 3 attempts per 10 seconds,
  // which a whole shop behind one address spends without anybody doing
  // anything wrong — and a refusal here reaches the screen as a 429 that
  // looks exactly like a wrong password. See constants/auth.ts for the full
  // reasoning; this is still a flood stop, just not a people stop.
  rateLimit: {
    customRules: {
      [SIGN_IN_EMAIL_PATH]: { window: SIGN_IN_RATE_LIMIT_WINDOW_SECONDS, max: SIGN_IN_RATE_LIMIT_MAX },
    },
  },
  advanced: {
    // WHOSE ATTEMPTS ARE BEING COUNTED.
    //
    // The limit above is worth exactly as much as Better Auth's ability to
    // tell one caller from another, and by default it could not tell them
    // apart at all here. It resolves the caller from `x-forwarded-for`, and
    // with no trusted proxies configured it trusts that header ONLY when it
    // holds a single entry — anything longer is ambiguous, so it gives up and
    // returns null (@better-auth/core/utils/ip: `if (forwardedIps.length !== 1)
    // return null`). Behind Cloudflare -> nginx -> API the header always holds
    // at least two, so every request in the world fell back to one shared
    // bucket keyed "no-trusted-ip".
    //
    // That is not a weak limit, it is an inverted one: 20 sign-ins a minute
    // stopped meaning "per attacker" and started meaning "for the whole shop,
    // shared with the attacker". Somebody sending one request every three
    // seconds from a single laptop could keep every member of staff locked out
    // of the till all day, and this shop cannot sell without the till.
    //
    // Naming the hops fixes it: the chain is walked from the right and each
    // trusted proxy stripped, so what is left is the caller. Configured rather
    // than hard-coded because the addresses belong to the deployment (see
    // TRUSTED_PROXY_IPS in .env.example) — and left EMPTY it degrades to the
    // old single-entry behaviour, which is right for local development where
    // there is no proxy at all.
    ipAddress: {
      trustedProxies: TRUSTED_PROXY_IPS,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "EMPLOYEE",
        input: false, // role is set by an admin, never by the caller
      },
      // Contact details, and — like idNumber below — not the account owner's
      // to rewrite through POST /api/auth/update-user.
      //
      // A phone number here is not a preference: it is unique across the shop
      // in BOTH Palestine prefixes (+970/+972, CLAUDE.md rule 18), a rule
      // enforced by assertPhonesAvailable() in routes/users.ts and by nothing
      // in Better Auth. Left settable by their owner, two members of staff
      // could end up on the same number written two ways, and the check that
      // exists to prevent exactly that would never run.
      //
      // Both are written by the Admin-gated routes/users.ts, and at creation
      // by createStaffUser (lib/credentials.ts), which passes them to Better
      // Auth's internal adapter directly — `input` governs what may arrive
      // from a REQUEST, so neither path is affected.
      phone: {
        type: "string",
        required: true,
        input: false,
      },
      whatsapp: {
        type: "string",
        required: false,
        input: false,
      },
      idNumber: {
        type: "string",
        required: false,
        // NOT settable by the account's own owner. `input: true` here meant
        // POST /api/auth/update-user — part of the Better Auth surface this
        // app mounts wholesale — would let any signed-in Employee write their
        // own ID number, which is Admin-only data (CLAUDE.md rule 19) and
        // otherwise only reachable through the Admin-gated
        // PATCH /api/users/:id. It is written there, straight through Prisma
        // (routes/users.ts), so closing this costs that route nothing.
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        /**
         * A deactivated account cannot start a session — which is what
         * "they can no longer sign in" has to mean.
         *
         * Better Auth knows nothing about `isActive`; it is our column, and
         * without this hook sign-in SUCCEEDS for somebody who was removed
         * this morning. Every API route then refuses them (requireAuth checks
         * the flag on each request, middleware/auth.ts), so nothing leaks —
         * but what the person sees is a login that works followed by an app
         * where every screen is broken, and what the shop sees is a session
         * row for an account it believes is gone.
         *
         * Enforced here rather than on the sign-in endpoint because this is
         * the choke point every session creation passes through, whatever
         * route or plugin asked for one.
         */
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          if (user && !user.isActive) {
            throw new APIError("FORBIDDEN", { code: ACCOUNT_INACTIVE_AUTH_CODE });
          }
        },
      },
    },
  },
  trustedOrigins: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
  // Lets non-browser callers (curl/Postman, and any client that can't rely on
  // cookies) authenticate with `Authorization: Bearer <token>` from the
  // sign-in response, in addition to the normal cookie session.
  plugins: [bearer()],
});
