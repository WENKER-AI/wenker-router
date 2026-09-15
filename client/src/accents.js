/**
 * accent - cac mau nhan (accent) co san cho WENKER Router.
 *
 * Toan bo console lay mau tu bien CSS `--color-cyan-*` (xem tailwind.config.js +
 * index.css). Doi accent = ghi de 11 kenh RGB cua bang `cyan`, khong can sua JSX.
 * Day la "theme" kieu nhe nhang: giu nguyen nen toi (thiet ke dark-first) nhung
 * dao mau nhan nhanh chong. Add-on theme (loai 'theme') van toan quyen de reskin
 * sau (no duoc merge de len accent trong ThemeProvider).
 *
 * Gia tri la chuoi kenh RGB space-separated dung theo Tailwind <alpha-value>.
 */

// 11 shade: 50..950. Chi can 400/500/600 la du cho hau het UI, nhung cung du
// ca bang de khong lech khi add-on/component khac dung shade 300/700.
export const ACCENTS = [
  {
    id: 'cyan', label: 'Cyan', swatch: '#06b6d4',
    vars: { 50: '236 254 255', 100: '207 250 254', 200: '165 243 252', 300: '103 232 249', 400: '34 211 238', 500: '6 182 212', 600: '8 145 178', 700: '14 116 144', 800: '21 94 117', 900: '22 78 99', 950: '8 51 68' },
  },
  {
    id: 'violet', label: 'Violet', swatch: '#8b5cf6',
    vars: { 50: '245 243 255', 100: '237 233 254', 200: '221 214 254', 300: '196 181 253', 400: '167 139 250', 500: '139 92 246', 600: '124 58 237', 700: '109 40 217', 800: '91 33 182', 900: '76 29 149', 950: '46 16 101' },
  },
  {
    id: 'emerald', label: 'Emerald', swatch: '#10b981',
    vars: { 50: '236 253 245', 100: '209 250 229', 200: '167 243 208', 300: '110 231 183', 400: '52 211 153', 500: '16 185 129', 600: '5 150 105', 700: '4 120 87', 800: '6 95 70', 900: '6 78 59', 950: '2 44 34' },
  },
  {
    id: 'blue', label: 'Blue', swatch: '#3b82f6',
    vars: { 50: '239 246 255', 100: '219 234 254', 200: '191 219 254', 300: '147 197 253', 400: '96 165 250', 500: '59 130 246', 600: '37 99 235', 700: '29 78 216', 800: '30 64 175', 900: '30 58 138', 950: '23 37 84' },
  },
  {
    id: 'amber', label: 'Amber', swatch: '#f59e0b',
    vars: { 50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77', 400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9', 800: '146 64 14', 900: '120 53 15', 950: '69 26 3' },
  },
  {
    id: 'rose', label: 'Rose', swatch: '#f43f5e',
    vars: { 50: '255 241 242', 100: '255 228 230', 200: '254 205 211', 300: '253 164 175', 400: '251 113 133', 500: '244 63 94', 600: '225 29 72', 700: '190 18 60', 800: '159 18 57', 900: '136 14 46', 950: '76 5 25' },
  },
];

export const DEFAULT_ACCENT = 'cyan';

export function getAccent(id) {
  return ACCENTS.find((a) => a.id === id) || ACCENTS[0];
}

/** Bien thanh map CSS var `--color-cyan-<shade>` de applyVars dung duoc. */
export function accentVars(id) {
  const a = getAccent(id);
  const out = {};
  for (const [shade, channels] of Object.entries(a.vars)) {
    out[`--color-cyan-${shade}`] = channels;
  }
  return out;
}
