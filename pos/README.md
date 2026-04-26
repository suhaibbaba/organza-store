# Medusa POS

Modern TypeScript POS for Medusa v2 — with barcode scanning (USB + phone camera), bilingual Arabic/English, and full RTL support.

## Features

- 🛒 Fast cart with per-item and cart-wide discounts (% or fixed)
- 📷 **Barcode scanning** — USB scanners *and* phone camera (iOS Safari / Android Chrome)
- 🌍 **Arabic + English** with automatic RTL layout flip
- 💳 Payment method tracking (Cash / Card / Other)
- 🔍 Manual product search fallback
- 📱 Fully responsive — use as a cashier desktop or on your phone
- 🎨 Mantine UI with dark/light-ready theme
- 🔐 Uses your Medusa admin login + publishable API key

---

## ⚠️ Before You Start — One Critical Setup Step

The POS needs a **Publishable API Key** to look up products and their prices. This is different from your admin password.

### Create one in 30 seconds

1. Open your Medusa admin: `http://localhost:9000/app`
2. Go to **Settings** → **Publishable API Keys**
3. Click **Create API Key** → name it "POS"
4. Make sure it's linked to your **Sales Channel** (e.g. "Default Sales Channel")
5. Copy the key — it starts with `pk_...`

You'll paste this into the POS on first run.

---

## Install

```bash
cd medusa-pos
npm install
```

## Run (Development)

Make sure your Medusa backend is running on `http://localhost:9000`, then:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## First-Time Setup

1. **Click ⚙️ Settings** on the login screen
2. Paste your `pk_...` **Publishable API Key**
3. Leave **Backend URL** as `/medusa` for local dev
4. Click **Save**
5. Log in with your Medusa admin email + password
6. Select a **Region** from the dropdown (this determines the currency)
7. Start scanning!

---

## 📱 Using the Phone Camera Scanner

The camera scanner works on both iPhone and Android — no app install required.

### Setup

1. Make sure your phone is on the **same Wi-Fi** as your computer
2. Find your computer's local IP (usually `192.168.x.x`)
   - **Mac:** `ipconfig getifaddr en0`
   - **Linux:** `hostname -I`
   - **Windows:** `ipconfig` → look for "IPv4 Address"
3. On your phone, open: `http://YOUR_COMPUTER_IP:3000`

### ⚠️ Camera Permission Requires HTTPS

Modern browsers only grant camera access on **HTTPS** or **localhost**. For phone testing you have three options:

**Option A — Use ngrok (easiest, free)**

```bash
# Install once: https://ngrok.com/download
ngrok http 3000
```

Open the `https://xxx.ngrok.app` URL on your phone — camera will work.

**Option B — Use Chrome's flag (dev only)**

On Chrome desktop go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and add your local IP — this won't help on the phone itself.

**Option C — Deploy with real HTTPS**

Once deployed to your VPS with SSL, camera scanning works out of the box.

### How it works on phone

1. Tap the **📷 camera icon** next to the scanner input
2. Browser asks for camera permission → tap **Allow**
3. Point the **back camera** at a barcode
4. Auto-detects Code128, EAN-13, EAN-8, UPC-A, UPC-E, Code39, and QR codes
5. Found product is instantly added to the cart

### If the camera won't open

- Close other apps using the camera
- On iPhone: Settings → Safari → Camera → Allow
- On Android: Chrome menu → Site Settings → Camera → Allow

---

## Using USB Barcode Scanners

USB/Bluetooth barcode scanners work automatically — they act like a keyboard. Just scan an item while the scanner input is focused (it always is on desktop), and the POS will look it up.

---

## If Prices Show as 0.00

Two likely reasons:

1. **No publishable API key set** — check Settings modal
2. **Variants have no prices** — in Medusa admin, open each variant and set a price for the active region's currency

To add a price quickly:
- Medusa Admin → Products → (your product) → click a variant
- Prices tab → add price → pick currency → save

---

## Switching Language

- Click the ⚙️ menu (top right) → **Language**
- The whole layout flips to RTL when you pick Arabic, and back to LTR for English
- Preference is saved in localStorage

---

## Project Structure

```
src/
├── api/
│   └── client.ts           # All Medusa API calls (typed)
├── components/
│   ├── LoginScreen.tsx     # Login + settings
│   ├── POSScreen.tsx       # Main POS (cart, scanner, checkout)
│   ├── CartLineRow.tsx     # Single cart row with controls
│   ├── SummaryPanel.tsx    # Totals + payment + checkout button
│   ├── SearchModal.tsx     # Manual product search
│   ├── BarcodeScannerModal.tsx  # Phone camera scanner
│   └── SettingsModal.tsx   # Backend URL + publishable key
├── hooks/
│   └── useCurrency.ts      # Currency formatter (uses region's currency)
├── i18n/
│   ├── index.ts            # i18next setup + RTL application
│   ├── en.json             # English strings
│   └── ar.json             # Arabic strings
├── lib/
│   └── storage.ts          # localStorage helpers
├── types.ts                # Shared TypeScript types
├── App.tsx                 # Login ↔ POS routing
└── main.tsx                # Root render + Mantine provider
```

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Serve it via Nginx on your VPS alongside Medusa.

### Production Notes

- Update **Backend URL** in Settings to your live Medusa URL (e.g. `https://api.yourdomain.com`)
- Enable HTTPS — required for camera scanning on phones
- Set stricter CORS on your Medusa backend: allow only your POS domain

## Troubleshooting

| Problem | Fix |
|---|---|
| `"Please set your Publishable API Key"` | Open Settings (⚙️) and paste your `pk_...` key |
| Login works but products won't load | Publishable key not linked to a sales channel — fix in admin |
| Prices show `0.00` | Variants missing prices in Medusa admin |
| Camera won't open on phone | Must use HTTPS (use ngrok for testing) |
| USB scanner types into wrong field | Click anywhere on the cart area; the input re-focuses automatically |
| Arabic layout looks broken | Reload page after switching language (we do this automatically) |
| `"Unauthorized"` error | JWT expired — log out and back in |

## Hardware Compatibility

- ✅ USB barcode scanners (HID keyboard mode)
- ✅ Bluetooth barcode scanners (HID mode)
- ✅ Phone cameras (iOS 14.3+, Android Chrome)
- ✅ Tablets (iPad / Android)

## License

MIT
