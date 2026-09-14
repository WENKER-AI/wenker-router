// Buoc "tiep": lam cho WENKER Cloud (tier basic/mac dinh) chay THAT bang xkiro.
// Nho nhanh Pollinations gio quyet theo baseUrl, nen sau khi doi baseUrl, wenker-cloud
// tu dong di duong generic co key; provider 'pollinations' van giu Pollinations.
// Key lay tu bien truong WK_XKIRO_KEY (khong hardcode). Idempotent.
const http = require("http");
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { let j; try { j = JSON.parse(b); } catch { j = null; } resolve({ status: res.statusCode, json: j, body: b }); }); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(15000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
const XKIRO = process.env.WK_XKIRO_KEY;
if (!XKIRO) { console.error("THIEU WK_XKIRO_KEY"); process.exit(2); }

// 7 id than thien cua wenker-cloud GIU NGUYEN; chi doi targetModel -> slug xkiro DA CHUNG MINH SONG.
const CLOUD_MODELS = [
  { id: "wenker-deepseek-r1-free", name: "WENKER Cloud DeepSeek R1", contextWindow: 64000, isFree: true, targetModel: "mistralai/devstral-medium" },
  { id: "wenker-deepseek-v3-free", name: "WENKER Cloud DeepSeek V3", contextWindow: 64000, isFree: true, targetModel: "mistralai/codestral-2508" },
  { id: "wenker-qwen-2.5-coder-free", name: "WENKER Cloud Qwen Coder", contextWindow: 32768, isFree: true, targetModel: "mistralai/codestral-2508" },
  { id: "wenker-llama-3.3-70b-free", name: "WENKER Cloud Llama 3.3 70B", contextWindow: 128000, isFree: true, targetModel: "mistralai/mistral-large-2512" },
  { id: "wenker-mistral-nemo-free", name: "WENKER Cloud Mistral NeMo", contextWindow: 32000, isFree: true, targetModel: "mistralai/mistral-medium-3.5" },
  { id: "wenker-gpt-4o-mini-free", name: "WENKER Cloud GPT-4o mini", contextWindow: 128000, isFree: true, targetModel: "mistralai/ministral-8b" },
  { id: "wenker-gemini-2.5-free", name: "WENKER Cloud Gemini Flash", contextWindow: 1000000, isFree: true, targetModel: "mistralai/mistral-small-2603" },
];

(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };

  const r = await call("POST", "/api/providers/wenker-cloud", A, {
    baseUrl: "https://api.xkiro.com/v1",
    authType: "bearer",
    userApiKey: XKIRO,
    requiresAuth: true,
    enabled: true,
    models: CLOUD_MODELS,
    description: "WENKER Cloud (basic) - dinh tuyen toi xkiro. Ten model ben duoi la ALIAS; model that tra loi la slug xkiro o cot targetModel (xem Nhat Ky).",
    keyHelp: "Da noi key xkiro. Khong can lam gi them. Neu xkiro bao 403 'premium' thi do model do can so du; cac model dang day la loai mien phi trong goi.",
  });
  console.log("wenker-cloud -> xkiro ->", r.status, r.json?.success ? "OK" : r.body);

  const after = await call("GET", "/api/providers", A, null);
  const p = (after.json?.providers || []).find((x) => x.id === "wenker-cloud");
  console.log(`  [wenker-cloud] enabled=${p?.enabled} baseUrl=${p?.baseUrl} hasKey=${p?.hasApiKey} models=${(p?.models || []).length}`);
  const pol = (after.json?.providers || []).find((x) => x.id === "pollinations");
  console.log(`  [pollinations] baseUrl=${pol?.baseUrl}  (van Pollinations -> khong bi lay)`);
})();
