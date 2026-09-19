/**
 * Proactive Health Check Service for WENKER Router
 * Runs periodic health checks on providers in the background
 */

const db = require('./dbService');
const healthService = require('./healthService');

class ProactiveHealthChecker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.config = {
      enabled: true,
      intervalMs: 5 * 60 * 1000, // 5 minutes default
      concurrency: 3,
      timeoutMs: 30000,
      // Only check providers that are enabled and have a valid baseUrl
      probeableProviders: [],
    };
  }

  /**
   * Initialize the health checker with settings
   */
  init(settings = {}) {
    this.config.enabled = settings.enableProactiveHealthCheck !== false;
    this.config.intervalMs = settings.proactiveHealthCheckIntervalMs || this.config.intervalMs;
    this.config.concurrency = settings.proactiveHealthCheckConcurrency || this.config.concurrency;
    this.config.timeoutMs = settings.proactiveHealthCheckTimeoutMs || this.config.timeoutMs;
    
    console.log(`[ProactiveHealthChecker] Initialized: enabled=${this.config.enabled}, interval=${this.config.intervalMs}ms, concurrency=${this.config.concurrency}`);
  }

  /**
   * Start the periodic health check
   */
  start() {
    if (this.intervalId) {
      console.warn('[ProactiveHealthChecker] Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[ProactiveHealthChecker] Disabled by config');
      return;
    }

    // Run once immediately on start
    this.runHealthChecks().catch(err => {
      console.error('[ProactiveHealthChecker] Initial run failed:', err.message);
    });

    // Then schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runHealthChecks().catch(err => {
        console.error('[ProactiveHealthChecker] Periodic run failed:', err.message);
      });
    }, this.config.intervalMs);

    console.log(`[ProactiveHealthChecker] Started with interval ${this.config.intervalMs}ms`);
  }

  /**
   * Stop the periodic health check
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[ProactiveHealthChecker] Stopped');
    }
  }

  /**
   * Run health checks on all eligible providers
   */
  async runHealthChecks() {
    if (this.isRunning) {
      console.log('[ProactiveHealthChecker] Already running, skipping');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const providers = this.getEligibleProviders();
      console.log(`[ProactiveHealthChecker] Checking ${providers.length} providers...`);

      const results = await this.runConcurrentChecks(providers);
      
      const healthy = results.filter(r => r.ok).length;
      const unhealthy = results.filter(r => !r.ok).length;
      const duration = Date.now() - startTime;

      console.log(`[ProactiveHealthChecker] Completed in ${duration}ms: ${healthy} healthy, ${unhealthy} unhealthy`);

      // Log unhealthy providers for alerting
      const unhealthyProviders = results.filter(r => !r.ok);
      for (const result of unhealthyProviders) {
        console.warn(`[ProactiveHealthChecker] Provider ${result.providerId} unhealthy: ${result.error}`);
      }

      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get list of providers eligible for proactive health checks
   */
  getEligibleProviders() {
    const allProviders = db.getAllProviders();
    const settings = db.getSettings();
    
    // Use custom probeable list from settings, or default to PROBEABLE from healthService
    const probeableIds = settings.proactiveHealthCheckProviders || healthService.PROBEABLE;
    
    return allProviders
      .filter(p => p.enabled)
      .filter(p => {
        // Must be in probeable list or have a key configured
        const isProbeable = probeableIds.includes(p.id);
        const hasKey = p.userApiKey || p.userCookie;
        const isFreeTier = p.isFree && !p.requiresAuth;
        return isProbeable || hasKey || isFreeTier;
      })
      .filter(p => {
        // Must have a valid baseUrl
        const baseUrl = String(p.baseUrl || '');
        return baseUrl && /^https?:\/\//i.test(baseUrl) && !baseUrl.includes('{');
      });
  }

  /**
   * Run health checks with controlled concurrency
   */
  async runConcurrentChecks(providers) {
    const results = [];
    const queue = [...providers];
    const workers = [];

    for (let i = 0; i < Math.min(this.config.concurrency, providers.length); i++) {
      workers.push(this.worker(queue, results));
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Worker that processes providers from the queue
   */
  async worker(queue, results) {
    while (queue.length > 0) {
      const provider = queue.shift();
      try {
        // Add timeout to prevent hanging
        const result = await Promise.race([
          healthService.probeProvider(provider.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.config.timeoutMs)
          ),
        ]);
        results.push({ providerId: provider.id, ...result });
      } catch (err) {
        results.push({ 
          providerId: provider.id, 
          ok: false, 
          error: err.message || 'Unknown error',
          status: 0,
        });
      }
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.isRunning,
      scheduled: !!this.intervalId,
      config: this.config,
      nextRunIn: this.intervalId ? this.config.intervalMs : null,
    };
  }

  /**
   * Trigger an immediate health check (for manual invocation)
   */
  async triggerCheck() {
    if (this.isRunning) {
      return { success: false, message: 'Health check already running' };
    }
    return this.runHealthChecks();
  }
}

module.exports = new ProactiveHealthChecker();