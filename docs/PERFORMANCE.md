# God-Caliber — Performance Best Practices

> This document is intended for AI agents and human developers working on this codebase.
> Following these rules prevents the frame-rate regressions we've already had to fix.

---

## Rule 1: NEVER allocate in a per-frame loop

The `animate()` → `update()` call chain runs 60 times per second.
**Any `new` keyword inside these methods creates garbage that triggers GC pauses.**

### ❌ Bad — allocates every frame
```javascript
update(deltaTime) {
  for (const bot of this.bots) {
    bot.collider.center.add(new THREE.Vector3(0, 1.0, 0)); // 360 allocs/sec
  }
}
```

### ✅ Good — preallocated at module scope
```javascript
const _yOffset = new THREE.Vector3(0, 1.0, 0);

update(deltaTime) {
  for (const bot of this.bots) {
    bot.collider.center.add(_yOffset); // zero allocations
  }
}
```

**Applies to**: `new THREE.Vector3()`, `new THREE.Sphere()`, `new THREE.Box3()`,
`.clone()`, `.toArray()`, string template literals in tight loops, `Array.map()` in tight loops.

---

## Rule 2: Cache shared materials and geometries

Three.js compiles a GPU shader program the first time a material is used in a render call.
Creating a new `MeshStandardMaterial` per spawned object means N shader compiles = N frame stalls.

### ❌ Bad — new material per spawn
```javascript
spawnItem() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, mat);
}
```

### ✅ Good — shared material from constructor
```javascript
constructor() {
  this.sharedMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
}
spawnItem() {
  const mesh = new THREE.Mesh(geometry, this.sharedMat);
}
```

Same rule applies to **geometries** — `new BoxGeometry(...)` allocates GPU vertex buffers.
If multiple meshes share the same dimensions, share the geometry instance.

---

## Rule 3: Cap unbounded collections

Any array that grows over time (ground loot, particle effects, bullet casings)
**must have a maximum size**. When the cap is reached, evict the oldest entry.

```javascript
const MAX_ITEMS = 50;

spawnItem(data, pos) {
  while (this.items.length >= MAX_ITEMS) {
    const oldest = this.items.shift();
    this.scene.remove(oldest.mesh);
  }
  // ... spawn new item
}
```

Without this, a player who farms bots for 10 minutes will accumulate hundreds of
scene objects, each traversed every frame in physics and proximity loops.

---

## Rule 4: Use object pools for frequently created/destroyed objects

Bullets, particles, and sparks should use fixed-size pools (see `bullets.js`).
Never `scene.add()` / `scene.remove()` on every fire and impact — toggle `.visible` instead.

---

## Rule 5: Minimize shadow-casting objects

Every mesh with `castShadow = true` is rendered twice per frame (once for the shadow map).
Only enable shadows on objects large enough to produce visible shadows.
Small items like bullet casings, particles, and UI indicators should have `castShadow = false`.

---

## Rule 6: Avoid `setTimeout` / `setInterval` for gameplay logic

`setTimeout` callbacks execute outside the game loop and can cause visual glitches
(e.g., the hit-flinch in `targets.js` uses `setTimeout` to reset position).
Prefer timer-based state machines driven by `deltaTime` in `update()`.

---

## Rule 7: Profile before optimizing

Use the browser's Performance tab (F12 → Performance) to record 5 seconds of gameplay.
Look for:
- **Long frames** (>16ms) — indicates main-thread blocking
- **Forced GC** events — indicates excessive allocation
- **GPU bottlenecks** — indicates too many draw calls or expensive shaders

The Three.js `renderer.info` object exposes `render.calls`, `render.triangles`,
`memory.geometries`, and `memory.textures` — log these periodically to spot leaks.

---

## Current Codebase Performance Budget

| Metric | Target | Notes |
|--------|--------|-------|
| Ground items | ≤ 50 | Capped in `world-items.js` |
| Bullet pool | 60 | Fixed pool in `bullets.js` |
| Spark pool | 40 | Fixed pool in `bullets.js` |
| Enemy bots | 6 | Fixed count in `targets.js` |
| Shadow map | 2048×2048 | Single directional light |
| Per-frame allocations | 0 | No `new` in update loops |
