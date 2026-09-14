// GOP "WENKER Basic (xkiro)" (custom) vao "WENKER Cloud (Original)" = tier basic duy nhat.
// - Lay 10 slug tho cua xkiro-basic, them vao catalog wenker-cloud (giu 7 alias than thien) => 17 model.
// - Xoa provider custom xkiro-basic.
// - fallbackOrder: bo xkiro-basic, dat wenker-cloud len dau (no la basic song + mac dinh).
// Idempotent: chay lan 2 se khong trung lap model.
const http = require("http");
function call(method, path, headers, bodyObj) {
  return new Promise((resolve) => {
    const data = bodyObj ? Buffer.from(JSON.stringify(bodyObj)) : null;
    const h = Object.assign({}, headers);
    if (data) { h["Content-Type"] = "application/json"; h["Content-Length"] = data.length; }
    const r = http.request({ host: "127.0.0.1", port: 3600, path, method, headers: h },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => { let j; try { j = JSON.parse(b); } catch { j = null; } resolve({ status: res.statusCode, json: j, body: b }); }); });
    r.on("error", (e) => resolve({ status: 0, body: String(e.message) }));
    r.setTimeout(15000, () => { r.destroy(); resolve({ status: -1, body: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };

  const pv = await call("GET", "/api/providers", A, null);
  const list = pv.json?.providers || [];
  const cloud = list.find((p) => p.id === "wenker-cloud");
  const xkiro = list.find((p) => p.id === "xkiro-basic");
  if (!cloud) { console.error("khong thay wenker-cloud"); process.exit(1); }

  const raw = (xkiro?.models || []).map((m) => ({
    id: m.id, name: m.name, contextWindow: m.contextWindow || 32000, isFree: true,
    targetModel: m.targetModel || m.id,
    description: "Slug xkiro that (da gop tu WENKER Basic).",
  }));
  const have = new Set((cloud.models || []).map((m) => m.id));
  const merged = [...(cloud.models || []), ...raw.filter((m) => !have.has(m.id))];
  console.log(`wenker-cloud: ${cloud.models.length} model + xkiro ${raw.length} slug -> ${merged.length} sau gop`);

  const r1 = await call("POST", "/api/providers/wenker-cloud", A, {
    models: merged,
    description: "WENKER Cloud (basic) - nguon xkiro, DA GOP 'WENKER Basic (xkiro)' vao day. Ten wenker-*-free la ALIAS; slug mistralai/* la ten that cua xkiro. Xem targetModel o chi tiet.",
  });
  console.log("gop model ->", r1.status, r1.json?.success ? "OK" : r1.body);

  const st = await call("GET", "/api/settings", A, null);
  const s = st.json?.settings || st.json || {};
  const fo = (s.fallbackOrder || []).filter((x) => x !== "xkiro-basic");
  const order = ["wenker-cloud", ...fo.filter((x) => x !== "wenker-cloud")];
  const r2 = await call("POST", "/api/settings", A, Object.assign({}, s, { fallbackOrder: order, defaultProvider: "wenker-cloud" }));
  console.log("fallbackOrder ->", r2.status, JSON.stringify(order));

  if (xkiro) {
    const r3 = await call("DELETE", "/api/providers/custom/xkiro-basic", A, null);
    console.log("xoa xkiro-basic ->", r3.status, r3.json?.success ? "OK" : r3.body);
  } else {
    console.log("xkiro-basic: da xoa tu truoc");
  }

  const after = await call("GET", "/api/providers", A, null);
  const c2 = (after.json?.providers || []).find((p) => p.id === "wenker-cloud");
  const x2 = (after.json?.providers || []).find((p) => p.id === "xkiro-basic");
  console.log(`\nsau gop: wenker-cloud models=${(c2?.models || []).length} baseUrl=${c2?.baseUrl} | xkiro-basic con? ${x2 ? "CO" : "KHONG"}`);
})();
