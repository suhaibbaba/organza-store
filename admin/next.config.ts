import path from "path";
import { createRequire } from "module";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Stamped into the service-worker URL by components/pwa/service-worker-
// registrar.tsx. A rebuild changes it, which is what makes an installed app
// pick up the new worker instead of sticking with the deployed-yesterday one.
// CI can pin it to a commit SHA by exporting BUILD_ID before `npm run build`;
// otherwise the build time stands in, which changes for exactly the same
// reason. Inlined into the client bundle at build time via `env` below, so
// the value `next start` would compute later never matters.
const buildId = process.env.BUILD_ID ?? String(Date.now());

// The version staff read out when they report a problem: "0.1" from this
// project's package.json plus the repo's commit count, so it moves forward on
// its own with every deploy (shared/scripts/app-version.js). Pulled in with
// createRequire rather than a plain import because it is a build-time
// CommonJS script living outside the app — the same reason __dirname works
// below.
//
// Inside a container there is no git history to count, so the deploy resolves
// the number on the host and passes it in as NEXT_PUBLIC_APP_VERSION; that
// always wins. It is stamped into the client bundle via `env` below, exactly
// like the build id.
const { resolveAppVersion } = createRequire(__filename)(
  path.join(__dirname, "..", "shared", "scripts", "app-version.js")
) as { resolveAppVersion: (options: { projectDir?: string; envValue?: string }) => string };

const appVersion = resolveAppVersion({
  projectDir: __dirname,
  envValue: process.env.NEXT_PUBLIC_APP_VERSION,
});

// Product images are served by the backend (stored-relative "/uploads/.."
// URLs resolved against NEXT_PUBLIC_API_URL — see components/products/
// product-image.tsx), so next/image needs that origin allow-listed here.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");
// The documented local-dev setup (.env.example) points at a loopback
// backend, which the image optimizer otherwise refuses to fetch from as an
// SSRF guard. Every real deployment (docker-compose.sandbox.yml, prod) uses
// a public hostname, so this only ever relaxes the check in local dev.
const isLocalApi = apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1";

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
          // The worker script must be revalidated on every check, or a phone
          // can keep re-registering a cached copy of an old worker.
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
  },
  // @shared/* resolves to ../shared/dist (see scripts/build-shared.js),
  // usually via a symlink/junction — Turbopack won't follow a symlink
  // outside the project root otherwise. Falls back to a plain copy on
  // platforms where symlinking isn't permitted, which this also covers.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // The dev-mode indicator badge sits bottom-corner, the same spot our
  // mobile bottom nav's "More" button occupies.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
