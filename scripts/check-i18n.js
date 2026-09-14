global.window = {};
require('../web/assets/i18n.js');
var d = window.WenkerI18n.DICT;
var base = Object.keys(d.vi).sort();
['en', 'zh', 'fr'].forEach(function (l) {
  var x = Object.keys(d[l]).sort();
  var miss = base.filter(function (y) { return x.indexOf(y) < 0; });
  var extra = x.filter(function (y) { return base.indexOf(y) < 0; });
  console.log(l, x.length, 'miss', miss.join('|') || '-', 'extra', extra.join('|') || '-');
});
var fs = require('fs');
var html = fs.readFileSync(require('path').join(__dirname, '..', 'web', 'index.html'), 'utf8');
var keys = (html.match(/data-i18n="[^"]+"/g) || []).map(function (s) { return s.replace(/data-i18n="|"/g, ''); });
var uniq = Array.from(new Set(keys));
var bad = uniq.filter(function (k) { return !d.vi[k]; });
console.log('html keys', uniq.length, 'missing-in-dict', bad.join('|') || '-');
