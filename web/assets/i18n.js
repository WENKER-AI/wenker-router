/* WENKER — i18n runtime cho trang web (landing + 404).
 *
 * Cơ chế: từ điển tra theo CHÍNH chuỗi tiếng Việt nguồn (web/assets/i18n/<lang>.json,
 * sinh bởi scripts/translate-all.js). Khi đổi ngôn ngữ, walker DOM thay 100% text
 * node + attributes (aria-label/title/placeholder/alt) + document.title + meta.
 * Không còn tiếng Việt sót lại khi đã chọn ngôn ngữ khác.
 *
 * - KHÔNG đụng nội dung trong <pre>/<code>/<script>/<style>/<textarea> hoặc [data-no-i18n]
 *   (lệnh, URL, code block giữ nguyên theo luật của trang).
 * - Ngôn ngữ: localStorage 'wenker.lang' > tự nhận navigator.languages > 'en'.
 * - RTL: ar/fa/ur/he tự bật dir="rtl".
 * - Chuyển ngôn ngữ trực tiếp bằng nút globe (tự chèn vào header / góc phải 404).
 * - JS động gọi WenkerI18n.t('chuỗi vi') để lấy bản dịch hiện hành.
 */
(function () {
  'use strict';

  var LANGS = [
    'vi',
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
  var RTL = { ar: 1, fa: 1, ur: 1, he: 1 };
  var NAMES = {
    vi: 'Tiếng Việt',
    en: 'English',
    fr: 'Français',
    de: 'Deutsch',
    es: 'Español',
    pt: 'Português',
    it: 'Italiano',
    nl: 'Nederlands',
    pl: 'Polski',
    ru: 'Русский',
    uk: 'Українська',
    cs: 'Čeština',
    hu: 'Magyar',
    ro: 'Română',
    bg: 'Български',
    el: 'Ελληνικά',
    tr: 'Türkçe',
    ar: 'العربية',
    fa: 'فارسی',
    he: 'עברית',
    hi: 'हिन्दी',
    bn: 'বাংলা',
    ur: 'اردو',
    ta: 'தமிழ்',
    th: 'ไทย',
    id: 'Bahasa Indonesia',
    ms: 'Bahasa Melayu',
    ja: '日本語',
    ko: '한국어',
    zh: '简体中文',
  };
  var STORE = 'wenker.lang';
  var VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];

  var base = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) return s.replace(/[^/]*$/, '');
    } catch (e) {}
    return 'assets/';
  })();

  var lang = 'vi';
  var dict = {};
  var origText = new Map(); // textNode -> original string
  var origAttr = new Map(); // element -> {attr: original}
  var hooks = [];

  function norm(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  function detect() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORE);
    } catch (e) {}
    if (saved && LANGS.indexOf(saved) >= 0) return saved;
    var cands =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || 'en'];
    for (var i = 0; i < cands.length; i++) {
      var c = String(cands[i]).toLowerCase().split('-')[0];
      if (LANGS.indexOf(c) >= 0) return c;
    }
    return 'en';
  }

  function loadDict(l) {
    if (l === 'vi') {
      dict = {};
      return Promise.resolve();
    }
    return fetch(base + 'i18n/' + l + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        dict = d;
      })
      .catch(function () {
        dict = {};
      });
  }

  function tr(text) {
    var key = norm(text);
    if (!key) return text;
    var hit = dict[key];
    if (hit != null) return hit;
    hit = dict[text];
    if (hit != null) return hit;
    return text; // khoảng trắng dẫn/dư được giữ nguyên
  }

  function skipNode(n) {
    var p = n.parentElement;
    while (p) {
      if (SKIP[p.tagName] || p.hasAttribute('data-no-i18n')) return true;
      p = p.parentElement;
    }
    return false;
  }

  function walkText(root) {
    var tw = document.createTreeWalker(root || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (skipNode(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = tw.nextNode())) {
      var orig = origText.has(n) ? origText.get(n) : n.nodeValue;
      origText.set(n, orig);
      var body = orig.replace(/^\s+|\s+$/g, '');
      if (!body) continue;
      var out = tr(body);
      var next = orig.replace(body, out);
      if (next !== n.nodeValue) n.nodeValue = next;
    }
  }

  function walkAttrs() {
    var sel = ATTRS.map(function (a) {
      return '[' + a + ']';
    }).join(',');
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.closest('[data-no-i18n]') || el.closest('pre,code')) return;
      var store = origAttr.get(el) || {};
      origAttr.set(el, store);
      ATTRS.forEach(function (a) {
        var v = el.getAttribute(a);
        if (v == null) return;
        if (!(a in store)) store[a] = v;
        var orig = store[a];
        var body = orig.replace(/^\s+|\s+$/g, '');
        if (!body) return;
        el.setAttribute(a, orig.replace(body, tr(body)));
      });
    });
  }

  function walkHead() {
    var t = document.title;
    if (!origText.has('__title__')) origText.set('__title__', t);
    t = origText.get('__title__');
    if (t) document.title = tr(t);
    document
      .querySelectorAll(
        'meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[property="og:site_name"]'
      )
      .forEach(function (m) {
        var k = '__meta__' + (m.getAttribute('name') || m.getAttribute('property'));
        if (!origText.has(k)) origText.set(k, m.getAttribute('content') || '');
        var orig = origText.get(k);
        if (orig) m.setAttribute('content', tr(orig));
      });
  }

  function applyLang(l) {
    lang = LANGS.indexOf(l) >= 0 ? l : 'en';
    try {
      localStorage.setItem(STORE, lang);
    } catch (e) {}
    var html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', RTL[lang] ? 'rtl' : 'ltr');
    return loadDict(lang).then(function () {
      walkText();
      walkAttrs();
      walkHead();
      hooks.forEach(function (h) {
        try {
          h(lang);
        } catch (e) {}
      });
      updateSwitcherLabel();
    });
  }

  /* ---------- language switcher (tự chèn, không sửa HTML) ---------- */
  var ICON =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/></svg>';

  function updateSwitcherLabel() {
    if (switchEl) switchEl.querySelector('.wk-cur').textContent = NAMES[lang] || lang;
  }

  var switchEl = null;
  function buildSwitcher() {
    if (switchEl) return;
    var el = document.createElement('div');
    el.className = 'wk-lang';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wk-lang-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = ICON + '<span class="wk-cur"></span><span class="wk-caret">▾</span>';
    el.appendChild(btn);

    var menu = document.createElement('div');
    menu.className = 'wk-lang-menu';
    menu.setAttribute('role', 'listbox');
    el.appendChild(menu);
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('data-lang', l);
      b.textContent = NAMES[l];
      b.addEventListener('click', function () {
        closeMenu();
        applyLang(l);
        document.dispatchEvent(new CustomEvent('wenker:lang', { detail: { lang: l } }));
      });
      menu.appendChild(b);
    });
    var btn = el.querySelector('.wk-lang-btn');
    function closeMenu() {
      el.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = el.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', closeMenu);

    // gắn vào header landing nếu có, ngược lại nổi góc (404)
    var actions = document.querySelector('.nav-actions');
    var nav = document.querySelector('header nav');
    var host = actions || (nav && nav.parentElement) || document.querySelector('header .wrap');
    if (host) {
      host.appendChild(el);
    } else {
      el.classList.add('wk-lang-float');
      document.body.appendChild(el);
    }
    switchEl = el;
    updateSwitcherLabel();
  }

  /* ---------- CSS chèn kèm ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.wk-lang{position:relative;display:inline-flex;font:inherit}' +
    '.wk-lang-btn{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.12);' +
    'background:rgba(255,255,255,.04);color:var(--ink-soft,#a1a1aa);cursor:pointer;font-size:12.5px;font-family:inherit;line-height:1}' +
    '.wk-lang-btn:hover{color:var(--ink,#f4f4f5);border-color:rgba(255,255,255,.25)}' +
    '.wk-caret{font-size:9px;opacity:.7}' +
    '.wk-lang-menu{display:none;position:absolute;top:calc(100% + 8px);inset-inline-end:0;z-index:300;max-height:340px;overflow:auto;' +
    'min-width:190px;padding:6px;border-radius:14px;background:#131316;border:1px solid rgba(255,255,255,.1);' +
    'box-shadow:0 18px 48px rgba(0,0,0,.5)}' +
    '.wk-lang.open .wk-lang-menu{display:block}' +
    '.wk-lang-menu button{display:block;width:100%;text-align:start;padding:7px 10px;border:0;border-radius:9px;background:none;' +
    'color:#d4d4d8;font:inherit;font-size:13px;cursor:pointer}' +
    '.wk-lang-menu button:hover{background:rgba(255,255,255,.07);color:#fff}' +
    '.wk-lang-float{position:fixed;top:14px;inset-inline-end:14px;z-index:160}' +
    '@media(max-width:720px){.wk-lang-float{top:auto;bottom:14px}}';
  document.head.appendChild(css);

  /* ---------- boot ---------- */
  function boot() {
    buildSwitcher();
    applyLang(detect());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.WenkerI18n = {
    LANGS: LANGS,
    NAMES: NAMES,
    get lang() {
      return lang;
    },
    t: function (s) {
      return lang === 'vi' ? s : tr(s);
    },
    set: function (l) {
      return applyLang(l);
    },
    onApply: function (fn) {
      hooks.push(fn);
    },
  };
})();
