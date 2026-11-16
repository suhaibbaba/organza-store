// No inline styles (docs/design-system.md). Screens use the ds-* classes, shared/ui components,
// Mantine's component props (size, color, variant, gap, padding) and their own CSS module.
// Rejected: Mantine style props (c, fw, ta, mb, w, …) and `style` — except an object whose keys
// are all CSS custom properties, which passes data (a bar's height, a label's size) to CSS.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const STYLE_PROPS = [
  'm',
  'mt',
  'mb',
  'ms',
  'me',
  'ml',
  'mr',
  'mx',
  'my',
  'p',
  'pt',
  'pb',
  'ps',
  'pe',
  'pl',
  'pr',
  'px',
  'py',
  'w',
  'miw',
  'maw',
  'h',
  'mih',
  'mah',
  'c',
  'bg',
  'bga',
  'bgsz',
  'bgp',
  'bgr',
  'fz',
  'fw',
  'ff',
  'lh',
  'ta',
  'td',
  'tt',
  'fs',
  'lts',
  'opacity',
  'pos',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'display',
  'flex',
  'bd',
  'bdrs',
];
const propPattern = new RegExp(`(?<=\\s)(${STYLE_PROPS.join('|')})=[{"']`, 'g');
const problems = [];

function checkStyle(text, file) {
  const re = /\bstyle=\{/g;
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length;
    const rest = text.slice(m.index + m[0].length).trimStart();
    if (!rest.startsWith('{')) {
      problems.push(`${file}:${line}: style={…} — use a class (only {{ '--var': … }} is allowed)`);
      continue;
    }
    // Read the object literal up to its matching brace.
    let depth = 0;
    let end = 0;
    for (; end < rest.length; end++) {
      if (rest[end] === '{') depth++;
      else if (rest[end] === '}' && --depth === 0) break;
    }
    const body = rest.slice(1, end);
    const keys = [...body.matchAll(/(?:^|,)\s*(['"]?)([\w-]+)\1\s*:/g)].map((k) => k[2]);
    const bad = keys.filter((k) => !k.startsWith('--'));
    if (bad.length || keys.length === 0)
      problems.push(`${file}:${line}: inline style (${bad.join(', ') || 'spread'}) — use a class`);
  }
}

(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      const file = relative(root, full);
      checkStyle(text, file);
      for (const [i, lineText] of text.split('\n').entries())
        for (const m of lineText.matchAll(propPattern))
          if (/^\s*[<A-Za-z{}]|^\s+\w+=/.test(lineText) && !lineText.trim().startsWith('//'))
            problems.push(`${file}:${i + 1}: style prop ${m[1]}= — use a ds-* class`);
    }
  }
})(root);

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} inline style(s). See docs/design-system.md.`);
  process.exit(1);
}
console.log('No inline styles.');
