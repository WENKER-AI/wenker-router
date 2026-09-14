/**
 * WENKER Studio - Electron main process.
 *
 * Nhiem vu:
 *   1) Khoi dong WENKER router NGAY TRONG tiến trình main (require server/index.js)
 *      tren mot cong trong, chi bind 127.0.0.1 -> renderer goi /v1, /api cung origin,
 *      khong doi CORS, admin guard tu dong mo vi loopback.
 *   2) Mo BrowserWindow tai http://127.0.0.1:<port>/ide/ (renderer tinh khong build).
 *   3)Expose cac IPC tool that su: doc/ghi file, liet ke thu muc, chay lenh,
 *      chon thu muc workspace. Moi thao tac file bi chet trong workspace root
 *      (chong thoat thu muc) va moi lenh phai duoc renderer xac nhan truoc khi chay.
 *
 * Khong yeu cau ngu dung cai Node: Electron dung Node cua no de require router.
 */
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT, "server", "index.js");

let mainWindow = null;
let routerPort = 0;
let routerBooted = false;
// Workspace root duoc khoa khi ngu dung mo thu muc; moi IPC file doi chieu voi no.
let workspaceRoot = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForHealth(port, timeoutMs = 25000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    (function tick() {
      const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(true);
        retry();
      });
      req.on("error", retry);
      req.on("timeout", () => { req.destroy(); retry(); });
      function retry() {
        if (Date.now() - t0 > timeoutMs) return reject(new Error("router khong khoi dong kips trong " + timeoutMs + "ms"));
        setTimeout(tick, 300);
      }
    })();
  });
}

async function bootRouter() {
  if (routerBooted) return routerPort;
  const port = await findFreePort();
  process.env.PORT = String(port);
  process.env.HOST = "127.0.0.1";
  // Router lang nghe cong o dinh cua module; require la du de no boot.
  try {
    require(SERVER_ENTRY);
  } catch (e) {
    throw new Error("Khong require duoc server/index.js: " + e.message);
  }
  await waitForHealth(port);
  routerPort = port;
  routerBooted = true;
  return port;
}

// ---- Bao an toan thu muc ---------------------------------------------------
function resolveInWorkspace(rel) {
  if (!workspaceRoot) throw new Error("Chua mo thu muc workspace.");
  const abs = path.resolve(workspaceRoot, rel || ".");
  const rootWithSep = workspaceRoot.endsWith(path.sep) ? workspaceRoot : workspaceRoot + path.sep;
  if (abs !== workspaceRoot && !abs.startsWith(rootWithSep)) {
    throw new Error("Duong dan vuot ngoai workspace: " + rel);
  }
  return abs;
}

function toRel(abs) {
  if (!workspaceRoot) return abs;
  return path.relative(workspaceRoot, abs).split(path.sep).join("/");
}

function listDirTree(dir, depth, max) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const e of entries) {
    if (out.length >= max) break;
    if (e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) {
      if (e.isDirectory() && (e.name === "node_modules" || e.name === ".git")) continue;
    }
    const abs = path.join(dir, e.name);
    const node = { name: e.name, path: toRel(abs), dir: e.isDirectory() };
    if (e.isDirectory() && depth > 0) {
      node.children = listDirTree(abs, depth - 1, max);
    }
    out.push(node);
  }
  return out;
}

// ---- IPC tools ------------------------------------------------------------
function registerIpc() {
  ipcMain.handle("wenker:status", () => ({
    port: routerPort,
    booted: routerBooted,
    baseUrl: `http://127.0.0.1:${routerPort}`,
    ideUrl: `http://127.0.0.1:${routerPort}/ide/`,
    workspace: workspaceRoot
  }));

  ipcMain.handle("wenker:pickFolder", async () => {
    const res = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"] });
    if (res.canceled || !res.filePaths[0]) return null;
    workspaceRoot = res.filePaths[0];
    return { root: workspaceRoot, tree: listDirTree(workspaceRoot, 2, 400) };
  });

  ipcMain.handle("wenker:openFolder", (_e, abs) => {
    // Cho phep renderer yeu cau mo mot thu muc cu the (vd phuc hoi lan truoc).
    if (typeof abs === "string" && fs.existsSync(abs)) {
      workspaceRoot = abs;
      return { root: workspaceRoot, tree: listDirTree(workspaceRoot, 2, 400) };
    }
    return null;
  });

  ipcMain.handle("wenker:listDir", (_e, rel) => {
    const abs = resolveInWorkspace(rel);
    return listDirTree(abs, 1, 400);
  });

  ipcMain.handle("wenker:readFile", (_e, rel) => {
    const abs = resolveInWorkspace(rel);
    const stat = fs.statSync(abs);
    if (stat.size > 2 * 1024 * 1024) throw new Error("File lon hon 2MB, tu choi doc.");
    return { path: toRel(abs), content: fs.readFileSync(abs, "utf8") };
  });

  ipcMain.handle("wenker:writeFile", (_e, payload) => {
    const { rel, content } = payload || {};
    const abs = resolveInWorkspace(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof content === "string" ? content : "", "utf8");
    return { path: toRel(abs), bytes: Buffer.byteLength(content || "", "utf8") };
  });

  ipcMain.handle("wenker:deleteFile", (_e, rel) => {
    const abs = resolveInWorkspace(rel);
    fs.rmSync(abs, { recursive: true, force: true });
    return { path: toRel(rel) };
  });

  ipcMain.handle("wenker:runCommand", (_e, payload) => {
    const { command, args, timeoutMs } = payload || {};
    if (!command) throw new Error("Thieu ten lenh.");
    const cwd = workspaceRoot || ROOT;
    const limit = Math.min(Number(timeoutMs) || 60000, 300000);
    return new Promise((resolve) => {
      const child = spawn(command, Array.isArray(args) ? args : [], { cwd, shell: false, windowsHide: true });
      let stdout = "";
      let stderr = "";
      const cap = 200000;
      const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch (e) {} }, limit);
      child.stdout.on("data", (d) => { if (stdout.length < cap) stdout += d; });
      child.stderr.on("data", (d) => { if (stderr.length < cap) stderr += d; });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ ok: false, error: e.message, stdout, stderr, code: null });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ ok: code === 0, code, stdout, stderr });
      });
    });
  });

  ipcMain.handle("wenker:openExternal", (_e, url) => {
    if (typeof url === "string" && /^https?:\/\//i.test(url)) shell.openExternal(url);
    return true;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0a1420",
    title: "WENKER Studio",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadURL(`http://127.0.0.1:${routerPort}/ide/`);
  mainWindow.on("closed", () => { mainWindow = null; });
}

// Electron mac dinh chan window.open / dieu huong ra ngoai; mo link ngoai bang shell.
app.on("web-contents-created", (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(async () => {
    try {
      await bootRouter();
    } catch (e) {
      dialog.showErrorBox("WENKER Studio khong khoi dong duoc", String(e && e.message ? e.message : e));
      app.quit();
      return;
    }
    registerIpc();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
