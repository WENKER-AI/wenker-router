/**
 * eventBus - trung tam phat su kien Server-Sent Events (SSE) cua WENKER Router.
 *
 * Moi client (dashboard) mo mot ket noi GET /api/events; server giu danh sach
 * response va phat nguoc ve khi co su kien:
 *   - 'log'    : mot request moi duoc ghi (dbService.addLog) -> Live tail logs.
 *   - 'update' : phien ban moi hon duoc phat hien (updateService) -> banner toan server.
 *
 * Thiet ke nho gon, khong thu ngoai vi: dung plain http, khong can thư vien.
 * Ket noi bi roi (client dong tab / mat mang) duoc don dep qua 'close'.
 */

// Client = { res, id }. id chi dung de debug dem so ket noi.
const clients = new Set();
let seq = 0;

/** Ghi mot su kien SSE dung dinh dang: "event: <name>\ndata: <json>\n\n". */
function frame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Mo mot ket noi SSE cho request hien tai. tra ve ve 'close' de goi cleanup.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
function subscribe(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // tat dem cua nginx (neu co) de stream chay ngay
  });
  // Comment mo dau giu cho ket noi song va giup vai tro proxy phat hien stream.
  res.write(': wenker stream open\n\n');

  const client = { res, id: ++seq };
  clients.add(client);

  // Giu ket noi song qua cac mang/ proxy co timeout: ping dinh ky.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      /* se bi clean ben duoi */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });

  return client;
}

/** Phat mot su kien toi moi client dang nghe. Khong lam roi vong goi (log -> emit). */
function broadcast(event, data) {
  if (clients.size === 0) return;
  const payload = frame(event, data);
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch (e) {
      clients.delete(client);
    }
  }
}

/** So ket noi dang mo (phuc vu debug / health). */
function connectionCount() {
  return clients.size;
}

module.exports = { subscribe, broadcast, connectionCount };
