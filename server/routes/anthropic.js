const express = require('express');
const router = express.Router();
const db = require('../services/dbService');
const proxyService = require('../services/proxyService');

function authenticateAnthropicKey(req, res, next) {
  const authKey = req.headers['x-api-key'] || req.headers.authorization || '';
  if (!authKey) {
    req.wenkerKey = 'sk-wenker-free-playground';
    return next();
  }
  const validKey = db.validateKey(authKey);
  if (validKey) {
    req.wenkerKey = validKey.key;
    return next();
  }
  req.wenkerKey = authKey;
  next();
}

/**
 * POST /v1/messages
 * Anthropic Claude Code & Cursor native messages endpoint
 */
router.post('/messages', authenticateAnthropicKey, async (req, res) => {
  try {
    await proxyService.handleAnthropicMessages({
      req,
      res,
      body: req.body,
      wenkerKey: req.wenkerKey,
    });
  } catch (err) {
    console.error('Anthropic Route Error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        type: 'error',
        error: {
          type: 'api_error',
          message: err.message || 'Internal Server Error',
        },
      });
    }
  }
});

module.exports = router;
