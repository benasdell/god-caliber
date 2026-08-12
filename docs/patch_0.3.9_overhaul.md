# Sub-Patch 0.3.9 — "Inventory & Terrain Overhaul" Technical Specification

> **Patch Name**: Sub-Patch 0.3.9 (Inventory, Crafting, Terrain & HUD Overhaul)  
> **Target Release**: Patch 0.3.9  
> **Focus**: Merged Full-Screen UI, Keybind Simplification, Auto-Equip Loot, Right-Click Recipe Learning, Centered Minimap Chevron, & 1000m BR Circle  
> **Date**: August 2026

---

## 1. Executive Summary

Sub-Patch 0.3.9 provides a comprehensive overhaul of God-Caliber's inventory navigation, crafting interaction, minimap tracking, and surface loot spawning mechanics. It merges separate storage and crafting tabs into a unified, full-window overlay (`94vw` x `92vh`), standardizes inventory opening and closing to `KeyE` / `Escape`, adds auto-equipping of unequipped gear slots on item pickup, introduces right-click recipe learning, anchors local player chevrons dynamically at the exact center `(90, 90)` of the HUD minimap canvas, and rescales the initial Battle Royale circle diameter to **1000m** (`500m` radius).

---

## 2. Feature & Architecture Deliverables

### 2.1 Keybind Simplification & Inventory Toggle ([`src/controls.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/controls.js), [`src/main.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/main.js))
* Standardized `inventory` and `interact` keybindings to **`KeyE`**.
* Pressing `KeyE` when no active interaction target (chest/loot/zipline/ladder) is under crosshair reticle dot toggles the Inventory UI open/closed.
* Pressing `Escape` or `KeyE` while inventory is open closes the UI cleanly, clears key state latches, and safely re-engages pointer lock via `requestPointerLockSafe()`.

### 2.2 Merged Full-Screen Inventory & Crafting Overlay ([`index.html`](file:///c:/Users/benas/Documents/antigravity/god-caliber/index.html), [`src/style.css`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/style.css), [`src/inventory-ui.js`](file:///c:/Users/benas/Documents/antigravity/god-caliber/src/inventory-ui.js))
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
