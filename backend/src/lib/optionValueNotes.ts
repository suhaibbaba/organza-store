import { normalizeOptionValueNote } from "@organza/shared/lib/optionValueNotes";
import type { OptionValueNoteInput } from "@organza/shared/schemas/product";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/response";
import { ERROR_CODES } from "@/constants";
import type { DbClient } from "@/types";

// Writing the notes a product carries on its option values (spec.md "Notes on
// a product's options").
//
// The scope is the whole point: a note belongs to (this product, this value),
// so "طول البنطلون ٩٥ سم" written against a pair of trousers' S can never
// appear on an abaya's S. That is the composite primary key, and it is why
// this never touches VariantOptionValue itself.
//
// Semantics, deliberately upsert-per-entry rather than replace-the-lot:
//   { optionValueId, note: {...} } — write (or overwrite) that value's note
//   { optionValueId, note: null }  — remove it
//   a value not mentioned at all   — left exactly as it was
// so a screen can send one changed note without having to resend the rest,
// and no note is ever lost to a request that simply did not know about it.

/**
 * Which option values this product is allowed to carry notes for: the values
 * belonging to the variant types the product uses.
 *
 * A note keyed to anything else would be invisible for ever — nothing draws a
 * value the product does not have — so it is refused by name rather than
 * stored where nobody will find it.
 */
export async function assertOptionValueNotesUsable(
  notes: OptionValueNoteInput[] | undefined,
  variantTypeIds: string[],
  client: DbClient = prisma
): Promise<void> {
  const optionValueIds = [...new Set((notes ?? []).map((entry) => entry.optionValueId))];
  if (optionValueIds.length === 0) return;

  const values = await client.variantOptionValue.findMany({
    where: { id: { in: optionValueIds } },
    select: { id: true, variantTypeId: true },
  });

  const found = new Map(values.map((value) => [value.id, value.variantTypeId]));
  const usableTypes = new Set(variantTypeIds);

  for (const id of optionValueIds) {
    const variantTypeId = found.get(id);
    // A value that does not exist at all is the same mistake reported the way
    // every other unknown value is.
    if (!variantTypeId) throw new AppError(400, ERROR_CODES.VARIANT_TYPE_VALUE_NOT_FOUND);
    if (!usableTypes.has(variantTypeId)) {
      throw new AppError(400, ERROR_CODES.PRODUCT_OPTION_NOTE_VALUE_NOT_USED);
    }
  }
}

/**
 * Applies a request's notes to one product.
 *
 * `variantTypeIds` is which types the product uses AFTER this request — the
 * selections being created, or the types already stored on an update — so a
 * note may be written in the same breath as the option it explains.
 */
export async function applyOptionValueNotes(
  productId: string,
  notes: OptionValueNoteInput[] | undefined,
  variantTypeIds: string[],
  client: DbClient = prisma
): Promise<void> {
  if (!notes?.length) return;

  // Last entry wins if the same value is sent twice, rather than two writes
  // racing to be the one that stuck.
  const byValueId = new Map(notes.map((entry) => [entry.optionValueId, entry.note]));
  await assertOptionValueNotesUsable(notes, variantTypeIds, client);

  for (const [optionValueId, raw] of byValueId) {
    // Blank in every language means the same thing as an explicit null: no
    // note. A form posts all three boxes whether or not they were filled in,
    // so this is the common way a note is cleared.
    const note = normalizeOptionValueNote(raw);
    if (note === null) {
      // Removing one that was never there is not an error — the caller asked
      // for "no note on this value", and that is what it now has.
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
