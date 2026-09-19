/**
 * Prometheus Metrics Service for WENKER Router
 * Exposes /metrics endpoint for Prometheus scraping
 */

const promClient = require('prom-client');
const db = require('./dbService');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register, prefix: 'wenker_' });

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'wenker_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'wenker_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const chatCompletionsTotal = new promClient.Counter({
  name: 'wenker_chat_completions_total',
  help: 'Total number of chat completion requests',
  labelNames: ['provider', 'model', 'status', 'stream'],
  registers: [register],
});

const chatCompletionDuration = new promClient.Histogram({
  name: 'wenker_chat_completion_duration_seconds',
  help: 'Chat completion duration in seconds',
  labelNames: ['provider', 'model', 'status'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const tokensTotal = new promClient.Counter({
  name: 'wenker_tokens_total',
  help: 'Total number of tokens processed',
  labelNames: ['type', 'provider', 'model'], // type: prompt, completion
  registers: [register],
});

const activeConnections = new promClient.Gauge({
  name: 'wenker_active_connections',
  help: 'Number of active connections',
  labelNames: ['type'], // type: sse, websocket, http
  registers: [register],
});

const providerHealth = new promClient.Gauge({
  name: 'wenker_provider_health',
  help: 'Provider health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['provider', 'provider_name'],
  registers: [register],
});

const providerLatency = new promClient.Histogram({
  name: 'wenker_provider_latency_seconds',
  help: 'Provider latency in seconds',
  labelNames: ['provider', 'provider_name'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const quotaUsage = new promClient.Gauge({
  name: 'wenker_quota_usage',
  help: 'Current quota usage for WENKER Cloud',
  labelNames: ['subject', 'type'], // type: requests, tokens
  registers: [register],
});

const cacheHits = new promClient.Counter({
  name: 'wenker_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['result'], // hit, miss
  registers: [register],
});

const circuitBreakerState = new promClient.Gauge({
  name: 'wenker_circuit_breaker_state',
  help: 'Circuit breaker state (0 = closed, 1 = half-open, 2 = open)',
  labelNames: ['provider'],
  registers: [register],
});

const fallbackTotal = new promClient.Counter({
  name: 'wenker_fallback_total',
  help: 'Total number of fallback activations',
  labelNames: ['from_provider', 'to_provider', 'reason'],
  registers: [register],
});

const errorsTotal = new promClient.Counter({
  name: 'wenker_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'endpoint'],
  registers: [register],
});

const freeTierQuota = new promClient.Gauge({
  name: 'wenker_free_tier_quota_remaining',
  help: 'Remaining free tier quota',
  labelNames: ['provider'],
  registers: [register],
});

/**
 * Metrics service for collecting and exposing metrics
 */
class MetricsService {
  constructor() {
    this.register = register;
    this.startTime = Date.now();
  }

  /**
   * Express middleware to track HTTP requests
   */
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Track active connections
      activeConnections.inc({ type: 'http' });
      
      const originalSend = res.send;
      res.send = function(body) {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode;
        const method = req.method;
        const path = this._normalizePath(req.path);
        
        httpRequestsTotal.inc({ method, path, status_code: statusCode });
        httpRequestDuration.observe({ method, path, status_code: statusCode }, duration);
        
        // Track errors
        if (statusCode >= 400) {
          errorsTotal.inc({ 
            type: statusCode >= 500 ? 'server_error' : 'client_error',
            code: statusCode.toString(),
            endpoint: path,
          });
        }
        
        activeConnections.dec({ type: 'http' });
        return originalSend.call(this, body);
      };
      
      next();
    };
  }

  /**
   * Normalize path for metrics (replace IDs with placeholders)
   */
  _normalizePath(path) {
    return path
      .replace(/\/v1\/chat\/completions.*/, '/v1/chat/completions')
      .replace(/\/v1\/messages.*/, '/v1/messages')
      .replace(/\/v1\/models.*/, '/v1/models')
      .replace(/\/v1\/embeddings.*/, '/v1/embeddings')
      .replace(/\/api\/providers\/[^\/]+/, '/api/providers/:id')
      .replace(/\/api\/keys\/[^\/]+/, '/api/keys/:id')
      .replace(/\/api\/plugins\/[^\/]+/, '/api/plugins/:id');
  }

  /**
   * Record chat completion metrics
   */
  recordChatCompletion({ provider, model, status, stream, durationMs, promptTokens, completionTokens }) {
    chatCompletionsTotal.inc({ 
      provider: provider || 'unknown', 
      model: model || 'unknown', 
      status: status || 'unknown',
      stream: stream ? 'true' : 'false',
    });
    
    if (durationMs) {
      chatCompletionDuration.observe({ 
        provider: provider || 'unknown', 
        model: model || 'unknown', 
        status: status || 'unknown',
      }, durationMs / 1000);
    }
    
    if (promptTokens) {
      tokensTotal.inc({ type: 'prompt', provider: provider || 'unknown', model: model || 'unknown' }, promptTokens);
    }
    if (completionTokens) {
      tokensTotal.inc({ type: 'completion', provider: provider || 'unknown', model: model || 'unknown' }, completionTokens);
    }
  }

  /**
   * Record provider health check result
   */
  recordProviderHealth(providerId, providerName, healthy, latencyMs) {
    providerHealth.set({ provider: providerId, provider_name: providerName }, healthy ? 1 : 0);
    if (latencyMs) {
      providerLatency.observe({ provider: providerId, provider_name: providerName }, latencyMs / 1000);
    }
  }

  /**
   * Record quota usage
   */
  recordQuotaUsage(subject, requestsUsed, tokensUsed) {
    quotaUsage.set({ subject, type: 'requests' }, requestsUsed);
    quotaUsage.set({ subject, type: 'tokens' }, tokensUsed);
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit) {
    cacheHits.inc({ result: hit ? 'hit' : 'miss' });
  }

  /**
   * Record circuit breaker state change
   */
  recordCircuitBreakerState(providerId, state) {
    const stateMap = { 'CLOSED': 0, 'HALF_OPEN': 1, 'OPEN': 2 };
    circuitBreakerState.set({ provider: providerId }, stateMap[state] || 0);
  }

  /**
   * Record fallback activation
   */
  recordFallback(fromProvider, toProvider, reason) {
    fallbackTotal.inc({ 
      from_provider: fromProvider, 
      to_provider: toProvider, 
      reason: reason || 'unknown' 
    });
  }

  /**
   * Record error
   */
  recordError(type, code, endpoint) {
    errorsTotal.inc({ type, code, endpoint });
  }

  /**
   * Update free tier quota remaining
   */
  updateFreeTierQuota(provider, remaining) {
    freeTierQuota.set({ provider }, remaining);
  }

  /**
   * Get metrics as Prometheus format
   */
  async getMetrics() {
    return register.metrics();
  }

  /**
   * Get metrics content type
   */
  getContentType() {
    return register.contentType;
  }

  /**
   * Get all metrics as JSON (for debugging)
   */
  async getMetricsAsJson() {
    return register.getMetricsAsJSON();
  }

  /**
   * Get default metrics (for health check)
   */
  getDefaultMetrics() {
    return {
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      timestamp: new Date().toISOString(),
    };
  }
}

const metricsService = new MetricsService();

module.exports = metricsService;
module.exports.MetricsService = MetricsService;