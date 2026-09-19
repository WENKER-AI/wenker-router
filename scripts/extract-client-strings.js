/* WENKER — trích xuất chuỗi tiếng Việt từ dashboard React (client/src) để dịch.
 *
 * Nguồn chính: object STRINGS trong client/src/i18n.jsx (key → { vi, en, zh, fr }).
 *   - Lấy TẤT CẢ giá trị `vi` (unique) → client/src/i18n/vi.json
 * Ngoài ra quét các file .jsx khác trong client/src để tìm chuỗi tiếng Việt
 * hard-code (chưa đi qua t()) và báo cáo để xử lý thủ công.
 *
 * Cách phân tích STRINGS: quét brace-aware + bỏ qua nội dung trong string literal
 * (xử lý escape \ và \uXXXX) nên không bị lệch bởi dấu { } trong placeholder.
 *
 * Chạy:  node scripts/extract-client-strings.js
 *        node scripts/extract-client-strings.js --dry
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N = path.join(ROOT, 'client', 'src', 'i18n.jsx');
const OUT_DIR = path.join(ROOT, 'client', 'src', 'i18n');
const OUT = path.join(OUT_DIR, 'vi.json');

const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/* Tìm object literal `{ ... }` bắt đầu tại vị trí openIdx (ký tự '{'),
 * theo dõi độ sâu brace nhưng bỏ qua string literal ('...' "..." `...`). */
function matchObject(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  let quote = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error('Không tìm thấy dấu } đóng cho object literal');
}

function extractFromI18n() {
  const src = fs.readFileSync(I18N, 'utf8');
  const m = src.match(/const\s+STRINGS\s*=\s*\{/);
  if (!m) throw new Error('Không thấy `const STRINGS = {` trong client/src/i18n.jsx');
  const openIdx = m.index + m[0].length - 1; // vị trí '{'
  const literal = matchObject(src, openIdx);
  // literal là JS thuần (không JSX) → eval an toàn trong sandbox Function.
  const obj = new Function('return (' + literal + ');')();

  const set = new Set();
  const keys = Object.keys(obj);
  const missingVi = [];
  for (const k of keys) {
    const e = obj[k];
    if (e && typeof e.vi === 'string' && e.vi.trim()) set.add(e.vi);
    else missingVi.push(k);
  }
  return { set, count: keys.length, missingVi };
}

/* Quét các file .jsx/.js trong client/src (trừ i18n.jsx) tìm chuỗi Việt hard-code.
 * Chỉ báo cáo — không tự sửa. Trả về Map file → mảng chuỗi. */
function scanHardcoded() {
  const dir = path.join(ROOT, 'client', 'src');
  const found = new Map();
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (name === 'i18n' || name === 'node_modules') continue;
        walk(p);
        continue;
      }
      if (!/\.(jsx?|tsx?)$/.test(name)) continue;
      if (path.basename(p) === 'i18n.jsx') continue;
      const src = fs.readFileSync(p, 'utf8');
      const lines = src.split(/\r?\n/);
      const hits = [];
      lines.forEach((ln, idx) => {
        // chuỗi trong nháy đơn/nháy kép/backtick có ký tự Việt đặc trưng
        const strRe = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g;
        let mm;
        while (mm = strRe.exec(ln)) {
          const body = mm[2];
          if (VI.test(body) && !/^\s*\/\//.test(ln) && !/\*/.test(ln.slice(0, mm.index))) {
            hits.push({ line: idx + 1, text: body.slice(0, 90) });
          }
        }
      });
      if (hits.length) found.set(path.relative(ROOT, p), hits);
    }
  };
  walk(dir);
  return found;
}

function main() {
  const dry = process.argv.includes('--dry');
  const { set, count, missingVi } = extractFromI18n();
  const list = [...set].sort();
  console.log('i18n.jsx: ' + count + ' key → ' + list.length + ' chuỗi vi unique');
  if (missingVi.length)
    console.log(
      '  (key thiếu .vi:',
      missingVi.length + ':',
      missingVi.slice(0, 8).join(', ') + ')',
    );

  const hard = scanHardcoded();
  let hardTotal = 0;
  for (const [f, hits] of hard) hardTotal += hits.length;
  console.log(
    'Chuỗi Việt hard-code ngoài i18n.jsx: ' + hardTotal + ' (trong ' + hard.size + ' file)',
  );
  for (const [f, hits] of [...hard.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)) {
    console.log('  ' + f + ' → ' + hits.length);
  }

  if (dry) return;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(list, null, 1) + '\n');
  console.log('Đã ghi ' + path.relative(ROOT, OUT));

  const reportPath = path.join(OUT_DIR, 'hardcoded-report.json');
  const report = {};
  for (const [f, hits] of hard) report[f] = hits;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n');
  console.log('Đã ghi ' + path.relative(ROOT, reportPath) + ' (báo cáo chuỗi hard-code)');
}

main();
