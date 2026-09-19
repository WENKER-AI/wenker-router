/**
 * Unit Tests for Structured Logger
 */

process.env.NODE_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http').default;
chai.use(chaiHttp);
const { expect } = chai;
const express = require('express');
const { 
  correlationIdMiddleware, 
  requestLoggerMiddleware, 
  errorLoggerMiddleware,
  StructuredLogger,
  generateCorrelationId,
  createChildLogger 
} = require('../server/middlewares/structuredLogger');

describe('Structured Logger', function () {
  
  describe('generateCorrelationId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).to.be.a('string');
      expect(id1.length).to.equal(32); // 16 bytes = 32 hex chars
      expect(id1).to.not.equal(id2);
    });
  });
  
  describe('StructuredLogger', () => {
    let logger;
    
    beforeEach(() => {
      logger = new StructuredLogger({ serviceName: 'test-service', logLevel: 'debug' });
    });
    
    it('should format log entries correctly', () => {
      // We can't easily capture console output, but we can test the format method
      const entry = logger._formatLog('info', 'test message', { key: 'value' });
      expect(entry).to.have.property('level', 'info');
      expect(entry).to.have.property('message', 'test message');
      expect(entry).to.have.property('service', 'test-service');
      expect(entry).to.have.property('key', 'value');
      expect(entry).to.have.property('timestamp');
    });
    
    it('should not include undefined values', () => {
      const entry = logger._formatLog('info', 'test', { defined: 'value', undefined: undefined });
      expect(entry).to.have.property('defined', 'value');
      expect(entry).to.not.have.property('undefined');
    });
    
    it('should create child logger with context', () => {
      const childLogger = createChildLogger(logger, { requestId: '123', userId: '456' });
      expect(childLogger).to.have.property('error');
      expect(childLogger).to.have.property('warn');
      expect(childLogger).to.have.property('info');
      expect(childLogger).to.have.property('debug');
    });
  });
  
  describe('correlationIdMiddleware', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(correlationIdMiddleware);
      app.get('/test', (req, res) => {
        res.json({ correlationId: req.correlationId });
      });
    });
    
    it('should generate correlation ID if not provided', async () => {
      const res = await chai.request(app).get('/test');
      expect(res).to.have.status(200);
      expect(res.body).to.have.property('correlationId');
      expect(res.body.correlationId.length).to.equal(32);
    });
    
    it('should use provided correlation ID', async () => {
      const res = await chai.request(app)
        .get('/test')
        .set('x-correlation-id', 'custom-correlation-id');
      expect(res).to.have.status(200);
      expect(res.body.correlationId).to.equal('custom-correlation-id');
    });
    
    it('should set correlation ID in response header', async () => {
      const res = await chai.request(app).get('/test');
      expect(res).to.have.header('x-correlation-id');
    });
  });
  
  describe('requestLoggerMiddleware', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(express.json());
      app.use(correlationIdMiddleware);
      app.use(requestLoggerMiddleware);
      app.post('/test', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should log requests', async () => {
      const res = await chai.request(app)
        .post('/test')
        .send({ test: 'data' });
      expect(res).to.have.status(200);
    });
  });
  
  describe('errorLoggerMiddleware', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(express.json());
      app.use(correlationIdMiddleware);
      app.use(errorLoggerMiddleware);
      app.get('/error', (req, res, next) => {
        next(new Error('Test error'));
      });
    });
    
    it('should handle errors', async () => {
      const res = await chai.request(app).get('/error');
      expect(res).to.have.status(500);
    });
  });
});