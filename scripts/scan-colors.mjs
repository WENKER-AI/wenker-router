import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const root = 'H:/new/WENKER/client/src';
function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.jsx') || p.endsWith('.css') ? [p] : [];
  });
}
const counts = {};
for (const f of walk(root)) {
  const src = readFileSync(f, 'utf-8');
  for (const m of src.matchAll(/(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|placeholder|divide|outline)-(slate|cyan|blue|indigo|purple|sky|emerald|rose|amber)-(\d{2,3})(?:\/(\d{1,2}))?/g)) {
    const key = `${m[1]}-${m[2]}`;
    counts[key] = (counts[key] || 0) + 1;
  }
}
const byFamily = {};
for (const [k, v] of Object.entries(counts)) {
  const fam = k.split('-')[0];
  (byFamily[fam] = byFamily[fam] || []).push([k, v]);
}
for (const fam of Object.keys(byFamily).sort()) {
  const shades = [...new Set(byFamily[fam].map((x) => x[0].split('-')[1]).filter((s) => s === fam))];
  const list = byFamily[fam].sort((a, b) => b[1] - a[1]).map((x) => `${x[0]}:${x[1]}`);
  console.log(`\n[${fam}] total=${byFamily[fam].reduce((s, x) => s + x[1], 0)}`);
  console.log('  ' + list.join('  '));
}
