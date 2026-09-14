const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./services/dbService');

const openaiRouter = require('./routes/openai');
const anthropicRouter = require('./routes/anthropic');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

const app = express();
const settings = db.getSettings();
const PORT = process.env.PORT || settings.port || 3600;
const HOST = process.env.HOST || settings.host || '0.0.0.0';

// Enable CORS for web apps (OpenWebUI, NextChat, Vite, etc.)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*']
}));

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/logs') && !req.path.startsWith('/api/stats')) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// ---- Admin API guard -------------------------------------------------------
// This gateway binds 0.0.0.0 by default, so /api/* used to be fully readable and
// writable by anyone on the LAN: change settings, install add-ons, list users, and
// (before masking) read stored provider keys. Requests from this machine's own
// loopback stay open so the dashboard keeps working with zero setup; anything that
// arrives over a real network interface must present the admin key.
// /v1/* is intentionally NOT touched - external clients (Cursor, Claude Code, the
// VS Code extension) keep authenticating with their own WENKER key as before.
const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127(\.\d+){3})$/;
// Set WENKER_ADMIN_OPEN_LOCALHOST=0 to require the admin key from this machine too.
const ADMIN_OPEN_LOCALHOST = !/^(0|false)$/i.test(String(process.env.WENKER_ADMIN_OPEN_LOCALHOST || '1'));

app.use('/api', (req, res, next) => {
  // Login, session check and quota must be reachable before anyone has a token.
  if (req.path === '/auth' || req.path.startsWith('/auth/')) return next();
  const remote = req.socket.remoteAddress || '';
  if (ADMIN_OPEN_LOCALHOST && LOOPBACK.test(remote)) return next();

  // 1) a passcode session from the app's own login gate
  const sessionToken = String(req.headers['x-wenker-session'] || '').trim();
  if (sessionToken && db.validateSession(sessionToken)) return next();

  // 2) an admin API key (for scripts and remote tooling)
  const presented = String(req.headers['x-wenker-admin-key'] || req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const isAdmin = db.getKeys().some((k) => k.role === 'admin' && k.isActive && k.key === presented);
  if (isAdmin) return next();

  return res.status(401).json({
    error: {
      message: 'API quan tri chi chap nhan tu may chu local. Dang nhap vao WENKER hoac gui header "x-wenker-admin-key: <key admin>"; dat WENKER_ADMIN_OPEN_LOCALHOST=0 de bat buoc cho ca local.',
      type: 'authentication_error',
      code: 'admin_key_required'
    }
  });
});

// API Routes
app.use('/v1', openaiRouter);
app.use('/v1', anthropicRouter);
app.use('/api', adminRouter);
app.use('/api/auth', authRouter);
// Unknown /v1/* endpoints -> clean OpenAI-style JSON error (not an HTML stack trace)
app.all('/v1/*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Không hỗ trợ endpoint ${req.method} ${req.originalUrl}. khả dụng: /v1/chat/completions, /v1/messages, /v1/models, /v1/embeddings.`,
      type: "invalid_request_error",
      param: null,
      code: "unsupported_endpoint"
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'WENKER Router',
    version: '2.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build if available
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Trang giới thiệu/markdown tĩnh (web/) được phục vụ dưới /web để không đụng
// asset của dashboard (dashboard chiếm /assets/*).
const webPath = path.join(__dirname, '..', 'web');
app.use('/web', express.static(webPath));
app.get('/web', (req, res) => res.redirect('/web/'));

// WENKER Studio (IDE Electron) — renderer là static, phục vụ luôn dưới /ide để:
//   1) app Electron chỉ việc loadURL http://127.0.0.1:PORT/ide/ (chung origin, khỏi CORS);
//   2) ai chưa cài app vẫn thử được UI trong browser.
// Thu muc nguon la studio/ (tranh va cham hoa/thuong voi IDE/ cua VS Code extension).
const idePath = path.join(__dirname, '..', 'studio', 'renderer');
app.use('/ide', express.static(idePath));
app.get('/ide', (req, res) => res.redirect('/ide/'));

const fs = require('fs');
const clientIndex = path.join(clientDistPath, 'index.html');
const notFoundPage = path.join(webPath, '404.html');

// Fallback cho SPA: chỉ những đường dẫn "giống trang" (không có phần mở rộng)
// mới được đưa về index.html để React tự xử lý tab.
app.get('*', (req, res) => {
  if (/\.[a-z0-9]{1,10}$/i.test(req.path)) {
    return res.status(404).type('html').send(
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>404</title>` +
      `<style>body{font-family:system-ui;background:#05070f;color:#eaf2ff;display:grid;place-items:center;height:100vh;margin:0}` +
      `a{color:#7ee787}</style></head><body><div style="text-align:center"><h1>Off. 404</h1>` +
      `<p>Không tìm thấy tài nguyên này.</p><p><a href="/web/404.html">Chơi mini game cá voi</a> · <a href="/">Về dashboard</a></p></div></body></html>`
    );
  }
  if (fs.existsSync(clientIndex)) {
    // Đường dẫn lạ (không phải asset, không phải "/") -> trang 404 pixel có mini game.
    // Dashboard là SPA thuần state (không có client-side routing theo path), nên
    // không cần đẩy mọi path về index.html; path sai nên trả 404 thật.
    if (req.path !== '/' && fs.existsSync(notFoundPage)) {
      let html = fs.readFileSync(notFoundPage, 'utf8');
      html = html.replace('<head>', '<head><base href="/web/">');
      return res.status(404).type('html').send(html);
    }
    return res.sendFile(clientIndex);
  }
  res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>WENKER Router Core is Running</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; max-width: 600px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; margin-top: 0; font-size: 28px; }
          p { color: #9ca3af; line-height: 1.6; }
          .badge { background: #059669; color: white; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 14px; display: inline-block; margin-bottom: 16px; }
          code { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; }
          .btn { background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">● ONLINE</div>
          <h1>WENKER Router Backend</h1>
          <p>Cổng định tuyến AI mã nguồn mở WENKER đang chạy thành công trên cổng <code>http://localhost:${PORT}</code>!</p>
          <p>Chuẩn OpenAI Base URL: <code>http://localhost:${PORT}/v1</code></p>
          <p>Chuẩn Anthropic Claude Base URL: <code>http://localhost:${PORT}/v1</code></p>
          <p>Hỗ trợ ${db.getAllProviders().length} nhà cung cấp &amp; WENKER Cloud (đọc banner lúc khởi động để biết nguồn đang trỏ tới đâu).</p>
          <a class="btn" href="/health">Kiểm Tra Health Check</a>
        </div>
      </body>
      </html>
    `);
});

// Central error handler: malformed JSON / oversized body / uncaught route errors
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('Request error:', err.message);
  const isAnthropic = req.originalUrl.startsWith('/v1/messages');
  const message = err.type === 'entity.parse.failed'
    ? 'Body request không phải JSON hợp lệ.'
    : err.type === 'entity.too.large'
      ? 'Payload vượt quá giới hạn kích thước của server.'
      : (err.message || 'Internal Server Error');

  if (isAnthropic) {
    return res.status(status).json({ type: "error", error: { type: status >= 500 ? "api_error" : "invalid_request_error", message } });
  }
  res.status(status).json({
    error: {
      message,
      type: status >= 500 ? "internal_error" : "invalid_request_error",
      param: null,
      code: err.type || "internal_error"
    }
  });
});

// Start Server
app.listen(PORT, HOST, () => {
  // In ra MANH HINH trung thuc ve tier mac dinh: no tro thuong nao, da co key chua.
  // Truoc day banner co dinh "100% Free Models Ready (No API Key required)", sai khi
  // WENKER Cloud duoc tro toi nguon phai co key (xkiro/izzi).
  const def = db.getProviderById(db.getSettings().defaultProvider || "wenker-cloud") || db.getProviderById("wenker-cloud");
  let tierLine = "WENKER Cloud:           chua cau hinh nguon";
  if (def) {
    let host = def.baseUrl || "";
    try { host = new URL(def.baseUrl).host; } catch (e) { /* baseUrl co the la template */ }
    const needsKey = def.requiresAuth || def.authType !== "none";
    const keyState = needsKey ? (def.userApiKey || def.userCookie ? "da co key" : "CHUA co key") : "khong can key";
    // Khong cat ngan ten provider: padEnd du rong hon ten dai nhat, khong dung slice().
    const label = `${def.name}: `.padEnd(28);
    tierLine = `${label}${(def.models || []).length} model · nguon ${host || "?"} · ${keyState}`;
  }
  console.log(`
============================================================
       ██╗    ██╗███████╗███╗   ██╗██╗  ██╗███████╗██████╗ 
       ██║    ██║██╔════╝████╗  ██║██║ ██╔╝██╔════╝██╔══██╗
       ██║ █╗ ██║█████╗  ██╔██╗ ██║█████╔╝ █████╗  ██████╔╝
       ██║███╗██║██╔══╝  ██║╚██╗██║██╔═██╗ ██╔══╝  ██╔══██╗
       ╚███╔███╔╝███████╗██║ ╚████║██║  ██╗███████╗██║  ██║
        ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
              Local AI Proxy Router Gateway v2.0
============================================================
  🚀 Core Server Running at: http://localhost:${PORT}
  📡 OpenAI API Base:        http://localhost:${PORT}/v1
  🤖 Anthropic Claude Base:  http://localhost:${PORT}/v1
  🔑 Master Admin Key:       sk-wenker-local-admin
  🆓 Free Playground Key:    sk-wenker-free-playground
  🌐 Total Providers:        ${db.getAllProviders().length} AI Providers Preloaded
  ✨ ${tierLine}
============================================================
  Claude Code Configuration:
  export ANTHROPIC_BASE_URL=http://localhost:${PORT}/v1
  export ANTHROPIC_API_KEY=sk-wenker-local-admin

  Cursor / Cline / OpenWebUI Configuration:
  Base URL: http://localhost:${PORT}/v1
  API Key:  sk-wenker-local-admin
============================================================
  `);
});
