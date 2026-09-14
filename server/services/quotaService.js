/**
 * WENKER Quota Service
 *
 * WENKER Cloud is a shared free upstream, so its usage is metered per consumer to
 * keep one person from exhausting it for everyone (the upstream itself answers 402
 * once the anonymous budget is gone). A "subject" is:
 *   - a logged-in UI user  -> pin "1".."9"        (enforced, ad bonus available)
 *   - an API key consumer  -> "key:<api key>"     (tracked; enforced only if configured)
 *   - anonymous API client -> "anon:<ip>"         (tracked; not enforced by default)
 *
 * When the allowance is spent we answer HTTP 409 (conflict: quota state, not a bad
 * request) with the exact message the clients are expected to surface.
 */

const db = require('./dbService');

const QUOTA_EXHAUSTED_MESSAGE =
  'You have used up your quota for today; please try a different model.';

const QUOTA_EXHAUSTED_HINT =
  'Het luot WENKER Cloud cua hom nay. Doi sang model cua nha cung cap khac (da nhap API Key) ' +
  'hoac xem quang cao de nhan them luot chat.';

function cleanToken(value) {
  return String(value || '').replace(/^Bearer\s+/i, '').trim();
}

/**
 * Resolve who is paying for this request. The UI sends its login token on /v1 calls,
 * so the same person is metered no matter which model alias they picked.
 */
function resolveSubject(req) {
  const session = db.validateSession(req.headers['x-wenker-session'] || req.headers.authorization);
  if (session) {
    return {
      id: session.pin,
      kind: 'user',
      pin: session.pin,
      enforce: true,
      adBonusAllowed: true
    };
  }

  const rawKey = cleanToken(req.headers['x-api-key'] || req.headers.authorization);
  if (rawKey) {
    const known = db.validateKey(rawKey);
    return {
      id: `key:${known ? known.key : rawKey}`,
      kind: 'key',
      pin: known ? known.name : rawKey,
      enforce: Boolean(db.getSettings().enforceApiKeyQuota),
      adBonusAllowed: false
    };
  }

  return {
    id: `anon:${req.ip || req.headers['x-forwarded-for'] || 'local'}`,
    kind: 'anon',
    enforce: Boolean(db.getSettings().enforceAnonymousQuota),
    adBonusAllowed: false
  };
}

function isUnlimited(subject) {
  // Unlimited == dailyLimit set to 0 (or the consumer is not metered at all).
  if (!subject || !subject.enforce) return true;
  const quota = db.getQuota(subject.id);
  return quota.unlimited;
}

/**
 * Pre-flight check. Returns true when the request may proceed.
 * estimatedTokens is the prompt size so an oversized request cannot smuggle itself in.
 */
function tryConsume(subject, estimatedTokens = 0) {
  if (isUnlimited(subject)) return true;
  return db.quotaAllows(subject.id, estimatedTokens);
}

/**
 * Charge one finished request. prompt+completion throughput decides how many
 * "requests" it costs, so a huge prompt burns more of the daily allowance.
 */
function commit(subject, promptTokens = 0, completionTokens = 0) {
  if (!subject || !subject.enforce) return null;
  const tokens = Math.max(1, Number(promptTokens) || 0) + Math.max(1, Number(completionTokens) || 0);
  return db.chargeQuota(subject.id, tokens);
}

function wantsAnthropicShape(req) {
  return String(req.originalUrl || req.path || '').includes('/messages');
}

/**
 * Emit the 409. Shape follows the endpoint family so Claude Code / Anthropic SDKs
 * parse it as an error object instead of throwing on an unknown field layout.
 */
function respondExhausted(req, res, subject) {
  const quota = subject && subject.enforce ? db.getQuota(subject.id) : null;
  if (wantsAnthropicShape(req)) {
    return res.status(409).json({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        code: 'quota_exhausted',
        message: QUOTA_EXHAUSTED_MESSAGE
      }
    });
  }
  return res.status(409).json({
    error: {
      message: QUOTA_EXHAUSTED_MESSAGE,
      type: 'invalid_request_error',
      param: null,
      code: 'quota_exhausted',
      hint: QUOTA_EXHAUSTED_HINT,
      quota: quota
    }
  });
}

module.exports = {
  QUOTA_EXHAUSTED_MESSAGE,
  QUOTA_EXHAUSTED_HINT,
  resolveSubject,
  isUnlimited,
  tryConsume,
  commit,
  respondExhausted,
  // Only the genuine anonymous Pollinations pool is metered (wenker-cloud + its
  // free twin). wenker-vip / wenker-community now point at keyed upstreams (izzi /
  // xkiro) and are protected by their own account balance, like openrouter/groq.
  meteredProviders: ['wenker-cloud', 'pollinations']
};
