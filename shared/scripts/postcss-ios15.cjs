"use strict";

/**
 * WHAT THE SHOP'S PHONES CANNOT READ, AND WHAT TO GIVE THEM INSTEAD.
 *
 * Both apps are built for the oldest phone on the floor — `ios_saf >= 15` in
 * each package.json — and the colours are handled before this runs:
 * @csstools/postcss-oklab-function derives a plain sRGB copy of every oklch()
 * and puts it in front. Three things get through that pass, and each one of
 * them was visible in the shop rather than in a build log. This plugin runs
 * last, on the finished stylesheet, and fixes all three.
 *
 * It has no dependencies of its own, deliberately: the one thing it needs to
 * know — what each colour is in plain sRGB — is already written in the sheet
 * by the pass in front of it, so it reads that rather than computing a second
 * opinion.
 *
 * ── 1. Cascade layers take the whole stylesheet with them ──────────────
 * `@layer` is Safari 15.4, and an at-rule a browser does not know is dropped
 * WITH ITS BLOCK. Tailwind v4 puts the whole of its output inside four of
 * them, so on iOS 15.0–15.3 the sheet does not degrade, it disappears, and
 * both apps render as unstyled HTML. The compiler will not remove them (layer
 * order changes the cascade, so it cannot know that flattening is safe) but
 * here we do know: Tailwind emits each layer once, in cascade order, into a
 * file already written in that order. Hoisting each block where it stands
 * leaves the same rules in the same sequence, decided by specificity the way
 * every stylesheet was decided before layers existed.
 *
 * ── 2. A tenth of a colour becomes the whole colour ────────────────────
 * `bg-destructive/10` compiles to `color-mix(in oklab, var(--destructive) 10%,
 * transparent)` — with, as its fallback, the SOLID colour. That is Tailwind's
 * own choice and it is a reasonable one in general; here it is how a badge
 * ends up red text on a red pill, and a "10% wash" background paints at full
 * strength behind text chosen to sit on a wash. color-mix is Safari 16.2, so
 * every iOS 15 and every iOS 16.0/16.1 device sees the fallback: 94 places
 * across the two apps, which is most of the badges, every soft-tinted card and
 * every hover state.
 *
 * The fallback is rewritten to `rgb(var(--token-rgb) / 10%)` — the same colour
 * at the same alpha, in a form Safari has understood since 12.1 — and the
 * channel triplets it needs are generated beside every colour token in the
 * sheet (pass 3). The `color-mix()` inside the `@supports` is left exactly as
 * it was, so a modern browser renders precisely what it rendered before.
 *
 * ── 3. Dynamic viewport units ──────────────────────────────────────────
 * `dvh` is Safari 15.4 and a declaration using one is thrown away, so
 * `min-height: 100dvh` leaves the app shell and every centred sign-in screen
 * with no height at all. `vh` is what those screens used before dvh existed.
 *
 * What this leaves behind is checked on the emitted CSS by
 * shared/scripts/check-css-target.js, which fails the build if a colour, a
 * length or a whole layer ever reaches the shop unreadable again.
 */

/** `100dvh` → `100vh`, `calc(100dvh - 3rem)` → `calc(100vh - 3rem)`. */
const DYNAMIC_VIEWPORT_UNIT = /(\d)(dvh|svh|lvh|dvmin|lvmin|svmin|dvmax|lvmax|svmax|dvw|svw|lvw)\b/g;

/** Tailwind's opacity modifier, exactly as it emits it. */
const TOKEN_ALPHA_MIX = /^color-mix\(in oklab, var\((--[\w-]+)\) ([\d.]+)%, transparent\)$/;


const CHANNEL_SUFFIX = "-rgb";

function toStaticViewportUnits(value) {
  return value.replace(DYNAMIC_VIEWPORT_UNIT, (_m, digit, unit) => `${digit}v${unit.slice(1)}`);
}

/** Is this declaration inside an `@supports`? Those hold the wider-gamut copies. */
function insideSupports(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule" && parent.name === "supports") return true;
  }
  return false;
}

/** Has an earlier declaration of the same property already given a usable value? */
function alreadyHasFallback(decl, isUnusable) {
  const siblings = decl.parent && decl.parent.nodes ? decl.parent.nodes : [];
  for (const node of siblings) {
    if (node === decl) return false;
    if (node.type === "decl" && node.prop === decl.prop && !isUnusable(node.value)) return true;
  }
  return false;
}

/**
 * Colour values → sRGB channels ("34 92 99").
 *
 * Nothing is CONVERTED here, which is the point. By the time this plugin runs,
 * @csstools/postcss-oklab-function has already written a plain sRGB copy of
 * every colour in front of the oklch() it derived it from (postcss.config.mjs
 * explains the order), so the channels are sitting in the stylesheet waiting
 * to be read. This used to call Lightning CSS to work them out for itself —
 * a second opinion about what `--primary` is on an old phone, and one more
 * chance for the two to disagree by a shade. Reading the answer that is
 * already there cannot disagree with it, and takes a 10 MB native binary out
 * of the CSS build.
 *
 * A value it cannot read is simply left out of the map, and the token that
 * held it is not softened — see `isSoftenable` below.
 */
const PLAIN_SRGB = /^(#[0-9a-f]{3,8}|rgba?\()/i;

/** "#225c63" or "rgb(34, 92, 99)" → "34 92 99". Alpha is dropped: the utility supplies its own. */
function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((d) => d + d).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
    return `${r} ${g} ${b}`;
  }
  const parts = value.match(/[\d.]+%?/g);
  if (!parts || parts.length < 3) return null;
  const channel = (part) => (part.endsWith("%") ? Math.round((parseFloat(part) / 100) * 255) : Math.round(parseFloat(part)));
  return `${channel(parts[0])} ${channel(parts[1])} ${channel(parts[2])}`;
}

module.exports = () => ({
  postcssPlugin: "organza-ios15",

  OnceExit(root, { result }) {
    // ---- 1. Cascade layers ------------------------------------------------
    // Done first: hoisting moves declarations, and the passes below read a
    // declaration's siblings to decide what it already has.
    let flattened = 0;
    for (let pass = 0; pass < 10; pass += 1) {
      const layers = [];
      root.walkAtRules("layer", (atRule) => layers.push(atRule));
      if (layers.length === 0) break;
      for (const atRule of layers) {
        // `@layer utilities { … }` keeps its rules, in place, and loses only
        // the wrapper. `@layer theme, base, components;` is an ordering
        // statement with nothing in it, and says nothing once nothing is
        // layered.
        if (atRule.nodes) atRule.replaceWith(atRule.nodes);
        else atRule.remove();
        flattened += 1;
      }
    }

    // ---- 2. Opacity modifiers --------------------------------------------
    // By the time this runs the sheet is flat: Tailwind has already lifted its
    // @supports blocks out of the rules they belong to, so the two halves of
    // an opacity modifier sit apart —
    //
    //   .bg-destructive\/10        { background-color: var(--destructive) }
    //   @supports (color-mix …) {
    //     .bg-destructive\/10      { background-color: color-mix(…10%…) }
    //   }
    //
    // — and the first half is regularly SHARED with the solid utility
    // (`.bg-primary,.bg-primary\/5{…}`), which must keep its full-strength
    // colour. So each rewrite is matched by selector and property, and a
    // shared rule is left alone in favour of a new single-selector rule right
    // after it: same specificity, later in the sheet, so it wins for that one
    // class and touches nothing else.
    const fallbacks = [];
    root.walkRules((rule) => {
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule" && parent.name === "supports") return;
      }
      for (const node of rule.nodes ?? []) {
        if (node.type === "decl") fallbacks.push({ rule, decl: node });
      }
    });

    const alphaUses = [];
    root.walkAtRules("supports", (atRule) => {
      if (!atRule.params.includes("color-mix")) return;
      atRule.walkRules((rule) => {
        for (const node of rule.nodes ?? []) {
          if (node.type !== "decl") continue;
          const match = node.value.match(TOKEN_ALPHA_MIX);
          if (!match) continue;
          const [, token, percent] = match;
          for (const selector of rule.selectors) {
            // The last one wins on a browser that reads them all, so it is
            // the one the older browser is actually left with.
            const candidates = fallbacks.filter(
              ({ rule: candidateRule, decl }) =>
                decl.prop === node.prop &&
                decl.value === `var(${token})` &&
                candidateRule.selectors.includes(selector)
            );
            const target = candidates[candidates.length - 1];
            if (target) alphaUses.push({ ...target, selector, token, percent });
          }
        }
      });
    });

    // Every value each token is given OUTSIDE an @supports — which is exactly
    // the plain sRGB layer, since that is where the oklab plugin puts the copy
    // it derived and where Tailwind puts the sRGB half of its own palette. The
    // wider-gamut restatements inside an @supports are the same colour again
    // for a browser that will never need these channels, so they are not read.
    //
    // A palette declares each token at least twice, once for the light theme
    // and once for the dark, and a rewrite is only safe if EVERY one of them
    // can be read. Softening a token whose dark value could not be would leave
    // `rgb(var(--x-rgb) / 10%)` pointing at a property that does not exist in
    // the dark theme, and an undefined var() paints nothing at all — worse
    // than the solid colour this replaces.
    const tokenValues = new Map();
    if (alphaUses.length > 0) {
      const wanted = new Set(alphaUses.map((use) => use.token));
      root.walkDecls((decl) => {
        if (!wanted.has(decl.prop) || insideSupports(decl)) return;
        if (!tokenValues.has(decl.prop)) tokenValues.set(decl.prop, new Set());
        tokenValues.get(decl.prop).add(decl.value.trim());
      });
    }

    const channels = new Map();
    for (const values of tokenValues.values()) {
      for (const value of values) {
        if (channels.has(value) || !PLAIN_SRGB.test(value)) continue;
        const rgb = parseColor(value);
        if (rgb) channels.set(value, rgb);
      }
    }
    const isSoftenable = (token) => {
      const values = tokenValues.get(token);
      return Boolean(values) && values.size > 0 && [...values].every((value) => channels.has(value));
    };

    let rewritten = 0;
    for (const { rule, decl, selector, token, percent } of alphaUses) {
      if (!isSoftenable(token)) continue;
      // The same colour at the same strength, in a syntax Safari has read
      // since 12.1 — and still a var(), so a theme that redefines the token
      // redefines this with it.
      const softened = `rgb(var(${token}${CHANNEL_SUFFIX}) / ${percent}%)`;
      if (rule.selectors.length === 1) {
        decl.value = softened;
      } else {
        rule.after(rule.clone({ selectors: [selector], nodes: [decl.clone({ value: softened })] }));
      }
      rewritten += 1;
    }

    // Nothing softened, but something to soften: the plain sRGB copies this
    // pass reads are not in the stylesheet, which in practice means
    // @csstools/postcss-oklab-function is no longer running in front of this
    // plugin (see postcss.config.mjs). Left alone it is a SILENT regression —
    // every tinted badge quietly goes back to painting at full strength, and
    // check-css-target.js does not object because a color-mix() with a
    // fallback behind it is not "nothing to read", just the wrong thing. So it
    // is caught here, where the count is known.
    if (alphaUses.length > 0 && rewritten === 0) {
      throw new Error(
        `organza-ios15: found ${alphaUses.length} opacity-modifier fallback(s) and could soften none of them. ` +
          "This pass reads the plain sRGB colours that @csstools/postcss-oklab-function writes — check it still runs " +
          "before this plugin in postcss.config.mjs."
      );
    }
    // One token that could not be read is not a misconfiguration, but it does
    // mean those badges paint solid, so it is said out loud rather than
    // absorbed.
    for (const token of new Set(alphaUses.map((use) => use.token))) {
      if (isSoftenable(token)) continue;
      result.warn(
        `organza-ios15: ${token} has no plain sRGB value to read, so its tinted backgrounds keep Tailwind's solid fallback on Safari < 16.2.`
      );
    }

    // ---- 3. Channel triplets beside every token that needs one ------------
    // Beside EVERY declaration of the token rather than once in :root, so the
    // dark theme's own value carries its own channels.
    let generated = 0;
    if (rewritten > 0) {
      const needed = new Set(alphaUses.filter((use) => isSoftenable(use.token)).map((use) => use.token));
      root.walkDecls((decl) => {
        if (!needed.has(decl.prop)) return;
        const rgb = channels.get(decl.value.trim());
        if (!rgb) return;
        const channelProp = `${decl.prop}${CHANNEL_SUFFIX}`;
        const siblings = decl.parent?.nodes ?? [];
        if (siblings.some((node) => node.type === "decl" && node.prop === channelProp)) return;
        decl.cloneAfter({ prop: channelProp, value: rgb });
        generated += 1;
      });
    }

    // ---- 4. Dynamic viewport units ---------------------------------------
    let viewportFallbacks = 0;
    root.walkDecls((decl) => {
      DYNAMIC_VIEWPORT_UNIT.lastIndex = 0;
      if (!DYNAMIC_VIEWPORT_UNIT.test(decl.value)) return;
      if (alreadyHasFallback(decl, (value) => DYNAMIC_VIEWPORT_UNIT.test(value))) return;
      // The plain unit first, the dynamic one straight after: a browser that
      // knows `dvh` overwrites the fallback, one that does not never sees it.
      decl.cloneBefore({ value: toStaticViewportUnits(decl.value) });
      viewportFallbacks += 1;
    });

    if (process.env.ORGANZA_CSS_DEBUG) {
      console.log(
        `organza-ios15: flattened ${flattened} layer(s), softened ${rewritten} of ${alphaUses.length} tinted fallback(s) ` +
          `with ${generated} channel token(s), added ${viewportFallbacks} viewport fallback(s)`
      );
    }
  },
});

module.exports.postcss = true;
