import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Product images are served by the backend (stored-relative "/uploads/.."
// URLs resolved against NEXT_PUBLIC_API_URL — see components/sell/
// product-thumb.tsx), so next/image needs that origin allow-listed here.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
// The documented local-dev setup (.env.example) points at a loopback
// backend, which the image optimizer otherwise refuses to fetch from as an
// SSRF guard. Every real deployment (docker-compose.sandbox.yml, prod) uses
// a public hostname, so this only ever relaxes the check in local dev.
const isLocalApi = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/uploads/**",
        search: "",
      },
    ],
    dangerouslyAllowLocalIP: isLocalApi,
  },
  // @shared/* resolves to ../shared/dist (see scripts/build-shared.js),
  // usually via a symlink/junction — Turbopack won't follow a symlink
  // outside the project root otherwise. Falls back to a plain copy on
  // platforms where symlinking isn't permitted, which this also covers.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // The dev-mode indicator badge sits bottom-corner, right where the POS
  // pins its checkout bar.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
