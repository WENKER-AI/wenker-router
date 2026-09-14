/* WENKER — tương tác trang tĩnh: menu, reveal, counter, tab (indicator trượt),
 * copy, icon pixel và bộ chọn ngôn ngữ (vi/en/zh/fr). Không phụ thuộc bên ngoài.
 */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Render icon pixel ---------- */
  function hydrateIcons() {
    if (window.WenkerIcons) window.WenkerIcons.render(document);
  }

  /* ---------- Burger menu ---------- */
  function initBurger() {
    var burger = $("#burger");
    var links = $("#navLinks");
    if (!burger || !links) return;
    function close() { links.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (links.contains(e.target) || burger.contains(e.target)) return;
      close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    links.addEventListener("click", function (e) { if (e.target.tagName === "A") close(); });
    window.addEventListener("resize", function () { if (window.innerWidth > 760) close(); });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el, idx) {
      el.style.transitionDelay = Math.min(idx, 6) * 60 + "ms";
      io.observe(el);
    });
  }

  /* ---------- Count-up stats ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;
    if (reduceMotion) { el.textContent = format(target); return; }
    var dur = 1200, start = null;
    function format(n) { return n >= 1000 ? n.toLocaleString("en-US") : String(n); }
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;
    if (!("IntersectionObserver" in window)) { nums.forEach(animateCount); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Tabs với indicator trượt kiểu Mistral ---------- */
  function initTabs() {
    var bar = $("#installTabs");
    if (!bar) return;
    var tabs = $$(".tab", bar);
    var panels = $$(".panel");
    var indicator = $(".tab-indicator", bar);
    function moveIndicator(tab) {
      if (!indicator || !tab) return;
      indicator.style.width = tab.offsetWidth + "px";
      indicator.style.transform = "translateX(" + tab.offsetLeft + "px)";
    }
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      var id = tab.getAttribute("data-tab");
      panels.forEach(function (p) { p.classList.toggle("active", p.id === id); });
      moveIndicator(tab);
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { select(t); });
    });
    bar.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); tabs[(i + 1) % tabs.length].focus(); select(tabs[(i + 1) % tabs.length]); }
      if (e.key === "ArrowLeft") { e.preventDefault(); tabs[(i - 1 + tabs.length) % tabs.length].focus(); select(tabs[(i - 1 + tabs.length) % tabs.length]); }
    });
    var active = $(".tab.active", bar) || tabs[0];
    if (active) select(active);
    window.addEventListener("resize", function () { moveIndicator($(".tab.active", bar)); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { moveIndicator($(".tab.active", bar)); });
    }
  }

  /* ---------- Copy có chỉ báo ---------- */
  function flash(btn, label) {
    var old = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", old);
    btn.textContent = label;
    btn.classList.add("done");
    setTimeout(function () { btn.textContent = old; btn.classList.remove("done"); }, 1500);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve(ok);
    } catch (e) { return Promise.resolve(false); }
  }
  function initCopy() {
    $$("[data-copy-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var src = btn.getAttribute("data-copy-target");
        var node = src ? $(src) : null;
        var text = node ? (node.getAttribute("data-copy") || node.textContent).trim() : (btn.getAttribute("data-copy") || "");
        if (!text) return;
        copyText(text).then(function (ok) {
          flash(btn, ok ? "Đã chép ✓" : "Bôi đen để chép");
        });
      });
    });
  }

  /* ---------- Ngôn ngữ (i18n) ---------- */
  function applyLang(lang) {
    var I = window.WenkerI18n;
    if (!I || !I.DICT[lang]) return;
    $$("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = I.DICT[lang][key];
      if (val != null) el.innerHTML = val;
    });
    $$("[data-i18n-ph]").forEach(function (el) {
      var v = I.DICT[lang][el.getAttribute("data-i18n-ph")];
      if (v != null) el.setAttribute("placeholder", v);
    });
    document.documentElement.lang = I.HTMLLANG[lang] || lang;
    var t = I.DICT[lang]["docs.title"];
    if (t) { /* keep title static; nothing to do */ }
    try { localStorage.setItem("wenker.lang", lang); } catch (e) {}
    // cập nhật nhãn + dấu chọn trong menu
    var lbl = $("#langCurrent"); if (lbl) lbl.textContent = I.NAMES[lang];
    $$("#langMenu button").forEach(function (b) {
      b.setAttribute("aria-current", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
  }
  function initLang() {
    var I = window.WenkerI18n;
    var btn = $("#langBtn"), menu = $("#langMenu");
    if (!I || !btn || !menu) return;
    // dựng danh sách ngôn ngữ
    menu.innerHTML = "";
    I.CODES.forEach(function (code) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-lang", code);
      b.innerHTML = "<span>" + I.NAMES[code] + "</span><span class=\"code\">" + code.toUpperCase() + "</span>";
      b.addEventListener("click", function () {
        applyLang(code);
        menu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      });
      menu.appendChild(b);
    });
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function (e) {
      if (menu.contains(e.target) || btn.contains(e.target)) return;
      menu.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { menu.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });

    // Tự động xác định ngôn ngữ: ưu tiên lựa chọn đã lưu, nếu chưa chọn thì
    // dò navigator.language (vi/en/zh/fr), khớp thì dùng, không khớp -> "vi".
    var saved = null;
    try { saved = localStorage.getItem("wenker.lang"); } catch (e) {}
    if (!I.DICT[saved]) {
      var nav = (navigator.language || "vi").slice(0, 2).toLowerCase();
      saved = I.DICT[nav] ? nav : "vi";
    }
    applyLang(saved);
  }

  /* ---------- Khởi động ---------- */
  function boot() {
    hydrateIcons();
    initBurger();
    initReveal();
    initCounters();
    initTabs();
    initCopy();
    initLang();
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
