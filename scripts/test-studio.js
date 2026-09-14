/**
 * test-studio.js - mo THAT WENKER Studio (Electron GUI) va kiem tra bang CDP:
 *   - cua so load /ide/ va app hien len sau boot (router in-process song);
 *   - IPC wenkerIde.status() / openFolder / readFile / runCommand hoat dong that;
 *   - model picker duoc nap tu /v1/models.
 *
 * Can man hinh (GUI). Chay: node scripts/test-studio.js
 */
"use strict";
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const ELECTRON = path.join(ROOT, "studio", "node_modules", ".bin", "electron.cmd");

// Chon cong CDP trong de KHONG bao gio bam vofa cua so electron cu con sot lai.
const net = require("net");
function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

let fails = 0;
function check(n, c, extra) { if (c) console.log("  PASS  " + n); else { fails++; console.log("  FAIL  " + n + (extra !== undefined ? "  <- " + JSON.stringify(extra) : "")); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }).on("error", reject);
  });
}

(async () => {
  console.log("== test-studio: mo app Electron that + do IPC qua CDP ==\n");
  if (!fs.existsSync(ELECTRON)) { console.log("Thieu electron binary: " + ELECTRON); process.exit(2); }
  const CDP_PORT = await findFreePort();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "wenker-studio-"));
  const proc = spawn(ELECTRON, [path.join(ROOT, "studio"), "--no-sandbox", "--remote-debugging-port=" + CDP_PORT], {
    env: { ...process.env, WENKER_HOME: home, WENKER_STUDIO_TEST: "1" },
    stdio: ["ignore", "pipe", "pipe"], shell: true
  });
  let appLog = "";
  proc.stdout.on("data", (d) => { appLog += d; });
  proc.stderr.on("data", (d) => { appLog += d; });

  let ws = null;
  try {
    // Cho cua so + router boot.
    const t0 = Date.now();
    let pages = null;
    while (Date.now() - t0 < 45000) {
      try {
        pages = await httpJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (Array.isArray(pages) && pages.some((p) => p.type === "page" && /\/ide\/?$/.test(p.url))) break;
      } catch (e) { /* CDP chưa lên */ }
      await sleep(500);
    }
    const page = pages && pages.find((p) => p.type === "page" && /\/ide\/?$/.test(p.url));
    check("cua so Studio mo duoc va tro toi /ide/", Boolean(page), page ? page.url : appLog.slice(-400));
    if (!page) throw new Error("khong thay page /ide");

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let msgId = 0;
    const waiting = new Map();
    const pageLogs = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.consoleAPICalled") {
        pageLogs.push((m.type || "log") + ": " + (m.args || []).map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(" "));
      } else if (m.method === "Log.entryAdded") {
        pageLogs.push("[" + m.entry.level + "] " + m.entry.source + " " + (m.entry.url || "") + " :: " + m.entry.text);
      }
      if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
    };
    function send(method, params) {
      return new Promise((resolve) => {
        const id = ++msgId; waiting.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
    async function evaluate(expression, awaitPromise) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: Boolean(awaitPromise) });
      if (r.result && r.result.exceptionDetails) return { error: r.result.exceptionDetails.text + " " + JSON.stringify(r.result.exceptionDetails.exception || {}) };
      return { value: r.result && r.result.result && r.result.result.value };
    }

    // DOI DOM parse xong han (CDP page target xuat hien som hon DOM).
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");
    // Reload de app.js chay LAI trong luc ta dang bat console/log.
    await send("Page.reload", { ignoreCache: true });
    await sleep(1200);
    const domT0 = Date.now();
    let domReady = false;
    let dr = { value: null };
    while (Date.now() - domT0 < 20000) {
      dr = await evaluate("document.readyState + '|' + (document.getElementById('app') ? 1 : 0)");
      if (typeof dr.value === "string" && dr.value.endsWith("|1")) { domReady = true; break; }
      await sleep(300);
    }
    check("DOM da parse (#app ton tai)", domReady, dr.value);

    // 1) App visible (boot xong, router in-process song).
    // Sau boot thanh cong thi #app BO hidden, #boot AN hidden -> kiem tra dung chieu.
    const visT0 = Date.now();
    let visible = false;
    let r = { value: null };
    while (Date.now() - visT0 < 30000) {
      r = await evaluate("!document.getElementById('app').classList.contains('hidden')");
      if (r.value === true) { visible = true; break; }
      await sleep(300);
    }
    check("renderer boot xong, #app hien len", visible, r);
    if (!visible) {
      const diag = await evaluate("({msg: document.getElementById('boot-msg').textContent, detail: document.getElementById('boot-detail').textContent, ready: document.readyState})");
      console.log("      DIAGON = " + JSON.stringify(diag.value));
      console.log("      PAGELOG = " + JSON.stringify(pageLogs, null, 2));
    }

    // 2) IPC status() -> port + baseUrl (băng chưng contextBridge + main IPC).
    r = await evaluate("window.wenkerIde.status()", true);
    const st = r.value;
    check("IPC status() tra ve port > 0", st && Number(st.port) > 0 && /^http:\/\/127\.0\.0\.1:\d+$/.test(st.baseUrl), r);

    // 3) Model picker da nap tu /v1/models.
    r = await evaluate("document.getElementById('model-select').options.length", false);
    check("model picker co > 5 model", typeof r.value === "number" && r.value > 5, r);

    // 4) Mo workspace that (goi truc tiep openFolder, bo qua dialog) + doc file qua IPC.
    r = await evaluate(`window.wenkerIde.openFolder(${JSON.stringify(ROOT)})`, true);
    check("IPC openFolder() tra ve workspace + tree", r.value && r.value.root === ROOT && Array.isArray(r.value.tree) && r.value.tree.length > 3, r.value && r.value.tree && r.value.tree.length);
    r = await evaluate("window.wenkerIde.readFile('package.json').then(x => x.content.slice(0, 30))", true);
    check("IPC readFile() doc duoc package.json", typeof r.value === "string" && r.value.includes("wenker-router"), r);

    // 5) Chay lenh that qua IPC (node --version).
    r = await evaluate("window.wenkerIde.runCommand('node', ['--version'], 15000)", true);
    check("IPC runCommand() chay lenh that", r.value && r.value.ok === true && /v\d+\./.test(r.value.stdout), r.value && { ok: r.value.ok, code: r.value.code, err: (r.value.stderr || r.value.error || "").slice(0, 200) });

    // 6) Guard thoat thu muc: ../ phải bị chặn.
    r = await evaluate("window.wenkerIde.readFile('../package.json').then(() => 'NO').catch(e => 'BLOCKED')", true);
    check("guard chan thoat workspace (..)", r.value === "BLOCKED", r);

    // 7) Ghi file test trong workspace (qua IPC) roi don.
    r = await evaluate("window.wenkerIde.writeFile('studio-selftest.txt', 'hello from studio').then(x => x.bytes)", true);
    check("IPC writeFile() ghi duoc", r.value === 17, r);
    check("file ghi ra co that tren dia", fs.existsSync(path.join(ROOT, "studio-selftest.txt")));
    fs.rmSync(path.join(ROOT, "studio-selftest.txt"), { force: true });

    // 8) Editor khong crash: Monaco hoac textarea fallback (poll cho Monaco CDN load).
    const edT0 = Date.now();
    let edKind = "none";
    while (Date.now() - edT0 < 12000) {
      r = await evaluate("(document.querySelector('#editor .monaco-editor') ? 'monaco' : (!document.getElementById('fallback-editor').classList.contains('hidden') ? 'textarea' : 'none'))", false);
      edKind = r.value;
      if (edKind === "monaco" || edKind === "textarea") break;
      await sleep(300);
    }
    check("editor san sang (monaco hoac textarea)", edKind === "monaco" || edKind === "textarea", edKind);
  } catch (e) {
    fails++;
    console.log("  FAIL  crash: " + (e && e.stack ? e.stack : e));
    console.log("--- app log (cuoi) ---\n" + appLog.slice(-1500));
  } finally {
    if (ws) try { ws.close(); } catch (e) {}
    try { proc.kill(); } catch (e) {}
    await sleep(500);
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (e) {}
  }
  console.log("\n== " + (fails === 0 ? "STUDIO OK" : fails + " FAIL") + " ==");
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
