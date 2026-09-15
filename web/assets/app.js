/* WENKER Router landing - interactions. No dependencies. */
(function () {
  "use strict";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- scroll progress + header ---------- */
  var progress = document.getElementById("scrollProgress");
  var header = document.getElementById("siteHeader");
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    if (progress) progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    if (header) header.classList.toggle("scrolled", h.scrollTop > 24);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile nav ---------- */
  var burger = document.getElementById("burger");
  var navLinks = document.getElementById("navLinks");
  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      burger.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open);
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }

  /* ---------- reveal on scroll ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 70 + "ms";
    io.observe(el);
  });

  /* ---------- count-up stats ---------- */
  var counted = new WeakSet();
  var statIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting || counted.has(e.target)) return;
      counted.add(e.target);
      var el = e.target, target = +el.getAttribute("data-count"), t0 = null;
      if (reduceMotion) { el.textContent = target; return; }
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / 1400, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll("[data-count]").forEach(function (el) { statIO.observe(el); });

  /* ---------- generic tab helper ---------- */
  function setupTabs(barId, indicatorId, attr, btnSel) {
    var bar = document.getElementById(barId);
    if (!bar) return;
    var indicator = document.getElementById(indicatorId);
    var btns = bar.querySelectorAll(btnSel);
    function move(btn) {
      if (!indicator) return;
      indicator.style.left = btn.offsetLeft + "px";
      indicator.style.width = btn.offsetWidth + "px";
    }
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute(attr);
        var group = btn.closest(".tabs, .wtabs");
        group.querySelectorAll(".panel, .wpanel").forEach(function (p) {
          p.classList.toggle("active", p.id === target.slice(1));
        });
        btns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        move(btn);
      });
    });
    var active = bar.querySelector(".active") || btns[0];
    if (active) requestAnimationFrame(function () { move(active); });
    window.addEventListener("resize", function () {
      var cur = bar.querySelector(".active");
      if (cur) move(cur);
    });
  }
  setupTabs("installTabs", "tabIndicator", "data-tab", ".tab");
  setupTabs("wtabBar", "wtabIndicator", "data-wtab", ".wtab");

  /* ---------- copy buttons ---------- */
  document.querySelectorAll("[data-copy-btn]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sel = btn.getAttribute("data-copy-target");
      var box = sel ? document.querySelector(sel) : null;
      var text = (box && box.getAttribute("data-copy")) ||
                 (box ? box.querySelector("pre").textContent : btn.getAttribute("data-copy")) || "";
      function done() {
        var old = btn.textContent;
        btn.textContent = "Da chep";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = old; btn.classList.remove("copied"); }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text.trim()).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text.trim(); document.body.appendChild(ta);
        ta.select(); try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta); done();
      }
    });
  });

  /* ---------- card spotlight (follows cursor) ---------- */
  document.querySelectorAll(".feat-card").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- hero network canvas ---------- */
  var canvas = document.getElementById("netCanvas");
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext("2d");
    var nodes = [], W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var mouse = { x: -9999, y: -9999 };
    function resize() {
      var r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(90, Math.floor((W * H) / 16000));
      nodes = [];
      for (var i = 0; i < n; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6,
          hue: Math.random() < 0.5 ? "74,168,255" : (Math.random() < 0.5 ? "106,92,255" : "126,231,135")
        });
      }
    }
    resize();
    window.addEventListener("resize", resize);
    canvas.parentElement.addEventListener("pointermove", function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    canvas.parentElement.addEventListener("pointerleave", function () {
      mouse.x = -9999; mouse.y = -9999;
    });
    var LINK = 130;
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j], dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = "rgba(120,150,220," + (0.16 * (1 - d / LINK)) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        var mdx = a.x - mouse.x, mdy = a.y - mouse.y, md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 160 && md > 0.01) { a.x += (mdx / md) * 0.6; a.y += (mdy / md) * 0.6; }
        ctx.fillStyle = "rgba(" + a.hue + ",0.75)";
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();