/**
 * Prometheus Metrics Service for WENKER Router
 * 
 * Cung cấp các metrics cho monitoring:
 * - HTTP request/response
 * - Provider health
 * - Token usage
 * - Error rates
 * - Cache hit/miss
 * - Circuit breaker status
 */

const client = require('prom-client');

/**
 * Metrics Registry
 * Sử dụng default registry của Prometheus
 */
const register = client.register;

/**
 * Metric: HTTP Request Counter
 * Đếm số lượng requests theo method, path, status code
 */
const httpRequestCounter = new client.Counter({
  name: 'wenker_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code', 'tier'],
  registers: [register],
});

/**
 * Metric: HTTP Request Duration Histogram
 * Đo thời gian xử lý request (ms)
 */
const httpRequestDuration = new client.Histogram({
  name: 'wenker_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status_code', 'provider_id'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1, 2.5, 5, 10], // seconds
  registers: [register],
});

/**
 * Metric: Active Requests Gauge
 * Số request đang xử lý
 */
const activeRequestsGauge = new client.Gauge({
  name: 'wenker_active_requests',
  help: 'Number of active HTTP requests being processed',
  labelNames: ['method', 'path'],
  registers: [register],
});

/**
 * Metric: Provider Request Counter
 * Đếm request theo provider
 */
const providerRequestCounter = new client.Counter({
  name: 'wenker_provider_requests_total',
  help: 'Total number of requests to each provider',
  labelNames: ['provider_id', 'model_id', 'status'],
  registers: [register],
});

/**
 * Metric: Provider Request Duration
 */
const providerRequestDuration = new client.Histogram({
  name: 'wenker_provider_request_duration_seconds',
  help: 'Duration of provider requests in seconds',
  labelNames: ['provider_id', 'model_id', 'status'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

/**
 * Metric: Token Usage Counter
 * Đếm token usage theo provider
 */
const tokenUsageCounter = new client.Counter({
  name: 'wenker_token_usage_total',
  help: 'Total token usage',
  labelNames: ['provider_id', 'model_id', 'token_type'],
  registers: [register],
});

/**
 * Metric: Error Counter
 * Đếm errors theo loại
 */
const errorCounter = new client.Counter({
  name: 'wenker_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'error_code', 'provider_id', 'path'],
  registers: [register],
});

/**
 * Metric: Cache Metrics
 */
const cacheHitCounter = new client.Counter({
  name: 'wenker_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

const cacheMissCounter = new client.Counter({
  name: 'wenker_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

/**
 * Metric: Circuit Breaker Status
 */
const circuitBreakerStatus = new client.Gauge({
  name: 'wenker_circuit_breaker_status',
  help: 'Current status of circuit breakers (0=CLOSED, 1=OPEN, 2=HALF_OPEN)',
  labelNames: ['provider_id'],
  registers: [register],
});

const circuitBreakerFailureCount = new client.Gauge({
  name: 'wenker_circuit_breaker_failure_count',
  help: 'Current failure count for each circuit breaker',
  labelNames: ['provider_id'],
  registers: [register],
});

/**
 * Metric: Active Streams Gauge
 */
const activeStreamsGauge = new client.Gauge({
  name: 'wenker_active_streams',
  help: 'Number of active streaming connections',
  registers: [register],
});

/**
 * Metric: Memory Usage
 */
const memoryUsageGauge = new client.Gauge({
  name: 'wenker_memory_usage_bytes',
  help: 'Current memory usage in bytes',
  registers: [register],
});

/**
 * Metric: Uptime Gauge
 */
const uptimeGauge = new client.Gauge({
  name: 'wenker_uptime_seconds',
  help: 'Server uptime in seconds',
  registers: [register],
});

/**
 * Metric: Process CPU Usage
 */
const cpuUsageGauge = new client.Gauge({
  name: 'wenker_cpu_usage_percent',
  help: 'Current CPU usage percentage',
  labelNames: ['core'],
  registers: [register],
});

/**
 * Metric: Active Connections
 */
const activeConnectionsGauge = new client.Gauge({
  name: 'wenker_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

/**
 * Metrics Service
 */
class MetricsService {
  constructor() {
    this.startTime = Date.now();
    this.requestCounter = {}; // Theo dõi request đang active
    
    // Start memory and CPU monitoring
    this.startSystemMonitoring();
    
    console.log('[MetricsService] Initialized Prometheus metrics');
  }
  
  /**
   * Start monitoring system metrics
   */
  startSystemMonitoring() {
    // Update uptime every second
    setInterval(() => {
      const uptime = process.uptime();
      uptimeGauge.set(uptime);
    }, 1000);
    
    // Update memory usage every 5 seconds
    setInterval(() => {
      const memory = process.memoryUsage();
      memoryUsageGauge.set(memory.heapUsed);
    }, 5000);
    
    // Update CPU usage (approximate)
    // Note: Node.js không có built-in CPU usage, có thể dùng external module
    setInterval(() => {
      // Đây là approximation, có thể replace với real CPU monitoring
      const load = process.cpuUsage();
      cpuUsageGauge.set({ core: 'total' }, load.user + load.system);
    }, 10000);
  }
  
  /**
   * Middleware để track HTTP requests
   */
  requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const method = req.method || 'UNKNOWN';
      const path = req.path || 'unknown';
      const tier = req.rateLimitTier || 'unknown';
      
      // Tăng active requests
      activeRequestsGauge.inc({ method, path });
      activeConnectionsGauge.inc();
      
      // Track request ID
      const requestId = req.headers['x-request-id'] || `${method}:${path}:${start}`;
      this.requestCounter[requestId] = { start, method, path };
      
      // Listen for response finish
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000; // Convert to seconds
        const statusCode = res.statusCode || 200;
        
        // Ghi metrics
        httpRequestCounter.inc({ method, path, status_code: String(statusCode), tier });
        httpRequestDuration.observe({ method, path, status_code: String(statusCode) }, duration);
        
        // Giảm active requests
        activeRequestsGauge.dec({ method, path });
        activeConnectionsGauge.dec();
        
        // Cleanup
        delete this.requestCounter[requestId];
      });
      
      res.on('close', () => {
        // Nếu connection bị đóng trước khi response
        activeRequestsGauge.dec({ method, path });
        activeConnectionsGauge.dec();
        delete this.requestCounter[requestId];
      });
      
      next();
    };
  }
  
  /**
   * Record provider request
   * @param {string} providerId - Provider ID
   * @param {string} modelId - Model ID
   * @param {string} status - Status ('success', 'error', 'timeout')
   * @param {number} duration - Duration in seconds
   */
  recordProviderRequest(providerId, modelId, status, duration) {
    providerRequestCounter.inc({ provider_id: providerId, model_id: modelId, status });
    if (duration) {
      providerRequestDuration.observe({ provider_id: providerId, model_id: modelId, status }, duration);
    }
  }
  
  /**
   * Record token usage
   * @param {string} providerId - Provider ID
   * @param {string} modelId - Model ID
   * @param {string} tokenType - 'prompt' or 'completion'
   * @param {number} count - Number of tokens
   */
  recordTokenUsage(providerId, modelId, tokenType, count) {
    tokenUsageCounter.add({ provider_id: providerId, model_id: modelId, token_type: tokenType }, count);
  }
  
  /**
   * Record error
   * @param {string} errorType - Error type
   * @param {string} errorCode - Error code
   * @param {string} providerId - Provider ID (optional)
   * @param {string} path - Request path (optional)
   */
  recordError(errorType, errorCode, providerId = 'unknown', path = 'unknown') {
    errorCounter.inc({ error_type: errorType, error_code: errorCode, provider_id: providerId, path });
  }
  
  /**
   * Record cache hit
   * @param {string} cacheType - Cache type ('response', 'model', etc.)
   */
  recordCacheHit(cacheType) {
    cacheHitCounter.inc({ cache_type: cacheType });
  }
  
  /**
   * Record cache miss
   * @param {string} cacheType - Cache type
   */
  recordCacheMiss(cacheType) {
    cacheMissCounter.inc({ cache_type: cacheType });
  }
  
  /**
   * Update circuit breaker metrics
   * @param {string} providerId - Provider ID
   * @param {string} state - Current state ('CLOSED', 'OPEN', 'HALF_OPEN')
   * @param {number} failureCount - Current failure count
   */
  updateCircuitBreakerMetrics(providerId, state, failureCount) {
    // Convert state to number
    const stateValue = {
      CLOSED: 0,
      OPEN: 1,
      HALF_OPEN: 2,
    }[state] || 0;
    
    circuitBreakerStatus.set({ provider_id: providerId }, stateValue);
    circuitBreakerFailureCount.set({ provider_id: providerId }, failureCount);
  }
  
  /**
   * Update active streams count
   * @param {number} count - Current active stream count
   */
  updateActiveStreams(count) {
    activeStreamsGauge.set(count);
  }
  
  /**
   * Get all metrics as JSON (cho debugging)
   * @returns {Object}
   */
  async getMetrics() {
    try {
      const metrics = await register.metrics();
      return metrics;
    } catch (err) {
      console.error('[MetricsService] Error getting metrics:', err);
      return '# Error collecting metrics';
    }
  }
  
  /**
   * Reset tất cả metrics (cho testing)
   */
  reset() {
    register.clear();
    console.log('[MetricsService] All metrics reset');
  }
  
  /**
   * Get Prometheus metrics endpoint
   * @returns {Function} - Express route handler
   */
  getMetricsEndpoint() {
    return async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
      } catch (err) {
        console.error('[MetricsService] Error serving metrics:', err);
        res.status(500).json({
          error: {
            message: 'Error collecting metrics',
            type: 'internal_error',
            code: 'METRICS_ERROR',
          },
        });
      }
    };
  }
  
  /**
   * Get health status
   * @returns {Object}
   */
  getHealthStatus() {
    const uptime = process.uptime();
    const memory = process.memoryUsage();
    
    return {
      uptime: `${Math.floor(uptime / 60)} minutes`,
      memoryUsage: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
      },
      activeRequests: Object.keys(this.requestCounter).length,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
const metricsService = new MetricsService();

module.exports = {
  MetricsService,
  metricsService,
  // Export các metrics riêng lẻ cho sử dụng trực tiếp
  httpRequestCounter,
  httpRequestDuration,
  activeRequestsGauge,
  providerRequestCounter,
  providerRequestDuration,
  tokenUsageCounter,
  errorCounter,
  cacheHitCounter,
  cacheMissCounter,
  circuitBreakerStatus,
  circuitBreakerFailureCount,
  activeStreamsGauge,
  memoryUsageGauge,
  uptimeGauge,
  cpuUsageGauge,
  activeConnectionsGauge,
  register,
  // Export middleware
  default: metricsService,
};
