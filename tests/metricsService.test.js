/**
 * Unit Tests for Metrics Service
 */

process.env.NODE_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http').default;
chai.use(chaiHttp);
const { expect } = chai;
const express = require('express');
const metricsService = require('../server/services/metricsService');

describe('Metrics Service', function () {
  
  describe.skip('requestMiddleware (chai-http v5 compat)', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(express.json());
      app.use(metricsService.requestMiddleware());
      app.get('/test', (req, res) => {
        res.json({ message: 'OK' });
      });
      app.post('/test', (req, res) => {
        res.json({ message: 'Created' });
      });
    });
    
    it('should track HTTP requests', async () => {
      const res = await chaiHttp(app).get('/test');
      expect(res).to.have.status(200);
    });
    
    it('should track POST requests', async () => {
      const res = await chaiHttp(app)
        .post('/test')
        .send({ data: 'test' });
      expect(res).to.have.status(200);
    });
  });
  
  describe('recordChatCompletion', () => {
    it('should record chat completion metrics', () => {
      expect(() => {
        metricsService.recordChatCompletion({
          provider: 'openrouter',
          model: 'deepseek/deepseek-r1:free',
          status: 'success',
          stream: false,
          durationMs: 1500,
          promptTokens: 100,
          completionTokens: 200,
        });
      }).to.not.throw();
    });
    
    it('should handle missing optional fields', () => {
      expect(() => {
        metricsService.recordChatCompletion({
          provider: 'openrouter',
        });
      }).to.not.throw();
    });
  });
  
  describe('recordProviderHealth', () => {
    it('should record provider health', () => {
      expect(() => {
        metricsService.recordProviderHealth('openrouter', 'OpenRouter', true, 500);
      }).to.not.throw();
    });
    
    it('should handle unhealthy provider', () => {
      expect(() => {
        metricsService.recordProviderHealth('pollinations', 'Pollinations', false, null);
      }).to.not.throw();
    });
  });
  
  describe('recordCacheHit', () => {
    it('should record cache hits', () => {
      expect(() => {
        metricsService.recordCacheHit(true);
        metricsService.recordCacheHit(false);
      }).to.not.throw();
    });
  });
  
  describe('recordCircuitBreakerState', () => {
    it('should record circuit breaker states', () => {
      expect(() => {
        metricsService.recordCircuitBreakerState('openrouter', 'CLOSED');
        metricsService.recordCircuitBreakerState('pollinations', 'OPEN');
        metricsService.recordCircuitBreakerState('groq', 'HALF_OPEN');
      }).to.not.throw();
    });
  });
  
  describe('recordFallback', () => {
    it('should record fallback activations', () => {
      expect(() => {
        metricsService.recordFallback('pollinations', 'openrouter', 'upstream_http_402');
      }).to.not.throw();
    });
  });
  
  describe('recordError', () => {
    it('should record errors', () => {
      expect(() => {
        metricsService.recordError('upstream_error', '402', '/v1/chat/completions');
        metricsService.recordError('server_error', '500', '/v1/chat/completions');
      }).to.not.throw();
    });
  });
  
  describe('updateFreeTierQuota', () => {
    it('should update free tier quota', () => {
      expect(() => {
        metricsService.updateFreeTierQuota('pollinations', 50);
      }).to.not.throw();
    });
  });
  
  describe('getMetrics', () => {
    it('should return Prometheus format metrics', async () => {
      const metrics = await metricsService.getMetrics();
      expect(metrics).to.be.a('string');
      expect(metrics).to.include('wenker_');
    });
  });
  
  describe('getMetricsAsJson', () => {
    it('should return metrics as JSON', async () => {
      const metrics = await metricsService.getMetricsAsJson();
      expect(metrics).to.be.an('array');
      expect(metrics.length).to.be.greaterThan(0);
    });
  });
  
  describe('getContentType', () => {
    it('should return correct content type', () => {
      const contentType = metricsService.getContentType();
      expect(contentType).to.include('text/plain');
      expect(contentType).to.include('version=0.0.4');
    });
  });
  
  describe('getDefaultMetrics', () => {
    it('should return default metrics', () => {
      const metrics = metricsService.getDefaultMetrics();
      expect(metrics).to.have.property('uptime_seconds');
      expect(metrics).to.have.property('timestamp');
      expect(metrics.uptime_seconds).to.be.greaterThan(0);
    });
  });
});