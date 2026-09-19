const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./services/dbService');

const openaiRouter = require('./routes/openai');
const anthropicRouter = require('./routes/anthropic');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

// Rate Limiting Middleware - Tuần 1
const { apiLimiter, adminLimiter, healthLimiter } = require('./middlewares/rateLimiter');
// Input Sanitization Middleware - Tuần 1: Prompt injection protection
const { inputSanitizer } = require('./middlewares/inputSanitizer');
// Plugin Auth Middleware - Tuần 1: Protect plugin endpoints
const { requirePluginAdmin, verifyPluginSignature, pluginRateLimiter, pluginAuditLogger } = require('./middlewares/pluginAuth');
// Structured Logging Middleware - Tuần 2: Correlation IDs and structured logs
const { correlationIdMiddleware, requestLoggerMiddleware, errorLoggerMiddleware } = require('./middlewares/structuredLogger');
// Error Formatter - Tuần 2: Standardized error responses
const { standardizedErrorHandler, responseFormatter } = require('./middlewares/errorFormatter');

// Guard: khi terminal/pipe cua stdout bi dong giua chung (chay nen, dong cua so
// cmd, hoac process bi quan ly boi `pm2`/`systemd`...), moi lan console.log co the
// nem "write EPIPE" -> uncaught exception -> `npm start` chet. Mot gateway khong
// bao gio duoc phep chet chi vi ghi log that bai, nen nho bo qua loi stdout/stderr.
for (const stream of [process.stdout, process.stderr]) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', (err) => {
      console.warn('[stream] Pipe closed, ignoring error:', err.message);
    });
  }
}

// Boc globalThis.fetch de moi request upstream tu dong di qua VPN/HTTP proxy cuc bo
// khi nguoi dung bat trong Settings (co bypass loopback/private cho model local).
require('./services/proxyFetch').install();

// Kiem tra npm registry dinh ky: neu co ban WENKER moi hon, day su kien 'update'
// qua SSE den TOAN BO dashboard dang mo cua server nay (banner bao cap nhat).
require('./services/updateService').start();

// Proactive Health Checker - Tuần 2: Background provider health monitoring
const proactiveHealthChecker = require('./services/proactiveHealthChecker');

const app = express();
const settings = db.getSettings();
const PORT = process.env.PORT || settings.port || 3600;
const HOST = process.env.HOST || settings.host || '0.0.0.0';

// Enable CORS for web apps (OpenWebUI, NextChat, Vite, etc.)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
  }),
);

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Response Formatter - Tuần 2: Standardized response format
app.use(responseFormatter);

// Structured Logging - Tuần 2: Correlation IDs and structured logs
app.use(correlationIdMiddleware);
app.use(requestLoggerMiddleware);

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
const ADMIN_OPEN_LOCALHOST = !/^(0|false)$/i.test(
  String(process.env.WENKER_ADMIN_OPEN_LOCALHOST || '1'),
);

app.use('/api', (req, res, next) => {
  // Login, session check and quota must be reachable before anyone has a token.
  if (req.path === '/auth' || req.path.startsWith('/auth/')) return next();
  const remote = req.socket.remoteAddress || '';
  if (ADMIN_OPEN_LOCALHOST && LOOPBACK.test(remote)) return next();

  // 1) a passcode session from the app's own login gate
  const sessionToken = String(req.headers['x-wenker-session'] || '').trim();
  if (sessionToken && db.validateSession(sessionToken)) return next();

  // 1b) EventSource (Live tail) cannot send headers, so /api/events also accepts the
  // session token via ?token=. Same validation as the header path, nothing weaker.
  if (req.path === '/events') {
    const qs = String(req.query.token || '').trim();
    if (qs && db.validateSession(qs)) return next();
  }

  // 2) an admin API key (for scripts and remote tooling)
  const presented = String(req.headers['x-wenker-admin-key'] || req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const isAdmin = db.getKeys().some((k) => k.role === 'admin' && k.isActive && k.key === presented);
  if (isAdmin) return next();

  return res.status(401).json({
    error: {
      message:
        'API quan tri chi chap nhan tu may chu local. Dang nhap vao WENKER hoac gui header "x-wenker-admin-key: <key admin>"; dat WENKER_ADMIN_OPEN_LOCALHOST=0 de bat buoc cho ca local.',
      type: 'authentication_error',
      code: 'admin_key_required',
    },
  });
});

// API Routes - Tuần 1: Áp dụng Rate Limiting + Input Sanitization
app.use('/v1', apiLimiter, inputSanitizer, openaiRouter);
app.use('/v1', apiLimiter, inputSanitizer, anthropicRouter);
app.use('/api', adminLimiter, adminRouter);
app.use('/api/auth', authRouter); // Auth không bị rate limit để đăng nhập được

// Plugin Routes - Tuần 1: Yêu cầu admin authentication
app.get('/api/plugins', adminLimiter, requirePluginAdmin, pluginAuditLogger, (req, res) => {
  res.json({
    plugins: [],
    count: 0,
    message: 'Plugin system not fully implemented in JS version. See server/index.ts for full implementation.',
  });
});

app.post('/api/plugins/:id/register', adminLimiter, pluginRateLimiter, requirePluginAdmin, verifyPluginSignature, pluginAuditLogger, (req, res) => {
  res.status(501).json({
    error: {
      message: 'Plugin registration not implemented in JS version. See server/index.ts for full implementation.',
      type: 'not_implemented',
      code: 'plugin_registration_not_implemented',
    },
  });
});

app.post('/api/plugins/:id/unregister', adminLimiter, pluginRateLimiter, requirePluginAdmin, pluginAuditLogger, (req, res) => {
  res.status(501).json({
    error: {
      message: 'Plugin unregistration not implemented in JS version. See server/index.ts for full implementation.',
      type: 'not_implemented',
      code: 'plugin_unregistration_not_implemented',
    },
  });
});

// Unknown /v1/* endpoints -> clean OpenAI-style JSON error (not an HTML stack trace)
app.all('/v1/*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Không hỗ trợ endpoint ${req.method} ${req.originalUrl}. khả dụng: /v1/chat/completions, /v1/messages, /v1/models, /v1/embeddings.`,
      type: 'invalid_request_error',
      param: null,
      code: 'unsupported_endpoint',
    },
  });
});

// Health check endpoint - Tuần 1: Rate Limiting
const PKG = require('../package.json');
app.get('/health', healthLimiter, (req, res) => {
  res.json({
    status: 'online',
    app: 'WENKER Router',
    version: PKG.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Prometheus Metrics Endpoint - Tuần 2
const metricsService = require('./services/metricsService');
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsService.getContentType());
    res.send(await metricsService.getMetrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Metrics as JSON for debugging
app.get('/metrics/json', async (req, res) => {
  try {
    res.json(await metricsService.getMetricsAsJson());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend static build if available
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Trang giới thiệu/markdown tĩnh (web/) được phục vụ dưới /wenker để không đụng
// asset của dashboard (dashboard chiếm /assets/*).
const webPath = path.join(__dirname, '..', 'web');
app.use('/wenker', express.static(webPath));
app.get('/wenker', (req, res) => res.redirect('/wenker/'));

const fs = require('fs');
const clientIndex = path.join(clientDistPath, 'index.html');
const notFoundPage = path.join(webPath, '404.html');

// Fallback cho SPA: chỉ những đường dẫn "giống trang" (không có phần mở rộng)
// mới được đưa về index.html để React tự xử lý tab.
app.get('*', (req, res) => {
  if (/\.[a-z0-9]{1,10}$/i.test(req.path)) {
    return res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>404</title>' +
          '<style>body{font-family:system-ui;background:#05070f;color:#eaf2ff;display:grid;place-items:center;height:100vh;margin:0}' +
          'a{color:#7ee787}</style></head><body><div style="text-align:center"><h1>Off. 404</h1>' +
          '<p>Không tìm thấy tài nguyên này.</p><p><a href="/wenker/404.html">Chơi mini game cá voi</a> · <a href="/">Về dashboard</a></p></div></body></html>,'
      );
  }
  if (fs.existsSync(clientIndex)) {
    // Đường dẫn lạ (không phải asset, không phải "/") -> trang 404 pixel có mini game.
    // Dashboard là SPA thuần state (không có client-side routing theo path), nên
    // không cần đẩy mọi path về index.html; path sai nên trả 404 thật.
    if (req.path !== '/' && fs.existsSync(notFoundPage)) {
      let html = fs.readFileSync(notFoundPage, 'utf8');
      html = html.replace('<head>', '<head><base href="/wenker/">');
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

// Error Logger Middleware - Tuần 2: Structured error logging
app.use(errorLoggerMiddleware);

// Standardized Error Handler - Tuần 2: Consistent error format
app.use(standardizedErrorHandler);

// Start Server
app.listen(PORT, HOST, () => {
  // In ra MANH HINH trung thuc ve tier mac dinh: no tro thuong nao, da co key chua.
  // Truoc day banner co dinh "100% Free Models Ready (No API Key required)", sai khi
  // WENKER Cloud duoc tro toi nguon phai co key (xkiro/izzi).
  const def =
    db.getProviderById(db.getSettings().defaultProvider || 'wenker-cloud') ||
    db.getProviderById('wenker-cloud');
  let tierLine = 'WENKER Cloud:           chua cau hinh nguon';
  if (def) {
    let host = def.baseUrl || '';
    try {
      const parsed = new URL(def.baseUrl);
      host = parsed.hostname + (parsed.port ? `:${parsed.port}` : '');
    } catch (e) {
      host = String(def.baseUrl || '').replace(/:\/\/[^@]+@/, '://***@');
    }
    const needsKey = def.requiresAuth || def.authType !== 'none';
    const keyState = needsKey
      ? def.userApiKey || def.userCookie
        ? 'da co key'
        : 'CHUA co key'
      : 'khong can key';
    // Khong cat ngan ten provider: padEnd du rong hon ten dai nhat, khong dung slice().
    const label = `${def.name}: `.padEnd(28);
    tierLine = `${label}${(def.models || []).length} model · nguon ${host || '?'} · ${keyState}`;
  }
console.log(`
============================================================
     ██╗    ██╗███████╗███╗   ██╗██╗  ██╗███████╗██████╗ 
     ██║    ██║██╔════╝████╗  ██║██║ ██╔╝██╔════╝██╔══██╗
     ██║ █╗ ██║█████╗  ██╔██╗ ██║█████╔╝ █████╗  ██████╔╝
     ██║███╗██║██╔══╝  ██║╚██╗██║██╔═██╗ ██╔══╝  ██╔══██╗
     ╚███╔███╔╝███████╗██║ ╚████║██║  ██╗███████╗██║  ██║
      ╚══╝╚══╝ ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
            Local AI Proxy Router Gateway v${PKG.version}
============================================================
  Core Server Running at:    http://localhost:${PORT}
  OpenAI API Base:           http://localhost:${PORT}/v1
  Anthropic Claude Base:     http://localhost:${PORT}/v1
  Master Admin Key:          [HIDDEN - set via WENKER_ADMIN_KEY env var]
  Free Playground Key:       [HIDDEN - built-in fallback]
  Total Providers:           ${db.getAllProviders().length} AI Providers Preloaded
  ${tierLine}
============================================================
  Claude Code Configuration:
  export ANTHROPIC_BASE_URL=http://localhost:${PORT}/v1
  export ANTHROPIC_API_KEY=[USE YOUR KEY HERE]

  Cursor / Cline / OpenWebUI Configuration:
  Base URL: http://localhost:${PORT}/v1
  API Key:  [USE YOUR KEY HERE]
============================================================
  `);

  // Initialize and start proactive health checker
  proactiveHealthChecker.init(db.getSettings());
  proactiveHealthChecker.start();
});
