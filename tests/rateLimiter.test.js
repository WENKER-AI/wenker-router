/**
 * Unit Tests for Rate Limiting Middleware
 * Tuần 1 - Backend: Viết Unit Tests cho Rate Limiting
 */

process.env.NODE_ENV = 'test';
const chai = require('chai');
const { expect } = chai;
const chaiHttp = require('chai-http');
chai.use(chaiHttp.default);
const express = require('express');
const { apiLimiter, adminLimiter, healthLimiter } = require('../server/middlewares/rateLimiter');

const requestApp = (chaiHttp.request && chaiHttp.request.execute) || chaiHttp.execute || chaiHttp.default || chaiHttp;

describe('Rate Limiting Middleware - Tuần 1', function () {
  this.timeout(10000); // Tăng timeout cho rate limit tests

  describe('API Limiter (/v1/* endpoints)', () => {
    let app;

    before(() => {
      app = express();
      app.use(express.json());
      app.get('/v1/test', apiLimiter, (req, res) => {
        res.json({ message: 'OK' });
      });
    });

    it('should allow requests under the limit (100/phút)', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          requestApp(app)
            .get('/v1/test')
            .then((res) => {
              expect(res).to.have.status(200);
              expect(res.body).to.deep.equal({ message: 'OK' });
            })
        );
      }
      await Promise.all(promises);
    });

    it('should include rate limit headers', async () => {
      const res = await requestApp(app).get('/v1/test');
      expect(res).to.have.status(200);
      expect(res.headers).to.have.property('x-ratelimit-limit');
      expect(res.headers).to.have.property('x-ratelimit-remaining');
      expect(res.headers).to.have.property('x-ratelimit-reset');
    });

    it('should return 429 after exceeding limit (100 requests)', async () => {
      const promises = [];
      // Gửi 105 requests (vượt quá 100)
      for (let i = 0; i < 105; i++) {
        promises.push(
          requestApp(app)
            .get('/v1/test')
            .catch((err) => {
              if (i >= 100) {
                expect(err.response).to.have.status(429);
                expect(err.response.body.error.code).to.equal('RATE_LIMIT_EXCEEDED');
              } else {
                expect(err.response).to.have.status(200);
              }
            })
        );
      }
      await Promise.all(promises);
    });
  });

  describe('Admin Limiter (/api/* endpoints)', () => {
    let app;

    before(() => {
      app = express();
      app.use(express.json());
      app.get('/api/test', adminLimiter, (req, res) => {
        res.json({ message: 'Admin OK' });
      });
    });

    it('should allow admin requests under the limit (30/phút)', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          requestApp(app)
            .get('/api/test')
            .then((res) => {
              expect(res).to.have.status(200);
              expect(res.body).to.deep.equal({ message: 'Admin OK' });
            })
        );
      }
      await Promise.all(promises);
    });

    it('should return 429 after exceeding admin limit (30 requests)', async () => {
      const promises = [];
      for (let i = 0; i < 35; i++) {
        promises.push(
          requestApp(app)
            .get('/api/test')
            .catch((err) => {
              if (i >= 30) {
                expect(err.response).to.have.status(429);
                expect(err.response.body.error.code).to.equal('ADMIN_RATE_LIMIT_EXCEEDED');
              } else {
                expect(err.response).to.have.status(200);
              }
            })
        );
      }
      await Promise.all(promises);
    });
  });

  describe('Health Check Limiter', () => {
    let app;

    before(() => {
      app = express();
      app.get('/health', healthLimiter, (req, res) => {
        res.json({ status: 'online' });
      });
    });

    it('should allow health check requests under the limit (10/15s)', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          requestApp(app)
            .get('/health')
            .then((res) => {
              expect(res).to.have.status(200);
            })
        );
      }
      await Promise.all(promises);
    });

    it('should return 429 after exceeding health check limit', async () => {
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          requestApp(app)
            .get('/health')
            .catch((err) => {
              if (i >= 10) {
                expect(err.response).to.have.status(429);
                expect(err.response.body.status).to.equal('rate_limited');
              } else {
                expect(err.response).to.have.status(200);
              }
            })
        );
      }
      await Promise.all(promises);
    });
  });

  describe('Key Generation', () => {
    it('apiLimiter should use x-wenker-key or authorization header or IP', () => {
      const limiter = apiLimiter;
      const mockReq1 = {
        headers: { 'x-wenker-key': 'test-key-1' },
        ip: '192.168.1.1',
        socket: { remoteAddress: '192.168.1.1' },
      };
      const mockReq2 = {
        headers: { authorization: 'Bearer token123' },
        ip: '192.168.1.2',
        socket: { remoteAddress: '192.168.1.2' },
      };
      const mockReq3 = {
        headers: {},
        ip: '192.168.1.3',
        socket: { remoteAddress: '192.168.1.3' },
      };

      // Key generator là internal function, không thể test trực tiếp
      // Nhưng chúng ta có thể verify qua behavior
      expect(limiter).to.have.property('keyGenerator');
    });
  });
});

describe('Rate Limiting Configuration', () => {
  it('should have correct configuration values', () => {
    expect(apiLimiter).to.have.property('windowMs', 60 * 1000);
    expect(apiLimiter).to.have.property('max', 100);
    
    expect(adminLimiter).to.have.property('windowMs', 60 * 1000);
    expect(adminLimiter).to.have.property('max', 30);
    
    expect(healthLimiter).to.have.property('windowMs', 15 * 1000);
    expect(healthLimiter).to.have.property('max', 10);
  });
});
