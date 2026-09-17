/**
 * Circuit Breaker Pattern Implementation for WENKER Router
 * 
 * Mục đích:
 * - Ngăn chặn việc gửi request đến provider đang fail liên tục
 * - Auto-recover sau một khoảng thời gian
 * - Giảm thiểu impact của cascading failures
 * 
 * States:
 * - CLOSED: Hoạt động bình thường, request được gửi đến provider
 * - OPEN: Provider đang fail, request bị chặn và failover ngay lập tức
 * - HALF_OPEN: Đang test provider, cho phép một vài request thử
 */

const db = require('./dbService');

/**
 * Circuit Breaker States
 */
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',      // Normal operation
  OPEN: 'OPEN',          // Provider is down, requests fail fast
  HALF_OPEN: 'HALF_OPEN', // Testing provider recovery
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  // Số lần fail liên tiếp để mở circuit breaker
  failureThreshold: 5,
  
  // Thời gian (ms) circuit ở trạng thái OPEN trước khi chuyển sang HALF_OPEN
  resetTimeout: 30000,
  
  // Số request tối đa cho phép trong trạng thái HALF_OPEN
  halfOpenMaxRequests: 3,
  
  // Thời gian (ms) để đưa circuit về trạng thái CLOSED sau khi HALF_OPEN thành công
  successThresholdTimeout: 10000,
};

/**
 * Lớp Circuit Breaker cho một provider
 */
class ProviderCircuitBreaker {
  constructor(providerId, config = {}) {
    this.providerId = providerId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // State
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.halfOpenRequestCount = 0;
    this.lastSuccessTime = null;
    
    // Event listeners
    this.listeners = {
      open: [],
      close: [],
      halfOpen: [],
      failure: [],
      success: [],
    };
    
    console.log(`[CircuitBreaker] Initialized for ${providerId}`);
  }
  
  /**
   * Check xem có cho phép request đi qua không
   * @returns {Object} - { allowed: boolean, state: string, reason?: string }
   */
  canExecute() {
    const now = Date.now();
    
    switch (this.state) {
      case CIRCUIT_STATES.CLOSED:
        return { allowed: true, state: this.state };
      
      case CIRCUIT_STATES.OPEN:
        // Kiểm tra xem đã đủ thời gian để chuyển sang HALF_OPEN
        if (now >= this.nextAttemptTime) {
          this.transitionTo(CIRCUIT_STATES.HALF_OPEN);
          this.halfOpenRequestCount = 0;
          return { allowed: true, state: this.state };
        }
        return {
          allowed: false,
          state: this.state,
          reason: `Circuit breaker is OPEN. Retry after ${Math.ceil((this.nextAttemptTime - now) / 1000)}s`,
          retryAfter: this.nextAttemptTime - now,
        };
      
      case CIRCUIT_STATES.HALF_OPEN:
        // Cho phép request nhưng giới hạn số lượng
        if (this.halfOpenRequestCount < this.config.halfOpenMaxRequests) {
          this.halfOpenRequestCount++;
          return { allowed: true, state: this.state };
        }
        return {
          allowed: false,
          state: this.state,
          reason: `Circuit breaker is HALF_OPEN with max requests reached`,
        };
      
      default:
        return { allowed: true, state: this.state };
    }
  }
  
  /**
   * Thông báo request thành công
   */
  recordSuccess() {
    switch (this.state) {
      case CIRCUIT_STATES.CLOSED:
        // Reset failure count
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.emit('success', { providerId: this.providerId, state: this.state });
        break;
        
      case CIRCUIT_STATES.HALF_OPEN:
        // Nếu thành công, chuyển về CLOSED
        this.lastSuccessTime = Date.now();
        this.emit('success', { providerId: this.providerId, state: this.state });
        
        // Đợi một khoảng thời gian trước khi đóng hoàn toàn
        setTimeout(() => {
          if (this.state === CIRCUIT_STATES.HALF_OPEN) {
            this.transitionTo(CIRCUIT_STATES.CLOSED);
          }
        }, this.config.successThresholdTimeout);
        break;
        
      case CIRCUIT_STATES.OPEN:
        // Không nên xảy ra, nhưng nếu có thì reset
        this.transitionTo(CIRCUIT_STATES.CLOSED);
        break;
    }
  }
  
  /**
   * Thông báo request thất bại
   * @param {Error} error - Error object
   */
  recordFailure(error) {
    this.lastFailureTime = Date.now();
    this.emit('failure', { 
      providerId: this.providerId, 
      state: this.state,
      error: error.message,
      count: this.failureCount + 1 
    });
    
    switch (this.state) {
      case CIRCUIT_STATES.CLOSED:
        this.failureCount++;
        
        // Kiểm tra xem đã vượt ngưỡng
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo(CIRCUIT_STATES.OPEN);
        }
        break;
        
      case CIRCUIT_STATES.HALF_OPEN:
        // Nếu fail trong HALF_OPEN, mở circuit ngay lập tức
        this.transitionTo(CIRCUIT_STATES.OPEN);
        break;
        
      case CIRCUIT_STATES.OPEN:
        // Đã mở rồi, không làm gì thêm
        break;
    }
  }
  
  /**
   * Chuyển trạng thái
   * @param {string} newState - Trạng thái mới
   */
  transitionTo(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    // Set timestamps dựa trên state
    switch (newState) {
      case CIRCUIT_STATES.OPEN:
        this.nextAttemptTime = Date.now() + this.config.resetTimeout;
        console.log(`[CircuitBreaker] ${this.providerId}: OPENED (retry after ${this.config.resetTimeout/1000}s)`);
        this.emit('open', { providerId: this.providerId, oldState, newState });
        break;
        
      case CIRCUIT_STATES.HALF_OPEN:
        console.log(`[CircuitBreaker] ${this.providerId}: HALF_OPEN (testing recovery)`);
        this.emit('halfOpen', { providerId: this.providerId, oldState, newState });
        break;
        
      case CIRCUIT_STATES.CLOSED:
        this.failureCount = 0;
        this.halfOpenRequestCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        console.log(`[CircuitBreaker] ${this.providerId}: CLOSED (recovered)`);
        this.emit('close', { providerId: this.providerId, oldState, newState });
        break;
    }
  }
  
  /**
   * Đăng ký listener cho event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }
  
  /**
   * Emit event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  emit(event, data) {
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error(`[CircuitBreaker] Error in ${event} listener:`, err);
      }
    });
  }
  
  /**
   * Reset circuit breaker về trạng thái ban đầu
   */
  reset() {
    this.transitionTo(CIRCUIT_STATES.CLOSED);
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.halfOpenRequestCount = 0;
    this.lastSuccessTime = null;
  }
  
  /**
   * Lấy trạng thái hiện tại
   * @returns {Object}
   */
  getStatus() {
    return {
      providerId: this.providerId,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      halfOpenRequestCount: this.halfOpenRequestCount,
      lastSuccessTime: this.lastSuccessTime,
      config: this.config,
    };
  }
  
  /**
   * Check xem circuit đã sẵn sàng chưa (không trong trạng thái OPEN)
   * @returns {boolean}
   */
  isReady() {
    return this.state !== CIRCUIT_STATES.OPEN;
  }
  
  /**
   * Lấy thời gian chờ tối thiểu trước khi request tiếp theo
   * @returns {number|null}
   */
  getRetryAfter() {
    if (this.state !== CIRCUIT_STATES.OPEN) return null;
    return Math.max(0, this.nextAttemptTime - Date.now());
  }
}

/**
 * Circuit Breaker Manager
 * Quản lý tất cả circuit breakers cho các providers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map(); // providerId -> ProviderCircuitBreaker
    this.globalConfig = { ...DEFAULT_CONFIG };
    
    // Load configuration từ database
    this.loadConfiguration();
    
    console.log('[CircuitBreaker] Manager initialized');
  }
  
  /**
   * Load configuration từ database
   */
  loadConfiguration() {
    try {
      const settings = db.getSettings();
      if (settings.circuitBreakerConfig) {
        this.globalConfig = { ...this.globalConfig, ...settings.circuitBreakerConfig };
        console.log('[CircuitBreaker] Loaded configuration from settings');
      }
    } catch (err) {
      console.warn('[CircuitBreaker] Could not load configuration:', err.message);
    }
  }
  
  /**
   * Lấy circuit breaker cho một provider
   * @param {string} providerId - Provider ID
   * @param {Object} config - Custom configuration
   * @returns {ProviderCircuitBreaker}
   */
  getBreaker(providerId, config = {}) {
    if (!this.breakers.has(providerId)) {
      const breakerConfig = { ...this.globalConfig, ...config };
      this.breakers.set(providerId, new ProviderCircuitBreaker(providerId, breakerConfig));
    }
    return this.breakers.get(providerId);
  }
  
  /**
   * Check xem provider có cho phép request không
   * @param {string} providerId - Provider ID
   * @returns {Object} - { allowed: boolean, state: string, reason?: string, retryAfter?: number }
   */
  canExecute(providerId) {
    const breaker = this.getBreaker(providerId);
    return breaker.canExecute();
  }
  
  /**
   * Thông báo request đến provider thành công
   * @param {string} providerId - Provider ID
   */
  recordSuccess(providerId) {
    const breaker = this.getBreaker(providerId);
    breaker.recordSuccess();
  }
  
  /**
   * Thông báo request đến provider thất bại
   * @param {string} providerId - Provider ID
   * @param {Error} error - Error object
   */
  recordFailure(providerId, error) {
    const breaker = this.getBreaker(providerId);
    breaker.recordFailure(error);
  }
  
  /**
   * Reset circuit breaker cho provider
   * @param {string} providerId - Provider ID
   */
  resetBreaker(providerId) {
    const breaker = this.breakers.get(providerId);
    if (breaker) {
      breaker.reset();
    }
  }
  
  /**
   * Reset tất cả circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    console.log('[CircuitBreaker] All breakers reset');
  }
  
  /**
   * Lấy trạng thái của tất cả circuit breakers
   * @returns {Object}
   */
  getAllStatus() {
    const status = {};
    for (const [providerId, breaker] of this.breakers) {
      status[providerId] = breaker.getStatus();
    }
    return status;
  }
  
  /**
   * Lấy trạng thái của một provider
   * @param {string} providerId - Provider ID
   * @returns {Object|null}
   */
  getStatus(providerId) {
    const breaker = this.breakers.get(providerId);
    return breaker ? breaker.getStatus() : null;
  }
  
  /**
   * Check xem provider có sẵn sàng không
   * @param {string} providerId - Provider ID
   * @returns {boolean}
   */
  isProviderReady(providerId) {
    const breaker = this.breakers.get(providerId);
    return breaker ? breaker.isReady() : true;
  }
  
  /**
   * Lấy danh sách providers đang bị chặn (OPEN state)
   * @returns {Array}
   */
  getBlockedProviders() {
    const blocked = [];
    for (const [providerId, breaker] of this.breakers) {
      if (breaker.state === CIRCUIT_STATES.OPEN) {
        blocked.push({
          providerId,
          state: breaker.state,
          retryAfter: breaker.getRetryAfter(),
          failureCount: breaker.failureCount,
        });
      }
    }
    return blocked;
  }
  
  /**
   * Wrap một async function với circuit breaker
   * @param {string} providerId - Provider ID
   * @param {Function} fn - Async function cần wrap
   * @returns {Function} - Wrapped function
   */
  wrap(providerId, fn) {
    return async (...args) => {
      const breaker = this.getBreaker(providerId);
      const canExecute = breaker.canExecute();
      
      if (!canExecute.allowed) {
        const error = new Error(canExecute.reason || `Circuit breaker OPEN for ${providerId}`);
        error.code = 'CIRCUIT_OPEN';
        error.retryAfter = canExecute.retryAfter;
        error.providerId = providerId;
        throw error;
      }
      
      try {
        const result = await fn(...args);
        breaker.recordSuccess();
        return result;
      } catch (err) {
        breaker.recordFailure(err);
        throw err;
      }
    };
  }
  
  /**
   * Middleware để check circuit breaker trước khi route
   * @param {string} providerId - Provider ID
   * @returns {Function} - Express middleware
   */
  middleware(providerId) {
    return (req, res, next) => {
      const breaker = this.getBreaker(providerId);
      const canExecute = breaker.canExecute();
      
      if (!canExecute.allowed) {
        const retryAfter = canExecute.retryAfter || 30000;
        return res.status(503).json({
          error: {
            message: `Provider ${providerId} is temporarily unavailable. Please retry after ${Math.ceil(retryAfter / 1000)} seconds.`,
            type: 'service_unavailable',
            code: 'CIRCUIT_OPEN',
            retryAfter: Math.ceil(retryAfter / 1000),
            providerId,
          },
        });
      }
      
      // Attach breaker to request for later use
      req.circuitBreaker = breaker;
      next();
    };
  }
}

// Singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreakerManager,
  ProviderCircuitBreaker,
  CIRCUIT_STATES,
  circuitBreakerManager,
  // Export singleton
  default: circuitBreakerManager,
};
