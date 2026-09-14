// Bypass cache bằng message độc nhất -> ép đường LIVE qua fallback chain.
// Kỳ vọng: wenker-cloud trả 402/502 THẬT (không fake-200 chứa "reached its budget").
const http = require("http");
function req(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h }, (res) => {
      let buf = ""; res.on("data", (c) => (buf += c)); res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(60000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await req("GET", "/api/keys", {}, null);
  let kj; try { kj = JSON.parse(keys.body); } catch { kj = null; }
  const arr = Array.isArray(kj) ? kj : (kj && kj.keys) || [];
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const nonce = "unique-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const r = await req("POST", "/v1/chat/completions", A, {
    model: "wenker-cloud/wenker-deepseek-v3-free",
    messages: [{ role: "user", content: "trả lời đúng một từ duy nhất: " + nonce }],
  });
  const fake200 = r.status === 200 && /reached its budget|raise the budget|API key used for this request/i.test(r.body);
  console.log(`wenker-cloud LIVE (cache-miss):  HTTP ${r.status}  fake200=${fake200 ? "BUG" : "no"}`);
  console.log(`body: ${r.body.replace(/\s+/g, " ").slice(0, 240)}`);
})();
