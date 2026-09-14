// One-off: pull the languageModelChatProviders contribution-point JSON schema out of the
// installed VS Code bundle so the extension manifest matches what the host validates.
const fs = require('fs');
const path = require('path');

const base = process.argv[2];
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(base);

const needle = 'extensionPoint:"languageModelChatProviders"';
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const i = t.indexOf(needle);
  if (i < 0) continue;
  console.log('=== ' + f);
  // The schema object is declared just before the registerExtensionPoint call.
  console.log(t.slice(Math.max(0, i - 2400), i + 260));
  break;
}
