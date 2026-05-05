export interface PrintSettings {
  barcodesPerRow: number;
  labelWidthMm: number;
  labelHeightMm: number;
  barcodeHeightPx: number;
  showProductName: boolean;
  showVariantLabel: boolean;
  showSku: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  barcodesPerRow: 3,
  labelWidthMm: 60,
  labelHeightMm: 30,
  barcodeHeightPx: 50,
  showProductName: true,
  showVariantLabel: true,
  showSku: true,
};

export interface OptionPreset {
  title: string;
  optionTitle: string;
  values: string[];
}

export interface FormOption {
  title: string;
  values: string[];
}

export interface FormVariant {
  id?: string;
  title: string;
  sku: string;
  barcode: string;
  options: Record<string, string>;
  price: number;
  stock: number;
  metadata: {
    barcode: string;
    barcode_is_printed: boolean;
  };
}

export interface ProductFormData {
  title: string;
  title_ar: string;
  subtitle: string;
  subtitle_ar: string;
  description: string;
  description_ar: string;
  handle: string;
  status: "draft" | "published";
  thumbnail: string;
  images: string[];
  collection_id: string;
  categoryIds: string[];
  type_id: string;
  tags: string[];
  weight: string;
  length: string;
  width: string;
  height: string;
  hs_code: string;
  material: string;
  origin_country: string;
  price: number;
  currency_code: string;
  hasVariants: boolean;
  options: FormOption[];
  variants: FormVariant[];
}
