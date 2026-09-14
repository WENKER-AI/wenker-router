// Test TINH (fallback OFF) -> lo loi THAT cua tung nguon, khong de smart fallback che giau.
const http = require("http");
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { let j; try { j = JSON.parse(b); } catch { j = null; } resolve({ status: res.statusCode, json: j, body: b }); }); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(60000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
const REFUSAL = /reached its budget|insufficient balance|requires real deposited|top up/i;
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  await call("POST", "/api/settings", A, { enableSmartFallback: false }); // TINH
  console.log("=== fallback OFF: loi THAT ===");
  for (const m of ["xkiro-basic/mistralai/codestral-2508", "xkiro-basic/mistralai/ministral-8b",
    "wenker-vip/wenker-vip-deepseek", "wenker-community/wenker-community"]) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await call("POST", "/v1/chat/completions", A, { model: m, messages: [{ role: "user", content: "one word: " + nonce }], max_tokens: 25 });
    const c = r.json?.choices?.[0]?.message?.content;
    const e = r.json?.error?.message;
    const tag = r.status === 200 && c && !REFUSAL.test(c) ? "SONG-THAT" : (r.status === 200 && c ? "FAKE200" : "LOI-" + r.status);
    console.log(`  ${tag.padEnd(9)} ${m.padEnd(40)} ${c ? JSON.stringify(String(c).slice(0, 30)) : String(e || r.body).replace(/\s+/g, " ").slice(0, 110)}`);
  }
  await call("POST", "/api/settings", A, { enableSmartFallback: true }); // bat lai
  console.log("(bat lai smart fallback)");
})();
