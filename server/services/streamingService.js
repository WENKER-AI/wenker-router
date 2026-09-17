/**
 * Streaming Service for WENKER Router
 * 
 * Cung cấp SSE (Server-Sent Events) streaming support cho:
 * - OpenAI Chat Completions
 * - Anthropic Messages
 * - Custom providers
 * 
 * Features:
 * - Transform upstream streaming responses
 * - Handle client disconnect
 * - Reconnect logic
 * - Buffering
 */

const db = require('./dbService');
const proxyService = require('./proxyService');

class StreamingService {
  constructor() {
    // Client connection tracking
    this.activeStreams = new Map(); // streamId -> { req, res, controller, provider, model }
    this.streamCounter = 0;
  }

  /**
   * Generate unique stream ID
   * @returns {string}
   */
  _generateStreamId() {
    return `stream_${Date.now()}_${++this.streamCounter}`;
  }

  /**
   * Setup SSE headers for response
   * @param {Object} res - Express response
   */
  setupSSEHeaders(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
    
    // Send connection established message
    res.write('event: connected\n\n');
  }

  /**
   * Send SSE event
   * @param {Object} res - Express response
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @param {string} id - Optional event ID
   */
  sendEvent(res, event, data, id = null) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    let message = `event: ${event}\n`;
    message += `data: ${payload}\n`;
    if (id) {
      message += `id: ${id}\n`;
    }
    message += '\n';
    
    try {
      res.write(message);
    } catch (err) {
      // Client đã disconnect
      console.log('[Streaming] Client disconnected during stream');
    }
  }

  /**
   * Send error event và close stream
   * @param {Object} res - Express response
   * @param {Error} error - Error object
   * @param {string} streamId - Stream ID
   */
  sendError(res, error, streamId) {
    const errorData = {
      error: {
        message: error.message || 'Stream error',
        type: error.type || 'stream_error',
        code: error.code || 'STREAM_ERROR',
      },
      streamId,
    };
    
    this.sendEvent(res, 'error', errorData);
    this.closeStream(streamId);
  }

  /**
   * Close and cleanup stream
   * @param {string} streamId - Stream ID
   */
  closeStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      // Cancel ongoing request
      if (stream.controller) {
        stream.controller.abort();
      }
      
      // Remove from active streams
      this.activeStreams.delete(streamId);
      
      console.log(`[Streaming] Closed stream ${streamId}`);
    }
  }

  /**
   * Handle client disconnect
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {string} streamId - Stream ID
   */
  handleClientDisconnect(req, res, streamId) {
    console.log(`[Streaming] Client disconnected from stream ${streamId}`);
    this.closeStream(streamId);
  }

  /**
   * Transform OpenAI streaming response to SSE format
   * OpenAI streaming: data: {...}\n\n
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} provider - Provider config
   * @param {string} targetModel - Target model
   * @param {Array} messages - Chat messages
   * @param {Object} options - Additional options
   */
  async handleOpenAIStream(req, res, provider, targetModel, messages, options = {}) {
    const streamId = this._generateStreamId();
    
    this.setupSSEHeaders(res);
    
    // Setup cleanup on client disconnect
    req.on('close', () => this.handleClientDisconnect(req, res, streamId));
    req.on('aborted', () => this.handleClientDisconnect(req, res, streamId));
    
    const controller = new AbortController();
    const { signal } = controller;
    
    // Track active stream
    this.activeStreams.set(streamId, { req, res, controller, provider, targetModel, streamId });
    
    try {
      // Send stream start event
      this.sendEvent(res, 'stream_start', {
        streamId,
        provider: provider.id,
        model: targetModel,
        timestamp: new Date().toISOString(),
      }, streamId);
      
      const base = String(provider.baseUrl || '').replace(/\/+$/, '');
      const url = base.endsWith('/chat/completions') 
        ? base 
        : `${base}/chat/completions`;
      
      const apiKey = provider.userApiKey || '';
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'WENKER-Router/2.0',
      };
      
      if (apiKey) {
        if (provider.authType === 'api-key') {
          headers[provider.headerName || 'x-api-key'] = apiKey;
        } else if (provider.authType === 'cookie') {
          headers['Cookie'] = provider.userCookie || apiKey;
        } else {
          headers['Authorization'] = provider.authType === 'bearer' 
            ? `Bearer ${apiKey}` 
            : apiKey;
        }
      }
      
      const body = {
        model: targetModel,
        messages,
        stream: true,
        ...options,
      };
      
      // Remove non-streaming compatible options
      delete body.stream;
      
      console.log(`[Streaming] Starting stream to ${provider.id} for model ${targetModel}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
      
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Upstream error: ${response.status} ${text.slice(0, 200)}`);
      }
      
      if (!response.body) {
        throw new Error('No response body from upstream');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Send stream end event
          this.sendEvent(res, 'stream_end', {
            streamId,
            timestamp: new Date().toISOString(),
          }, streamId);
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Process complete lines
        while (buffer.includes('\n\n')) {
          const lineEnd = buffer.indexOf('\n\n');
          const line = buffer.substring(0, lineEnd);
          buffer = buffer.substring(lineEnd + 2);
          
          if (line.startsWith('data:')) {
            const dataStr = line.substring(5).trim();
            
            if (dataStr === '[DONE]') {
              // Send completion event
              this.sendEvent(res, 'completion', {
                streamId,
                done: true,
                timestamp: new Date().toISOString(),
              }, streamId);
            } else {
              try {
                const data = JSON.parse(dataStr);
                
                // Forward chunk to client
                this.sendEvent(res, 'chunk', {
                  streamId,
                  data,
                  timestamp: new Date().toISOString(),
                }, streamId);
                
                // Check if this is the final chunk
                if (data.choices?.[0]?.finish_reason) {
                  this.sendEvent(res, 'completion', {
                    streamId,
                    finish_reason: data.choices[0].finish_reason,
                    timestamp: new Date().toISOString(),
                  }, streamId);
                }
              } catch (err) {
                console.error('[Streaming] Error parsing chunk:', err);
              }
            }
          }
        }
      }
      
      // Cleanup
      reader.releaseLock();
      this.activeStreams.delete(streamId);
      
    } catch (err) {
      console.error(`[Streaming] Error in stream ${streamId}:`, err);
      this.sendError(res, err, streamId);
    }
  }

  /**
   * Handle streaming chat completion request
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Object} body - Request body
   */
  async handleChatCompletionStream(req, res, body) {
    const startTime = Date.now();
    const { model, stream = false, temperature, max_tokens, tools, tool_choice, ...rest } = body;
    
    // Validate stream parameter
    if (!stream || stream !== true) {
      return res.status(400).json({
        error: {
          message: 'Stream must be true for streaming requests',
          type: 'invalid_request_error',
          code: 'stream_required',
        },
      });
    }
    
    // Normalize messages
    const messages = this.normalizeMessages(body.messages);
    
    if (messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Messages array cannot be empty',
          type: 'invalid_request_error',
          code: 'empty_messages',
        },
      });
    }
    
    // Resolve provider and model
    const resolved = proxyService.resolveProviderAndModel(model);
    const provider = resolved.provider;
    const targetModel = resolved.targetModel;
    
    if (!provider) {
      return res.status(404).json({
        error: {
          message: `Provider not found for model "${model}"`,
          type: 'invalid_request_error',
          code: 'provider_not_found',
        },
      });
    }
    
    if (!resolved.known && db.getSettings().strictModelResolution !== false) {
      // Return model not found error
      return proxyService._modelNotFound(res, model, provider);
    }
    
    // Check if provider supports streaming
    if (!this.doesProviderSupportStreaming(provider)) {
      return res.status(400).json({
        error: {
          message: `Provider ${provider.id} does not support streaming`,
          type: 'invalid_request_error',
          code: 'streaming_not_supported',
        },
      });
    }
    
    // Check if model is non-chat
    if (proxyService.isNonChatProvider(provider)) {
      return res.status(400).json({
        error: {
          message: `Model ${model} is not a chat model and cannot stream`,
          type: 'invalid_request_error',
          code: 'non_chat_model',
        },
      });
    }
    
    // Build options object
    const options = {
      temperature,
      max_tokens,
      tools,
      tool_choice,
      ...rest,
    };
    
    // Start streaming
    try {
      await this.handleOpenAIStream(
        req, 
        res, 
        provider, 
        targetModel, 
        messages,
        options
      );
    } catch (err) {
      console.error('[Streaming] Error starting stream:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            message: err.message || 'Failed to start streaming',
            type: 'internal_error',
            code: 'stream_start_failed',
          },
        });
      }
    }
  }

  /**
   * Check if provider supports streaming
   * @param {Object} provider - Provider config
   * @returns {boolean}
   */
  doesProviderSupportStreaming(provider) {
    // Most modern providers support streaming
    // Only block known non-streaming providers
    const nonStreamingProviders = [
      'pollinations',
      'duckduckgo',
    ];
    
    return !nonStreamingProviders.includes(provider.id);
  }

  /**
   * Normalize messages (copy from freeProxyService)
   * @param {Array} messages - Input messages
   * @returns {Array} - Normalized messages
   */
  normalizeMessages(messages) {
    if (!messages) return [];
    
    return messages.map(msg => {
      if (!msg || typeof msg !== 'object') return { role: 'user', content: '' };
      
      const normalized = { ...msg };
      
      // Ensure role is valid
      if (!['system', 'user', 'assistant', 'tool'].includes(normalized.role?.toLowerCase())) {
        normalized.role = 'user';
      }
      
      // Ensure content is string
      if (normalized.content && typeof normalized.content !== 'string') {
        normalized.content = String(normalized.content);
      }
      
      return normalized;
    });
  }

  /**
   * Close all active streams (for shutdown)
   */
  closeAllStreams() {
    for (const [streamId, stream] of this.activeStreams) {
      this.closeStream(streamId);
    }
    this.activeStreams.clear();
    console.log('[Streaming] Closed all active streams');
  }

  /**
   * Get active stream count
   * @returns {number}
   */
  getActiveStreamCount() {
    return this.activeStreams.size;
  }
}

// Singleton instance
const streamingService = new StreamingService();

module.exports = streamingService;
