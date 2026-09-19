/**
 * WENKER Add-on Engine
 *
 * Mot "add-on" (.addon) la manifest JSON nho. Engine MVP ho tro:
 *   - type "theme":    doi bien CSS -> doi giao dien that toan bo console.
 *   - type "provider":  khai bao nhanh mot nha cung cap (install tao custom provider luon).
 *   - type "snippet":   hien thi goi y/hanh vi (khong thuc thi JS de an toan).
 *
 * De viet .addon chi can 2 mau: `accent` va `surface`; engine tu sinh scale RGB
 * day du (--color-cyan-50..950, --color-slate-50..950) ma Tailwind doc lai.
 * Van con cho phep override tuy bien CSS cu the ("--...") neu muon chinh xac hon.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const DATA_DIR = process.env.WENKER_HOME
  ? path.resolve(process.env.WENKER_HOME)
  : path.join(os.homedir(), '.wenker');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const ADDONS_FILE = path.join(DATA_DIR, 'addons.json');

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Blend weight per shade: positive = toward white, negative = toward black.
const MIX = {
  50: 0.92,
  100: 0.78,
  200: 0.58,
  300: 0.32,
  400: 0.1,
  500: 0,
  600: -0.16,
  700: -0.34,
  800: -0.5,
  900: -0.68,
  950: -0.84,
};

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const h = hex.replace('#', '').trim();
  const full =
    h.length === 3
      ? h
        .split('')
        .map((c) => c + c)
        .join('')
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

function mix(rgb, amount) {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgb.map((c) => Math.round(c + (target - c) * t));
}

const luma = (rgb) => Math.round((rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000);

// Shades 300-500 are used for label/body text all over the console. A very dark
// `surface` would otherwise render them almost black-on-black, so each ramp gets a
// readability floor: the colour is pulled toward white until it is bright enough.
const TEXT_FLOOR = {
  slate: { 300: 168, 400: 124, 500: 84 },
  cyan: { 300: 168, 400: 140 },
};

function readable(rgb, floor) {
  if (!floor || luma(rgb) >= floor) return rgb;
  let out = rgb;
  for (let t = 0.02; t <= 1 && luma(out) < floor; t += 0.02) out = mix(rgb, t);
  return out;
}

/**
 * Expand a compact theme spec into concrete CSS custom properties.
 * Accepts { accent, surface, text, radius, glassAlpha } and/or explicit "--x": "y".
 */
function expandTheme(spec) {
  const out = {};
  if (!spec || typeof spec !== 'object') return out;

  const accent = hexToRgb(spec.accent);
  if (accent) {
    for (const s of SHADES)
      out[`--color-cyan-${s}`] = readable(mix(accent, MIX[s]), TEXT_FLOOR.cyan[s]).join(' ');
    out['--accent-cyan'] = spec.accent;
  }

  const surface = hexToRgb(spec.surface);
  if (surface) {
    // Neutralise the surface a little so large areas stay readable, then build the ramp.
    const base = surface.map((c) => Math.round(c * 0.6 + 8));
    for (const s of SHADES)
      out[`--color-slate-${s}`] = readable(mix(base, MIX[s]), TEXT_FLOOR.slate[s]).join(' ');
    out['--bg-primary'] = spec.surface;
    out['--bg-secondary'] = `rgb(${mix(base, -0.2).join(' ')})`;
    out['--bg-card'] = `rgb(${mix(base, 0.05).join(' ')})`;
    out['--border-color'] = `rgb(${mix(base, -0.4).join(' ')})`;
  }

  if (spec.text) out['--text-primary'] = spec.text;
  if (spec.radius) out['--radius'] = spec.radius;
  if (spec.glassAlpha) out['--glass-alpha'] = String(spec.glassAlpha);

  // Explicit CSS vars always win (full control for hand-written .addon files).
  for (const [k, v] of Object.entries(spec)) {
    if (k.startsWith('--')) out[k] = String(v);
  }
  return out;
}

// ---- Built-in themes ----
const BUILTIN_ADDONS = [
  {
    id: 'wenker.theme.midnight',
    name: 'Midnight Cyan',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description: 'Chu de goc: nen toi xanh den, accent cyan - glassmorphism co dien.',
    theme: {
      accent: '#06b6d4',
      surface: '#0f172a',
      text: '#f8fafc',
      radius: '14px',
      '--color-slate-50': '248 250 252',
      '--color-slate-100': '241 245 249',
      '--color-slate-200': '226 232 240',
      '--color-slate-300': '203 213 225',
      '--color-slate-400': '148 163 184',
      '--color-slate-500': '100 116 139',
      '--color-slate-950': '2 6 23',
    },
  },
  {
    id: 'wenker.theme.emerald',
    name: 'Emerald Terminal',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description: 'X luc bao tren nen den tuyet, kieu terminal hacker.',
    theme: { accent: '#10b981', surface: '#04120c', text: '#d1fae5', radius: '10px' },
  },
  {
    id: 'wenker.theme.synthwave',
    name: 'Synthwave Pink',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description: 'Hong tim neon retro-80s, tuong phan cao, bo goc nhieu.',
    theme: { accent: '#f472b6', surface: '#150a26', text: '#fdf4ff', radius: '18px' },
  },
  {
    id: 'wenker.theme.contrast',
    name: 'High Contrast',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description: 'Tuong phan toi da cho de doc: nen den, accent xanh troi sang.',
    theme: {
      accent: '#38bdf8',
      surface: '#000000',
      text: '#ffffff',
      radius: '8px',
      '--glass-alpha': '0.95',
    },
  },
  {
    id: 'wenker.theme.ember',
    name: 'Amber Ember',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description: 'Hổ phách ấm trên nền nâu đen, dịu mắt cho ca đêm.',
    theme: { accent: '#f59e0b', surface: '#12100a', text: '#fef3c7', radius: '12px' },
  },
  {
    id: 'wenker.theme.paper',
    name: 'Paper Light',
    version: '1.0.0',
    type: 'theme',
    builtin: true,
    author: 'WENKER',
    description:
      'Sach trang sang trong: dao nguoc thang zinc sang nen, giu accent indigo — che do sang tuy chon.',
    theme: {
      // Dao nguoc hoan toan thang slate: moi class bg-slate-900/950 (card, input,
      // header) va text-slate-100..500 (chu the) tu dong doi sang sang/toi ma
      // khong can sua JSX. Gia tri "--" ghi de cuoi cung de vuot qua TEXT_FLOOR toi.
      '--wenker-mode': 'light',
      '--color-heading': '24 24 27',
      '--color-slate-50': '9 9 11',
      '--color-slate-100': '24 24 27',
      '--color-slate-200': '39 39 42',
      '--color-slate-300': '63 63 70',
      '--color-slate-400': '82 82 91',
      '--color-slate-500': '113 113 122',
      '--color-slate-600': '161 161 170',
      '--color-slate-700': '212 212 216',
      '--color-slate-750': '228 228 231',
      '--color-slate-800': '244 244 245',
      '--color-slate-900': '250 250 250',
      '--color-slate-950': '255 255 255',
      // Accent indigo giu nguyen nhung shade 300/400 toi xuong de duong tren trang.
      '--color-cyan-50': '238 242 255',
      '--color-cyan-100': '224 231 255',
      '--color-cyan-200': '199 210 254',
      '--color-cyan-300': '79 70 229',
      '--color-cyan-400': '99 102 241',
      '--color-cyan-500': '79 70 229',
      '--color-cyan-600': '67 56 202',
      '--color-cyan-700': '55 48 163',
      '--color-cyan-800': '49 46 129',
      '--color-cyan-900': '30 27 75',
      '--color-cyan-950': '23 23 60',
      '--bg-primary': '#fafafa',
      '--bg-secondary': '#f4f4f5',
      '--bg-card': '#ffffff',
      '--bg-card-hover': '#f4f4f5',
      '--border-color': '#e4e4e7',
      '--text-primary': '#18181b',
      '--text-secondary': '#52525b',
      '--text-muted': '#71717a',
      '--accent-cyan': '#4f46e5',
      '--sea-shadow': '0 1px 2px rgba(0, 0, 0, 0.06)',
      '--sea-shadow-lg': '0 10px 30px -12px rgba(0, 0, 0, 0.15)',
    },
  },
  {
    id: 'wenker.addon.copyids',
    name: 'Copy All Live IDs',
    version: '1.0.0',
    type: 'snippet',
    builtin: true,
    author: 'WENKER',
    description: 'Them nut "Copy toan bo ID dang song" trong Model Finder.',
    snippet: 'copy_alive_ids',
  },
];

function readAddons() {
  try {
    if (!fs.existsSync(ADDONS_FILE)) return [];
    const data = fs.readFileSync(ADDONS_FILE, 'utf-8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading addons.json:', err.message);
    return [];
  }
}

function writeAddons(list) {
  try {
    fs.writeFileSync(ADDONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing addons.json:', err.message);
  }
}

const ALLOWED_TYPES = ['theme', 'provider', 'snippet'];

// A CSS custom-property value must be a plain token: no braces/semicolons/angle
// brackets/url() that could break out of the declaration when injected via setProperty.
const SAFE_CSS_VALUE = /^[0-9a-zA-Z#%(),.\s/+*-]{1,64}$/;
function unsafeVars(resolved) {
  return Object.entries(resolved)
    .filter(
      ([, v]) =>
        !SAFE_CSS_VALUE.test(String(v)) ||
        /url\s*\(/i.test(String(v)) ||
        /expression/i.test(String(v)),
    )
    .map(([k]) => k);
}

function validate(manifest) {
  if (!manifest || typeof manifest !== 'object') return 'Manifest phai la mot object JSON.';
  if (!manifest.id || !/^[a-z0-9][a-z0-9.\-_]{1,80}$/i.test(manifest.id)) {
    return 'Thieu "id" hop le (chu/so/._- , 2-80 ky tu).';
  }
  if (!manifest.name) return 'Thieu "name".';
  if (!ALLOWED_TYPES.includes(manifest.type)) {
    return `"type" phai la mot trong: ${ALLOWED_TYPES.join(', ')}.`;
  }
  if (manifest.type === 'theme') {
    const resolved = expandTheme(manifest.theme);
    if (!Object.keys(resolved).length) {
      return 'Theme khong sinh ra bien CSS nao: can "accent", "surface" hoac bien "--...".';
    }
    const bad = unsafeVars(resolved);
    if (bad.length) return `Gia tri CSS khong an toan cho bien: ${bad.join(', ')}`;
  }
  if (manifest.type === 'provider') {
    if (!manifest.provider || !manifest.provider.baseUrl) return 'Provider can "provider.baseUrl".';
  }
  return null; // ok
}

class AddonService {
  constructor() {
    // Re-validate persisted add-ons on load: a hand-edited addons.json must never
    // be able to smuggle an unsafe CSS value into the page.
    this.custom = readAddons().filter((a) => {
      const err = validate(a);
      if (err) {
        console.warn(`[Addons] Bo qua "${a && a.id}" khi nap: ${err}`);
        return false;
      }
      return true;
    });
  }

  // `resolved` is always recomputed from the spec so an engine upgrade (new ramps,
  // readability floors) reaches add-ons that were installed earlier.
  list() {
    return [...BUILTIN_ADDONS, ...this.custom].map((a) =>
      a.type === 'theme' ? { ...a, resolved: expandTheme(a.theme || {}) } : a,
    );
  }

  get(id) {
    return this.list().find((a) => a.id === id) || null;
  }

  /** Resolved CSS variables for a theme add-on id (or null). */
  resolveTheme(id) {
    const addon = this.get(id);
    if (!addon || addon.type !== 'theme') return null;
    return expandTheme(addon.theme || {});
  }

  install(manifest) {
    const err = validate(manifest);
    if (err) return { ok: false, error: err };
    if (BUILTIN_ADDONS.some((a) => a.id === manifest.id)) {
      return { ok: false, error: `ID "${manifest.id}" trung add-on dung san.` };
    }
    const clean = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version || '1.0.0',
      type: manifest.type,
      builtin: false,
      author: manifest.author || 'user',
      description: manifest.description || '',
      installedAt: new Date().toISOString(),
    };
    if (manifest.type === 'theme') {
      clean.theme = manifest.theme;
      clean.resolved = expandTheme(manifest.theme);
    }
    if (manifest.type === 'provider') clean.provider = manifest.provider;
    if (manifest.type === 'snippet') clean.snippet = manifest.snippet || '';

    const idx = this.custom.findIndex((a) => a.id === clean.id);
    if (idx >= 0) this.custom[idx] = clean;
    else this.custom.push(clean);
    writeAddons(this.custom);
    return { ok: true, addon: clean };
  }

  remove(id) {
    const before = this.custom.length;
    this.custom = this.custom.filter((a) => a.id !== id);
    writeAddons(this.custom);
    return {
      ok: this.custom.length < before,
      builtinProtected: BUILTIN_ADDONS.some((a) => a.id === id),
    };
  }
}

module.exports = new AddonService();
module.exports.BUILTIN_ADDONS = BUILTIN_ADDONS;
module.exports.expandTheme = expandTheme;
module.exports.validate = validate;
