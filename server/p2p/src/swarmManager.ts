import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  P2PConfig,
  PeerInfo,
  ModelStatus,
  ProviderStatus,
  HealthCheckResult,
  BlacklistEntry,
  SwarmMessage,
  HealthUpdateMessage,
  BlacklistUpdateMessage,
  ModelShareMessage,
  P2PStats,
  P2PEvent,
  P2PEventType,
} from './types';

// Thresholds for distributed decisions
const BLACKLIST_THRESHOLD = 3; // Number of nodes needed to blacklist
const TRUST_SCORE_DECAY = 0.99; // Decay factor for trust scores
const BLACKLIST_EXPIRY = 5 * 60 * 1000; // 5 minutes

export class SwarmManager extends EventEmitter {
  private config: P2PConfig;
  private nodeId: string;
  private peers: Map<string, PeerInfo> = new Map();
  private blacklist: Map<string, BlacklistEntry> = new Map();
  private localModels: Map<string, ModelStatus> = new Map();
  private localProviders: Map<string, ProviderStatus> = new Map();
  private stats: P2PStats = {
    peerCount: 0,
    connectedPeers: [],
    messagesSent: 0,
    messagesReceived: 0,
    blacklistSize: 0,
    sharedModels: 0,
  };
  private lastHealthBroadcast: number = 0;
  private lastBlacklistSync: number = 0;

  constructor(config: P2PConfig, nodeId?: string) {
    super();
    this.config = config;
    this.nodeId = nodeId || uuidv4();
    
    // Set up periodic tasks
    this.setupPeriodicTasks();
  }

  /**
   * Set up periodic tasks
   */
  private setupPeriodicTasks(): void {
    // Broadcast health every 30 seconds
    setInterval(() => this.broadcastHealth(), 30000);
    
    // Sync blacklist every 60 seconds
    setInterval(() => this.syncBlacklist(), 60000);
    
    // Decay trust scores every 5 minutes
    setInterval(() => this.decayTrustScores(), 5 * 60 * 1000);
    
    // Cleanup old blacklist entries
    setInterval(() => this.cleanupBlacklist(), 60 * 1000);
  }

  /**
   * Get node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Update local models
   */
  updateLocalModels(models: ModelStatus[]): void {
    for (const model of models) {
      this.localModels.set(model.id, model);
    }
    this.broadcastHealth();
  }

  /**
   * Update local providers
   */
  updateLocalProviders(providers: ProviderStatus[]): void {
    for (const provider of providers) {
      this.localProviders.set(provider.name, provider);
    }
    this.broadcastHealth();
  }

  /**
   * Broadcast health status to all peers
   */
  async broadcastHealth(): Promise<void> {
    if (!this.config.enabled) return;

    const message: HealthUpdateMessage = {
      type: 'HEALTH_UPDATE',
      nodeId: this.nodeId,
      providers: Object.fromEntries(this.localProviders),
      models: Object.fromEntries(this.localModels),
    };

    this.lastHealthBroadcast = Date.now();
    
    // Emit event for P2P layer to broadcast
    this.emit('broadcast', {
      type: 'HEALTH_UPDATE',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
  }

  /**
   * Handle incoming health update
   */
  handleHealthUpdate(message: HealthUpdateMessage, from: string): void {
    if (!this.config.enabled) return;

    this.stats.messagesReceived++;

    // Update peer info
    const peerInfo: PeerInfo = {
      id: from,
      address: '', // Will be updated by P2P layer
      multiaddr: '',
      lastSeen: Date.now(),
      trustScore: this.getPeerTrustScore(from),
      models: Object.values(message.models),
      providers: Object.values(message.providers),
    };
    this.peers.set(from, peerInfo);
    this.stats.peerCount = this.peers.size;
    this.stats.connectedPeers = Array.from(this.peers.keys());

    // Update shared models count
    this.updateSharedModelsCount();

    // Emit event
    this.emit('peer:update', { peerId: from, peerInfo });
    this.emit('message:health', { message, from });
  }

  /**
   * Update shared models count
   */
  private updateSharedModelsCount(): void {
    const uniqueModels = new Set<string>();
    
    for (const peer of this.peers.values()) {
      for (const model of peer.models) {
        if (model.available) {
          uniqueModels.add(model.id);
        }
      }
    }
    
    this.stats.sharedModels = uniqueModels.size;
  }

  /**
   * Sync blacklist with peers
   */
  async syncBlacklist(): Promise<void> {
    if (!this.config.enabled) return;

    const message: BlacklistUpdateMessage = {
      type: 'BLACKLIST_UPDATE',
      entries: Array.from(this.blacklist.values()),
      removed: [], // Will be handled separately
    };

    this.lastBlacklistSync = Date.now();
    
    this.emit('broadcast', {
      type: 'BLACKLIST_UPDATE',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
  }

  /**
   * Handle incoming blacklist update
   */
  handleBlacklistUpdate(message: BlacklistUpdateMessage, from: string): void {
    if (!this.config.enabled) return;

    this.stats.messagesReceived++;

    // Process new entries
    for (const entry of message.entries) {
      // Skip if already in blacklist
      if (this.blacklist.has(entry.id)) continue;

      // Check if we already have this entry reported by others
      const existing = Array.from(this.blacklist.values()).find(
        (e) => e.id === entry.id && e.type === entry.type
      );

      if (existing) {
        // Update existing entry
        existing.reportedBy.push(from);
        existing.lastReported = Date.now();
        
        // Check if threshold reached
        if (existing.reportedBy.length >= BLACKLIST_THRESHOLD && !this.isBlacklisted(entry.id)) {
          this.addToBlacklist(existing);
        }
      } else {
        // Create new pending entry
        const newEntry: BlacklistEntry = {
          id: entry.id,
          type: entry.type,
          reason: entry.reason,
          reportedBy: [from],
          firstReported: Date.now(),
          lastReported: Date.now(),
        };
        this.blacklist.set(entry.id, newEntry);
      }
    }

    // Process removals
    for (const id of message.removed) {
      this.blacklist.delete(id);
    }

    this.stats.blacklistSize = this.blacklist.size;
    this.emit('blacklist:update', { blacklist: Array.from(this.blacklist.values()) });
  }

  /**
   * Check if an ID is blacklisted
   */
  isBlacklisted(id: string): boolean {
    const entry = this.blacklist.get(id);
    if (!entry) return false;

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.blacklist.delete(id);
      this.stats.blacklistSize = this.blacklist.size;
      return false;
    }

    return entry.reportedBy.length >= BLACKLIST_THRESHOLD;
  }

  /**
   * Add to blacklist (internal)
   */
  private addToBlacklist(entry: BlacklistEntry): void {
    // Set expiry if not already set
    if (!entry.expiresAt) {
      entry.expiresAt = Date.now() + BLACKLIST_EXPIRY;
    }

    this.blacklist.set(entry.id, entry);
    this.stats.blacklistSize = this.blacklist.size;
    
    this.emit('blacklist:add', { entry });
    this.emit('blacklist:update', { blacklist: Array.from(this.blacklist.values()) });
  }

  /**
   * Report a dead provider or model
   */
  reportDead(id: string, type: 'provider' | 'model', reason: string): void {
    const entry: BlacklistEntry = {
      id,
      type,
      reason,
      reportedBy: [this.nodeId],
      firstReported: Date.now(),
      lastReported: Date.now(),
    };

    this.blacklist.set(id, entry);
    this.stats.blacklistSize = this.blacklist.size;

    // Broadcast to peers
    const message: BlacklistUpdateMessage = {
      type: 'BLACKLIST_UPDATE',
      entries: [entry],
      removed: [],
    };

    this.emit('broadcast', {
      type: 'BLACKLIST_UPDATE',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
    this.emit('blacklist:report', { entry });
  }

  /**
   * Remove from blacklist
   */
  removeFromBlacklist(id: string): void {
    this.blacklist.delete(id);
    this.stats.blacklistSize = this.blacklist.size;

    // Broadcast removal
    const message: BlacklistUpdateMessage = {
      type: 'BLACKLIST_UPDATE',
      entries: [],
      removed: [id],
    };

    this.emit('broadcast', {
      type: 'BLACKLIST_UPDATE',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
    this.emit('blacklist:remove', { id });
  }

  /**
   * Get blacklist
   */
  getBlacklist(): BlacklistEntry[] {
    return Array.from(this.blacklist.values()).filter((entry) => {
      // Filter out expired entries
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.blacklist.delete(entry.id);
        return false;
      }
      return true;
    });
  }

  /**
   * Cleanup expired blacklist entries
   */
  private cleanupBlacklist(): void {
    const now = Date.now();
    let changed = false;

    for (const [id, entry] of this.blacklist) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.blacklist.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.stats.blacklistSize = this.blacklist.size;
      this.emit('blacklist:update', { blacklist: Array.from(this.blacklist.values()) });
    }
  }

  /**
   * Share a model with the swarm
   */
  shareModel(model: ModelStatus, chunks: number, chunkSize: number): void {
    if (!this.config.enabled) return;

    const message: ModelShareMessage = {
      type: 'MODEL_SHARE',
      modelId: model.id,
      modelName: model.name,
      size: model.size || 0,
      hash: model.hash || '',
      chunks,
      chunkSize,
    };

    this.emit('broadcast', {
      type: 'MODEL_SHARE',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
    this.emit('model:share', { model, message });
  }

  /**
   * Request a model from the swarm
   */
  requestModel(modelId: string): void {
    if (!this.config.enabled) return;

    const message: ModelRequestMessage = {
      type: 'MODEL_REQUEST',
      modelId,
      fromNode: this.nodeId,
    };

    // For now, broadcast to all peers
    // In production, might want to target specific peers
    this.emit('broadcast', {
      type: 'MODEL_REQUEST',
      from: this.nodeId,
      timestamp: Date.now(),
      data: message,
    });

    this.stats.messagesSent++;
    this.emit('model:request', { modelId, message });
  }

  /**
   * Handle model share message
   */
  handleModelShare(message: ModelShareMessage, from: string): void {
    if (!this.config.enabled) return;

    this.stats.messagesReceived++;

    // Update peer's model list
    const peer = this.peers.get(from);
    if (peer) {
      const modelStatus: ModelStatus = {
        id: message.modelId,
        name: message.modelName,
        type: 'shared',
        available: true,
        size: message.size,
        hash: message.hash,
      };

      // Add or update model in peer's list
      const existingIndex = peer.models.findIndex(m => m.id === message.modelId);
      if (existingIndex !== -1) {
        peer.models[existingIndex] = modelStatus;
      } else {
        peer.models.push(modelStatus);
      }

      this.updateSharedModelsCount();
    }

    this.emit('model:shared', { message, from });
  }

  /**
   * Handle model request message
   */
  handleModelRequest(message: ModelRequestMessage, from: string): void {
    if (!this.config.enabled) return;

    this.stats.messagesReceived++;

    // Check if we have this model
    const localModel = this.localModels.get(message.modelId);
    if (localModel && localModel.available && localModel.type === 'local') {
      // We can share this model
      this.emit('model:serve', { 
        modelId: message.modelId, 
        to: from,
        model: localModel 
      });
    }

    this.emit('model:requested', { message, from });
  }

  /**
   * Get peer info
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Add peer
   */
  addPeer(peerInfo: PeerInfo): void {
    this.peers.set(peerInfo.id, peerInfo);
    this.stats.peerCount = this.peers.size;
    this.stats.connectedPeers = Array.from(this.peers.keys());
    this.emit('peer:connect', { peerId: peerInfo.id, peerInfo });
  }

  /**
   * Remove peer
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.stats.peerCount = this.peers.size;
    this.stats.connectedPeers = Array.from(this.peers.keys());
    this.emit('peer:disconnect', { peerId });
  }

  /**
   * Get trust score for a peer
   */
  getPeerTrustScore(peerId: string): number {
    const peer = this.peers.get(peerId);
    return peer ? peer.trustScore : 0.5; // Default to 0.5 for unknown peers
  }

  /**
   * Update trust score for a peer
   */
  updatePeerTrust(peerId: string, amount: number): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.trustScore = Math.max(0, Math.min(1, peer.trustScore + amount));
    }
  }

  /**
   * Decay trust scores periodically
   */
  private decayTrustScores(): void {
    for (const peer of this.peers.values()) {
      peer.trustScore *= TRUST_SCORE_DECAY;
    }
  }

  /**
   * Get stats
   */
  getStats(): P2PStats {
    return { ...this.stats };
  }

  /**
   * Get local models
   */
  getLocalModels(): ModelStatus[] {
    return Array.from(this.localModels.values());
  }

  /**
   * Get local providers
   */
  getLocalProviders(): ProviderStatus[] {
    return Array.from(this.localProviders.values());
  }

  /**
   * Get combined provider status (local + peers)
   */
  getCombinedProviderStatus(providerName: string): ProviderStatus | null {
    // Check local first
    const local = this.localProviders.get(providerName);
    if (local) return local;

    // Check peers
    for (const peer of this.peers.values()) {
      const peerProvider = peer.providers.find(p => p.name === providerName);
      if (peerProvider) {
        // Weight by trust score
        return {
          ...peerProvider,
          latency: Math.ceil(peerProvider.latency * (1 + (1 - peer.trustScore))),
        };
      }
    }

    return null;
  }

  /**
   * Get best available model
   */
  getBestModel(modelId?: string): ModelStatus | null {
    if (!modelId) {
      // Return any available local model
      for (const model of this.localModels.values()) {
        if (model.available) return model;
      }
      return null;
    }

    // Check local first
    const local = this.localModels.get(modelId);
    if (local && local.available) return local;

    // Check peers
    for (const peer of this.peers.values()) {
      const peerModel = peer.models.find(m => m.id === modelId && m.available);
      if (peerModel) {
        return {
          ...peerModel,
          type: 'shared',
          // Note: latency would be network latency + peer latency
        };
      }
    }

    return null;
  }

  /**
   * Check if model is available in swarm
   */
  isModelAvailableInSwarm(modelId: string): boolean {
    // Check local
    const local = this.localModels.get(modelId);
    if (local && local.available) return true;

    // Check peers
    for (const peer of this.peers.values()) {
      const peerModel = peer.models.find(m => m.id === modelId && m.available);
      if (peerModel) return true;
    }

    return false;
  }

  /**
   * Get all available models in swarm
   */
  getAllAvailableModels(): ModelStatus[] {
    const models = new Map<string, ModelStatus>();

    // Add local models
    for (const model of this.localModels.values()) {
      if (model.available) {
        models.set(model.id, { ...model, type: 'local' });
      }
    }

    // Add peer models
    for (const peer of this.peers.values()) {
      for (const model of peer.models) {
        if (model.available) {
          // Prefer local over shared
          if (!models.has(model.id)) {
            models.set(model.id, { ...model, type: 'shared' });
          }
        }
      }
    }

    return Array.from(models.values());
  }

  /**
   * Handle ping message
   */
  handlePing(from: string): void {
    this.stats.messagesReceived++;
    this.updatePeerTrust(from, 0.01); // Slight trust increase for active peers

    // Send pong
    this.emit('send', {
      to: from,
      type: 'PONG',
      from: this.nodeId,
      timestamp: Date.now(),
      data: {},
    });

    this.stats.messagesSent++;
  }

  /**
   * Handle pong message
   */
  handlePong(from: string): void {
    this.stats.messagesReceived++;
    this.updatePeerTrust(from, 0.01);
  }

  /**
   * Process incoming swarm message
   */
  processMessage(message: SwarmMessage): void {
    switch (message.type) {
      case 'HEALTH_UPDATE':
        this.handleHealthUpdate(message.data as HealthUpdateMessage, message.from);
        break;
      case 'BLACKLIST_UPDATE':
        this.handleBlacklistUpdate(message.data as BlacklistUpdateMessage, message.from);
        break;
      case 'MODEL_SHARE':
        this.handleModelShare(message.data as ModelShareMessage, message.from);
        break;
      case 'MODEL_REQUEST':
        this.handleModelRequest(message.data as ModelRequestMessage, message.from);
        break;
      case 'PING':
        this.handlePing(message.from);
        break;
      case 'PONG':
        this.handlePong(message.from);
        break;
      default:
        console.warn(`Unknown message type: ${(message as SwarmMessage).type}`);
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.peers.clear();
    this.blacklist.clear();
    this.localModels.clear();
    this.localProviders.clear();
  }
}
