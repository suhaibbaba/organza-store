import { parsePhoneNumberFromString } from "libphonenumber-js";
import { prisma } from "@/lib/prisma";
import { PALESTINE_PHONE_PREFIXES } from "@/constants";

// Numbers are stored exactly as entered in E.164 (CLAUDE.md rule 18) — never
// reformatted/rewritten, so WhatsApp keeps reaching the number on its real
// prefix. This only validates the format.
export function isValidE164(value: string): boolean {
  if (!value.startsWith("+")) return false;
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(parsed?.isValid() && parsed.number === value);
}

export function dualPrefixCandidates(value: string): string[] {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return [value];
  const national = value.slice(prefix.length);
  return PALESTINE_PHONE_PREFIXES.map((p) => `${p}${national}`);
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
