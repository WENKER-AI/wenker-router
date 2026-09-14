// Chup hien trang: OpenRouter duoc cau hinh nhung model nao, settings routing the nao,
// va provider nao dang CO key. Can de quyet dinh sua failover/default provider.
const path = require("path");
const db = require(path.resolve("H:/new/WENKER/server/services/dbService"));
if (db.load) db.load();
const inst = db.cacheSet ? db : db.db;

const s = inst.getSettings();
console.log("=== SETTINGS ===");
for (const k of ["defaultProvider", "enableSmartFallback", "strictModelResolution", "fallbackOrder"]) {
  console.log("  " + k.padEnd(22) + " = " + JSON.stringify(s[k]));
}

console.log("\n=== PROVIDER DANG CO KEY ===");
const all = inst.getAllProviders ? inst.getAllProviders() : [];
for (const p of all) {
  if (p.userApiKey) {
    console.log("  " + p.id.padEnd(18) + " enabled=" + p.enabled + "  key=" + String(p.userApiKey).slice(0, 10) + "...(" + String(p.userApiKey).length + ")");
  }
}

console.log("\n=== MODEC LIST CUA TUNG PROVIDER CO KEY ===");
for (const p of all) {
  if (!p.userApiKey) continue;
  const ms = p.models || [];
  console.log("  [" + p.id + "]  " + ms.length + " model");
  for (const m of ms) {
    console.log("      id=" + String(m.id).padEnd(42) + " target=" + String(m.targetModel || "-"));
  }
}
