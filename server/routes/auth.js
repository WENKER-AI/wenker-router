/**
 * WENKER Auth / Quota routes
 *
 * The web UI is gated by a tiny "are you a human?" passcode screen: no username,
 * just a one-digit code (1..9) that is printed on the screen itself. Each digit is
 * a separate local user, which is what the WENKER Cloud daily quota is counted against.
 *
 * Note: this gate protects the *dashboard/UI*. The /v1 API keys keep working exactly as
 * before, so external clients (Claude Code, Cursor, scripts) are never blocked.
 */

const express = require('express');
const router = express.Router();
const db = require('../services/dbService');

function readToken(req) {
  return req.headers['x-wenker-session'] || req.headers['authorization'] || req.query.session || '';
}

// The passcodes are shown on the login screen on purpose - this is a human check,
// not a secret. 1..9, one user per digit.
router.get('/pins', (req, res) => {
  res.json({
    pins: db.pins,
    hint: 'Nhap mat khau la 1 ky tu so tu 1 den 9 (in o man hinh dang nhap).',
    dailyLimit: Number(db.settings.wenkerCloudDailyLimit ?? 50),
    adCreditAmount: db.getUserByPin('1').adCreditAmount,
    adCreditsMax: db.getUserByPin('1').adCreditsMax,
  });
});

router.post('/login', (req, res) => {
  const pin = String(req.body?.pin ?? '').trim();
  if (!db.pins.includes(pin)) {
    return res.status(401).json({
      success: false,
      error: 'Sai mat khau xac minh. Mat khau la 1 ky tu so tu 1 den 9.',
    });
  }
  const session = db.createSession(pin);
  res.json({
    success: true,
    token: session.token,
    pin,
    quota: db.getQuota(pin),
  });
});

router.post('/logout', (req, res) => {
  db.clearSession(
    String(readToken(req))
      .replace(/^Bearer\s+/i, '')
      .trim(),
  );
  res.json({ success: true });
});

// Used by the UI on boot (and after reload) to confirm the stored session is still valid.
router.get('/session', (req, res) => {
  const session = db.validateSession(readToken(req));
  if (!session) {
    return res.status(401).json({ success: false, error: 'Phien dang nhap khong hop le.' });
  }
  res.json({ success: true, pin: session.pin, quota: db.getQuota(session.pin) });
});

router.get('/quota', (req, res) => {
  const session = db.validateSession(readToken(req));
  if (!session) {
    return res.status(401).json({ success: false, error: 'Phien dang nhap khong hop le.' });
  }
  res.json({ success: true, pin: session.pin, quota: db.getQuota(session.pin) });
});

/**
 * Post /api/quota/ad-credit
 * Called when the user finishes watching a sponsored ad page. Grants +N requests
 * for today (bonus is capped per day, see adCreditsMax in ~/.wenker/users.json).
 */
router.post('/quota/ad-credit', (req, res) => {
  const session = db.validateSession(readToken(req));
  if (!session) {
    return res.status(401).json({ success: false, error: 'Phien dang nhap khong hop le.' });
  }
  const result = db.grantAdCredit(session.pin);
  res.json({
    success: true,
    granted: result.granted,
    bonus: result.bonus || 0,
    reason: result.reason || null,
    quota: result.quota,
  });
});

module.exports = router;
