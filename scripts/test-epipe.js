/**
 * Regression test: router khong duoc chet khi stdout/pipe bi dong giua chung.
 *
 * Ly do: WENKER Studio boot router NGAY TRONG tien trinh Electron main. Khi terminal
 * cua cha dong lai (hoac pipe bi ngat), moi lan `console.log` trong middleware
 * (server/index.js) ghi vao stdout da chet se nem "write EPIPE" -> uncaught ->
 * Electron bat hop thoai "A JavaScript error occurred in the main process", con
 * `npm start` thi quyet. server/index.js gan `stream.on('error', noop)` tren
 * stdout/stderr de nu loi do. Test nay kiem tra guard van con hieu luc.
 *
 * Chay:  node scripts/test-epipe.js   (exit 0 = PASS)
 */
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function hit(port, p) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, path: p, timeout: 3000 }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", () => resolve(0));
    req.on("timeout", () => { req.destroy(); resolve(0); });
  });
}

(async () => {
  const root = path.join(__dirname, "..");
  const PORT = await findFreePort();
  const child = spawn(process.execPath, [path.join(root, "server", "index.js")], {
    cwd: root,
    env: Object.assign({}, process.env, { PORT: String(PORT), HOST: "127.0.0.1" }),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let exited = null;
  child.on("exit", (code, sig) => { exited = { code, sig }; });
  child.stdout.resume();
  child.stderr.resume();

  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    if (await hit(PORT, "/health") === 200) break;
    if (exited) { console.log("FAIL: router khong boot: " + JSON.stringify(exited)); process.exit(1); }
    await new Promise((r) => setTimeout(r, 250));
  }

  // Dong pipe stdout phia cha -> moi console.log cua router tu day se gap EPIPE.
  child.stdout.destroy();

  for (let i = 0; i < 8; i++) await hit(PORT, "/v1/models");
  await new Promise((r) => setTimeout(r, 800));

  if (exited) {
    console.log("FAIL: router CHET vi EPIPE -> " + JSON.stringify(exited) + "  (guard bi mat/hong)");
    process.exit(1);
  }
  const alive = await hit(PORT, "/v1/models");
  child.kill();
  if (alive === 200) {
    console.log("PASS: router van song sau 8 request qua pipe da chet (EPIPE duoc nu)");
    process.exit(0);
  }
  console.log("FAIL: router song nhung /v1/models tra " + alive);
  process.exit(1);
})().catch((e) => { console.log("FAIL: " + e.message); process.exit(1); });
