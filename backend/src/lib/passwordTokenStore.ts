import { prisma } from "@/lib/prisma";
import { createPasswordTokenService } from "@/lib/passwordTokens";
import type { PasswordTokenService, PasswordTokenStore } from "@/types/passwordSetup";

// The Prisma half of the token service. Everything interesting about the
// flow lives in lib/passwordTokens.ts; this file only knows how to read and
// write rows.

export const prismaPasswordTokenStore: PasswordTokenStore = {
  async create(input) {
    return prisma.passwordSetupToken.create({
      data: input,
      select: { id: true, userId: true, tokenHash: true, purpose: true, expiresAt: true, usedAt: true },
    });
  },

  async findByHash(tokenHash) {
    return prisma.passwordSetupToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, tokenHash: true, purpose: true, expiresAt: true, usedAt: true },
    });
  },

  async markUsed(id, usedAt) {
    // `usedAt: null` in the WHERE is what makes redemption single-use under
    // concurrency: the second caller updates zero rows and is told so.
    const result = await prisma.passwordSetupToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt },
    });
    return result.count === 1;
  },

  async revokeAllForUser(userId) {
    // Outstanding links are deleted rather than marked used — there is
    // nothing to learn later from a link nobody clicked, and a row that is
    // gone cannot be resurrected by a bug.
    const result = await prisma.passwordSetupToken.deleteMany({ where: { userId, usedAt: null } });
    return result.count;
  },
};

export const passwordTokens: PasswordTokenService = createPasswordTokenService({
  store: prismaPasswordTokenStore,
});
