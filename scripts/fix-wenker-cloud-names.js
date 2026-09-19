// One-off: make wenker-cloud override model names honest (show the real upstream target).
const fs = require('fs');
const path = require('path');
const os = require('os');
const file = path.join(os.homedir(), '.wenker', 'config.json');
const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(raw);
const wc = cfg.providerOverrides && cfg.providerOverrides['wenker-cloud'];
if (!wc || !Array.isArray(wc.models)) {
  console.log('No wenker-cloud override models found; nothing to do.');
  process.exit(0);
}
let changed = 0;
for (const m of wc.models) {
  const real = m.targetModel || m.id;
  const want = `${m.id}  (tra loi thuc te: ${real})`;
  if (m.name !== want) {
    m.name = want;
    m.servedModel = real;
    changed++;
  }
}
fs.writeFileSync(file + '.bak', raw, 'utf8');
fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`Backed up to ${file}.bak`);
console.log(`Renamed ${changed} model entries in ${file}`);
for (const m of wc.models) console.log(` - ${m.id}  ->  ${m.targetModel || m.id}`);
