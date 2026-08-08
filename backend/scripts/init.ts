#!/usr/bin/env tsx
// ============================================================================
//  npm run init — create the shop's real staff accounts, once.
//
//  MANUAL ONLY. It is not in the deploy pipeline and must never be: it exists
//  to be run by hand at go-live, on a database that has just been migrated and
//  bootstrapped and has no users in it yet.
//
//  Each account is created with NO PASSWORD and is emailed a single-use
//  "set your password" link, so the only person who ever knows a password is
//  the person it belongs to. Nothing is printed that would let anybody in.
//
//  It REFUSES to run if any user already exists — there is no partial mode and
//  no "top up the ones that are missing". A database with a user in it is a
//  database somebody is already using, and this command's whole job is to
//  populate an empty one.
//
//  Phone numbers are asked for rather than invented (CLAUDE.md rule 18: phone
//  is required, unique, and reaches a real person).
// ============================================================================
import "dotenv/config";
import readline from "node:readline/promises";
import crypto from "node:crypto";
import { APIError } from "better-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidE164 } from "@/lib/phone";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import { emailConfig, isEmailConfigured } from "@/lib/email";
import { describeDatabase } from "@/lib/dangerousCommands";
import { createInitialStaff, InitRefusedError } from "@/lib/init";
import { INIT_FLAGS, INIT_STAFF_ACCOUNTS, type InitStaffAccount } from "@/constants/init";
import type { InitAccountDetails } from "@/types/init";
import { AUTH_PROVIDER_CREDENTIAL, PASSWORD_TOKEN_BYTES } from "@/constants";

const RULE = "═".repeat(74);

// --- flags: --phone email=+970… / --name email=Some Name --------------------

function parseKeyedFlags(argv: string[], flag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== flag) continue;
    const pair = argv[i + 1] ?? "";
    const at = pair.indexOf("=");
    if (at > 0) out.set(pair.slice(0, at).trim().toLowerCase(), pair.slice(at + 1).trim());
  }
  return out;
}

async function collectDetails(accounts: InitStaffAccount[], argv: string[]) {
  const phoneFlags = parseKeyedFlags(argv, INIT_FLAGS.phone);
  const nameFlags = parseKeyedFlags(argv, INIT_FLAGS.name);
  const interactive = process.stdin.isTTY === true;
  const rl = interactive ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  try {
    const resolved: InitAccountDetails[] = [];

    for (const account of accounts) {
      const key = account.email.toLowerCase();

      let name = nameFlags.get(key) ?? "";
      if (!name && rl) {
        const answer = (await rl.question(`\n${account.email} (${account.role})\n  name [${account.defaultName}]: `)).trim();
        name = answer || account.defaultName;
      }
      if (!name) name = account.defaultName;

      let phone = phoneFlags.get(key) ?? "";
      while (!isValidE164(phone)) {
        if (!rl) {
          throw new Error(
            `Missing or invalid phone number for ${account.email}.\n` +
              `Pass one per account, in E.164 (the prefix is never rewritten — CLAUDE.md rule 18):\n` +
              `    npm run init -- ${INIT_FLAGS.phone} ${account.email}=+970599123456`
          );
        }
        if (phone) console.log("  ↳ that is not a valid international number (E.164, e.g. +970599123456)");
        phone = (await rl.question("  phone (E.164, e.g. +970599123456): ")).trim();
      }

      resolved.push({ email: account.email, role: account.role, name, phone });
    }

    return resolved;
  } finally {
    rl?.close();
  }
}

async function main(): Promise<void> {
  console.log(RULE);
  console.log("  Organza — creating the shop's staff accounts");
  console.log(RULE);
  console.log(`  Database : ${describeDatabase()}`);
  console.log(`  Email    : ${isEmailConfigured() ? emailConfig().from : "NOT CONFIGURED (links will not be sent)"}`);
  console.log(RULE);

  // The refusal, before anything is asked for. createInitialStaff checks it
  // again for itself (it is that function's rule, not this file's) — this
  // early copy only exists so nobody is asked to type four phone numbers into
  // a prompt that was always going to refuse.
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.error(["", RULE, "  ⛔  REFUSING TO RUN — init", RULE, ...new InitRefusedError(existing).message.split("\n").map((line) => `  ${line}`), RULE, ""].join("\n"));
    process.exitCode = 1;
    return;
  }

  if (!isEmailConfigured()) {
    console.warn(
      "\n  ⚠️  No RESEND_API_KEY is set, so the set-password emails will NOT be delivered.\n" +
        "     The accounts will still be created; send the links afterwards from the\n" +
        "     admin's Users screen once email is configured.\n"
    );
  }

  const details = await collectDetails(INIT_STAFF_ACCOUNTS, process.argv.slice(2));

  console.log("");
  const results = await createInitialStaff(details, {
    countUsers: () => prisma.user.count(),

    async createAccount(account) {
      // Better Auth's sign-up insists on a password; this one is random, is
      // never printed, and is deleted two lines later. What remains is an
      // account with no usable credential until its owner sets one.
      const throwaway = crypto.randomBytes(PASSWORD_TOKEN_BYTES).toString("base64url");

      let userId: string;
      try {
        const result = await auth.api.signUpEmail({
          body: { email: account.email, password: throwaway, name: account.name, phone: account.phone },
        });
        userId = result.user.id;
      } catch (error) {
        if (error instanceof APIError) throw new Error(`Could not create ${account.email}: ${error.message}`);
        throw error;
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { role: account.role, isActive: true },
      });
      await prisma.account.updateMany({
        where: { userId: user.id, providerId: AUTH_PROVIDER_CREDENTIAL },
        data: { password: null },
      });
      return user;
    },

    sendInvite: (user) => sendPasswordSetupEmail(user, "SET"),
  });

  // "created" rather than "sent" when there is no provider: the accounts and
  // their links are real either way, but claiming a delivery that never
  // happened is exactly the kind of thing somebody would act on.
  const verb = isEmailConfigured() ? "link sent" : "link created (NOT emailed)";
  for (const result of results) {
    console.log(
      `  ✓ ${result.role.padEnd(8)} ${result.email} — ${verb}, valid until ${result.expiresAt.toISOString()}`
    );
  }

  console.log("");
  console.log(RULE);
  if (isEmailConfigured()) {
    console.log("  Done. Each person now sets their own password from the link in their email.");
  } else {
    console.log("  Done — but nothing was emailed. Configure RESEND_API_KEY, then send each");
    console.log("  person a link from the admin's Users screen.");
  }
  console.log("  Nobody — including whoever ran this — knows any of those passwords.");
  console.log(RULE);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
