// Kiem tra THAT (fallback TAT): wenker-cloud -> xkiro song; pollinations van la Pollinations.
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
const msg = (m) => ({ messages: [{ role: "user", content: m }], stream: false });
const txt = (j) => (j?.choices?.[0]?.message?.content || "").slice(0, 70).replace(/\s+/g, " ");
const err = (j) => (j?.error?.message || j?.message || "").slice(0, 80).replace(/\s+/g, " ");
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  const K = { "x-api-key": admin.key };

  // Tat smart fallback de nhin thay THAT.
  const st = await call("GET", "/api/settings", A, null);
  const settings = st.json?.settings || st.json || {};
  await call("POST", "/api/settings", A, Object.assign({}, settings, { enableSmartFallback: false }));
  console.log("== smart fallback = OFF ==\n");

  const t = async (label, model) => {
    const r = await call("POST", "/v1/chat/completions", K, msg("Tra loi ngan bang tieng Viet: ban la AI nao?"));
    let tag;
    if (r.status === 200 && txt(r.json)) tag = "SONG-THAT";
    else if (r.status === 200) tag = "200-RONG";
    else tag = "LOI-" + r.status;
    console.log(`${tag.padEnd(10)} ${model.padEnd(34)} ${txt(r.json) || err(r.json)}`);
  };

  // 1) wenker-cloud (gio la xkiro) - model than thien + alias cu.
  await t("cloud", "wenker-cloud/wenker-deepseek-v3-free");
  await t("cloud", "wenker-cloud/wenker-deepseek-r1-free");
  await t("cloud", "wenker-cloud/wenker-gpt-4o-mini-free");
  await t("alias", "gpt-4o");
  await t("alias", "gpt-4o-mini");
  await t("alias", "claude-3-5-sonnet");
  // 2) provider pollinations RIENG - van phai la Pollinations (loi that, KHONG phai xkiro).
  await t("poll", "pollinations/pollinations-deepseek");
  await t("poll", "pollinations-deepseek");

  // Bat lai smart fallback.
  await call("POST", "/api/settings", A, Object.assign({}, settings, { enableSmartFallback: true }));
  console.log("\n== smart fallback = ON (khoi phuc) ==");
})();
