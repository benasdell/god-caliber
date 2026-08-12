# 📜 God-Caliber — Master Patch Notes & Release Changelog

> **Complete Version History**: Patch 0.1.0 to Patch 0.3.7 (Bastion)  
> **Engine**: Three.js (v0.170.0) + Vite (v5.4.0) + PeerJS WebRTC

---

## Table of Contents

- [Patch 0.3 Series — Multiplayer, Vision & Bastion Security](#-patch-03-series--multiplayer-vision--bastion-security)
  - [Sub-Patch 0.3.7 — "Bastion" Security Hardening & Performance Overhaul](#sub-patch-037--bastion-security-hardening--performance-overhaul)
  - [Sub-Patch 0.3.6 — Project Rename & Remote Integration](#sub-patch-036--project-rename--remote-integration)
  - [Sub-Patch 0.3.5 — WebRTC PeerJS WAN Networking & TURN Relays](#sub-patch-035--webrtc-peerjs-wan-networking--turn-relays)
  - [Sub-Patch 0.3.4 — Multiplayer Combat Sync, 3D Health Bars & Scoreboard](#sub-patch-034--multiplayer-combat-sync-3d-health-bars--scoreboard)
  - [Sub-Patch 0.3.0 — 0.3.3 — Vision Framework (40/40/20 Balance)](#sub-patch-030--033--vision-framework-404020-balance)
- [Patch 0.2 Series — AI Steering, Inventory & ARPG Crafting](#-patch-02-series--ai-steering-inventory--arpg-crafting)
  - [Sub-Patch 0.2.2 — Inventory UI & Stat Synergy Systems](#sub-patch-022--inventory-ui--stat-synergy-systems)
  - [Sub-Patch 0.2.1 — Tactical Cluster Spawner & Steering AI](#sub-patch-021--tactical-cluster-spawner--steering-ai)
  - [Sub-Patch 0.2.0 — Ground Item Loot Beams & World Drops](#sub-patch-020--ground-item-loot-beams--world-drops)
- [Patch 0.1 Series — Core WebGL Engine & Physics Foundation](#-patch-01-series--core-webgl-engine--physics-foundation)
  - [Sub-Patch 0.1.3 — Jump Physics & Speed Recalibration](#sub-patch-013--jump-physics--speed-recalibration)
  - [Sub-Patch 0.1.2 — Blocker UI & Pointer Lock Stability](#sub-patch-012--blocker-ui--pointer-lock-stability)
  - [Sub-Patch 0.1.1 — Capsule Collision & Zipline/Ladder Offset Fixes](#sub-patch-011--capsule-collision--ziplineladder-offset-fixes)
  - [Sub-Patch 0.1.0 — Initial 3D Renderer & Procedural Weapons](#sub-patch-010--initial-3d-renderer--procedural-weapons)

---

## 🛡️ Patch 0.3 Series — Multiplayer, Vision & Bastion Security

### Sub-Patch 0.3.7 — "Bastion" Security Hardening & Performance Overhaul
*Release Date: August 2026*

* **Host-Authoritative RPC Validation**:
  - Implemented host-side validation on `hit` RPCs: capped max damage per hit at `200 HP`, verified ray distance `<= 150m`, and validated sender/target peer IDs.
  - Added strict RPC packet type whitelist (`state`, `hit`, `bullet_fire`, `kill`, `identify`, `phase`, `start_match`, `heartbeat`, `heartbeat-ack`, `error`).
  - Added per-peer sliding window rate limiting (max 60 packets / 1000ms window) to prevent packet spamming/flooding.
* **Input Sanitization**:
  - Sanitized `roomCode` and `lobby` URL query parameters using regex `/^[A-Z0-9_-]{1,32}$/i`.
  - Sanitized `localStorage` keybindings against `KeyboardEvent.code` whitelist.
  - Enforced non-negative finite bounds checking on player and peer damage calls (`Math.max(0, Math.min(Number(amount) || 0, 200))`).
* **GPU Memory Leak Disposal**:
  - Implemented explicit `.geometry.dispose()` and `.material.dispose()` calls during weapon model rebuilds (`weapon.js`), dead enemy removals (`targets.js`), and ground loot drops (`world-items.js`).
  - Added static material caching (`WEAPON_MATERIAL_CACHE`) for weapon procedural meshes to prevent WebGL shader re-compilations.
* **GC Allocation Elimination**:
  - Preallocated static scratch `Vector3` and `Ray` instances across `bullets.js`, `terrain.js`, and `main.js` to eliminate per-shot and per-frame garbage collection pauses.
* **Audio Engine Optimization**:
  - Added `stopAmbientBGM()` with oscillator tracking and pre-generated static noise buffers (`crackBuffer` & `tailBuffer`) for zero-allocation gunshot sound synthesis.

---

### Sub-Patch 0.3.6 — Project Rename & Remote Integration
*Release Date: August 2026*

* **Project Renaming**:
  - Official project codename updated from `delightful-franklin` to **`god-caliber`**.
  - Updated `package.json`, Vite configuration, documentation, and Git remote origin (`https://github.com/benasdell/god-caliber.git`).

---

### Sub-Patch 0.3.5 — WebRTC PeerJS WAN Networking & TURN Relays
*Release Date: August 2026*

* **WAN & Cloudflare Tunnel Connectivity**:
  - Fixed WebRTC `RTCDataChannel` negotiation by stripping legacy `{ reliable: false }` parameters.
  - Integrated OpenRelay / Metered.ca TURN fallback (`turn:global.relay.metered.ca:80`) for WAN and Symmetric NAT traversal.
  - Standardized signaling configuration across host and client peers.
  - Automated Cloudflare Tunnel hosting via `npm run dev:tunnel`.

---

### Sub-Patch 0.3.4 — Multiplayer Combat Sync, 3D Health Bars & Scoreboard
*Release Date: August 2026*

* **20Hz WebRTC Combat Synchronization**:
  - Fixed static remote player mesh spawning by syncing foot level collider positions per frame (`Player.position.set(collider.start.x, collider.start.y - 0.35, collider.start.z)`).
  - Added WebRTC RPC broadcasting for `bullet_fire` tracer beams, `hit` damage, and `kill` eliminations.
  - Attached 3D bounding spheres (`radius 0.65m`) for zero-allocation remote peer hitscan raycasting.
* **UI & Scoreboard Overhaul**:
  - Enhanced HUD health bar with Cyan (`#00f0ff`), Amber (`#ffb703`), and Red (`#ff2a6d`) dynamic gradient fills.
  - Added 3D floating canvas nameplates with overhead HP bars above peer avatars.
  - Replaced legacy dummy points system with real-time competitive Scoreboard displaying `RANK`, `OPERATOR`, `STATUS`, `KILLS ⚔️`, `DEATHS 💀`, `K/D`, and `PING 📶`.

---

### Sub-Patch 0.3.0 — 0.3.3 — Vision Framework (40/40/20 Balance)
*Release Date: August 2026*

* **Core Balance Framework**:
  - Adopted Surnex's **Micro / Meso / Macro** competitive taxonomy (*"Once you see this, You'll see Competitive Games Differently"* - [https://youtu.be/NgHvdCcmQ4o](https://youtu.be/NgHvdCcmQ4o)).
  - Engineered **40% Micro (Execution Layer)**, **40% Macro (Systems Layer)**, and **20% Meso (Probability Layer)** game design balance.
  - Established 0% Pay-to-Win architecture and zero-installation WebGL browser accessibility.

---

## 🎒 Patch 0.2 Series — AI Steering, Inventory & ARPG Crafting

### Sub-Patch 0.2.2 — Inventory UI & Stat Synergy Systems
*Release Date: August 2026*

* **ARPG Inventory & Crafting Grid**:
  - Implemented 6x4 grid inventory overlay with drag-and-drop item management.
  - Created multi-tiered crafting recipes and stat prefix/suffix modding systems (*Path of Exile* inspired).
  - Added armor reduction formulas, EHP calculations, and active equipment sockets.

---

### Sub-Patch 0.2.1 — Tactical Cluster Spawner & Steering AI
*Release Date: August 2026*

* **Tactical AI Overhaul**:
  - Replaced random AI spawning with `ClusterSpawner` maintaining zone population caps (>25m buffer from player).
  - Integrated `SteeringBehaviors` for Seek, Arrival, Separation, Wall Avoidance, and Flanking.
  - Added specialized bot archetypes: Heavy Goliath (Battleaxe), Pistol Scout, and Rifleman.

---

### Sub-Patch 0.2.0 — Ground Item Loot Beams & World Drops
*Release Date: August 2026*

* **Loot & Extraction System**:
  - Added 3D world item drops with rarity-coded vertical loot beams (Common, Magic, Rare, Epic, Legendary).
  - Implemented interactive loot chests and drop probability tables (*Escape from Tarkov* risk-reward loop).

---

## ⚙️ Patch 0.1 Series — Core WebGL Engine & Physics Foundation

### Sub-Patch 0.1.3 — Jump Physics & Speed Recalibration
*Release Date: August 2026*

* **Kinetic Movement Tuning**:
  - Recalibrated walking speed (`10 m/s`), sprint speed (`18 m/s`), and kinetic slide threshold (`12 m/s`).
  - Tuned gravity (`30 m/s²`) and jump impulse for responsive air-strafing and obstacle clearance.

---

### Sub-Patch 0.1.2 — Blocker UI & Pointer Lock Stability
*Release Date: August 2026*

* **Input & Menu Stability**:
  - Fixed ESC key pointer lock race conditions with `timeSinceInvClose` grace window guards.
  - Prevented UI overlay desynchronization during rapid inventory toggles.

---

### Sub-Patch 0.1.1 — Capsule Collision & Zipline/Ladder Offset Fixes
*Release Date: August 2026*

* **Octree Physics & Environment Alignment**:
  - Added `attachLadder()` 0.6m outward normal offset to prevent capsule mesh clipping into vertical pillars.
  - Implemented void death plane (`Y = -25m`) recovery teleport.

---

### Sub-Patch 0.1.0 — Initial 3D Renderer & Procedural Weapons
*Release Date: August 2026*

* **Foundational WebGL Engine**:
  - Built Three.js r170 renderer, octree environment collision solver, and Web Audio API procedural sound engine.
  - Created procedural 3D model builders for AR-15, Pistol, Shotgun, and Sniper weapons.

---
*Archived individual patch notes are preserved in [`docs/archive/`](file:///c:/Users/benas/Documents/antigravity/god-caliber/docs/archive).*
