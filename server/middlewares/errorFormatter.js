/**
 * Standardized Error Response Utility for WENKER Router
 * Ensures consistent error format across all endpoints
 */

const ERROR_CODES = {
  // Authentication errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',
  ADMIN_KEY_REQUIRED: 'ADMIN_KEY_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FREE_QUOTA_EXHAUSTED: 'FREE_QUOTA_EXHAUSTED',
  FREE_RATE_LIMIT_EXCEEDED: 'FREE_RATE_LIMIT_EXCEEDED',
  PREMIUM_RATE_LIMIT_EXCEEDED: 'PREMIUM_RATE_LIMIT_EXCEEDED',
  ADMIN_RATE_LIMIT_EXCEEDED: 'ADMIN_RATE_LIMIT_EXCEEDED',
  HEALTH_RATE_LIMIT_EXCEEDED: 'HEALTH_RATE_LIMIT_EXCEEDED',
  
  // Validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_REQUIRED_PARAMETER: 'MISSING_REQUIRED_PARAMETER',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  UNSUPPORTED_MODALITY: 'UNSUPPORTED_MODALITY',
  TOOLS_NOT_SUPPORTED: 'TOOLS_NOT_SUPPORTED',
  
  // Upstream errors
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  PROVIDER_DOWN: 'PROVIDER_DOWN',
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  
  // Prompt injection
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  CONTENT_POLICY_VIOLATION: 'CONTENT_POLICY_VIOLATION',
};

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  NOT_IMPLEMENTED: 501,
};

const DEFAULT_HINTS = {
  [ERROR_CODES.MISSING_API_KEY]: 'Nhập API Key cho provider trong tab "Nhà Cung Cấp"',
  [ERROR_CODES.INVALID_API_KEY]: 'Kiểm tra lại API Key đã nhập',
  [ERROR_CODES.FREE_QUOTA_EXHAUSTED]: 'Nhập free API key từ OpenRouter/Groq/Gemini/NVIDIA/SambaNova',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Thử lại sau ít phút hoặc nâng cấp tier',
  [ERROR_CODES.MODEL_NOT_FOUND]: 'Dùng format "providerId/modelId" hoặc xem danh sách tại GET /v1/models',
  [ERROR_CODES.UPSTREAM_UNAVAILABLE]: 'Provider đang gặp sự cố, thử model khác hoặc đợi phục hồi',
  [ERROR_CODES.CIRCUIT_OPEN]: 'Provider tạm thời bị chặn do lỗi liên tiếp, tự phục hồi sau 30s',
  [ERROR_CODES.BUDGET_EXHAUSTED]: 'Free tier hết quota, nhập API key để tiếp tục',
  [ERROR_CODES.PROMPT_INJECTION_DETECTED]: 'Nội dung yêu cầu có dấu hiệu tấn công, vui lòng thử lại',
};

/**
 * Create a standardized error response
 * @param {Object} options - Error options
 * @returns {Object} Standardized error response
 */
function createErrorResponse(options) {
  const {
    message,
    type = 'error',
    code = ERROR_CODES.INTERNAL_ERROR,
    param = null,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    hint = null,
    correlationId = null,
    details = null,
  } = options;

  // Use default hint if available
  const finalHint = hint || DEFAULT_HINTS[code] || null;

  const error = {
    error: {
      message,
      type,
      code,
      param,
      ...(finalHint && { hint: finalHint }),
      ...(correlationId && { correlationId }),
      ...(details && { details }),
    },
  };

  return { response: error, statusCode };
}

/**
 * Create OpenAI-compatible error response
 */
function createOpenAIError(options) {
  const { response, statusCode } = createErrorResponse(options);
  return { response, statusCode };
}

/**
 * Create Anthropic-compatible error response
 */
function createAnthropicError(options) {
  const { response, statusCode } = createErrorResponse({
    ...options,
    type: options.type === 'internal_error' ? 'api_error' : 'invalid_request_error',
  });
  
  // Anthropic wraps error in { type: 'error', error: {...} }
  return {
    response: {
      type: 'error',
      error: response.error,
    },
    statusCode,
  };
}

/**
 * Predefined error creators for common cases
 */
const Errors = {
  // Auth errors
  invalidApiKey: (message = 'API Key không hợp lệ hoặc đã hết hạn', correlationId) =>
    createErrorResponse({ message, type: 'authentication_error', code: ERROR_CODES.INVALID_API_KEY, statusCode: HTTP_STATUS.UNAUTHORIZED, correlationId }),
  
  missingApiKey: (message = 'Thiếu API Key', correlationId) =>
    createErrorResponse({ message, type: 'authentication_error', code: ERROR_CODES.MISSING_API_KEY, statusCode: HTTP_STATUS.UNAUTHORIZED, correlationId }),
  
  adminKeyRequired: (message = 'Yêu cầu Admin API Key', correlationId) =>
    createErrorResponse({ message, type: 'authentication_error', code: ERROR_CODES.ADMIN_KEY_REQUIRED, statusCode: HTTP_STATUS.UNAUTHORIZED, correlationId }),
  
  insufficientPermissions: (message = 'Quyền không đủ để thực hiện thao tác này', correlationId) =>
    createErrorResponse({ message, type: 'authentication_error', code: ERROR_CODES.INSUFFICIENT_PERMISSIONS, statusCode: HTTP_STATUS.FORBIDDEN, correlationId }),

  // Rate limit errors
  rateLimitExceeded: (message = 'Rate limit exceeded', tier = 'unknown', limit = 0, correlationId) =>
    createErrorResponse({ 
      message, 
      type: 'rate_limit_exceeded', 
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED, 
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      details: { tier, limit },
      correlationId 
    }),
  
  freeQuotaExhausted: (message = 'Hết quota miễn phí hôm nay', correlationId) =>
    createErrorResponse({ message, type: 'rate_limit_exceeded', code: ERROR_CODES.FREE_QUOTA_EXHAUSTED, statusCode: HTTP_STATUS.TOO_MANY_REQUESTS, correlationId }),

  // Validation errors
  invalidRequest: (message = 'Yêu cầu không hợp lệ', correlationId) =>
    createErrorResponse({ message, type: 'invalid_request_error', code: ERROR_CODES.INVALID_REQUEST, statusCode: HTTP_STATUS.BAD_REQUEST, correlationId }),
  
  missingParameter: (param, message = `Thiếu tham số bắt buộc: ${param}`, correlationId) =>
    createErrorResponse({ message, type: 'invalid_request_error', code: ERROR_CODES.MISSING_REQUIRED_PARAMETER, param, statusCode: HTTP_STATUS.BAD_REQUEST, correlationId }),
  
  modelNotFound: (model, availableModels = [], correlationId) =>
    createErrorResponse({ 
      message: `Model "${model}" không tồn tại`, 
      type: 'invalid_request_error', 
      code: ERROR_CODES.MODEL_NOT_FOUND, 
      param: 'model',
      statusCode: HTTP_STATUS.NOT_FOUND,
      details: { availableModels: availableModels.slice(0, 10) },
      correlationId 
    }),
  
  unsupportedModality: (model, modality, correlationId) =>
    createErrorResponse({ 
      message: `"${model}" là model ${modality}, không hỗ trợ qua /v1/chat/completions`, 
      type: 'invalid_request_error', 
      code: ERROR_CODES.UNSUPPORTED_MODALITY, 
      param: 'model',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details: { modality },
      correlationId 
    }),
  
  toolsNotSupported: (model, providerName, correlationId) =>
    createErrorResponse({ 
      message: `Model "${model}" qua ${providerName} không hỗ trợ tool calling`, 
      type: 'invalid_request_error', 
      code: ERROR_CODES.TOOLS_NOT_SUPPORTED, 
      param: 'tools',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      correlationId 
    }),

  // Upstream errors
  upstreamError: (provider, status, message, correlationId) =>
    createErrorResponse({ 
      message: `Lỗi từ ${provider}: ${message}`, 
      type: 'upstream_error', 
      code: ERROR_CODES.UPSTREAM_ERROR, 
      statusCode: status || HTTP_STATUS.BAD_GATEWAY,
      details: { provider, upstreamStatus: status },
      correlationId 
    }),
  
  upstreamTimeout: (provider, correlationId) =>
    createErrorResponse({ 
      message: `${provider} không phản hồi trong thời gian cho phép`, 
      type: 'upstream_error', 
      code: ERROR_CODES.UPSTREAM_TIMEOUT, 
      statusCode: HTTP_STATUS.GATEWAY_TIMEOUT,
      details: { provider },
      correlationId 
    }),
  
  circuitOpen: (provider, retryAfter, correlationId) =>
    createErrorResponse({ 
      message: `Provider ${provider} tạm thời bị chặn do lỗi liên tiếp`, 
      type: 'service_unavailable', 
      code: ERROR_CODES.CIRCUIT_OPEN, 
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      details: { provider, retryAfter },
      correlationId 
    }),
  
  budgetExhausted: (provider, correlationId) =>
    createErrorResponse({ 
      message: `${provider}: free tier hết quota`, 
      type: 'upstream_error', 
      code: ERROR_CODES.BUDGET_EXHAUSTED, 
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      details: { provider },
      correlationId 
    }),

  // Internal errors
  internalError: (message = 'Lỗi máy chủ nội bộ', correlationId) =>
    createErrorResponse({ message, type: 'internal_error', code: ERROR_CODES.INTERNAL_ERROR, statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR, correlationId }),
  
  notImplemented: (feature = 'Tính năng này', correlationId) =>
    createErrorResponse({ message: `${feature} chưa được triển khai`, type: 'not_implemented', code: ERROR_CODES.NOT_IMPLEMENTED, statusCode: HTTP_STATUS.NOT_IMPLEMENTED, correlationId }),
  
  serviceUnavailable: (message = 'Dịch vụ tạm thời không khả dụng', correlationId) =>
    createErrorResponse({ message, type: 'service_unavailable', code: ERROR_CODES.SERVICE_UNAVAILABLE, statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE, correlationId }),

  // Prompt injection
  promptInjectionDetected: (details, correlationId) =>
    createErrorResponse({ 
      message: 'Phát hiện dấu hiệu prompt injection trong yêu cầu', 
      type: 'security_error', 
      code: ERROR_CODES.PROMPT_INJECTION_DETECTED, 
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details,
      correlationId 
    }),
};

/**
 * Express error handler middleware with standardized format
 */
function standardizedErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  
  const correlationId = req.correlationId || req.headers['x-correlation-id'];
  const isAnthropic = req.originalUrl.startsWith('/v1/messages');
  
  let statusCode = err.status || err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let errorResponse;
  
  if (isAnthropic) {
    errorResponse = Errors.internalError(err.message, correlationId).response;
    errorResponse = { type: 'error', error: errorResponse.error };
  } else {
    errorResponse = Errors.internalError(err.message, correlationId).response;
  }
  
  // Override with specific error types if available
  if (err.code && ERROR_CODES[err.code]) {
    const errorCreator = Errors[camelCase(err.code)];
    if (errorCreator) {
      const { response, statusCode: newStatus } = errorCreator(err.message, correlationId);
      errorResponse = isAnthropic ? { type: 'error', error: response.error } : response;
      statusCode = newStatus;
    }
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Convert snake_case to camelCase
 */
function camelCase(str) {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Middleware to ensure all responses use standardized format
 */
function responseFormatter(req, res, next) {
  const originalJson = res.json;
  const correlationId = req.correlationId || req.headers['x-correlation-id'];
  
  res.json = function(data) {
    // Add correlation ID to all responses if available
    if (correlationId && data && typeof data === 'object' && !data.error) {
      // Only add to success responses, not error responses
      // Error responses already have correlationId via createErrorResponse
    }
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = {
  ERROR_CODES,
  HTTP_STATUS,
  createErrorResponse,
  createOpenAIError,
  createAnthropicError,
  Errors,
  standardizedErrorHandler,
  responseFormatter,
};