#!/usr/bin/env tsx
// ============================================================================
//  npm run init — create the shop's real staff accounts, once.
//
//  MANUAL ONLY. It is not in the deploy pipeline and must never be: it exists
//  to be run by hand at go-live, on a database that has just been migrated and
//  bootstrapped and has no users in it yet.
//
//  WHO it creates comes from a JSON roster read at run time, not from this
//  repo — see src/constants/init.ts for why, and staff.example.json for the
//  shape:
//
//      npm run init                                  # ../staff.json
//      npm run init -- --accounts /srv/staff.json    # somewhere else
//      ORGANZA_STAFF_FILE=/srv/staff.json npm run init
//
//  Each account is created with NO PASSWORD and is emailed a single-use
//  "set your password" link, so the only person who ever knows a password is
//  the person it belongs to. Nothing is printed that would let anybody in.
//
//  It REFUSES to run if any user already exists — there is no partial mode and
//  no "top up the ones that are missing". A database with a user in it is a
//  database somebody is already using, and this command's whole job is to
//  populate an empty one.
// ============================================================================
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
    if (argv[i] !== flag) continue;
    const pair = argv[i + 1] ?? "";
    const at = pair.indexOf("=");
    if (at > 0) out.set(pair.slice(0, at).trim().toLowerCase(), pair.slice(at + 1).trim());
  }
  return out;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const staffFile = resolveStaffFilePath(argv, REPO_ROOT);

  console.log(RULE);
  console.log("  Organza — creating the shop's staff accounts");
  console.log(RULE);
  console.log(`  Database : ${describeDatabase()}`);
  console.log(`  Accounts : ${staffFile}`);
  console.log(`  Email    : ${isEmailConfigured() ? emailConfig().from : "NOT CONFIGURED (links will not be sent)"}`);
  console.log(RULE);

  // The roster is read and checked in full BEFORE the database is touched, so
  // a typo in the fourth entry can never leave the first three created.
  const details = applyStaffOverrides(
    loadStaffAccounts(staffFile),
    { names: parseKeyedFlags(argv, INIT_FLAGS.name), phones: parseKeyedFlags(argv, INIT_FLAGS.phone) },
    staffFile
  );

  // The refusal, before anything is written. createInitialStaff checks it
  // again for itself (it is that function's rule, not this file's) — this
  // early copy only exists so the roster is echoed back before the refusal
  // rather than after it.
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
      ].join("\n")
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
        "     admin's Users screen once email is configured.\n"
    );
  }

  console.log("");
  const results = await createInitialStaff(details, {
    countUsers: () => prisma.user.count(),

    async createAccount(account) {
      // The same one path every staff account in the shop is born through
      // (lib/credentials.ts), which is the point: Better Auth's public
      // sign-up endpoint is disabled, and it had to be — it was reachable by
      // anybody on the internet. This writes through Better Auth's own
      // internal adapter instead.
      //
      // No password is minted at all, not even a throwaway to delete
      // afterwards, so at no moment does a working credential for this
      // account exist anywhere. Its owner sets one from the emailed link.
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
        if (error instanceof APIError) throw new Error(`Could not create ${account.email}: ${error.message}`);
        throw error;
      }
    },

    sendInvite: (user) => sendPasswordSetupEmail(user, "SET"),
  });

  // "created" rather than "sent" when there is no provider: the accounts and
  // their links are real either way, but claiming a delivery that never
  // happened is exactly the sort of thing somebody would act on.
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
    console.error(`\n${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
