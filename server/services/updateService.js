/**
 * updateService - phat hien ban WENKER Router moi hon tren npm registry.
 *
 * Y cua nguoi dung: khi mot server dang chay ban cu (vi du 2.0.0 / 1.9) nhan ra
 * the gioi co ban moi hon (qua npm registry), no phai bao cho TOAN BO client dang
 * mo dashboard cua no. Cach phat: fetch registry 'latest', so voi ban hien tai,
 * neu moi hon thi eventBus.broadcast('update', ...) -> moi tab bat len banner.
 *
 * An toan / khong chan cua:
 *  - Chi goi luc khoi dong + moi CHECK_INTERVAL_MS; khong chan request khac.
 *  - That mang / registry khong tra ve -> im lang, khong bao loi cho UI.
 *  - Co the tat bang WENKER_UPDATE_CHECK=0 (mang cuc bo, may khong co internet).
 */
const eventBus = require('./eventBus');

const PKG = require('../../package.json');
const CURRENT = PKG.version || '0.0.0';
const NAME = PKG.name || 'wenker-router';
const REGISTRY_URL = process.env.WENKER_REGISTRY || 'https://registry.npmjs.org';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 gio
const ENABLED = !/^(0|false)$/i.test(String(process.env.WENKER_UPDATE_CHECK || '1'));

// Ket noi gan nhat de UI hien ngay khi mo (khong phai cho lan check sau).
let latest = { current: CURRENT, latest: CURRENT, available: false, checkedAt: null, error: null };

/** So sanh hai chuoi semver "a.b.c" (bo qua pre-release tag). tra ve >0 neu a moi hon b. */
function compareSemver(a, b) {
  const pa = String(a)
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b)
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Goi registry mot lan. Khong nem ra ngoai - loi chi duoc ghi vao latest.error. */
async function checkNow({ force = false } = {}) {
  if (!ENABLED) return latest;
  // Da biet ban moi hon va vua check gan day -> bo qua, tranh spam registry.
  if (
    !force &&
    latest.available &&
    latest.checkedAt &&
    Date.now() - latest.checkedAt < CHECK_INTERVAL_MS
  ) {
    return latest;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${REGISTRY_URL}/${encodeURIComponent(NAME)}/latest`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`registry ${res.status}`);
    const data = await res.json();
    const newest = data && data.version;
    const available = Boolean(newest) && compareSemver(newest, CURRENT) > 0;
    const changed = available !== latest.available || newest !== latest.latest;
    latest = {
      current: CURRENT,
      latest: newest || CURRENT,
      available,
      checkedAt: Date.now(),
      error: null,
    };
    // Chi bao khach hang khi trang thai doi (ban moi xuat hien / het ban moi).
    if (changed) eventBus.broadcast('update', latest);
  } catch (err) {
    latest = { ...latest, error: err && err.message ? err.message : String(err) };
    // That mang: giu nguyen trang thai cu, khong bao loi gia len UI.
  }
  return latest;
}

/** Khoi dong: kiem tra ngay (bat dong bo, khong cho app.listen) + lap lai dinh ky. */
function start() {
  if (!ENABLED) return;
  // Khong await o day - server phai lang len du registry cham/khong thang duoc.
  checkNow().catch(() => {});
  const t = setInterval(() => checkNow().catch(() => {}), CHECK_INTERVAL_MS);
  if (typeof t.unref === 'function') t.unref(); // khong git process song chi vi timer
}

function getState() {
  return latest;
}

module.exports = { start, checkNow, getState, compareSemver, CURRENT, NAME };
