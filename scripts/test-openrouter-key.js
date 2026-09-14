// Thu cac model OpenRouter voi KEY SAN CO (da chung minh hop le bang 404!=401).
// Tat smart fallback de ket qua la THAT.
const http = require("http");
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h }, (res) => {
      let buf = ""; res.on("data", (c) => (buf += c)); res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(45000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  let kj; try { kj = JSON.parse(keys.body); } catch { kj = null; }
  const arr = Array.isArray(kj) ? kj : (kj && kj.keys) || [];
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  await call("POST", "/api/settings", A, { enableSmartFallback: false });

  const slugs = [
    "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    "openrouter/google/gemini-2.0-flash-exp:free",
    "openrouter/qwen/qwen-2.5-72b-instruct:free",
    "openrouter/mistralai/mistral-7b-instruct:free",
    "openrouter/deepseek/deepseek-chat",
    "openrouter/deepseek/deepseek-chat-v3-0324",
  ];
  for (const m of slugs) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await call("POST", "/v1/chat/completions", A, {
      model: m, messages: [{ role: "user", content: "tra loi 1 tu thoi: " + nonce }], max_tokens: 30,
    });
    let j; try { j = JSON.parse(r.body); } catch { j = null; }
    const c = j?.choices?.[0]?.message?.content;
    const e = j?.error?.message;
    const ok = r.status === 200 && c;
    console.log(`${ok ? "SONG   " : "CHET   "} ${m}`);
    console.log(`   HTTP ${r.status}  ${ok ? JSON.stringify(String(c).slice(0, 80)) : String(e || r.body).replace(/\s+/g, " ").slice(0, 160)}`);
    console.log();
  }
  await call("POST", "/api/settings", A, { enableSmartFallback: true });
  console.log("(da bat lai smart fallback)");
})();
