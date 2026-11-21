import type { UpdateSettingInput } from "@store/shared/schemas/setting";

export type BrandImageKind = "logo" | "favicon";

// What Save will do to one branding image: upload a picked file, delete the current one, or nothing.
export type BrandImageChange =
  { readonly kind: "replace"; readonly file: File; readonly previewUrl: string } | { readonly kind: "remove" } | null;

export type BrandImageChanges = Record<BrandImageKind, BrandImageChange>;

export interface SaveSettingsInput {
  readonly payload: UpdateSettingInput | null;
  readonly images: BrandImageChanges;
  // Called as each image is stored, so a later failure leaves only the unsaved ones staged.
  readonly onImageSaved: (kind: BrandImageKind) => void;
}

export interface BrandImageFieldProps {
  readonly kind: BrandImageKind;
  // API-relative URLs of what is stored now (logo: one; favicon: the tab and home-screen sizes); null = nothing uploaded.
  readonly current: { readonly small: string; readonly large: string } | null;
  readonly change: BrandImageChange;
  readonly onChange: (change: BrandImageChange) => void;
  // The shop's name, drawn beside the favicon in the tab preview.
  readonly tabLabel: string;
}
