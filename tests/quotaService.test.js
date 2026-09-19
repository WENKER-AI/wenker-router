/**
 * Unit Tests for Quota Service
 */

process.env.NODE_ENV = 'test';
const chai = require('chai');
const { expect } = chai;
const db = require('../server/services/dbService');

describe('Quota Service (via dbService)', function () {
  
  beforeEach(() => {
    // Reset users by clearing the users file and letting it reinitialize
    db.users = {};
    db.writeJsonFile(db.USERS_FILE, {});
    // Re-initialize
    db.init();
  });
  
  describe('getQuota', () => {
    it('should return quota info for a user', () => {
      const quota = db.getQuota('1');
      expect(quota).to.have.property('pin', '1');
      expect(quota).to.have.property('day');
      expect(quota).to.have.property('dailyLimit');
      expect(quota).to.have.property('unlimited');
      expect(quota).to.have.property('used');
      expect(quota).to.have.property('remaining');
      expect(quota).to.have.property('exhausted');
    });
    
    it('should handle anonymous users', () => {
      const quota = db.getQuota('anon:192.168.1.1:Mozilla');
      expect(quota).to.have.property('pin', 'anon:192.168.1.1:Mozilla');
    });
  });
  
  describe('quotaAllows', () => {
    it('should allow requests within limit', () => {
      const allows = db.quotaAllows('1', 1000);
      expect(allows).to.be.true;
    });
    
    it('should deny when exhausted', () => {
      // Exhaust the quota
      const user = db.getQuota('1');
      user.used = user.dailyLimit;
      db.writeJsonFile(db.USERS_FILE, db.users);
      
      const allows = db.quotaAllows('1', 1000);
      expect(allows).to.be.false;
    });
    
    it('should deny when token cap exceeded', () => {
      const user = db.getQuota('1');
      user.tokens = user.dailyLimit * 6000; // QUOTA_TOKENS_PER_REQUEST
      db.writeJsonFile(db.USERS_FILE, db.users);
      
      const allows = db.quotaAllows('1', 1000);
      expect(allows).to.be.false;
    });
  });
  
  describe('chargeQuota', () => {
    it('should increment usage', () => {
      const before = db.getQuota('1');
      db.chargeQuota('1', 500);
      const after = db.getQuota('1');
      
      expect(after.used).to.equal(before.used + 1);
      expect(after.tokens).to.equal(before.tokens + 500);
    });
  });
  
  describe('grantAdCredit', () => {
    it('should grant bonus quota', () => {
      const result = db.grantAdCredit('1');
      expect(result.granted).to.be.true;
      expect(result.bonus).to.equal(10); // AD_CREDIT_AMOUNT
      
      const quota = db.getQuota('1');
      expect(quota.dailyLimit).to.be.greaterThan(50); // DEFAULT_DAILY_LIMIT + bonus
    });
    
    it('should deny when max ad credits reached', () => {
      const user = db.getQuota('1');
      user.bonusUsed = 30; // AD_CREDITS_MAX_PER_DAY
      db.writeJsonFile(db.USERS_FILE, db.users);
      
      const result = db.grantAdCredit('1');
      expect(result.granted).to.be.false;
    });
  });
  
  describe('setDailyLimit', () => {
    it('should update daily limit', () => {
      const quota = db.setDailyLimit('1', 100);
      expect(quota.dailyLimit).to.equal(100);
    });
    
    it('should clamp to valid range', () => {
      const quota = db.setDailyLimit('1', -10);
      expect(quota.dailyLimit).to.equal(0);
      
      const quota2 = db.setDailyLimit('1', 200000);
      expect(quota2.dailyLimit).to.equal(100000);
    });
  });
});