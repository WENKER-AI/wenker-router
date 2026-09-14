/**
 * WENKER Studio - renderer (tinh khong build).
 *
 * Goi thang model qua router (/v1/chat/completions) kem `tools`, va chay vong lap
 * agent that: model tra tool_calls -> renderer thuc thi qua IPC (doc/ghi file,
 * liet ke, chay lenh) -> day ket qua tro lai -> lap lai den khi model tra loi het.
 *
 * Moi lan ghi file / chay lenh phai duoc ngu dung xac nhan (tru khi Auto-allow).
 */
"use strict";

// Cot moc: neu dong nay chay, app.js da duoc trinh duyet thuc thi.
window.__studioLoaded = true;
window.addEventListener("error", function (e) {
  try {
    var d = document.getElementById("boot-detail");
    if (d) d.textContent = "JS-ERROR: " + (e.message || "") + " @" + (e.filename || "") + ":" + (e.lineno || "");
  } catch (x) {}
});

const api = window.wenkerIde || {};
const els = {};
const $ = (id) => (els[id] = document.getElementById(id));
[
  "boot", "boot-msg", "boot-detail", "app", "btn-folder", "ws-label", "model-select",
  "tools-enabled", "auto-allow", "btn-manage", "notice", "tree", "tabs", "editor",
  "fallback-editor", "chat", "prompt", "btn-send", "btn-stop", "loop-status",
  "modal", "modal-title", "modal-body", "modal-allow", "modal-deny"
].forEach($);

const state = {
  baseUrl: "",
  port: 0,
  workspace: null,
  models: [],
  tabs: [],            // { path, model: monaco.textmodel | {value}, dirty }
  active: null,        // path
  monaco: null,        // editor instance
  editorKind: null,    // 'monaco' | 'textarea'
  history: [],         // messages cua vong agent hien tai (khong gom system)
  running: false,
  abort: false
};

const SYSTEM_PROMPT =
  "Ban la agent lap trinh trong WENKER Studio, lam viec truc tiep trong thu muc workspace " +
  "mua tren may cua ngu dung. Hay dung cac tool (read_file, write_file, list_dir, run_command) " +
  "de hoan thanh nhiem vu thay vi chi mo ta. Duong dan file luong tuong doi so voi goc workspace. " +
  "Khi tao/ghi file hay chay lenh, hay noi ngan gon ban dang lam gi. Tra loi bang tieng Viet.";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Doc noi dung mot file text trong workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "duong dan tuong doi, vi du src/App.jsx" } },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Tao hoac ghi de mot file trong workspace (tu dong tao thu muc cha).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "duong dan tuong doi" },
          content: { type: "string", description: "toan bo noi dung file" }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "Liet ke cac file/con trong mot thu muc cua workspace.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "duong dan thu muc, de trong = goc workspace" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Chay mot lenh shell trong thu muc workspace va tra ve stdout/stderr.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "ten lenh, vi du node, git, npm" },
          args: { type: "array", items: { type: "string" }, description: "mang tham so" }
        },
        required: ["command"]
      }
    }
  }
];

// ---- Boot -----------------------------------------------------------------
async function boot() {
  try {
    if (!api || typeof api.status !== "function") throw new Error("window.wenkerIde khong ton tai (preload chua nap).");
    const st = await api.status();
    state.baseUrl = st.baseUrl;
    state.port = st.port;
    state.workspace = st.workspace;
    bootMsg("Router song tai " + st.baseUrl);
    await loadModels();
    bootMsg("San sang.");
    setTimeout(async () => {
      els.boot.classList.add("hidden");
      els.app.classList.remove("hidden");
      initEditor();
      if (state.workspace) {
        applyWorkspace({ root: state.workspace, tree: [] });
        try { renderTree(await api.listDir("")); } catch (e) { /* workspace co the bi xoa */ }
      }
    }, 250);
  } catch (e) {
    els["boot-detail"].textContent = "Loi khoi dong: " + String(e && e.message ? e.message : e);
  }
}
function bootMsg(m) { els["boot-msg"].textContent = m; }

// ---- Models ---------------------------------------------------------------
async function loadModels() {
  const r = await fetch(state.baseUrl + "/v1/models");
  const j = await r.json();
  state.models = j.data || [];
  renderModelSelect();
}

function renderModelSelect() {
  const sel = els["model-select"];
  sel.innerHTML = "";
  // U tien: model da san sang (status alive) va khong thieu key, roi den con lai.
  const rank = (m) => (m.wenker_status === "alive" && !m.wenker_needs_key ? 0 : m.wenker_status === "alive" ? 1 : m.wenker_status === "needs_key" ? 2 : 3);
  const uniq = dedupeById(state.models).slice().sort((a, b) => rank(a) - rank(b) || String(a.id).localeCompare(String(b.id)));
  for (const m of uniq) {
    const o = document.createElement("option");
    const badges = [];
    if (m.wenker_status === "needs_key" || m.wenker_needs_key) badges.push("can key");
    if (m.wenker_status === "down") badges.push("xuong");
    if (m.wenker_free) badges.push("free");
    o.value = m.id;
    o.textContent = m.id + (m.wenker_display_name && m.wenker_display_name !== m.id ? "  (" + m.wenker_display_name + ")" : "") + (badges.length ? "  [" + badges.join(", ") + "]" : "");
    sel.appendChild(o);
  }
  const firstGood = uniq.find((m) => rank(m) === 0);
  if (firstGood) sel.value = firstGood.id;
}

function dedupeById(list) {
  const seen = new Set();
  const out = [];
  for (const m of list) {
    if (m.id.includes("/")) continue; // bo id dub provider/model, giu id nguyen
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

function currentModelMeta() {
  return state.models.find((m) => m.id === els["model-select"].value) || null;
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
      if (done) return; done = true; clearTimeout(timeout);
      setupMonaco();
    }, function () { if (!done) { done = true; clearTimeout(timeout); useTextarea(); } });
  } catch (e) {
    useTextarea();
  }
}

function setupMonaco() {
  state.editorKind = "monaco";
  state.monaco = window.monaco.editor.create(els.editor, {
    value: "",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false
  });
  state.monaco.onDidChangeModelContent(() => {
    const t = state.tabs.find((x) => x.path === state.active);
    if (t) { t.dirty = true; renderTabs(); }
  });
}

function useTextarea() {
  state.editorKind = "textarea";
  els["fallback-editor"].classList.remove("hidden");
  els["fallback-editor"].addEventListener("input", () => {
    const t = state.tabs.find((x) => x.path === state.active);
    if (t) { t.value = els["fallback-editor"].value; t.dirty = true; renderTabs(); }
  });
}

function langForPath(p) {
  const ext = (p.split(".").pop() || "").toLowerCase();
  return ({ js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", tsx: "typescript",
    json: "json", css: "css", scss: "scss", html: "html", md: "markdown", py: "python",
    c: "c", h: "c", cpp: "cpp", hpp: "cpp", cs: "csharp", go: "go", rs: "rust", java: "java",
    yml: "yaml", yaml: "yaml", sh: "shell", bash: "shell", bat: "bat", xml: "xml", sql: "sql" })[ext] || "plaintext";
}

function setEditorContent(text) {
  if (state.editorKind === "monaco" && state.monaco) {
    const model = state.monaco.getModel();
    window.monaco.editor.setModelLanguage(model, langForPath(state.active || ""));
    model.setValue(text);
  } else {
    els["fallback-editor"].value = text;
  }
}
function getEditorContent() {
  if (state.editorKind === "monaco" && state.monaco) return state.monaco.getValue();
  return els["fallback-editor"].value;
}

// ---- Tabs / open file -----------------------------------------------------
async function openFile(rel) {
  if (state.tabs.some((t) => t.path === rel)) { activateTab(rel); return; }
  let content = "";
  try { const r = await api.readFile(rel); content = r.content; }
  catch (e) { return showError("Doc file that bai: " + e.message); }
  state.tabs.push({ path: rel, dirty: false });
  activateTab(rel, content);
}

function activateTab(rel, maybeContent) {
  state.active = rel;
  const t = state.tabs.find((x) => x.path === rel);
  if (t && t.content !== undefined) setEditorContent(t.content);
  else if (maybeContent !== undefined) { if (t) t.content = maybeContent; setEditorContent(maybeContent); }
  else api.readFile(rel).then((r) => { if (t) t.content = r.content; if (state.active === rel) setEditorContent(r.content); }).catch(() => {});
  renderTabs();
  highlightTree();
}

function renderTabs() {
  const box = els.tabs;
  box.innerHTML = "";
  for (const t of state.tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.path === state.active ? " active" : "");
    el.innerHTML = '<span>' + escapeHtml(shortName(t.path)) + '</span>' +
      (t.dirty ? '<span class="dot">' + "\u25CF" + '</span>' : "") +
      '<span class="x">' + "\u2715" + "</span>";
    el.querySelector(".x").onclick = (ev) => { ev.stopPropagation(); closeTab(t.path); };
    el.onclick = () => activateTab(t.path);
    box.appendChild(el);
  }
}
function shortName(p) { return p.split("/").pop(); }

function closeTab(rel) {
  state.tabs = state.tabs.filter((t) => t.path !== rel);
  if (state.active === rel) {
    const next = state.tabs[state.tabs.length - 1];
    if (next) activateTab(next.path);
    else { state.active = null; setEditorContent(""); renderTabs(); }
  }
  renderTabs();
}

// ---- Workspace / tree -----------------------------------------------------
async function onPickFolder() {
  const res = await api.pickFolder();
  if (!res) return;
  applyWorkspace(res);
}
function applyWorkspace(res) {
  state.workspace = res.root;
  els["ws-label"].textContent = res.root;
  renderTree(res.tree || []);
}

function renderTree(nodes) {
  const box = els.tree;
  box.innerHTML = "";
  if (!nodes || !nodes.length) { box.innerHTML = '<div class="empty">Thu muc rong.</div>'; return; }
  for (const n of nodes) box.appendChild(buildNode(n));
}

function buildNode(n) {
  const wrap = document.createElement("div");
  const row = document.createElement("div");
  row.className = "node";
  row.dataset.path = n.path;
  if (!n.dir) row.dataset.file = "1";
  const caret = n.dir ? "\u25B8" : "";
  const ico = n.dir ? "\uD83D\uDCC1" : "\uD83D\uDCC4";
  row.innerHTML = '<span class="caret">' + caret + '</span><span class="ico">' + ico + "</span><span>" + escapeHtml(n.name) + "</span>";
  wrap.appendChild(row);
  let childBox = null;
  row.onclick = async () => {
    if (n.dir) {
      if (!childBox) {
        childBox = document.createElement("div");
        childBox.className = "children";
        wrap.appendChild(childBox);
        const kids = await api.listDir(n.path).catch(() => []);
        for (const k of kids) childBox.appendChild(buildNode(k));
        if (!kids.length) childBox.innerHTML = '<div class="empty" style="padding-left:8px">(rong)</div>';
        row.querySelector(".caret").textContent = "\u25BE";
      } else {
        const hidden = childBox.classList.toggle("hidden");
        row.querySelector(".caret").textContent = hidden ? "\u25B8" : "\u25BE";
      }
    } else {
      openFile(n.path);
    }
  };
  return wrap;
}

function highlightTree() {
  document.querySelectorAll(".node").forEach((el) => el.classList.toggle("active", el.dataset.path === state.active));
}

// ---- Chat rendering -------------------------------------------------------
function chatEl(cls, roleLabel) {
  const m = document.createElement("div");
  m.className = "msg " + cls;
  if (roleLabel) { const r = document.createElement("div"); r.className = "role"; r.textContent = roleLabel; m.appendChild(r); }
  els.chat.appendChild(m);
  els.chat.scrollTop = els.chat.scrollHeight;
  return m;
}
function addBubble(cls, roleLabel, text) {
  const m = chatEl(cls, roleLabel);
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  m.appendChild(b);
  return b;
}
function addToolCard(name, args, status) {
  const m = chatEl("assistant", null);
  const card = document.createElement("div");
  card.className = "tool-card " + (status || "pending");
  card.innerHTML = '<span class="tool-status">' + (status || "dang...") + '</span>' +
    '<span class="tool-name">' + escapeHtml(name) + "</span><pre>" + escapeHtml(prettyArgs(args)) + "</pre>";
  m.appendChild(card);
  els.chat.scrollTop = els.chat.scrollHeight;
  return card;
}
function prettyArgs(args) {
  try { return typeof args === "string" ? JSON.stringify(JSON.parse(args), null, 2) : JSON.stringify(args, null, 2); }
  catch (e) { return String(args); }
}

function showNotice(html) { els.notice.innerHTML = html; els.notice.classList.remove("hidden"); }
function hideNotice() { els.notice.classList.add("hidden"); }
function showError(msg) { addBubble("assistant", "loi", msg); }

// ---- Confirm modal (Promise<boolean>) ------------------------------------
let modalResolver = null;
function confirmAction(title, body) {
  if (els["auto-allow"].checked) return Promise.resolve(true);
  els["modal-title"].textContent = title;
  els["modal-body"].textContent = body;
  els.modal.classList.remove("hidden");
  return new Promise((resolve) => { modalResolver = resolve; });
}
els["modal-allow"].onclick = () => { els.modal.classList.add("hidden"); if (modalResolver) modalResolver(true); modalResolver = null; };
els["modal-deny"].onclick = () => { els.modal.classList.add("hidden"); if (modalResolver) modalResolver(false); modalResolver = null; };

// ---- Tool execution -------------------------------------------------------
async function execTool(name, argObj) {
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
    const ok = await confirmAction("Agent muon GHI file", argObj.path + "\n\n(" + (argObj.content || "").length + " ky tu)\n\n" + preview(argObj.content, 1200));
    if (!ok) return { ok: false, text: "Ngu dung tu choi ghi file." };
    const r = await api.writeFile(argObj.path, argObj.content || "");
    if (state.tabs.some((t) => t.path === argObj.path)) { const t = state.tabs.find((x) => x.path === argObj.path); t.content = argObj.content; t.dirty = false; if (state.active === argObj.path) setEditorContent(argObj.content); renderTabs(); }
    return { ok: true, text: "Da ghi " + r.bytes + " byte vao " + r.path };
  }
  if (name === "run_command") {
    const cmdStr = argObj.command + " " + (argObj.args || []).join(" ");
    const ok = await confirmAction("Agent muon CHAY LENH", "cwd: workspace\nlenh: " + cmdStr);
    if (!ok) return { ok: false, text: "Ngu dung tu choi chay lenh." };
    const r = await api.runCommand(argObj.command, argObj.args || [], 60000);
    const out = [r.stdout, r.stderr].filter(Boolean).join("\n");
    return { ok: r.ok, text: (r.ok ? "exit 0\n" : "exit " + r.code + "\n") + (out || "(khong co xuat)") };
  }
  return { ok: false, text: "Tool khong xac dinh: " + name };
}
function preview(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "\n...(cat ngan)" : s; }

function parseArgs(s) { try { return JSON.parse(s || "{}"); } catch (e) { return {}; } }

// ---- Agent loop -----------------------------------------------------------
async function runAgent(userText) {
  if (state.running) return;
  state.running = true; state.abort = false;
  els["btn-stop"].classList.remove("hidden");
  hideNotice();

  state.history.push({ role: "user", content: userText });
  addBubble("user", "ban", userText);
  els.prompt.value = "";

  const useTools = els["tools-enabled"].checked;
  const model = els["model-select"].value;
  const MAX = 12;

  try {
    for (let iter = 0; iter < MAX; iter++) {
      if (state.abort) { setLoop("da dung"); break; }
      setLoop("dang goi model... (vong " + (iter + 1) + ")");
      const body = { model, messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(state.history) };
      if (useTools) body.tools = TOOLS;
      const resp = await fetch(state.baseUrl + "/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        const code = data && data.error && (data.error.code || data.error.type);
        if (code === "tools_not_supported" || resp.status === 400) {
          showNotice("Model <b>" + escapeHtml(model) + "</b> khong ho tro tool. Tat <b>Agent tools</b> hoac chon Groq / OpenRouter / Gemini (da co key). <span style='color:var(--muted)'>" + escapeHtml((data && data.error && (data.error.message || data.error.hint)) || "") + "</span>");
          setLoop(""); state.running = false; break;
        }
        throw new Error("HTTP " + resp.status + ": " + ((data && data.error && (data.error.message || JSON.stringify(data.error))) || "loi khong ro"));
      }
      const choice = data && data.choices && data.choices[0];
      if (!choice) throw new Error("Model khong tra ve choices.");
      const msg = choice.message || {};
      state.history.push(msg);
      if (msg.content) addBubble("assistant", "wenker", msg.content);
      setLoop("");

      if (choice.finish_reason === "tool_calls" && Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
        for (const tc of msg.tool_calls) {
          if (state.abort) break;
          const fname = tc.function && tc.function.name;
          const fargs = parseArgs(tc.function && tc.function.arguments);
          const card = addToolCard(fname, tc.function && tc.function.arguments, "pending");
          setLoop("dang chay " + fname + "...");
          let result;
          try { result = await execTool(fname, fargs); }
          catch (e) { result = { ok: false, text: "Loi thuc thi: " + e.message }; }
          card.className = "tool-card " + (result.ok ? "ok" : "err");
          card.querySelector(".tool-status").textContent = result.ok ? "xong" : "loi";
          const pre = document.createElement("pre");
          pre.textContent = preview(result.text, 4000);
          card.appendChild(pre);
          state.history.push({ role: "tool", tool_call_id: tc.id, content: typeof result.text === "string" ? result.text : JSON.stringify(result.text) });
          els.chat.scrollTop = els.chat.scrollHeight;
        }
        setLoop("");
        continue; // gui lai history cho model tong hop
      }
      break; // finish_reason stop => xong vong
    }
  } catch (e) {
    showError(String(e && e.message ? e.message : e));
  } finally {
    state.running = false;
    els["btn-stop"].classList.add("hidden");
    setLoop("");
  }
}

function setLoop(s) { els["loop-status"].textContent = s; }

// ---- Wiring ---------------------------------------------------------------
els["btn-folder"].onclick = onPickFolder;
els["btn-manage"].onclick = (e) => { e.preventDefault(); api.openExternal(state.baseUrl + "/"); };
els["btn-send"].onclick = () => { const t = els.prompt.value.trim(); if (t) runAgent(t); };
els["btn-stop"].onclick = () => { state.abort = true; };
els.prompt.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t = els.prompt.value.trim(); if (t) runAgent(t); }
});
els["model-select"].addEventListener("change", () => {
  const m = currentModelMeta();
  if (m && (m.wenker_needs_key || m.wenker_status === "needs_key")) {
    showNotice("Model <b>" + escapeHtml(m.id) + "</b> can API key. Mo <b>Dashboard</b> de them key mien phi (Groq/OpenRouter/Gemini).");
  } else hideNotice();
});

function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

boot();
