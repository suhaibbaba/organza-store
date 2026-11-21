"use strict";

/** Makes the CSS readable on iOS 15: flattens @layer, gives color-mix() fallbacks a real alpha, adds vh before dvh. Checked by check-css-target.js. */

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
    if (parent.type === "atrule" && parent.name === "supports") {
      return true;
    }
  }
  return false;
}

/** Has an earlier declaration of the same property already given a usable value? */
function alreadyHasFallback(decl, isUnusable) {
  const siblings = decl.parent && decl.parent.nodes ? decl.parent.nodes : [];
  for (const node of siblings) {
    if (node === decl) {
      return false;
    }
    if (node.type === "decl" && node.prop === decl.prop && !isUnusable(node.value)) {
      return true;
    }
  }
  return false;
}

/** Colour values to sRGB channels, read from the copies postcss-oklab-function already wrote; unreadable values are left out. */
const PLAIN_SRGB = /^(#[0-9a-f]{3,8}|rgba?\()/i;

/** "#225c63" or "rgb(34, 92, 99)" → "34 92 99". Alpha is dropped: the utility supplies its own. */
function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((d) => d + d).join("");
    }
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
    return `${r} ${g} ${b}`;
  }
  const parts = value.match(/[\d.]+%?/g);
  if (!parts || parts.length < 3) {
    return null;
  }
  const channel = (part) =>
    part.endsWith("%") ? Math.round((parseFloat(part) / 100) * 255) : Math.round(parseFloat(part));
  return `${channel(parts[0])} ${channel(parts[1])} ${channel(parts[2])}`;
}

module.exports = () => ({
  postcssPlugin: "store-ios15",

  OnceExit(root, { result }) {
    // 1. Cascade layers, first: the passes below read a declaration's siblings.
    let flattened = 0;
    for (let pass = 0; pass < 10; pass += 1) {
      const layers = [];
      root.walkAtRules("layer", (atRule) => layers.push(atRule));
      if (layers.length === 0) {
        break;
      }
      for (const atRule of layers) {
        // A layer block loses only its wrapper; an empty ordering statement is removed.
        if (atRule.nodes) {
          atRule.replaceWith(atRule.nodes);
        } else {
          atRule.remove();
        }
        flattened += 1;
      }
    }

    // 2. Opacity modifiers: matched by selector and property; a shared rule gets a new single-selector rule after it instead of a rewrite.
    const fallbacks = [];
    root.walkRules((rule) => {
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule" && parent.name === "supports") {
          return;
        }
      }
      for (const node of rule.nodes ?? []) {
        if (node.type === "decl") {
          fallbacks.push({ rule, decl: node });
        }
      }
    });

    const alphaUses = [];
    root.walkAtRules("supports", (atRule) => {
      if (!atRule.params.includes("color-mix")) {
        return;
      }
      atRule.walkRules((rule) => {
        for (const node of rule.nodes ?? []) {
          if (node.type !== "decl") {
            continue;
          }
          const match = node.value.match(TOKEN_ALPHA_MIX);
          if (!match) {
            continue;
          }
          const [, token, percent] = match;
          for (const selector of rule.selectors) {
            // The last one is what an older browser is left with.
            const candidates = fallbacks.filter(
              ({ rule: candidateRule, decl }) =>
                decl.prop === node.prop && decl.value === `var(${token})` && candidateRule.selectors.includes(selector),
            );
            const target = candidates[candidates.length - 1];
            if (target) {
              alphaUses.push({ ...target, selector, token, percent });
            }
          }
        }
      });
    });

    // Only plain sRGB values outside @supports are read, and a token is softened only if every theme's value could be read.
    const tokenValues = new Map();
    if (alphaUses.length > 0) {
      const wanted = new Set(alphaUses.map((use) => use.token));
      root.walkDecls((decl) => {
        if (!wanted.has(decl.prop) || insideSupports(decl)) {
          return;
        }
        if (!tokenValues.has(decl.prop)) {
          tokenValues.set(decl.prop, new Set());
        }
        tokenValues.get(decl.prop).add(decl.value.trim());
      });
    }

    const channels = new Map();
    for (const values of tokenValues.values()) {
      for (const value of values) {
        if (channels.has(value) || !PLAIN_SRGB.test(value)) {
          continue;
        }
        const rgb = parseColor(value);
        if (rgb) {
          channels.set(value, rgb);
        }
      }
    }
    const isSoftenable = (token) => {
      const values = tokenValues.get(token);
      return Boolean(values) && values.size > 0 && [...values].every((value) => channels.has(value));
    };

    let rewritten = 0;
    for (const { rule, decl, selector, token, percent } of alphaUses) {
      if (!isSoftenable(token)) {
        continue;
      }
      // Same colour and strength in syntax Safari 12.1 reads, still a var() so themes carry through.
      const softened = `rgb(var(${token}${CHANNEL_SUFFIX}) / ${percent}%)`;
      if (rule.selectors.length === 1) {
        decl.value = softened;
      } else {
        rule.after(rule.clone({ selectors: [selector], nodes: [decl.clone({ value: softened })] }));
      }
      rewritten += 1;
    }

    // Nothing softened but something to soften means postcss-oklab-function stopped running first: a silent regression, so fail loudly.
    if (alphaUses.length > 0 && rewritten === 0) {
      throw new Error(
        `store-ios15: found ${alphaUses.length} opacity-modifier fallback(s) and could soften none of them. ` +
          "This pass reads the plain sRGB colours that @csstools/postcss-oklab-function writes — check it still runs " +
          "before this plugin in postcss.config.mjs.",
      );
    }
    // One unreadable token means those badges paint solid, so say it.
    for (const token of new Set(alphaUses.map((use) => use.token))) {
      if (isSoftenable(token)) {
        continue;
      }
      result.warn(
        `store-ios15: ${token} has no plain sRGB value to read, so its tinted backgrounds keep Tailwind's solid fallback on Safari < 16.2.`,
      );
    }

    // 3. Channel triplets beside every declaration of a token, so the dark theme carries its own.
    let generated = 0;
    if (rewritten > 0) {
      const needed = new Set(alphaUses.filter((use) => isSoftenable(use.token)).map((use) => use.token));
      root.walkDecls((decl) => {
        if (!needed.has(decl.prop)) {
          return;
        }
        const rgb = channels.get(decl.value.trim());
        if (!rgb) {
          return;
        }
        const channelProp = `${decl.prop}${CHANNEL_SUFFIX}`;
        const siblings = decl.parent?.nodes ?? [];
        if (siblings.some((node) => node.type === "decl" && node.prop === channelProp)) {
          return;
        }
        decl.cloneAfter({ prop: channelProp, value: rgb });
        generated += 1;
      });
    }

    // ---- 4. Dynamic viewport units ---------------------------------------
    let viewportFallbacks = 0;
    root.walkDecls((decl) => {
      DYNAMIC_VIEWPORT_UNIT.lastIndex = 0;
      if (!DYNAMIC_VIEWPORT_UNIT.test(decl.value)) {
        return;
      }
      if (alreadyHasFallback(decl, (value) => DYNAMIC_VIEWPORT_UNIT.test(value))) {
        return;
      }
      // Plain unit first: a browser that knows dvh overrides it.
      decl.cloneBefore({ value: toStaticViewportUnits(decl.value) });
      viewportFallbacks += 1;
    });

    if (process.env.STORE_CSS_DEBUG) {
      console.log(
        `store-ios15: flattened ${flattened} layer(s), softened ${rewritten} of ${alphaUses.length} tinted fallback(s) ` +
          `with ${generated} channel token(s), added ${viewportFallbacks} viewport fallback(s)`,
      );
    }
  },
});

module.exports.postcss = true;
