// Sinh bảng markdown các nhà cung cấp (theo danh mục) cho README tiếng Trung.
// Dùng favicon DuckDuckGo (hiển thị được trên GitHub). Không chứa code nhạy cảm.
const { PROVIDERS } = require('../server/config/providers-data.js');

const CATS = [
  ['wenker', 'WENKER 官方内置'],
  ['free', '免鉴权免费源 (No-Auth Free)'],
  ['flagship', '旗舰大厂 (Flagship)'],
  ['inference', '云推理与网关 (Cloud Inference)'],
  ['china', '中国 / 亚洲模型 (China)'],
  ['coding', '编程与 Agent (Coding)'],
  ['local', '本地运行时 (Local Runtimes)'],
  ['specialized', '专项能力 (Specialized)'],
];

function host(u) {
  try {
    return new URL(u).hostname;
  } catch (e) {
    return '';
  }
}
function logo(p) {
  const h = host(p.website || p.baseUrl || '');
  if (!h) return '';
  return `<img src="https://icons.duckduckgo.com/ip3/${h}.ico" alt="" height="20" width="20" />`;
}
function auth(p) {
  if (!p.requiresAuth) return '免密 No-key';
  return (p.authType || 'key').toString();
}

const byCat = {};
for (const p of PROVIDERS) (byCat[p.category] = byCat[p.category] || []).push(p);

let out = '';
let totalModels = 0;
for (const [key, label] of CATS) {
  const list = (byCat[key] || []).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length) continue;
  out += `\n### ${label} — ${list.length} 家\n\n`;
  out += '|  | 名称 | 模型数 | 鉴权 | 官网 |\n';
  out += '|---|---|---:|---|---|\n';
  for (const p of list) {
    const mc = p.models ? p.models.length : 0;
    totalModels += mc;
    const site = p.website || p.baseUrl || '';
    const sited = site ? `[${host(site)}](${site})` : '—';
    out += `| ${logo(p)} | ${p.name} | ${mc} | ${auth(p)} | ${sited} |\n`;
  }
}
console.log(out);
console.log('TOTAL_PROVIDERS=' + PROVIDERS.length + ' TOTAL_MODELS=' + totalModels);
