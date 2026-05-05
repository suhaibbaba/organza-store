# Organza Moda — Admin Product Management Tool

Build a full-stack **Next.js** admin panel (use the latest stable version) for managing products on a **Medusa v2** backend. This is for a fashion/clothing brand called **Organza Moda**. The app is bilingual (Arabic default, English toggle) with full RTL support.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js latest stable (App Router, TypeScript) |
| Styling | Tailwind CSS v3 + shadcn/ui |
| API | `@medusajs/js-sdk` v2 — **no raw fetch, no axios, only the SDK** |
| i18n | `next-intl` latest — Arabic default (`ar`), English toggle (`en`) |
| Server state | `@tanstack/react-query` v5 |
| Icons | `lucide-react` |
| Barcodes | `jsbarcode` (generate EAN-13), `html5-qrcode` (camera scan) |
| Fonts | **DM Sans** from Google Fonts (single font for both languages) |
| Brand color | `#235C63` (deep teal) |

---

## Environment Variables

```env
NEXT_PUBLIC_MEDUSA_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=your_publishable_key
```

---

## Critical Rules — Read These First

> Violating any of these rules will break the app. Follow them exactly.

### 1. SDK is the only HTTP layer
All API calls use `@medusajs/js-sdk` only. Never use `fetch()` or `axios` inside components or pages. There is no wrapper file (`medusa.ts`). Import `sdk` from `@/lib/sdk` and call methods directly:
```typescript
sdk.admin.product.list(params)
sdk.admin.product.create(body)
sdk.admin.product.update(id, body)
sdk.admin.product.delete(id)
sdk.admin.product.retrieve(id, { fields })
// Variants:
(sdk.admin.product as any).updateVariant(productId, variantId, body)
// Collections, categories, types:
sdk.admin.productCollection.list(...)
sdk.admin.productCategory.list(...)
sdk.admin.productType.list(...)
```

### 2. Middleware uses native fetch (not SDK)
The middleware runs on the Edge runtime where the Medusa SDK cannot run. It verifies the JWT by calling `fetch(`${MEDUSA_URL}/admin/users/me`, { Authorization: Bearer <token> })` directly.

### 3. RTL via hard navigation only
The language toggle must do `window.location.href = /${nextLocale}${currentPath}` — never `router.push()`. Using the router skips updating `<html dir>` which breaks RTL layout.

### 4. HTML dir set server-side
In `[locale]/layout.tsx`, the `<html>` tag must have `lang={locale}` and `dir={locale === "ar" ? "rtl" : "ltr"}`. Additionally add a `<LocaleEffect>` client component that calls `document.documentElement.dir = dir` on mount to keep it in sync after client hydration.

### 5. Medusa v2 variant payload format
```typescript
// CORRECT
options: { "Size": "S", "Color": "Red" }    // flat object on variant

// WRONG — do not do this
options: [{ option_id: "opt_123", value: "S" }]

// Product options format
options: [{ title: "Size", values: ["S", "M", "L"] }]

// NEVER send inventory_quantity on create — Medusa v2 rejects it
```

### 6. Price propagation
When the master price input changes, immediately update ALL variants' `price` field in form state. Show a confirmation: "Price applied to N variants."

### 7. Handle auto-generation
Auto-generate the URL handle from the English title using `slugify()`. If the handle already exists, append a short random suffix (e.g. `dress-summer-a3f2`). Only auto-generate on create — do not overwrite existing handle on edit.

### 8. Category pre-selection on edit
When loading a product for editing, always map: `categoryIds: (product.categories || []).map(c => c.id)`. This ensures checkboxes are pre-ticked.

### 9. Category dropdown on new product
The category multi-select must fetch all existing categories from Medusa (`sdk.admin.productCategory.list`) and display them as checkboxes. Include an inline "Create new category" option that creates it via `sdk.admin.productCategory.create` and immediately selects it.

### 10. Barcode stored in metadata
Each variant has two barcode-related metadata fields:
- `metadata.barcode` — the EAN-13 barcode string (auto-generated from SKU)
- `metadata.barcode_is_printed` — boolean, default `false`

These are stored in `metadata`, NOT in the top-level `barcode` field. The top-level `barcode` field on the variant can also be set for Medusa's native barcode lookup.

### 11. Print queue rules
The print queue page shows all variants where `metadata.barcode_is_printed !== true`. Each item displays:
- Product thumbnail (or placeholder icon if none)
- Product name (Arabic if available, else English)
- Variant label (e.g. "S / Red")
- Barcode preview

Actions:
- **Select individual items** via checkbox
- **Select All** button
- **Print Selected** or **Print All** — opens browser print preview (`window.print()`) with only the barcode labels rendered, no UI chrome
- **Mark as Printed** — calls `sdk.admin.product.updateVariant(productId, variantId, { metadata: { barcode_is_printed: true } })` for all selected items
- After printing, prompt user: "Mark these as printed?"

### 12. Print settings (persisted in localStorage)
```typescript
interface PrintSettings {
  barcodesPerRow: number;    // default: 3
  labelWidthMm: number;      // default: 60
  labelHeightMm: number;     // default: 30
  barcodeHeightPx: number;   // default: 50
  showProductName: boolean;  // default: true
  showVariantLabel: boolean; // default: true
  showSku: boolean;          // default: true
}
```
The print preview uses these settings to size and arrange labels. Settings page has number inputs and toggles for all fields.

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                      # Root layout — returns children only, no html tag
│   ├── globals.css                     # DM Sans font import + CSS variables + Tailwind
│   └── [locale]/
│       ├── layout.tsx                  # <html lang dir>, all providers
│       ├── page.tsx                    # Products list
│       ├── login/
│       │   └── page.tsx
│       ├── products/
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx
│       ├── barcodes/page.tsx
│       ├── print-queue/page.tsx
│       ├── stock/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── OrganzaLogo.tsx                 # SVG petal/flower logo
│   ├── layout/
│   │   ├── AppLayout.tsx               # Sidebar + Header wrapper
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── LanguageToggle.tsx          # Hard navigation locale switch
│   ├── products/
│   │   └── ProductForm.tsx             # Full product create/edit form
│   ├── barcodes/
│   │   ├── BarcodeLabel.tsx            # Renders JsBarcode SVG
│   │   └── BarcodeScanner.tsx          # html5-qrcode camera scanner
│   └── providers/
│       ├── ReactQueryProvider.tsx
│       └── LocaleEffect.tsx            # Client: sets document.dir
├── context/
│   ├── AuthContext.tsx                 # User state + logout
│   └── SettingsContext.tsx             # Print settings in localStorage
├── i18n/
│   ├── routing.ts
│   └── request.ts
├── lib/
│   ├── sdk.ts                          # Medusa SDK singleton + token helpers
│   ├── utils.ts                        # slugify, generateSKU, generateBarcode, cn, generateCombinations
│   └── defaults.ts                     # OPTION_PRESETS array
├── types/
│   └── index.ts                        # All TypeScript types
middleware.ts
messages/
├── ar.json
└── en.json
```

---

## src/lib/sdk.ts — Copy Exactly

```typescript
import Medusa from "@medusajs/js-sdk";

export const PRODUCT_FIELDS =
  "*variants,*variants.prices,*variants.options,*variants.options.option," +
  "*options,*options.values,*images,*collection,*categories,*tags,*type";

export const sdk = new Medusa({
  baseUrl: process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  auth: {
    type: "jwt",
    jwtTokenStorageMethod: "local",
    jwtTokenStorageKey: "organza_jwt",
  },
});

export const AUTH_COOKIE = "organza_token";

export function saveToken(token: string) {
  if (typeof document === "undefined") return;
  document.cookie =
    `${AUTH_COOKIE}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}
```

---

## middleware.ts — Copy Exactly

```typescript
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);
const AUTH_COOKIE = "organza_token";
const MEDUSA_URL = process.env.NEXT_PUBLIC_MEDUSA_URL || "http://localhost:9000";
const PUBLIC_PATHS = ["/login"];

function barePath(pathname: string) {
  return pathname.replace(/^\/(ar|en)/, "") || "/";
}
function detectLocale(pathname: string) {
  return pathname.startsWith("/en") ? "en" : "ar";
}
function isPublicPath(pathname: string) {
  const path = barePath(pathname);
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

// Edge runtime: verify JWT with native fetch — SDK cannot be used here
async function verifyToken(token: string): Promise<boolean> {
  if (!token || token.length < 10) return false;
  try {
    const res = await fetch(`${MEDUSA_URL}/admin/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return true; // fail open if Medusa server is unreachable
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const locale = detectLocale(pathname);
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    if (token && (await verifyToken(token))) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
    if (token) {
      // token exists but is invalid — clear it
      const res = intlMiddleware(request);
      res.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
      return res;
    }
    return intlMiddleware(request);
  }

  if (!token) {
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (!(await verifyToken(token))) {
    const url = new URL(`/${locale}/login`, request.url);
    const res = NextResponse.redirect(url);
    res.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
```

---

## i18n/routing.ts

```typescript
import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

---

## globals.css

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font: "DM Sans", system-ui, sans-serif;
  --brand: 185 48% 26%;       /* #235C63 */
  --brand-dark: 185 48% 18%;  /* #1a444a */
}

body {
  font-family: var(--font);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

/* Sidebar gradient */
.sidebar-gradient {
  background: linear-gradient(180deg, #1a444a 0%, #235C63 100%);
}

/* Button gradient */
.btn-brand {
  background: linear-gradient(135deg, #1a444a 0%, #235C63 100%);
}
```

---

## Tailwind Config

```javascript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: {
        50:  "#ecf5f6",
        100: "#c5e0e2",
        500: "#2d7d84",
        600: "#235C63",  // primary
        700: "#1a444a",  // dark
        900: "#091618",
      },
    },
    fontFamily: {
      sans: ["DM Sans", "system-ui", "sans-serif"],
    },
  },
},
```

---

## Auth Flow

```
1. Login page:
   const result = await sdk.auth.login("user", "emailpass", { email, password })
   const token = typeof result === "string" ? result : result.token
   saveToken(token)  // writes to localStorage (SDK) + cookie (middleware)

2. Verify role:
   const { user } = await sdk.admin.user.me()
   if (user.metadata?.role !== "admin" && user.metadata?.role !== "organza_staff") {
     show error "Access denied"
     return
   }

3. Set user in AuthContext, redirect to /${locale}

4. Logout:
   await sdk.auth.logout()
   clearToken()
   window.location.href = `/${locale}/login`
```

Only users with `metadata.role === "admin"` or `metadata.role === "organza_staff"` can access the app.

---

## Layout: [locale]/layout.tsx

```tsx
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const messages = await getMessages();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <LocaleEffect locale={locale} dir={dir} />
        <NextIntlClientProvider messages={messages}>
          <ReactQueryProvider>
            <AuthProvider>
              <SettingsProvider>
                {children}
                <Toaster position="bottom-right" richColors />
              </SettingsProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

## Sidebar

- Desktop: fixed left (LTR) or fixed right (RTL), `w-60`
- Mobile: slide-in drawer with overlay
- Background: `linear-gradient(180deg, #1a444a 0%, #235C63 100%)`
- Nav items: Products, Barcodes, Print Queue, Stock, Settings
- Active item: `background: rgba(255,255,255,0.18)` white text
- Inactive item: `color: rgba(255,255,255,0.55)` hover → white
- Bottom: LanguageToggle + user email + logout button
- AppLayout uses logical margin: `ms-60` (works for both LTR + RTL)

**LanguageToggle:**
```tsx
const switchLocale = () => {
  const next = locale === "ar" ? "en" : "ar";
  const path = window.location.pathname.replace(`/${locale}`, `/${next}`);
  window.location.href = path + window.location.search;
};
```

---

## ProductForm — Complete Specification

Built as **accordion sections**. Each section has an icon, a title, and collapses/expands with a chevron. Default open sections: General, Pricing.

### Section 1: General (open by default)
Fields:
- **Title (EN + AR)** — side-by-side bilingual: left column EN input `dir="ltr"`, right column AR input `dir="rtl"`. Each column has a small `EN` / `AR` badge.
- **Subtitle (EN + AR)** — same bilingual layout
- **Description (EN + AR)** — bilingual textareas (3 rows each)
- **Handle** — text input, `font-mono`, `dir="ltr"`. Auto-generated from EN title via `slugify()`. Shows hint: "Auto-generated from title". Edit freely on create; does not auto-update on edit.

Title EN metadata stored as `product.title`, AR as `product.metadata.title_ar`.
Same for subtitle and description.

### Section 2: Media
- Thumbnail URL input → live preview image below if URL is filled
- Additional images: URL list with delete (×) per item, add via input + Enter key

### Section 3: Organize
- **Status** — two buttons side by side: Draft / Published. Active = teal border + teal text. Not a dropdown.
- **Product Type** — searchable single-select (SearchSelect component). Shows existing types. "Create new" option inline. Calls `sdk.admin.productType.create({ value: name })`.
- **Collection** — searchable single-select. "Create new" inline. Calls `sdk.admin.productCollection.create({ title: name })`.
- **Categories** — searchable multi-select with checkboxes. **Must fetch ALL existing categories** via `sdk.admin.productCategory.list({ limit: 100 })` and show them. Pre-selects on edit via `categoryIds: product.categories.map(c => c.id)`. "Create new" inline. Calls `sdk.admin.productCategory.create({ name })`.
- **Tags** — chip input: type + Enter to add, × to remove each chip

### Section 4: Shipping
- 4-column grid: Weight (g), Length (mm), Width (mm), Height (mm) — number inputs
- 3-column grid: HS Code, Material, Origin Country — text inputs

### Section 5: Pricing (open by default)
- Price input with currency prefix label (e.g. `ILS`)
- Currency code input — 3 chars, uppercase, `dir="ltr"`, `font-mono`
- **When price changes → update ALL variants' prices in state at the same time**
- When variants exist, show info badge: "✓ Applied to all N variants"

### Variants Toggle (standalone card, not accordion)
Toggle switch labeled "Product has variants / المنتج له متغيرات". Turning off clears options and variants arrays.

### Section 6: Options (shows only when variants = true)
**Quick Add Presets bar:**
Clicking a preset button instantly adds that option with all its values pre-filled:
```
Size (Clothing)  → [XS, S, M, L, XL, XXL, XXXL]
Size (EU Shoes)  → [36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
Size (Kids)      → [2T, 3T, 4T, 5, 6, 7, 8, 10, 12, 14]
Color            → [أبيض/White, أسود/Black, رمادي/Gray, بيج/Beige, أحمر/Red, أزرق/Blue, وردي/Pink, بني/Brown]
Material         → [قطن/Cotton, بوليستر/Polyester, جلد/Leather, كتان/Linen, صوف/Wool, حرير/Silk]
```
Preset button shows ✓ and is disabled if already added.

**Option Row component** (one per option):
- Header: grip handle icon + editable name (pencil icon → inline text input) + delete (×) button
- Body: value chips with × to remove + text input to add new values (Enter key confirms)

**Custom option:** text input + Add button at bottom.

**Variant generation:** automatically rebuild the variants list whenever options change, using cartesian product of all option value combinations.

### Section 7: Variants Table (shows when variants exist, open by default)
Desktop table columns: Variant Label | SKU | Barcode | Stock (editable)
Mobile: stacked cards

- **SKU**: auto-generated: `generateSKU(productTitle, optionValues)` — e.g. `ORG-S-RED-3847`
- **Barcode**: auto-generated EAN-13: `generateBarcode(sku)` — deterministic from SKU
- **Stock**: editable number input per variant
- Both SKU and barcode are stored: SKU in `variant.sku`, barcode in `variant.metadata.barcode` AND `variant.barcode`

### Save Button
Full-width, teal gradient. Shows spinner while saving.
- Create: "Create Product" / "إنشاء المنتج"
- Edit: "Save Changes" / "حفظ التغييرات"

### Exact API Payload (Medusa v2)

```typescript
const body = {
  title: "My Product",
  subtitle: "Optional subtitle",
  description: "Product description",
  handle: "my-product-a3f2",
  status: "published",
  thumbnail: "https://...",
  images: [{ url: "https://..." }],
  collection_id: "col_xxx",
  categories: [{ id: "pcat_xxx" }],
  type_id: "ptyp_xxx",
  tags: [{ value: "summer" }],
  weight: 500,
  length: 300,
  width: 200,
  height: 100,
  hs_code: "6109.10",
  material: "Cotton",
  origin_country: "SA",
  metadata: {
    title_ar: "اسم المنتج",
    subtitle_ar: "العنوان الفرعي",
    description_ar: "الوصف",
  },
  // With variants:
  options: [
    { title: "Size", values: ["S", "M", "L"] },
    { title: "Color", values: ["Red", "Blue"] },
  ],
  variants: [
    {
      title: "S / Red",
      sku: "ORG-S-RED-3847",
      barcode: "1234567890128",           // top-level for Medusa search
      options: { "Size": "S", "Color": "Red" },  // flat object — NOT array
      prices: [{ currency_code: "ils", amount: 19900 }],
      metadata: {
        barcode: "1234567890128",          // also in metadata
        barcode_is_printed: false,
      },
      // DO NOT include inventory_quantity — Medusa v2 rejects it
    },
  ],
  // Without variants (simple product):
  variants: [
    {
      title: "Default Title",
      sku: "ORG-1234",
      barcode: "1234567890128",
      prices: [{ currency_code: "ils", amount: 19900 }],
      metadata: {
        barcode: "1234567890128",
        barcode_is_printed: false,
      },
    },
  ],
};
```

---

## src/lib/utils.ts — Key Functions

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Slugify for URL handle
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\u0600-\u06FF\s]+/g, "-")  // Arabic → dash
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Random 4-char suffix for duplicate handles
export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

// SKU: title initials + option value abbreviations + 4-digit hash
export function generateSKU(title: string, optionValues: string[] = []): string {
  const titleCode = title.trim().split(/\s+/).slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "X").join("");
  const optCodes = optionValues.map((v) =>
    v.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase()
  );
  const base = [titleCode, ...optCodes].filter(Boolean).join("-");
  let hash = 0;
  for (let i = 0; i < base.length; i++)
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  return `${base}-${String(Math.abs(hash) % 9000 + 1000)}`;
}

// Deterministic EAN-13 barcode from seed string
export function generateBarcode(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++)
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  const raw = String(Math.abs(hash)).padStart(12, "0").slice(0, 12);
  const sum = raw.split("").reduce((a, d, i) => a + parseInt(d) * (i % 2 === 0 ? 1 : 3), 0);
  return raw + (10 - (sum % 10)) % 10;
}

// Cartesian product for variant generation
export function generateCombinations(
  options: Array<{ title: string; values: string[] }>
): Array<Record<string, string>> {
  const filled = options.filter((o) => o.values.length > 0);
  if (!filled.length) return [];
  const cartesian = (arrays: string[][]): string[][] =>
    arrays.reduce(
      (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
      [[]] as string[][]
    );
  return cartesian(filled.map((o) => o.values)).map((combo) => {
    const result: Record<string, string> = {};
    filled.forEach((opt, i) => { result[opt.title] = combo[i]; });
    return result;
  });
}
```

---

## Pages

### Products List (`/[locale]`)
- 4-column grid (desktop), 2-column (tablet), 1-column (mobile)
- Product card: thumbnail or placeholder icon, status badge, title, variant count, collection name
- Status badge colors: `published`=green, `draft`=amber, `proposed`=blue, `rejected`=red
- Top bar: search input + status filter select + "Create Product" button (teal)
- Pagination: previous/next, show "X products · Page N/M"
- Delete: confirm dialog before deleting
- SDK calls: `sdk.admin.product.list(params)`, `sdk.admin.product.delete(id)`

### New Product (`/[locale]/products/new`)
- Renders `<ProductForm />` with `onSave` that calls `sdk.admin.product.create(body)`
- On success: toast "Product created" + navigate to edit page `/${locale}/products/${product.id}`
- Back button → navigate to `/`

### Edit Product (`/[locale]/products/[id]`)
- Fetch: `sdk.admin.product.retrieve(id, { fields: PRODUCT_FIELDS })`
- Skeleton while loading
- Renders `<ProductForm product={product} />` with `onSave` calling `sdk.admin.product.update(id, body)`
- On success: toast "Saved" + refetch

### Barcodes (`/[locale]/barcodes`)
- Search bar + camera scan button
- Camera scan uses `html5-qrcode` — on scan result set search input value
- Search across: barcode value, SKU, product title
- Data: `sdk.admin.product.list({ limit: 200, fields: PRODUCT_FIELDS })`
- Results grid: each card shows product name + variant + rendered JsBarcode SVG

### Print Queue (`/[locale]/print-queue`)
- Fetches all products + variants
- Shows only variants where `variant.metadata?.barcode_is_printed !== true`
- Toggle: "Show printed" to include already-printed items
- Each item card:
  - Checkbox for selection
  - Product thumbnail (small, fallback icon)
  - Product name (Arabic from `metadata.title_ar` if available)
  - Variant label
  - Barcode preview (small JsBarcode SVG)
- Toolbar buttons:
  - **Select All** (selects all unprinted)
  - **Print Selected** / **Print All** → triggers `window.print()` with only barcode labels visible
  - **Mark as Printed** → for each selected: `sdk.admin.product.updateVariant(productId, variantId, { metadata: { barcode_is_printed: true } })`

**Print layout** (CSS `@media print`):
```css
@media print {
  body > *:not(#print-root) { display: none !important; }
  #print-root { display: block; }
  .barcode-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols, 3), 1fr);
    gap: 2mm;
    padding: 5mm;
  }
  .barcode-cell {
    width: var(--label-w, 60mm);
    height: var(--label-h, 30mm);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 0.5px solid #ddd;
    padding: 2mm;
    page-break-inside: avoid;
  }
}
```

### Stock (`/[locale]/stock`)
- Table: Product name, Variant, SKU, Status badge, Quantity input, Save button
- Status: Out of stock (red, qty ≤ 0), Low stock (amber, qty < 5), In stock (green)
- Inline edit: change number → Save button appears → `sdk.admin.product.updateVariant(productId, variantId, { inventory_quantity: n })`
- Search filter across product name + variant label + SKU

### Settings (`/[locale]/settings`)
Two sections:

**Store:**
- Default currency (3-char code, stored in SettingsContext)

**Print Labels:**
- Barcodes per row: number input (default 3)
- Label width (mm): number input (default 60)
- Label height (mm): number input (default 30)
- Barcode height (px): number input (default 50)
- Toggle: Show product name
- Toggle: Show variant label
- Toggle: Show SKU
- All persisted in `localStorage` key `organza_settings`

---

## OrganzaLogo (SVG)

```tsx
export function OrganzaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="38" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <path
        d="M40 10 C52 10 62 20 62 32 C62 44 52 52 40 52 C28 52 18 44 18 32 C18 20 28 10 40 10Z"
        fill="rgba(255,255,255,0.15)"
      />
      <path
        d="M40 28 C52 28 62 38 62 50 C62 62 52 70 40 70 C28 70 18 62 18 50 C18 38 28 28 40 28Z"
        fill="rgba(255,255,255,0.15)"
      />
      <circle cx="40" cy="40" r="8" fill="rgba(255,255,255,0.9)" />
      <circle cx="40" cy="40" r="4" fill="rgba(35,92,99,0.8)" />
    </svg>
  );
}
```

---

## RTL Implementation Rules

- Use CSS logical properties throughout: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`
- Flex rows that need to flip: wrap in `cn("flex", isRtl && "flex-row-reverse")`
- Bilingual fields always show EN on the left half and AR on the right half (regardless of page direction)
- All English-only inputs: add `dir="ltr"` attribute
- All Arabic-only inputs: add `dir="rtl"` attribute
- Sidebar mobile drawer: `right-0` in AR, `left-0` in EN
- Icons that imply direction (arrows, chevrons): swap left↔right when RTL

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add button input label select switch dialog alert-dialog tabs card badge skeleton sonner separator
```

Customize the primary color in `components.json` and CSS variables to use `#235C63`.

---

## Design System

- **Background:** `#f0f6f6` (very light teal tint)
- **Cards:** `bg-white`, `rounded-2xl`, `border border-slate-100`, `shadow-sm`
- **Inputs:** `rounded-xl`, `border-slate-200`, focus ring `ring-[#235C63]/20 border-[#235C63]`
- **Primary button:** `background: linear-gradient(135deg, #1a444a 0%, #235C63 100%)` white text
- **Section headers (form field labels):** `text-xs font-bold uppercase tracking-wider text-slate-500`
- **Spacing between form sections:** `space-y-3`
- **Page enter animation:** fade + slide up (`opacity: 0 → 1`, `translateY: 6px → 0`)
- **Scrollbar:** thin, `5px`, rounded, `bg-border`
- **All rounded corners:** inputs `rounded-xl`, cards `rounded-2xl`, badges `rounded-full`
