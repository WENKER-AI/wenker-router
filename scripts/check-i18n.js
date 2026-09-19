global.window = {};
global.document = {
  createElement: () => ({
    setAttribute: () => {},
    appendChild: () => {},
    addEventListener: () => {},
    classList: {
      remove: () => {},
      add: () => {},
      toggle: () => false,
      contains: () => false
    },
    querySelector: () => ({
      setAttribute: () => {},
      addEventListener: () => {},
      appendChild: () => {},
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => false,
        contains: () => false
      },
      parentElement: { appendChild: () => {} }
    })
  }),
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  dispatchEvent: () => {},
  addEventListener: () => {},
  querySelector: () => ({
    appendChild: () => {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => false,
      contains: () => false
    },
    setAttribute: () => {},
    parentElement: { appendChild: () => {} }
  }),
  documentElement: {
    setAttribute: () => {}
  }
};
require('../web/assets/i18n.js');
const d = window.WenkerI18n.DICT;
const base = Object.keys(d.vi).sort();
['en', 'zh', 'fr'].forEach(function (l) {
  const x = Object.keys(d[l]).sort();
  const miss = base.filter(function (y) {
    return x.indexOf(y) < 0;
  });
  const extra = x.filter(function (y) {
    return base.indexOf(y) < 0;
  });
  console.log(l, x.length, 'miss', miss.join('|') || '-', 'extra', extra.join('|') || '-');
});
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'web', 'index.html'), 'utf8');
const keys = (html.match(/data-i18n="[^"]+"/g) || []).map(function (s) {
  return s.replace(/data-i18n="|"/g, '');
});
const uniq = Array.from(new Set(keys));
const bad = uniq.filter(function (k) {
  return !d.vi[k];
});
console.log('html keys', uniq.length, 'missing-in-dict', bad.join('|') || '-');
