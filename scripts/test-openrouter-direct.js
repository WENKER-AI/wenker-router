// Goi THANG OpenRouter bang key dang luu -> tra loi 2 cau hoi:
//  1) Key con song khong?  2) Model nao (free hay paid) goi duoc THAT?
const https = require("https");
const path = require("path");
const db = require(path.resolve("H:/new/WENKER/server/services/dbService"));
if (db.load) db.load();
const inst = db.cacheSet ? db : db.db;
const p = inst.getProviderById("openrouter");
const KEY = p && p.userApiKey;
if (!KEY) { console.log("khong co key openrouter"); process.exit(0); }
console.log("key:", String(KEY).slice(0, 8) + "...(" + String(KEY).length + " ky tu)\n");

function or(method, urlPath, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
    const r = https.request({
      host: "openrouter.ai", path: urlPath, method,
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json", ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) },
      timeout: 40000,
    }, (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b })); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.on("timeout", () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}

(async () => {
  // 1) Key con song? -> goi /api/v1/auth/key
  const auth = await or("GET", "/api/v1/auth/key", null);
  console.log("=== /auth/key -> HTTP " + auth.status + " ===");
  console.log(auth.body.replace(/\s+/g, " ").slice(0, 400));

  // 2) Thu tung model: ca :free lan paid
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "deepseek/deepseek-chat",
    "meta-llama/llama-3.3-70b-instruct",
    "openai/gpt-4o-mini",
  ];
  console.log("\n=== goi chat/completions ===");
  for (const m of models) {
    const r = await or("POST", "/api/v1/chat/completions", {
      model: m, messages: [{ role: "user", content: "say one word" }], max_tokens: 20,
    });
    let j; try { j = JSON.parse(r.body); } catch { j = null; }
    const c = j?.choices?.[0]?.message?.content;
    const e = j?.error?.message;
    console.log(`${r.status === 200 && c ? "SONG " : "CHET "} ${m.padEnd(42)} HTTP ${r.status}  ${c ? JSON.stringify(String(c).slice(0, 40)) : String(e || r.body).replace(/\s+/g, " ").slice(0, 120)}`);
  }
})();
