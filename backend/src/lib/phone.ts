import { prisma } from "@/lib/prisma";
import { dualPrefixCandidates, isValidE164 } from "@organza/shared/lib/phone";

export { isValidE164, dualPrefixCandidates };

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
