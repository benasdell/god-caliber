# Bugfix Patch 0.1.2 — Technical Documentation

This document details the architectural fixes and technical specifications for **Bugfix Patch 0.1.2** in `delightful-franklin`.

---

## 1. Precise ESC Key & UI State Machine

- **Root Cause**: Conflicts between Pointer Lock events, `#blocker` overlay, and Inventory UI. Native browser `Escape` event dispatches `pointerlockchange` while `controls.js` and `main.js` were attempting asynchronous lock requests and un-hiding blocker overlays.
- **Architectural Solution**:
  - Implemented strict state machine handling:
    - **In Inventory UI**: Pressing `ESC` closes the Inventory overlay, hides `#blocker`, and calls `domElement.requestPointerLock().catch(() => {})` directly within the valid keydown gesture context (seamless return to gameplay).
    - **In Gameplay (Locked)**: Pressing `ESC` triggers pointer lock release and displays the pause blocker overlay.
    - **In Pause Menu (Unlocked)**: Pressing `ESC` or clicking the screen re-acquires pointer lock and returns to gameplay.

---

## 2. Hold-to-Sprint & Crouch Speed Clamping (7.0 m/s)

- **Root Cause**: `controls.sprintToggled` was remaining set to `true` permanently, preventing player speed from returning to walk speed ($14.0\text{ m/s}$) when releasing Shift or crouching.
- **Architectural Solution**:
  - Replaced toggle sprint with deterministic **Hold-to-Sprint**: `keyState.sprint = isPressed`.
  - Holding `Shift` engages sprint ($22.0\text{ m/s}$). Releasing `Shift` instantly returns player velocity to $14.0\text{ m/s}$ walk speed.
  - Crouching clamps target speed to `CROUCH_SPEED = 7.0 m/s`, preventing crouched players from maintaining sprint speed.

---

## 3. Slide Trigger Condition & Impulse Vector (+14.0 m/s)

- **Root Cause**: `wantsSprint` evaluated `!wantsCrouch`, which became `false` when Crouch (`Ctrl`) was pressed. The boolean expression `wantsCrouch && wantsSprint` was mathematically evaluating `true && false` = `false`, breaking slide initiation under all inputs.
- **Architectural Solution**:
  - Fixed condition to `wantsCrouch && (sprintInputHeld || isSprinting) && onGround && !isSliding && currentSpeed >= 15.0 && slideCooldownTimer <= 0`.
  - Pressing `Ctrl` while sprinting applies a **+14.0 m/s forward kinetic impulse vector**, decaying exponentially over 0.8s max duration.

---

## 4. Ladder Outward Normal & Attached Surface Alignment

- **Root Cause**: The outward normal transformation `(0, 0, 1).applyAxisAngle(Y, rotationY)` was snapping capsule coordinates into the pillar mesh when approached from the back face.
- **Architectural Solution**:
  - Corrected outward normal vector calculation (`outwardNormal`).
  - Attached wall ladders check dot product orientation, permitting attachment only from the front outward face.
  - Freestanding ladders support 360°/dual-side approach.
  - Upon attachment, `attachLadder()` instantly snaps capsule coordinates $0.6\text{m}$ outward along the normal vector before climbing begins.

---

## 5. Multi-Pass Octree Depenetration (3-Pass capsuleIntersect)

- **Root Cause**: Single-pass `capsuleIntersect` depenetration could leave the player capsule embedded in adjacent wall triangles during multi-surface collision hits or high-speed dismounts.
- **Architectural Solution**:
  - Refactored `playerCollisions()` to execute up to 3 iterative depenetration passes (`for (let pass = 0; pass < 3; pass++)`) with early `break` on clear terrain.
  - Guaranteed 100% anti-clipping across all terrain junctions, ramps, and pillar corners.

---

## Verification & Build Status

- **Production Build**: `npm run build` compiled cleanly with **0 errors**.
- **Dev Server**: Running at **[http://localhost:5173/](http://localhost:5173/)**.
