// Dat defaultProvider = wenker-cloud (basic tier, gio la xkiro song) va kiem tra
// model bare (khong ton tai trong catalog) resolve ve dung wenker-cloud qua xkiro.
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
const txt = (j) => (j?.choices?.[0]?.message?.content || "").slice(0, 60).replace(/\s+/g, " ");
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const K = { "x-api-key": admin.key };

  const st = await call("GET", "/api/settings", A, null);
  const settings = st.json?.settings || st.json || {};
  await call("POST", "/api/settings", A, Object.assign({}, settings, { defaultProvider: "wenker-cloud", enableSmartFallback: false }));
  console.log("defaultProvider := wenker-cloud, fallback OFF\n");

  const latest = async () => {
    const lg = await call("GET", "/api/logs", A, null);
    const list = Array.isArray(lg.json) ? lg.json : (lg.json?.logs || []);
    const e = list.find((x) => x.endpoint === "/v1/chat/completions");
    return e ? `provider=${e.providerId} model=${e.resolvedModel || e.model} cached=${!!e.cached} status=${e.status}` : "?";
  };
  const nonce = Math.random().toString(36).slice(2, 10);
  const r = await call("POST", "/v1/chat/completions", K, {
    model: "mot-ten-model-khong-ton-tai-" + nonce,
    messages: [{ role: "user", content: `Ma ${nonce}. Noi chao.` }], stream: false,
  });
  console.log(`bare unknown -> ${await latest()}\n  noi dung: ${txt(r.json)}`);

  await call("POST", "/api/settings", A, Object.assign({}, settings, { defaultProvider: "wenker-cloud", enableSmartFallback: true }));
  console.log("\n== fallback ON (khoi phuc), defaultProvider=wenker-cloud ==");
})();
