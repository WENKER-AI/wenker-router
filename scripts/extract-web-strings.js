/* WENKER — trích xuất toàn bộ chuỗi tiếng Việt hiển thị được từ web/*.html
 * sang dạng danh sách chuẩn hoá (bỏ whitespace thừa), ghi vào
 * web/assets/i18n/vi.json để pipeline dịch (scripts/translate-web.js) dùng.
 *
 * Luật: KHÔNG dịch nội dung bên trong <pre>, <code>, <script>, <style>,
 * <textarea> và mọi phần tử có data-no-i18n (lệnh, URL, code block giữ nguyên).
 *
 * Chạy:  node scripts/extract-web-strings.js            (ghi file)
 *        node scripts/extract-web-strings.js --dry      (in thống kê)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILES = ['web/landing.html', 'web/404.html'];
const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const SKIP_TAGS = new Set(['script', 'style', 'pre', 'code', 'textarea', 'noscript']);
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

/* Chuỗi chỉ xuất hiện qua innerHTML trong landing.js (terminal tự chạy, intro,
 * nút copy) — DOM tĩnh không có nên phải khai báo tay để vào từ điển. */
const DYNAMIC = [
  'Đã chép',
  'WENKER Router đang chạy tại',
  'Một cổng duy nhất cho 560+ model AI — chạy ngay trên máy của bạn.',
  'nguồn:',
  'giới thiệu WENKER Router trong 1 câu',
];

function stripSkipped(html) {
  // thay khối bị loại bằng cặp thẻ rỗng để phần text xung quanh tách đúng
  // thành các text node riêng — khớp với cách DOM walker chia node lúc chạy.
  return html.replace(
    /<(script|style|pre|code|textarea|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,
    '<x></x>',
  );
}

function extract(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const clean = stripSkipped(html);
  const out = new Set();

  // text node: giữa '>' và '<' kế tiếp
  const textRe = />([^<>]+)</g;
  let m;
  while (m = textRe.exec(clean)) {
    const t = m[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (t && VI.test(t)) out.add(t);
  }
  // attributes có chuỗi Việt
  for (const a of ATTRS) {
    const re = new RegExp('\\b' + a + '="([^"]+)"', 'g');
    while (m = re.exec(clean)) {
      const t = m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
      if (t && VI.test(t)) out.add(t);
    }
  }
  // <title> + meta content
  const titleM = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) {
    const t = titleM[1].replace(/\s+/g, ' ').trim();
    if (VI.test(t)) out.add(t);
  }
  const metaRe = /<meta[^>]+content="([^"]+)"[^>]*>/g;
  while (m = metaRe.exec(clean)) {
    const t = m[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    if (t && VI.test(t)) out.add(t);
  }
  return out;
}

const all = new Set();
for (const f of FILES) {
  const set = extract(f);
  console.log(f, '→', set.size, 'chuỗi');
  set.forEach((s) => all.add(s));
}
DYNAMIC.forEach((s) => all.add(s));
const list = [...all].sort();
console.log('Tổng unique:', list.length);

if (process.argv.includes('--dry')) process.exit(0);

const dir = path.join(ROOT, 'web', 'assets', 'i18n');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'vi.json'), JSON.stringify(list, null, 1) + '\n');
console.log('Đã ghi', path.join('web/assets/i18n/vi.json'));
