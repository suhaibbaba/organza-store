// Order matters: Tailwind, then derived sRGB fallbacks for oklch(), then postcss-ios15 (layers, color-mix, dvh).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-oklab-function": { preserve: true },
    "@store/shared/postcss-ios15": {},
  },
};

export default config;
