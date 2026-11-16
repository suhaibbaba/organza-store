// Every language has exactly the same keys, every static t('key') exists, and no Arabic or
// Hebrew text is written directly into a component.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = new URL('../src', import.meta.url).pathname;
const locales = join(src, 'i18n/locales');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
const keys = Object.fromEntries(
  ['ar', 'en', 'he'].map((l) => [
    l,
    new Set(flatten(JSON.parse(readFileSync(join(locales, `${l}.json`), 'utf8')))),
  ]),
);
const problems = [];
for (const l of ['en', 'he']) {
  for (const k of keys.ar) if (!keys[l].has(k)) problems.push(`${l}.json missing ${k}`);
  for (const k of keys[l]) if (!keys.ar.has(k)) problems.push(`${l}.json has extra ${k}`);
}
// Western digits only in messages (formatting rule).
for (const l of ['ar', 'en', 'he']) {
  const text = readFileSync(join(locales, `${l}.json`), 'utf8');
  if (/[٠-٩۰-۹]/.test(text)) problems.push(`${l}.json uses Arabic-Indic digits`);
}
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!full.endsWith('locales')) walk(full);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    const text = readFileSync(full, 'utf8');
    for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!keys.ar.has(match[1])) problems.push(`${full}: unknown key ${match[1]}`);
    }
    const code = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/[؀-ۿ֐-׿]/.test(code) && !full.includes('/lib/')) {
      problems.push(`${full}: Arabic or Hebrew literal; use a translation key`);
    }
  }
})(src);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
