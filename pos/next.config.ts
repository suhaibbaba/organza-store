import path from "path";
import { createRequire } from "module";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// In the service-worker URL: a new build id is what makes an installed app pick up the new worker.
const buildId = process.env.BUILD_ID ?? String(Date.now());

// Version staff quote when reporting a problem; NEXT_PUBLIC_APP_VERSION from the deploy always wins.
const { resolveAppVersion } = createRequire(__filename)(
  path.join(__dirname, "..", "shared", "scripts", "app-version.js"),
) as { resolveAppVersion: (options: { projectDir?: string; envValue?: string }) => string };

const appVersion = resolveAppVersion({
  projectDir: __dirname,
  envValue: process.env.NEXT_PUBLIC_APP_VERSION,
});

// Product images come from the backend origin, so next/image must allow-list it.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
// Local dev points at a loopback backend, which the optimizer otherwise refuses as an SSRF guard.
const isLocalApi = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";

// 30 days is safe: a stored photo URL never changes content (every upload or re-frame gets a new name).
const PRODUCT_IMAGE_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          // Revalidated on every check, or a phone keeps re-registering a cached old worker.
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
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
    minimumCacheTTL: PRODUCT_IMAGE_CACHE_TTL_SECONDS,
  },
  // @store/shared is a symlink out of the project; Turbopack only follows it with the root at the workspace.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // Standalone bundle for the Dockerfile's runtime stage, traced from the workspace root (hoisted deps + shared).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  // The dev badge sits where the POS pins its checkout bar.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
