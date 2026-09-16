/* WENKER Router premium landing — interactions. No dependencies. */
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
        btn.textContent = "Đã chép";
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

  /* ---------- card spotlight ---------- */
  document.querySelectorAll(".feat-card, .quote-card, .step").forEach(function (card) {
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
          hue: Math.random() < 0.6 ? "129,140,248" : (Math.random() < 0.5 ? "99,102,241" : "103,232,249")
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
            ctx.strokeStyle = "rgba(129,140,248," + (0.15 * (1 - d / LINK)) + ")";
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

  /* ---------- live terminal demo (self-playing, video-like) ---------- */
  var term = document.getElementById("termDemo");
  if (term) {
    var SCRIPT = [
      { t: "cmd",   s: "npm install -g wenker-router", speed: 34 },
      { t: "cmd",   s: "wenker", speed: 90 },
      { t: "line",  h: '<span class="c-dim">─────────────────────────────────────────</span>' },
      { t: "line",  h: '<span class="c-ok">✓</span> WENKER Router đang chạy tại <span class="c-hl">http://localhost:3600</span>' },
      { t: "line",  h: '<span class="c-dim">  OpenAI    → /v1/chat/completions</span>' },
      { t: "line",  h: '<span class="c-dim">  Anthropic → /v1/messages</span>' },
      { t: "pause", ms: 900 },
      { t: "cmd",   s: 'curl localhost:3600/v1/models | head -3', speed: 24 },
      { t: "line",  h: '<span class="c-dim">{ "data": [</span>' },
      { t: "line",  h: '&nbsp;&nbsp;{ "id": <span class="c-hl">"openai/gpt-4o"</span> },' },
      { t: "line",  h: '&nbsp;&nbsp;{ "id": <span class="c-hl">"ollama/qwen2.5-coder"</span> } ] }</span>' },
      { t: "pause", ms: 900 },
      { t: "cmd",   s: 'wenker ask "giới thiệu WENKER Router trong 1 câu"', speed: 18 },
      { t: "stream", s: "Một cổng duy nhất cho 560+ model AI — chạy ngay trên máy của bạn.", speed: 26 },
      { t: "line",  h: '<span class="c-ok">✓</span> 214 tok · 1.2s ttft · nguồn: <span class="c-hl">wenker-cloud/deepseek-v3</span>' },
      { t: "pause", ms: 2600 }
    ];
    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    var lines = [];
    var caret = '<span class="caret"></span>';
    function render() {
      term.innerHTML = lines.join("\n") + (typingCmd || streaming ? "" : "\n" + '<span class="c-prompt">$</span> ' + caret);
    }
    var typingCmd = false, streaming = false;
    function playStep(i) {
      if (i >= SCRIPT.length) { lines = []; setTimeout(function () { playStep(0); }, 600); return; }
      var step = SCRIPT[i];
      if (step.t === "pause") { setTimeout(function () { playStep(i + 1); }, step.ms); return; }
      if (step.t === "line") { lines.push(step.h); render(); setTimeout(function () { playStep(i + 1); }, 260); return; }
      if (step.t === "cmd") {
        typingCmd = true;
        var idx = 0, cur = "";
        (function typeChar() {
          cur += step.s[idx];
          lines[lines.length - 1] = lines[lines.length - 1]; // noop keep
          var shown = lines.slice(0, -0);
          term.innerHTML = lines.join("\n") + (lines.length ? "\n" : "") +
            '<span class="c-prompt">$</span> ' + esc(cur) + caret;
          idx++;
          if (idx < step.s.length) setTimeout(typeChar, step.speed);
          else {
            lines.push('<span class="c-prompt">$</span> ' + esc(step.s));
            typingCmd = false; render();
            setTimeout(function () { playStep(i + 1); }, 420);
          }
        })();
        return;
      }
      if (step.t === "stream") {
        streaming = true;
        var k = 0;
        (function streamChar() {
          var done = step.s.slice(0, k);
          var base = lines.length; // append on own line, replacing as it grows
          var arr = lines.slice(0, base);
          term.innerHTML = arr.join("\n") + "\n" + esc(done) + caret;
          k++;
          if (k <= step.s.length) setTimeout(streamChar, step.speed);
          else { lines.push(esc(step.s)); streaming = false; render(); setTimeout(function () { playStep(i + 1); }, 400); }
        })();
        return;
      }
    }
    if (reduceMotion) {
      term.innerHTML =
        '<span class="c-prompt">$</span> npm install -g wenker-router\n' +
        '<span class="c-prompt">$</span> wenker\n' +
        '<span class="c-dim">─────────────────────────────────────────</span>\n' +
        '<span class="c-ok">✓</span> WENKER Router đang chạy tại <span class="c-hl">http://localhost:3600</span>\n' +
        '<span class="c-dim">  OpenAI    → /v1/chat/completions</span>\n' +
        '<span class="c-dim">  Anthropic → /v1/messages</span>';
    } else {
      render();
      playStep(0);
    }
  }

  /* ---------- video modal ---------- */
  var modal = document.getElementById("videoModal");
  var video = document.getElementById("promoVideo");
  if (modal) {
    if (video && video.querySelector("source")) {
      video.addEventListener("error", function () {
        modal.querySelector(".video-shell").classList.add("no-video");
      });
      video.querySelector("source").addEventListener("error", function () {
        modal.querySelector(".video-shell").classList.add("no-video");
      });
    }
    function open() { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; if (video) video.play().catch(function(){}); }
    function close() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (video) video.pause(); }
    document.querySelectorAll("[data-video-open]").forEach(function (b) { b.addEventListener("click", open); });
    document.querySelectorAll("[data-video-close]").forEach(function (b) { b.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  /* ---------- intro: animation 4 cảnh (gộp từ intro.html) ---------- */
  (function initIntro() {
    var stage = document.getElementById("intro");
    if (!stage || reduceMotion) return; // reduced-motion: CSS hiện sẵn cảnh cuối

    /* starfield */
    var cv = document.getElementById("introStars");
    if (cv) {
      var cx = cv.getContext("2d");
      var stars = [], sw = 0, sh = 0, sdpr = Math.min(window.devicePixelRatio || 1, 2);
      function sizeStars() {
        var r = stage.getBoundingClientRect();
        sw = r.width; sh = r.height;
        cv.width = sw * sdpr; cv.height = sh * sdpr;
        cx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
        stars = [];
        for (var i = 0; i < 140; i++) stars.push({ x: Math.random() * sw, y: Math.random() * sh, r: Math.random() * 1.4 + .3, v: Math.random() * .3 + .05, a: Math.random() * .7 + .2 });
      }
      sizeStars();
      window.addEventListener("resize", sizeStars);
      (function tick() {
        cx.clearRect(0, 0, sw, sh);
        for (var i = 0; i < stars.length; i++) {
          var s = stars[i]; s.y -= s.v; if (s.y < 0) s.y = sh;
          cx.fillStyle = "rgba(150,160,255," + s.a + ")";
          cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 7); cx.fill();
        }
        requestAnimationFrame(tick);
      })();
    }

    /* wordmark letter cascade */
    var wm = document.getElementById("wmText");
    if (wm) {
      "WENKER·ROUTER".split("").forEach(function (c, i) {
        var sp = document.createElement("span"); sp.className = "ch";
        sp.style.animationDelay = (2.6 + i * .06) + "s";
        if (c === "·") { sp.innerHTML = "<em>·</em>"; } else { sp.textContent = c; }
        wm.appendChild(sp);
      });
    }

    /* scene fade chain */
    function fade(id, at) { var el = document.getElementById(id); if (el) setTimeout(function () { el.classList.add("fade"); }, at); }
    fade("s1", 2100); fade("s2", 5100);
    setTimeout(function () { var s3 = document.getElementById("s3"); if (s3) s3.style.opacity = "1"; }, 5400);
    fade("s3", 10300);

    /* terminal typing */
    var term = document.getElementById("introTerm");
    if (term) {
      var CMD1 = "npm install -g wenker-router", CMD2 = "wenker";
      var OUT = '<span class="dim">────────────────────────────────────────────</span>\n' +
        '<span class="ok">✓</span> WENKER Router đang chạy tại <span class="hl">http://localhost:3600</span>\n' +
        '<span class="dim">  OpenAI    → /v1/chat/completions</span>\n' +
        '<span class="dim">  Anthropic → /v1/messages</span>\n' +
        '<span class="ok">✓</span> 560+ model · <span class="hl">181</span> providers · 0 telemetry';
      function iesc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
      var ilines = [];
      function typeCmd(cmd, speed, then) {
        var i = 0, cur = "";
        (function step() {
          cur = cmd.slice(0, ++i);
          term.innerHTML = ilines.join("\n") + (ilines.length ? "\n" : "") + '<span class="p">$</span> ' + iesc(cur) + '<span class="caret"></span>';
          if (i < cmd.length) setTimeout(step, speed);
          else { ilines.push('<span class="p">$</span> ' + iesc(cmd)); setTimeout(then, 500); }
        })();
      }
      setTimeout(function () {
        typeCmd(CMD1, 42, function () { typeCmd(CMD2, 110, function () {
          setTimeout(function () { term.innerHTML = ilines.join("\n") + "\n" + OUT; }, 400);
        }); });
      }, 5700);
    }
  })();

  /* ---------- year ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
