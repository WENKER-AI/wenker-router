/**
 * smoke-ide.js - kiem tra /ide/ duoc phuc vu dung va renderer load duoc tai nguyen.
 * Khong mo GUI Electron (can man hinh); chi chung minh router + route /ide + cac file
 * renderer ton tai va khop, de Electron loadURL chac chan khong 404.
 */
"use strict";
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const PORT = 8211;
const BASE = `http://127.0.0.1:${PORT}`;

function get(p) {
  return new Promise((resolve, reject) => {
    http.get(BASE + p, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    }).on("error", reject);
  });
}

let fails = 0;
function check(n, c, extra) { if (c) console.log("  PASS  " + n); else { fails++; console.log("  FAIL  " + n + (extra ? "  <- " + extra : "")); } }

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wenker-ide-"));
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server", "index.js")], {
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1", WENKER_HOME: home }, stdio: ["ignore", "ignore", "pipe"]
  });
  child.stderr.on("data", () => {});
  const t0 = Date.now();
  while (true) { try { const r = await get("/health"); if (r.status < 500) break; } catch (e) {} if (Date.now() - t0 > 20000) { console.log("router khong len"); child.kill(); process.exit(2); } await new Promise((r) => setTimeout(r, 300)); }

  try {
    const idx = await get("/ide/");
    check("/ide/ tra 200", idx.status === 200, "status=" + idx.status);
    check("/ide/ la HTML cua Studio", /WENKER Studio/.test(idx.body) && /id="app"/.test(idx.body));
    check("/ide/ nap app.js", /app\.js/.test(idx.body));
    const css = await get("/ide/style.css");
    check("/ide/style.css 200", css.status === 200 && /--accent/.test(css.body), "status=" + css.status);
    const appjs = await get("/ide/app.js");
    check("/ide/app.js 200", appjs.status === 200 && /wenkerIde/.test(appjs.body), "status=" + appjs.status);
    // main.js thuoc tien trinh Node (ide/), KHONG nam trong ide/renderer ->
    // khong duoc lo ra qua HTTP. Day la cach ly an toan, khong phai loi.
    const mainjs = await get("/ide/main.js");
    check("/ide/main.js khong bi lo ra ngoai (isolation ok)", !/require\(["']electron["']\)/.test(mainjs.body), "status=" + mainjs.status);
    const redir = await get("/ide");
    check("/ide -> redirect /ide/", redir.status === 301 || redir.status === 302 || /WENKER Studio/.test(redir.body), "status=" + redir.status);
    const models = await get("/v1/models");
    let mj = null; try { mj = JSON.parse(models.body); } catch (e) {}
    check("/v1/models 200 + co data", models.status === 200 && mj && Array.isArray(mj.data) && mj.data.length > 0, "count=" + (mj && mj.data && mj.data.length));

    // Cac file renderer phai ton tai tren dia (Electron doc cung nguon nay).
    const rd = path.join(__dirname, "..", "studio", "renderer");
    for (const f of ["index.html", "app.js", "style.css"]) check("file ton tai: " + f, fs.existsSync(path.join(rd, f)));
    check("studio/main.js ton tai", fs.existsSync(path.join(__dirname, ".", "..", "studio", "main.js")));
    check("studio/preload.js ton tai", fs.existsSync(path.join(__dirname, ".", "..", "studio", "preload.js")));
    check("electron binary ton tai", fs.existsSync(path.join(__dirname, ".", "..", "studio", "node_modules", "electron", "dist", "electron.exe")));
  } finally {
    child.kill();
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) {}
  }
  console.log("\n== " + (fails === 0 ? "SMOKE OK" : fails + " FAIL") + " ==");
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
