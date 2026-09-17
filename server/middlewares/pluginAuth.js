/**
 * Plugin Authentication Middleware for WENKER Router
 * 
 * Bảo vệ các plugin API endpoints khỏi truy cập trái phép
 */

const db = require('../services/dbService');

/**
 * Middleware để verify admin key cho plugin operations
 * Chỉ cho phép admin users đăng ký/gỡ plugin
 */
function requirePluginAdmin(req, res, next) {
  try {
    // Lấy admin key từ headers
    const adminKey = req.headers['x-wenker-admin-key'] || 
                     req.headers['x-api-key'] || 
                     req.headers['authorization'];
    
    if (!adminKey) {
      return res.status(401).json({
        error: {
          message: 'Admin API key is required for plugin operations',
          type: 'authentication_error',
          code: 'admin_key_required',
        },
      });
    }
    
    // Remove Bearer prefix nếu có
    const cleanKey = String(adminKey).replace(/^Bearer\s+/i, '').trim();
    
    // Validate key
    const keys = db.getKeys();
    const isAdmin = keys.some(
      (k) => k.role === 'admin' && k.isActive && k.key === cleanKey
    );
    
    if (!isAdmin) {
      return res.status(403).json({
        error: {
          message: 'Invalid or insufficient permissions for plugin operations',
          type: 'authentication_error',
          code: 'insufficient_permissions',
        },
      });
    }
    
    // Gắn admin key vào request cho các middleware sau
    req.pluginAdminKey = cleanKey;
    req.pluginAdminUser = keys.find(k => k.key === cleanKey);
    
    next();
  } catch (err) {
    console.error('[PluginAuth] Authentication error:', err);
    res.status(500).json({
      error: {
        message: 'Internal authentication error',
        type: 'internal_error',
        code: 'authentication_error',
      },
    });
  }
}

/**
 * Middleware để verify plugin signature (nếu có)
 * Cho phép plugins được ký và verify trước khi load
 */
function verifyPluginSignature(req, res, next) {
  try {
    const { id } = req.params;
    const { signature, pluginData } = req.body;
    
    // Nếu không có signature, skip (cho phép plugins không ký)
    if (!signature || !pluginData) {
      return next();
    }
    
    // TODO: Implement signature verification logic
    // Đây là placeholder cho verification logic thật
    // Ví dụ: verify với private key, checksum, v.v.
    
    console.log(`[PluginAuth] Verifying signature for plugin ${id}`);
    
    // Tạm thời chỉ log
    // Trong tương lai:
    // const isValid = crypto.verify(
    //   'sha256',
    //   Buffer.from(signature, 'hex'),
    //   privateKey,
    //   Buffer.from(pluginData)
    // );
    
    // if (!isValid) {
    //   return res.status(403).json({
    //     error: {
    //       message: 'Invalid plugin signature',
    //       type: 'security_error',
    //       code: 'invalid_signature',
    //     },
    //   });
    // }
    
    next();
  } catch (err) {
    console.error('[PluginAuth] Signature verification error:', err);
    res.status(500).json({
      error: {
        message: 'Signature verification failed',
        type: 'internal_error',
        code: 'signature_verification_failed',
      },
    });
  }
}

/**
 * Middleware để check plugin permissions
 * Một số plugins có thể yêu cầu permissions đặc biệt
 */
function checkPluginPermissions(requiredPermissions = []) {
  return (req, res, next) => {
    try {
      // Nếu không có required permissions, skip
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return next();
      }
      
      const adminUser = req.pluginAdminUser;
      
      // Kiểm tra nếu admin user có các permission cần
      const hasAllPermissions = requiredPermissions.every(perm => {
        return adminUser && adminUser.permissions && 
               adminUser.permissions.includes(perm);
      });
      
      if (!hasAllPermissions) {
        return res.status(403).json({
          error: {
            message: `Missing required permissions: ${requiredPermissions.join(', ')}`,
            type: 'authentication_error',
            code: 'missing_permissions',
          },
        });
      }
      
      next();
    } catch (err) {
      console.error('[PluginAuth] Permission check error:', err);
      res.status(500).json({
        error: {
          message: 'Permission check failed',
          type: 'internal_error',
          code: 'permission_check_failed',
        },
      });
    }
  };
}

/**
 * Middleware để rate limit plugin operations
 * Tránh brute force attacks
 */
const pluginRateLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000, // 1 phút
  max: 10, // 10 requests/phút cho plugin operations
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.pluginAdminKey || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Plugin operation rate limit exceeded. Please try again later.',
        type: 'rate_limit_exceeded',
        code: 'PLUGIN_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
      },
    });
  },
  skip: (req) => {
    // Skip cho loopback
    const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127(\._\d+){3})$/;
    const remote = req.socket.remoteAddress || '';
    return LOOPBACK.test(remote);
  },
});

/**
 * Audit logging middleware cho plugin operations
 */
function pluginAuditLogger(req, res, next) {
  const startTime = Date.now();
  const originalSend = res.json;
  
  res.json = function(body) {
    const duration = Date.now() - startTime;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: req.path,
      method: req.method,
      adminKey: req.pluginAdminKey ? '***REDACTED***' : 'none',
      adminUser: req.pluginAdminUser?.id || 'unknown',
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
    };
    
    // Log thành công
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log(`[PluginAudit] SUCCESS: ${req.method} ${req.path}`, logEntry);
    } else {
      console.warn(`[PluginAudit] FAILED: ${req.method} ${req.path}`, logEntry);
    }
    
    // Gọi original send
    return originalSend.call(this, body);
  };
  
  next();
}

module.exports = {
  requirePluginAdmin,
  verifyPluginSignature,
  checkPluginPermissions,
  pluginRateLimiter,
  pluginAuditLogger,
};
