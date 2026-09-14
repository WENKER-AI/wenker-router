'use strict';

/**
 * WENKER - VS Code model provider
 *
 * Đưa toàn bộ model của WENKER Router (http://localhost:3600) vào danh sách model
 * của chính VS Code (Chat / Copilot / Agent), dùng API ổn định
 * `vscode.lm.registerLanguageModelChatProvider` + contribution point
 * `languageModelChatProviders`.
 *
 * Không lưu model tĩnh: mỗi lần tải danh sách là gọi thẳng `/v1/models`, nên router
 * thêm provider/model nào thì bên này biết ngay.
 */

const vscode = require('vscode');

const VENDOR = 'wenker';
const ADMIN_KEY_SECRET = 'wenker.adminKey';

/** @type {vscode.ExtensionContext | null} */
let EXT_CTX = null;
/** @type {WenkerProvider | null} */
let PROVIDER = null;

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------

function cfg() {
  const s = vscode.workspace.getConfiguration('wenker');
  return {
    baseUrl: (s.get('baseUrl') || 'http://localhost:3600/v1').replace(/\/+$/, ''),
    modelFilter: s.get('modelFilter') || 'free',
    maxOutputTokens: Number(s.get('maxOutputTokens') || 4096),
    maxInputTokensCap: Number(s.get('maxInputTokensCap') || 128000),
    requestTimeoutMs: Number(s.get('requestTimeoutMs') || 120000)
  };
}

/** Gốc của router, bỏ `/v1`: dùng cho các endpoint `/api/*` của dashboard. */
function apiBase() {
  return cfg().baseUrl.replace(/\/v1\/?$/, '');
}

async function getAdminKey({ prompt = true } = {}) {
  const stored = (EXT_CTX && EXT_CTX.secrets && (await EXT_CTX.secrets.get(ADMIN_KEY_SECRET))) || '';
  if (stored) return stored;
  const fromSettings = vscode.workspace.getConfiguration('wenker').get('adminKey') || '';
  if (fromSettings) return fromSettings;
  if (!prompt) return '';
  const value = await vscode.window.showInputBox({
    title: 'WENKER: cần API key admin',
    prompt: 'Nhập API key có role admin (xem WENKER → Key Manager trên dashboard). Để trống nếu bạn chỉ dùng từ máy local.',
    password: true,
    ignoreFocusOut: true
  });
  const key = (value || '').trim();
  if (key && EXT_CTX) await EXT_CTX.secrets.store(ADMIN_KEY_SECRET, key);
  return key;
}

// ---------------------------------------------------------------------------
// HTTP (fetch có sẵn trong nhân Node của VS Code)
// ---------------------------------------------------------------------------

async function httpJson(url, options = {}, timeoutMs = cfg().requestTimeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      /* không phải JSON */
    }
    if (!res.ok) {
      const detail =
        (body && body.error && (body.error.hint || body.error.message || body.error.code)) ||
        text.slice(0, 200) ||
        res.statusText;
      throw new Error(`HTTP ${res.status}: ${detail}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Chuyển /v1/models thành LanguageModelChatInformation
// ---------------------------------------------------------------------------

/**
 * VS Code định danh model bằng `vendor/<id>` (xem extensionHostProcess.js:
 * toModelIdentifier), và _modelCache bỏ qua model nào có identifier đã tồn tại,
 * chỉ ghi cảnh báo "[LM] Model X is already registered. Skipping." trong
 * renderer.log. Nghĩa là HAI model trùng id thì model thứ hai BIEN MAT khoi bo chon.
 *
 * Router cua WENKER luon phat hanh moi model hai lan: id tran va id "provider/id".
 * Id tran KHONG dam bao doc nhat - co 6 provider local (vllm, openllm, sglang,
 * aphrodite, llama-stack, openwebui-proxy) cung dat ten model la "default", nen
 * id tran "default" xuat hien 6 lan. Vi vay: dung id tran khi no doc nhat toan
 * cuc, nguoc lai dung dang "provider/id" (luon doc nhat va router accept - da
 * do: wenker-cloud/wenker-deepseek-r1-free => 200).
 */
function pickModels(data, filter) {
  const models = ((data && data.data) || []).filter((m) => m && m.id);

  // Dem id tran tren TOAN BO danh sach (khong chi phan duoc loc) vi su trung lap
  // la do tinh chat cua id, khong phu thuoc bo loc.
  const bareCount = new Map();
  for (const m of models) {
    if (String(m.id).includes('/')) continue;
    bareCount.set(m.id, (bareCount.get(m.id) || 0) + 1);
  }

  const seen = new Set();
  const out = [];
  for (const m of models) {
    const qualified = String(m.id).includes('/');
    if (qualified) {
      // Chi dung dang nay de doi ten cho id tran bi trung; khong bo sung lan hai.
      continue;
    }
    const keep =
      filter === 'all'
        ? true
        : filter === 'no-key'
          ? m.wenker_needs_key === false
          : Boolean(m.wenker_free) && m.wenker_needs_key !== true;
    if (!keep) continue;

    let id = m.id;
    if ((bareCount.get(m.id) || 0) > 1 && m.wenker_provider) {
      id = `${m.wenker_provider}/${m.id}`;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id === m.id ? m : { ...m, id, wenker_model_id: m.id });
  }
  return out;
}

function toModelInfo(m, maxOutput, inputCap) {
  const ctx = Number(m.wenker_context) || 32000;
  // Không khai báo vượt trần. VS Code dùng maxInputTokens để quyết định cắt lịch sử,
  // mà nhiều nguồn free thực tế không phục vụ nổi tới 1M token: khai báo thừa khiến
  // mất nội dung im lặng, khai báo thiếu chỉ cắt sớm hơn. Chọn đường an toàn.
  const maxInput = Math.max(1000, Math.min(Math.max(1000, ctx - maxOutput), inputCap));
  const flags = [];
  if (m.wenker_free) flags.push('miễn phí');
  if (m.wenker_needs_key === false) flags.push('không cần key');
  else if (m.wenker_requires_key) flags.push('cần key');
  if (m.wenker_status && m.wenker_status !== 'unknown') flags.push(`nguồn: ${m.wenker_status}`);
  if (ctx > maxInput + maxOutput) {
    flags.push(`router công bố ~${Math.round(ctx / 1000)}K, VS Code đang giới hạn ${Math.round((maxInput + maxOutput) / 1000)}K`);
  }
  const tooltip =
    `${m.wenker_provider_name || m.owned_by || ''} · ${m.wenker_category || 'other'} · ` +
    `~${Math.round(maxInput / 1000)}K ngữ cảnh · ${flags.join(' · ')}`;
  return {
    id: m.id,
    name: m.wenker_display_name || m.id,
    family: m.wenker_provider || 'wenker',
    version: '1.0.0',
    tooltip,
    detail: m.wenker_provider_name || m.owned_by || 'WENKER',
    maxInputTokens: maxInput,
    maxOutputTokens: maxOutput,
    capabilities: { imageInput: false, toolCalling: false }
  };
}

// ---------------------------------------------------------------------------
// Chuyển tin nhắn VS Code -> OpenAI
// ---------------------------------------------------------------------------

function partToText(part) {
  if (!part) return '';
  if (typeof part === 'string') return part;
  if (typeof part.value === 'string') return part.value; // LanguageModelTextPart
  if (typeof part.text === 'string') return part.text;
  return '';
}

function toOpenAiMessages(messages) {
  const out = [];
  for (const msg of messages || []) {
    const role = msg.role === vscode.LanguageModelChatMessageRole.Assistant ? 'assistant' : 'user';
    const content = Array.isArray(msg.content) ? msg.content.map(partToText).join('') : partToText(msg.content);
    if (content.trim()) out.push({ role, content });
  }
  if (!out.length) out.push({ role: 'user', content: '' });
  return out;
}

// ---------------------------------------------------------------------------
// Đọc SSE
// ---------------------------------------------------------------------------

/**
 * Đọc stream từ /v1/chat/completions. Trả về toàn văn; gọi onText mỗi lần có chunk.
 */
async function streamChatCompletion(url, payload, headers, onText, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
    body: JSON.stringify({ ...payload, stream: true }),
    signal
  });

  if (!res.ok) {
    let detail = '';
    try {
      const t = await res.text();
      try {
        const j = JSON.parse(t);
        detail = (j.error && (j.error.hint || j.error.message || j.error.code)) || t.slice(0, 300);
      } catch (e) {
        detail = t.slice(0, 300);
      }
    } catch (e) {
      detail = res.statusText;
    }
    throw new Error(`WENKER HTTP ${res.status}: ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  const handleEvent = (raw) => {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (!dataLines.length) return true;
    const data = dataLines.join('');
    if (data === '[DONE]') return false;
    try {
      const j = JSON.parse(data);
      const choice = j.choices && j.choices[0];
      const delta = choice && (choice.delta?.content ?? choice.text);
      if (typeof delta === 'string' && delta) {
        full += delta;
        onText(delta);
      }
      const msg = choice && choice.message && choice.message.content;
      if (!full && typeof msg === 'string' && msg) {
        full = msg;
        onText(msg);
      }
    } catch (e) {
      /* chunk không phải JSON -> bỏ qua */
    }
    return true;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (handleEvent(rawEvent) === false) return full;
    }
  }
  if (buffer.trim()) handleEvent(buffer);
  return full;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Vài upstream free trả HTTP 200 kèm một câu từ chối trong nội dung (hết budget,
 * quá tải) thay vì trả lỗi. Nếu đưa thẳng vào chat thì người dùng tưởng model trả
 * lời như vậy. Ta nhận diện và gắn nhãn rõ ràng.
 */
const UPSTREAM_REFUSAL = /reached its budget|payment required|rate limit|too many requests|quota exceeded|invalid api key|no healthy upstream/i;

class WenkerProvider {
  constructor() {
    this._cached = null;
    this._total = 0;
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeLanguageModelChatInformation = this._onDidChange.event;
  }

  invalidate() {
    this._cached = null;
    this._onDidChange.fire();
  }

  async fetchModels() {
    const { baseUrl, modelFilter, maxOutputTokens, maxInputTokensCap } = cfg();
    const data = await httpJson(`${baseUrl}/models`);
    const list = pickModels(data, modelFilter).map((m) => toModelInfo(m, maxOutputTokens, maxInputTokensCap));
    return { list, total: ((data && data.data) || []).length };
  }

  async provideLanguageModelChatInformation(_options, _token) {
    const { list, total } = await this.fetchModels();
    this._cached = list;
    this._total = total;
    return list;
  }

  async provideLanguageModelChatResponse(model, messages, options, progress, token) {
    const { baseUrl, maxOutputTokens, requestTimeoutMs } = cfg();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), requestTimeoutMs);
    if (token && typeof token.onCancellationRequested === 'function') {
      token.onCancellationRequested(() => ctrl.abort());
    }
    try {
      const payload = {
        model: model.id,
        messages: toOpenAiMessages(messages),
        temperature: options && options.modelOptions && options.modelOptions.temperature,
        max_tokens: maxOutputTokens
      };
      for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

      const chunks = [];
      const full = await streamChatCompletion(
        `${baseUrl}/chat/completions`,
        payload,
        {},
        (chunk) => {
          chunks.push(chunk);
          progress.report(new vscode.LanguageModelTextPart(chunk));
        },
        ctrl.signal
      );

      if (!chunks.length) {
        // Upstream trả 200 nhưng không có nội dung -> báo thật, không bịa câu trả lời.
        progress.report(
          new vscode.LanguageModelTextPart(
            `(WENKER: nguồn ${model.id} trả về nội dung rỗng. Thử model khác trong WENKER → Model Finder, ` +
              `hoặc chạy lệnh "WENKER: Kiểm tra kết nối + định tuyến" để xem nguồn nào đang sống.)`
          )
        );
        return;
      }

      // Nguồn free hay trả lời từ chối (hết lượt) như thể đó là câu trả lời của model.
      // Nhận diện: toàn văn ngắn và khớp mẫu từ chối của upstream.
      if (full.length < 400 && UPSTREAM_REFUSAL.test(full)) {
        progress.report(
          new vscode.LanguageModelTextPart(
            '\n\n(WENKER: đây là thông báo từ chối của nguồn miễn phí, không phải câu trả lời của model. ' +
              'Nguồn này đang hết lượt ẩn danh — chạy lệnh "WENKER: Kiểm tra kết nối + định tuyến" để chọn nguồn khác.)'
          )
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async provideTokenCount(_model, text) {
    let value = '';
    if (typeof text === 'string') value = text;
    else if (Array.isArray(text)) value = text.map(partToText).join('');
    else if (text && typeof text.value === 'string') value = text.value;
    else if (text && Array.isArray(text.content)) value = text.content.map(partToText).join('');
    // Xấp xỉ: router ước lượng ~4 ký tự/token và không chạy tokenizer riêng của 181 nguồn.
    return Math.max(1, Math.ceil(String(value).length / 4));
  }
}

// ---------------------------------------------------------------------------
// Lệnh
// ---------------------------------------------------------------------------

function withBusy(fn) {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'WENKER: ', cancellable: false },
    () => fn()
  );
}

function reportError(err) {
  const msg = String((err && err.message) || err);
  if (/abort|fetch failed|ECONNREFUSED/i.test(msg)) {
    vscode.window.showWarningMessage(
      `WENKER: không kết nối được ${cfg().baseUrl}. Chạy "node server/index.js" (hoặc start.bat) rồi thử lại.`
    );
    return;
  }
  vscode.window.showErrorMessage(`WENKER: ${msg}`);
}

async function cmdRefresh() {
  await withBusy(async () => {
    try {
      PROVIDER.invalidate();
      const { list, total } = await PROVIDER.fetchModels();
      PROVIDER._cached = list;
      PROVIDER._total = total;
      PROVIDER._onDidChange.fire();
      refreshStatusBar();
      vscode.window.showInformationMessage(
        `WENKER: ${list.length}/${total} model (bộ lọc "${cfg().modelFilter}") đã sẵn trong bộ chọn model.`
      );
    } catch (err) {
      reportError(err);
    }
  });
}

async function cmdStatus() {
  await withBusy(async () => {
    const { baseUrl, modelFilter } = cfg();
    const root = apiBase();
    const lines = [];
    let health = null;
    let models = null;
    try {
      health = await httpJson(`${root}/health`, {}, 6000);
    } catch (e) {
      lines.push(`- Server: KHÔNG ĐẠT (${e.message})`);
    }
    try {
      const data = await httpJson(`${baseUrl}/models`, {}, 15000);
      models = data.data || [];
    } catch (e) {
      lines.push(`- /v1/models: ${e.message}`);
    }
    if (health) {
      lines.push(`- Server: ${health.status} · v${health.version} · uptime ${Math.round(health.uptime)}s`);
    }
    if (models) {
      const flat = models.filter((m) => !String(m.id).includes('/'));
      const free = flat.filter((m) => m.wenker_free);
      const noKey = free.filter((m) => m.wenker_needs_key === false);
      const alive = new Set(models.filter((m) => m.wenker_status === 'alive').map((m) => m.wenker_provider));
      const dead = new Set(models.filter((m) => m.wenker_status === 'down').map((m) => m.wenker_provider));
      lines.push(`- Tổng model: ${flat.length} · miễn phí: ${free.length} · không cần key: ${noKey.length}`);
      lines.push(`- Bộ lọc đang dùng trong VS Code: "${modelFilter}" → ${PROVIDER._cached ? PROVIDER._cached.length : '?'} model hiển thị`);
      lines.push(`- Nguồn probe đang sống: ${alive.size ? [...alive].join(', ') : 'chưa probe lần nào'}`);
      if (dead.size) lines.push(`- Nguồn probe đang chết: ${[...dead].join(', ')}`);
      lines.push(`- Gợi ý: nếu nhóm "không cần key" trả 402, thêm key miễn phí (Groq/Gemini/OpenRouter) ở dashboard rồi đổi bộ lọc sang "all".`);
    }
    const doc = await vscode.workspace.openTextDocument({
      language: 'markdown',
      content: `# WENKER Router\n\nBase URL: \`${baseUrl}\`\n\n${lines.join('\n')}\n`
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  });
}

async function cmdInstallAddon() {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    openLabel: 'Chọn file .addon',
    filters: { 'WENKER add-on': ['addon'], JSON: ['json'] }
  });
  if (!picked || !picked.length) return;
  await withBusy(async () => {
    try {
      const raw = Buffer.from(await vscode.workspace.fs.readFile(picked[0])).toString('utf8');
      const key = await getAdminKey();
      const root = apiBase();
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['x-wenker-admin-key'] = key;
      const out = await httpJson(`${root}/api/addons/install`, { method: 'POST', headers, body: JSON.stringify({ source: raw }) });
      if (!out || out.success === false) {
        vscode.window.showErrorMessage(`WENKER: cài thất bại - ${(out && out.error) || JSON.stringify(out).slice(0, 160)}`);
        return;
      }
      const addon = out.addon || {};
      const name = addon.name || picked[0].path.split('/').pop();
      const open = 'Mở dashboard';
      const choice = await vscode.window.showInformationMessage(
        `WENKER: đã cài add-on "${name}" (${addon.type || '?'}). Mở dashboard để bật theme.`,
        open
      );
      if (choice === open) await vscode.env.openExternal(vscode.Uri.parse(root));
    } catch (err) {
      reportError(err);
    }
  });
}

async function cmdListAddons() {
  await withBusy(async () => {
    try {
      const key = await getAdminKey({ prompt: false });
      const headers = key ? { 'x-wenker-admin-key': key } : {};
      const out = await httpJson(`${apiBase()}/api/addons`, { headers });
      const addons = (out && out.addons) || [];
      const rows = addons
        .map((a) => `| ${a.name} | ${a.type} | ${a.builtin ? 'gốc' : 'của bạn'} | ${a.active ? 'ĐANG BẬT' : '—'} | \`${a.id}\` |`)
        .join('\n');
      const doc = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content:
          `# WENKER: add-on đang cài (${addons.length})\n\n` +
          `| Tên | Loại | Nguồn | Theme | ID |\n|---|---|---|---|---|\n` +
          `${rows || '| — | — | — | — | chưa cài add-on nào |'}\n`
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err) {
      reportError(err);
    }
  });
}

/**
 * Do TU PHIA VS CODE: vscode.lm.selectChatModels() la cach duyet cua that ma
 * Copilot Chat dung de lay model. Neuf extension tự báo 71 mà VS Code chi thay
 * 1 thi day la bang chung khach quan. Mo ket qua bang markdown de nguoi dung
 * tu nhin thay, khong can tin vao log cua extension.
 */
async function cmdVerifyPicker() {
  const { baseUrl, modelFilter } = cfg();
  const lines = ['# WENKER — VS Code thuc thay bao nhieu model?', ''];
  try {
    const mine = await PROVIDER.fetchModels();
    lines.push('- Router `/v1/models`: **' + mine.total + '** model tổng');
    lines.push('- Extension sinh ra (bộ lọc "' + modelFilter + '"): **' + mine.list.length + '** model');
  } catch (e) {
    lines.push(`- ⚠ Không đọc được router (${baseUrl}): ${e.message}`);
  }

  let seen = [];
  try {
    seen = await vscode.lm.selectChatModels({ vendor: VENDOR });
  } catch (e) {
    lines.push('', '- ⚠ `selectChatModels` lỗi: ' + e.message);
  }
  lines.push('', '- **VS Code trả về qua `lm.selectChatModels({vendor:"wenker"}): ' + seen.length + ' model**', '');

  if (!seen.length) {
    lines.push('> ❌ VS Code **không thấy model nào** của WENKER. Mở Output → "Extension Host" để tìm lỗi, hoặc chạy lại "Reload Window".');
  } else {
    lines.push('| id VS Code cấp | tên hiển thị | maxInput | maxOutput |');
    lines.push('|---|---|---|---|');
    for (const m of seen.slice(0, 80)) {
      lines.push(`| \`${m.id}\` | ${m.name} | ${m.maxInputTokens ?? '—'} | ${m.maxOutputTokens ?? '—'} |`);
    }
    if (seen.length > 80) lines.push(`| … còn lại ${seen.length - 80} model | | | |`);
    const ids = new Set(seen.map((m) => m.id));
    if (ids.size === 1) {
      lines.push('', '> ⚠ **CẢNH BÁO:** VS Code gộp toàn bộ về MỘT id duy nhất — model sẽ không hiện đúng trong bộ chọn.');
    } else {
      lines.push('', `> ✅ ${ids.size} id phân biệt — bộ chọn model nhận đúng từng model.`);
    }
  }

  const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language: 'markdown' });
  await vscode.window.showTextDocument(doc, { preview: true });
}

async function cmdOpenPlayground() {
  const root = apiBase();
  try {
    await httpJson(`${root}/health`, {}, 4000);
  } catch (e) {
    vscode.window.showWarningMessage(`WENKER: không thấy server ở ${root}. Chạy start.bat trước khi mở dashboard.`);
    return;
  }
  await vscode.env.openExternal(vscode.Uri.parse(`${root}/`));
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

let STATUS = null;

async function refreshStatusBar() {
  if (!STATUS) return;
  const { baseUrl, modelFilter } = cfg();
  try {
    let list = PROVIDER._cached;
    if (!list) {
      const r = await PROVIDER.fetchModels();
      list = r.list;
      PROVIDER._cached = list;
      PROVIDER._total = r.total;
    }
    STATUS.text = `$(sparkle) WENKER ${list.length}`;
    STATUS.tooltip = `Model của WENKER Router (\`${baseUrl}\`) · bộ lọc "${modelFilter}" · bấm để kiểm tra`;
  } catch (e) {
    STATUS.text = '$(sparkle) WENKER';
    STATUS.tooltip = `Chưa kết nối được WENKER Router: ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// Vòng đời extension
// ---------------------------------------------------------------------------

function activate(context) {
  EXT_CTX = context;
  PROVIDER = new WenkerProvider();

  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider(VENDOR, PROVIDER),
    vscode.commands.registerCommand('wenker.refreshModels', cmdRefresh),
    vscode.commands.registerCommand('wenker.status', cmdStatus),
    vscode.commands.registerCommand('wenker.installAddon', cmdInstallAddon),
    vscode.commands.registerCommand('wenker.listAddons', cmdListAddons),
    vscode.commands.registerCommand('wenker.useInPlayground', cmdOpenPlayground),
    vscode.commands.registerCommand('wenker.verifyPicker', cmdVerifyPicker)
  );

  STATUS = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  STATUS.command = 'wenker.status';
  STATUS.show();
  context.subscriptions.push(STATUS);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('wenker')) {
        PROVIDER.invalidate();
        refreshStatusBar();
      }
    })
  );

  refreshStatusBar();
}

function deactivate() {
  if (PROVIDER && PROVIDER._onDidChange) PROVIDER._onDidChange.dispose();
}

module.exports = { activate, deactivate };
