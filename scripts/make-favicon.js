// Sinh favicon SVG (ch? W pixel) t? bitmap `w` trong web/assets/icons.js
// Ch?: node scripts/make-favicon.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'web', 'assets', 'icons.js'), 'utf8');

// L?y kh?i c?a icon `w` (b?t d?u sau "w: [" cho d?n "],")
const m = src.match(/\bw:\s*\[([\s\S]*?)\]/);
if (!m) throw new Error('Khong tim thay icon "w" trong icons.js');
const rows = [...m[1].matchAll(/["']([.X]+)["']/g)].map((x) => x[1]);
const h = rows.length;
const w = rows[0].length;

let rects = '';
for (let y = 0; y < h; y++) {
  let x = 0;
  while (x < w) {
    if (rows[y][x] === 'X') {
      const s = x;
      while (x < w && rows[y][x] === 'X') x++;
      rects += `<rect x="${s}" y="${y}" width="${x - s}" height="1"/>`;
    } else x++;
  }
}

// Ch? W n?m ? 10 hang d?u (2 hang cu?i tr?ng) -> scale 0.8 d? gi?a khung
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">` +
  `<rect width="${w}" height="${h}" rx="2" fill="#0d1a29"/>` +
  `<g fill="#5aa7e8" transform="translate(0,0.8) scale(1,0.84)">${rects}</g>` +
  '</svg>\n';

const out = [
  path.join(root, 'web', 'assets', 'favicon-w.svg'),
  path.join(root, 'client', 'public', 'favicon.svg'),
];
for (const f of out) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, svg);
  console.log('written:', f);
}
console.log('bitmap:', w + 'x' + h, '| rects:', (rects.match(/<rect/g) || []).length);
