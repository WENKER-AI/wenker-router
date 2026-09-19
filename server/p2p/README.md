# WENKER P2P Network

> **A decentralized peer-to-peer network for WENKER Router that eliminates dead models and providers**
> 
> ⚠️ **CURRENT STATUS: NOT PRODUCTION READY** — Dependencies need updating. The `@libp2p/core` v1.x packages listed in package.json are no longer available on npm. See [Migration Guide](#migration-to-current-libp2p) below.

The WENKER P2P Network enables multiple WENKER Router instances to communicate and share information about model and provider health. This creates a self-healing network where dead providers and models are automatically detected and blacklisted across all nodes.

## Features

### Core P2P Capabilities
- **🌐 Peer Discovery** - Automatic discovery of other WENKER nodes on the network
- **❤️ Health Broadcasting** - Nodes share their provider/model health status every 30 seconds
- **🚫 Distributed Blacklist** - Dead providers/models are automatically blacklisted when 3+ nodes report them
- **🔗 Model Sharing** - Nodes can share local models with each other
- **🎯 Intelligent Routing** - Requests are routed to the best available node
- **🔒 Trust System** - Each peer has a trust score based on their behavior

### Benefits
1. **Eliminate Dead Providers** - No more sending requests to dead providers
2. **Improved Reliability** - The network self-heals by sharing health information
3. **Model Availability** - Access models from other nodes in the swarm
4. **Reduced Latency** - Use the closest/fastest available node
5. **Fault Tolerance** - If one node fails, others can take over

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WENKER P2P NETWORK                               │
├─────────────────────┬─────────────────────┬─────────────────────┐
│   Node A (Home)      │   Node B (VPS)       │   Node C (Office)   │
│                     │                     │                     │
│  ┌─────────────┐   │  ┌─────────────┐   │  ┌─────────────┐   │
│  │  libp2p     │   │  │  libp2p     │   │  │  libp2p     │   │
│  │  Transport  │◄──►│  │  Transport  │◄──►│  │  Transport  │   │
│  └─────────────┘   │  └─────────────┘   │  └─────────────┘   │
│        ▲            │        ▲            │        ▲            │
│  ┌─────┴─────┐    │  ┌─────┴─────┐    │  ┌─────┴─────┐    │
│  │ Swarm     │    │  │ Swarm     │    │  │ Swarm     │    │
│  │ Manager   │    │  │ Manager   │    │  │ Manager   │    │
│  └─────┬─────┘    │  └─────┬─────┘    │  └─────┬─────┘    │
│        │            │        │            │        │            │
│  ┌─────▼─────┐    │  ┌─────▼─────┐    │  ┌─────▼─────┐    │
│  │ Providers │    │  │ Providers │    │  │ Providers │    │
│  │ Models    │    │  │ Models    │    │  │ Models    │    │
│  └─────────────┘    │  └─────────────┘    │  └─────────────┘    │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

## Quick Start

### Enable P2P in WENKER Router

```bash
# Set environment variables
export WENKER_P2P_ENABLED=true
export WENKER_P2P_PORT=11435

# Start WENKER Router
npm start
```

Or use CLI arguments:
```bash
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11435 node server/index.js
```

### Multiple Nodes

```bash
# Node 1 (Port 11435)
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11435 npm start

# Node 2 (Port 11436)
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11436 npm start

# Node 3 (different machine)
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11435 npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WENKER_P2P_ENABLED` | Enable/disable P2P | `false` |
| `WENKER_P2P_PORT` | Port for P2P network | `11435` |

### Programmatic Configuration

```typescript
import { initP2P } from './server/p2p/src/index';

const p2pModule = await initP2P({
  enabled: true,
  port: 11435,
  listenAddresses: [
    '/ip4/0.0.0.0/tcp/11435',
    '/ip6/::/tcp/11435',
  ],
});

await p2pModule.start();
```

## How It Works

### 1. Peer Discovery

Nodes use libp2p's built-in discovery mechanisms:
- **mDNS** - For local network discovery (LAN)
- **Bootstrap Nodes** - Pre-configured nodes to connect to
- **DHT** - Distributed Hash Table for internet-wide discovery (future)

### 2. Health Broadcasting

Every 30 seconds, each node broadcasts:
- List of providers and their status (up/down/degraded)
- List of models and their availability
- Response latency measurements

### 3. Distributed Blacklist

When a node detects a dead provider/model:
1. It reports it to the swarm with a reason
2. Other nodes receive the report and track it
3. When 3+ nodes report the same provider/model as dead:
   - It's added to the distributed blacklist
   - All nodes stop using it
4. After 5 minutes without reports, the entry expires and is removed

### 4. Model Sharing

Nodes can share local models:
1. Node A has `llama3:8b` locally
2. Node A broadcasts: "I have `llama3:8b` available"
3. Node B needs `llama3:8b` but doesn't have it
4. Node B requests the model from Node A
5. Node A streams the model file to Node B (if small enough)

### 5. Trust System

Each peer has a trust score (0-1):
- **Initial**: 0.5
- **Increase**: +0.01 for each valid health update
- **Decrease**: -0.1 for each invalid report
- **Decay**: Multiplied by 0.99 every 5 minutes

Trust scores affect:
- Weight of health reports
- Priority in model selection
- Connection preference

## API Endpoints

When P2P is enabled, WENKER Router exposes these endpoints:

### GET /api/p2p/status

Get the current P2P network status.

**Response:**
```json
{
  "enabled": true,
  "nodeId": "QmPeerId...",
  "peerCount": 2,
  "connectedPeers": ["QmPeer1", "QmPeer2"],
  "listenAddresses": ["/ip4/192.168.1.1/tcp/11435"],
  "messagesSent": 150,
  "messagesReceived": 200,
  "blacklistSize": 1,
  "sharedModels": 5,
  "blacklist": [
    {
      "id": "openai",
      "type": "provider",
      "reason": "Connection timeout",
      "reportedBy": ["node1", "node2", "node3"],
      "firstReported": 1700000000000,
      "lastReported": 1700000001000
    }
  ],
  "peers": [
    {
      "id": "QmPeer1",
      "address": "192.168.1.2:11435",
      "models": 10,
      "providers": 5,
      "lastSeen": 1700000002000
    }
  ]
}
```

### GET /api/p2p/blacklist

Get the distributed blacklist.

**Response:**
```json
{
  "blacklist": [
    {
      "id": "openai",
      "type": "provider",
      "reason": "Connection timeout",
      "reportedBy": ["node1", "node2", "node3"],
      "firstReported": 1700000000000,
      "lastReported": 1700000001000
    }
  ]
}
```

### POST /api/p2p/report-dead

Report a dead provider or model to the swarm.

**Request Body:**
```json
{
  "id": "openai",
  "type": "provider",
  "reason": "Connection timeout"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dead item reported to swarm"
}
```

### GET /api/p2p/models

Get all available models in the swarm.

**Response:**
```json
{
  "models": [
    {
      "id": "claude-3-5-sonnet",
      "name": "Claude 3.5 Sonnet",
      "type": "local",
      "available": true,
      "provider": "anthropic"
    },
    {
      "id": "llama3:8b",
      "name": "Llama 3 8B",
      "type": "shared",
      "available": true,
      "provider": "swarm"
    }
  ]
}
```

### GET /api/p2p/models/:modelId/available

Check if a specific model is available in the swarm.

**Response:**
```json
{
  "available": true,
  "model": {
    "id": "claude-3-5-sonnet",
    "name": "Claude 3.5 Sonnet",
    "type": "local",
    "available": true
  }
}
```

## Integration with GoGo Code

GoGo Code automatically integrates with the P2P network:

1. **Auto-Discovery** - Detects P2P-enabled WENKER Router
2. **Swarm Models** - Shows models available from peers
3. **Fallback Routing** - Uses peer models when local is unavailable
4. **Health Awareness** - Avoids dead providers reported by swarm

Example:
```bash
# GoGo Code will automatically use P2P if enabled
gogo

# Check P2P status in the UI (shows peer count)
# Models from peers appear in the model selector
```

## Project Structure

```
server/p2p/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript types
│   ├── swarmManager.ts    # Swarm management logic
│   └── p2pTransport.ts    # libp2p transport layer
├── package.json
├── tsconfig.json
└── README.md
```

## Technologies

- **libp2p** - Modular peer-to-peer networking library
- **floodsub** - Flooding pubsub implementation for message broadcasting
- **noise** - Encrypted transport
- **mplex** - Stream multiplexing
- **tcp/websockets** - Transport protocols
- **multiformats** - Multiaddr support

## Thresholds & Constants

| Parameter | Value | Description |
|-----------|-------|-------------|
| `BLACKLIST_THRESHOLD` | 3 | Nodes needed to blacklist |
| `BLACKLIST_EXPIRY` | 5 minutes | Auto-remove from blacklist |
| `TRUST_SCORE_DECAY` | 0.99 | Trust decay factor |
| `HEALTH_BROADCAST_INTERVAL` | 30 seconds | Health update frequency |
| `BLACKLIST_SYNC_INTERVAL` | 60 seconds | Blacklist sync frequency |

## Testing

### Local Testing

```bash
# Start multiple nodes in different terminals

# Terminal 1
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11435 npm start

# Terminal 2
WENKER_P2P_ENABLED=true WENKER_P2P_PORT=11436 npm start

# Check they're connected
curl http://localhost:3600/api/p2p/status
```

### Test Blacklist

```bash
# Report a dead provider
curl -X POST http://localhost:3600/api/p2p/report-dead \
  -H "Content-Type: application/json" \
  -d '{"id":"fake-provider","type":"provider","reason":"Test"}'

# Check blacklist
curl http://localhost:3600/api/p2p/blacklist
```

## Migration to Current libp2p (Required to Run)

The current `package.json` uses deprecated `@libp2p/*` v1.x packages that no longer exist on npm. To make this module work, update dependencies to the modern libp2p ecosystem:

### Updated `package.json` dependencies:
```json
{
  "dependencies": {
    "@libp2p/interface": "^1.0.0",
    "@libp2p/tcp": "^9.0.0",
    "@libp2p/websockets": "^8.0.0",
    "@libp2p/mdns": "^11.0.0",
    "@libp2p/floodsub": "^11.0.0",
    "@libp2p/gossipsub": "^13.0.0",
    "@chainsafe/libp2p-noise": "^15.0.0",
    "@chainsafe/libp2p-yamux": "^6.0.0",
    "@multiformats/multiaddr": "^12.0.0",
    "uint8arrays": "^5.0.0",
    "@libp2p/peer-id": "^2.0.0"
  }
}
```

### Key API Changes (v0.x → v1.x+):
| Old Package | New Package | Notes |
|-------------|-------------|-------|
| `@libp2p/core` | `@libp2p/interface` + `createLibp2p` from `@libp2p/interface` | Factory pattern |
| `@libp2p/noise` | `@chainsafe/libp2p-noise` | Different maintainer |
| `@libp2p/mplex` | `@chainsafe/libp2p-yamux` | Yamux replaced mplex |
| `peer-id` | `@libp2p/peer-id` | Scoped package |
| `it-pair` | Built into `@libp2p/interface` | No longer separate |

### Code Updates Needed:
1. Replace `createLibp2p` import from `@libp2p/core` → `@libp2p/interface`
2. Update transport config: `new TCP()` → `tcp()`, `new WebSockets()` → `websockets()`
3. Update connection encryption: `new Noise()` → `noise()`, `new Mplex()` → `yamux()`
4. Update peer discovery: `new Mdns()` → `mdns()`
5. Update pubsub: `new Floodsub()` → `floodsub()` or `gossipsub()`
6. Use `createLibp2p({ transports: [tcp(), websockets()], connectionEncryption: [noise()], streamMuxers: [yamux()], peerDiscovery: [mdns()], services: { pubsub: floodsub() } })`

See [libp2p migration guide](https://github.com/libp2p/js-libp2p/blob/main/MIGRATION.md) for full details.

---

## Security Considerations

1. **Encryption** - All communications are encrypted using libp2p-noise
2. **Trust System** - Nodes with low trust scores have less influence
3. **Rate Limiting** - Each node limits the rate of incoming messages
4. **Validation** - All health reports are validated before processing
5. **Isolation** - P2P is opt-in (disabled by default)

## Future Features

- [ ] DHT-based discovery for internet-wide networking
- [ ] Model chunking and streaming for large models
- [ ] Bandwidth-aware model sharing
- [ ] Geolocation-based routing
- [ ] Reputation system with proofs
- [ ] Incentive mechanisms for sharing models
- [ ] NAT traversal for nodes behind firewalls
- [ ] Mobile peer support

## License

MIT License - see LICENSE file for details.

---

**Part of the WENKER Router ecosystem**

- [WENKER Router](https://github.com/wenker-ai/wenker) - The core AI proxy gateway
- [GoGo Code](https://github.com/wenker-ai/wenker/tree/main/gogo-code) - Terminal AI assistant
- [P2P Network](https://github.com/wenker-ai/wenker/tree/main/server/p2p) - Distributed model/provider management
