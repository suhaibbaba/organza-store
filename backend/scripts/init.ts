#!/usr/bin/env tsx
// npm run init — creates the shop's real staff once, by hand, from a JSON roster (never in the deploy).
import "dotenv/config";
import path from "node:path";
import { APIError } from "better-auth";
import { prisma } from "@/lib/prisma";
import { createStaffUser } from "@/lib/credentials";
import { sendPasswordSetupEmail } from "@/lib/passwordSetup";
import { emailConfig, isEmailConfigured } from "@/lib/email";
import { describeDatabase } from "@/lib/dangerousCommands";
import { createInitialStaff, InitRefusedError } from "@/lib/init";
import { applyStaffOverrides, loadStaffAccounts, resolveStaffFilePath } from "@/lib/staffAccounts";
import { INIT_FLAGS } from "@/constants/init";

const RULE = "═".repeat(74);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// --- flags: --phone email=+970… / --name email=Some Name --------------------

function parseKeyedFlags(argv: string[], flag: string): Map<string, string> {
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== flag) {
      continue;
    }
    const pair = argv[i + 1] ?? "";
    const at = pair.indexOf("=");
    if (at > 0) {
      out.set(pair.slice(0, at).trim().toLowerCase(), pair.slice(at + 1).trim());
    }
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const staffFile = resolveStaffFilePath(argv, REPO_ROOT);

  console.log(RULE);
  console.log("  Store Management — creating the shop's staff accounts");
  console.log(RULE);
  console.log(`  Database : ${describeDatabase()}`);
  console.log(`  Accounts : ${staffFile}`);
  console.log(`  Email    : ${isEmailConfigured() ? emailConfig().from : "NOT CONFIGURED (links will not be sent)"}`);
  console.log(RULE);

  // The roster is checked in full before the database is touched, so a bad entry never leaves half the accounts created.
  const details = applyStaffOverrides(
    loadStaffAccounts(staffFile),
    { names: parseKeyedFlags(argv, INIT_FLAGS.name), phones: parseKeyedFlags(argv, INIT_FLAGS.phone) },
    staffFile,
  );

  // Early copy of createInitialStaff's own refusal, so the roster is echoed before refusing.
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.error(
      [
        "",
        RULE,
        "  ⛔  REFUSING TO RUN — init",
        RULE,
        ...new InitRefusedError(existing).message.split("\n").map((line) => `  ${line}`),
        RULE,
        "",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`  About to create ${details.length} account(s):`);
  for (const account of details) {
    console.log(`    ${account.role.padEnd(8)} ${account.email}  ${account.name}  ${account.phone}`);
  }

  if (!isEmailConfigured()) {
    console.warn(
      "\n  ⚠️  No RESEND_API_KEY is set, so the set-password emails will NOT be delivered.\n" +
        "     The accounts will still be created; send the links afterwards from the\n" +
        "     admin's Users screen once email is configured.\n",
    );
  }

  console.log("");
  const results = await createInitialStaff(details, {
    countUsers: () => prisma.user.count(),

    async createAccount(account) {
      // The one path every staff account is born through (lib/credentials.ts); no password is minted at all.
      try {
        return await createStaffUser({
          email: account.email,
          name: account.name,
          role: account.role,
          phone: account.phone,
          whatsapp: null,
          idNumber: null,
        });
      } catch (error) {
        if (error instanceof APIError) {
          throw new Error(`Could not create ${account.email}: ${error.message}`);
        }
        throw error;
      }
    },

    sendInvite: (user) => sendPasswordSetupEmail(user, "SET"),
  });

  // "created", not "sent", without a provider: never claim a delivery that did not happen.
  const verb = isEmailConfigured() ? "link sent" : "link created (NOT emailed)";
  for (const result of results) {
    console.log(
      `  ✓ ${result.role.padEnd(8)} ${result.email} — ${verb}, valid until ${result.expiresAt.toISOString()}`,
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
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
