// Kiem tra failover giai cuu: goi model wenker-cloud (Pollinations da chet) voi smart fallback ON,
// xem router co tu nhay sang openrouter song va tra 200 khong, hay van 402.
const http = require("http");
function call(path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method: data ? "POST" : "GET", headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b })); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(70000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await call("/api/keys", {}, null);
  let kj; try { kj = JSON.parse(keys.body); } catch { kj = null; }
  const arr = Array.isArray(kj) ? kj : (kj && kj.keys) || [];
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const nonce = Math.random().toString(36).slice(2, 8);
  const r = await call("/v1/chat/completions", A, {
    model: "wenker-cloud/wenker-deepseek-v3-free",
    messages: [{ role: "user", content: "one word only: " + nonce }], max_tokens: 25,
  });
  let j; try { j = JSON.parse(r.body); } catch { j = null; }
  const c = j?.choices?.[0]?.message?.content;
  console.log("FAILOVER tu wenker-cloud(chet) -> HTTP", r.status, " provider:", j?.provider || j?.wensker?.provider || "?", " content:", c ? JSON.stringify(String(c).slice(0, 40)) : JSON.stringify(String(j?.error?.message || "").slice(0, 120)));
})();
