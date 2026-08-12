# Sub-Patch 0.3.8 — "Thunderbird" Technical Specification

> **Patch Name**: Sub-Patch 0.3.8 (Thunderbird — Modeling, Procedural Terrain & Interaction Overhaul)  
> **Target Release**: Patch 0.3.8  
> **Focus**: 1000x1000m Map Expansion, 5 POIs, 5 Modular Architecture Generators, Crosshair Raycast Interaction System, & Zipline/Ladder Fixing  
> **Date**: August 2026

---

## 1. Executive Summary

Sub-Patch 0.3.8 ("Thunderbird") transforms God-Caliber's 3D world into a **1000x1000m** procedural Cyberpunk Battle Royale sector. It introduces 5 distinct Points of Interest (POIs), 5 modular architectural building features, rescales Battle Royale shrinking death ring stages (`450m` to `5m`), replaces radial proximity selection with a **Crosshair-Based Raycast Interaction System**, and eliminates zipline terrain clipping & ladder orientation snapping bugs.

---

## 2. Feature & Architecture Deliverables

### 2.1 1000x1000m Map Expansion & 5 POIs ([`src/terrain.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/terrain.js))
* Expanded `TESTING_ARENA_CONFIG` ground bounds from `240x240m` to **`1000x1000m`** with `18m` perimeter walls.
* Constructed 5 major Points of Interest (POIs):
  1. **Sector Zero Citadel** (Center: `x: 0, z: 0`) — Multi-tier neon platform hub (`48x48m`, upper deck `y: 9m`).
  2. **Outpost Omega Pillboxes** (North-East: `x: 300, z: -300`) — Fortified bunkers with `0.3m` horizontal firing slits.
  3. **Industrial Complex** (North-West: `x: -300, z: -300`) — Two-story manufacturing plants with internal staircases.
  4. **Quantum Core Anomalous Zone** (South-West: `x: -300, z: 300`) — Floating neon monoliths & low-visibility atmospheric fog.
  5. **Transport Monorail Hub** (South-East: `x: 300, z: 300`) — Moving platform elevators & high-altitude catwalk bridges.

### 2.2 Five Modular Architectural Features ([`src/terrain.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/terrain.js))
1. **Single-Level Cyberpunk Buildings**: Modular rectangular buildings with neon doorway frames and roof slabs.
2. **Two-Level Buildings with Internal 45° Staircases**: Two-story structures with mid-floor cutouts, internal 45-degree ramp staircases (`createTriangularRampGeometry`), and roof decks.
3. **Moving Platform Elevators**: Dynamically oscillating vertical platform car meshes (`movingPlatforms`) running in update loop.
4. **Full Player-Height Cover Walls**: High-durability full-cover wall segments (`2.2m` height) with neon top border trims.
5. **Fortified Pillboxes & Bunkers**: Low-profile sloped walls (`2.2m` clearance), `0.3m` horizontal view/firing slits, and heavy reinforced roof slabs.

### 2.3 Crosshair-Based Raycast Interaction System ([`src/main.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/main.js), [`src/world-items.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/world-items.js), [`src/controls.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/controls.js))
* Replaced radial proximity selection with camera-center crosshair raycasting:
  - Casts `raycaster.setFromCamera(Vector2(0,0), camera)` up to `3.5m`.
  - Raycasts against ground loot, chests, zipline handles, and ladder faces via `getRaycastTarget(raycaster)`.
  - Targets exact focused object directly under crosshair reticle dot, resolving overlapping selection bugs completely.
* Updated default keybinding to **`KeyE`** (`[E]` interact).

### 2.4 Ladder & Zipline Interaction Fixes ([`src/player.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/player.js))
* **Ladder Attachment**: Corrected outward normal vector calculation (`_tempDir.set(0, 0, 1).applyAxisAngle(_axisY, lad.rotationY)`) and snapped player capsule `0.65m` directly in front facing the climbable side.
* **Zipline Clearance & Dismount**: Elevated zipline handles `1.5m` above platform edges and applied `1.2m` dismount push to prevent clipping into terrain geometry.

### 2.5 BR Death Circle Rescaling ([`src/circle.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/circle.js))
* Rescaled initial visual radius from `80m` to **`450m`**.
* Redefined 5 shrinking stages (`450m` → `280m` → `160m` → `80m` → `25m` → `5m`).

---

## 3. Verification & Build Matrix

| Verification Step | Result | Notes |
| :--- | :---: | :--- |
| **Vite Production Build** | ✅ PASS | `✓ built in 1.67s` with zero errors. |
| **Subagent Definition** | ✅ PASS | Created `.agents/agents/artist-vfx-designer.md`. |
| **1000x1000m Scale Octree Physics** | ✅ PASS | Graph node updated cleanly in `worldOctree`. |

---
*End of Technical Specification.*
