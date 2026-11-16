import { z } from "zod";
import { IMAGE_ROTATIONS } from "../constants/image";

// What the admin's photo editor sends with an upload, and what the re-crop
// endpoint takes on its own (CLAUDE.md rule 8: validate every input with Zod,
// shared schemas where possible). The geometry that reads it lives next door
// in lib/imageEdit.ts; this is only the shape.

// Fractions of the frame the person was looking at. Bounded at both ends so
// a crop can never ask sharp for a region outside the file — the geometry
// clamps as well, but a value out here is a bad request and should be
// answered as one rather than quietly corrected.
const fraction = z.number().min(0).max(1);

export const imageCropSchema = z
  .object({
    x: fraction,
    y: fraction,
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  // A rectangle that runs off the edge of the frame is not a rectangle the
  // editor can have drawn; it is a client bug or a hand-written request.
  .refine((crop) => crop.x + crop.width <= 1 + 1e-6 && crop.y + crop.height <= 1 + 1e-6);

export const imageEditSchema = z.object({
  crop: imageCropSchema.nullable().default(null),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
});

export type ImageEditInput = z.infer<typeof imageEditSchema>;

/** Runtime guard for the rotations above, for callers holding a loose number. */
export function isImageRotation(value: number): value is (typeof IMAGE_ROTATIONS)[number] {
  return (IMAGE_ROTATIONS as readonly number[]).includes(value);
}
