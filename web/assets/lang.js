/* WENKER landing — runtime i18n: áp DICT (i18n.js) vào [data-i18n],
 * lưu lựa chọn vào localStorage, dựng menu ngôn ngữ. Không phụ thuộc. */
(function () {
  'use strict';
  var I = window.WenkerI18n;
  if (!I) return;
  var KEY = 'wenker.web.lang';
  var current = 'vi';
  try {
    current = localStorage.getItem(KEY) || 'vi';
  } catch (e) {}
  if (I.CODES.indexOf(current) === -1) current = 'vi';

  function apply(lang) {
    current = lang;
    var dict = I.DICT[lang] || {};
    document.documentElement.setAttribute('lang', I.HTMLLANG[lang] || lang);
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (dict[k] != null) el.textContent = dict[k];
    });
    var label = document.getElementById('langCurrent');
    if (label) label.textContent = I.NAMES[lang];
    var menu = document.getElementById('langMenu');
    if (menu) {
      menu.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
      });
    }
    try {
      localStorage.setItem(KEY, lang);
    } catch (e) {}
  }

  function buildMenu() {
    var menu = document.getElementById('langMenu');
    var btn = document.getElementById('langBtn');
    if (!menu || !btn) return;
    menu.innerHTML = '';
    I.CODES.forEach(function (code) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.setAttribute('data-lang', code);
      b.textContent = I.NAMES[code];
      b.addEventListener('click', function () {
        apply(code);
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(b);
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function () {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  buildMenu();
  apply(current);
})();
