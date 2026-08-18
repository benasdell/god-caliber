import Peer from 'peerjs';
import { PeerPlayer } from './PeerPlayer.js';

// --- Connection State Constants (0.3.4) ---

export const CONNECTION_STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RETRYING: 'retrying',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected'
};

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 18000; // 3 missed heartbeats + buffer

// --- Utility Functions ---

export function sanitizeName(rawName) {
  if (typeof rawName !== 'string') return 'Player';
  const clean = rawName.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').trim();
  return clean ? clean.substring(0, 16) : 'Player';
}

export function sanitizeRoomCode(rawCode) {
  if (typeof rawCode !== 'string') return '';
  const clean = rawCode.trim().toUpperCase();
  return /^[A-Z0-9_-]{1,32}$/.test(clean) ? clean : '';
}

export function generateRoomCode(prefix = 'GC') {
  const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomBytes = new Uint8Array(4);
  crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CHARS[randomBytes[i] % CHARS.length];
  }
  return `${prefix}-${code}`;
}

export function getBaseOrigin() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TUNNEL_URL) {
    return import.meta.env.VITE_TUNNEL_URL.trim();
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export async function copyLobbyLink(roomCode) {
  const baseOrigin = getBaseOrigin();
  const isLocalhost = baseOrigin.includes('localhost') || baseOrigin.includes('127.0.0.1');
  const url = `${baseOrigin}${window.location.pathname}?lobby=${encodeURIComponent(roomCode)}`;
  let messageText = url;
  if (isLocalhost) {
    messageText += `\n\n[Note: Localhost Host detected. Run "npm run dev:tunnel" for automated Cloudflare tunnel hosting!]`;
  }
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(messageText);
      return { success: true, url, messageText, isLocalhost };
    } catch (e) {}
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = messageText;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return { success: ok, url, messageText, isLocalhost };
  } catch (e) {
    return { success: false, url, messageText, isLocalhost, error: e };
  }
}

export function formatDiscordInvite(roomCode, joinUrl, hostName = 'Player') {
  const cleanHost = sanitizeName(hostName);
  const baseOrigin = getBaseOrigin();
  const isLocalhost = baseOrigin.includes('localhost') || baseOrigin.includes('127.0.0.1');
  const tunnelNote = isLocalhost ? `\n> 💡 *Host is on localhost. Run \`npm run dev:tunnel\` for automated Cloudflare tunnel hosting!*` : '';
  const finalUrl = joinUrl || `${baseOrigin}/?lobby=${encodeURIComponent(roomCode)}`;
  return [
    `🎮 **GOD-CALIBER MULTIPLAYER LOBBY INVITE** 🎮`,
    '```markdown',
    `[Host]      : ${cleanHost}`,
    `[Room Code] : ${roomCode}`,
    `[Status]    : Waiting for combatants (1/8)`,
    '```',
    `👉 **Join Match Instantly**: <${finalUrl}>${tunnelNote}`
  ].join('\n');
}

// --- NetworkManager Class ---

export class NetworkManager {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.peerPlayers = new Map();
    this.connections = new Map();
    this.peer = null;
    this._peerRateLimits = new Map(); // Peer ID -> { count, windowStart }
    this.isConnected = false;
    this.isHost = false;
    this.roomId = null;
    this.lobbyPin = null;
    this.broadcastTimer = 0;
    this.BROADCAST_INTERVAL = 0.05; // 20 Hz tick rate
    this.onPeerEvent = null;
    this.playerName = 'Player';

    // Connection state tracking (0.3.4)
    this.connectionState = CONNECTION_STATES.IDLE;
    this._retryCount = 0;
    this._retryTimer = null;
    this._pendingRoomCode = null;
    this._pendingPin = null;

    // Heartbeat tracking (0.3.4)
    this._heartbeatInterval = null;
    this._lastHeartbeatReceived = new Map(); // peerId -> timestamp

    // Diagnostics (0.3.4)
    this.diagnostics = {
      packetsSent: 0,
      packetsReceived: 0,
      lastLatency: 0,
      signalingState: 'disconnected'
    };
  }

  // --- ICE / STUN / TURN Configuration ---

  getIceServers() {
    const servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:openrelay.metered.ca:80' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ];
    // TURN relay fallback — sign up at https://www.metered.ca/tools/openrelay
    // Then set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL in .env.local
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURN_URL) {
      const turnRaw = import.meta.env.VITE_TURN_URL.trim();
      const turnUrls = turnRaw.includes(',') ? turnRaw.split(',').map(s => s.trim()).filter(Boolean) : turnRaw;
      const turnConfig = { urls: turnUrls };
      if (import.meta.env.VITE_TURN_USERNAME) turnConfig.username = import.meta.env.VITE_TURN_USERNAME;
      if (import.meta.env.VITE_TURN_CREDENTIAL) turnConfig.credential = import.meta.env.VITE_TURN_CREDENTIAL;
      servers.push(turnConfig);
    }
    return servers;
  }

  /** Returns PeerJS constructor config with explicit server settings */
  getPeerConfig() {
    const config = {
      config: {
        iceServers: this.getIceServers(),
        iceCandidatePoolSize: 10
      },
      debug: 1
    };
    // Support custom PeerJS server via env vars
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PEERJS_HOST) {
      config.host = import.meta.env.VITE_PEERJS_HOST;
      config.port = parseInt(import.meta.env.VITE_PEERJS_PORT || '443', 10);
      config.path = import.meta.env.VITE_PEERJS_PATH || '/';
      config.secure = import.meta.env.VITE_PEERJS_SECURE !== 'false';
    }
    return config;
  }

  // --- Connection State Management (0.3.4) ---

  _setConnectionState(newState, detail = null) {
    const prevState = this.connectionState;
    this.connectionState = newState;
    console.log(`[NetworkManager] Connection state: ${prevState} → ${newState}${detail ? ` (${detail})` : ''}`);
    if (typeof this.onPeerEvent === 'function') {
      this.onPeerEvent({ type: 'connection-state', state: newState, prevState, detail });
    }
  }

  // --- Initialization ---

  init(playerName = 'Player') {
    this.playerName = sanitizeName(playerName);
    console.log(`[NetworkManager] Initialized multiplayer profile for: ${this.playerName}`);
  }

  // --- Host Lobby ---

  hostLobby(pin = '') {
    if (this.isHost && this.peer) return this.roomId;

    this.stopHosting();

    this.isHost = true;
    this.isConnected = true;
    this.roomId = generateRoomCode('GC');
    this.lobbyPin = pin ? String(pin).trim() : null;

    console.log(`[NetworkManager] Hosting lobby: ${this.roomId} (PIN: ${this.lobbyPin || 'None'})`);
    this._setConnectionState(CONNECTION_STATES.CONNECTING, 'creating host peer');

    try {
      const peerConfig = this.getPeerConfig();
      this.peer = new Peer(this.roomId, peerConfig);

      this.peer.on('open', (id) => {
        console.log(`[NetworkManager] Host peer created with ID: ${id}`);
        this.diagnostics.signalingState = 'connected';
        this._setConnectionState(CONNECTION_STATES.CONNECTED, 'host peer registered');

        const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const note = isLocalhost ? ' (Host on localhost: remote WAN players require Cloudflare Tunnel: npx cloudflared tunnel --url http://localhost:5173)' : '';
        if (typeof this.onPeerEvent === 'function') {
          this.onPeerEvent({ type: 'host-open', roomId: this.roomId, peerId: id, isLocalhost, note });
        }
        this._startHeartbeat();
      });

      this.peer.on('connection', (conn) => {
        console.log(`[NetworkManager] Host received connection from: ${conn.peer}`);

        const clientPin = conn.metadata?.pin ? String(conn.metadata.pin).trim() : '';
        if (this.lobbyPin && clientPin !== this.lobbyPin) {
          console.warn(`[NetworkManager] Rejecting connection from ${conn.peer}: Invalid PIN`);
          conn.on('open', () => {
            conn.send({ type: 'error', message: 'Invalid PIN' });
            setTimeout(() => conn.close(), 300);
          });
          return;
        }

        if (conn.peerConnection) {
          conn.peerConnection.oniceconnectionstatechange = () => {
            console.log(`[NetworkManager] Host ICE state with ${conn.peer}: ${conn.peerConnection.iceConnectionState}`);
          };
        }

        this.connections.set(conn.peer, conn);

        conn.on('open', () => {
          console.log(`[NetworkManager] Connection open with client: ${conn.peer}`);
          const clientName = conn.metadata?.name || 'Player';
          this.spawnPeer(conn.peer, clientName);
          this._lastHeartbeatReceived.set(conn.peer, Date.now());

          // Send host's identification to client
          try {
            conn.send({
              type: 'identify',
              name: this.playerName,
              pos: [this.player.position.x, this.player.position.y, this.player.position.z],
              hp: Math.ceil(this.player.hp ?? 100),
              weapon: this.weapon?.currentWeaponType || 'weapon_ar15'
            });
          } catch (e) {}

          this.broadcastLocalState();

          if (typeof this.onPeerEvent === 'function') {
            this.onPeerEvent({ type: 'peer-joined', id: conn.peer, name: clientName });
          }
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.renderConnectedPlayers();
          }
        });

        conn.on('data', (data) => {
          this._lastHeartbeatReceived.set(conn.peer, Date.now());
          this.diagnostics.packetsReceived++;
          this.handleData(conn.peer, data);
        });

        conn.on('close', () => {
          console.log(`[NetworkManager] Peer disconnected: ${conn.peer}`);
          this._lastHeartbeatReceived.delete(conn.peer);
          this.removePeer(conn.peer);
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.renderConnectedPlayers();
          }
        });

        conn.on('error', (err) => {
          console.error(`[NetworkManager] Connection error with ${conn.peer}:`, err);
          this._lastHeartbeatReceived.delete(conn.peer);
          this.removePeer(conn.peer);
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.renderConnectedPlayers();
          }
        });
      });

      this.peer.on('error', (err) => {
        console.error(`[NetworkManager] PeerJS host error:`, err);
        this.diagnostics.signalingState = 'error';
        if (typeof this.onPeerEvent === 'function') {
          this.onPeerEvent({ type: 'error', error: err });
        }
      });

      this.peer.on('disconnected', () => {
        console.warn(`[NetworkManager] Host disconnected from signaling server, attempting reconnect...`);
        this.diagnostics.signalingState = 'reconnecting';
        try { this.peer.reconnect(); } catch (e) {}
      });

    } catch (e) {
      console.warn(`[NetworkManager] PeerJS host creation failed:`, e);
      this._setConnectionState(CONNECTION_STATES.FAILED, e.message);
    }

    return this.roomId;
  }

  // --- Stop Hosting ---

  stopHosting() {
    if (!this.peer && !this.isConnected) return;
    console.log(`[NetworkManager] Stopping hosting lobby: ${this.roomId}`);

    this._stopHeartbeat();
    this._clearRetryTimer();

    this.connections.forEach((conn) => {
      try { conn.close(); } catch (e) {}
    });
    this.connections.clear();

    this.peerPlayers.forEach((peer) => peer.destroy());
    this.peerPlayers.clear();

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    this.isHost = false;
    this.isConnected = false;
    this.roomId = null;
    this.lobbyPin = null;
    this._retryCount = 0;
    this._lastHeartbeatReceived.clear();
    this.diagnostics.signalingState = 'disconnected';

    this._setConnectionState(CONNECTION_STATES.IDLE);

    if (typeof this.onPeerEvent === 'function') {
      this.onPeerEvent({ type: 'disconnected' });
    }
  }

  // --- Join Lobby (with retry logic — 0.3.4) ---

  joinLobby(roomCode, pin = '') {
    this.stopHosting();

    const cleanRoomCode = sanitizeRoomCode(roomCode);
    if (!cleanRoomCode) {
      console.warn(`[NetworkManager] Invalid room code format: "${roomCode}"`);
      this._setConnectionState(CONNECTION_STATES.FAILED, 'Invalid room code format');
      return;
    }

    this.isHost = false;
    this.roomId = cleanRoomCode;
    this.lobbyPin = pin ? String(pin).trim() : null;
    this._pendingRoomCode = this.roomId;
    this._pendingPin = this.lobbyPin;
    this._retryCount = 0;

    console.log(`[NetworkManager] Joining lobby: ${this.roomId}`);
    this._setConnectionState(CONNECTION_STATES.CONNECTING);

    this._attemptJoin();
  }

  /** Internal: attempt a single join to the pending room code */
  _attemptJoin() {
    const roomCode = this._pendingRoomCode;
    if (!roomCode) return;

    // Clean up previous peer/connections if retrying
    this.connections.clear();
    this.peerPlayers.forEach(p => p.destroy());
    this.peerPlayers.clear();
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }

    const peerConfig = this.getPeerConfig();
    this.peer = new Peer(peerConfig);

    this.peer.on('open', (myId) => {
      console.log(`[NetworkManager] Client peer ready with ID: ${myId} (attempt ${this._retryCount + 1}/${MAX_RETRIES + 1})`);
      this.diagnostics.signalingState = 'connected';

      const conn = this.peer.connect(roomCode, {
        serialization: 'json',
        metadata: {
          name: this.playerName,
          pin: this._pendingPin
        }
      });

      if (!conn) {
        console.error(`[NetworkManager] peer.connect() returned null`);
        this._handleJoinFailure('Connection returned null');
        return;
      }

      // Attach WebRTC diagnostic listeners if peerConnection is present
      if (conn.peerConnection) {
        conn.peerConnection.oniceconnectionstatechange = () => {
          const state = conn.peerConnection.iceConnectionState;
          console.log(`[NetworkManager] ICE state with host: ${state}`);
          this.diagnostics.iceState = state;
        };
      }

      this.connections.set(roomCode, conn);

      // Connection open timeout — if DataChannel doesn't open within 15s, retry
      const connTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.warn(`[NetworkManager] Connection to ${roomCode} timed out after 15s`);
          this._handleJoinFailure('Connection timed out');
        }
      }, 15000);

      conn.on('open', () => {
        clearTimeout(connTimeout);
        this.isConnected = true;
        this._retryCount = 0;
        console.log(`[NetworkManager] ✅ Connected to room host: ${roomCode}`);
        this._setConnectionState(CONNECTION_STATES.CONNECTED);
        this.spawnPeer(roomCode, 'Host');
        this._lastHeartbeatReceived.set(roomCode, Date.now());

        // Send client's identification to host
        try {
          conn.send({
            type: 'identify',
            name: this.playerName,
            pos: [this.player.position.x, this.player.position.y, this.player.position.z],
            hp: Math.ceil(this.player.hp ?? 100),
            weapon: this.weapon?.currentWeaponType || 'weapon_ar15'
          });
        } catch (e) {}

        this.broadcastLocalState();
        this._startHeartbeat();

        if (typeof this.onPeerEvent === 'function') {
          this.onPeerEvent({ type: 'connected', roomId: roomCode });
        }
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.renderConnectedPlayers();
        }
      });

      conn.on('data', (data) => {
        this._lastHeartbeatReceived.set(roomCode, Date.now());
        this.diagnostics.packetsReceived++;
        this.handleData(roomCode, data);
      });

      conn.on('close', () => {
        clearTimeout(connTimeout);
        console.log(`[NetworkManager] Disconnected from host: ${roomCode}`);
        this._lastHeartbeatReceived.delete(roomCode);
        this.removePeer(roomCode);
        this.isConnected = false;
        this._stopHeartbeat();
        this._setConnectionState(CONNECTION_STATES.DISCONNECTED, 'host closed connection');
        if (typeof this.onPeerEvent === 'function') {
          this.onPeerEvent({ type: 'host-disconnected' });
        }
        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.renderConnectedPlayers();
        }
      });

      conn.on('error', (err) => {
        clearTimeout(connTimeout);
        console.error(`[NetworkManager] Connection error to host:`, err);
        if (!this.isConnected) {
          this._handleJoinFailure(`Connection error: ${err.type || err.message || err}`);
        }
      });
    });

    this.peer.on('error', (err) => {
      console.error(`[NetworkManager] PeerJS client error:`, err);
      this.diagnostics.signalingState = 'error';

      // Host peer not found on signaling server — retry
      if (err.type === 'peer-unavailable' && !this.isConnected) {
        console.warn(`[NetworkManager] Host peer "${roomCode}" not found on signaling server`);
        this._handleJoinFailure('Host not found — lobby may not exist or host is not ready');
        return;
      }

      if (typeof this.onPeerEvent === 'function') {
        this.onPeerEvent({ type: 'error', error: err });
      }
    });

    this.peer.on('disconnected', () => {
      if (this.isConnected) {
        console.warn(`[NetworkManager] Client disconnected from signaling server, attempting reconnect...`);
        this.diagnostics.signalingState = 'reconnecting';
        try { this.peer.reconnect(); } catch (e) {}
      }
    });
  }

  /** Handle join failure with exponential backoff retry (0.3.4) */
  _handleJoinFailure(reason) {
    this._retryCount++;
    if (this._retryCount <= MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, this._retryCount - 1); // 1.5s, 3s, 6s
      console.log(`[NetworkManager] Retrying join (${this._retryCount}/${MAX_RETRIES}) in ${delay}ms...`);
      this._setConnectionState(CONNECTION_STATES.RETRYING, `attempt ${this._retryCount}/${MAX_RETRIES} — ${reason}`);

      this._clearRetryTimer();
      this._retryTimer = setTimeout(() => {
        this._attemptJoin();
      }, delay);
    } else {
      console.error(`[NetworkManager] ❌ Join failed after ${MAX_RETRIES} retries: ${reason}`);
      this._setConnectionState(CONNECTION_STATES.FAILED, reason);
      if (typeof this.onPeerEvent === 'function') {
        this.onPeerEvent({ type: 'join-failed', reason, retries: this._retryCount });
      }
    }
  }

  _clearRetryTimer() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  // --- Heartbeat System (0.3.4) ---

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (!this.isConnected) return;

      // Send heartbeat to all connections
      this.broadcast({ type: 'heartbeat', ts: Date.now() });
      this.diagnostics.packetsSent++;

      // Check for timed-out peers (host only)
      if (this.isHost) {
        const now = Date.now();
        const timedOut = [];
        this._lastHeartbeatReceived.forEach((lastTs, peerId) => {
          if (now - lastTs > HEARTBEAT_TIMEOUT_MS) {
            console.warn(`[NetworkManager] Peer ${peerId} heartbeat timeout (${Math.round((now - lastTs) / 1000)}s)`);
            timedOut.push(peerId);
          }
        });
        timedOut.forEach(peerId => {
          this._lastHeartbeatReceived.delete(peerId);
          this.removePeer(peerId);
          const conn = this.connections.get(peerId);
          if (conn) {
            try { conn.close(); } catch (e) {}
            this.connections.delete(peerId);
          }
          if (window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.renderConnectedPlayers();
          }
        });
      }

      // Check host heartbeat timeout (client only)
      if (!this.isHost && this.roomId) {
        const hostTs = this._lastHeartbeatReceived.get(this.roomId);
        if (hostTs && Date.now() - hostTs > HEARTBEAT_TIMEOUT_MS) {
          console.warn(`[NetworkManager] Host heartbeat timeout`);
          this._stopHeartbeat();
          this.isConnected = false;
          this._setConnectionState(CONNECTION_STATES.DISCONNECTED, 'host heartbeat timeout');
          if (typeof this.onPeerEvent === 'function') {
            this.onPeerEvent({ type: 'host-disconnected', reason: 'heartbeat timeout' });
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  // --- Data Handling ---

  handleData(senderPeerId, data) {
    let packet = data;
    if (typeof data === 'string') {
      try {
        packet = JSON.parse(data);
      } catch (e) {
        return;
      }
    }
    if (!packet || typeof packet !== 'object') return;

    // --- SECURITY HARDENING (0.3.7 BASTION & 0.3.11 SENTRY) ---
    // 1. Packet Whitelist
    const ALLOWED_TYPES = new Set([
      'state', 'hit', 'bullet_fire', 'kill', 'identify', 'phase', 'start_match',
      'heartbeat', 'heartbeat-ack', 'error',
      'item_pickup', 'item_destroyed', 'item_drop', 'item_spawned',
      'container_loot', 'container_state_sync',
      'enemy_damage', 'enemy_health_update', 'enemy_died', 'enemy_sync',
      'world_init', 'spectator_state', 'victory_state'
    ]);
    if (!packet.type || !ALLOWED_TYPES.has(packet.type)) {
      console.warn(`[NetworkManager] Dropped unknown/unallowed packet type "${packet.type}" from peer ${senderPeerId}`);
      return;
    }

    // 2. Per-Peer Sliding Window Rate Limiting (max 60 packets / 1000ms)
    const now = Date.now();
    let limitInfo = this._peerRateLimits.get(senderPeerId);
    if (!limitInfo || now - limitInfo.windowStart > 1000) {
      limitInfo = { count: 1, windowStart: now };
      this._peerRateLimits.set(senderPeerId, limitInfo);
    } else {
      limitInfo.count++;
      if (limitInfo.count > 60) {
        console.warn(`[NetworkManager] Rate limit exceeded for peer ${senderPeerId} (${limitInfo.count} pkts/sec)`);
        return;
      }
    }

    // 3. Host-Side Hit RPC Validation (damage capping & distance check)
    if (packet.type === 'hit') {
      packet.damage = Math.max(0, Math.min(Number(packet.damage) || 0, 200));
      if (Array.isArray(packet.shooterPos) && Array.isArray(packet.targetPos)) {
        const dx = packet.shooterPos[0] - packet.targetPos[0];
        const dy = packet.shooterPos[1] - packet.targetPos[1];
        const dz = packet.shooterPos[2] - packet.targetPos[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > 150 * 150) {
          console.warn(`[NetworkManager] Rejected hit RPC from ${senderPeerId}: distance exceeds 150m (${Math.sqrt(distSq).toFixed(1)}m)`);
          return;
        }
      }
    }

    // Heartbeat handling (0.3.4)
    if (packet.type === 'heartbeat') {
      // Respond with ack
      const conn = this.connections.get(senderPeerId);
      if (conn && conn.open) {
        try { conn.send({ type: 'heartbeat-ack', ts: packet.ts, clientTs: Date.now() }); } catch (e) {}
      }
      return;
    }

    if (packet.type === 'heartbeat-ack') {
      // Calculate round-trip latency
      if (packet.ts) {
        this.diagnostics.lastLatency = Date.now() - packet.ts;
      }
      return;
    }

    if (packet.type === 'error') {
      console.warn(`[NetworkManager] Received error packet:`, packet.message);
      if (typeof this.onPeerEvent === 'function') {
        this.onPeerEvent({ type: 'error', error: packet.message });
      }
      return;
    }

    if (packet.type === 'identify') {
      const targetId = packet.sender || senderPeerId;
      let peer = this.peerPlayers.get(targetId);
      if (!peer) {
        this.spawnPeer(targetId, packet.name || 'Player', packet.pos);
        peer = this.peerPlayers.get(targetId);
      } else {
        peer.displayName = packet.name || peer.displayName;
        if (packet.pos) peer.updateSnapshot(packet.pos, 0, 0, packet.hp, packet.weapon, false, Date.now());
      }
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.renderConnectedPlayers();
      }
      if (this.isHost) {
        // Send initial world state (active ground items & match phase) to newly connected peer
        const worldItems = window.gameInstance?.worldItemManager?.groundItems?.map(g => ({
          itemData: g.itemData,
          pos: [g.meshGroup.position.x, g.meshGroup.position.y, g.meshGroup.position.z]
        })) || [];
        const conn = this.connections.get(senderPeerId);
        if (conn && conn.open) {
          try {
            conn.send({
              type: 'world_init',
              items: worldItems,
              phase: window.gameInstance?.gameState?.phase,
              circleStage: window.gameInstance?.gameState?.circleStage
            });
          } catch (e) {}
        }
        this.broadcast({ ...packet, sender: targetId }, senderPeerId);
      }
      return;
    }

    if (packet.type === 'state') {
      const targetId = packet.sender || senderPeerId;
      let peer = this.peerPlayers.get(targetId);
      if (!peer) {
        this.spawnPeer(targetId, packet.name || 'Player');
        peer = this.peerPlayers.get(targetId);
      }
      if (peer) {
        peer.updateSnapshot(
          packet.pos,
          packet.yaw,
          packet.pitch,
          packet.hp,
          packet.weapon,
          packet.firing,
          packet.ts,
          packet.boots,
          packet.speedMultiplier
        );
      }

      if (this.isHost) {
        this.broadcast({ ...packet, sender: targetId }, senderPeerId);
      }
      return;
    }

    // Route custom WebRTC events (start_match, phase, hit, item sync, enemy sync, etc.)
    if (typeof this.onPeerEvent === 'function') {
      this.onPeerEvent(packet, senderPeerId);
    }

    if (this.isHost) {
      this.broadcast(packet, senderPeerId);
    }
  }

  // --- Broadcasting ---

  broadcast(data, excludePeerId = null) {
    this.connections.forEach((conn, id) => {
      if (id !== excludePeerId && conn && conn.open) {
        try {
          conn.send(data);
          this.diagnostics.packetsSent++;
        } catch (e) {
          console.error(`[NetworkManager] Failed sending broadcast to ${id}:`, e);
        }
      }
    });
  }

  broadcastLocalState() {
    if (!this.isConnected || !this.player || !this.player.position) return;

    const firing = Boolean(
      this.isFiring ||
      this.weapon?.isFiring ||
      (this.controls?.mouseDown && !this.weapon?.isReloading)
    );

    const state = {
      type: 'state',
      ts: Date.now(),
      pos: [
        Number(this.player.position.x.toFixed(3)),
        Number(this.player.position.y.toFixed(3)),
        Number(this.player.position.z.toFixed(3))
      ],
      yaw: Number((this.player.yaw || 0).toFixed(3)),
      pitch: Number((this.player.pitch || 0).toFixed(3)),
      hp: Math.ceil(this.player.hp ?? 100),
      weapon: this.weapon?.currentWeaponType || 'weapon_ar15',
      boots: window.gameInstance?.inventory?.equipment?.legs?.baseId || null,
      speedMultiplier: Number((this.player?.speedMultiplier || 1.0).toFixed(2)),
      firing: firing,
      sprinting: Boolean(this.player.isSprinting),
      sliding: Boolean(this.player.isSliding),
      reloading: Boolean(this.weapon?.isReloading),
      name: this.playerName
    };

    this.broadcast(state);
    this.isFiring = false;
  }

  // --- Peer Management ---

  kickPeer(id) {
    const conn = this.connections.get(id);
    if (conn) {
      try {
        conn.send({ type: 'error', message: 'You have been kicked by the host.' });
        conn.close();
      } catch (e) {}
      this.connections.delete(id);
    }
    this._lastHeartbeatReceived.delete(id);
    this.removePeer(id);
    console.log(`[NetworkManager] Host kicked peer: ${id}`);
  }

  broadcastEnemyState() {
    if (!this.isConnected || !this.isHost) return;
    const targetMgr = window.gameInstance?.targetManager;
    if (!targetMgr || !targetMgr.targets) return;

    const enemySnapshots = [];
    for (let i = 0; i < targetMgr.targets.length; i++) {
      const t = targetMgr.targets[i];
      if (t && !t.isDestroyed && t.position) {
        enemySnapshots.push({
          idx: i,
          idName: t.idName,
          type: t.type,
          pos: [Number(t.position.x.toFixed(2)), Number(t.position.y.toFixed(2)), Number(t.position.z.toFixed(2))],
          rotY: Number((t.group?.rotation?.y || 0).toFixed(2)),
          hp: Math.ceil(t.hp)
        });
      }
    }

    if (enemySnapshots.length > 0) {
      this.broadcast({
        type: 'enemy_sync',
        enemies: enemySnapshots
      });
    }
  }

  sendItemPickup(itemId, pickerId) {
    if (!this.isConnected) return;
    this.broadcast({
      type: 'item_pickup',
      itemId,
      pickerId: pickerId || this.peer?.id || 'local'
    });
  }

  sendItemDrop(itemData, position) {
    if (!this.isConnected) return;
    this.broadcast({
      type: 'item_drop',
      itemData,
      pos: [position.x, position.y, position.z]
    });
  }

  sendContainerLoot(chestIndex, position) {
    if (!this.isConnected) return;
    this.broadcast({
      type: 'container_loot',
      chestIndex,
      pos: [position.x, position.y, position.z]
    });
  }

  sendEnemyDamage(enemyIndex, damage, isHeadshot) {
    if (!this.isConnected) return;
    this.broadcast({
      type: 'enemy_damage',
      enemyIndex,
      damage,
      isHeadshot,
      shooterId: this.peer?.id || 'local'
    });
  }

  update(deltaTime) {
    this.peerPlayers.forEach(peer => peer.update(deltaTime));

    this.broadcastTimer += deltaTime;
    if (this.broadcastTimer >= this.BROADCAST_INTERVAL) {
      this.broadcastTimer = 0;
      this.broadcastLocalState();
      if (this.isHost) {
        this.broadcastEnemyState();
      }
    }
  }

  spawnPeer(id, displayName, pos) {
    if (this.peerPlayers.has(id)) return;
    const cleanName = sanitizeName(displayName);
    const peer = new PeerPlayer(this.scene, id, cleanName);
    const initialPos = pos || [
      this.player?.position?.x ? this.player.position.x + (Math.random() - 0.5) * 4 : 2,
      this.player?.position?.y || 1,
      this.player?.position?.z ? this.player.position.z + (Math.random() - 0.5) * 4 : 2
    ];
    peer.updateSnapshot(initialPos, 0, 0, 100, 'weapon_ar15', false, Date.now());
    this.peerPlayers.set(id, peer);
    console.log(`[NetworkManager] Spawned 3D PeerPlayer mesh for: ${cleanName} (${id})`);
  }

  removePeer(id) {
    const conn = this.connections.get(id);
    if (conn) {
      this.connections.delete(id);
    }
    const peer = this.peerPlayers.get(id);
    if (peer) {
      peer.destroy();
      this.peerPlayers.delete(id);
      if (typeof this.onPeerEvent === 'function') {
        this.onPeerEvent({ type: 'peer-left', id });
      }
    }
  }
}
