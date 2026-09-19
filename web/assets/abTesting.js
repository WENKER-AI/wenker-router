/**
 * A/B Testing Framework for WENKER ADS
 * Tuần 3 - Frontend: Thêm A/B Testing
 * 
 * Features:
 * - Tạo experiments với variants
 * - Phân chia traffic (50/50, custom ratio)
 * - Tracking conversion
 * - Lưu kết quả vào localStorage
 */

class ABTesting {
  constructor() {
    this.experiments = new Map();
    this.userGroups = new Map();
    this.init();
  }

  /**
   * Khởi tạo A/B Testing framework
   */
  init() {
    // Load user assignments from localStorage
    const savedAssignments = localStorage.getItem('abtest_assignments');
    if (savedAssignments) {
      try {
        this.userGroups = new Map(JSON.parse(savedAssignments));
      } catch (e) {
        console.warn('[ABTesting] Error loading assignments:', e);
      }
    }

    // Auto-track page views
    this.trackPageView();
  }

  /**
   * Đăng ký một experiment mới
   * @param {string} name - Tên experiment
   * @param {Array<string>} variants - Các variant (A, B, C, ...)
   * @param {number} traffic - Tỷ lệ traffic tham gia (0-1, mặc định 1)
   * @param {Object} weights - Trọng số cho từng variant (tùy chọn)
   */
  addExperiment(name, variants, traffic = 1, weights = null) {
    if (this.experiments.has(name)) {
      console.warn(`[ABTesting] Experiment "${name}" đã tồn tại`);
      return;
    }

    // Validate variants
    if (!variants || variants.length < 2) {
      throw new Error('[ABTesting] Experiment cần ít nhất 2 variants');
    }

    // Default weights (equal distribution)
    if (!weights) {
      weights = {};
      variants.forEach((v) => (weights[v] = 1 / variants.length));
    }

    this.experiments.set(name, {
      name,
      variants,
      traffic,
      weights,
      createdAt: new Date().toISOString(),
    });

    console.log(`[ABTesting] Experiment "${name}" đăng ký với variants:`, variants);
  }

  /**
   * Lấy variant được chọn cho user
   * @param {string} experimentName - Tên experiment
   * @returns {string|null} Variant được chọn
   */
  getVariant(experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      console.warn(`[ABTesting] Experiment "${experimentName}" không tồn tại`);
      return null;
    }

    // Check if user is already assigned
    const userId = this.getUserId();
    const key = `${experimentName}_${userId}`;
    
    if (this.userGroups.has(key)) {
      return this.userGroups.get(key);
    }

    // Check if user is in traffic
    if (Math.random() > experiment.traffic) {
      // User not in experiment traffic
      this.userGroups.set(key, null);
      this.saveAssignments();
      return null;
    }

    // Assign user to a variant based on weights
    const variant = this.getWeightedRandom(experiment.variants, experiment.weights);
    this.userGroups.set(key, variant);
    this.saveAssignments();

    console.log(`[ABTesting] User ${userId} assigned to variant "${variant}" in experiment "${experimentName}"`);
    
    // Track assignment
    this.trackEvent(experimentName, 'assignment', variant);

    return variant;
  }

  /**
   * Chọn random có trọng số
   * @param {Array<string>} items - Danh sách items
   * @param {Object} weights - Trọng số cho từng item
   * @returns {string} Item được chọn
   */
  getWeightedRandom(items, weights) {
    const totalWeight = items.reduce((sum, item) => sum + (weights[item] || 0), 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= weights[item] || 0;
      if (random <= 0) {
        return item;
      }
    }

    return items[0];
  }

  /**
   * Track conversion
   * @param {string} experimentName - Tên experiment
   * @param {string} goal - Mục tiêu conversion
   * @param {Object} metadata - Metadata bổ sung
   */
  trackConversion(experimentName, goal, metadata = {}) {
    const variant = this.getVariant(experimentName);
    if (!variant) return;

    const eventData = {
      experiment: experimentName,
      variant,
      goal,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Log conversion locally (no external analytics)
    this.saveConversion(eventData);
    console.log(`[ABTesting] Conversion tracked:`, eventData);
  }

  /**
   * Track page view
   */
  trackPageView() {
    const userId = this.getUserId();
    const sessionId = this.getSessionId();

    // Track page view cho tất cả experiments
    this.experiments.forEach((experiment, name) => {
      const variant = this.getVariant(name);
      if (variant) {
        const eventData = {
          experiment: name,
          variant,
          event: 'page_view',
          userId,
          sessionId,
          timestamp: new Date().toISOString(),
        };

        // Log page view locally (no external analytics)
        console.log('[ABTesting] Page view tracked:', eventData);
      }
    });
  }

  /**
   * Lấy user ID (sử dụng localStorage hoặc sinh mới)
   * @returns {string} User ID
   */
  getUserId() {
    let userId = localStorage.getItem('abtest_user_id');
    if (!userId) {
      userId = this.generateId();
      localStorage.setItem('abtest_user_id', userId);
    }
    return userId;
  }

  /**
   * Lấy session ID (sinh mới cho mỗi session)
   * @returns {string} Session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('abtest_session_id');
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem('abtest_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Sinh ID ngẫu nhiên
   * @returns {string} ID ngẫu nhiên
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Lưu assignments vào localStorage
   */
  saveAssignments() {
    const assignments = Array.from(this.userGroups.entries());
    localStorage.setItem('abtest_assignments', JSON.stringify(assignments));
  }

  /**
   * Lưu conversion vào localStorage
   * @param {Object} conversionData - Dữ liệu conversion
   */
  saveConversion(conversionData) {
    const conversions = JSON.parse(localStorage.getItem('abtest_conversions') || '[]');
    conversions.push(conversionData);
    localStorage.setItem('abtest_conversions', JSON.stringify(conversions));
  }

  /**
   * Lấy tất cả conversions
   * @returns {Array<Object>} Danh sách conversions
   */
  getConversions() {
    return JSON.parse(localStorage.getItem('abtest_conversions') || '[]');
  }

  /**
   * Lấy thống kê experiment
   * @param {string} experimentName - Tên experiment
   * @returns {Object} Thống kê
   */
  getExperimentStats(experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return null;
    }

    const conversions = this.getConversions();
    const experimentConversions = conversions.filter(
      (c) => c.experiment === experimentName
    );

    const stats = {
      name: experimentName,
      totalViews: 0,
      totalConversions: experimentConversions.length,
      variants: {},
    };

    // Đếm views cho từng variant
    this.userGroups.forEach((variant, key) => {
      if (key.startsWith(`${experimentName}_`)) {
        stats.totalViews++;
        if (variant) {
          stats.variants[variant] = (stats.variants[variant] || 0) + 1;
        }
      }
    });

    // Đếm conversions cho từng variant
    experiment.variants.forEach((variant) => {
      const variantConversions = experimentConversions.filter(
        (c) => c.variant === variant
      );
      stats.variants[variant] = {
        ...stats.variants[variant],
        conversions: variantConversions.length,
        conversionRate: stats.totalViews > 0 
          ? (variantConversions.length / stats.totalViews) * 100 
          : 0,
      };
    });

    return stats;
  }

  /**
   * Xóa tất cả dữ liệu A/B Testing
   */
  clearAll() {
    localStorage.removeItem('abtest_assignments');
    localStorage.removeItem('abtest_conversions');
    localStorage.removeItem('abtest_user_id');
    this.userGroups.clear();
    console.log('[ABTesting] All data cleared');
  }
}

// Tạo instance global
const abTesting = new ABTesting();

// Export cho các modules khác dùng
if (typeof module !== 'undefined' && module.exports) {
  module.exports = abTesting;
}

// Gán vào window cho browser
if (typeof window !== 'undefined') {
  window.ABTesting = abTesting;
}
