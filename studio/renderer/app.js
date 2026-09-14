/**
 * WENKER Studio - renderer (tinh khong build).
 *
 * Agent IDE that goi model qua router (/v1/chat/completions) kem `tools` va chay
 * vong lap that: model tra tool_calls -> thuc thi qua IPC (doc/ghi file, liet ke,
 * chay lenh, git) -> day ket qua tro lai -> lap lai den khi xong.
 *
 * Toan bo UI/UX: splash dong, activity bar, panel keo gian, command palette,
 * quick-open, diff accept/reject, streaming, task-card, @mention, checkpoint/undo,
 * git, terminal, model&key panel, theme/accent/layout, status bar.
 */
"use strict";

window.__studioLoaded = true;
window.addEventListener("error", function (e) {
  try {
    var d = document.getElementById("boot-detail");
    if (d) d.textContent = "JS-ERROR: " + (e.message || "") + " @" + (e.filename || "") + ":" + (e.lineno || "");
  } catch (x) {}
});

const api = window.wenkerIde || {};
const id = (x) => document.getElementById(x);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

const state = {
  baseUrl: "",
  port: 0,
  workspace: null,
  recents: [],
  config: {},
  models: [],
  tabs: [],
  active: null,
  monaco: null,
  editorKind: null,
  history: [],
  running: false,
  abort: false,
  planMode: false,
  turnTouched: null, // Set duoc snapshot trong luot agent hien tai
  toolCalls: 0,
  view: "explorer",
  splitFile: null
};

const SYSTEM_PROMPT =
  "Ban la agent lap trinh trong WENKER Studio, lam viec truc tiep trong thu muc workspace " +
  "tren may ngu dung. Hay dung cac tool (read_file, write_file, list_dir, run_command) de hoan " +
  "thanh nhiem vu thay vi chi mo ta. Duong dan tuong doi so voi goc workspace. Khi tao/ghi file " +
  "hay chay lenh, noi ngan gon ban dang lam gi. Tra loi bang tieng Viet, dung Markdown.";
const PLAN_PROMPT =
  "Ban la kiem truc su WENKER Studio. NHIEM VU DUY NHAT bay gio: lap ke hoach. KHONG duoc goi bat ky " +
  "tool nao. Hay tra ra mot ke hoach dang danh sach buoc (Markdown checkbox - [ ]) ro rang, ngan gon, " +
  "co the thuc hien duoc. Tra loi tieng Viet.";

const TIPS = [
  "Meo: nhan Ctrl+Shift+P de mo Command Palette.",
  "Meo: Ctrl+P de nhay nhanh den mot file.",
  "Meo: go @ trong o chuyen de gan file lam ngu canh cho agent.",
  "Meo: bat Auto-allow neu ban tin tuong va muon agent chay khong hoi.",
  "Meo: model co badge 'tool' moi chay duoc agent; model free khong key thi khong.",
  "Meo: moi lan agent ghi file co nut Hoan tac de quay lai trang thai cu."
];

const TOOLS = [
  { type: "function", function: { name: "read_file", description: "Doc noi dung mot file text trong workspace.",
    parameters: { type: "object", properties: { path: { type: "string", description: "duong dan tuong doi, vi du src/App.jsx" } }, required: ["path"] } } },
  { type: "function", function: { name: "write_file", description: "Tao hoac ghi de mot file trong workspace (tu dong tao thu muc cha).",
    parameters: { type: "object", properties: { path: { type: "string", description: "duong dan tuong doi" }, content: { type: "string", description: "toan bo noi dung file" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "list_dir", description: "Liet ke cac file/con trong mot thu muc cua workspace.",
    parameters: { type: "object", properties: { path: { type: "string", description: "duong dan thu muc, de trong = goc workspace" } }, required: [] } } },
  { type: "function", function: { name: "run_command", description: "Chay mot lenh trong thu muc workspace va tra ve stdout/stderr.",
    parameters: { type: "object", properties: { command: { type: "string", description: "ten lenh, vi du node, git, npm" }, args: { type: "array", items: { type: "string" }, description: "mang tham so" } }, required: ["command"] } } }
];

// ---- SPLASH boot steps ----------------------------------------------------
const STEPS = ["Khoi tao", "Boot router", "Tai danh sach model", "San sang"];
function renderSteps(activeIdx) {
  const box = id("boot-steps");
  if (!box) return;
  box.innerHTML = "";
  STEPS.forEach((s, i) => {
    const li = document.createElement("li");
    const done = i < activeIdx;
    const act = i === activeIdx;
    li.className = done ? "done" : act ? "active" : "";
    li.innerHTML = '<span class="dot">' + (done ? "\u25CF" : act ? "\u25CF" : "\u00B7") + "</span><span>" + s + "</span>";
    box.appendChild(li);
  });
  const fill = id("boot-fill");
  if (fill) fill.style.width = Math.round((Math.max(0, activeIdx) / STEPS.length) * 100) + "%";
}
function bootMsg(m) { const e = id("boot-msg"); if (e) e.textContent = m; }
function bootDetail(m) { const e = id("boot-detail"); if (e) e.textContent = m; }
function rotateTips() {
  const e = id("boot-tip");
  if (!e) return;
  let i = 0;
  const t = setInterval(() => { if (id("boot").classList.contains("hidden")) return clearInterval(t); e.textContent = TIPS[i % TIPS.length]; i++; }, 1800);
}

// ---- Boot -----------------------------------------------------------------
async function boot() {
  try {
    if (!api || typeof api.status !== "function") throw new Error("window.wenkerIde khong ton tai (preload chua nap).");
    renderSteps(0);
    rotateTips();
    bootMsg("Dang ket noi...");
    const st = await api.status();
    state.baseUrl = st.baseUrl;
    state.port = st.port;
    state.recents = (st.config && st.config.recents) || [];
    state.config = st.config || {};
    applyConfigToUI();
    renderSteps(1);
    bootMsg("Router song tai " + st.baseUrl);
    renderSteps(2);
    await loadModels();
    renderSteps(3);
    bootMsg("San sang.");
    await sleep(260);
    // Fade splash
    id("boot").classList.add("fade-out");
    await sleep(420);
    id("boot").classList.add("hidden");
    id("app").classList.remove("hidden");
    id("topbar").classList.remove("hidden");
    initEditor();
    wireResizers();
    renderPaletteCommands();
    // Phuc hoi workspace gan nhat
    const last = state.config.lastWorkspace;
    if (last) {
      try { const res = await api.openFolder(last); if (res) applyWorkspace(res); } catch (e) { /* co the bi xoa */ }
    }
    if (!state.workspace) showHero(true);
    refreshModelsPanel();
  } catch (e) {
    bootDetail("Loi khoi dong: " + String(e && e.message ? e.message : e));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Config / theme -------------------------------------------------------
function applyConfigToUI() {
  const c = state.config || {};
  document.body.dataset.theme = c.theme || "dark";
  document.body.dataset.accent = c.accent || "ocean";
  document.body.dataset.layout = c.layout || "split";
  const fs = c.fontsize || 13;
  document.documentElement.style.setProperty("--fs", fs + "px");
  if (id("set-theme")) id("set-theme").value = c.theme || "dark";
  if (id("set-accent")) id("set-accent").value = c.accent || "ocean";
  if (id("set-layout")) id("set-layout").value = c.layout || "split";
  if (id("set-fontsize")) id("set-fontsize").value = fs;
  if (id("set-minimap")) id("set-minimap").checked = !!c.minimap;
  if (id("set-agentsystem")) id("set-agentsystem").checked = c.agentShort !== false;
  if (c.sidebarWidth && id("sidebar")) id("sidebar").style.width = c.sidebarWidth + "px";
  if (c.chatWidth && id("chat-pane")) id("chat-pane").style.width = c.chatWidth + "px";
}
function collectConfig() {
  return {
    theme: id("set-theme").value,
    accent: id("set-accent").value,
    layout: id("set-layout").value,
    fontsize: Number(id("set-fontsize").value),
    minimap: id("set-minimap").checked,
    agentShort: id("set-agentsystem").checked,
    model: id("model-select").value,
    lastWorkspace: state.workspace,
    recents: state.recents,
    sidebarWidth: id("sidebar") ? parseInt(id("sidebar").style.width || "260", 10) : 260,
    chatWidth: id("chat-pane") ? parseInt(id("chat-pane").style.width || "420", 10) : 420
  };
}
async function persistConfig() {
  Object.assign(state.config, collectConfig());
  try { await api.configSave(state.config); } catch (e) {}
}

// ---- Models ---------------------------------------------------------------
async function loadModels() {
  const r = await fetch(state.baseUrl + "/v1/models");
  const j = await r.json();
  state.models = j.data || [];
  renderModelSelect();
  updateStatusModel();
}
function rank(m) {
  const good = m.wenker_status === "alive" && !m.wenker_needs_key;
  const tool = m.wenker_supports_tools;
  return (good ? 0 : m.wenker_status === "alive" ? 1 : m.wenker_status === "needs_key" ? 2 : 3) + (tool ? 0 : 0.5);
}
function renderModelSelect() {
  const sel = id("model-select");
  sel.innerHTML = "";
  const uniq = dedupeById(state.models).slice().sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));
  for (const m of uniq) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = labelFor(m);
    sel.appendChild(o);
  }
  const saved = state.config.model && uniq.find((m) => m.id === state.config.model);
  const firstGood = uniq.find((m) => rank(m) < 1 && m.wenker_supports_tools) || uniq.find((m) => rank(m) < 1) || uniq[0];
  if (saved) sel.value = saved.id; else if (firstGood) sel.value = firstGood.id;
}
function labelFor(m) {
  const b = [];
  if (m.wenker_supports_tools) b.push("tool");
  if (m.wenker_free) b.push("free");
  if (m.wenker_needs_key || m.wenker_status === "needs_key") b.push("can-key");
  if (m.wenker_status === "down") b.push("xuong");
  return m.id + (b.length ? "  [" + b.join(" ") + "]" : "");
}
function dedupeById(list) {
  const seen = new Set(); const out = [];
  for (const m of list) { if (m.id.includes("/")) continue; if (seen.has(m.id)) continue; seen.add(m.id); out.push(m); }
  return out;
}
function currentModelMeta() { return state.models.find((m) => m.id === id("model-select").value) || null; }
function updateStatusModel() {
  const m = currentModelMeta();
  const e = id("sb-model");
  if (e) { e.textContent = m ? m.id : "—"; e.classList.toggle("accent", !!(m && m.wenker_supports_tools)); }
}

// ---- Editor (Monaco + fallback) ------------------------------------------
function initEditor() {
  try {
    if (!window.require) throw new Error("Monaco loader khong co");
    window.MonacoEnvironment = {
      getWorkerUrl: function () {
        return URL.createObjectURL(new Blob([
          "self.MonacoEnvironment={baseUrl:'https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/'};" +
          "importScripts('https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs/base/worker/workerMain.js');"
        ], { type: "text/javascript" }));
      }
    };
    window.require.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs" } });
    let done = false;
    const timeout = setTimeout(() => { if (!done) useTextarea(); }, 6000);
    window.require(["vs/editor/editor.main"], function () {
      if (done) return; done = true; clearTimeout(timeout); setupMonaco();
    }, function () { if (!done) { done = true; clearTimeout(timeout); useTextarea(); } });
  } catch (e) { useTextarea(); }
}
function setupMonaco() {
  state.editorKind = "monaco";
  state.monaco = window.monaco.editor.create(id("editor"), {
    value: "", theme: state.config.theme === "light" ? "vs" : "vs-dark", automaticLayout: true,
    fontSize: state.config.fontsize || 13, minimap: { enabled: !!state.config.minimap },
    scrollBeyondLastLine: false, smoothScrolling: true, renderLineHighlight: "all", fontFamily: "var(--mono)"
  });
  state.monaco.onDidChangeModelContent(() => {
    const t = state.tabs.find((x) => x.path === state.active);
    if (t) { t.content = state.monaco.getValue(); if (!t.loading) { t.dirty = true; renderTabs(); } }
  });
  state.monaco.onDidChangeCursorPosition((e) => {
    id("sb-pos").textContent = "Ln " + e.position.lineNumber + ", Col " + e.position.column;
  });
  // Ctrl+S luu file
  state.monaco.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, saveActive);
}
function useTextarea() {
  state.editorKind = "textarea";
  const ta = id("fallback-editor");
  ta.classList.remove("hidden");
  ta.addEventListener("input", () => {
    const t = state.tabs.find((x) => x.path === state.active);
    if (t) { t.value = ta.value; t.content = ta.value; t.dirty = true; renderTabs(); }
  });
  ta.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveActive(); } });
  ta.addEventListener("keyup", updatePosTextarea);
  ta.addEventListener("click", updatePosTextarea);
}
function updatePosTextarea() {
  const ta = id("fallback-editor"); const upto = ta.value.slice(0, ta.selectionStart).split("\n");
  id("sb-pos").textContent = "Ln " + upto.length + ", Col " + (upto[upto.length - 1].length + 1);
}
function langForPath(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  return ({ js:"javascript",jsx:"javascript",mjs:"javascript",cjs:"javascript",ts:"typescript",tsx:"typescript",json:"json",css:"css",scss:"scss",less:"css",html:"html",htm:"html",vue:"html",md:"markdown",markdown:"markdown",py:"python",c:"c",h:"c",cpp:"cpp",hpp:"cpp",cs:"csharp",go:"go",rs:"rust",java:"java",rb:"ruby",php:"php",yml:"yaml",yaml:"yaml",sh:"shell",bash:"shell",ps1:"powershell",bat:"bat",xml:"xml",sql:"sql",txt:"plaintext" })[ext] || "plaintext";
}
function setEditorContent(text) {
  if (state.editorKind === "monaco" && state.monaco) {
    const model = state.monaco.getModel();
    window.monaco.editor.setModelLanguage(model, langForPath(state.active || ""));
    state.monaco.setValue(text || "");
    id("sb-lang").textContent = langForPath(state.active || "");
  } else {
    id("fallback-editor").value = text || "";
    id("sb-lang").textContent = langForPath(state.active || "");
  }
}
function getEditorContent() {
  if (state.editorKind === "monaco" && state.monaco) return state.monaco.getValue();
  return id("fallback-editor").value;
}

// ---- Tabs / open file -----------------------------------------------------
async function openFile(rel) {
  if (state.tabs.some((t) => t.path === rel)) { activateTab(rel); return; }
  let content = "";
  try { const r = await api.readFile(rel); content = r.content; }
  catch (e) { return showError("Doc file that bai: " + e.message); }
  state.tabs.push({ path: rel, content, dirty: false });
  activateTab(rel);
}
function activateTab(rel) {
  state.active = rel;
  const t = state.tabs.find((x) => x.path === rel);
  if (t) setEditorContent(t.content || "");
  renderTabs(); highlightTree(); renderCrumbs();
  maybeShowPreview();
}
async function saveActive() {
  const t = state.tabs.find((x) => x.path === state.active);
  if (!t) return;
  t.content = getEditorContent();
  try { await api.writeFile(t.path, t.content); t.dirty = false; renderTabs(); addSystem("Da luu " + t.path); }
  catch (e) { showError("Luu that bai: " + e.message); }
}
function renderTabs() {
  const box = id("tabs"); box.innerHTML = "";
  for (const t of state.tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.path === state.active ? " active" : "");
    el.innerHTML = '<span class="tico">' + fileIcon(t.path) + '</span><span>' + escapeHtml(shortName(t.path)) + "</span>" +
      (t.dirty ? '<span class="dot">\u25CF</span>' : "") + '<span class="x">\u2715</span>';
    el.querySelector(".x").onclick = (ev) => { ev.stopPropagation(); closeTab(t.path); };
    el.onclick = () => activateTab(t.path);
    el.onauxclick = (ev) => { if (ev.button === 1) { ev.preventDefault(); closeTab(t.path); } };
    el.oncontextmenu = (ev) => { ev.preventDefault(); showTabMenu(ev, t.path); };
    box.appendChild(el);
  }
}
function shortName(p) { return p.split("/").pop(); }
function closeTab(rel) {
  state.tabs = state.tabs.filter((t) => t.path !== rel);
  if (state.active === rel) { const next = state.tabs[state.tabs.length - 1]; if (next) activateTab(next.path); else { state.active = null; setEditorContent(""); } }
  renderTabs(); renderCrumbs();
  if (state.splitFile === rel) closePreview();
}
function fileIcon(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  if (["js","mjs","cjs"].includes(ext)) return "js";
  if (["jsx","tsx","ts"].includes(ext)) return "ts";
  if (["json"].includes(ext)) return "{}";
  if (["css","scss","less"].includes(ext)) return "#";
  if (["html","htm","vue"].includes(ext)) return "<>";
  if (["md","markdown"].includes(ext)) return "md";
  if (["py"].includes(ext)) return "py";
  return "";
}
function renderCrumbs() {
  const box = id("crumbs");
  if (!state.active) { box.innerHTML = '<span class="crumb-root">WENKER Studio</span>'; return; }
  const parts = state.active.split("/");
  box.innerHTML = parts.map((p, i) => (i === parts.length - 1 ? '<span class="crumb-file">' + escapeHtml(p) + "</span>" : escapeHtml(p))).join('<span class="sep">\u203A</span>');
}

// ---- Preview (markdown/html) ---------------------------------------------
function maybeShowPreview() {
  const ext = (state.active || "").split(".").pop();
  if (ext === "md" || ext === "markdown" || ext === "html" || ext === "htm") { /* tu dong? khong, hien nut */ }
}
function openPreview() {
  if (!state.active) return;
  const ext = (state.active.split(".").pop() || "").toLowerCase();
  if (ext !== "md" && ext !== "markdown" && ext !== "html" && ext !== "htm") { addSystem("Preview chi ho tro .md / .html"); return; }
  const content = getEditorContent();
  const col = id("preview-col"); col.classList.remove("hidden");
  id("resizer-split").classList.remove("hidden");
  const frame = id("preview-frame");
  const html = (ext === "md" || ext === "markdown") ? "<!doctype html><meta charset=utf-8><style>body{font-family:system-ui;max-width:800px;margin:24px auto;padding:0 16px;color:#16222e;line-height:1.6}pre{background:#f4f6f8;padding:10px;border-radius:8px;overflow:auto}code{background:#f4f6f8;padding:1px 4px;border-radius:4px}img{max-width:100%}</style><body>" + simpleMarkdown(content) + "</body>"
    : content;
  frame.srcdoc = html;
  state.splitFile = state.active;
}
function closePreview() { id("preview-col").classList.add("hidden"); id("resizer-split").classList.add("hidden"); state.splitFile = null; }
function simpleMarkdown(md) {
  let s = escapeHtml(md);
  s = s.replace(/```([\s\S]*?)```/g, (m, c) => "<pre><code>" + c + "</code></pre>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/^###### (.*)$/gm, "<h6>$1</h6>").replace(/^##### (.*)$/gm, "<h5>$1</h5>").replace(/^#### (.*)$/gm, "<h4>$1</h4>").replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>");
  s = s.replace(/^- (.*)$/gm, "<li>$1</li>").replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  s = s.replace(/\n\n/g, "</p><p>");
  return "<p>" + s + "</p>";
}

// ---- Workspace / tree -----------------------------------------------------
async function onPickFolder() { const res = await api.pickFolder(); if (res) applyWorkspace(res); }
function applyWorkspace(res) {
  state.workspace = res.root;
  state.recents = res.recents || state.recents;
  id("ws-label").textContent = res.root;
  id("ws-chip").textContent = shortName(res.root) + " \u00B7 " + res.root;
  id("ws-chip").classList.remove("hidden");
  showHero(false);
  renderTree(res.tree || []);
  refreshGit();
  persistConfig();
}
function showHero(v) { id("hero").classList.toggle("hidden", !v); }
async function renderTree(nodes) {
  const box = id("tree"); box.innerHTML = "";
  if (!nodes || !nodes.length) { box.innerHTML = '<div class="empty">Thu muc rong.</div>'; return; }
  for (const n of nodes) box.appendChild(buildNode(n));
}
function buildNode(n) {
  const wrap = document.createElement("div"); wrap.className = "node";
  const row = document.createElement("div"); row.className = "row";
  row.dataset.path = n.path; if (!n.dir) row.dataset.file = "1";
  const caret = n.dir ? "\u25B8" : "";
  const ico = n.dir ? "" : fileIcon(n.name);
  row.innerHTML = '<span class="caret">' + caret + '</span><span class="ico">' + ico + "</span><span>" + escapeHtml(n.name) + "</span>";
  wrap.appendChild(row);
  let childBox = null;
  row.onclick = async () => {
    if (n.dir) {
      if (!childBox) {
        childBox = document.createElement("div"); childBox.className = "children"; wrap.appendChild(childBox);
        const kids = await api.listDir(n.path).catch(() => []);
        for (const k of kids) childBox.appendChild(buildNode(k));
        if (!kids.length) childBox.innerHTML = '<div class="empty" style="padding-left:8px">(rong)</div>';
        row.querySelector(".caret").textContent = "\u25BE";
      } else {
        const hidden = childBox.classList.toggle("hidden");
        row.querySelector(".caret").textContent = hidden ? "\u25B8" : "\u25BE";
      }
    } else openFile(n.path);
  };
  row.oncontextmenu = (ev) => { ev.preventDefault(); ev.stopPropagation(); showTreeMenu(ev, n); };
  return wrap;
}
function highlightTree() { $$(".node").forEach((el) => el.classList.toggle("active", (el.querySelector(".row") || {}).dataset && el.querySelector(".row").dataset.path === state.active)); }

// ---- Context menus (lightweight) -----------------------------------------
let menuEl = null;
function popupMenu(x, y, items) {
  closeMenu();
  menuEl = document.createElement("div"); menuEl.className = "mention-pop"; menuEl.style.cssText = "position:fixed;left:" + x + "px;top:" + y + "px;bottom:auto;right:auto;z-index:80;min-width:160px";
  for (const it of items) { const d = document.createElement("div"); d.className = "mi"; d.textContent = it.label; d.onclick = () => { closeMenu(); it.run(); }; menuEl.appendChild(d); }
  document.body.appendChild(menuEl);
  setTimeout(() => document.addEventListener("click", closeMenu, { once: true }), 0);
}
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function showTreeMenu(ev, n) {
  const items = [];
  items.push({ label: "Mo", run: () => (n.dir ? null : openFile(n.path)) });
  if (n.dir) {
    items.push({ label: "File moi trong nay", run: () => promptNew(n.path + "/", false) });
    items.push({ label: "Thu muc moi trong nay", run: () => promptNew(n.path + "/", true) });
  }
  items.push({ label: "Doi ten", run: () => promptRename(n.path) });
  items.push({ label: "Xoa", run: () => confirmDelete(n.path) });
  items.push({ label: "Reveal trong Explorer", run: () => api.reveal(n.path) });
  popupMenu(ev.clientX, ev.clientY, items);
}
function showTabMenu(ev, path) { popupMenu(ev.clientX, ev.clientY, [
  { label: "Dong", run: () => closeTab(path) },
  { label: "Reveal", run: () => api.reveal(path) },
  { label: "Preview", run: () => openPreview() }
]); }
async function promptRename(path) {
  const to = await promptDialog("Doi ten / di chuyen", path, "Duong dan moi (tuong doi):");
  if (!to || to === path) return;
  try { await api.rename(path, to); addSystem("Da doi " + path + " -> " + to); const res = await api.listDir(""); renderTree(res); }
  catch (e) { showError(e.message); }
}
async function promptNew(prefix, dir) {
  const name = await promptDialog(dir ? "Thu muc moi" : "File moi", prefix, "Ten:");
  if (!name) return;
  const rel = (prefix || "") + name;
  try { await api.createEntry(rel, dir); addSystem("Da tao " + rel); const res = await api.listDir(""); renderTree(res); if (!dir) openFile(rel); }
  catch (e) { showError(e.message); }
}
async function confirmDelete(path) {
  const ok = await confirmAction("Xoa " + path, "Hanh dong nay khong the hoan tac trong Studio.\n\nXac nhan xoa: " + path);
  if (!ok) return;
  try { await api.deleteFile(path); addSystem("Da xoa " + path); const res = await api.listDir(""); renderTree(res); closeTab(path); }
  catch (e) { showError(e.message); }
}

// ---- View switching (activity bar) ---------------------------------------
function setView(v) {
  state.view = v;
  $$(".view").forEach((s) => s.classList.toggle("hidden", s.dataset.view !== v));
  $$(".act").forEach((a) => a.classList.toggle("active", a.dataset.view === v));
  if (v === "git") refreshGit();
  if (v === "models") refreshModelsPanel();
}

// ---- Search ---------------------------------------------------------------
async function runSearch() {
  const q = id("search-input").value.trim();
  const box = id("search-results"); box.innerHTML = "";
  if (!q || !state.workspace) { box.innerHTML = '<div class="empty">Nhap tu khoa (can workspace).</div>'; return; }
  box.innerHTML = '<div class="empty">Dang tim...</div>';
  const files = await api.listFiles({ max: 1200 }).catch(() => []);
  const lc = q.toLowerCase();
  const hits = [];
  for (const f of files) {
    if (hits.length > 40) break;
    if (f.toLowerCase().includes(lc)) { hits.push({ path: f, match: f }); continue; }
    try {
      const { content } = await api.readFile(f);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lc)) { hits.push({ path: f, match: (i + 1) + ": " + lines[i].trim().slice(0, 120) }); break; }
      }
    } catch (e) {}
  }
  box.innerHTML = "";
  if (!hits.length) { box.innerHTML = '<div class="empty">Khong thay gi.</div>'; return; }
  for (const h of hits) {
    const d = document.createElement("div"); d.className = "sres";
    d.innerHTML = '<div class="p">' + escapeHtml(h.path) + "</div><div class='m'>" + escapeHtml(h.match) + "</div>";
    d.onclick = () => openFile(h.path);
    box.appendChild(d);
  }
}

// ---- Git ------------------------------------------------------------------
async function refreshGit() {
  const box = id("git-body");
  if (!state.workspace) { box.innerHTML = '<div class="empty">Mo thu muc co Git de bat dau.</div>'; id("sb-git").textContent = "Git: —"; return; }
  box.innerHTML = '<div class="empty">Dang kiem tra...</div>';
  const isRepo = await api.git(["rev-parse", "--is-inside-work-tree"]);
  if (!isRepo.ok) { box.innerHTML = '<div class="empty">Khong phai Git repo.</div>'; id("sb-git").textContent = "Git: khong phai repo"; return; }
  const branch = await api.git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const status = await api.git(["status", "--porcelain"]);
  const b = (branch.stdout || "").trim() || "(dau)";
  id("sb-git").textContent = "Git: " + b;
  const files = (status.stdout || "").split("\n").map((l) => l.replace(/^\s+/, "")).filter(Boolean);
  box.innerHTML = '<div class="git-branch">' + escapeHtml(b) + "</div>";
  if (!files.length) { box.insertAdjacentHTML("beforeend", '<div class="empty">Khong co thay doi.</div>'); }
  for (const line of files) {
    const st = line.slice(0, 2).trim() || "?";
    const path = line.slice(2).trim().replace(/^"|"$/g, "");
    const d = document.createElement("div"); d.className = "git-file";
    d.innerHTML = '<span class="st ' + escapeHtml(st[st.length - 1] || "?") + '">' + escapeHtml(st) + "</span><span>" + escapeHtml(path) + "</span>";
    d.onclick = () => viewGitDiff(path, st);
    box.appendChild(d);
  }
  const actions = document.createElement("div"); actions.className = "git-actions";
  actions.innerHTML = '<input id="git-msg" placeholder="commit message..." /><button class="btn sm" id="git-stage">Stage</button><button class="btn sm primary" id="git-commit">Commit</button>';
  box.appendChild(actions);
  id("git-stage").onclick = async () => { await api.git(["add", "-A"]); addSystem("git add -A xong"); refreshGit(); };
  id("git-commit").onclick = async () => {
    const msg = id("git-msg").value.trim(); if (!msg) return addSystem("Nhap commit message.");
    const r = await api.git(["commit", "-m", msg]);
    addSystem(r.ok ? (r.stdout || "").trim().split("\n").slice(-1)[0] : (r.stderr || "").trim());
    refreshGit();
  };
}
async function viewGitDiff(path, st) {
  let oldText = "";
  if ((st || "").includes("?") || (st || "").includes("A")) oldText = "";
  else { const r = await api.git(["show", "HEAD:" + path]); oldText = r.ok ? r.stdout : ""; }
  let newText = "";
  try { newText = (await api.readFile(path)).content; } catch (e) { newText = ""; }
  openDiff("Git: " + path, oldText, newText, false);
}

// ---- Models & Keys panel --------------------------------------------------
async function refreshModelsPanel() {
  const box = id("models-body"); box.innerHTML = '<div class="empty">Dang tai...</div>';
  let providers = [];
  try { const r = await fetch(state.baseUrl + "/api/providers"); providers = (await r.json()).providers || []; }
  catch (e) { box.innerHTML = '<div class="empty">Khong tai duoc providers.</div>'; return; }
  const byStatus = { ready: [], key: [], other: [] };
  for (const p of providers) {
    const grp = p.hasApiKey || !p.requiresAuth ? "ready" : p.requiresAuth && !p.hasApiKey ? "key" : "other";
    (byStatus[grp] || byStatus.other).push(p);
  }
  box.innerHTML = "";
  const section = (title, list) => {
    if (!list.length) return;
    const g = document.createElement("div"); g.className = "mgroup"; g.innerHTML = "<h4>" + title + "</h4>";
    for (const p of list) {
      const row = document.createElement("div"); row.className = "mrow";
      const badge = p.hasApiKey ? '<span class="badge">da co key</span>' : p.requiresAuth ? '<span class="badge key">can key</span>' : '<span class="badge free">khong key</span>';
      row.innerHTML = "<span>" + escapeHtml(p.name) + " <span class='muted' style='color:var(--muted);font-size:11px'>(" + (p.models ? p.models.length : 0) + " model)</span></span>";
      const right = document.createElement("span"); right.style.display = "flex"; right.style.gap = "6px"; right.alignItems = "center";
      right.innerHTML = badge;
      const btn = document.createElement("button"); btn.className = "btn sm"; btn.textContent = p.requiresAuth ? "Key" : "Ping";
      btn.onclick = () => (p.requiresAuth ? promptProviderKey(p) : pingProvider(p));
      right.appendChild(btn); row.appendChild(right); g.appendChild(row);
    }
    box.appendChild(g);
  };
  section("San sang", byStatus.ready);
  section("Can key", byStatus.key);
  section("Khac", byStatus.other);
}
async function promptProviderKey(p) {
  const key = await promptDialog("Them key cho " + p.name, "", "Paste API key (Groq/OpenRouter/Gemini/NVIDIA...):", true);
  if (!key) return;
  try {
    const r = await fetch(state.baseUrl + "/api/providers/" + encodeURIComponent(p.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userApiKey: key }) });
    const j = await r.json();
    if (r.ok && j.success) { addSystem("Da luu key cho " + p.name); await loadModels(); refreshModelsPanel(); }
    else showError("Loi luu key: " + JSON.stringify(j));
  } catch (e) { showError(e.message); }
}
async function pingProvider(p) {
  addSystem("Ping " + p.name + "...");
  try { const r = await fetch(state.baseUrl + "/api/providers/" + encodeURIComponent(p.id) + "/ping", { method: "POST" }); const j = await r.json(); addSystem("-> " + JSON.stringify(j).slice(0, 200)); }
  catch (e) { showError(e.message); }
}

// ---- Terminal -------------------------------------------------------------
function termWrite(s) { const o = id("term-out"); o.textContent += s; o.scrollTop = o.scrollHeight; }
async function runTerminal(line) {
  termWrite("$ " + line + "\n");
  const parts = line.trim().split(/\s+/);
  const r = await api.runCommand(parts[0], parts.slice(1), 60000);
  termWrite(((r.stdout || "") + (r.stderr || "") || "(het)") + "\n[exit " + (r.code == null ? "?" : r.code) + "]\n\n");
}

// ---- Chat rendering -------------------------------------------------------
function chatEl(cls) { const m = document.createElement("div"); m.className = "msg " + cls; id("chat").appendChild(m); scrollChat(); return m; }
function scrollChat() { const c = id("chat"); c.scrollTop = c.scrollHeight; }
function roleTag(m, label, cls) { const r = document.createElement("div"); r.className = "role"; const t = document.createElement("span"); t.className = "role-tag " + (cls || ""); t.textContent = label; r.appendChild(t); m.appendChild(r); }
function addBubble(cls, label, text) { const m = chatEl(cls); roleTag(m, label, cls); const b = document.createElement("div"); b.className = "bubble"; b.textContent = text; m.appendChild(b); return b; }
function addSystem(text) { const m = chatEl("system"); const b = document.createElement("div"); b.className = "bubble"; b.style.cssText = "color:var(--muted);font-size:12px;background:transparent;border-style:dashed"; b.textContent = text; m.appendChild(b); }
function renderMarkdownInto(el, text) { el.innerHTML = simpleMarkdown(text); }

// Task card: gom moi luot agent (reasoning + tool cards) vao 1 khoi
function startTask(title) {
  const wrap = document.createElement("div"); wrap.className = "task";
  const head = document.createElement("div"); head.className = "task-head";
  head.innerHTML = '<span class="chev">\u25BE</span><span class="role-tag" style="background:color-mix(in srgb,var(--accent) 26%,transparent)">agent</span><span>' + escapeHtml(title) + "</span>";
  const body = document.createElement("div"); body.className = "task-body";
  head.onclick = () => wrap.classList.toggle("collapsed");
  wrap.appendChild(head); wrap.appendChild(body);
  id("chat").appendChild(wrap); scrollChat();
  return body;
}
function addToolCard(parent, name, args, status) {
  const card = document.createElement("div"); card.className = "tool-card " + (status || "pending");
  card.innerHTML = '<div class="tool-head"><span class="tool-status">' + (status || "dang...") + '</span><span class="tool-name">' + escapeHtml(name) + "</span></div>" +
    '<pre class="args">' + escapeHtml(prettyArgs(args)) + "</pre>";
  parent.appendChild(card); scrollChat();
  return card;
}
function prettyArgs(a) { try { return typeof a === "string" ? JSON.stringify(JSON.parse(a), null, 2) : JSON.stringify(a, null, 2); } catch (e) { return String(a); } }

function showNotice(html) { id("notice").innerHTML = html; id("notice").classList.remove("hidden"); }
function hideNotice() { id("notice").classList.add("hidden"); }
function showError(msg) { const m = chatEl("assistant loi"); roleTag(m, "loi", "err"); const b = document.createElement("div"); b.className = "bubble"; b.textContent = msg; m.appendChild(b); }

// ---- Confirm modal (Promise<boolean>) + batch ----------------------------
let modalResolver = null;
function confirmAction(title, body, allowBatch) {
  if (isAutoAllow()) return Promise.resolve(true);
  id("modal-title").textContent = title; id("modal-body").textContent = body;
  id("modal-allow").textContent = allowBatch ? "Cho phep (va bo qua hoi luot nay)" : "Cho phep";
  id("modal").classList.remove("hidden");
  return new Promise((resolve) => { modalResolver = resolve; });
}
function isAutoAllow() { return id("auto-allow").checked || id("auto-allow-top").checked; }
function setAutoAllow(v) { id("auto-allow").checked = v; id("auto-allow-top").checked = v; }
id("modal-allow").onclick = () => { id("modal").classList.add("hidden"); if (modalResolver) modalResolver(true); modalResolver = null; };
id("modal-deny").onclick = () => { id("modal").classList.add("hidden"); if (modalResolver) modalResolver(false); modalResolver = null; };

// Prompt dialog (Promise<string|null>)
let dlgResolver = null;
function promptDialog(title, value, hint, secret) {
  id("promptdlg-title").textContent = title + (hint ? " \u2014 " + hint : "");
  const inp = id("promptdlg-input"); inp.value = value || ""; inp.type = secret ? "password" : "text";
  id("promptdlg").classList.remove("hidden"); setTimeout(() => inp.focus(), 30);
  return new Promise((resolve) => { dlgResolver = resolve; });
}
function dlgDone(v) { id("promptdlg").classList.add("hidden"); if (dlgResolver) dlgResolver(v); dlgResolver = null; }
id("promptdlg-ok").onclick = () => dlgDone(id("promptdlg-input").value);
id("promptdlg-cancel").onclick = () => dlgDone(null);
id("promptdlg-input").addEventListener("keydown", (e) => { if (e.key === "Enter") dlgDone(e.target.value); if (e.key === "Escape") dlgDone(null); });

// ---- Diff viewer (Promise<boolean>) --------------------------------------
let diffResolver = null;
function openDiff(title, oldText, newText, applyOnAccept) {
  id("diff-title").textContent = title;
  id("diff-body").innerHTML = renderDiff(oldText, newText);
  id("diff").classList.remove("hidden");
  return new Promise((resolve) => { diffResolver = resolve; diffApply = applyOnAccept; });
}
let diffApply = null;
id("diff-accept").onclick = () => { id("diff").classList.add("hidden"); if (diffResolver) diffResolver(true); diffResolver = null; };
id("diff-reject").onclick = () => { id("diff").classList.add("hidden"); if (diffResolver) diffResolver(false); diffResolver = null; };
function renderDiff(a, b) {
  const A = String(a || "").split("\n"); const B = String(b || "").split("\n");
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let e = 0; while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const midA = A.slice(s, A.length - e); const midB = B.slice(s, B.length - e);
  const ctx = (arr, i) => arr.slice(Math.max(0, i - 2), i).map((l) => '<span class="ctx">  ' + escapeHtml(l) + "</span>").join("");
  let out = ctx(A, s);
  for (const l of midA) out += '<span class="del">- ' + escapeHtml(l) + "</span>";
  for (const l of midB) out += '<span class="add">+ ' + escapeHtml(l) + "</span>";
  out += ctxB(B, B.length - e);
  if (!midA.length && !midB.length) out = '<span class="ctx">(khong co thay doi)</span>';
  return out;
}
function ctxB(arr, i) { return arr.slice(i, i + 2).map((l) => '<span class="ctx">  ' + escapeHtml(l) + "</span>").join(""); }

// ---- Tool execution -------------------------------------------------------
async function execTool(name, argObj, taskBody) {
  if (name === "read_file") {
    const r = await api.readFile(argObj.path);
    return { ok: true, text: r.content };
  }
  if (name === "list_dir") {
    const kids = await api.listDir(argObj.path || "");
    const text = kids.map((k) => (k.dir ? "[dir] " : "      ") + k.path).join("\n") || "(trong)";
    return { ok: true, text };
  }
  if (name === "write_file") {
    const path = argObj.path;
    let oldText = "";
    try { oldText = (await api.readFile(path)).content; } catch (e) { oldText = ""; }
    const newText = argObj.content || "";
    if (oldText === newText) return { ok: true, text: "File khong thay doi." };
    const ok = await showDiffAndConfirm(taskBody, path, oldText, newText);
    if (!ok) return { ok: false, text: "Ngu dung tu choi ghi file." };
    await snapshotTouched(path);
    const r = await api.writeFile(path, newText);
    if (state.tabs.some((t) => t.path === path)) { const t = state.tabs.find((x) => x.path === path); t.content = newText; t.dirty = false; if (state.active === path) setEditorContent(newText); renderTabs(); }
    try { renderTree(await api.listDir("")); } catch (e) {}
    return { ok: true, text: "Da ghi " + r.bytes + " byte vao " + r.path };
  }
  if (name === "run_command") {
    const cmdStr = argObj.command + " " + (argObj.args || []).join(" ");
    const ok = await confirmAction("Agent muon CHAY LENH", "cwd: workspace\nlenh: " + cmdStr, true);
    if (!ok) return { ok: false, text: "Ngu dung tu choi chay lenh." };
    const r = await api.runCommand(argObj.command, argObj.args || [], 60000);
    const out = [r.stdout, r.stderr].filter(Boolean).join("\n");
    return { ok: r.ok, text: (r.ok ? "exit 0\n" : "exit " + r.code + "\n") + (out || "(khong co xuat)") };
  }
  return { ok: false, text: "Tool khong xac dinh: " + name };
}
async function showDiffAndConfirm(taskBody, path, oldText, newText) {
  if (isAutoAllow()) return true;
  return await openDiff("Agent de xuat ghi: " + path, oldText, newText, true);
}
async function snapshotTouched(path) {
  if (!state.turnTouched) return;
  if (state.turnTouched.has(path)) return;
  state.turnTouched.add(path);
  try { await api.snapshot("t" + state.turnId + "-" + path, [path]); } catch (e) {}
}

function preview(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "\n...(cat ngan)" : s; }
function parseArgs(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }

// ---- @mention -------------------------------------------------------------
function expandMentions(text) {
  const re = /@([\w./-]+)/g;
  const found = []; let m;
  while ((m = re.exec(text))) found.push(m[1]);
  return found;
}
async function buildContextFromMentions(text) {
  const rels = Array.from(new Set(expandMentions(text)));
  const parts = [];
  for (const rel of rels) {
    try { const { content } = await api.readFile(rel); parts.push("### @file: " + rel + "\n```\n" + content.slice(0, 8000) + "\n```"); }
    catch (e) { /* co the la folder */ try { const kids = await api.listDir(rel); parts.push("### @dir: " + rel + "\n" + kids.map((k) => k.path).join("\n")); } catch (x) {} }
  }
  return parts.join("\n\n");
}
let mentionOpen = false;
function updateMentionPopup() {
  const ta = id("prompt"); const val = ta.value; const caret = ta.selectionStart;
  const before = val.slice(0, caret); const mm = before.match(/@([\w./-]*)$/);
  const pop = id("mention-pop");
  if (!mm || !state.workspace) { pop.classList.add("hidden"); mentionOpen = false; return; }
  const q = mm[1].toLowerCase();
  api.listFiles({ max: 1500 }).then((files) => {
    const hits = files.filter((f) => f.toLowerCase().includes(q)).slice(0, 30);
    if (!hits.length) { pop.classList.add("hidden"); mentionOpen = false; return; }
    pop.innerHTML = ""; mentionOpen = true; pop.classList.remove("hidden");
    hits.forEach((f) => { const d = document.createElement("div"); d.className = "mi"; d.textContent = f; d.onmousedown = (e) => { e.preventDefault(); insertMention(f); }; pop.appendChild(d); });
  });
}
function insertMention(path) {
  const ta = id("prompt"); const caret = ta.selectionStart; const before = ta.value.slice(0, caret).replace(/@([\w./-]*)$/, "@" + path + " ");
  ta.value = before + ta.value.slice(caret); ta.selectionStart = ta.selectionEnd = before.length; ta.focus();
  id("mention-pop").classList.add("hidden"); mentionOpen = false;
}

// ---- Streaming (chat only, khong tools) ----------------------------------
async function streamAnswer(body, bubble) {
  const resp = await fetch(state.baseUrl + "/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({}, body, { stream: true })) });
  if (!resp.ok) { const data = await resp.json().catch(() => null); throw httpError(resp, data); }
  const reader = resp.body.getReader(); const dec = new TextDecoder(); let buf = ""; let full = "";
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const p = line.slice(5).trim(); if (p === "[DONE]") continue;
      let j; try { j = JSON.parse(p); } catch (e) { continue; }
      const ch = j.choices && j.choices[0]; if (!ch) continue;
      const d = ch.delta || {}; if (typeof d.content === "string" && d.content) { full += d.content; bubble.textContent = full; scrollChat(); }
    }
  }
  return full;
}
function httpError(resp, data) {
  const e = new Error("HTTP " + resp.status + ": " + ((data && data.error && (data.error.message || JSON.stringify(data.error))) || "loi khong ro"));
  e.status = resp.status; e.code = data && data.error && (data.error.code || data.error.type); e.data = data; return e;
}

// ---- Agent loop -----------------------------------------------------------
async function runAgent(userText) {
  if (state.running) return;
  state.running = true; state.abort = false;
  state.turnId = "t" + Date.now();
  state.turnTouched = new Set();
  id("btn-stop").classList.remove("hidden");
  hideNotice();

  const ctx = await buildContextFromMentions(userText);
  const historyMsg = ctx ? userText + "\n\n[ngu canh dinh kem]\n" + ctx : userText;
  state.history.push({ role: "user", content: historyMsg });
  addBubble("user", "ban", userText);
  id("prompt").value = "";

  const useTools = id("tools-enabled").checked && !state.planMode;
  const model = id("model-select").value;
  const MAX = 12;
  const sys = state.planMode ? PLAN_PROMPT : SYSTEM_PROMPT;
  const taskBody = startTask(state.planMode ? "Ke hoach" : "Nhiem vu");

  try {
    for (let iter = 0; iter < MAX; iter++) {
      if (state.abort) { setLoop("da dung"); break; }
      setLoop("dang goi model... (vong " + (iter + 1) + ")");
      const messages = [{ role: "system", content: sys }].concat(state.history);

      // Chat thuan (khong tool): stream tra loi
      if (!useTools) {
        const bubble = addBubble("assistant", "wenker", "");
        setLoop("");
        const full = await streamAnswer({ model, messages }, bubble);
        state.history.push({ role: "assistant", content: full });
        break;
      }

      const resp = await fetch(state.baseUrl + "/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, tools: TOOLS })
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const code = data && data.error && (data.error.code || data.error.type);
        if (code === "tools_not_supported" || resp.status === 400) {
          showNotice("Model <b>" + escapeHtml(model) + "</b> khong ho tro tool. Tat <b>Tools</b> hoac chon model co badge tool (Groq/OpenRouter/Gemini da co key). <span style='color:var(--muted)'>" + escapeHtml((data && data.error && (data.error.message || data.error.hint)) || "") + "</span>");
          setLoop(""); state.running = false; break;
        }
        throw httpError(resp, data);
      }
      const choice = data && data.choices && data.choices[0];
      if (!choice) throw new Error("Model khong tra ve choices.");
      const msg = choice.message || {};
      state.history.push(msg);
      if (msg.content) { const b = addBubbleIn(taskBody, "assistant", "wenker", msg.content); }
      setLoop("");

      if (choice.finish_reason === "tool_calls" && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        for (const tc of msg.tool_calls) {
          if (state.abort) break;
          const fname = tc.function && tc.function.name;
          const fargs = parseArgs(tc.function && tc.function.arguments);
          state.toolCalls++; id("sb-tools").textContent = "tools: " + state.toolCalls;
          const card = addToolCard(taskBody, fname, tc.function && tc.function.arguments, "pending");
          setLoop("dang chay " + fname + "...");
          let result;
          try { result = await execTool(fname, fargs, taskBody); }
          catch (e) { result = { ok: false, text: "Loi thuc thi: " + e.message }; }
          card.className = "tool-card " + (result.ok ? "ok" : "err");
          card.querySelector(".tool-status").textContent = result.ok ? "xong" : "loi";
          const pre = document.createElement("pre"); pre.className = "out" + (result.ok ? "" : " err"); pre.textContent = preview(result.text, 4000); card.appendChild(pre);
          if (fname === "write_file" && result.ok) addUndoButton(card, tc.id);
          state.history.push({ role: "tool", tool_call_id: tc.id, content: typeof result.text === "string" ? result.text : JSON.stringify(result.text) });
          scrollChat();
        }
        setLoop("");
        continue;
      }
      break;
    }
    // Nut tien hanh sau khi lap ke hoach
    if (state.planMode) {
      const go = document.createElement("button"); go.className = "btn sm primary"; go.textContent = "Tien hanh ke hoach";
      go.onclick = () => { state.planMode = false; id("btn-plan").classList.remove("on"); runAgent("Hay thuc hien theo dung ke hoach ban vua lap."); };
      taskBody.appendChild(go);
    }
  } catch (e) {
    showError(String(e && e.message ? e.message : e));
  } finally {
    state.running = false; state.turnTouched = null;
    id("btn-stop").classList.add("hidden"); setLoop("");
  }
}
function addBubbleIn(parent, cls, label, text) { const m = document.createElement("div"); m.className = "msg " + cls; roleTag(m, label, cls); const b = document.createElement("div"); b.className = "bubble"; b.textContent = text; m.appendChild(b); parent.appendChild(m); scrollChat(); return b; }
function addUndoButton(card, callId) {
  const btn = document.createElement("button"); btn.className = "undo"; btn.textContent = "Hoan tac file nay";
  btn.onclick = async () => {
    for (const path of Array.from(state.turnTouched || [])) {
      try { const r = await api.restore("t" + state.turnId + "-" + path); addSystem("Da hoan tac " + path + " (hoi " + r.restored + ", xoa " + r.deleted + ")"); if (state.active === path) { const { content } = await api.readFile(path); const t = state.tabs.find((x) => x.path === path); if (t) { t.content = content; t.dirty = false; } if (state.active === path) setEditorContent(content); } } catch (e) {}
    }
    btn.disabled = true; btn.textContent = "Da hoan tac";
  };
  card.appendChild(btn);
}
function setLoop(s) { id("loop-status").textContent = s; }

// ---- Command palette + Quick open ----------------------------------------
const PALETTE = [
  { kind: "lenh", label: "Mo thu muc workspace", run: onPickFolder },
  { kind: "lenh", label: "Lam moi danh sach model", run: () => loadModels().then(() => addSystem("Da tai lai model.")) },
  { kind: "lenh", label: "Xoa noi dung chat", run: () => { state.history = []; id("chat").innerHTML = ""; } },
  { kind: "lenh", label: "Bat/tat Auto-allow", run: () => setAutoAllow(!isAutoAllow()) },
  { kind: "lenh", label: "Bat/tat che do Plan", run: () => togglePlan() },
  { kind: "lenh", label: "Mo Dashboard (ben ngoai)", run: () => api.openExternal(state.baseUrl + "/") },
  { kind: "lenh", label: "Luu file dang mo (Ctrl+S)", run: saveActive },
  { kind: "lenh", label: "Preview Markdown/HTML", run: openPreview },
  { kind: "lenh", label: "Doi theme toi/sang", run: () => { document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark"; if (state.monaco) window.monaco.editor.setTheme(document.body.dataset.theme === "dark" ? "vs-dark" : "vs"); persistConfig(); } },
  { kind: "lenh", label: "Lam moi Git", run: refreshGit },
  { kind: "lenh", label: "Mo Terminal", run: () => setView("terminal") }
];
function renderPaletteCommands() { /* chi dung luc mo */ }
let paletteMode = "cmd";
function openPalette(mode) {
  paletteMode = mode || "cmd";
  id("palette").classList.remove("hidden");
  const inp = id("palette-input");
  inp.value = ""; inp.placeholder = paletteMode === "file" ? "Mo file..." : "Nha lenh...";
  setTimeout(() => inp.focus(), 20);
  paletteQuery("");
}
function closePalette() { id("palette").classList.add("hidden"); }
let paletteItems = []; let paletteSel = 0;
async function paletteQuery(q) {
  const list = id("palette-list"); list.innerHTML = ""; paletteSel = 0;
  if (paletteMode === "cmd") {
    paletteItems = PALETTE.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
  } else {
    const files = await api.listFiles({ max: 2500 }).catch(() => []);
    const lq = q.toLowerCase();
    paletteItems = files.filter((f) => f.toLowerCase().includes(lq)).slice(0, 60).map((f) => ({ kind: "file", label: f, run: () => openFile(f) }));
  }
  paletteItems.forEach((c, i) => { const d = document.createElement("div"); d.className = "pi" + (i === 0 ? " sel" : ""); d.innerHTML = '<span class="kind">' + c.kind + "</span><span>" + escapeHtml(c.label) + "</span>"; d.onclick = () => { closePalette(); c.run(); }; list.appendChild(d); });
}
function paletteMove(dir) {
  if (!paletteItems.length) return;
  const items = $$("#palette-list .pi");
  items[paletteSel] && items[paletteSel].classList.remove("sel");
  paletteSel = (paletteSel + dir + paletteItems.length) % paletteItems.length;
  items[paletteSel] && items[paletteSel].classList.add("sel");
  items[paletteSel] && items[paletteSel].scrollIntoView({ block: "nearest" });
}
function paletteEnter() { const c = paletteItems[paletteSel]; closePalette(); if (c) c.run(); }

// ---- Resizers -------------------------------------------------------------
function wireResizers() {
  drag(id("resizer-left"), (dx) => { const s = id("sidebar"); const w = Math.max(160, Math.min(520, (parseInt(s.style.width || "260", 10)) + dx)); s.style.width = w + "px"; relayout(); });
  drag(id("resizer-chat"), (dx) => { const c = id("chat-pane"); const w = Math.max(280, Math.min(760, (parseInt(c.style.width || "420", 10)) - dx)); c.style.width = w + "px"; relayout(); });
}
function relayout() {
  const sb = id("sidebar").style.width || "260px";
  const ch = id("chat-pane").style.width || "420px";
  document.querySelector(".app").style.gridTemplateColumns = "auto " + sb + " 6px 1fr 6px " + ch;
}
function drag(handle, onMove) {
  if (!handle) return;
  handle.addEventListener("mousedown", (e) => {
    e.preventDefault(); handle.classList.add("drag");
    let last = e.clientX;
    const mv = (ev) => { onMove(ev.clientX - last); last = ev.clientX; };
    const up = () => { handle.classList.remove("drag"); document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); persistConfig(); };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
  });
}

// ---- Plan mode ------------------------------------------------------------
function togglePlan() {
  state.planMode = !state.planMode;
  id("btn-plan").classList.toggle("on", state.planMode);
  showNotice(state.planMode ? "<b>Plan mode:</b> agent se chi lap ke hoach, khong cham file. Nhan lai de tat." : "");
  if (!state.planMode) hideNotice();
}

// ---- Wiring ---------------------------------------------------------------
function wire() {
  id("btn-folder").onclick = onPickFolder;
  id("hero-open").onclick = onPickFolder;
  id("hero-new").onclick = async () => { const p = await promptDialog("Thu muc project moi", "", "Ten thu muc (se tao trong thu muc hien tai hoac Home):"); if (!p) return; const base = state.workspace || (await api.status()).workspace || ""; try { await api.createEntry(p, true); const res = await api.openFolder((base ? base + "/" : "") + p); if (res) applyWorkspace(res); } catch (e) { showError(e.message); } };
  id("hero-recent").onclick = () => { const box = id("hero-recent-list"); box.classList.toggle("hidden"); box.innerHTML = ""; (state.recents || []).forEach((r) => { const b = document.createElement("button"); b.textContent = r; b.onclick = async () => { const res = await api.openFolder(r); if (res) applyWorkspace(res); }; box.appendChild(b); }); if (!(state.recents || []).length) box.innerHTML = '<div class="empty" style="color:var(--muted);text-align:center">Chua co lich su.</div>'; };
  id("btn-manage").onclick = (e) => { e.preventDefault(); api.openExternal(state.baseUrl + "/"); };
  id("btn-cmd").onclick = () => openPalette("cmd");
  id("btn-new-file").onclick = () => promptNew("", false);
  id("btn-new-folder").onclick = () => promptNew("", true);
  id("btn-refresh").onclick = async () => { if (state.workspace) renderTree(await api.listDir("")); };
  id("btn-search").onclick = runSearch;
  id("search-input").addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  id("btn-git-refresh").onclick = refreshGit;
  id("btn-preview-close").onclick = closePreview;
  id("btn-clear").onclick = () => { state.history = []; id("chat").innerHTML = ""; };
  id("btn-plan").onclick = togglePlan;
  $$(".act").forEach((a) => (a.onclick = () => setView(a.dataset.view)));

  id("btn-send").onclick = () => { const t = id("prompt").value.trim(); if (t) runAgent(t); };
  id("btn-stop").onclick = () => { state.abort = true; };
  id("prompt").addEventListener("keydown", (e) => {
    if (mentionOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape")) {
      const items = $$("#mention-pop .mi");
      if (e.key === "Escape") { id("mention-pop").classList.add("hidden"); mentionOpen = false; return; }
      let sel = items.findIndex((x) => x.classList.contains("sel"));
      if (e.key === "Enter") { if (sel >= 0) { e.preventDefault(); items[sel].dispatchEvent(new MouseEvent("mousedown")); } return; }
      e.preventDefault(); if (sel < 0) sel = 0; items[sel] && items[sel].classList.remove("sel");
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items[sel] && items[sel].classList.add("sel"); return;
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t = e.target.value.trim(); if (t) runAgent(t); }
  });
  id("prompt").addEventListener("input", updateMentionPopup);
  id("prompt").addEventListener("keyup", (e) => { if ([38, 40, 13, 27].includes(e.keyCode)) return; updateMentionPopup(); });

  // model select + mirror toggles
  id("model-select").addEventListener("change", () => {
    updateStatusModel();
    const m = currentModelMeta();
    if (m && (m.wenker_needs_key || m.wenker_status === "needs_key")) showNotice("Model <b>" + escapeHtml(m.id) + "</b> can API key. Mo panel <b>Model &amp; Key</b> hoac <b>Dashboard</b> de them key mien phi.");
    else if (m && !m.wenker_supports_tools) showNotice("Model <b>" + escapeHtml(m.id) + "</b> khong ho tro tool (nguon mien phi khong key). Tat <b>Tools</b> hoac chon model co badge tool.");
    else hideNotice();
    persistConfig();
  });
  const syncTools = (from) => { const v = id(from).checked; id(from === "tools-enabled" ? "tools-enabled-top" : "tools-enabled").checked = v; };
  id("tools-enabled").addEventListener("change", () => syncTools("tools-enabled"));
  id("tools-enabled-top").addEventListener("change", () => syncTools("tools-enabled-top"));
  const syncAuto = (from) => { const v = id(from).checked; id(from === "auto-allow" ? "auto-allow-top" : "auto-allow").checked = v; };
  id("auto-allow").addEventListener("change", () => syncAuto("auto-allow"));
  id("auto-allow-top").addEventListener("change", () => syncAuto("auto-allow-top"));

  // settings live preview
  ["set-theme", "set-accent", "set-layout"].forEach((s) => id(s).addEventListener("change", () => { applyConfigToUI(); if (state.monaco && s === "set-theme") window.monaco.editor.setTheme(id("set-theme").value === "dark" ? "vs-dark" : "vs"); persistConfig(); }));
  id("set-fontsize").addEventListener("input", () => { document.documentElement.style.setProperty("--fs", id("set-fontsize").value + "px"); if (state.monaco) state.monaco.updateOptions({ fontSize: Number(id("set-fontsize").value) }); });
  id("set-minimap").addEventListener("change", () => { if (state.monaco) state.monaco.updateOptions({ minimap: { enabled: id("set-minimap").checked } }); });
  id("btn-save-settings").onclick = () => { persistConfig(); addSystem("Da luu cai dat."); saveWorkspaceConfig(); };

  // palette keys
  id("palette-input").addEventListener("input", (e) => paletteQuery(e.target.value));
  id("palette-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); paletteMove(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); paletteMove(-1); }
    else if (e.key === "Enter") { e.preventDefault(); paletteEnter(); }
    else if (e.key === "Escape") closePalette();
  });
  id("palette").addEventListener("mousedown", (e) => { if (e.target === id("palette")) closePalette(); });

  // terminal
  id("term-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = e.target.value; e.target.value = ""; if (v.trim()) runTerminal(v); } });

  // global shortcuts
  document.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === "p") { e.preventDefault(); openPalette("cmd"); }
    else if (mod && e.key.toLowerCase() === "p" && !e.shiftKey) { e.preventDefault(); openPalette("file"); }
    else if (mod && e.key === "`") { e.preventDefault(); setView("terminal"); id("term-input").focus(); }
    else if (mod && e.key.toLowerCase() === "w") { e.preventDefault(); if (state.active) closeTab(state.active); }
    else if (mod && e.shiftKey && e.key.toLowerCase() === "e") { e.preventDefault(); setView("explorer"); }
    else if (e.key === "Escape") { closePalette(); closeMenu(); id("modal").classList.add("hidden"); id("diff").classList.add("hidden"); id("promptdlg").classList.add("hidden"); }
  });
}

// Luu config vao .wenker/config.json cua workspace (neu mo)
async function saveWorkspaceConfig() {
  if (!state.workspace) return;
  try { await api.writeFile(".wenker/config.json", JSON.stringify({ systemPromptShort: id("set-agentsystem").checked, autoAllow: isAutoAllow(), model: id("model-select").value }, null, 2)); } catch (e) {}
}

function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// ---- Start ----------------------------------------------------------------
wire();
boot();
