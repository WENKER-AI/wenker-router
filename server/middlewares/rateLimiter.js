/**
 * Rate Limiting Middleware for WENKER Router
 * Tuần 1 - Backend: Thêm Rate Limiting để bảo vệ API khỏi attacks
 * 
 * Features:
 * - 100 requests/phút cho /v1/* endpoints (default)
 * - 30 requests/phút cho /api/* endpoints (admin)
 * - Whitelist loopback (127.0.0.1) cho dev
 * - Custom error response
 * - Per-user rate limiting cho free tier
 * - Priority-based rate limiting (premium vs free)
 * - User-based key generation
 */

const rateLimit = require('express-rate-limit');
const db = require('../services/dbService');
const quota = require('../services/quotaService');

/**
 * Rate Limit Configuration cho các tier khác nhau
 */
const RATE_LIMIT_CONFIG = {
  free: {
    windowMs: 60 * 1000,
    max: 50,
    message: 'Free tier rate limit exceeded',
    code: 'FREE_RATE_LIMIT_EXCEEDED',
  },
  premium: {
    windowMs: 60 * 1000,
    max: 500,
    message: 'Premium tier rate limit exceeded',
    code: 'PREMIUM_RATE_LIMIT_EXCEEDED',
  },
  enterprise: {
    windowMs: 60 * 1000,
    max: 2000,
    message: 'Enterprise tier rate limit exceeded',
    code: 'ENTERPRISE_RATE_LIMIT_EXCEEDED',
  },
  default: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  admin: {
    windowMs: 60 * 1000,
    max: 30,
    message: 'Admin API rate limit exceeded',
    code: 'ADMIN_RATE_LIMIT_EXCEEDED',
  },
  health: {
    windowMs: 15 * 1000,
    max: 10,
    message: 'Health check rate limit exceeded',
    code: 'HEALTH_RATE_LIMIT_EXCEEDED',
  },
};

function getUserKey(req) {
  const apiKey = req.headers['x-wenker-key'] || req.headers['authorization'] || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  if (apiKey && apiKey !== 'sk-wenker-free-playground') {
    const cleanKey = String(apiKey).replace(/^Bearer\s+/i, '').trim();
    return `key:${cleanKey}`;
  }
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  return `free:${ip}:${userAgent.substring(0, 100)}`;
}

function getAdminKey(req) {
  const adminKey = req.headers['x-wenker-admin-key'] || 
                  req.headers['x-wenker-session'] || 
                  req.headers['authorization'] || 
                  req.ip;
  
  if (adminKey) {
    const cleanKey = String(adminKey).replace(/^Bearer\s+/i, '').trim();
    return `admin:${cleanKey}`;
  }
  
  return `admin:${req.ip}`;
}

function getUserTier(req) {
  const apiKey = req.headers['x-wenker-key'] || req.headers['authorization'] || '';
  
  if (apiKey && apiKey !== 'sk-wenker-free-playground') {
    try {
      const cleanKey = String(apiKey).replace(/^Bearer\s+/i, '').trim();
      const validKey = db.validateKey(cleanKey);
      
      if (validKey) {
        if (validKey.role === 'admin') return 'enterprise';
        if (validKey.role === 'premium') return 'premium';
        if (validKey.permissions && validKey.permissions.includes('high_limit')) return 'premium';
        return 'premium';
      }
    } catch (err) {
      // Ignore
    }
  }
  
  // For free tier, check if user has quota remaining
  // This helps prevent one user from consuming all free tier quota
  if (apiKey === 'sk-wenker-free-playground' || !apiKey) {
    // Check quota for anonymous users
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const subject = `anon:${ip}:${userAgent.substring(0, 50)}`;
    
    try {
      const quotaInfo = db.getQuota(subject);
      if (quotaInfo && quotaInfo.exhausted) {
        return 'exhausted'; // Special tier for exhausted quota
      }
    } catch (err) {
      // Ignore
    }
  }
  
  return 'free';
}

function createTieredLimiter(tier, endpointType = 'api') {
  const config = RATE_LIMIT_CONFIG[tier] || RATE_LIMIT_CONFIG.default;
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: true,
    validate: false,
    keyGenerator: (req) => {
      if (endpointType === 'admin') {
        return getAdminKey(req);
      }
      return getUserKey(req);
    },
    handler: (req, res) => {
      const userTier = getUserTier(req);
      const limitConfig = RATE_LIMIT_CONFIG[userTier] || RATE_LIMIT_CONFIG.default;
      
      // Special handling for exhausted free tier
      if (userTier === 'exhausted') {
        return res.status(429).json({
          error: {
            message: 'Hết quota miễn phí hôm nay. Hãy nhập API Key cho OpenRouter/Groq/Gemini/NVIDIA/SambaNova trong tab "Nhà Cung Cấp" để tiếp tục.',
            type: 'rate_limit_exceeded',
            code: 'FREE_QUOTA_EXHAUSTED',
            retryAfter: req.rateLimit.resetTime,
            tier: 'free',
            limit: 0,
            windowMs: config.windowMs,
            hint: 'Xem tab "Nhà Cung Cấp" để nhập free API key từ các nhà cung cấp hỗ trợ.',
          },
        });
      }
      
      res.status(429).json({
        error: {
          message: `${config.message}. Your tier (${userTier}) allows ${limitConfig.max} requests per minute.`,
          type: 'rate_limit_exceeded',
          code: config.code,
          retryAfter: req.rateLimit.resetTime,
          tier: userTier,
          limit: limitConfig.max,
          windowMs: limitConfig.windowMs,
        },
      });
    },
    skip: (req) => {
      if (process.env.NODE_ENV === 'test') return false;
      const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127(\.\d+){3})$/;
      const remote = req.socket.remoteAddress || '';
      return LOOPBACK.test(remote);
    },
  });
}

const apiLimiter = createTieredLimiter('default', 'api');
const adminLimiter = createTieredLimiter('admin', 'admin');
const healthLimiter = createTieredLimiter('health', 'health');

apiLimiter.windowMs = RATE_LIMIT_CONFIG.default.windowMs;
apiLimiter.max = RATE_LIMIT_CONFIG.default.max;
apiLimiter.keyGenerator = getUserKey;

adminLimiter.windowMs = RATE_LIMIT_CONFIG.admin.windowMs;
adminLimiter.max = RATE_LIMIT_CONFIG.admin.max;
adminLimiter.keyGenerator = getAdminKey;

healthLimiter.windowMs = RATE_LIMIT_CONFIG.health.windowMs;
healthLimiter.max = RATE_LIMIT_CONFIG.health.max;

function tieredRateLimiter(endpointType = 'api') {
  return (req, res, next) => {
    const tier = getUserTier(req);
    const limiter = createTieredLimiter(tier, endpointType);
    
    limiter(req, res, (err) => {
      if (err) return;
      next();
    });
  };
}

function createCustomLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs || 60 * 1000,
    max: options.max || 100,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: options.keyGenerator || getUserKey,
    handler: options.handler || ((req, res) => {
      res.status(429).json({
        error: {
          message: options.message || 'Rate limit exceeded',
          type: 'rate_limit_exceeded',
          code: options.code || 'RATE_LIMIT_EXCEEDED',
          retryAfter: req.rateLimit.resetTime,
        },
      });
    }),
    skip: options.skip,
  });
}

function rateLimitLogger(req, res, next) {
  const key = getUserKey(req);
  const tier = getUserTier(req);
  req.rateLimitTier = tier;
  req.rateLimitKey = key;
  next();
}

function getRateLimitStatus(req) {
  const tier = getUserTier(req);
  const key = getUserKey(req);
  const config = RATE_LIMIT_CONFIG[tier] || RATE_LIMIT_CONFIG.default;
  
  return {
    tier,
    key,
    limit: config.max,
    windowMs: config.windowMs,
    message: config.message,
  };
}

module.exports = {
  apiLimiter,
  adminLimiter,
  healthLimiter,
  createTieredLimiter,
  tieredRateLimiter,
  createCustomLimiter,
  rateLimitLogger,
  getRateLimitStatus,
  getUserKey,
  getAdminKey,
  getUserTier,
  RATE_LIMIT_CONFIG,
};
