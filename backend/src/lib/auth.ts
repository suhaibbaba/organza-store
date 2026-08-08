import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SESSION_EXPIRES_IN_DAYS,
  SIGN_IN_EMAIL_PATH,
  SIGN_IN_RATE_LIMIT_MAX,
  SIGN_IN_RATE_LIMIT_WINDOW_SECONDS,
} from "@/constants";

// Central Better Auth instance — serves admin, pos, and (later) the storefront.
// Login is email + password only (phone is a contact field, not a login method).
// Password reset is admin-driven, so public sign-up stays disabled; staff
// accounts are provisioned server-side (see prisma/seed.ts and the future
// admin "create user" endpoint) via auth.api.signUpEmail / auth.api.setPassword.
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
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
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "EMPLOYEE",
        input: false, // role is set by an admin, never by the caller
      },
      phone: {
        type: "string",
        required: true,
        input: true,
      },
      whatsapp: {
        type: "string",
        required: false,
        input: true,
      },
      idNumber: {
        type: "string",
        required: false,
        input: true,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
  trustedOrigins: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
  // Lets non-browser callers (curl/Postman, and any client that can't rely on
  // cookies) authenticate with `Authorization: Bearer <token>` from the
  // sign-in response, in addition to the normal cookie session.
  plugins: [bearer()],
});
