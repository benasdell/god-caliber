# 🛠️ God-Caliber Technical Specification: Hotfix v0.3.11b

**Target Version:** `v0.3.11b-hotfix`  
**Engine Environment:** Three.js / WebGL / TypeScript  
**Status:** Approved for Implementation  
**Primary Subagents:** `high-level-designer`, `system-data-engineer`, `ui-engineer`, `network-engineer`, `security-engineer`, `version-controller`

---

## 📑 Executive Summary & Architectural Overview

Hotfix `v0.3.11b` addresses critical player-flow blockers and loot balance irregularities prior to the major `0.4.0` milestone overhaul. This spec provides the mechanical constraints, state-machine transitions, data schemas, and pipeline assignments necessary to execute the hotfix without introducing regression or technical debt.

---

## 🛠️ Subagent Allocation & Ownership Matrix

| Subagent | Domain / Module | Hotfix Deliverables |
| :--- | :--- | :--- |
| `high-level-designer` | Game Loop & Economy Balance | Establish standard drop-weight distribution formulas for monster Crafting Dust; validate singleplayer death state loop. |
| `system-data-engineer` | Data Schemas & Registries | Define dynamic rarity roll schemas and tiered visual metadata for Crafting Dust loot tables. |
| `network-engineer` | World Spawns & Session Topology | Refactor spawn generation algorithms to exclude building bounding volumes; decouple session host lifecycle from spectator conversion. |
| `ui-engineer` | HUD & Viewport Layering | Implement spectator HUD masking to isolate scoreboard visibility; disable interaction overlays. |
| `security-engineer` | Input Gating & Verification | Ensure server-side and client-side suppression of primary/secondary fire, raycasting, and container interaction for spectators. |
| `version-controller` | Tagging & QA Validation | Execute regression test suites and apply SemVer `v0.3.11b-hotfix` release tags. |

---

## 📐 System Specifications

### 1. Spatial Clearance & Spawn Generation Refactor
* **Problem:** Player entities spawn inside enclosed geometry or inaccessible building bounds due to unrestricted uniform coordinate sampling.
* **Functional Requirements:**
  * Define explicit 2D/3D Oriented Bounding Boxes (OBB) or axis-aligned exclusion zones around all structural colliders and building assets.
  * Implement an iterative rejection sampling algorithm with a minimum safety buffer distance (15 meters) from structural perimeters and terrain mesh bounds.
  * In the event of sampling collisions or timeout thresholds, fallback to pre-baked, validated perimeter waypoint coordinates.
  * Ensure ground-height clamping via raycasting downward to find valid floor surfaces with normal vectors within acceptable walkable slopes ($\le 30^\circ$).

### 2. Crafting Dust Rarity Pool Distribution
* **Problem:** Monster death events exclusively award Epic-tier crafting dust, breaking core progression pacing and devaluing higher tiers.
* **Functional Requirements:**
  * Implement a tiered Cumulative Distribution Function (CDF) for monster dust drop generation.
  * Rarity breakdown and drop weighting:
    * **Common (Tier 1):** 50.0% weight
    * **Magic (Tier 2):** 28.0% weight
    * **Rare (Tier 3):** 15.0% weight
    * **Epic (Tier 4):** 5.5% weight
    * **Legendary (Tier 5):** 1.5% weight
  * Dust stack quantity must scale dynamically based on monster difficulty tier (Minion, Elite, Pinnacle).
  * Mesh shader visual instances must dynamically reflect rarity glow channels (Color tint, emissive intensity, beam height).

### 3. Session Topology & Singleplayer Respawn Loop
* **Problem:** In singleplayer mode, confirming the defeat screen converts the player into a Spectator entity rather than reinitializing an active player session.
* **Functional Requirements:**
  * Separate singleplayer execution flows from multiplayer session topologies.
  * In singleplayer sessions, defeat confirmation must trigger a direct scene reinitialization or active player respawn cycle at a cleared spawn waypoint, resetting player health, base stats, and camera control back to First-Person Mode.
  * In multiplayer peer/host sessions, dead players retain the choice to spectate remaining squad members until wipe conditions trigger match resolution.

### 4. Spectator HUD Masking & Interaction Suppression
* **Problem:** Spectators retain combat HUD elements (reticles, ammo, health, ability meters) and can trigger weapons or pick up world loot.
* **Functional Requirements:**
  * **UI / HUD Layering:**
    * When switching to spectator state, all combat HUD layers (health, shield, stamina, reticle, weapon stats, equipment slots, interact prompts) are hidden.
    * The match Scoreboard (hold `Tab`) and Spectator Mode indicator banner remain the only functional overlay components.
  * **Input & Interaction Gating:**
    * Unbind or hard-suppress primary fire, secondary fire, ADS, weapon swapping, ability activation, and consumable usage.
    * Disable world interaction raycasting to prevent chest openings, item pickup triggers, or doorway manipulation.
    * Restrict camera controller strictly to 3D Fly-Cam (noclip orbit/freecam) with collision disabled against world objects.

---

## 🧪 QA Acceptance & Verification Protocol

1. **TC-SPAWN-01 (Spawn Clearance):**
   * Generate 200 consecutive player spawns across all map configurations.
   * *Pass Criteria:* Zero instances of player capsule intersections with building interiors, walls, or closed geometry.
2. **TC-LOOT-01 (Dust Rarity Spread):**
   * Defeat 500 test monsters across Minion and Elite tiers.
   * *Pass Criteria:* Drop distribution matches target weights within a $\pm 3\%$ margin of error across Common, Magic, Rare, Epic, and Legendary dusts.
3. **TC-RESPAWN-01 (Singleplayer Defeat Flow):**
   * Trigger player death in Singleplayer mode and click through the defeat modal.
   * *Pass Criteria:* Player immediately respawns in active first-person combat state with full player HUD and controls. Zero transitions into Spectator mode.
4. **TC-SPEC-01 (Spectator HUD & Input Isolation):**
   * Enter Spectator mode in a multiplayer lobby.
   * *Pass Criteria:* Reticle, health, and ammo indicators are hidden; primary/secondary mouse clicks produce zero gunfire, raycasts, or world loot consumption; holding `Tab` displays the scoreboard correctly.