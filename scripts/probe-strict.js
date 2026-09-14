// Probe toi gian: goi model la va in STATUS THAT + error.message, va doc
// strictModelResolution hien tai. Khong doc log (log co the la entry cu).
const http = require("http");
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { let j; try { j = JSON.parse(b); } catch { j = null; } resolve({ status: res.statusCode, json: j, body: b }); }); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(30000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const K = { "x-api-key": admin.key };
  const st = await call("GET", "/api/settings", A, null);
  const s = st.json?.settings || st.json || {};
  console.log("strictModelResolution =", s.strictModelResolution, "| defaultProvider =", s.defaultProvider, "| enableSmartFallback =", s.enableSmartFallback);

  const nonce = Math.random().toString(36).slice(2, 8);
  const r = await call("POST", "/v1/chat/completions", K, { model: "xyz-khong-ton-tai-" + nonce, messages: [{ role: "user", content: "hi" }], stream: false });
  console.log(`\n[unknown model] HTTP ${r.status}`);
  console.log("  error.code   =", r.json?.error?.code);
  console.log("  error.message=", (r.json?.error?.message || "").slice(0, 90));
  console.log("  available[0..3]=", (r.json?.error?.available_models || []).slice(0, 3));

  // Goi THAT qua wenker-cloud de doi chieu (fallback OFF da dat truoc do van giu).
  const n2 = Math.random().toString(36).slice(2, 8);
  const r2 = await call("POST", "/v1/chat/completions", K, { model: "wenker-cloud/wenker-deepseek-v3-free", messages: [{ role: "user", content: `ma ${n2}, 2+3?` }], stream: false });
  console.log(`\n[wenker-cloud xkiro] HTTP ${r2.status} content=`, (r2.json?.choices?.[0]?.message?.content || "").slice(0, 40));
})();
