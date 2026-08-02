import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The dev-mode indicator badge sits bottom-corner, the same spot our
  // mobile bottom nav's "More" button occupies.
  devIndicators: false,
};

export default withNextIntl(nextConfig);
