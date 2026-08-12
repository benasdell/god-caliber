# God-Caliber — Engineering Learnings & Wisdom Log

> **Purpose**: Record trial-and-error experiences, critical bug root causes, and architectural invariants to prevent recurring mistakes in future patches.

---

## 1. WebRTC & PeerJS Multiplayer Networking (Patch 0.3.5)

- **Legacy `{ reliable: false }` DataChannel Option**:
  In PeerJS 1.5+, passing `{ reliable: false }` to `peer.connect()` injects legacy PeerJS 0.3 parameters into `RTCPeerConnection.createDataChannel`. This causes data channel creation to silently fail or time out on modern browsers. Always use default options or standard `{ serialization: 'json' }`.
- **PeerJS Cloud Signaling Parameter Override**:
  Hardcoding `{ host: '0.peerjs.com', port: 443, secure: true, path: '/' }` in `getPeerConfig()` overrides internal PeerServer cluster routing and causes signaling registration drops. Omit `host`/`port` overrides when targeting PeerJS Cloud defaults.
- **Localhost mDNS & Hairpin NAT Failure Mode**:
  When testing two tabs on `http://localhost` on Windows/Chrome, Chrome conceals local IP addresses behind `.local` mDNS hostnames due to WebRTC privacy protection. If local mDNS resolution fails or router blocks Hairpin NAT loopback (sending UDP packets to public IP inside LAN), STUN candidates fail.
  *Fix*: Added OpenRelay TURN fallback (`turn:openrelay.metered.ca:80`) by default in `getIceServers()`. TURN relay routes packets through external relay sockets, bypassing Hairpin NAT and mDNS resolution completely!
- **Cloudflare Tunnel Scope vs WebRTC**:
  `cloudflared tunnel --url http://localhost:5173` proxies **HTTP/HTTPS frontend traffic on port 5173**. It **does NOT proxy WebRTC UDP/TCP P2P media/data channels**. WebRTC connections rely on STUN/TURN candidate exchange.

---

## 2. Three.js GPU Memory Management (Patch 0.3.4)

- **Geometry & Material Disposal**:
  Removing a mesh from the scene with `scene.remove(mesh)` does NOT free GPU memory. You MUST explicitly call `mesh.geometry.dispose()`, `mesh.material.dispose()`, and `texture.dispose()` on all child meshes and materials.

---

## 3. Function & State Naming Invariants

- **Impure Side-Effecting Functions**:
  Always name impure functions to explicitly state side effects (e.g. `loadIntoStateAndNotify()`, `saveFireAndForget()`).
- **Async Error Handling**:
  Never use `void asyncFn()`. Always `await` async functions or catch internal errors explicitly inside fire-and-forget helpers.

---

## 4. Player Physics vs Network Proxy Architecture (Patch 0.3.6)

- **Local Player Capsule Position Sync**:
  In Three.js physics loops using `three/examples/jsm/math/Capsule.js`, translating `this.collider` does NOT automatically mutate `this.position`. If `this.position` is not explicitly synced (`this.position.set(collider.start.x, collider.start.y - 0.35, collider.start.z)`), network state broadcasters will send stale initial spawn coordinates forever.
- **Raycasting Peer Bounding Spheres**:
  Hitscan bullet raycasting against remote player avatars requires attaching an updated `boundingSphere` (`this.boundingSphere.center.copy(mesh.position).add(0, 1.0, 0)`) to `PeerPlayer`. Raycasting directly against 3D humanoid mesh groups without bounding volumes or octrees drops hit detection precision.
- **Scoreboard Data Telemetry Unification**:
  Never mix simulated dummy points loops with real multiplayer stats. Compute dynamic scoreboard rows by querying `window.gameInstance.player` for local stats, `network.peerPlayers` for human peers, and `targetManager.targets` for active AI bots.

---

## 5. Security & Performance Invariants (Sub-Patch 0.3.7 Bastion)

- **Host RPC Validation & Rate Limiting**:
  Never trust peer RPC packets implicitly. Host processes MUST validate incoming hit damage caps (`<= 200 HP`), verify ray distances (`<= 150m`), whitelist RPC types (`ALLOWED_TYPES`), and enforce per-peer sliding window rate limiting (max 60 pkts/sec).
- **GPU Resource Memory Leak Prevention**:
  `scene.remove(group)` leaves underlying `BufferGeometry` and `MeshStandardMaterial` instances in VRAM. Always traverse mesh groups and call `.dispose()` on unshared geometries and materials when switching weapons (`weapon.js`), despawning dead enemies (`targets.js`), or clearing ground loot (`world-items.js`). Use shared material caches (`WEAPON_MATERIAL_CACHE`) for procedural models.
- **Zero Allocation Invariants in High-Frequency Loops**:
  Instantiating `new THREE.Vector3()`, `new THREE.Ray()`, or creating new `AudioBuffer` float arrays inside `animate()`, `getClosestInteractable()`, `spawnBullet()`, or `playGunshot()` triggers garbage collection spikes. Preallocate static scratch variables at module scope.

---

## 6. Procedural Terrain & Crosshair Interaction Invariants (Sub-Patch 0.3.8 Thunderbird)

- **Ladder Outward Normal Direction Invariant**:
  When calculating ladder mounting offsets or checking outward climbable faces, the outward normal MUST face away from the attached surface (`_tempDir.set(0, 0, 1).applyAxisAngle(_axisY, rotationY)`). Inverting this vector (`0, 0, -1`) snaps the player capsule INSIDE wall/pillar geometry.
- **Crosshair Raycast Selection over Radial Proximity**:
  Targeting interactive objects (chests, items, ladders, ziplines) near each other requires camera-center raycasting (`raycaster.setFromCamera(Vector2(0,0), camera)` up to 3.5m). Pure radial proximity causes selection overlap when multiple interactables sit within 2m of each other.
- **1000m Map Circle & Physics Bounds Synchronization**:
  When expanding map bounds, update `TESTING_ARENA_CONFIG.ground` and rebuild the Octree physics node (`worldOctree.fromGraphNode(environmentGroup)`). Always scale the Battle Royale circle initial radius (`450m`) to match the expanded perimeter bounds.

---

## 7. Inventory UI & Minimap Coordinate Transformation Invariants (Sub-Patch 0.3.9 Overhaul)

- **Minimap Relative Transformation Matrix Invariant**:
  Mapping dynamic world entities onto a 2D HUD minimap MUST convert world coordinates relative to the player's world position: `relX = x - playerPos.x`, `relZ = z - playerPos.z`. Anchoring the player chevron at canvas center `(cx, cy)` while transforming all external positions guarantees the player never leaves the minimap frame regardless of map dimensions.
- **Unified Full-Screen Overlay Navigation**:
  Do not split core player management workflows into disconnected tabs with duplicate rendering code. Merging inventory storage and crafting into a single unified overlay simplifies keybindings (`KeyE` toggle) and eliminates tab state sync bugs.
- **Auto-Equipping Unequipped Gear Slots**:
  When picking up items, check if the designated slot (`primary`, `secondary`, `head`, `vest`, `gloves`, `boots`) is unequipped (`equipment[slot] === null`). Auto-equipping directly improves looting pacing and removes manual inventory cluttering.




