
// ── Default option presets shown when creating a new product ──
export interface OptionPreset {
  key: string
  labelEn: string
  labelAr: string
  values: string[]
}

export const OPTION_PRESETS: OptionPreset[] = [
  {
    key: 'size_eu',
    labelEn: 'Size (EU Shoes)',
    labelAr: 'المقاس (أوروبي أحذية)',
    values: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  },
  {
    key: 'size_clothing',
    labelEn: 'Size (Clothing)',
    labelAr: 'المقاس (ملابس)',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  },
  {
    key: 'size_kids',
    labelEn: 'Size (Kids)',
    labelAr: 'المقاس (أطفال)',
    values: ['2T', '3T', '4T', '5', '6', '7', '8', '10', '12', '14'],
  },
  {
    key: 'color',
    labelEn: 'Color',
    labelAr: 'اللون',
    values: ['أبيض / White', 'أسود / Black', 'رمادي / Gray', 'بيج / Beige', 'أحمر / Red', 'أزرق / Blue', 'أخضر / Green', 'أصفر / Yellow', 'وردي / Pink', 'بني / Brown', 'برتقالي / Orange'],
  },
  {
    key: 'material',
    labelEn: 'Material',
    labelAr: 'الخامة',
    values: ['قطن / Cotton', 'بوليستر / Polyester', 'جلد / Leather', 'كتان / Linen', 'صوف / Wool', 'حرير / Silk', 'قطيفة / Velvet'],
  },
  {
    key: 'storage',
    labelEn: 'Storage',
    labelAr: 'التخزين',
    values: ['64GB', '128GB', '256GB', '512GB', '1TB'],
  },
]
