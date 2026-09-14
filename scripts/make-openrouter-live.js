// Lam cho router CHAY THAT: test tung slug OpenRouter ung vien, chi giu slug SONG,
// ghi de vao providerOverrides.openrouter.models (song song doi model mac dinh + fallbackOrder),
// roi verify lai end-to-end. Khong thu cung: models[0] phai la slug song (that failover dung no).
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
const looksDead = (c) => /reached its budget|raise the budget|unavailable for free|no endpoints found|invalid api key/i.test(String(c || ""));

(async () => {
  const keys = await call("/api/keys", {}, null);
  let kj; try { kj = JSON.parse(keys.body); } catch { kj = null; }
  const arr = Array.isArray(kj) ? kj : (kj && kj.keys) || [];
  const admin = arr.find((k) => k.role === "admin" && k.isActive !== false);
  const A = { "x-wenker-admin-key": admin.key };
  await call("/api/settings", A, { enableSmartFallback: false }); // test tinh

  const CANDIDATES = [
    { slug: "openai/gpt-4o-mini", name: "OpenRouter GPT-4o mini (re)", free: false },
    { slug: "openai/gpt-4o", name: "OpenRouter GPT-4o", free: false },
    { slug: "deepseek/deepseek-chat", name: "OpenRouter DeepSeek Chat (re)", free: false },
    { slug: "meta-llama/llama-3.3-70b-instruct", name: "OpenRouter Llama 3.3 70B", free: false },
    { slug: "nex-agi/nex-n2.5-mini:free", name: "OpenRouter Nex N2.5 mini (FREE)", free: true },
  ];
  const live = [];
  console.log("=== TEST TUNG SLUG QUA ROUTER ===");
  for (const c of CANDIDATES) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await call("/v1/chat/completions", A, {
      model: "openrouter/" + c.slug,
      messages: [{ role: "user", content: "reply with one word: " + nonce }],
      max_tokens: 20,
    });
    let j; try { j = JSON.parse(r.body); } catch { j = null; }
    const content = j?.choices?.[0]?.message?.content;
    const ok = r.status === 200 && content && !looksDead(content);
    console.log(`${ok ? "SONG " : "CHET "} ${c.slug.padEnd(34)} HTTP ${r.status}  ${content ? JSON.stringify(String(content).slice(0, 40)) : String(j?.error?.message || r.body).replace(/\s+/g, " ").slice(0, 90)}`);
    if (ok) live.push(c);
  }

  if (!live.length) {
    await call("/api/settings", A, { enableSmartFallback: true });
    console.log("\nKHONG co slug OpenRouter nao song -> khong doi config. Bat lai smart fallback.");
    return;
  }

  console.log("\n=== APPLY: chi ghi slug SONG vao openrouter.models ===");
  const models = live.map((c) => ({
    id: c.slug, name: c.name,
    contextWindow: c.free ? 32000 : 128000, isFree: Boolean(c.free),
  }));
  // models[0] = slug song dau tien (gpt-4o-mini neu no song) -> failover dung model re.
  const pr = await call("/api/providers/openrouter", A, { models });
  console.log("  updateProvider(openrouter) ->", pr.status, "models la:", models.map((m) => m.id).join(", "));

  // Mo OpenRouter + dat no lam mac dinh va dau fallback order (wenker-cloud Pollinations da chet).
  await call("/api/providers/openrouter", A, { enabled: true });
  const st = await call("/api/settings", A, {
    defaultProvider: "openrouter",
    fallbackOrder: ["openrouter", "wenker-cloud", "groq", "google-gemini", "nim-nvidia", "duckduckgo", "pollinations"],
    enableSmartFallback: true,
  });
  console.log("  settings default=openrouter, smart fallback=ON ->", st.status);

  console.log("\n=== VERIFY LAI END-TO-END ===");
  // 1) go model ngan (chi ten model, khong prefix provider) -> phai resolve sang openrouter song
  for (const id of [models[0].id, "openrouter/" + models[0].id]) {
    const nonce = Math.random().toString(36).slice(2, 8);
    const r = await call("/v1/chat/completions", A, { model: id, messages: [{ role: "user", content: "one word: " + nonce }], max_tokens: 20 });
    let j; try { j = JSON.parse(r.body); } catch { j = null; }
    const content = j?.choices?.[0]?.message?.content;
    console.log(`  ${content && !looksDead(content) ? "OK " : "!! "} model="${id}" -> HTTP ${r.status} ${content ? JSON.stringify(String(content).slice(0, 30)) : JSON.stringify(String(j?.error?.message || "").slice(0, 90))}`);
  }
  // 2) /v1/models co lien ket openrouter khong
  const m = await call("/v1/models", A, null);
  let mj; try { mj = JSON.parse(m.body); } catch { mj = null; }
  const ids = (mj?.data || []).map((x) => x.id);
  console.log(`  /v1/models tong=${ids.length}  mo-dau-openrouter=${ids.filter((x) => x.startsWith("openrouter/")).length}  [${ids.filter((x) => x.startsWith("openrouter/")).join(", ")}]`);
})();
