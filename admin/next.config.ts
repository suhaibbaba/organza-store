import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // @shared/* resolves to ../shared/dist (see package.json#build:shared) —
  // Turbopack won't follow symlinks outside the project root otherwise.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  // The dev-mode indicator badge sits bottom-corner, the same spot our
  // mobile bottom nav's "More" button occupies.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
