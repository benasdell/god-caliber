# Sub-Patch 0.3.7 — "Bastion" Technical Specification

> **Patch Name**: Sub-Patch 0.3.7 (Bastion — Security Hardening & Performance Overhaul)  
> **Target Release**: Patch 0.3.7  
> **Focus**: Host-Authoritative RPC Validation, Input Sanitization, GPU Memory Leak Disposal, and GC Allocation Elimination  
> **Date**: August 2026

---

## 1. Executive Summary

Sub-Patch 0.3.7 ("Bastion") hardens God-Caliber against networking exploits, client-side input corruption, and memory leak degradation identified in `docs/KNOWN_ISSUES.md`. 

Key achievements in this patch:
1. **Security & Input Sanitization**:
   - Host-side RPC validation (caps max damage per hit at `200 HP`, verifies max ray distance `<= 150m`, validates peer IDs).
   - Strict RPC whitelist & per-peer sliding window rate limiting (max 60 packets/sec).
   - Regex sanitization of URL `lobby` query parameters (`/^[A-Z0-9_-]{1,32}$/i`) and `localStorage` keybinding validation against `KeyboardEvent.code` whitelist.
   - Non-negative finite bounds checking on local and peer HP reductions.
2. **GPU Memory Leak Disposal & Material Caching**:
   - Explicit `.geometry.dispose()` and `.material.dispose()` calls during weapon switches (`weapon.js`), dead enemy removals (`targets.js`), and ground loot despawns (`world-items.js`).
   - Static material caching (`WEAPON_MATERIAL_CACHE`) for weapon procedural meshes to prevent WebGL shader re-compilation.
   - Fixed `setTimeout` 3-round burst stale origin & player position bug in bot AI firing loops.
3. **GC Allocation Elimination**:
   - Static preallocated scratch `Vector3` and `Ray` instances across `bullets.js`, `terrain.js`, and `main.js` to eliminate per-shot and per-frame garbage collection pauses.
4. **Audio Engine Optimization**:
   - Implemented `stopAmbientBGM()` with oscillator tracking and pre-generated static noise buffers (`crackBuffer` & `tailBuffer`) for zero-allocation gunshot audio synthesis.

---

## 2. Security Hardening Matrix

| Vulnerability / Exploit Vector | File | Severity | Mitigation Implemented |
| :--- | :--- | :---: | :--- |
| **RPC Packet Flooding / Spam** | `NetworkManager.js` | 🟠 High | Per-peer sliding window rate limiting (max 60 packets / 1000ms window). |
| **Illegal Hit RPC Damage / Distance** | `NetworkManager.js` | 🔴 Critical | Host-side damage cap (`<= 200 HP`) and max ray distance check (`<= 150m`). |
| **Malformed Lobby Code Injection** | `NetworkManager.js` | 🟡 Medium | `sanitizeRoomCode` enforcing `/^[A-Z0-9_-]{1,32}$/` validation. |
| **Corrupted Keybinding Storage Injection** | `controls.js` | 🟡 Medium | Validates `localStorage` keybindings against `KeyboardEvent.code` regex. |
| **Negative/Infinite Damage Injection** | `player.js` | 🟡 Medium | `Math.max(0, Math.min(Number(amount) || 0, 200))` bounds enforcement. |

---

## 3. Performance & Memory Leak Fixes

| Module | Resource / Allocation | Previous Behavior | Bastion Optimization |
| :--- | :--- | :--- | :--- |
| `weapon.js` | Weapon Meshes & Materials | Children removed without disposal | Explicit `traverse` + `geometry.dispose()` & `material.dispose()`. Shared `WEAPON_MATERIAL_CACHE`. |
| `targets.js` | Dead Bot Groups | Removed via `scene.remove()` only | Added `disposeEnemyGroup()` helper to release GPU geometry and materials. |
| `targets.js` | 3-Round Burst AI | Fired from stale `origin` snapshot | Recalculates live origin and live player position dynamically in delayed callbacks. |
| `world-items.js` | Ground Items Pool | Unbounded memory growth on despawn | Capped `MAX_GROUND_ITEMS = 60` with `disposeItemMeshGroup()` disposal. |
| `bullets.js` | Hitscan Ray & Vectors | `new THREE.Ray()`, `Vector3()` per shot | Preallocated static `_scratchRay`, `_scratchHitPoint`, `_scratchCheckPoint`. |
| `terrain.js` | Cable & Ladder Math | `new THREE.Vector3()` per frame | Preallocated static `_scratchV`, `_scratchP`, `_scratchProj`, `_scratchLadPos`, etc. |
| `main.js` | Camera Direction & Firing | `new THREE.Vector3()` per frame | Preallocated static `_scratchCameraDir`. |
| `audio.js` | Gunshot Noise Buffers | Float arrays allocated per shot | Pre-generated static `crackBuffer` and `tailBuffer` in `init()`. Added `stopAmbientBGM()`. |

---

## 4. Architectural Invariants

1. **Host RPC Verification Invariant**: The host process MUST validate all incoming peer hit packets against maximum damage (`200 HP`) and maximum distance (`150m`) before broadcasting state changes to other peers.
2. **WebGL Disposal Invariant**: Any Three.js mesh, group, or object removed from `scene` MUST call `.dispose()` on its geometry and unshared materials to prevent GPU VRAM memory leaks.
3. **Zero Allocation Invariant**: Core per-frame update loops (`animate`, `getClosestInteractable`) and high-frequency actions (`spawnBullet`, `playGunshot`) MUST use preallocated static scratch objects rather than instantiating new objects at runtime.

---
*End of Technical Specification.*
