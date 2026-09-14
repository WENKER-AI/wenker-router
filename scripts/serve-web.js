// Server tĩnh siêu nhỏ để xem thử thư mục web/ (chỉ dùng node core, không dependency).
// Dùng: node scripts/serve-web.js [cong]   (mặc định 4173)
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "web");
const PORT = Number(process.argv[2] || 4173);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  // chặn traversal (so với cả dấu phân cách để "/web2" không lọt qua)
  const file = path.normalize(path.join(ROOT, urlPath));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // Tra ve trang 404.html (dich, co i18n + game ca voi) thay vi text tho.
      const notFound = path.join(ROOT, "404.html");
      return fs.readFile(notFound, (err2, html) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          return res.end("404 Not Found: " + urlPath);
        }
        res.writeHead(404, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
      });
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[web] http://127.0.0.1:${PORT}/  root=${ROOT}`);
});
