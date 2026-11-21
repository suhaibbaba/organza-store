import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import { dualPrefixCandidates, isValidE164 } from "@store/shared/lib/phone";

export { isValidE164, dualPrefixCandidates };

export async function findUserByPhoneField(field: "phone" | "whatsapp", value: string, excludeUserId?: string) {
  const candidates = dualPrefixCandidates(value);
  return prisma.user.findFirst({
    where: {
      [field]: { in: candidates },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

// Both prefixes are checked (rule 18), and the account itself is excluded so saving an unchanged number passes.
export async function assertPhonesAvailable(
  input: { phone?: string; whatsapp?: string | null },
  excludeUserId?: string,
) {
  if (input.phone) {
    const dupe = await findUserByPhoneField("phone", input.phone, excludeUserId);
    if (dupe) {
      throw new AppError(409, ERROR_CODES.PHONE_DUPLICATE);
    }
  }
  if (input.whatsapp) {
    const dupe = await findUserByPhoneField("whatsapp", input.whatsapp, excludeUserId);
    if (dupe) {
      throw new AppError(409, ERROR_CODES.WHATSAPP_DUPLICATE);
    }
  }
}
