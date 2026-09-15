/**
 * sse - mot ket noi EventSource dung chung cho toan bo dashboard.
 *
 * Tai sao dung chung: EventSource bi gioi han so ket noi moi domain (6 tren
 * HTTP/1.1), nen moi component tu mo mot stream rieng se nhanh chan. O day mo
 * DUNG mot ket noi /api/events, phat lai cho cac subscriber noi bo.
 *
 * Su kien day duoc server phat:
 *   - 'log'    : entry log moi (Live tail logs)
 *   - 'update' : {current, latest, available} - bao co ban WENKER moi tren npm
 *
 * EventSource khong gui duoc header, nen token di qua ?token= (server da mo
 * duong cho rieng /api/events trong guard). Tu dong reconnect khi roi ket noi.
 */
import { getToken } from './session';

const listeners = new Map(); // event name -> Set<fn>
let source = null;
let startedToken = null;
let retryTimer = null;

function ensureConnection() {
  const token = getToken();
  if (!token) return; // chua dang nhap -> khong mo stream
  if (source && startedToken === token) return; // dang co ket noi dung token

  closeConnection();
  startedToken = token;
  try {
    source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
  } catch (e) {
    source = null;
    return;
  }
  source.addEventListener('log', (ev) => emit('log', safeParse(ev.data)));
  source.addEventListener('update', (ev) => emit('update', safeParse(ev.data)));
  source.onerror = () => {
    // EventSource tu reconnect, nhung neu that bai lien tuc thi ta tu mo lai.
    if (source && source.readyState === EventSource.CLOSED) {
      closeConnection();
      clearTimeout(retryTimer);
      retryTimer = setTimeout(ensureConnection, 5000);
    }
  };
}

function closeConnection() {
  if (source) {
    try { source.close(); } catch (e) { /* ignore */ }
  }
  source = null;
  startedToken = null;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function emit(name, data) {
  if (!data) return;
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of set) {
    try { fn(data); } catch (e) { /* mot subscriber loi khong chan cac khac */ }
  }
}

/** Dang ky nghe mot su kien SSE. tra ve ham huy dang ky (goi trong useEffect cleanup). */
export function onServerEvent(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  ensureConnection(); // dam bao ket noi dang chay khi co nguoi dung
  return () => {
    const set = listeners.get(name);
    if (set) set.delete(fn);
  };
}

/** Goi khi dang nhap thanh cong (mo ngay ket noi) . */
export function connectServerEvents() {
  ensureConnection();
}

/** Goi khi logout: dong stream va don listener cu. */
export function disconnectServerEvents() {
  closeConnection();
  clearTimeout(retryTimer);
}
