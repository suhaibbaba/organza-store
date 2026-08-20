// Tailwind first, then the pass that makes its output readable on the oldest
// phone in the shop — @organza/shared/postcss-ios15 explains what it changes
// and why. Order matters: the second plugin works on the finished stylesheet,
// not on the two lines of source that generate it.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@organza/shared/postcss-ios15": {},
  },
};

export default config;
