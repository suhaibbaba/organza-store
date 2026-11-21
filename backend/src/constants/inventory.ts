export * from "@organza/shared/constants/inventory";

// The one photo a row shows: the primary, else the first by order (spec.md: lowest sortOrder = primary).
export const MAIN_IMAGE_ONLY = {
  orderBy: [{ isPrimary: "desc" as const }, { sortOrder: "asc" as const }],
  take: 1,
  select: { thumbnailUrl: true },
};
