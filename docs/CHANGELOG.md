# 📜 God-Caliber — Master Patch Notes & Release Changelog

> **Complete Version History**: Patch 0.1.0 to Patch 0.3.9e (Hotfix)  
> **Engine**: Three.js (v0.170.0) + Vite (v5.4.0) + PeerJS WebRTC

---

## Table of Contents

- [Patch 0.3 Series — Multiplayer, Vision & System Overhauls](#-patch-03-series--multiplayer-vision--system-overhauls)
  - [Sub-Patch 0.3.11b — Hotfix: Spawn Clearance, Crafting Dust CDF, Singleplayer Death Loop & Spectator Masking](#sub-patch-0311b--hotfix-spawn-clearance-crafting-dust-cdf-singleplayer-death-loop--spectator-masking)
  - [Sub-Patch 0.3.9e — Hotfix: Recipe Blueprint Unlocking & Dynamic Legendary Crafting](#sub-patch-039e--hotfix-recipe-blueprint-unlocking--dynamic-legendary-crafting)
  - [Sub-Patch 0.3.9d — Hotfix: Match Restart Gear Reset & Secondary Weapon Auto-Equip](#sub-patch-039d--hotfix-match-restart-gear-reset--secondary-weapon-auto-equip)
  - [Sub-Patch 0.3.9c — Hotfix: KeyF Interaction, KeyE Inventory Toggle, Scrollbar Elimination & Dynamic Grid](#sub-patch-039c--hotfix-keyf-interaction-keye-inventory-toggle-scrollbar-elimination--dynamic-grid)
  - [Sub-Patch 0.3.9b — Hotfix: KeyE Toggle Fix, Crouch to KeyC, & 10 Structure Terrain Reset](#sub-patch-039b--hotfix-keye-toggle-fix-crouch-to-keyc--10-structure-terrain-reset)
  - [Sub-Patch 0.3.9 — Inventory, Crafting, Terrain & HUD Overhaul](#sub-patch-039--inventory-crafting-terrain--hud-overhaul)
  - [Sub-Patch 0.3.8 — "Thunderbird" Modeling, Procedural Terrain & Interaction Overhaul](#sub-patch-038--thunderbird-modeling-procedural-terrain--interaction-overhaul)
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

## 🛡️ Patch 0.3 Series — Multiplayer, Vision & System Overhauls

### Sub-Patch 0.3.11b — Hotfix: Spawn Clearance, Crafting Dust CDF, Singleplayer Death Loop & Spectator Masking
*Release Date: August 2026*

* **Spatial Clearance & Spawn Generation Refactor**:
  - Implemented 50-iteration rejection sampling in `src/player.js` (`getSafeSpawnPoint()`) with a strict 15-meter safety buffer around structural AABBs (`getStructureExclusionZones()`).
  - Downward Octree raycast floor clamping with slope angle validation ($\text{normal}.y \ge 0.866$, slope $\le 30^\circ$).
  - Deterministic fallback to 16 pre-baked validated perimeter waypoints located in open terrain.
* **Crafting Dust Rarity Pool Distribution & Monster Scaling**:
  - Replaced hardcoded epic dust drops with a tiered Cumulative Distribution Function (CDF): Common (50.0%), Magic (28.0%), Rare (15.0%), Epic (5.5%), Legendary (1.5%).
  - Dust stack sizes dynamically scale with monster classification: Minions (5–10), Elites (15–25), Pinnacle (35–50).
  - Dynamic 3D loot beacon beam heights (2.5m–7.2m) and procedural glow materials matching dropped dust rarity.
  - Enabled right-click instant consumption of crafting dust vials into the recycled dust inventory balance.
* **Session Topology & Singleplayer Respawn Loop**:
  - Decoupled singleplayer elimination from spectator mode: dying without a Respawn Token immediately displays the Defeat modal and halts pointer lock without entering spectator flycam.
  - "PLAY AGAIN" directly re-arms the operator with starter loadout and safe coordinates.
* **Spectator HUD Masking & Interaction Suppression**:
  - When in spectator mode, the combat HUD (health, posture, ammo, reticle, sniper scope, interaction prompt) is masked, and the `#spectator-banner` HUD is displayed.
  - Suppressed all firing, ADS, melee, weapon swapping, inventory toggle, and world object raycasts while spectating.
  - Retained `Tab` key scoreboard access and noclip flycam movement.

### Sub-Patch 0.3.9e — Hotfix: Recipe Blueprint Unlocking & Dynamic Legendary Crafting
*Release Date: August 2026*

* **Right-Click Recipe Blueprint Unlocking**:
  - Right-clicking a Recipe item in the Inventory storage grid consumes the recipe and permanently unlocks the specific Special Legendary item (e.g. `VORTEX ASSAULT RIFLE`) as a craftable blueprint in the Crafting Bench. Persists across matches via `localStorage`.
* **Crafting Bench Integration & Cleaning**:
  - Dynamically appends unlocked Legendary blueprints to the Crafting Bench selection grid (`.is-legendary-card`).
  - Removed obsolete `Legendary Recipe` item from the Crafting Bench grid and `RECIPES` category filter in `index.html`.
* **Action Button Update**:
  - Selecting an unlocked Legendary blueprint updates the forge panel action button to **`CRAFT ITEM`** (`30 Epic, 20 Legendary Dust`).

### Sub-Patch 0.3.9d — Hotfix: Match Restart Gear Reset & Secondary Weapon Auto-Equip
*Release Date: August 2026*

* **Match Restart Equipment Reset**:
  - Fixed equipment state retention across match restarts in `src/inventory.js` (`initDefaultItems()`). All 7 equipment slots (`head`, `torso`, `legs`, `gloves`, `primary`, `secondary`, `melee`) are now explicitly reset to `null` before equipping default starting weapons (P-57 Pistol + Combat Knife).
* **Smart Secondary Weapon Auto-Equip**:
  - Resolved `getEquipmentSlotForItem(item)` and `autoEquipItem(item)` in `src/inventory-ui.js` so picking up a second weapon automatically equips into the `secondary` weapon slot whenever `secondary` is empty, regardless of whether Slot 1 or Slot 2 is currently active.

### Sub-Patch 0.3.9c — Hotfix: KeyF Interaction, KeyE Inventory Toggle, Scrollbar Elimination & Dynamic Grid
*Release Date: August 2026*

* **KeyF Interaction & KeyE Inventory Toggle Separation**:
  - Restored **`KeyF`** (`interact: 'KeyF'`) exclusively for interacting with crosshair targets (loot pickup, chest opening, ladder climbing, zipline attachment).
  - Reserved **`KeyE`** (`inventory: 'KeyE'`) exclusively for toggling the Inventory UI open and closed.
* **Scrollbar Elimination**:
  - Rescaled `.inv-modal` layout, paddings, gaps, and sub-panels with `overflow: hidden` to fit cleanly inside the screen without requiring a vertical scrollbar.
* **Dynamic 5x12 Storage Grid Scaling**:
  - Updated cell size calculation in `src/inventory-ui.js` (`cellW` and `cellH` from container width/height) and grid styling in `src/style.css` so the 5x12 storage grid scales dynamically to fit its sub-window perfectly.

### Sub-Patch 0.3.9b — Hotfix: KeyE Toggle Fix, Crouch to KeyC, & 10 Structure Terrain Reset
*Release Date: August 2026*

* **KeyE Toggle Latch Fix**:
  - Resolved multi-frame key repetition latch bug on `KeyE` with a 300ms debounce buffer so pressing `KeyE` opens and keeps the unified Inventory UI open reliably.
* **Default Crouch Keybinding to `KeyC`**:
  - Set default crouch/slide keybinding to **`KeyC`** (`crouch: 'KeyC'`).
* **Fresh Procedural Terrain Reset & 10 Structure Types**:
  - Removed all legacy platforms, pillars, monorail hubs, and legacy ziplines.
  - Built 10 simple procedural structure generators: single-level houses, two-story buildings with internal 45° ramp staircases, elevated sniper towers with ladders, pillbox bunkers, straight cover walls, L-corner barriers, cargo container clusters, catwalk bridges, monolithic pillars, and open warehouses.
  - Scattered ~50 structure instances naturally across the 1000x1000m Testing Arena with a 35m minimum clearance buffer.

### Sub-Patch 0.3.9 — Inventory, Crafting, Terrain & HUD Overhaul
*Release Date: August 2026*

* **Keybind Simplification (`KeyE` / `Escape`)**:
  - Unified inventory toggle to `KeyE`. Pressing `Escape` or `KeyE` while open closes inventory cleanly and re-engages pointer lock safely.
* **Merged Full-Screen Inventory & Crafting UI**:
  - Merged storage and crafting tabs into one unified full-window overlay (`94vw` x `92vh`, max `1600x1000px`).
  - Left column Operator Gear mannequin, right column 5x12 Inventory Grid, bottom section Integrated Crafting Bench.
* **Unlocked Item Fix & Right-Click Recipe Learning**:
  - Fixed state bug so items with `isLocked === false` can be freely dragged, upgraded, and recycled.
  - Right-clicking Recipe items in inventory consumes the recipe, unlocks it for the match, and persists to `localStorage`.
* **Auto-Equip Loot Feature**:
  - Picking up an item for an unequipped gear slot automatically equips it directly to that slot (`⚡ AUTO-EQUIPPED <Item> [<SLOT>]`).
* **Centered Minimap Chevron & Dynamic Scrolling**:
  - Anchored local player chevron arrow at exact canvas center `(90, 90)` while background grid, safe rings, POIs, and enemy markers translate dynamically.
* **First-Principles Surface Loot Spawning & 1000m Circle Rescaling**:
  - Restructured tactical crates and loot coordinates across 5 POI floor slabs.
  - Rescaled initial BR circle radius to `500m` (1000m diameter) across 5 shrinking stages (`500m` → `300m` → `180m` → `90m` → `30m` → `5m`).

### Sub-Patch 0.3.8 — "Thunderbird" Modeling, Procedural Terrain & Interaction Overhaul
*Release Date: August 2026*

* **1000x1000m Map Expansion & 5 POIs**:
  - Expanded world bounds from `240x240m` to `1000x1000m` with `18m` perimeter walls.
  - Constructed 5 Points of Interest (POIs): *Sector Zero Citadel*, *Outpost Omega Pillboxes*, *Industrial Complex*, *Quantum Core Zone*, and *Transport Monorail Hub*.
* **5 Modular Architectural Features**:
  - Single-level Cyberpunk buildings, two-level buildings with internal 45° staircases, moving platform elevators, full player-height cover walls (`2.2m`), and fortified pillboxes with `0.3m` firing slits.
* **Crosshair-Based Raycast Interaction System**:
  - Replaced radial proximity with camera-center crosshair raycasting (up to 3.5m) against loot, chests, ziplines, and ladders via `getRaycastTarget(raycaster)`.
  - Updated interact keybinding to **`KeyE`** (`[E]` interact).
* **Ladder Alignment & Zipline Fixes**:
  - Corrected ladder outward normal calculation (`_tempDir.set(0, 0, 1)`) snapping player `0.65m` directly in front facing climbable side.
  - Raised zipline handles `1.5m` above platform edges with `1.2m` dismount pushes.
* **BR Death Circle Rescaling**:
  - Rescaled initial circle radius from `80m` to `450m` across 5 shrinking stages (`450m` → `280m` → `160m` → `80m` → `25m` → `5m`).

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
