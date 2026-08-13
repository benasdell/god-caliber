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
- **Auto-Equip Unequipped Gear Slots**:
  When picking up items, check if the designated slot (`primary`, `secondary`, `head`, `vest`, `gloves`, `boots`) is unequipped (`equipment[slot] === null`). Auto-equipping directly improves looting pacing and removes manual inventory cluttering.

---

## 8. Action Keybinding & UI Scale Invariants (Sub-Patch 0.3.9c Hotfix)

- **Separation of Interaction (KeyF) and UI Toggles (KeyE)**:
  Never overload world object interaction (`KeyF`) with full-screen UI toggles (`KeyE`). When interaction falls back to opening UI when no target is present under the crosshair reticle, players attempting to grab items or attach to ziplines while moving will repeatedly trigger unwanted full-screen UI popups.
- **Dynamic Sub-Window Grid Scaling**:
  Hardcoding fixed pixel dimensions for UI grid containers (e.g. `600px x 250px`) causes misalignment when layout containers scale across different viewport resolutions. Compute cell dimensions dynamically (`cellW = container.clientWidth / cols`, `cellH = container.clientHeight / rows`) in item rendering and drag-and-drop calculation loops.
- **Scrollbar Elimination via Flex Bounds & `overflow: hidden`**:
  To guarantee zero scrollbars on full-screen modal overlays across all screen resolutions, specify constrained element heights (`height: min(92vh, 850px);`), compact paddings/gaps, and explicit `overflow: hidden` boundaries on container modals.

---

## 9. Equipment Reset & Multi-Weapon Auto-Equip Invariants (Sub-Patch 0.3.9d Hotfix)

- **Complete Equipment Reset on Match Start**:
  When resetting player state for a new match round (`startBRMatch()`), never rely on re-initializing only default weapon slots. Explicitly clear all equipment slots (`head`, `torso`, `legs`, `gloves`, `primary`, `secondary`, `melee`) to `null` before populating starting gear. Otherwise, armor, boots, gloves, and secondary weapons equipped in previous rounds persist across match restarts.
- **Sequential Weapon Slot Resolution for Auto-Equip**:
  When evaluating equipment target slots for non-melee weapons (`getEquipmentSlotForItem`), do NOT hardcode `'primary'`. Check if `primary` is empty (`null`); if occupied, check if `secondary` is empty (`null`). Only if both weapon slots are full should it fallback to the currently active weapon slot. This guarantees that picking up a second weapon automatically equips into `secondary` slot whenever `secondary` is unequipped.

---

## 10. Recipe Learning & Legendary Crafting Invariants (Sub-Patch 0.3.9e Hotfix)

- **Inventory Right-Click Blueprint Unlocking**:
  Recipe items must be learned directly within the player inventory via right-click interaction (`learnRecipe()`). Consuming the recipe item permanently appends the target base ID to `player.learnedRecipes` and persists state to `localStorage`.
- **Dynamic Blueprint Grid Unlocking & Dedicated Action Button**:
  Once a recipe is learned, dynamically append the specific Special Legendary item card (e.g. `⚡ VORTEX ASSAULT RIFLE`) to the Crafting Bench blueprint grid. Selecting a Legendary blueprint updates the forge action button to **`CRAFT ITEM`** with fixed dust costs (30 Epic, 20 Legendary Dust). Remove raw `Recipe` items from crafting grids and upgrade slots to eliminate ambiguous upgrade states.

---

## 11. Entity Model, Procedural Animation & Limb Hitbox Invariants (Patch 0.3.10 Kraken)

- **Standardized 15-Bone Hierarchy Standardization**:
  All humanoid entities (Host Player, Client Peer Players, AI Enemies) adopt a single normalized 15-node bone hierarchy (`CharacterRig`). Separating procedural primitive nodes from GLTF skinned meshes via standard joint node lookups eliminates code divergence across entity types.
- **Head Mesh Visibility Masking for 1P Local Camera**:
  When mounting the camera inside the local player capsule, mask the head mesh (`setHeadVisibility(false)`). This prevents camera clipping inside the player's skull while keeping the torso, legs, and boots fully visible in 3D space when looking down (`pitch < -0.2`).
- **2-Pass Raycast for Limb Hitboxes**:
  Never execute high-poly or multi-part raycasts against all scene meshes directly. Test an entity's broadphase bounding sphere (`R=1.15m`) first. Only if the ray intersects the sphere should narrowphase matrix-transformed bone local OBB checks be evaluated.
- **Instanced Billboard Health Bars**:
  To render overhead status bars for mass entities, use a single `InstancedMesh` with a spherical camera-facing GLSL shader (`InstancedHealthBars`). Updating typed instance buffer attributes (`instancePosition`, `instanceHpRatio`) achieves 60-120+ FPS with 1 single WebGL draw call.
- **Binding Entity Mesh Groups to CharacterRig (Hotfix 0.3.10b)**:
  Always bind active entity mesh groups directly to `CharacterRig` (`new CharacterRig('PROCEDURAL', color, group)`). Creating a disconnected rig leaves bone matrices at origin `(0,0,0)`, causing bullet raycasts to miss enemies.
- **Centering Instanced Billboard Quads (Hotfix 0.3.10b)**:
  In GLSL vertex shaders for `PlaneGeometry` billboard quads, do NOT subtract `0.5` from `position.x`, as `PlaneGeometry` vertices are already centered at origin `0`. Subtracting `0.5` biases health bars to the left.
- **AI Weapon Socket & Muzzle Tip Extraction (Hotfix 0.3.10b)**:
  Humanoid enemies must carry a 3D weapon model attached to `weaponSocket` with a named `muzzleTip` child node. Extracting `muzzleTip.getWorldPosition(worldPos)` provides accurate firing origins and muzzle flash FX.
- **Broadphase Hitbox Sphere Bounds & Scale Safety (Hotfix 0.3.10c)**:
  Broadphase bounding spheres (`_broadSphere`) must be generously sized (`R = 2.5m` for humanoids/drones, `R = 3.5m` for 1.5x scaled Goliaths). Tight spheres crop out headshots and animated limbs.
- **Drone Mechanical Core Bone Registration (Hotfix 0.3.10c)**:
  Non-humanoid entities like flying drones must register their central mesh node (`droneCore`) as a bound bone node in `CharacterRig` and `HitboxManager` (`DRONE_CORE` hitbox).
- **Raycast Collider Fallback Guarantee (Hotfix 0.3.10c)**:
  If a narrowphase limb raycast returns `null` (e.g. edge shots), fallback to checking `bot.collider` (bounding sphere). This guarantees no enemy is ever immune to player bullets.

---

## 12. Blender 5.2 MCP & GLTF Export Invariants (Patch 0.3.11 Model Pipeline)

- **Null-Byte Delimited TCP Framing**:
  Blender's socket server (`mcp_to_blender_server.py`) expects requests formatted as `{"type": "execute", "code": "...", "strict_json": false}\0`. Omission of the null-byte `\0` terminator causes socket `recv` to hang until timeout.
- **Background Operator Context Overrides**:
  When triggering operators like `bpy.ops.export_scene.gltf()` or `bpy.ops.render.render()` from background timer/socket threads, `bpy.context.window` and `bpy.context.active_object` default to `None`. Always wrap operator calls in `with bpy.context.temp_override(window=win, area=area_3d, active_object=root_obj):` to prevent `AttributeError: 'NoneType' object has no attribute 'cursor_set'`.
- **Safe Scene Initialization Operator**:
  Never use `bpy.ops.wm.read_factory_settings()` in automated Blender scripts, as it is blocked by Blender's LLM sandbox. Use `bpy.ops.wm.read_homefile(use_empty=True, use_factory_startup=True)` instead.

