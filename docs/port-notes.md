# Porting notes from the current system (read-only reference)

Source: `organza-store` on `sandbox`. Nothing there is modified; these are the parts carried over.

## Search
- `normalize`: strip tashkeel `[ً-ْٰ]`, `[إأآا]→ا`, `ى→ي`, `ة→ه`, `ؤ→و`, `ئ→ي`, lowercase, trim. Also Arabic-Indic digits → Latin.
- One `search_text` column per product (all languages joined, normalized), GIN `gin_trgm_ops`.
- Query: `word_similarity(q, search_text) > 0.35 OR search_text ILIKE '%q%'`, ordered by word_similarity desc. `word_similarity` not `similarity` because the text holds every language.
- Old system did not search items; new one also matches item SKU/barcode exactly and item option names.

## Images
- Sizes (largest side): thumbnail 300, medium 800, full 1600; WebP quality 82; original kept as `<uuid>-original.<ext>`.
- Allowed jpeg/png/webp, 10 MB default. Files flat in `UPLOAD_DIR`, served at `/uploads/<name>`.
- Pipeline order: autoOrient → extract(crop) → resize(inside, no enlargement) → flop → flip → rotate. Resize before rotate or sharp refuses "bad extract area".
- Edit stored as `{crop:{x,y,width,height} fractions | null, rotation 0|90|180|270, flipHorizontal, flipVertical}`; re-crop from original; new uuid per re-crop.
- Brightness (Rec.709 luma of the unturned crop) → numbered-shawl marker colour suggestion.
- Product image aspect 2:3 portrait.

## Hardware scanner
- Keydown capture listener on document; ignore when typing into inputs/contenteditable or with ctrl/meta/alt/composing/repeat.
- Map by `event.code` (physical key) through a US layout table, so an Arabic layout still yields Latin; CapsLock respected for letters.
- Max key gap 40 ms, min length 4, terminators Enter/NumpadEnter/Tab, dedupe 1000 ms.
- Camera: `html5-qrcode` loaded dynamically; formats EAN-13/8, UPC-A/E, Code128, Code39, QR.

## Barcodes and SKU
- EAN-13 in GS1 restricted range: prefix `200` + 9 random digits + check digit; up to 20 attempts.
- `normalizeBarcode` = Latin digits, strip whitespace; valid 4–48 chars `/^[0-9A-Za-z][0-9A-Za-z\-.\/+%$]*$/`.
- SKU `ORG-00042` (product number, padded 5) and `ORG-00042-1` (item number). Frozen at creation in the new system.

## Catalogue
- Translatable fields `{ar,en,he}`, `ar` default; display falls back current → ar → first non-empty.
- Global option types (color, size, number) and values with stable `key`; per-product option value notes.
- Numbered product: one item per number, photo point x/y in percent, marker text/background colours per product.
- Category tree with `isFavorite` (POS sidebar pin). Quick-sell states: quickSoldAt, completedAt, oneOffAt.

## Phone
- E.164 via libphonenumber-js; +970 and +972 treated as the same number for uniqueness (`phoneIdentityKey` = smallest of the two forms). Default country `+970`.

## Formatting
- Every number: `numberingSystem: 'latn'`; dates also `calendar: 'gregory'`. Money returned by the API as fixed 2-decimal strings; arithmetic half-up.
- Old currency setting default `ILS`.

## i18n
- ar (default), en, he; RTL for ar and he. Fonts: Cairo (Arabic), Noto Sans Hebrew, a Latin sans. Locale never from Accept-Language.

## Labels
- Thermal 50×30 mm one per page, or A4 grid 3×8 with margins 10/8/10/8 mm and 3 mm gaps. JsBarcode: EAN13 when 13 digits, else CODE128. Name, optional variant line, barcode; no price. Max batch 200. `labelsPrintedAt` drives the "not printed yet" queue.
