/**
 * Rate Limiting Middleware for WENKER Router
 * Tuần 1 - Backend: Thêm Rate Limiting để bảo vệ API khỏi attacks
 * TypeScript version - Tuần 2
 * 
 * Features:
 * - 100 requests/phút cho /v1/* endpoints
 * - 30 requests/phút cho /api/* endpoints (admin)
 * - Whitelist loopback (127.0.0.1) cho dev
 * - Custom error response
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiter cho API endpoints (/v1/* - cho clients như Cursor, Claude Code)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 100, // 100 requests/phút
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Sử dụng API key hoặc IP để phân biệt
    return (req.headers['x-wenker-key'] as string) || (req.headers['authorization'] as string) || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      error: {
        message: 'Rate limit exceeded. Please try again later.',
        type: 'rate_limit_exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
      },
    });
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting cho loopback trong dev
    const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127(\.\d+){3})$/;
    const remote = req.socket.remoteAddress || '';
    return LOOPBACK.test(remote);
  },
});

// Rate limiter chặt hơn cho Admin API (/api/*)
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 requests/phút cho admin
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return (req.headers['x-wenker-admin-key'] as string) || (req.headers['x-wenker-session'] as string) || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      error: {
        message: 'Admin API rate limit exceeded. Too many requests.',
        type: 'admin_rate_limit_exceeded',
        code: 'ADMIN_RATE_LIMIT_EXCEEDED',
        retryAfter: req.rateLimit.resetTime,
      },
    });
  },
  skip: (req: Request): boolean => {
    const LOOPBACK = /^(::1|::ffff:127\.0\.0\.1|127(\.\d+){3})$/;
    const remote = req.socket.remoteAddress || '';
    return LOOPBACK.test(remote);
  },
});

// Rate limiter cho Health check (rất nhẹ)
const healthLimiter = rateLimit({
  windowMs: 15 * 1000, // 15 giây
  max: 10, // 10 requests/15s
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      status: 'rate_limited',
      message: 'Health check rate limit exceeded',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

export const RateLimiter = {
  apiLimiter,
  adminLimiter,
  healthLimiter,
};
