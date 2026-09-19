/**
 * Input Sanitization Middleware for WENKER Router
 * Protects against prompt injection, XSS, and other injection attacks
 */

const SANITIZATION_CONFIG = {
  // Maximum length for any single message content
  maxContentLength: 100000,
  // Maximum total messages in a request
  maxMessages: 100,
  // Maximum tool calls in a request
  maxToolCalls: 50,
  // Patterns that indicate potential prompt injection
  injectionPatterns: [
    // Ignore previous instructions
    /ignore\s+(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?)/gi,
    // System prompt override attempts
    /you\s+are\s+(now|from\s+now\s+on)\s+(a|an)\s+/gi,
    // Role manipulation
    /(system|assistant|user)\s*:\s*(ignore|forget|override|bypass)/gi,
    // Data exfiltration attempts
    /(print|show|output|display|reveal|leak)\s+(the\s+)?(system\s+)?(prompt|instructions?|password|key|token|secret)/gi,
    // Chain of thought extraction
    /(show|print|output)\s+(your|the)\s+(reasoning|thinking|chain\s+of\s+thought)/gi,
    // Jailbreak patterns
    /(DAN|Do\s+Anything\s+Now|STAN|DUDE|MONGODB|MongoDB)/gi,
    // Base64/encoding bypass attempts
    /(base64|decode|eval|exec)\s*\(/gi,
    // SQL/NoSQL injection patterns in content
    /(union\s+select|drop\s+table|delete\s+from|insert\s+into|update\s+set)/gi,
    // Script injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ],
  // Characters to strip or escape
  dangerousChars: {
    // Null bytes
    '\0': '',
    // Control characters (except newline, tab, carriage return)
    // These will be handled by the sanitize function
  },
};

/**
 * Sanitize a single string value
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  
  let output = input;
  
  // Remove null bytes
  output = output.replace(/\0/g, '');
  
  // Remove non-printable control characters except \n, \r, \t
  output = output.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (output.length > SANITIZATION_CONFIG.maxContentLength) {
    output = output.slice(0, SANITIZATION_CONFIG.maxContentLength) + '[TRUNCATED]';
  }
  
  return output;
}

/**
 * Check for prompt injection patterns
 * @param {string} content - Content to check
 * @returns {Object} - { safe: boolean, matches: string[] }
 */
function checkInjectionPatterns(content) {
  if (typeof content !== 'string') return { safe: true, matches: [] };
  
  const matches = [];
  for (const pattern of SANITIZATION_CONFIG.injectionPatterns) {
    const found = content.match(pattern);
    if (found) {
      matches.push(...found.map(m => m.slice(0, 100)));
    }
  }
  
  return {
    safe: matches.length === 0,
    matches: [...new Set(matches)], // deduplicate
  };
}

/**
 * Sanitize messages array
 * @param {Array} messages - Array of message objects
 * @returns {Object} - { messages: Array, warnings: string[] }
 */
function sanitizeMessages(messages) {
  // Local reference to avoid potential scoping issues
  const CONFIG = SANITIZATION_CONFIG;
  const warnings = [];
  const sanitized = [];
  
  if (!Array.isArray(messages)) {
    return { messages: [], warnings: ['Messages must be an array'] };
  }
  
  // Limit number of messages
  const limitedMessages = messages.slice(0, CONFIG.maxMessages);
  if (messages.length > CONFIG.maxMessages) {
    warnings.push(`Message count truncated from ${messages.length} to ${CONFIG.maxMessages}`);
  }
  
  for (const msg of limitedMessages) {
    if (!msg || typeof msg !== 'object') continue;
    
    const sanitizedMsg = { ...msg };
    
    // Sanitize role
    const validRoles = ['system', 'user', 'assistant', 'tool', 'function'];
    if (msg.role && !validRoles.includes(msg.role)) {
      sanitizedMsg.role = 'user';
      warnings.push(`Invalid role "${msg.role}" sanitized to "user"`);
    }
    
    // Sanitize content
    if (msg.content !== undefined && msg.content !== null) {
      const originalContent = msg.content;
      sanitizedMsg.content = sanitizeString(String(originalContent));
      
      // Check for injection patterns
      const injectionCheck = checkInjectionPatterns(sanitizedMsg.content);
      if (!injectionCheck.safe) {
        warnings.push(`Potential prompt injection detected: ${injectionCheck.matches.slice(0, 3).join(', ')}`);
        // Don't block, just warn and log - let the model handle it
      }
    }
    
    // Sanitize tool_calls
    if (Array.isArray(msg.tool_calls)) {
      const limitedTools = msg.tool_calls.slice(0, CONFIG.maxToolCalls);
      if (msg.tool_calls.length > CONFIG.maxToolCalls) {
        warnings.push(`Tool calls truncated from ${msg.tool_calls.length} to ${CONFIG.maxToolCalls}`);
      }
      sanitizedMsg.tool_calls = limitedTools.map(tc => {
        if (!tc || typeof tc !== 'object') return tc;
        return {
          ...tc,
          function: tc.function ? {
            name: sanitizeString(String(tc.function?.name || '')),
            arguments: sanitizeString(String(tc.function?.arguments || '')),
          } : undefined,
        };
      });
    }
    
    // Sanitize tool_call_id
    if (msg.tool_call_id) {
      sanitizedMsg.tool_call_id = sanitizeString(String(msg.tool_call_id));
    }
    
    // Sanitize name (for tool messages)
    if (msg.name) {
      sanitizedMsg.name = sanitizeString(String(msg.name));
    }
    
    sanitized.push(sanitizedMsg);
  }
  
  return { messages: sanitized, warnings };
}

/**
 * Express middleware for input sanitization
 * Applies to /v1/chat/completions and /v1/messages endpoints
 */
function inputSanitizer(req, res, next) {
  // Only sanitize chat completion and messages endpoints
  const targetPaths = ['/v1/chat/completions', '/v1/messages'];
  if (!targetPaths.includes(req.path)) {
    return next();
  }
  
  // Skip if no body
  if (!req.body) return next();
  
  try {
    const body = req.body;
    const allWarnings = [];
    
    // Sanitize messages
    if (body.messages) {
      const result = sanitizeMessages(body.messages);
      req.body.messages = result.messages;
      allWarnings.push(...result.warnings);
    }
    
    // Sanitize top-level fields that might contain user input
    const stringFields = ['model', 'user', 'system', 'prompt'];
    for (const field of stringFields) {
      if (body[field] && typeof body[field] === 'string') {
        body[field] = sanitizeString(body[field]);
      }
    }
    
    // Sanitize tools array
    if (Array.isArray(body.tools)) {
      body.tools = body.tools.slice(0, SANITIZATION_CONFIG.maxToolCalls).map(tool => {
        if (!tool || typeof tool !== 'object') return tool;
        return {
          ...tool,
          function: tool.function ? {
            name: sanitizeString(String(tool.function?.name || '')),
            description: sanitizeString(String(tool.function?.description || '')),
            parameters: tool.function?.parameters, // Keep JSON schema as-is
          } : undefined,
        };
      });
    }
    
    // Sanitize tool_choice
    if (body.tool_choice && typeof body.tool_choice === 'object') {
      if (body.tool_choice.function) {
        body.tool_choice.function.name = sanitizeString(String(body.tool_choice.function.name || ''));
      }
    }
    
    // Log warnings if any
    if (allWarnings.length > 0) {
      console.warn('[InputSanitizer] Warnings:', allWarnings);
      // Attach warnings to request for logging
      req.sanitizationWarnings = allWarnings;
    }
    
    next();
  } catch (err) {
    console.error('[InputSanitizer] Error:', err);
    // Don't block on sanitizer errors, just pass through
    next();
  }
}

module.exports = {
  inputSanitizer,
  sanitizeString,
  sanitizeMessages,
  checkInjectionPatterns,
  SANITIZATION_CONFIG,
};