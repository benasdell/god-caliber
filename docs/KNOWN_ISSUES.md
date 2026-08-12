# God-Caliber — Known Issues, Vulnerabilities & Future Agent Warnings

> **Project Codename**: `delightful-franklin`  
> **Purpose**: Warn future agents and developers about known technical risks, architectural weak points, and potential bugs  
> **Current Version**: Sub-Patch 0.3.6  
> **Last Updated**: August 2026

---

## How to Use This Document

> [!IMPORTANT]
> **Future agents**: Read this document BEFORE making changes. Many issues listed here are interconnected — fixing one without understanding the others can introduce regressions.

---

## Table of Contents

1. [Critical: Multiplayer is Scaffolded Only](#1-critical-multiplayer-is-scaffolded-only)
2. [Critical: No Server Authority Model](#2-critical-no-server-authority-model)
3. [High: Memory Leaks in Three.js Resources](#3-high-memory-leaks-in-threejs-resources)
4. [High: Global Singleton Anti-Pattern](#4-high-global-singleton-anti-pattern)
5. [High: Duplicate Hit Detection Code](#5-high-duplicate-hit-detection-code)
6. [High: Enemy Projectile Origin Stale Reference](#6-high-enemy-projectile-origin-stale-reference)
7. [Medium: Race Conditions in setTimeout Combat](#7-medium-race-conditions-in-settimeout-combat)
8. [Medium: Unbounded Array Growth](#8-medium-unbounded-array-growth)
9. [Medium: Performance Bottlenecks](#9-medium-performance-bottlenecks)
10. [Medium: Audio Context Accumulation](#10-medium-audio-context-accumulation)
11. [Medium: Pointer Lock Edge Cases](#11-medium-pointer-lock-edge-cases)
12. [Low: Missing Input Sanitization](#12-low-missing-input-sanitization)
13. [Low: Hardcoded Magic Numbers](#13-low-hardcoded-magic-numbers)
14. [Low: Browser Compatibility Risks](#14-low-browser-compatibility-risks)
15. [Architectural Debt & Design Concerns](#15-architectural-debt--design-concerns)
16. [Gameplay Exploit Vectors](#16-gameplay-exploit-vectors)

---

## 1. Medium: Multiplayer Connection Reliability & Cloudflare Tunnel WAN Traversal

**Severity**: 🟡 MEDIUM (was 🔴 CRITICAL — transport scaffolding resolved in 0.3.1, retry logic added in 0.3.4, 0.3.5 fix planned for DataChannel & TURN relay)  
**Files**: [`NetworkManager.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/multiplayer/NetworkManager.js), [`ui.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/ui.js)

> [!NOTE]
> Sub-Patch 0.3.5 addresses identified WebRTC RTCDataChannel setup failures (`reliable: false` parameter mismatch), PeerJS signaling config standardization, mDNS local ICE candidate resolution, and TURN relay (Metered.ca) integration for WAN / Cloudflare Tunnel hosting.

**Remaining concerns & 0.3.5 Plan**:
- Removing legacy `{ reliable: false }` parameter from `peer.connect()` calls to restore WebRTC data channel negotiation
- Standardizing `getPeerConfig()` signaling configuration across host and client
- Integrating Metered.ca TURN relay configuration for WAN / Symmetric NAT traversal
- Exposing granular `RTCPeerConnection` ICE connection state diagnostics in `NetworkManager` and UI debug modal

**Future agent guidance**: Follow Sub-Patch 0.3.5 Implementation Plan in `docs/patch_0.3_implementation_plan.md`.

---

## 2. Critical: No Server Authority Model

**Severity**: 🔴 CRITICAL  
**Files**: All multiplayer files

> [!CAUTION]
> The current architecture is fully client-authoritative. Every client computes their own position, health, damage, and kill counts locally. There is no validation.

**Exploit implications when real networking is added**:
- Players can teleport by sending fake position packets
- Players can set their HP to infinity
- Players can report fake kill counts and points
- Players can fire faster than weapon fire rate limits
- Players can send damage to other players without actually shooting

**Recommended approach**: Host-authoritative model where the host validates all position updates, damage events, and kill claims. Or implement sanity checks on incoming peer data.

---

## 3. High: Memory Leaks in Three.js Resources

**Severity**: 🟠 HIGH  
**Files**: [`weapon.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/weapon.js) L152-165, [`EnemyFactory.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/enemies/EnemyFactory.js), [`PeerPlayer.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/multiplayer/PeerPlayer.js)

### Issue A: Weapon Model Rebuild Leaks

```javascript
// weapon.js line 154 - removes children but NEVER disposes geometry/material
while (this.weaponGroup.children.length > 0) {
  this.weaponGroup.remove(this.weaponGroup.children[0]);
}
```

Every call to `rebuildWeaponModel()` (triggered on weapon switch) orphans the old geometries and materials in GPU memory. Over many weapon switches, this accumulates leaked GPU resources.

**Fix**: Call `.geometry.dispose()` and `.material.dispose()` on each child before removing.

### Issue B: Enemy Mesh Cleanup

In [`targets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/targets.js) line 165, dead enemies are removed with `scene.remove(b.group)` but the geometries and materials inside the group are never disposed.

### Issue C: PeerPlayer Nameplate Texture — ✅ FIXED (0.3.4)

[`PeerPlayer.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/multiplayer/PeerPlayer.js) — `destroy()` now disposes both `texture` and `nameplate.material`.

### Issue D: Weapon Materials Recreated Per Build

`buildProceduralModel()` in [`weapon.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/weapon.js) L167-370 creates **new** `MeshStandardMaterial` instances every call. These should be cached and reused.

---

## 4. High: Global Singleton Anti-Pattern

**Severity**: 🟠 HIGH  
**Files**: [`main.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/main.js) L81

```javascript
window.gameInstance = this;
```

> [!WARNING]
> The entire codebase relies on `window.gameInstance` for cross-module communication. This creates tight implicit coupling between all systems. At least 15 references to `window.gameInstance` exist across bullets.js, targets.js, player.js, inventory-ui.js, and ui.js.

**Risks**:
- Impossible to run multiple game instances (e.g., for testing)
- Any module can mutate any other module's state at any time
- No dependency injection or inversion of control
- Harder to unit test individual systems

**Future agent warning**: When refactoring, consider passing explicit references through constructors rather than accessing globals. This is technical debt, not an urgent bug, but it makes every other fix harder.

---

## 5. High: Duplicate Hit Detection Code

**Severity**: 🟠 HIGH  
**Files**: [`bullets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/bullets.js) L145-233, [`targets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/targets.js) L101-144

The hitscan hit detection logic in `BulletManager.spawnBullet()` (lines 145-233) duplicates nearly identical damage calculation, headshot detection, kill feed reporting, loot rolling, and point awarding code that also exists in `TargetManager.checkBulletHit()` (lines 101-144).

**Risks**:
- Fixing a bug in one path but not the other
- Inconsistent damage calculations
- Double kill feed entries if both paths trigger

**Note**: The `checkBulletHit()` path appears to be legacy code from pre-hitscan era and may not be actively triggered anymore since `spawnBullet()` now handles everything. Verify before removing.

---

## 6. High: Enemy Projectile Origin Stale Reference

**Severity**: 🟠 HIGH  
**Files**: [`targets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/targets.js) L289-311

```javascript
// Line 293: origin is cloned ONCE...
const origin = b.position.clone().add(new THREE.Vector3(0, 1.2, 0));
// Line 301-305: ...but burst shots at 100ms/200ms setTimeout use the SAME stale origin
setTimeout(() => {
  if (!b.isDestroyed) bulletMgr.spawnEnemyProjectile(origin, playerPosition, 10, 60);
}, 100);
```

The 3-round burst fires all 3 shots from the same origin position and toward the same `playerPosition` snapshot. The bot may have moved and the player may have moved by the time the delayed shots fire.

**Fix**: Recalculate `origin` from `b.position` and `playerPosition` from live player position inside each `setTimeout` callback.

---

## 7. Medium: Race Conditions in setTimeout Combat

**Severity**: 🟡 MEDIUM  
**Files**: [`targets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/targets.js) L301-306, [`bullets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/bullets.js) L191-193

Multiple places use `setTimeout` for delayed game logic:
- Humanoid rifle burst (100ms, 200ms delays)
- Enemy flinch recovery (60ms delay)

**Risks**:
- If the game tab is backgrounded, `setTimeout` may fire at unexpected times
- If the enemy is destroyed between scheduling and execution, the `b.isDestroyed` check mitigates this but the `bulletMgr` reference could be stale
- These don't respect the game's delta time system — they're wall-clock timed

**Recommendation**: Use the delta-time game loop with timers instead of `setTimeout`.

---

## 8. Medium: Unbounded Array Growth

**Severity**: 🟡 MEDIUM  
**Files**: [`targets.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/targets.js), [`world-items.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/world-items.js)

### Targets Array

The `targets` array grows without bound. Dead enemies are filtered out after respawn timer expires, but the filter creates a new array each frame:

```javascript
this.targets = this.targets.filter(t => t !== b);  // Line 166 — allocates new array
```

### World Items

Ground items accumulate from loot drops, chest explosions, and respawning crates. There's no cap on total ground items. On long play sessions, this could grow to hundreds of floating sprites with per-frame physics updates.

**Recommendation**: Add a maximum pool size for ground items (e.g., 100). When exceeded, remove the oldest items.

---

## 9. Medium: Performance Bottlenecks

**Severity**: 🟡 MEDIUM

### Per-Frame Allocations

| Location | Issue |
|----------|-------|
| `main.js` L203-204 | `new THREE.Vector3()` and `new THREE.Ray()` every shot |
| `main.js` L350-351 | `new THREE.Vector3()` for camera direction every frame |
| `targets.js` L370` | `new THREE.Vector3()` for aim target in enemy firing |
| `bullets.js` L155, L165 | `new THREE.Vector3()` per hitscan call |
| `terrain.js` L374, L378-380 | `new THREE.Vector3()` in zipline proximity check every frame |

These allocations trigger garbage collection spikes. Use preallocated scratch vectors (pattern already exists in some files — extend to all).

### Shadow Map Overhead

The directional light shadow camera covers a 100×100m area with 2048×2048 resolution. This is the single largest GPU cost. Consider cascaded shadow maps or reducing shadow distance for low-end devices.

### Draw Calls

Each enemy is a `THREE.Group` with 6-10 child meshes, each with its own material. 12 active enemies = 72-120 draw calls just for enemies. Consider `InstancedMesh` for identical enemy parts.

---

## 10. Medium: Audio Context Accumulation

**Severity**: 🟡 MEDIUM  
**Files**: [`audio.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/audio.js)

### Oscillator/Buffer Accumulation

Every sound effect creates new `OscillatorNode`, `GainNode`, `BiquadFilterNode`, and `BufferSource` objects. While Web Audio API nodes are garbage collected after `stop()`, rapid fire (450 RPM on the AR-15 = 7.5 shots/sec) creates ~30 audio nodes per second across 4 layers.

### BGM Oscillator Never Stops

`startAmbientBGM()` creates oscillators that run indefinitely. There's no `stopAmbientBGM()` method. If `init()` is called multiple times, the `isBGMPlaying` flag prevents duplicates, but the LFO oscillator is never stored for later cleanup.

---

## 11. Medium: Pointer Lock Edge Cases

**Severity**: 🟡 MEDIUM  
**Files**: [`controls.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/controls.js) L115-170

### ESC Key Race Condition

Pressing ESC rapidly can cause a race between:
1. Browser releasing pointer lock (async)
2. `pointerlockchange` event firing (async)
3. `keydown` handler processing ESC (sync)
4. Blocker visibility toggle (sync)

The 400ms `timeSinceInvClose` guard helps, but there are still edge cases where the blocker appears briefly and disappears, or where ESC toggles the menu twice.

### Inventory Close → Pointer Lock Re-Acquisition

The 80ms `setTimeout` in inventory close (L268-272) to re-acquire pointer lock can fail if the browser hasn't fully processed the previous lock release. The `requestPointerLockSafe()` catch handler suppresses the error, but the player is left in an unlocked state until they click again.

---

## 12. Low: Missing Input Sanitization

**Severity**: 🟢 LOW  
**Files**: Various

### localStorage Parsing

[`controls.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/controls.js) L77-91: `JSON.parse()` on localStorage data is wrapped in try/catch, which is good. But the parsed keybindings are spread directly into `this.bindings` without validating that the keys are valid `event.code` strings.

### URL Parameter

[`main.js`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/main.js) L52-57: The `?lobby=` URL parameter is `.trim().toUpperCase()` cleaned but not validated against expected format (e.g., `GC-XXXX`). Arbitrary strings would pass through.

### Player Name in Multiplayer

`sanitizeName()` strips HTML and control chars, which is good. But the 16-char limit doesn't prevent Unicode abuse (e.g., zalgo text, RTL override characters, emoji sequences that render as very wide).

---

## 13. Low: Hardcoded Magic Numbers

**Severity**: 🟢 LOW

The codebase has numerous magic numbers that should be extracted to named constants:

| Value | Location | Meaning |
|-------|----------|---------|
| `0.85` | bullets.js L299 | Player hit detection radius for enemy projectiles |
| `12.0` | player.js L241 | Minimum speed for slide initiation |
| `25.0` | player.js L367 | Void fall death plane Y coordinate |
| `2.5` | melee.js L145 | Melee hit detection range |
| `45.0` | player.js L330 | Air strafe acceleration limit |
| `0.012` | scene.js L12 | Fog density |
| `140` | scene.js L19 | Far clip plane distance |
| `0.35` | player.js L497 | Zipline attach grace timer |
| `12` | targets.js L148 | Target zone population cap |
| `5.0` | targets.js L118/L205 | Enemy respawn timer |

---

## 14. Low: Browser Compatibility Risks

**Severity**: 🟢 LOW

| API | Risk | Affected Browsers |
|-----|------|-------------------|
| `crypto.getRandomValues()` | Requires secure context (HTTPS) | HTTP deployments |
| `navigator.clipboard.writeText()` | Requires secure context + focus | HTTP, unfocused tabs |
| `CanvasRenderingContext2D.roundRect()` | Not available in older browsers | Safari < 16, Chrome < 99 |
| `PointerLock API` | May behave differently in Firefox | Firefox |
| `WebGL 2.0` | Required by Three.js r170 | Very old devices |
| `Web Audio API` | `AudioContext` may be `webkitAudioContext` | Older Safari |

---

## 15. Architectural Debt & Design Concerns

### Tight Coupling Between Game Systems

The `Game` class in `main.js` directly wires all managers together. There's no event bus, no message passing, and no dependency injection. Adding a new system requires modifying `main.js` constructor, `animate()` loop, and `handleInputs()`.

### No Game State Machine

There's no formal state machine for game states (MENU → PLAYING → PAUSED → DEAD → SPECTATING). The `controls.isLocked` boolean effectively serves as the "playing vs paused" switch, but this doesn't support future states like spectating, loading screens, or end-of-match summaries.

### No Delta-Time Independent Physics

While the frame delta is clamped to 50ms max, the physics integrator is a simple Euler step. At very low frame rates (< 20 FPS), physics become noticeably less accurate. This is acceptable for a browser game but worth noting.

### No Asset Loading Pipeline

All 3D models are procedurally generated from primitives. While this eliminates asset loading, it means:
- No GLTF/FBX model support
- No skeletal animation
- No texture maps on weapons or characters
- Adding detailed models later requires building a full asset pipeline

### CSS Size

The [`style.css`](file:///c:/Users/benas/Documents/antigravity/delightful-franklin/src/style.css) file is ~33KB, which is large for a single CSS file. It contains all game UI styles monolithically. Consider splitting into component-level stylesheets if the UI grows further.

---

## 16. Gameplay Exploit Vectors

> [!WARNING]
> These are potential exploits that a malicious player could use. They don't affect single-player gameplay but become critical when real multiplayer is implemented.

| Exploit | How | Severity |
|---------|-----|----------|
| **Speed Hack** | Modify `SPRINT_SPEED` or `speedMultiplier` via browser console | Critical (MP) |
| **God Mode** | Set `player.hp = Infinity` or `player.damageReduction = 1.0` | Critical (MP) |
| **Infinite Ammo** | Set `weapon.currentAmmo = 999` each frame | High (MP) |
| **Auto-Fire** | Set `controls.mouseDown = true` and `controls.shootRequested = true` in a loop | Medium (MP) |
| **No Recoil** | Zero out `targetRecoilOffset` and `targetRecoilRotation` each frame | Medium (MP) |
| **Wallhack** | Remove fog, increase far clip, or disable environment meshes | Medium (MP) |
| **Inventory Dupe** | Manually call `inventory.addItem()` with crafted item objects | Low (SP only) |
| **Point Farming** | Directly increment `window.gameInstance.playerPoints` | Low (SP only) |

### Mitigation Strategy for Multiplayer

1. **Server/Host Authority**: Critical game state (HP, position, kills) must be validated by the host
2. **Rate Limiting**: Enforce maximum fire rate, movement speed, and action frequency on incoming packets
3. **Position Validation**: Reject teleportation (>max speed × delta time) from peers
4. **Damage Verification**: Host should verify line-of-sight and distance before applying damage

---

## Quick Reference: File Risk Map

| File | Risk Level | Primary Concerns |
|------|------------|------------------|
| `NetworkManager.js` | 🟡 Medium | PeerJS Cloud reliability, no host authority model |
| `PeerPlayer.js` | 🟢 Low | Texture leak fixed (0.3.4), no input validation |
| `weapon.js` | 🟠 High | GPU memory leak on weapon switch |
| `targets.js` | 🟠 High | Duplicate code, setTimeout race, stale references |
| `bullets.js` | 🟡 Medium | Per-frame allocations, duplicate hit code |
| `main.js` | 🟡 Medium | Global singleton, tight coupling |
| `player.js` | 🟡 Medium | No state machine, exploit-friendly constants |
| `inventory-ui.js` | 🟢 Low | Large file (36KB), complex DOM manipulation |
| `audio.js` | 🟢 Low | Node accumulation, no BGM stop |
| `controls.js` | 🟢 Low | Pointer lock edge cases |
| `scene.js` | 🟢 Low | Shadow map cost |
| `terrain.js` | 🟢 Low | Per-frame allocation in proximity check |
| `inventory.js` | 🟢 Low | Clean code, low risk |
| `world-items.js` | 🟢 Low | Unbounded item count |
