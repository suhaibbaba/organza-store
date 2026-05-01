# Medusa Admin Mobile

A mobile-first product management app for Medusa Commerce.

## Features
- 📦 **Products** — list, create, edit with image upload
- 🔧 **Variants** — add/edit using existing options or create new ones
- 🏷️ **Barcode** — generate Code128 barcodes, download as PNG
- 📊 **Stock** — quick +/− stock update across all variants with low-stock alerts
- 🗂️ **Collections** — view and create collections

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000 on your phone (use your local network IP).

## Configuration

On login, tap "Configure backend" and enter your Medusa backend URL,
e.g. `http://192.168.1.10:9000` for local dev.

## Tech Stack
- Next.js 14 (App Router)
- Tailwind CSS
- JsBarcode (Code128)
- Sonner (toasts)
- Lucide React (icons)
