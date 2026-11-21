import "dotenv/config";
import { APIError, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { TRUSTED_PROXY_IPS } from "@/lib/proxyTrust";
import {
  ACCOUNT_INACTIVE_AUTH_CODE,
  AUTH_DISABLED_PATHS,
  DEFAULT_SESSION_EXPIRES_IN_DAYS,
  SIGN_IN_EMAIL_PATH,
  SIGN_IN_RATE_LIMIT_MAX,
  SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants";

// Central Better Auth for admin, POS and storefront: email + password only, and no self-registration — staff accounts are created by an Admin or `npm run init`.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Better Auth serves a public POST /sign-up/email unless this is set; staff accounts are created through createStaffUser instead.
    disableSignUp: true,
  },
  disabledPaths: AUTH_DISABLED_PATHS,
  session: {
    expiresIn: 60 * 60 * 24 * Number(process.env.SESSION_EXPIRES_IN_DAYS ?? DEFAULT_SESSION_EXPIRES_IN_DAYS),
  },
  // The built-in 3-per-10s sign-in limit is spent by one shop behind one address; see constants/auth.ts.
  rateLimit: {
    customRules: {
      [SIGN_IN_EMAIL_PATH]: { window: SIGN_IN_RATE_LIMIT_WINDOW_SECONDS, max: SIGN_IN_RATE_LIMIT_MAX },
    },
  },
  advanced: {
    // Behind Cloudflare -> nginx the forwarded header has several hops, so without trusted proxies every caller shared one rate-limit bucket.
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
      // Not the owner's to change: phone/WhatsApp uniqueness across both prefixes (rule 18) is only checked by our own routes.
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
      // Written only by PATCH /api/me, so the audit trail sees it; sent with the session for the apps to apply at sign-in.
      locale: {
        type: "string",
        required: false,
        input: false,
      },
      idNumber: {
        type: "string",
        required: false,
        // Admin-only data (rule 19), written by PATCH /api/users/:id, never by the account owner.
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
        // A deactivated account cannot start a session; Better Auth knows nothing about isActive.
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
  // Bearer tokens for clients without cookies, alongside the cookie session.
  plugins: [bearer()],
});
