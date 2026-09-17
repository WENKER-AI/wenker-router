/**
 * Input Validation & Secret Leak Guard for WENKER Router
 * 
 * Thiết kế thân thiện với AI Developer & Coding Agents (Cursor, Claude Code, Cline, Aider):
 * - Tuyệt đối KHÔNG HTML-escape ký tự code (<, >, &, ", ', /)
 * - Tuyệt đối KHÔNG chặn từ khóa lập trình (import, require, exec, shell, bash)
 * - Hỗ trợ cả text content và multimodal array content
 * - Cung cấp cơ chế DLP cảnh báo rò rỉ secret (Private Keys, Cloud API Keys) mà không làm hỏng prompt
 */

// Các mẫu secret thực sự nhạy cảm cần cảnh báo nếu dev vô tình gửi lên cloud
const SENSITIVE_SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/ },
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Anthropic Key in Prompt', regex: /sk-ant-api03-[a-zA-Z0-9_-]{80,}/ },
  { name: 'OpenAI Key in Prompt', regex: /sk-proj-[a-zA-Z0-9_-]{40,}/ },
];

/**
 * Kiểm tra xem prompt có vô tình chứa secret nhạy cảm hay không (DLP check)
 * @param {string} content - Nội dung text cần kiểm tra
 * @returns {Object} - { hasSecrets: boolean, findings: string[], sanitized: string }
 */
function checkSensitiveSecrets(content) {
  if (!content || typeof content !== 'string') {
    return { hasSecrets: false, findings: [], sanitized: content };
  }

  const findings = [];
  for (const { name, regex } of SENSITIVE_SECRET_PATTERNS) {
    if (regex.test(content)) {
      findings.push(name);
    }
  }

  // Luôn giữ nguyên vẹn nội dung prompt cho coding tools, không biến dạng code
  return {
    hasSecrets: findings.length > 0,
    findings,
    sanitized: content,
  };
}

/**
 * Validate cấu trúc message của OpenAI / Anthropic
 * @param {Array} messages - Mảng tin nhắn
 * @returns {Object} - { isValid: boolean, errors: Array, messages: Array }
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return {
      isValid: false,
      errors: ['Messages must be an array'],
      messages: [],
    };
  }

  if (messages.length === 0) {
    return {
      isValid: false,
      errors: ['Messages array cannot be empty'],
      messages: [],
    };
  }

  const errors = [];
  const validRoles = ['system', 'user', 'assistant', 'tool', 'function'];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (!msg || typeof msg !== 'object') {
      errors.push(`Message at index ${i}: must be an object`);
      continue;
    }

    if (!msg.role || !validRoles.includes(String(msg.role).toLowerCase())) {
      errors.push(`Message at index ${i}: invalid role "${msg.role}"`);
    }

    // Hỗ trợ cả string và array content (multimodal vision/audio)
    const hasValidContent =
      msg.role === 'tool' ||
      typeof msg.content === 'string' ||
      Array.isArray(msg.content) ||
      msg.content === null ||
      typeof msg.tool_calls === 'object';

    if (!hasValidContent) {
      errors.push(`Message at index ${i}: content must be a string or array of parts`);
    }

    // Kiểm tra rò rỉ secret (chỉ ghi log cảnh báo, không phá hỏng prompt)
    if (typeof msg.content === 'string') {
      const secretCheck = checkSensitiveSecrets(msg.content);
      if (secretCheck.hasSecrets) {
        console.warn(
          `[DLP Warning] Phát hiện secret nhạy cảm trong message index ${i}:`,
          secretCheck.findings.join(', ')
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    messages,
  };
}

/**
 * Validate tên model
 * @param {string} model - Model ID
 * @returns {Object} - { isValid: boolean, error: string|null, model: string }
 */
function validateModel(model) {
  if (!model || typeof model !== 'string') {
    return { isValid: false, error: 'Model must be a non-empty string', model: '' };
  }

  const trimmed = model.trim();
  if (trimmed.length === 0 || trimmed.length > 256) {
    return { isValid: false, error: 'Model name must be between 1 and 256 characters', model: trimmed };
  }

  return { isValid: true, error: null, model: trimmed };
}

/**
 * Validate request body cho chat completion
 * @param {Object} body - Request body
 * @returns {Object} - { isValid: boolean, errors: Array, body: Object }
 */
function validateChatCompletionBody(body) {
  const errors = [];

  if (!body || typeof body !== 'object') {
    return { isValid: false, errors: ['Request body must be an object'], body };
  }

  // Validate model nếu có truyền
  if (body.model) {
    const modelValidation = validateModel(body.model);
    if (!modelValidation.isValid) {
      errors.push(modelValidation.error);
    }
  }

  // Validate messages
  if (body.messages) {
    const msgValidation = validateMessages(body.messages);
    if (!msgValidation.isValid) {
      errors.push(...msgValidation.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    body,
  };
}

/**
 * Input sanitizer / validator middleware cho WENKER Router
 * Bảo đảm an toàn schema mà không can thiệp biến dạng code của người dùng.
 */
function inputSanitizer(req, res, next) {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }

    const path = (req.path || '').toLowerCase();

    if (path.includes('/chat/completions') || path.includes('/messages')) {
      const validation = validateChatCompletionBody(req.body);

      // Nếu thiếu trường bắt buộc hoặc format hoàn toàn sai, trả 400
      if (!validation.isValid) {
        return res.status(400).json({
          error: {
            message: `Validation failed: ${validation.errors.join(', ')}`,
            type: 'invalid_request_error',
            code: 'validation_failed',
          },
        });
      }
    }

    next();
  } catch (err) {
    console.error('[InputSanitizer] Unexpected error, passing through:', err);
    next();
  }
}

module.exports = {
  inputSanitizer,
  validateModel,
  validateMessages,
  validateChatCompletionBody,
  checkSensitiveSecrets,
};
