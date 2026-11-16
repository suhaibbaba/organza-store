// Fails if the production build contains syntax or CSS that Safari 15.4 (the shop's iPhone 7
// Plus) cannot parse. Run after `vite build`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

const dist = process.argv[2] ?? new URL('../dist', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
})(dist);

const problems = [];

// Syntax Safari 15.4 lacks: class static blocks (16.4), regexp lookbehind (16.4), the v flag
// (17), and anything newer than ES2022 that acorn would accept at a later ecmaVersion.
function visit(node, file) {
  if (!node || typeof node.type !== 'string') return;
  if (node.type === 'StaticBlock') problems.push(`${file}: class static block`);
  if (node.type === 'Literal' && node.regex) {
    const { pattern, flags } = node.regex;
    if (/\(\?<[=!]/.test(pattern)) problems.push(`${file}: regexp lookbehind /${pattern}/`);
    if (flags.includes('v')) problems.push(`${file}: regexp v flag`);
  }
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) value.forEach((child) => visit(child, file));
    else if (value && typeof value === 'object' && typeof value.type === 'string')
      visit(value, file);
  }
}

for (const file of files.filter((f) => f.endsWith('.js'))) {
  const code = readFileSync(file, 'utf8');
  try {
    const ast = parse(code, { ecmaVersion: 2022, sourceType: 'module' });
    visit(ast, file);
  } catch (error) {
    problems.push(`${file}: does not parse as ES2022 (${error.message})`);
  }
  // `new RegExp("(?<=…")` strings are invisible to the AST check.
  if (/new RegExp\([^)]*\(\?<[=!]/.test(code)) problems.push(`${file}: RegExp() with lookbehind`);
}

const CSS_RULES = [
  [/@container\b/, 'container query (Safari 16)'],
  [/color-mix\(/, 'color-mix() (Safari 16.2)'],
  [/light-dark\(/, 'light-dark() (Safari 17.5)'],
  [/@scope\b/, '@scope (Safari 17.4)'],
  [/\{[^{}]*&[^{}]*\{/, 'native CSS nesting (Safari 16.5)'],
];
// Mantine's Pagination hides extra page dots below 400px with a container query. Safari 15
// skips the whole block, so the dots simply stay visible: harmless. Only these rules are allowed.
const ALLOWED_CONTAINER_RULES = [
  /@container \(width<=400px\)\{\.m_105fdbed\{display:none\}\}/g,
  /@container \(width<=400px\)\{\.m_10817321\{display:flex\}\}/g,
];
for (const file of files.filter((f) => f.endsWith('.css'))) {
  let css = readFileSync(file, 'utf8');
  for (const allowed of ALLOWED_CONTAINER_RULES) css = css.replace(allowed, '');
  for (const [pattern, label] of CSS_RULES)
    if (pattern.test(css)) problems.push(`${file}: ${label}`);
}

if (problems.length) {
  console.error(`Safari 15.4 check failed:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`Safari 15.4 check passed (${files.length} files).`);
