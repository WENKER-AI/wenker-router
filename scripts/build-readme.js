// Ghép bảng nhà cung cấp (UTF-8) vào template README tiếng Trung -> README.md.
// Tránh lỗi encoding khi redirect qua PowerShell: node tự đọc/ghi bằng utf8.
const fs = require('fs');
const path = require('path');
const table = require('./provider-table-data.js');

const root = path.join(__dirname, '..');
const tplPath = path.join(root, 'scripts', 'README.zh.template.md');
const outPath = path.join(root, 'README.md');

let tpl = fs.readFileSync(tplPath, 'utf8');
if (!tpl.includes('<!--PROVIDER_TABLE-->')) {
  console.error('Marker <!--PROVIDER_TABLE--> not found in template.');
  process.exit(1);
}
tpl = tpl.replace('<!--PROVIDER_TABLE-->', table.trimEnd());
fs.writeFileSync(outPath, tpl, 'utf8');
console.log('Wrote README.md (' + Buffer.byteLength(tpl, 'utf8') + ' bytes)');
