import { normalizeOptionValueNote } from "@store/shared/lib/optionValueNotes";
import type { OptionValueNoteInput } from "@store/shared/schemas/product";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types";

// A note belongs to (this product, this value), so one product's note never shows on another's same value.

/** Only values of the variant types this product uses may carry notes; anything else would never be seen, so it is refused. */
export async function assertOptionValueNotesUsable(
  notes: OptionValueNoteInput[] | undefined,
  variantTypeIds: string[],
  client: DbClient = prisma,
): Promise<void> {
  const optionValueIds = [...new Set((notes ?? []).map((entry) => entry.optionValueId))];
  if (optionValueIds.length === 0) {
    return;
  }

  const values = await client.variantOptionValue.findMany({
    where: { id: { in: optionValueIds } },
    select: { id: true, variantTypeId: true },
  });

  const found = new Map(values.map((value) => [value.id, value.variantTypeId]));
  const usableTypes = new Set(variantTypeIds);

  for (const id of optionValueIds) {
    const variantTypeId = found.get(id);
    // A value that does not exist at all is the same mistake reported the way every other unknown value is.
    if (!variantTypeId) {
      throw new AppError(400, ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND);
    }
    if (!usableTypes.has(variantTypeId)) {
      throw new AppError(400, ERROR_CODES.PRODUCT_OPTION_NOTE_VALUE_NOT_USED);
    }
  }
}

/** Applies a request's notes; `variantTypeIds` are the types after this request, so a note can come with its new option. */
export async function applyOptionValueNotes(
  productId: string,
  notes: OptionValueNoteInput[] | undefined,
  variantTypeIds: string[],
  client: DbClient = prisma,
): Promise<void> {
  if (!notes?.length) {
    return;
  }

  // Last entry wins if the same value is sent twice, rather than two writes racing to be the one that stuck.
  const byValueId = new Map(notes.map((entry) => [entry.optionValueId, entry.note]));
  await assertOptionValueNotesUsable(notes, variantTypeIds, client);

  for (const [optionValueId, raw] of byValueId) {
    // Blank in every language means no note — the usual way a note is cleared.
    const note = normalizeOptionValueNote(raw);
    if (note === null) {
      // Removing a note that was never there is not an error.
      await client.productOptionValueNote.deleteMany({ where: { productId, optionValueId } });
      continue;
    }
    await client.productOptionValueNote.upsert({
      where: { productId_optionValueId: { productId, optionValueId } },
      create: { productId, optionValueId, note },
      update: { note },
    });
  }
}
