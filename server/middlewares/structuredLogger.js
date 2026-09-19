/**
 * Structured Logging Middleware with Correlation IDs
 * Provides consistent logging format with request tracing
 */

const crypto = require('crypto');

/**
 * Generate a correlation ID for request tracing
 * @returns {string} - Unique correlation ID
 */
function generateCorrelationId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Structured logger with consistent format
 */
class StructuredLogger {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'wenker-router';
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.includeTimestamp = options.includeTimestamp !== false;
  }

  _formatLog(level, message, meta = {}) {
    const logEntry = {
      level,
      message,
      service: this.serviceName,
      timestamp: this.includeTimestamp ? new Date().toISOString() : undefined,
      ...meta,
    };
    // Remove undefined values
    Object.keys(logEntry).forEach(key => logEntry[key] === undefined && delete logEntry[key]);
    return logEntry;
  }

  _write(level, message, meta = {}) {
    const logEntry = this._formatLog(level, message, meta);
    const output = JSON.stringify(logEntry);
    
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (this.logLevel === 'debug') console.debug(output);
        break;
      case 'info':
      default:
        console.log(output);
        break;
    }
  }

  error(message, meta) { this._write('error', message, meta); }
  warn(message, meta) { this._write('warn', message, meta); }
  info(message, meta) { this._write('info', message, meta); }
  debug(message, meta) { this._write('debug', message, meta); }
}

/**
 * Express middleware for correlation ID and structured logging
 */
function correlationIdMiddleware(req, res, next) {
  // Get or generate correlation ID
  const correlationId = req.headers['x-correlation-id'] || 
                       req.headers['x-request-id'] || 
                       generateCorrelationId();
  
  // Attach to request and response
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Add to response locals for access in route handlers
  res.locals.correlationId = correlationId;
  
  next();
}

/**
 * Request logging middleware with structured format
 */
function requestLoggerMiddleware(req, res, next) {
  const startTime = Date.now();
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';
  
  // Log incoming request
  const requestLog = {
    correlationId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  };
  
  // Don't log sensitive data
  if (req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // Remove sensitive fields
    delete safeBody.messages;
    delete safeBody.prompt;
    delete safeBody.api_key;
    delete safeBody.authorization;
    delete safeBody.password;
    delete safeBody.token;
    requestLog.bodyKeys = Object.keys(safeBody);
  }
  
  console.log(JSON.stringify({
    level: 'info',
    type: 'request',
    ...requestLog,
    timestamp: new Date().toISOString(),
  }));
  
  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    const responseLog = {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      contentLength: res.get('Content-Length'),
    };
    
    // Log slow requests as warnings
    if (duration > 5000) {
      console.warn(JSON.stringify({
        level: 'warn',
        type: 'slow_request',
        ...responseLog,
        timestamp: new Date().toISOString(),
      }));
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify({
        level: 'warn',
        type: 'error_response',
        ...responseLog,
        timestamp: new Date().toISOString(),
      }));
    } else {
      console.log(JSON.stringify({
        level: 'info',
        type: 'response',
        ...responseLog,
        timestamp: new Date().toISOString(),
      }));
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Error logging middleware
 */
function errorLoggerMiddleware(err, req, res, next) {
  const correlationId = req.correlationId || req.headers['x-correlation-id'] || 'unknown';
  
  console.error(JSON.stringify({
    level: 'error',
    type: 'unhandled_error',
    correlationId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status || err.statusCode,
    },
    timestamp: new Date().toISOString(),
  }));
  
  next(err);
}

/**
 * Create a child logger with additional context
 */
function createChildLogger(baseLogger, context) {
  return {
    error: (message, meta) => baseLogger.error(message, { ...context, ...meta }),
    warn: (message, meta) => baseLogger.warn(message, { ...context, ...meta }),
    info: (message, meta) => baseLogger.info(message, { ...context, ...meta }),
    debug: (message, meta) => baseLogger.debug(message, { ...context, ...meta }),
  };
}

const logger = new StructuredLogger({ serviceName: 'wenker-router' });

module.exports = {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  errorLoggerMiddleware,
  StructuredLogger,
  logger,
  generateCorrelationId,
  createChildLogger,
};