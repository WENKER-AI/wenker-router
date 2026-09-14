// Verify end-to-end qua :3600: xkiro model song, izzi/VIP loi trung thuc (khong fake-200),
// model thuong van OK, /v1/models co id moi, resolve slug chua dau '/' dung provider.
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
const REFUSAL = /reached its budget|insufficient balance|requires real deposited|top up|raise the budget/i;
async function chat(A, model) {
  const nonce = Math.random().toString(36).slice(2, 8);
  const r = await call("POST", "/v1/chat/completions", A, { model, messages: [{ role: "user", content: "Reply with exactly one word: " + nonce }], max_tokens: 25 });
  const c = r.json?.choices?.[0]?.message?.content;
  const e = r.json?.error?.message;
  let verdict;
  if (r.status === 200 && c && !REFUSAL.test(c)) verdict = "OK-THAT";
  else if (r.status === 200 && c && REFUSAL.test(c)) verdict = "FAKE-200!!";
  else verdict = "LOI-" + r.status;
  return { verdict, status: r.status, content: c ? String(c).replace(/\s+/g, " ").slice(0, 36) : String(e || r.body).replace(/\s+/g, " ").slice(0, 90) };
}
(async () => {
  const keys = await call("GET", "/api/keys", {}, null);
  const arr = Array.isArray(keys.json) ? keys.json : (keys.json?.keys || []);
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };

  const cases = [
    "xkiro-basic/mistralai/codestral-2508",   // slug chua '/' -> phai resolve ve xkiro
    "xkiro-basic/mistralai/ministral-3b",
    "xkiro-basic/codestral-2508",             // id ngan -> loose match
    "wenker-vip/wenker-vip-deepseek",         // izzi het tien -> 402 trung thuc
    "openrouter/openai/gpt-4o-mini",          // duong cu van chay
    "wenker-community/wenker-community",      // da khoa -> phai bi chan
  ];
  console.log("=== CHAT QUA ROUTER ===");
  for (const m of cases) {
    const r = await chat(A, m);
    console.log(`  ${r.verdict.padEnd(9)} ${m.padEnd(42)} ${r.content}`);
  }

  console.log("\n=== /v1/models (id moi) ===");
  const mm = await call("GET", "/v1/models", A, null);
  const ids = (mm.json?.data || []).map((x) => x.id);
  console.log("  tong:", ids.length, "| xkiro-basic:", ids.filter((x) => x.startsWith("xkiro-basic/")).length, "| wenker-vip:", ids.filter((x) => x.startsWith("wenker-vip/")).length);
  console.log("  xkiro mau:", ids.filter((x) => x.startsWith("xkiro-basic/")).slice(0, 3).join(", "));

  console.log("\n=== /v1/messages (Anthropic) qua xkiro ===");
  const an = await call("POST", "/v1/messages", Object.assign({ "anthropic-version": "2023-06-01" }, A), {
    model: "xkiro-basic/mistralai/codestral-2508", max_tokens: 25, messages: [{ role: "user", content: "one word" }],
  });
  const txt = an.json?.content?.[0]?.text;
  console.log(`  HTTP ${an.status}  ${txt ? "OK-THAT " + JSON.stringify(txt.slice(0, 30)) : "LOI " + String(an.json?.error?.message || an.body).slice(0, 80)}`);
})();
