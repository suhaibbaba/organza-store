import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "./prisma";

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
    expiresIn: 60 * 60 * 24 * Number(process.env.SESSION_EXPIRES_IN_DAYS ?? 7),
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
