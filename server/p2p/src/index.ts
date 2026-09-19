// WENKER P2P Module Entry Point

import { P2PConfig } from './types';
import { SwarmManager } from './swarmManager';
import { P2PTransport } from './p2pTransport';

// Default configuration
const DEFAULT_P2P_CONFIG: P2PConfig = {
  enabled: true,
  port: 11435,
  listenAddresses: [
    '/ip4/0.0.0.0/tcp/11435',
    '/ip6/::/tcp/11435',
  ],
};

// Singleton instances
let swarmManager: SwarmManager | null = null;
let p2pTransport: P2PTransport | null = null;

export interface P2PModule {
  swarmManager: SwarmManager;
  p2pTransport: P2PTransport;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getStatus: () => any;
  updateModels: (models: any[]) => void;
  updateProviders: (providers: any[]) => void;
  isBlacklisted: (id: string) => boolean;
  getBlacklist: () => any[];
  reportDead: (id: string, type: 'provider' | 'model', reason: string) => void;
  getBestModel: (modelId?: string) => any;
  isModelAvailable: (modelId: string) => boolean;
  getStats: () => any;
}

/**
 * Initialize P2P Module
 */
export async function initP2P(config: Partial<P2PConfig> = {}): Promise<P2PModule> {
  const finalConfig: P2PConfig = {
    ...DEFAULT_P2P_CONFIG,
    ...config,
    port: config.port || DEFAULT_P2P_CONFIG.port,
  };

  // Create Swarm Manager
  swarmManager = new SwarmManager(finalConfig);

  // Create P2P Transport
  p2pTransport = new P2PTransport(finalConfig, swarmManager);

  // Set up event listeners
  swarmManager.on('broadcast', (message: any) => {
    if (p2pTransport) {
      p2pTransport.broadcast(message);
    }
  });

  swarmManager.on('send', (message: any) => {
    if (p2pTransport) {
      p2pTransport.sendDirectMessage(message.to, message);
    }
  });

  return {
    swarmManager,
    p2pTransport,

    start: async () => {
      if (p2pTransport) {
        await p2pTransport.start();
      }
    },

    stop: async () => {
      if (p2pTransport) {
        await p2pTransport.stop();
      }
      if (swarmManager) {
        swarmManager.cleanup();
      }
    },

    getStatus: () => {
      if (p2pTransport) {
        return p2pTransport.getStatus();
      }
      return { isStarted: false };
    },

    updateModels: (models: any[]) => {
      if (swarmManager) {
        swarmManager.updateLocalModels(
          models.map((m) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            type: m.type || (m.local ? 'local' : 'remote'),
            available: m.available !== false,
            size: m.size,
            hash: m.hash,
          }))
        );
      }
    },

    updateProviders: (providers: any[]) => {
      if (swarmManager) {
        swarmManager.updateLocalProviders(
          providers.map((p) => ({
            name: p.name,
            status: p.status,
            latency: p.latency || 0,
            lastChecked: Date.now(),
          }))
        );
      }
    },

    isBlacklisted: (id: string) => {
      return swarmManager ? swarmManager.isBlacklisted(id) : false;
    },

    getBlacklist: () => {
      return swarmManager ? swarmManager.getBlacklist() : [];
    },

    reportDead: (id: string, type: 'provider' | 'model', reason: string) => {
      if (swarmManager) {
        swarmManager.reportDead(id, type, reason);
      }
    },

    getBestModel: (modelId?: string) => {
      return swarmManager ? swarmManager.getBestModel(modelId) : null;
    },

    isModelAvailable: (modelId: string) => {
      return swarmManager ? swarmManager.isModelAvailableInSwarm(modelId) : false;
    },

    getStats: () => {
      return swarmManager ? swarmManager.getStats() : {};
    },
  };
}

/**
 * Get existing P2P module or create new one
 */
export function getP2P(): P2PModule | null {
  if (!swarmManager || !p2pTransport) {
    return null;
  }

  return {
    swarmManager,
    p2pTransport,

    start: async () => {
      if (p2pTransport) {
        await p2pTransport.start();
      }
    },

    stop: async () => {
      if (p2pTransport) {
        await p2pTransport.stop();
      }
      if (swarmManager) {
        swarmManager.cleanup();
      }
    },

    getStatus: () => {
      return p2pTransport ? p2pTransport.getStatus() : { isStarted: false };
    },

    updateModels: (models: any[]) => {
      if (swarmManager) {
        swarmManager.updateLocalModels(
          models.map((m) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            type: m.type || (m.local ? 'local' : 'remote'),
            available: m.available !== false,
            size: m.size,
            hash: m.hash,
          }))
        );
      }
    },

    updateProviders: (providers: any[]) => {
      if (swarmManager) {
        swarmManager.updateLocalProviders(
          providers.map((p) => ({
            name: p.name,
            status: p.status,
            latency: p.latency || 0,
            lastChecked: Date.now(),
          }))
        );
      }
    },

    isBlacklisted: (id: string) => {
      return swarmManager ? swarmManager.isBlacklisted(id) : false;
    },

    getBlacklist: () => {
      return swarmManager ? swarmManager.getBlacklist() : [];
    },

    reportDead: (id: string, type: 'provider' | 'model', reason: string) => {
      if (swarmManager) {
        swarmManager.reportDead(id, type, reason);
      }
    },

    getBestModel: (modelId?: string) => {
      return swarmManager ? swarmManager.getBestModel(modelId) : null;
    },

    isModelAvailable: (modelId: string) => {
      return swarmManager ? swarmManager.isModelAvailableInSwarm(modelId) : false;
    },

    getStats: () => {
      return swarmManager ? swarmManager.getStats() : {};
    },
  };
}

/**
 * Cleanup P2P module
 */
export async function cleanupP2P(): Promise<void> {
  if (p2pTransport) {
    await p2pTransport.stop();
    p2pTransport = null;
  }
  if (swarmManager) {
    swarmManager.cleanup();
    swarmManager = null;
  }
}
