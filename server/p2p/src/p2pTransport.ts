// P2P Transport Layer using libp2p
// This is the low-level P2P networking layer
// Updated for libp2p v1.x+ (modern API)

import { createLibp2p } from '@libp2p/interface';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { mdns } from '@libp2p/mdns';
import { floodsub } from '@libp2p/floodsub';
import { gossipsub } from '@libp2p/gossipsub';
import { fromString as uint8ArrayFromString } from 'uint8arrays';
import { multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import type { Connection } from '@libp2p/interface/connection';
import type { PeerId } from '@libp2p/interface/peer-id';
import {
  P2PConfig,
  SwarmMessage,
  PeerInfo,
} from './types';

// P2P Protocol IDs
const WENKER_PROTOCOL = '/wenker/p2p/1.0.0';
const WENKER_FLOODSUB = 'wenker-floodsub';
const WENKER_GOSSIPSUB = 'wenker-gossipsub';

export class P2PTransport {
  private libp2p: any;
  private config: P2PConfig;
  private swarmManager: any;
  private isStarted: boolean = false;
  private pubsub: any;

  constructor(config: P2PConfig, swarmManager: any) {
    this.config = config;
    this.swarmManager = swarmManager;
  }

  /**
   * Start P2P network
   */
  async start(): Promise<void> {
    if (this.isStarted || !this.config.enabled) {
      return;
    }

    try {
      // Create libp2p node with modern API
      this.libp2p = await createLibp2p({
        peerId: await this.createPeerId(),
        addresses: {
          listen: this.config.listenAddresses.map((addr) =>
            multiaddr(addr)
          ),
        },
        transports: [
          tcp(),
          webSockets(),
        ],
        streamMuxers: [
          yamux(),
        ],
        connectionEncryption: [
          noise(),
        ],
        pubsub: gossipsub({
          enabled: true,
          emitSelf: false,
          allowPublishToZeroPeers: true,
        }),
        connectionGater: {
          denyDialMultiaddr: async (ma: any) => {
            // Allow all connections for now
            return false;
          },
        },
      });

      // Set up event listeners
      this.setupEventListeners();

      // Start libp2p
      await this.libp2p.start();
      this.isStarted = true;

      // Get pubsub instance
      this.pubsub = this.libp2p.services.pubsub;

      // Subscribe to our channels
      await this.pubsub.subscribe(WENKER_FLOODSUB);
      await this.pubsub.subscribe(WENKER_GOSSIPSUB);

      // Set up pubsub listener
      this.pubsub.addEventListener('message', this.handlePubSubMessage.bind(this));

      console.log(`[P2P] Started WENKER P2P node on port ${this.config.port}`);
      console.log(`[P2P] Node ID: ${this.libp2p.peerId.toString()}`);

    } catch (error) {
      console.error('[P2P] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Create peer ID
   */
  private async createPeerId(): Promise<PeerId> {
    // If we have a saved peer ID, use it
    // Otherwise, generate a new one
    // In modern libp2p, peer ID is created via createFromPrivKey or generated
    // For simplicity, we'll let libp2p generate one
    // You can also import peerIdFromString if you have a saved key
    const { createEd25519PeerId } = await import('@libp2p/peer-id');
    return createEd25519PeerId();
  }

  /**
   * Set up libp2p event listeners
   */
  private setupEventListeners(): void {
    if (!this.libp2p) return;

    // Connection events
    this.libp2p.addEventListener('connection:open', (connection: Connection) => {
      const peerId = connection.remotePeer.toString();
      const addr = connection.remoteAddr.toString();
      
      console.log(`[P2P] Connected to ${peerId} at ${addr}`);

      // Create peer info
      const peerInfo: PeerInfo = {
        id: peerId,
        address: addr,
        multiaddr: connection.remoteAddr.toString(),
        lastSeen: Date.now(),
        trustScore: 0.5,
        models: [],
        providers: [],
      };

      this.swarmManager.addPeer(peerInfo);

      // Send ping
      this.sendDirectMessage(peerId, {
        type: 'PING',
        from: this.libp2p.peerId.toString(),
        timestamp: Date.now(),
        data: {},
      });
    });

    this.libp2p.addEventListener('connection:close', (connection: Connection) => {
      const peerId = connection.remotePeer.toString();
      console.log(`[P2P] Disconnected from ${peerId}`);
      this.swarmManager.removePeer(peerId);
    });

    // Peer discovery
    this.libp2p.addEventListener('peer:discovery', (peerInfo: any) => {
      const peerId = peerInfo.id.toString();
      console.log(`[P2P] Discovered peer: ${peerId}`);

      // Try to connect
      this.connectToPeer(peerInfo);
    });
  }

  /**
   * Connect to a specific peer
   */
  async connectToPeer(peerInfo: any): Promise<void> {
    try {
      const ma = peerInfo.multiaddrs.find((ma: any) =>
        ma.toString().includes('ip') || ma.toString().includes('localhost')
      );
      
      if (ma) {
        await this.libp2p.dial(peerInfo.id, ma);
        console.log(`[P2P] Dialing ${peerInfo.id.toString()}`);
      }
    } catch (error) {
      console.error(`[P2P] Failed to connect to ${peerInfo.id.toString()}:`, error);
    }
  }

  /**
   * Handle pubsub messages
   */
  private async handlePubSubMessage(event: any): Promise<void> {
    const { topic, data, from } = event.detail;

    // Handle both floodsub and gossipsub topics
    if (topic !== WENKER_FLOODSUB && topic !== WENKER_GOSSIPSUB) {
      return;
    }

    try {
      const message: SwarmMessage = JSON.parse(data.toString());
      
      // Ignore our own messages
      if (from === this.libp2p.peerId.toString()) {
        return;
      }

      console.log(`[P2P] Received message from ${from}: ${message.type}`);

      // Process message
      this.swarmManager.processMessage(message);

      // Update peer info
      const peerInfo = this.swarmManager.getPeer(from);
      if (peerInfo) {
        peerInfo.lastSeen = Date.now();
      }

    } catch (error) {
      console.error('[P2P] Error processing message:', error);
    }
  }

  /**
   * Broadcast message to all peers
   */
  async broadcast(message: SwarmMessage): Promise<void> {
    if (!this.isStarted || !this.pubsub) {
      return;
    }

    try {
      const data = JSON.stringify(message);
      // Publish to both floodsub and gossipsub for compatibility
      await this.pubsub.publish(WENKER_FLOODSUB, uint8ArrayFromString(data));
      await this.pubsub.publish(WENKER_GOSSIPSUB, uint8ArrayFromString(data));
      console.log(`[P2P] Broadcasted message: ${message.type}`);
    } catch (error) {
      console.error('[P2P] Broadcast failed:', error);
    }
  }

  /**
   * Send direct message to specific peer
   */
  async sendDirectMessage(peerId: string, message: SwarmMessage): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      // For now, we'll use pubsub for direct messages
      // In a full implementation, we'd use direct streams
      const data = JSON.stringify({
        ...message,
        to: peerId, // Add recipient
      });
      
      await this.pubsub.publish(WENKER_FLOODSUB, uint8ArrayFromString(data));
      await this.pubsub.publish(WENKER_GOSSIPSUB, uint8ArrayFromString(data));
      console.log(`[P2P] Sent direct message to ${peerId}: ${message.type}`);
    } catch (error) {
      console.error(`[P2P] Failed to send to ${peerId}:`, error);
    }
  }

  /**
   * Get libp2p node ID
   */
  getNodeId(): string {
    return this.libp2p?.peerId?.toString() || '';
  }

  /**
   * Get connected peers
   */
  getConnectedPeers(): string[] {
    if (!this.libp2p) return [];
    
    return this.libp2p.getConnections().map((conn: Connection) =>
      conn.remotePeer.toString()
    );
  }

  /**
   * Get listen addresses
   */
  getListenAddresses(): string[] {
    if (!this.libp2p) return [];
    
    return this.libp2p.getMultiaddrs().map((ma: any) => ma.toString());
  }

  /**
   * Stop P2P network
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      if (this.libp2p) {
        await this.libp2p.stop();
        this.isStarted = false;
        console.log('[P2P] Stopped WENKER P2P node');
      }
    } catch (error) {
      console.error('[P2P] Error stopping:', error);
    }
  }

  /**
   * Restart P2P network
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Get status
   */
  getStatus(): any {
    return {
      isStarted: this.isStarted,
      nodeId: this.getNodeId(),
      peerCount: this.getConnectedPeers().length,
      listenAddresses: this.getListenAddresses(),
    };
  }
}
