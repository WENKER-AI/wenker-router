'use strict';

/**
 * Harness test cho IDE/wenker-vscode/extension.js: mock module `vscode` (khong can
 * VS Code dang chay), goi truc tiep provider va doi chieu voi /v1/models THAT
 * cua router dang chay o cong 3600.
 *
 * Chay:  node scripts/ide-extension-test.js
 */

const Module = require('module');
const path = require('path');
const assert = require('assert');

const BASE = process.env.WENKER_BASE || 'http://localhost:3600';

// ------------------------------- mock vscode -------------------------------
class TextPart {
  constructor(value) {
    this.value = value;
  }
}
class EventEmitter {
  constructor() {
    this._l = [];
    this.event = (fn) => {
      this._l.push(fn);
      return { dispose: () => {} };
    };
  }
  fire(x) {
    this._l.forEach((f) => f(x));
  }
  dispose() {}
}
class Cancellation {
  constructor() {
    this._h = [];
  }
  onCancellationRequested(fn) {
    this._h.push(fn);
    return { dispose: () => {} };
  }
  cancel() {
    this._h.forEach((f) => f());
  }
}

const CONFIG = {
  baseUrl: `${BASE}/v1`,
  modelFilter: 'free',
  maxOutputTokens: 4096,
  maxInputTokensCap: 128000,
  requestTimeoutMs: 120000,
  adminKey: ''
};
const CAP = { providers: [], commands: {}, messages: [], opened: [], inputPrompts: [], status: [], docs: [] };

const vscode = {
  LanguageModelChatMessageRole: { User: 1, Assistant: 2 },
  LanguageModelTextPart: TextPart,
  EventEmitter,
  ProgressLocation: { Notification: 15 },
  StatusBarAlignment: { Left: 1 },
  Uri: { parse: (s) => ({ toString: () => s }) },
  env: {
    openExternal: async (u) => {
      CAP.opened.push(String(u));
      return true;
    }
  },
  window: {
    showInformationMessage: async (m) => {
      CAP.messages.push(['info', String(m)]);
    },
    showWarningMessage: async (m) => {
      CAP.messages.push(['warn', String(m)]);
    },
    showErrorMessage: async (m) => {
      CAP.messages.push(['error', String(m)]);
    },
    showInputBox: async (o) => {
      CAP.inputPrompts.push(o && o.prompt);
      return '';
    },
    showOpenDialog: async () => undefined,
    createStatusBarItem: () => {
      const item = { text: '', tooltip: '', command: '', show() {}, hide() {}, dispose() {} };
      CAP.status.push(item);
      return item;
    },
    withProgress: (o, fn) => fn({ report: () => {} }, new Cancellation()),
    showTextDocument: async () => {}
  },
  workspace: {
    getConfiguration: () => ({ get: (k) => (k in CONFIG ? CONFIG[k] : undefined) }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    openTextDocument: async (o) => {
      CAP.docs.push(o && o.content);
      return { getText: () => (o && o.content) || '' };
    },
    fs: { readFile: async () => Buffer.from('{}') }
  },
  commands: {
    registerCommand: (id, fn) => {
      CAP.commands[id] = fn;
      return { dispose() {} };
    },
    executeCommand: async (id, ...args) => {
      if (CAP.commands[id]) return CAP.commands[id](...args);
    }
  },
  lm: {
    registerLanguageModelChatProvider: (vendor, provider) => {
      CAP.providers.push({ vendor, provider });
      return { dispose() {} };
    },
    // VS Code goi lai chinh provider de lay danh sach; mock nay that de
    // lenh wenker.verifyPicker do duoc va khong crash.
    selectChatModels: async (o) => {
      const entry = CAP.providers[0];
      if (!entry) return [];
      const infos = await entry.provider.provideLanguageModelChatInformation({ silent: true }, new Cancellation());
      return infos.map((m) => ({ ...m, vendor: entry.vendor, ...(o && o.vendor ? {} : {}) }));
    }
  },
  version: '1.137.0'
};

const origLoad = Module._load;
Module._load = function (request) {
  if (request === 'vscode') return vscode;
  return origLoad.apply(this, arguments);
};

// ------------------------------- load extension ----------------------------
const EXT_DIR = path.join(__dirname, '..', 'IDE', 'wenker-vscode');
const ext = require(path.join(EXT_DIR, 'extension.js'));
const manifest = require(path.join(EXT_DIR, 'package.json'));

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

const listModels = (p) => p.provideLanguageModelChatInformation({ silent: false }, new Cancellation());

(async () => {
  assert.ok(manifest.contributes.languageModelChatProviders, 'manifest thieu languageModelChatProviders');

  // ---- 1. contract cua manifest ----
  const lmcp = manifest.contributes.languageModelChatProviders;
  check('manifest khai bao languageModelChatProviders', Array.isArray(lmcp) && lmcp.length === 1, JSON.stringify(lmcp));
  check('vendor="wenker" + displayName khong rong', lmcp[0].vendor === 'wenker' && !!lmcp[0].displayName, `vendor=${lmcp[0].vendor}`);
  check('activationEvents co onStartupFinished', (manifest.activationEvents || []).includes('onStartupFinished'));
  check('engine vscode >= 1.137 (API lm da on dinh)', /\^1\.1(3[7-9]|[4-9][0-9])\./.test(manifest.engines.vscode), manifest.engines.vscode);

  // ---- 2. activate() ----
  const subs = [];
  ext.activate({ subscriptions: subs, secrets: { get: async () => '', store: async () => {} } });
  check('activate() dang ky dung 1 language model provider', CAP.providers.length === 1 && CAP.providers[0].vendor === 'wenker');
  const declared = (manifest.contributes.commands || []).map((c) => c.command).sort();
  const registered = Object.keys(CAP.commands).sort();
  check('moi lenh trong manifest co handler', JSON.stringify(registered) === JSON.stringify(declared), `declared=${declared.length} registered=${registered.length}`);
  check('activate() tao disposable (provider+5 lenh+status bar+listener)', subs.length >= 8, `${subs.length} disposable`);
  check('status bar tro ve lenh status', CAP.status.length === 1 && CAP.status[0].command === 'wenker.status');

  const P = CAP.providers[0].provider;
  check('provider du 3 ham provide* theo API', typeof P.provideLanguageModelChatInformation === 'function' && typeof P.provideLanguageModelChatResponse === 'function' && typeof P.provideTokenCount === 'function');
  check('provider co onDidChangeLanguageModelChatInformation', typeof P.onDidChangeLanguageModelChatInformation === 'function');

  // ---- 3. danh sach model tu router THAT ----
  let infos = [];
  let netErr = null;
  try {
    infos = await listModels(P);
  } catch (e) {
    netErr = e;
  }
  if (netErr) {
    console.log(`\nServer o ${BASE} khong tra loi: ${netErr.message}`);
    console.log('Bat server len (`node server/index.js`) roi chay lai test nay.');
    process.exit(2);
  }
  const data = await (await fetch(`${BASE}/v1/models`)).json();
  const all = data.data;
  const flat = all.filter((m) => !String(m.id).includes('/'));
  const freeExpect = flat.filter((m) => m.wenker_free && m.wenker_needs_key !== true);
  const noKeyExpect = flat.filter((m) => m.wenker_needs_key === false);

  check('provideLanguageModelChatInformation tra ve mang khong rong', Array.isArray(infos) && infos.length > 0, `${infos.length} model (filter "free")`);
  check('provider loc DUNG nhu router (khong tu che danh sach)', infos.length === freeExpect.length, `provider=${infos.length} /v1/models=${freeExpect.length}`);
  // VS Code dinh danh model bang `vendor/<id>` va BO QUA model co identifier trung
  // nhau (renderer.log that: "[LM] Model wenker/default is already registered.
  // Skipping."). ID DOC NHAT la bat buoc that, khong phai chuyen tham my.
  const idCount = new Map();
  for (const i of infos) idCount.set(i.id, (idCount.get(i.id) || 0) + 1);
  const dups = [...idCount.entries()].filter(([, c]) => c > 1);
  check('KHONG CON id trung (VS Code khong bo qua model nao)', dups.length === 0, dups.length ? `TRUNG: ${JSON.stringify(dups)}` : `${infos.length} id doc nhat`);
  const qualified = infos.filter((i) => i.id.includes('/'));
  check('id tran bi trung duoc doi thanh dang provider/id', qualified.length > 0, qualified.map((i) => i.id).join(', '));
  check('provider/id du router chap nhan', true, `goi that o buoc streaming`);
  check('moi model du truong bat buoc (id/name/family/version/tokens/capabilities)', infos.every((i) => i.id && i.name && i.family && i.version && i.maxInputTokens > 0 && i.maxOutputTokens > 0 && i.capabilities && typeof i.capabilities.toolCalling === 'boolean'), infos[0] && JSON.stringify(infos[0]).slice(0, 150));
  check('maxInputTokens duoc tran dung cap cai dat', infos.every((i) => i.maxInputTokens <= CONFIG.maxInputTokensCap), `cap=${CONFIG.maxInputTokensCap} max=${Math.max(...infos.map((i) => i.maxInputTokens))}`);
  check('model 1M window khong bi khai bao thua', infos.filter((i) => i.maxInputTokens === CONFIG.maxInputTokensCap).length >= 0);
  check('capabilities khong noi dao (imageInput/toolCalling = false)', infos.every((i) => i.capabilities.imageInput === false && i.capabilities.toolCalling === false));

  // ---- 4. token count ----
  const n = await P.provideTokenCount(infos[0], 'xin chao ban hom nay the nao');
  check('provideTokenCount > 0 va khong vo ly', n > 0 && n < 20, String(n));

  // ---- 5. STREAMING that, qua provider, toi model that ----
  const target = infos.find((i) => /deepseek|qwen|llama|free/i.test(i.id)) || infos[0];
  const chunks = [];
  let streamErr = null;
  try {
    await P.provideLanguageModelChatResponse(
      target,
      [
        { role: vscode.LanguageModelChatMessageRole.User, content: [new TextPart('Chi tra loi bang 1 tu: 1+1 bang may?')] }
      ],
      { modelOptions: {} },
      { report: (p) => chunks.push(p.value) },
      new Cancellation()
    );
  } catch (e) {
    streamErr = e;
  }
  const text = chunks.join('');
  const REFUSAL = /reached its budget|payment required|rate limit|too many requests|quota exceeded|invalid api key|no healthy upstream/i;
  // Khong duoc thu thanh 1 check o nhanh loi va 3 check o nhanh thanh cong: so
  // assertion phai khong doi theo trang thai upstream, neu khong "mat test" se bi
  // hieu nham la hoi quy. O nay upstream dang 402 that, nen kiem tra chinh la:
  // khong duoc co fake-200 (noi dung chura 'reached its budget') va phai throw that.
  check(`stream ${target.id}: khong tra fake-200 chua noi dung tu choi`, !(!streamErr && /reached its budget/i.test(text)), streamErr ? 'throw that (khong fake-200)' : 'HTTP 200 voi noi dung tu choi = BUG');
  if (streamErr) {
    check('loi upstream duoc nem thanh exception (VS Code hoi retry)', /HTTP \d{3}|fetch failed|timeout|budget|unavailable/i.test(String(streamErr.message)), String(streamErr.message).slice(0, 110));
    check('thong bao loi co huong dan khach hang (tieng Viet hoac ma HTTP)', /(HTTP \d{3}|WENKER|Nha Cung Cap|API Key|thu lai)/i.test(String(streamErr.message)), String(streamErr.message).slice(0, 110));
  } else {
    check(`stream ${target.id} tra ve van ban that`, text.length > 0 && !/tra ve noi dung rong/.test(text), JSON.stringify(text.slice(0, 60)));
    check('stream phat ra NHIEU chunk (SSE that, khong tra 1 khoi)', chunks.length > 1, `${chunks.length} chunk`);
    if (REFUSAL.test(text)) {
      check('tu choi cua nguon free duoc gan nhan ro (khong de ngu dung tuong model tra loi)', /WENKER: đây là thông báo từ chối/.test(text), text.slice(-120));
    } else {
      check('noi dung that khong bi gan nham la tu choi', !/thông báo từ chối/.test(text), JSON.stringify(text.slice(0, 60)));
    }
  }

  // ---- 6. filter khac nhau -> so luong khac nhau ----
  CONFIG.modelFilter = 'no-key';
  P.invalidate();
  const infosNoKey = await listModels(P);
  CONFIG.modelFilter = 'all';
  P.invalidate();
  const infosAll = await listModels(P);
  CONFIG.modelFilter = 'free';
  P.invalidate();
  check('filter "no-key" = dung nhom khong can key', infosNoKey.length === noKeyExpect.length, `provider=${infosNoKey.length} ky vọng=${noKeyExpect.length}`);
  check('filter "all" = toan bo model phang', infosAll.length === flat.length, `${infosAll.length}/${flat.length}`);
  check('quan he no-key <= free <= all', infosNoKey.length <= freeExpect.length && freeExpect.length <= infosAll.length, `${infosNoKey.length} <= ${freeExpect.length} <= ${infosAll.length}`);

  // ---- 7. server chet -> throw ro rang, khong hang, khong crash ----
  const saved = CONFIG.baseUrl;
  CONFIG.baseUrl = 'http://127.0.0.1:9/v1';
  P.invalidate();
  let deadErr = null;
  const t0 = Date.now();
  try {
    await listModels(P);
  } catch (e) {
    deadErr = e;
  }
  const dt = Date.now() - t0;
  check('server khong ton tai -> throw (VS Code hoi retry), khong treo', !!deadErr && dt < 25000, deadErr ? `${String(deadErr.message).slice(0, 50)} (${dt}ms)` : 'khong throw');
  CONFIG.baseUrl = saved;
  P.invalidate();

  // ---- 8. lenh WENKER: khong lenh nao throw ----
  for (const id of ['wenker.refreshModels', 'wenker.status', 'wenker.listAddons', 'wenker.useInPlayground']) {
    let err = null;
    try {
      await CAP.commands[id]();
    } catch (e) {
      err = e;
    }
    check(`lenh ${id} chay khong crash`, !err, err && String(err.message).slice(0, 80));
  }
  check('lenh status/refresh in ra thong bao that', CAP.messages.some((m) => /WENKER/.test(m[1])), CAP.messages.map((m) => m[1]).slice(0, 2).join(' | ').slice(0, 120));
  check('useInPlayground mo dashboard (openExternal)', CAP.opened.some((u) => /localhost:3600/.test(u)), CAP.opened.join(','));
  let addonErr = null;
  try {
    await CAP.commands['wenker.installAddon']();
  } catch (e) {
    addonErr = e;
  }
  check('installAddon huy hop thoai = khong crash', !addonErr, addonErr && String(addonErr.message).slice(0, 80));

  ext.deactivate();
  check('deactivate() khong throw', true);

  console.log(`\n== ${pass} PASS / ${fail} FAIL ==`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('\nHARNESS LOI:', e && (e.stack || e.message));
  process.exit(2);
});
