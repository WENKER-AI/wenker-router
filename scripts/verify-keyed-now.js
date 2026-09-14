// Kiem chung nhanh: wenker-cloud (key moi dang dan) + model paid OpenRouter, qua ROUTER :3600.
const http = require("http");
function call(path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method: data ? "POST" : "GET", headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b })); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(60000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await call("/api/keys", {}, null);
  let kj; try { kj = JSON.parse(keys.body); } catch { kj = null; }
  const arr = Array.isArray(kj) ? kj : (kj && kj.keys) || [];
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  await call("/api/settings", A, { enableSmartFallback: false });

  const models = [
    "wenker-cloud/wenker-deepseek-v3-free",
    "wenker-cloud/wenker-deepseek-r1-free",
    "openrouter/anthropic/claude-3.7-sonnet",
    "openrouter/openai/gpt-4o",
    "openrouter/deepseek/deepseek-r1:free",
    "together/meta-llama/Llama-3.3-70B-Instruct-Turbo",
  ];
  for (const m of models) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await call("/v1/chat/completions", A, {
      model: m, messages: [{ role: "user", content: "one word only: " + nonce }], max_tokens: 25,
    });
    let j; try { j = JSON.parse(r.body); } catch { j = null; }
    const c = j?.choices?.[0]?.message?.content;
    const e = j?.error?.message;
    const refusal = /reached its budget|raise the budget/i.test(String(c || ""));
    console.log(`${r.status === 200 && c && !refusal ? "SONG " : "CHET "} ${m.padEnd(46)} HTTP ${r.status}  ${c ? (refusal ? "REFUSAL:" + JSON.stringify(String(c).slice(0, 50)) : JSON.stringify(String(c).slice(0, 50))) : String(e || r.body).replace(/\s+/g, " ").slice(0, 120)}`);
  }
  await call("/api/settings", A, { enableSmartFallback: true });
  console.log("(bat lai smart fallback)");
})();
