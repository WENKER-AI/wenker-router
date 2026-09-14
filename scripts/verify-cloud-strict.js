// Kiem chuan THAT: clear cache, moi goi dung prompt doc nhat (nonce), doc LOG de thay
// providerId thuc su phuc vu + co cached hay khong. Fallback TAT.
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
const err = (j) => (j?.error?.message || j?.message || "").slice(0, 70).replace(/\s+/g, " ");
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const K = { "x-api-key": admin.key };

  // Tat fallback + clear cache.
  const st = await call("GET", "/api/settings", A, null);
  const settings = st.json?.settings || st.json || {};
  await call("POST", "/api/settings", A, Object.assign({}, settings, { enableSmartFallback: false }));
  await call("DELETE", "/api/cache", A, null);
  console.log("== fallback OFF, cache cleared ==\n");

  const latestProvider = async () => {
    const lg = await call("GET", "/api/logs", A, null);
    const list = Array.isArray(lg.json) ? lg.json : (lg.json?.logs || []);
    const e = list.find((x) => x.endpoint === "/v1/chat/completions");
    return e ? `provider=${e.providerId} model=${e.resolvedModel || e.model} cached=${!!e.cached} status=${e.status}` : "khong co log";
  };

  const t = async (model) => {
    const nonce = Math.random().toString(36).slice(2, 10);
    const r = await call("POST", "/v1/chat/completions", K, {
      messages: [{ role: "user", content: `Ma ${nonce}. Tra loi ngan: 1+1 bang may?` }], stream: false, model,
    });
    const who = await latestProvider();
    const tag = r.status === 200 && txt(r.json) ? "SONG" : (r.status === 200 ? "200-RONG" : "LOI-" + r.status);
    console.log(`${tag.padEnd(9)} ${model.padEnd(34)} ${who}\n            noi dung: ${txt(r.json) || err(r.json)}`);
  };

  await t("wenker-cloud/wenker-deepseek-v3-free");
  await t("wenker-cloud/wenker-gpt-4o-mini-free");
  await t("gpt-4o");
  await t("claude-3-5-sonnet");
  await t("pollinations/pollinations-deepseek");

  await call("POST", "/api/settings", A, Object.assign({}, settings, { enableSmartFallback: true }));
  console.log("\n== fallback ON (khoi phuc) ==");
})();
