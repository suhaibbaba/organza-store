// Three passes, and the order is the whole design.
//
//  1. Tailwind expands the two lines of source into the finished stylesheet.
//  2. @csstools/postcss-oklab-function reads every oklch() Tailwind emitted and
//     writes a plain sRGB copy in front of it, keeping the original inside an
//     @supports (preserve: true). The fallback is DERIVED, never typed: change a
//     colour and its fallback changes with it, because there is only ever one
//     colour in the source. It also cannot rescue a colour whose hue arrives
//     through a var() — it leaves those exactly as they were, which is why the
//     brand hues are literals (see the note at the top of globals.css) and why
//     check-css-target.js fails the build if one ever slips back.
//  3. @organza/shared/postcss-ios15 repairs what neither of the two above can:
//     cascade layers, Tailwind's color-mix() opacity modifiers, and dvh. Its
//     own header explains each pass.
//
// Each one works on the finished output of the one before it, never on source.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-oklab-function": { preserve: true },
    "@organza/shared/postcss-ios15": {},
  },
};

export default config;
