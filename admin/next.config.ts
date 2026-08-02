import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
