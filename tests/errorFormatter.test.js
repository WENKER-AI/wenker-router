/**
 * Unit Tests for Error Formatter
 */

process.env.NODE_ENV = 'test';
const chai = require('chai');
const chaiHttp = require('chai-http').default;
chai.use(chaiHttp);
const { expect } = chai;
const express = require('express');
const { 
  ERROR_CODES, 
  HTTP_STATUS, 
  createErrorResponse, 
  createOpenAIError, 
  createAnthropicError, 
  Errors, 
  standardizedErrorHandler,
  responseFormatter 
} = require('../server/middlewares/errorFormatter');

describe('Error Formatter', function () {
  
  describe('ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(ERROR_CODES).to.have.property('INVALID_API_KEY');
      expect(ERROR_CODES).to.have.property('MISSING_API_KEY');
      expect(ERROR_CODES).to.have.property('RATE_LIMIT_EXCEEDED');
      expect(ERROR_CODES).to.have.property('FREE_QUOTA_EXHAUSTED');
      expect(ERROR_CODES).to.have.property('MODEL_NOT_FOUND');
      expect(ERROR_CODES).to.have.property('UPSTREAM_ERROR');
      expect(ERROR_CODES).to.have.property('CIRCUIT_OPEN');
      expect(ERROR_CODES).to.have.property('INTERNAL_ERROR');
      expect(ERROR_CODES).to.have.property('PROMPT_INJECTION_DETECTED');
    });
  });
  
  describe('HTTP_STATUS', () => {
    it('should have correct status codes', () => {
      expect(HTTP_STATUS.BAD_REQUEST).to.equal(400);
      expect(HTTP_STATUS.UNAUTHORIZED).to.equal(401);
      expect(HTTP_STATUS.FORBIDDEN).to.equal(403);
      expect(HTTP_STATUS.NOT_FOUND).to.equal(404);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).to.equal(429);
      expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).to.equal(500);
      expect(HTTP_STATUS.BAD_GATEWAY).to.equal(502);
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).to.equal(503);
      expect(HTTP_STATUS.GATEWAY_TIMEOUT).to.equal(504);
    });
  });
  
  describe('createErrorResponse', () => {
    it('should create standardized error response', () => {
      const { response, statusCode } = createErrorResponse({
        message: 'Test error',
        code: ERROR_CODES.INVALID_API_KEY,
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      });
      
      expect(statusCode).to.equal(HTTP_STATUS.UNAUTHORIZED);
      expect(response).to.have.property('error');
      expect(response.error).to.have.property('message', 'Test error');
      expect(response.error).to.have.property('code', ERROR_CODES.INVALID_API_KEY);
      expect(response.error).to.have.property('type');
    });
    
    it('should include hint when available', () => {
      const { response } = createErrorResponse({
        message: 'Test error',
        code: ERROR_CODES.MISSING_API_KEY,
      });
      
      expect(response.error).to.have.property('hint');
      expect(response.error.hint).to.include('Nhập API Key');
    });
    
    it('should include correlation ID when provided', () => {
      const { response } = createErrorResponse({
        message: 'Test error',
        code: ERROR_CODES.INTERNAL_ERROR,
        correlationId: 'test-correlation-id',
      });
      
      expect(response.error).to.have.property('correlationId', 'test-correlation-id');
    });
    
    it('should include custom hint', () => {
      const { response } = createErrorResponse({
        message: 'Test error',
        code: ERROR_CODES.INTERNAL_ERROR,
        hint: 'Custom hint',
      });
      
      expect(response.error.hint).to.equal('Custom hint');
    });
  });
  
  describe('createOpenAIError', () => {
    it('should create OpenAI-compatible error', () => {
      const { response, statusCode } = createOpenAIError({
        message: 'Test error',
        code: ERROR_CODES.MODEL_NOT_FOUND,
        statusCode: HTTP_STATUS.NOT_FOUND,
      });
      
      expect(statusCode).to.equal(HTTP_STATUS.NOT_FOUND);
      expect(response).to.have.property('error');
      expect(response.error).to.have.property('message', 'Test error');
    });
  });
  
  describe('createAnthropicError', () => {
    it('should create Anthropic-compatible error', () => {
      const { response, statusCode } = createAnthropicError({
        message: 'Test error',
        code: ERROR_CODES.MODEL_NOT_FOUND,
        statusCode: HTTP_STATUS.NOT_FOUND,
      });
      
      expect(statusCode).to.equal(HTTP_STATUS.NOT_FOUND);
      expect(response).to.have.property('type', 'error');
      expect(response).to.have.property('error');
      expect(response.error).to.have.property('message', 'Test error');
    });
  });
  
  describe('Errors (predefined error creators)', () => {
    it('invalidApiKey should create auth error', () => {
      const { response, statusCode } = Errors.invalidApiKey('Invalid key', 'corr-123');
      expect(statusCode).to.equal(HTTP_STATUS.UNAUTHORIZED);
      expect(response.error.code).to.equal(ERROR_CODES.INVALID_API_KEY);
      expect(response.error.correlationId).to.equal('corr-123');
    });
    
    it('missingApiKey should create auth error', () => {
      const { response, statusCode } = Errors.missingApiKey();
      expect(statusCode).to.equal(HTTP_STATUS.UNAUTHORIZED);
      expect(response.error.code).to.equal(ERROR_CODES.MISSING_API_KEY);
    });
    
    it('adminKeyRequired should create auth error', () => {
      const { response, statusCode } = Errors.adminKeyRequired();
      expect(statusCode).to.equal(HTTP_STATUS.UNAUTHORIZED);
      expect(response.error.code).to.equal(ERROR_CODES.ADMIN_KEY_REQUIRED);
    });
    
    it('rateLimitExceeded should create rate limit error', () => {
      const { response, statusCode } = Errors.rateLimitExceeded('Too many', 'free', 50);
      expect(statusCode).to.equal(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.error.code).to.equal(ERROR_CODES.RATE_LIMIT_EXCEEDED);
      expect(response.error.details).to.deep.equal({ tier: 'free', limit: 50 });
    });
    
    it('freeQuotaExhausted should create quota error', () => {
      const { response, statusCode } = Errors.freeQuotaExhausted();
      expect(statusCode).to.equal(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.error.code).to.equal(ERROR_CODES.FREE_QUOTA_EXHAUSTED);
    });
    
    it('modelNotFound should create not found error with available models', () => {
      const { response, statusCode } = Errors.modelNotFound('gpt-4', ['model1', 'model2']);
      expect(statusCode).to.equal(HTTP_STATUS.NOT_FOUND);
      expect(response.error.code).to.equal(ERROR_CODES.MODEL_NOT_FOUND);
      expect(response.error.details).to.have.property('availableModels');
      expect(response.error.details.availableModels).to.deep.equal(['model1', 'model2']);
    });
    
    it('unsupportedModality should create validation error', () => {
      const { response, statusCode } = Errors.unsupportedModality('dall-e', 'tạo ảnh');
      expect(statusCode).to.equal(HTTP_STATUS.BAD_REQUEST);
      expect(response.error.code).to.equal(ERROR_CODES.UNSUPPORTED_MODALITY);
      expect(response.error.details).to.have.property('modality', 'tạo ảnh');
    });
    
    it('toolsNotSupported should create validation error', () => {
      const { response, statusCode } = Errors.toolsNotSupported('model-x', 'Pollinations');
      expect(statusCode).to.equal(HTTP_STATUS.BAD_REQUEST);
      expect(response.error.code).to.equal(ERROR_CODES.TOOLS_NOT_SUPPORTED);
    });
    
    it('upstreamError should create upstream error', () => {
      const { response, statusCode } = Errors.upstreamError('OpenRouter', 502, 'Bad gateway');
      expect(statusCode).to.equal(HTTP_STATUS.BAD_GATEWAY);
      expect(response.error.code).to.equal(ERROR_CODES.UPSTREAM_ERROR);
      expect(response.error.details).to.deep.equal({ provider: 'OpenRouter', upstreamStatus: 502 });
    });
    
    it('circuitOpen should create service unavailable error', () => {
      const { response, statusCode } = Errors.circuitOpen('Pollinations', 30000);
      expect(statusCode).to.equal(HTTP_STATUS.SERVICE_UNAVAILABLE);
      expect(response.error.code).to.equal(ERROR_CODES.CIRCUIT_OPEN);
      expect(response.error.details).to.have.property('retryAfter', 30000);
    });
    
    it('budgetExhausted should create upstream error', () => {
      const { response, statusCode } = Errors.budgetExhausted('Pollinations');
      expect(statusCode).to.equal(HTTP_STATUS.TOO_MANY_REQUESTS);
      expect(response.error.code).to.equal(ERROR_CODES.BUDGET_EXHAUSTED);
    });
    
    it('internalError should create internal error', () => {
      const { response, statusCode } = Errors.internalError('Something broke');
      expect(statusCode).to.equal(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.error.code).to.equal(ERROR_CODES.INTERNAL_ERROR);
    });
    
    it('notImplemented should create not implemented error', () => {
      const { response, statusCode } = Errors.notImplemented('Feature X');
      expect(statusCode).to.equal(HTTP_STATUS.NOT_IMPLEMENTED);
      expect(response.error.code).to.equal(ERROR_CODES.NOT_IMPLEMENTED);
    });
    
    it('promptInjectionDetected should create security error', () => {
      const { response, statusCode } = Errors.promptInjectionDetected({ pattern: 'test' }, 'corr-123');
      expect(statusCode).to.equal(HTTP_STATUS.BAD_REQUEST);
      expect(response.error.code).to.equal(ERROR_CODES.PROMPT_INJECTION_DETECTED);
      expect(response.error.details).to.deep.equal({ pattern: 'test' });
      expect(response.error.correlationId).to.equal('corr-123');
    });
  });
  
  describe('standardizedErrorHandler', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(express.json());
      app.use(standardizedErrorHandler);
      app.get('/error', (req, res, next) => {
        const err = new Error('Test error');
        err.status = 400;
        err.code = 'INVALID_REQUEST';
        next(err);
      });
      app.get('/anthropic-error', (req, res, next) => {
        const err = new Error('Test error');
        err.status = 400;
        next(err);
      });
    });
    
    it('should handle errors with standardized format', async () => {
      const res = await chaiHttp.request(app).get('/error');
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.have.property('message');
      expect(res.body.error).to.have.property('code');
    });
    
    it('should format Anthropic errors correctly', async () => {
      const res = await chaiHttp.request(app).get('/anthropic-error');
      expect(res).to.have.status(400);
      expect(res.body).to.have.property('type', 'error');
      expect(res.body).to.have.property('error');
    });
  });
  
  describe('responseFormatter', () => {
    let app;
    
    before(() => {
      app = express();
      app.use(express.json());
      app.use(responseFormatter);
      app.get('/test', (req, res) => {
        res.json({ success: true });
      });
    });
    
    it('should pass through responses', async () => {
      const res = await chaiHttp.request(app).get('/test');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({ success: true });
    });
  });
});