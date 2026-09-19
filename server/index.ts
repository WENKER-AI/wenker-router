/**
 * WENKER Router - Open Source Local AI Proxy Gateway
 * TypeScript version - Tuần 2
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { RateLimiter } from './middlewares/rateLimiter';
import { inputSanitizer } from './middlewares/inputSanitizer';
import { metricsService } from './services/metricsService';
import { PluginManager } from './plugins/pluginManager';

// Import routes
import openaiRouter from './routes/openai';
import anthropicRouter from './routes/anthropic';
import adminRouter from './routes/admin';
import authRouter from './routes/auth';

// Import services
import db from './services/dbService';

// Guard: khi terminal/pipe của stdout bị đóng giữa chừng (chạy nền, đóng cửa sổ
// cmd, hoặc process bị quản lý bởi `pm2`/`systemd`...), mỗi lần console.log có thể
// ném "write EPIPE" -> uncaught exception -> `npm start` chết. Một gateway không
// bao giờ được phép chết chỉ vì ghi log thất bại, nên nhớ bỏ qua lỗi stdout/stderr.
for (const stream of [process.stdout, process.stderr]) {
  if (stream && typeof stream.on === 'function') {
    stream.on('error', (err: Error) => {
      console.warn('[stream] Pipe closed, ignoring error:', err.message);
    });
  }
}

// Bóc globalThis.fetch để mọi request upstream tự động đi qua VPN/HTTP proxy cục bộ
// khi người dùng bật trong Settings (có bypass loopback/private cho model local).
require('./services/proxyFetch').install();

// Kiểm tra npm registry định kỳ: nếu có bản WENKER mới hơn, đẩy sự kiện 'update'
// qua SSE đến TOÀN BỘ dashboard đang mở của server này (banner báo cập nhật).
require('./services/updateService').start();

const app: Express = express();
const settings = db.getSettings();
const PORT = process.env.PORT || settings.port || 3600;
const HOST = process.env.HOST || settings.host || '0.0.0.0';

// Plugin Manager - Tuần 3
const pluginManager = new PluginManager(app);

// Enable CORS for web apps (OpenWebUI, NextChat, Vite, etc.)
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
  })
);

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Input sanitization middleware - Protection against prompt injection, XSS, etc.
app.use(inputSanitizer);

// Metrics middleware - Track all HTTP requests
app.use(metricsService.requestMiddleware());

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
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
  String(process.env.WENKER_ADMIN_OPEN_LOCALHOST || '1')
);

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Login, session check and quota must be reachable before anyone has a token.
  if (req.path === '/auth' || req.path.startsWith('/auth/')) return next();
  const remote = req.socket.remoteAddress || '';
  if (ADMIN_OPEN_LOCALHOST && LOOPBACK.test(remote)) return next();

  // 1) a passcode session from the app's own login gate
  const sessionToken = String(req.headers['x-wenker-session'] || '').trim();
  if (sessionToken && (db as any).validateSession(sessionToken)) return next();

  // 1b) EventSource (Live tail) cannot send headers, so /api/events also accepts the
  // session token via ?token=. Same validation as the header path, nothing weaker.
  if (req.path === '/events') {
    const qs = String(req.query.token || '').trim();
    if (qs && (db as any).validateSession(qs)) return next();
  }

  // 2) an admin API key (for scripts and remote tooling)
  const presented = String(req.headers['x-wenker-admin-key'] || req.headers.authorization || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  const isAdmin = (db as any).getKeys().some((k: any) => k.role === 'admin' && k.isActive && k.key === presented);
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

// API Routes - Tuần 1: Áp dụng Rate Limiting
app.use('/v1', RateLimiter.apiLimiter, openaiRouter);
app.use('/v1', RateLimiter.apiLimiter, anthropicRouter);
app.use('/api', RateLimiter.adminLimiter, adminRouter);
app.use('/api/auth', authRouter); // Auth không bị rate limit để đăng nhập được

// Plugin Routes - Tuần 3
import {
  requirePluginAdmin,
  verifyPluginSignature,
  pluginRateLimiter,
  pluginAuditLogger,
} from './middlewares/pluginAuth';

// Load plugins từ thư mục
pluginManager.loadPluginsFromDirectory(path.join(__dirname, '..', 'plugins')).catch((err) => {
  console.error('[PluginManager] Lỗi load plugins:', err);
});

// Plugin API routes - với authentication
// GET /api/plugins - Xem danh sách (chỉ admin)
app.get(
  '/api/plugins',
  RateLimiter.adminLimiter,
  requirePluginAdmin,
  pluginAuditLogger,
  (req: Request, res: Response) => {
    const plugins = pluginManager.getPlugins();
    res.json({
      plugins: plugins.map((p) => p.config),
      count: plugins.length,
    });
  }
);

// POST /api/plugins/:id/register - Đăng ký plugin mới (yêu cầu admin + signature)
app.post(
  '/api/plugins/:id/register',
  RateLimiter.adminLimiter,
  pluginRateLimiter,
  requirePluginAdmin,
  verifyPluginSignature,
  pluginAuditLogger,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { pluginData } = req.body;
    
    if (!pluginData) {
      return res.status(400).json({
        error: {
          message: 'Plugin data is required',
          type: 'invalid_request_error',
          code: 'missing_plugin_data',
        },
      });
    }
    
    try {
      // TODO: Implement actual plugin registration from data
      // Hiện tại chỉ trả về success
      console.log(`[PluginAPI] Registered plugin ${id} by admin ${req.pluginAdminUser?.id}`);
      
      res.json({
        message: `Plugin ${id} registered successfully`,
        pluginId: id,
        admin: req.pluginAdminUser?.id,
      });
    } catch (error) {
      console.error('[PluginAPI] Register error:', error);
      res.status(500).json({
        error: {
          message: (error as Error).message,
          type: 'internal_error',
          code: 'plugin_registration_failed',
        },
      });
    }
  }
);

// POST /api/plugins/:id/unregister - Gỡ plugin (yêu cầu admin)
app.post(
  '/api/plugins/:id/unregister',
  RateLimiter.adminLimiter,
  pluginRateLimiter,
  requirePluginAdmin,
  pluginAuditLogger,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      await pluginManager.unregisterPlugin(id);
      console.log(`[PluginAPI] Unregistered plugin ${id} by admin ${req.pluginAdminUser?.id}`);
      res.json({
        message: `Plugin ${id} unregistered successfully`,
        pluginId: id,
        admin: req.pluginAdminUser?.id,
      });
    } catch (error) {
      res.status(404).json({
        error: {
          message: (error as Error).message,
          type: 'not_found_error',
          code: 'plugin_not_found',
        },
      });
    }
  }
);

// Unknown /v1/* endpoints -> clean OpenAI-style JSON error (not an HTML stack trace)
app.all('/v1/*', (req: Request, res: Response) => {
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
app.get('/health', RateLimiter.healthLimiter, (req: Request, res: Response) => {
  res.json({
    status: 'online',
    app: 'WENKER Router',
    version: PKG.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    metrics: metricsService.getHealthStatus(),
  });
});

// Prometheus metrics endpoint
app.get('/metrics', metricsService.getMetricsEndpoint());

// =============================================================================
// P2P NETWORK MODULE - GoGo Code Combo Feature
// =============================================================================

// Import P2P module
let p2pModule: any = null;

// Initialize P2P module
const initP2P = async () => {
  try {
    // Only enable P2P if WENKER_P2P_ENABLED is set (opt-in for now)
    const p2pEnabled = process.env.WENKER_P2P_ENABLED === 'true' ||
      (process.env.WENKER_P2P_ENABLED !== 'false' && process.env.NODE_ENV === 'development');
    
    if (p2pEnabled) {
      const p2pPort = parseInt(process.env.WENKER_P2P_PORT || '11435');
      const { initP2P } = require('./p2p/src/index');
      p2pModule = await initP2P({
        enabled: true,
        port: p2pPort,
        listenAddresses: [
          `/ip4/0.0.0.0/tcp/${p2pPort}`,
          `/ip6/::/tcp/${p2pPort}`,
        ],
      });
      
      // Start P2P network
      await p2pModule.start();
      
      // Log P2P status
      const p2pStatus = p2pModule.getStatus();
      console.log('[P2P] WENKER P2P Network enabled');
      console.log(`[P2P] Node ID: ${p2pStatus.nodeId}`);
      console.log(`[P2P] Listening on port: ${p2pPort}`);
      
      // Update P2P with initial models and providers
      p2pModule.updateModels(db.getAllModels().map(m => ({
        id: m.id,
        name: m.name,
        type: 'local',
        available: true,
      })));
      
      p2pModule.updateProviders(db.getAllProviders().map(p => ({
        name: p.id,
        status: 'up',
        latency: 0,
      })));
    }
  } catch (error) {
    console.warn('[P2P] Failed to initialize P2P module:', error);
  }
};

// Call P2P init (but don't block startup)
initP2P().catch(() => {});

// P2P API Endpoints
app.get('/api/p2p/status', async (req: Request, res: Response) => {
  try {
    if (!p2pModule) {
      return res.json({
        enabled: false,
        error: 'P2P module not initialized',
      });
    }
    
    const status = p2pModule.getStatus();
    const stats = p2pModule.getStats();
    const blacklist = p2pModule.getBlacklist();
    const peers = p2pModule.swarmManager.getPeers();
    
    res.json({
      enabled: true,
      nodeId: status.nodeId,
      peerCount: stats.peerCount,
      connectedPeers: stats.connectedPeers,
      listenAddresses: status.listenAddresses,
      messagesSent: stats.messagesSent,
      messagesReceived: stats.messagesReceived,
      blacklistSize: stats.blacklistSize,
      sharedModels: stats.sharedModels,
      blacklist,
      peers: peers.map((p: any) => ({
        id: p.id,
        address: p.address,
        models: p.models.length,
        providers: p.providers.length,
        lastSeen: p.lastSeen,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get P2P status',
      details: error,
    });
  }
});

// Get P2P blacklist
app.get('/api/p2p/blacklist', async (req: Request, res: Response) => {
  try {
    if (!p2pModule) {
      return res.json({ enabled: false, blacklist: [] });
    }
    
    const blacklist = p2pModule.getBlacklist();
    res.json({ blacklist });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get blacklist' });
  }
});

// Report dead provider/model to P2P network
app.post('/api/p2p/report-dead', async (req: Request, res: Response) => {
  try {
    if (!p2pModule) {
      return res.json({ success: false, error: 'P2P not enabled' });
    }
    
    const { id, type, reason } = req.body;
    
    if (!id || !type) {
      return res.status(400).json({ error: 'id and type are required' });
    }
    
    p2pModule.reportDead(id, type, reason || 'Unknown error');
    
    res.json({ success: true, message: 'Dead item reported to swarm' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to report dead item' });
  }
});

// Check if model is available in swarm
app.get('/api/p2p/models/:modelId/available', async (req: Request, res: Response) => {
  try {
    if (!p2pModule) {
      return res.json({ available: false, error: 'P2P not enabled' });
    }
    
    const { modelId } = req.params;
    const available = p2pModule.isModelAvailable(modelId);
    const bestModel = p2pModule.getBestModel(modelId);
    
    res.json({
      available,
      model: bestModel,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check model availability' });
  }
});

// Get all available models in swarm
app.get('/api/p2p/models', async (req: Request, res: Response) => {
  try {
    if (!p2pModule) {
      return res.json({ models: [], error: 'P2P not enabled' });
    }
    
    const models = p2pModule.swarmManager.getAllAvailableModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get swarm models' });
  }
});

// =============================================================================

// Serve frontend static build if available
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Trang giới thiệu/markdown tĩnh (web/) được phục vụ dưới /wenker để không đụng
// asset của dashboard (dashboard chiếm /assets/*).
const webPath = path.join(__dirname, '..', 'web');
app.use('/wenker', express.static(webPath));
app.get('/wenker', (req: Request, res: Response) => res.redirect('/wenker/'));

const clientIndex = path.join(clientDistPath, 'index.html');
const notFoundPage = path.join(webPath, '404.html');

// Fallback cho SPA: chỉ những đường dẫn "giống trang" (không có phần mở rộng)
// mới được đưa về index.html để React tự xử lý tab.
app.get('*', (req: Request, res: Response) => {
  if (/\.[a-z0-9]{1,10}$/i.test(req.path)) {
    return res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>404</title>' +
          '<style>body{font-family:system-ui;background:#05070f;color:#eaf2ff;display:grid;place-items:center;height:100vh;margin:0}' +
          'a{color:#7ee787}</style></head><body><div style="text-align:center"><h1>Off. 404</h1>' +
          '<p>Không tìm thấy tài nguyên này.</p><p><a href="/wenker/404.html">Chơi mini game cá voi</a> · <a href="/">Về dashboard</a></p></div></body></html>'
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
          <p>Hỗ trợ ${db.getAllProviders().length} nhà cung cấp & WENKER Cloud (đọc banner lúc khởi động để biết nguồn đang trỏ tới đâu).</p>
          <a class="btn" href="/health">Kiểm Tra Health Check</a>
        </div>
      </body>
      </html>
    `);
});

// Central error handler: malformed JSON / oversized body / uncaught route errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status >= 500) console.error('Request error:', err.message);
  const isAnthropic = req.originalUrl.startsWith('/v1/messages');
  const message =
    err.type === 'entity.parse.failed'
      ? 'Body request không phải JSON hợp lệ.'
      : err.type === 'entity.too.large'
        ? 'Payload vượt quá giới hạn kích thước của server.'
        : err.message || 'Internal Server Error';

  if (isAnthropic) {
    return res
      .status(status)
      .json({
        type: 'error',
        error: { type: status >= 500 ? 'api_error' : 'invalid_request_error', message },
      });
  }
  res.status(status).json({
    error: {
      message,
      type: status >= 500 ? 'internal_error' : 'invalid_request_error',
      param: null,
      code: err.type || 'internal_error',
    },
  });
});

// Start Server
app.listen(PORT, HOST, () => {
  // In ra MANH HINH trung thực về tier mặc định: no tro thuong nao, da co key chua.
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
      // Use hostname + port only — never .host which can contain credentials
      host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');
    } catch (e) {
      // Mask any credentials in raw URL before logging
      const safe = (def.baseUrl || '').replace(/:\/\/[^@]+@/, '://***@');
      console.warn('[config] Invalid baseUrl, keeping template:', safe);
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
});

export default app;
