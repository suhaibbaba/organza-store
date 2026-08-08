import type { Role } from "@shared/types/role";

// The shop's real staff, as agreed for go-live. Emails and roles are fixed
// here — they ARE the command; `npm run init` exists to create exactly these
// four accounts and nothing else.
//
// No passwords, anywhere: each account is created with none and its owner
// receives a single-use "set your password" link, so the only person who ever
// knows a password is the person it belongs to.
//
// `defaultName` is a starting point the command offers and the person running
// it confirms or corrects — it is somebody's actual name, and guessing one
// off an email address and then writing it into a live database without
// asking would be rude at best.

export interface InitStaffAccount {
  email: string;
  role: Role;
  defaultName: string;
}

export const INIT_STAFF_ACCOUNTS: InitStaffAccount[] = [
  { email: "rawandabdelhadi@gmail.com", role: "ADMIN", defaultName: "روان عبد الهادي" },
  { email: "abumajd99.nn@gmail.com", role: "ADMIN", defaultName: "أبو مجد" },
  { email: "shahdmeflh@gmail.com", role: "MANAGER", defaultName: "شهد مفلح" },
  { email: "jannah2642009@icloud.com", role: "MANAGER", defaultName: "جنة" },
];

/**
 * Phone is a required, unique field on every user (CLAUDE.md rule 18) and it
 * is a real contact number, so the command asks for one per account rather
 * than inventing something that would sit in the shop's contact list
 * pretending to be a person. Supplied interactively, or with these flags for
 * a scripted run:
 *
 *   npm run init -- --phone rawandabdelhadi@gmail.com=+970599123456 \
 *                   --name  rawandabdelhadi@gmail.com="روان عبد الهادي"
 */
export const INIT_FLAGS = { phone: "--phone", name: "--name" } as const;
