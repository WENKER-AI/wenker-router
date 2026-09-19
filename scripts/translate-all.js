/* WENKER — dịch danh sách chuỗi tiếng Việt (web + dashboard + catalog) sang
 * 29 ngôn ngữ bằng endpoint miễn phí clients5.google.com (dict-chrome-ex).
 *
 * Cơ chế:
 *  - Đầu vào: vi.json (mảng chuỗi) cho từng "bộ" (web / client / catalog).
 *  - Cache: <bộ>/<lang>.json = { "vi text": "translated" } — chạy lại chỉ dịch thiếu.
 *  - Batch nhiều q= mỗi request; token bảo vệ [[n]] giữ nguyên qua dịch.
 *  - Retry + backoff khi 429/lỗi mạng.
 *
 * Chạy:  node scripts/translate-all.js            (dịch everything còn thiếu)
 *        node scripts/translate-all.js web        (chỉ bộ 'web')
 *        node scripts/translate-all.js --langs en,ja
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// vi là nguồn — 29 ngôn ngữ đích (≥28 theo yêu cầu)
const TARGETS = [
  'en',
  'fr',
  'de',
  'es',
  'pt',
  'it',
  'nl',
  'pl',
  'ru',
  'uk',
  'cs',
  'hu',
  'ro',
  'bg',
  'el',
  'tr',
  'ar',
  'fa',
  'he',
  'hi',
  'bn',
  'ur',
  'ta',
  'th',
  'id',
  'ms',
  'ja',
  'ko',
  'zh',
];
// mã gửi API (khác biệt nhỏ của Google)
const API_CODE = {
  zh: 'zh-CN',
  he: 'iw',
  pt: 'pt',
  ar: 'ar',
  fa: 'fa',
  ur: 'ur',
  bn: 'bn',
  ta: 'ta',
};

const SETS = {
  web: { src: 'web/assets/i18n/vi.json', out: 'web/assets/i18n' },
  client: { src: 'client/src/i18n/vi.json', out: 'client/src/i18n' },
  catalog: { src: 'server/config/i18n/vi.json', out: 'server/config/i18n' },
};

/* ---- bảo vệ token: thay các cụm không dịch bằng [[n]] ---- */
const PROTECT = [
  /https?:\/\/[^\s"'<>]+/g,
  /\blocalhost(?::\d+)?(?:\/[^\s"'<>，。;)【】[\]]*)?/g,
  /\b127\.0\.0\.1(?::\d+)?/g,
  /~\/\.wenker[^\s"'<>]*/g,
  /\$?\bwenker\b[^\s]*/gi,
  /\b\/v1(?:\/[A-Za-z0-9_./-]*)?/g,
  /\b[A-Za-z0-9_.-]+\.(?:js|json|md|py|sh|bat|cmd|ps1|addon|mp4|png|svg|txt)\b/g,
  /\b(?:npm|npx|node|git|curl|cd|mkdir|cp|mv|rm|python|pip|docker|systemctl|export|setx?|sc|tasklist|netstat|lsof|kill|chmod)(?:\s+[-\w./=:~"']+)+/gi,
  /\b(?:OpenAI|Anthropic|Claude Code|Claude|Cursor|Cline|Roo Code|Aider|Continue|OpenHands|OpenWebUI|Ollama|LM Studio|vLLM|LocalAI|llama\.cpp|KoboldCpp|DeepSeek|Qwen|Llama|Gemini|Grok|Mistral|GPT-[A-Za-z0-9.]+|WENKER(?:\s+Router|\.ai| Cloud)?|GitHub|VS Code|Windows|macOS|Linux|Android|iOS|MIT|Zero database|Base URL|API|JSON|SSE|HTTP[S]?|TCP|PIN|LAN|CDN|CLI|UI|UX|Token|Tokens|Docker|Redis|PostgreSQL)\b/g,
  /\b\d+(?:[.,]\d+)?\s*(?:%|ms|s|tok|tokens?|₫|USD|K|M|X|\/giây|\/phút)\b/g,
  /\b[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+\b/g, // snake_case ids
  /\b[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*\b/g, // camelCase ids
  /\b[A-Za-z][A-Za-z0-9]*[-.][A-Za-z0-9][A-Za-z0-9.-]*\b/g, // dashed/dotted ids
  /\b\d+\/\d+\b/g, // 401/402
];

// Sentinel ⟦n⟧ — Google dịch nội bộ dùng marker [[n]] nên KHÔNG được đụng định dạng đó.
function protect(s) {
  const toks = [];
  let out = s;
  for (const re of PROTECT) {
    out = out.replace(re, (m) => {
      if (/^⟦\d+⟧$/.test(m)) return m;
      toks.push(m);
      return '⟦' + (toks.length - 1) + '⟧';
    });
  }
  return { text: out, toks };
}
function unprotect(s, toks) {
  return s.replace(/⟦(\d+)⟧/g, (m, i) => toks[+i] != null ? toks[+i] : m);
}

async function translateBatch(texts, target) {
  const tl = API_CODE[target] || target;
  const url =
    'https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=vi&tl=' +
    encodeURIComponent(tl) +
    texts.map((t) => '&q=' + encodeURIComponent(t)).join('');
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
    signal: AbortSignal.timeout(20000),
  });
  if (r.status !== 200) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 80));
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('bad json');
  const out = j.map((x) => typeof x === 'string' ? x : Array.isArray(x) ? x.join('') : '');
  if (out.length !== texts.length) {
    // API đôi khi gộp kết quả — chấp nhận thiếu, các mục còn giữ nguyên vi (fallback)
    while (out.length < texts.length) out.push(null);
    out.length = texts.length;
  }
  return out;
}

function chunk(texts, maxChars, maxN) {
  const batches = [];
  let cur = [],
    size = 0;
  for (const t of texts) {
    if (cur.length && (size + t.length > maxChars || cur.length >= maxN)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.length + 4;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateSet(name, missingByLang, progressTag) {
  const cfg = SETS[name];
  for (const [lang, todo] of Object.entries(missingByLang)) {
    const outPath = path.join(ROOT, cfg.out, lang + '.json');
    const dict = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
    const pieces = chunk(todo, 4200, 45);
    let done = 0;
    for (const piece of pieces) {
      const prot = piece.map((t) => protect(t));
      let tries = 0,
        res = null;
      while (tries < 5) {
        try {
          res = await translateBatch(
            prot.map((p) => p.text),
            lang,
          );
          break;
        } catch (e) {
          tries++;
          const wait = 1200 * tries;
          console.warn('  retry', lang, 'batch', done, e.message, 'wait', wait);
          await sleep(wait);
        }
      }
      piece.forEach((t, i) => {
        const tr = res && res[i] != null ? unprotect(res[i], prot[i].toks) : null;
        dict[t] = tr || t; // null → giữ vi (fallback an toàn)
      });
      done++;
      fs.writeFileSync(outPath, JSON.stringify(dict, null, 0) + '\n');
      if (done % 10 === 0 || done === pieces.length)
        console.log(progressTag, lang, done + '/' + pieces.length);
      await sleep(120);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const langsArg = (args.find((a) => a.startsWith('--langs=')) || '').split('=')[1];
  const langs = langsArg ? langsArg.split(',') : TARGETS;

  for (const [name, cfg] of Object.entries(SETS)) {
    if (only.length && !only.includes(name)) continue;
    const srcPath = path.join(ROOT, cfg.src);
    if (!fs.existsSync(srcPath)) {
      console.log('bỏ qua', name, '(chưa có', cfg.src + ')');
      continue;
    }
    const texts = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    const missingByLang = {};
    for (const lang of langs) {
      const p = path.join(ROOT, cfg.out, lang + '.json');
      const dict = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      const miss = texts.filter((t) => !(t in dict));
      if (miss.length) missingByLang[lang] = miss;
    }
    const total = Object.values(missingByLang).reduce((a, b) => a + b.length, 0);
    console.log('==', name, '== chuỗi:', texts.length, '| cần dịch:', total);
    if (!total) continue;
    await translateSet(name, missingByLang, '  [' + name + ']');
  }
  console.log('XONG');
}

module.exports = { protect, unprotect, translateBatch, TARGETS };

if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
