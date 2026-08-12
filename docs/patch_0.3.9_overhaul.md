# Sub-Patch 0.3.9, 0.3.9b, & 0.3.9c — "Inventory & Terrain Overhaul" Technical Specification

> **Patch Name**: Sub-Patch 0.3.9c Hotfix (KeyF Interaction, KeyE Inventory Toggle, Scrollbar Elimination, & Dynamic 5x12 Grid Scaling)  
> **Target Release**: Patch 0.3.9c  
> **Focus**: Separated KeyF Interaction & KeyE Inventory Toggle, Zero-Scrollbar Modal Scaling, & Responsive 5x12 Storage Grid  
> **Date**: August 2026

---

## 1. Executive Summary

Sub-Patch 0.3.9c delivers a hotfix for God-Caliber. It restores **`KeyF`** as the dedicated world object interact key (for picking up ground items, opening chests, climbing ladders, and attaching to ziplines) while reserving **`KeyE`** exclusively for opening and closing the Inventory UI. It also rescales the Inventory UI modal layout to eliminate all scrollbars, and makes the 5x12 storage grid scale dynamically to fit its sub-window perfectly.

---

## 2. Feature & Architecture Deliverables

### 2.1 KeyE Latch Fix & Crouch Keybinding (`KeyC`) ([`src/controls.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/controls.js), [`src/main.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/main.js))
* Standardized crouch/slide binding to **`KeyC`** (`crouch: 'KeyC'`).
* Fixed key press latches (`interactKeyWasPressed` & `inventoryKeyWasPressed`) with a 300ms debounce buffer to eliminate multi-frame toggle repetition bugs when pressing `KeyE`.

### 2.2 Fresh Procedural Terrain Generation Reset & 10 Structure Types ([`src/terrain.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/terrain.js))
* Culled all legacy platforms, pillars, monorail hubs, and legacy ziplines.
* Retained ground floor (`1000x1000m`) and 4 perimeter walls (`18m` height).
* Constructed 10 modular structure type generators:
  1. `single_house`: Single-story building (`10x8x4m`) with doorway frame & roof deck.
  2. `two_story_house`: Two-story building (`12x10x8m`) with internal 45° ramp staircase.
  3. `sniper_tower`: Elevated 4-post lookout tower (`6x6x12m`) with ladder.
  4. `pillbox_bunker`: Fortified bunker (`10x10x3.2m`) with `0.3m` firing slit.
  5. `cover_wall_straight`: Full player-height cover wall (`8x0.5x2.2m`).
  6. `cover_wall_corner`: L-shaped corner barrier (`6x6x2.2m`).
  7. `cargo_container_cluster`: Stacked industrial shipping crates (`8x3x3m`).
  8. `catwalk_bridge`: Overhead walkway bridge (`16x4x6m`).
  9. `monolithic_pillar`: Structural concrete pillar (`4x4x14m`).
  10. `warehouse_hangar`: Wide open hangar structure (`24x16x7m`).
* Scattered ~50 structure instances naturally across the 1000x1000m map using a spatial grid distribution with a 35m minimum clearance buffer.

### 2.3 Merged Full-Screen Inventory & Crafting Overlay ([`index.html`](file:///c:/Users/benas/Documents/antigravity/god-caliber/index.html), [`src/style.css`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/style.css), [`src/inventory-ui.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/inventory-ui.js))
* Merged separate storage and crafting tabs into a single unified overlay (`.inv-modal`, filling `94vw` x `92vh` with max dimensions `1600x1000px`).
* **Top Row**: Left-side Operator Gear equipment mannequin (Head, Torso, Legs, Gloves, Primary, Secondary, Melee) + Right-side 5x12 Inventory Grid (60 item slots) & Recycled Dust balances.
* **Bottom Row**: Integrated Crafting & Modding Bench (Blueprint Forge Grid, Category Filters, and Tier Upgrade Bench).

### 2.3 Unlocked Item Interaction Fix ([`src/inventory-ui.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/inventory-ui.js))
* Fixed state handling in `toggleItemLock(item)` and `onItemMouseDown()` so that items with `isLocked === false` can be freely moved, swapped, socketed, upgraded, and recycled without state rejection.

### 2.4 Auto-Equip Loot Feature ([`src/main.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/main.js), [`src/inventory-ui.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/inventory-ui.js))
* On item pickup (`getActiveInteraction()`), if the designated equipment slot (`primary`, `secondary`, `head`, `torso`, `gloves`, `legs`) is currently empty (`null`), auto-equips the item directly to that slot, triggers reload audio feedback, updates stats, and notifies `⚡ AUTO-EQUIPPED <Item> [<SLOT>]`.

### 2.5 Right-Click Recipe Learning & Persistence ([`src/inventory-ui.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/inventory-ui.js))
* Right-clicking a Recipe item (`item.type === 'recipe'`) in inventory consumes the recipe, adds `recipeTargetBaseId` to `player.learnedRecipes`, and persists state to `localStorage.setItem('god_caliber_learned_recipes', ...)`.

### 2.6 Centered Minimap Chevron & Dynamic Scrolling ([`src/minimap.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/minimap.js))
* Anchored local player heading chevron arrow at exact canvas center `(cx = 90, cy = 90)`.
* Updated `worldToCanvas(x, z, playerPos)` matrix to render relative coordinates `(x - playerPos.x, z - playerPos.z)`, dynamically scrolling background grid lines, safe zone circles, POI icons, and enemy dots as the player moves across the 1000m map.

### 2.7 First-Principles Surface Loot Spawning ([`src/main.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/main.js))
* Restructured all 16 tactical chest crate coordinates to align cleanly with 5 POI floor slabs: *Sector Zero Citadel*, *Outpost Omega Pillboxes*, *Industrial Complex*, *Quantum Core Zone*, and *Transport Monorail Hub*.

### 2.8 1000m BR Circle Rescaling ([`src/circle.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/circle.js))
* Rescaled initial circle radius to **`500m`** (1000m diameter) across 5 shrinking stages (`500m` → `300m` → `180m` → `90m` → `30m` → `5m`).

---

## 3. Verification Matrix

| Verification Step | Result | Notes |
| :--- | :---: | :--- |
| **Vite Production Build** | ✅ PASS | `✓ built in 1.99s` with zero errors. |
| **Unified UI Scaling** | ✅ PASS | Responsive flex layout up to `1600x1000px`. |
| **Centered Minimap Math** | ✅ PASS | Player chevron anchored at `(90,90)`. |

---
*End of Technical Specification.*
