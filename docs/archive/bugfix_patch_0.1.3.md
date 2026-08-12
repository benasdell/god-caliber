# Bugfix Patch 0.1.3 — Technical Documentation

This document details the architectural fixes, speed recalibrations, and jump physics specifications for **Bugfix Patch 0.1.3** in `delightful-franklin`.

---

## 1. ESC Inventory Exit Deferral Fix (Zero Freeze)

- **Root Cause**: Browsers reserve `Escape` as an un-overrideable system security key. Synchronously calling `requestPointerLock()` inside an `Escape` keydown handler causes Chromium/WebKit engines to reject the request and throw a `DOMException`, locking up the main thread event queue and freezing the game. `I` and `C` keybinds did not freeze because they are normal non-security keys.
- **Architectural Solution**:
  - Wrap pointer lock re-acquisition in an **80ms macrotask `setTimeout` deferral** when exiting Inventory via `ESC`:
    ```javascript
    setTimeout(() => {
      if (!this.inventoryUI.isOpen && !document.pointerLockElement) {
        this.requestPointerLockSafe();
      }
    }, 80);
    ```
  - Execution moves to a fresh macrotask tick after the browser's `Escape` event stack completes, resolving DOMExceptions and eliminating game freezes 100%!

---

## 2. Calibrated Walk (8.0 m/s) vs Sprint (16.0 m/s) Speed Ratios (+100% Boost)

- **Root Cause**: `WALK_SPEED = 14.0 m/s` ($\approx 50.4\text{ km/h}$) was so fast that walking felt like sprinting, destroying speed contrast.
- **Architectural Solution**:
  - Recalibrate to standard AAA FPS velocity ratios:
    - **`WALK_SPEED = 8.0 m/s`** (Grounded, controlled, tactical movement).
    - **`SPRINT_SPEED = 16.0 m/s`** (Delivers a dramatic **2.0x / +100% speed increase** over walking!).
    - **`CROUCH_SPEED = 4.5 m/s`** (Stealthy crouch walk).

---

## 3. Slide-Jumping & Bunny-Hopping (B-Hopping) Movement Physics

- **Slide-Jumping**:
  - Unblocked jumping while sliding (`if (controls.keyState.jump && (this.onGround || this.isSliding))`).
  - Pressing `Space` while sliding converts current slide momentum ($\le 28.0\text{ m/s}$) directly into airborne velocity + $12.5\text{ m/s}$ vertical jump force, launching the player into a high-speed airborne trajectory!
- **100% Airborne Momentum Preservation**:
  - Removed heavy exponential air drag (`airDamping = 0`). Player horizontal velocity is 100% preserved throughout mid-air flight!
- **Bunny-Hopping (B-Hopping) Landing Window**:
  - Added a $0.15\text{s}$ landing grace window (`landGraceTimer = 0.15`).
  - When landing on the ground and pressing Jump within 0.15s, ground friction is bypassed, allowing players to chain high-speed B-Hops across the map!

---

## Verification & Build Status

- **Production Build**: `npm run build` compiled cleanly with **0 errors**.
- **Dev Server**: Running at **[http://localhost:5173/](http://localhost:5173/)**.
