// Rut gon ten model: bo duoi "(tra loi thuc te: ...)" trong ~/.wenker/config.json
// (ten hien thi = id; model that phuc vu van giu trong servedModel -> UI hien badge).
// Chay: node scripts/shorten-model-names.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const cfgPath = path.join(os.homedir(), '.wenker', 'config.json');
const bakPath = cfgPath + '.bak3';

const raw = fs.readFileSync(cfgPath, 'utf8');
fs.writeFileSync(bakPath, raw);
console.log('backup ->', bakPath);

const cfg = JSON.parse(raw);
const po = cfg.providerOverrides || {};
let changed = 0;

for (const [pid, ov] of Object.entries(po)) {
  if (!ov || !Array.isArray(ov.models)) continue;
  for (const m of ov.models) {
    if (!m.name) continue;
    // "id  (tra loi thuc te: x)" -> "id"; hoac ten nao dai hon id + 6 ky tu
    // va chua duoi ngoac don -> cat bo duoi ngoac.
    const stripped = m.name.replace(/\s*\((?:tra loi thuc te|thực|thuc)\s*:[^)]*\)\s*$/i, '').trim();
    if (stripped && stripped !== m.name) {
      console.log(`[${pid}] "${m.name}"  ->  "${stripped}"`);
      m.name = stripped;
      changed++;
    }
    // Neu van con dai vo ly (vi du trung ten voi chinh id + duu thi), dung id.
    if (m.name && m.name !== m.id && m.name.length > m.id.length + 6 && m.name.startsWith(m.id)) {
      console.log(`[${pid}] "${m.name}"  ->  "${m.id}" (fallback id)`);
      m.name = m.id;
      changed++;
    }
  }
}

if (changed > 0) {
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log('DONE —', changed, 'model names shortened.');
} else {
  console.log('DONE — khong co gi thay doi.');
}
