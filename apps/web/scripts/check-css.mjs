// Our own styles must not use features Safari 15 lacks (decision in docs/assumptions.md #3).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const banned = [
  [/@container\b/, 'container queries'],
  [/color-mix\(/, 'color-mix()'],
  [/light-dark\(/, 'light-dark()'],
  [/\boklch\(|\boklab\(/, 'oklch()/oklab() (write hex)'],
  [/@tailwind|tailwindcss/, 'Tailwind'],
];
const problems = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(css|tsx?)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      for (const [pattern, label] of banned)
        if (pattern.test(text)) problems.push(`${full}: ${label}`);
    }
  }
})(root);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
