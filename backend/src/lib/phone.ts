import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "./prisma";

// Numbers are stored exactly as entered in E.164 (CLAUDE.md rule 18) — never
// reformatted/rewritten, so WhatsApp keeps reaching the number on its real
// prefix. This only validates the format.
export function isValidE164(value: string): boolean {
  if (!value.startsWith("+")) return false;
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(parsed?.isValid() && parsed.number === value);
}

// A Palestine line can be written under either +970 or +972. Uniqueness is
// enforced by checking BOTH prefixes, never by rewriting the number.
const PS_PREFIXES = ["+970", "+972"];

export function dualPrefixCandidates(value: string): string[] {
  const prefix = PS_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return [value];
  const national = value.slice(prefix.length);
  return PS_PREFIXES.map((p) => `${p}${national}`);
}

export async function findUserByPhoneField(
  field: "phone" | "whatsapp",
  value: string,
  excludeUserId?: string
) {
  const candidates = dualPrefixCandidates(value);
  return prisma.user.findFirst({
    where: {
      [field]: { in: candidates },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
