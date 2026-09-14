// Thay khoi "WENKER PIXEL SKIN" cuoi index.css bang "WENKER SEA SKIN"
// (palette bien sau, bo goc, bong mem, font pixel chi dung cho thuong hieu).
// Chay: node scripts/restyle-client-css.js
const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'client', 'src', 'styles', 'index.css');
let s = fs.readFileSync(cssPath, 'utf8');

const idx = s.indexOf('WENKER PIXEL SKIN');
if (idx === -1) {
  console.error('Khong tim thay khoi WENKER PIXEL SKIN — file co the da duoc thay the truoc do.');
  process.exit(1);
}
const start = s.lastIndexOf('/*', idx);
if (start === -1) {
  console.error('Khong tim thay dau mo comment cua khoi PIXEL SKIN.');
  process.exit(1);
}

const SEA = `/* ============================================================
   WENKER SEA SKIN — console localhost dung cung bo nhan dien
   "bien sau" (deep-sea soft) voi trang web: palette navy-blue
   #0a1420/#5aa7e8/#7fd8a4, goc bo 14px, vien 1.5px, bong mem
   khuuch tan — it cyberpunk hon, co dien va de cho mat.
   Toan bo mau trong JSX di qua --color-slate-* / --color-cyan-*
   (xem tailwind.config.js), nen chi can retoken la doi ca console.
   Font pixel GIU LAI chi cho thuong hieu (class .brand-pixel);
   tieu de/noi dung dung Plus Jakarta Sans de khong tron font.
   ============================================================ */
@font-face {
  font-family: 'WenkerPixel';
  src: url('/fonts/pixel-regular.ttf') format('truetype');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'WenkerPixel';
  src: url('/fonts/pixel-bold.ttf') format('truetype');
  font-weight: 800 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-pixel: 'WenkerPixel', 'JetBrains Mono', ui-monospace, 'Segoe UI', system-ui, sans-serif;
  --font-body: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif;

  /* palette bien sau — khop web/assets/style.css */
  --bg-primary: #0a1420;
  --bg-secondary: #0d1a29;
  --bg-card: #12202f;
  --bg-card-hover: #182a3d;
  --border-color: #24384e;
  --border-glow: rgba(90, 167, 232, 0.25);
  --accent-cyan: #5aa7e8;
  --accent-blue: #3d84c6;
  --accent-emerald: #7fd8a4;
  --text-primary: #e8f0f8;
  --text-secondary: #93a9c0;
  --text-muted: #64809c;
  --radius: 14px;
  --radius-sm: 10px;
  --hair: 1.5px;
  --sea-shadow: 0 4px 14px rgba(3, 10, 20, 0.4);
  --sea-shadow-lg: 0 10px 28px rgba(3, 10, 20, 0.45);

  /* slate → cac muc nuoc bien (toi → sang) */
  --color-slate-50: 232 240 248;
  --color-slate-100: 224 234 246;
  --color-slate-200: 208 222 236;
  --color-slate-300: 176 196 216;
  --color-slate-400: 147 169 192;
  --color-slate-500: 100 124 150;
  --color-slate-600: 36 56 78;
  --color-slate-700: 24 42 61;
  --color-slate-750: 18 32 47;
  --color-slate-800: 13 26 41;
  --color-slate-900: 10 20 32;
  --color-slate-950: 7 16 25;

  /* accent cyan → xanh bien #5aa7e8 */
  --color-cyan-50: 224 240 252;
  --color-cyan-100: 200 228 248;
  --color-cyan-200: 165 212 245;
  --color-cyan-300: 128 190 240;
  --color-cyan-400: 90 167 232;
  --color-cyan-500: 61 132 198;
  --color-cyan-600: 45 105 160;
  --color-cyan-700: 34 82 125;
  --color-cyan-800: 26 62 96;
  --color-cyan-900: 18 45 70;
  --color-cyan-950: 10 26 44;
}

body {
  font-family: var(--font-body);
  /* luoi nhi hue rat mo nhu trang web — khong cyberpunk */
  background-image:
    linear-gradient(rgba(36, 56, 78, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(36, 56, 78, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
}

/* Chi thuong hieu dung font pixel (dong bo favicon W / brand-mark web).
   Tieu de va noi dung giu Plus Jakarta Sans — tron ven, cung mot font. */
.brand-pixel {
  font-family: var(--font-pixel);
  letter-spacing: 0.06em;
}

/* Card: vien 1.5px + bong mem khuuch tan, blur nhe */
.card-glass {
  background: rgb(var(--color-slate-800) / 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: var(--hair) solid var(--border-color);
  border-radius: var(--radius);
  box-shadow: var(--sea-shadow);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.card-glass:hover {
  border-color: rgb(var(--color-cyan-400) / 0.45);
  box-shadow: var(--sea-shadow-lg);
  transform: translateY(-2px);
}

/* Nut: bo goc 11px, vien hairline, bong mem — hover nang nhe */
.btn-primary, .btn-secondary, .btn-ghost {
  border-radius: 11px;
  border-width: var(--hair);
  transition: all 0.18s ease;
}
.btn-primary {
  background: linear-gradient(135deg, #3d84c6 0%, #5aa7e8 100%);
  color: #071019;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(61, 132, 198, 0.35);
}
.btn-primary:hover {
  background: linear-gradient(135deg, #4a92d6 0%, #6cb4f0 100%);
  box-shadow: 0 8px 22px rgba(90, 167, 232, 0.4);
  transform: translateY(-2px);
}
.btn-primary:active { transform: translateY(0); }
.btn-secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-color);
}
.btn-secondary:hover {
  background: var(--bg-card-hover);
  border-color: rgb(var(--color-cyan-400) / 0.5);
}
.btn-ghost:hover { background: rgba(90, 167, 232, 0.1); }

/* Gradient text → xanh bien → xanh lac (mat hon ban cyan/tim cu) */
.gradient-text {
  background: linear-gradient(90deg, #5aa7e8 0%, #7fd8a4 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Cham trang thai: tron lai, sang nhe kieu den bien */
.status-dot { border-radius: 9999px; }
.status-dot.online { background-color: #7fd8a4; box-shadow: 0 0 8px rgba(127, 216, 164, 0.5); }
.status-dot.offline { background-color: #e88a8a; box-shadow: 0 0 8px rgba(232, 138, 138, 0.35); }

/* Selection mau xanh bien */
::selection { background: rgba(90, 167, 232, 0.35); color: #e8f0f8; }

/* Thanh cuộn tron, mau line bien */
::-webkit-scrollbar-thumb { background: #2f4a66; border-radius: 6px; border: 2px solid #0a1420; }
::-webkit-scrollbar-thumb:hover { background: #5aa7e8; }

@media (prefers-reduced-motion: reduce) {
  .card-glass, .btn-primary, .btn-secondary, .btn-ghost { transition: none; }
  .animate-pulse-slow { animation: none; }
}
`;

fs.writeFileSync(cssPath, s.slice(0, start) + SEA);
console.log('OK — PIXEL SKIN -> SEA SKIN, file:', cssPath);
