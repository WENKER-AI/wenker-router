/* WENKER — 3 mini-game pixel trên 1 canvas: Rắn (snake), Bắt cá (catch),
 * Cá voi bay (flappy). Không thư viện. Bàn phím + cảm ứng.
 * Vẽ bằng ô vuông trên lưới 120x80, phóng to x4, imageSmoothing off.
 */
(function () {
  "use strict";

  var W = 120, H = 80, SCALE = 4;
  var COL = {
    bg: "#0a1420", whale: "#5aa7e8", green: "#7fd8a4",
    line: "#24384e", warn: "#e8c37a", text: "#e8f0f8"
  };
  function rand(n) { return Math.floor(Math.random() * n); }

  /* ---------- RẮN ---------- */
  function makeSnake() {
    var snake, dir, next, food, score, alive;
    function inside(p) { return snake.some(function (s) { return s.x === p.x && s.y === p.y; }); }
    function place() { var p; do { p = { x: rand(W), y: rand(H) }; } while (inside(p)); return p; }
    function reset() {
      snake = [{ x: 20, y: 40 }, { x: 19, y: 40 }, { x: 18, y: 40 }];
      dir = { x: 1, y: 0 }; next = dir; score = 0; alive = true; food = place();
    }
    return {
      fps: 11, label: "RAN",
      reset: reset,
      isAlive: function () { return alive; },
      key: function (k) {
        var m = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
        var d = m[k]; if (!d) return;
        if (d.x === -dir.x && d.y === -dir.y) return;
        next = d;
      },
      step: function () {
        dir = next;
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= W || head.y >= H || inside(head)) { alive = false; return; }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) { score += 1; food = place(); }
        else snake.pop();
      },
      draw: function (c) {
        c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
        c.fillStyle = COL.green;
        snake.forEach(function (s) { c.fillRect(s.x, s.y, 1, 1); });
        c.fillStyle = COL.warn; c.fillRect(food.x, food.y, 1, 1);
        hud(c, this.label + "  ·  " + score);
        if (!alive) over(c);
      }
    };
  }

  /* ---------- BẮT CÁ ---------- */
  function makeCatch() {
    var basket, fishes, score, lives, alive, spawn;
    function reset() {
      basket = { x: W / 2 - 5, w: 10 }; fishes = []; score = 0; lives = 3; alive = true; spawn = 0;
    }
    return {
      fps: 30, label: "CA",
      reset: reset,
      isAlive: function () { return alive; },
      key: function (k) {
        if (k === "left") basket.x = Math.max(0, basket.x - 8);
        if (k === "right") basket.x = Math.min(W - basket.w, basket.x + 8);
      },
      pointer: function (x) { basket.x = Math.max(0, Math.min(W - basket.w, x - basket.w / 2)); },
      step: function () {
        spawn += 1;
        if (spawn % 14 === 0) fishes.push({ x: rand(W - 2) + 1, y: 0, v: 0.5 + Math.random() * 0.7 });
        for (var i = fishes.length - 1; i >= 0; i--) {
          var f = fishes[i]; f.y += f.v;
          if (f.y >= H - 6 && f.x > basket.x - 1 && f.x < basket.x + basket.w + 1) { fishes.splice(i, 1); score += 1; continue; }
          if (f.y > H) { fishes.splice(i, 1); lives -= 1; if (lives <= 0) alive = false; }
        }
      },
      draw: function (c) {
        c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
        c.fillStyle = "rgba(74,168,255,0.10)"; c.fillRect(0, H - 5, W, 5);
        c.fillStyle = COL.whale;
        fishes.forEach(function (f) { var y = Math.floor(f.y); c.fillRect(f.x - 1, y, 3, 1); c.fillRect(f.x, y - 1, 1, 1); });
        c.fillStyle = COL.green;
        c.fillRect(basket.x, H - 6, basket.w, 1);
        c.fillRect(basket.x, H - 6, 1, 4);
        c.fillRect(basket.x + basket.w - 1, H - 6, 1, 4);
        hud(c, this.label + "  ·  " + score + "  ·  " + hearts(lives));
        if (!alive) over(c);
      }
    };
  }

  /* ---------- CÁ VOI BAY ---------- */
  function makeFlappy() {
    var GAP = 22, bird, vel, pipes, score, alive, frame, gapY;
    function reset() {
      bird = { x: 24, y: H / 2, r: 2 }; vel = 0; pipes = []; score = 0; alive = true; frame = 0; gapY = H / 2;
    }
    return {
      fps: 40, label: "BAY",
      reset: reset,
      isAlive: function () { return alive; },
      key: function (k) { if (k === "flap" && alive) vel = -2.3; },
      tap: function () { if (alive) vel = -2.3; },
      step: function () {
        frame += 1;
        vel += 0.12; bird.y += vel;
        if (bird.y < 0 || bird.y > H - 1) alive = false;
        if (frame % 60 === 0) { gapY = 12 + rand(H - 24); pipes.push({ x: W + 6, gap: gapY, passed: false }); }
        for (var i = pipes.length - 1; i >= 0; i--) {
          var p = pipes[i]; p.x -= 0.9;
          if (bird.x + bird.r > p.x && bird.x - bird.r < p.x + 5) {
            if (bird.y - bird.r < p.gap - GAP / 2 || bird.y + bird.r > p.gap + GAP / 2) alive = false;
          }
          if (!p.passed && p.x + 5 < bird.x) { p.passed = true; score += 1; }
          if (p.x < -6) pipes.splice(i, 1);
        }
      },
      draw: function (c) {
        c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
        c.fillStyle = COL.line;
        pipes.forEach(function (p) {
          c.fillRect(p.x, 0, 5, p.gap - GAP / 2);
          c.fillRect(p.x, p.gap + GAP / 2, 5, H - (p.gap + GAP / 2));
        });
        c.fillStyle = COL.whale;
        var by = Math.round(bird.y);
        c.fillRect(bird.x - 2, by, 5, 2); c.fillRect(bird.x - 1, by - 1, 3, 4);
        hud(c, this.label + "  ·  " + score);
        if (!alive) over(c);
      }
    };
  }

  function hearts(n) { var s = ""; for (var i = 0; i < Math.max(0, n); i++) s += "\u2665"; return s || "-"; }
  function hud(c, txt) {
    c.fillStyle = COL.text; c.font = "5px 'JetBrains Mono', monospace";
    c.textBaseline = "top"; c.fillText(txt, 2, 2);
  }
  function over(c) {
    c.fillStyle = "rgba(1,4,10,0.72)"; c.fillRect(0, 0, W, H);
    c.textBaseline = "top";
    c.fillStyle = COL.green; c.font = "8px 'JetBrains Mono', monospace";
    c.fillText("GAME OVER", W / 2 - 22, H / 2 - 8);
    c.fillStyle = COL.text; c.font = "5px 'JetBrains Mono', monospace";
    c.fillText("space / tap = choi lai", W / 2 - 26, H / 2 + 4);
  }

  /* ---------- Trọng tài ---------- */
  function Mount(canvas, listEl) {
    var games = { snake: makeSnake(), catch: makeCatch(), flappy: makeFlappy() };
    var current = null, raf = null, acc = 0, last = 0;

    canvas.width = W * SCALE; canvas.height = H * SCALE;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    function use(name) {
      current = games[name];
      if (current.reset) current.reset();
      acc = 0; last = 0;
      Array.prototype.forEach.call(listEl.querySelectorAll("button"), function (b) {
        b.classList.toggle("active", b.getAttribute("data-game") === name);
      });
    }

    function loop(ts) {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !current) { last = ts; return; }
      var interval = 1000 / current.fps;
      if (!last) last = ts;
      acc += ts - last; last = ts;
      if (acc > 250) acc = interval; // không nhảy cóc khi tab quay lại
      while (acc >= interval) {
        if (current.isAlive()) current.step();
        acc -= interval;
      }
      current.draw(ctx);
    }

    var KEYS = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "flap", Enter: "flap" };
    function keyHandler(e) {
      var k = KEYS[e.code]; if (!k || !current) return;
      e.preventDefault();
      if (!current.isAlive()) { current.reset(); return; }
      current.key(k);
    }
    function pointerDown(e) {
      if (!current) return;
      if (!current.isAlive()) { current.reset(); return; }
      if (current.tap) current.tap(); else if (current.key) current.key(e.pointerType === "mouse" ? "flap" : "flap");
      if (e.pointerType === "touch" && current.pointer) pointerMove(e);
    }
    function pointerMove(e) {
      if (!current || !current.pointer) return;
      var rect = canvas.getBoundingClientRect();
      current.pointer(((e.clientX - rect.left) / rect.width) * W);
    }
    function vis() { last = 0; acc = 0; }

    document.addEventListener("keydown", keyHandler);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    document.addEventListener("visibilitychange", vis);

    Array.prototype.forEach.call(listEl.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { use(b.getAttribute("data-game")); });
    });

    use("snake");
    current.draw(ctx);
    raf = requestAnimationFrame(loop);

    return {
      destroy: function () {
        cancelAnimationFrame(raf);
        document.removeEventListener("keydown", keyHandler);
        document.removeEventListener("visibilitychange", vis);
      }
    };
  }

  window.WenkerGames = { mount: function (canvas, list) { return Mount(canvas, list); } };
})();
