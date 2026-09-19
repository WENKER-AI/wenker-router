// P2P Network Types

export interface P2PConfig {
  enabled: boolean;
  port: number;
  bootstrapNodes?: string[];
  listenAddresses: string[];
  peerId?: string;
}

export interface PeerInfo {
  id: string;
  address: string;
  multiaddr: string;
  lastSeen: number;
  trustScore: number;
  models: ModelStatus[];
  providers: ProviderStatus[];
}

export interface ModelStatus {
  id: string;
  name: string;
  type: 'local' | 'remote' | 'shared';
  available: boolean;
  size?: number; // In bytes
  hash?: string; // For verification
}

export interface ProviderStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency: number;
  lastChecked: number;
}

export interface HealthCheckResult {
  nodeId: string;
  timestamp: number;
  providers: Record<string, ProviderStatus>;
  models: Record<string, ModelStatus>;
  version: string;
}

export interface BlacklistEntry {
  id: string; // Provider or model ID
  type: 'provider' | 'model';
  reason: string;
  reportedBy: string[]; // Node IDs that reported this
  firstReported: number;
  lastReported: number;
  expiresAt?: number; // Optional auto-expiry
}

export interface SwarmMessage {
  type: 'HEALTH_UPDATE' | 'BLACKLIST_UPDATE' | 'MODEL_SHARE' | 'MODEL_REQUEST' | 'PING' | 'PONG';
  from: string; // Node ID
  timestamp: number;
  data: any;
}

export interface HealthUpdateMessage {
  type: 'HEALTH_UPDATE';
  nodeId: string;
  providers: Record<string, ProviderStatus>;
  models: Record<string, ModelStatus>;
}

export interface BlacklistUpdateMessage {
  type: 'BLACKLIST_UPDATE';
  entries: BlacklistEntry[];
  removed: string[]; // IDs of entries to remove
}

export interface ModelShareMessage {
  type: 'MODEL_SHARE';
  modelId: string;
  modelName: string;
  size: number;
  hash: string;
  chunks: number;
  chunkSize: number;
}

export interface ModelRequestMessage {
  type: 'MODEL_REQUEST';
  modelId: string;
  fromNode: string;
}

export interface P2PStats {
  peerCount: number;
  connectedPeers: string[];
  messagesSent: number;
  messagesReceived: number;
  blacklistSize: number;
  sharedModels: number;
}

export interface ModelChunk {
  modelId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Buffer;
  hash: string;
}

export type P2PEventType = 
  | 'peer:connect'
  | 'peer:disconnect'
  | 'message:health'
  | 'message:blacklist'
  | 'message:model-share'
  | 'blacklist:update'
  | 'model:available';

export interface P2PEvent {
  type: P2PEventType;
  data: any;
  timestamp: number;
}
