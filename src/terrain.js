import * as THREE from 'three';

const _scratchV = new THREE.Vector3();
const _scratchP = new THREE.Vector3();
const _scratchProj = new THREE.Vector3();
const _scratchLadPos = new THREE.Vector3();
const _scratchOutwardNormal = new THREE.Vector3();
const _scratchPlayerRel = new THREE.Vector3();

// Helper: Build a clean, right-angled triangular prism ramp geometry
export function createTriangularRampGeometry(width, height, length) {
  const geom = new THREE.BufferGeometry();

  // 6 vertices of a right-triangular prism
  // Slope runs along the Z axis from z = +length/2 (ground) to z = -length/2 (top at y = height)
  const halfW = width / 2;
  const halfL = length / 2;

  const vertices = new Float32Array([
    // Bottom-front-left (0)
    -halfW, 0, halfL,
    // Bottom-front-right (1)
     halfW, 0, halfL,
    // Bottom-back-right (2)
     halfW, 0, -halfL,
    // Bottom-back-left (3)
    -halfW, 0, -halfL,
    // Top-back-right (4)
     halfW, height, -halfL,
    // Top-back-left (5)
    -halfW, height, -halfL
  ]);

  // Faces (triangles with proper winding order)
  const indices = [
    // Bottom face (quad)
    0, 2, 1,   0, 3, 2,
    // Back face (quad)
    3, 4, 2,   3, 5, 4,
    // Slope incline face (quad)
    0, 1, 4,   0, 4, 5,
    // Left triangular side
    0, 5, 3,
    // Right triangular side
    1, 2, 4
  ];

  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// "Testing Arena" Modular Map Configuration — 240x240m Battle Royale Arena
export const TESTING_ARENA_CONFIG = {
  id: "testing_arena",
  name: "Testing Arena",

  // 1. Ground & Perimeter Walls (240x240m)
  ground: { width: 240, length: 240 },
  perimeterWalls: { height: 12, thickness: 2 },

  // 2. Central & Secondary Platforms + 4 Major Landmark POIs
  platforms: [
    { id: 'center_platform', x: 0, y: 1.5, z: 0, width: 18, height: 3, length: 18, color: 0x1e293b },
    { id: 'north_overlook', x: 0, y: 3.5, z: -50, width: 24, height: 7, length: 12, color: 0x1e293b },
    { id: 'south_overlook', x: 0, y: 3.5, z: 50, width: 24, height: 7, length: 12, color: 0x1e293b },

    // POI 1: Sniper Outpost (x: 60, z: -60) — 15m High Elevated Tower Platform
    { id: 'sniper_outpost_tower', x: 60, y: 7.5, z: -60, width: 10, height: 15, length: 10, color: 0x0f172a },

    // POI 2: Underground Bunker / Tunnel Chamber (x: -60, z: -60) — Subterranean Floor Slabs
    { id: 'bunker_floor_slab', x: -60, y: -4, z: -60, width: 22, height: 2, length: 22, color: 0x1e293b },

    // POI 3: Industrial Warehouses (x: -60, z: 60) — Twin CQB Structures
    { id: 'warehouse_west', x: -74, y: 4, z: 60, width: 14, height: 8, length: 24, color: 0x334155 },
    { id: 'warehouse_east', x: -46, y: 4, z: 60, width: 14, height: 8, length: 24, color: 0x334155 },

    // POI 4: CQB Courtyard Central Monument (x: 60, z: 60)
    { id: 'courtyard_monument_base', x: 60, y: 0.5, z: 60, width: 6, height: 1, length: 6, color: 0x1e293b },
  ],

  // 3. True Triangular Prism Ramps
  ramps: [
    // Ramps leading up to central platform from North and South
    { id: 'ramp_center_south', x: 0, y: 0, z: 15, width: 6, height: 3, length: 12, rotationY: 0 },
    { id: 'ramp_center_north', x: 0, y: 0, z: -15, width: 6, height: 3, length: 12, rotationY: Math.PI },
    // Ramps leading to overlooks
    { id: 'ramp_north_east', x: 18, y: 0, z: -50, width: 5, height: 7, length: 20, rotationY: Math.PI / 2 },
    { id: 'ramp_south_west', x: -18, y: 0, z: 50, width: 5, height: 7, length: 20, rotationY: -Math.PI / 2 },

    // Underground Bunker Access Ramps (sloping into subterranean chamber y: -5m)
    { id: 'bunker_ramp_north', x: -60, y: -2.5, z: -77, width: 8, height: 5, length: 16, rotationY: 0 },
    { id: 'bunker_ramp_south', x: -60, y: -2.5, z: -43, width: 8, height: 5, length: 16, rotationY: Math.PI },
  ],

  // 4. Pillars
  pillars: [
    { id: 'pillar_nw', x: -40, y: 5, z: -40, radius: 1.5, height: 10 },
    { id: 'pillar_ne', x: 40, y: 5, z: -40, radius: 1.5, height: 10 },
    { id: 'pillar_sw', x: -40, y: 5, z: 40, radius: 1.5, height: 10 },
    { id: 'pillar_se', x: 40, y: 5, z: 40, radius: 1.5, height: 10 },
    { id: 'pillar_inner_w', x: -28, y: 5, z: 0, radius: 1.4, height: 10 },
    { id: 'pillar_inner_e', x: 28, y: 5, z: 0, radius: 1.4, height: 10 },

    // CQB Courtyard Central Pillar Monument
    { id: 'courtyard_pillar', x: 60, y: 3.5, z: 60, radius: 2.0, height: 6 },
  ],

  // 5. Tactical Cover Short Walls & CQB Barriers
  coverWalls: [
    { x: -12, y: 3.5, z: 0, width: 0.4, height: 1.0, length: 6, rotationY: 0 },
    { x: 12, y: 3.5, z: 0, width: 0.4, height: 1.0, length: 6, rotationY: 0 },
    { x: 0, y: 3.5, z: -7, width: 6, height: 1.0, length: 0.4, rotationY: 0 },
    { x: 0, y: 3.5, z: 7, width: 6, height: 1.0, length: 0.4, rotationY: 0 },
    { x: -25, y: 0.5, z: -25, width: 8, height: 1.0, length: 0.4, rotationY: Math.PI / 4 },
    { x: 25, y: 0.5, z: -25, width: 8, height: 1.0, length: 0.4, rotationY: -Math.PI / 4 },
    { x: -25, y: 0.5, z: 25, width: 8, height: 1.0, length: 0.4, rotationY: -Math.PI / 4 },
    { x: 25, y: 0.5, z: 25, width: 8, height: 1.0, length: 0.4, rotationY: Math.PI / 4 },
    { x: -50, y: 0.5, z: 0, width: 0.4, height: 1.0, length: 10, rotationY: 0 },
    { x: 50, y: 0.5, z: 0, width: 0.4, height: 1.0, length: 10, rotationY: 0 },

    // CQB Courtyard Perimeter Barriers (x: 60, z: 60)
    { x: 52, y: 0.6, z: 60, width: 0.4, height: 1.2, length: 10, rotationY: 0 },
    { x: 68, y: 0.6, z: 60, width: 0.4, height: 1.2, length: 10, rotationY: 0 },
    { x: 60, y: 0.6, z: 52, width: 10, height: 1.2, length: 0.4, rotationY: 0 },
    { x: 60, y: 0.6, z: 68, width: 10, height: 1.2, length: 0.4, rotationY: 0 },
  ],

  // 6. Elevated Walkways
  walkways: [
    { id: 'walkway_north', x1: -40, y1: 10, z1: -40, x2: 40, y2: 10, z2: -40, width: 2.5, thickness: 0.4 },
    { id: 'walkway_south', x1: -40, y1: 10, z1: 40, x2: 40, y2: 10, z2: 40, width: 2.5, thickness: 0.4 },
    { id: 'walkway_west',  x1: -40, y1: 10, z1: -40, x2: -40, y2: 10, z2: 40, width: 2.5, thickness: 0.4 },
    { id: 'walkway_east',  x1: 40, y1: 10, z1: -40, x2: 40, y2: 10, z2: 40, width: 2.5, thickness: 0.4 },

    // Warehouse Catwalk Bridge (x: -60, z: 60)
    { id: 'warehouse_catwalk', x1: -74, y1: 4, z1: 60, x2: -46, y2: 4, z2: 60, width: 3.0, thickness: 0.4 },
  ],

  // 7. Vertical Climbable Ladders
  ladders: [
    { id: 'ladder_north_overlook', x: 0, z: -43.8, yStart: 0, yEnd: 7.2, rotationY: Math.PI },
    { id: 'ladder_south_overlook', x: 0, z: 43.8, yStart: 0, yEnd: 7.2, rotationY: 0 },
    { id: 'ladder_pillar_nw', x: -40, z: -41.6, yStart: 0, yEnd: 10.5, rotationY: Math.PI },
    { id: 'ladder_pillar_se', x: 40, z: 41.6, yStart: 0, yEnd: 10.5, rotationY: 0 },
    { id: 'ladder_pillar_ne', x: 41.6, z: -40, yStart: 0, yEnd: 10.5, rotationY: -Math.PI / 2 },
    { id: 'ladder_pillar_sw', x: -41.6, z: 40, yStart: 0, yEnd: 10.5, rotationY: Math.PI / 2 },

    // Sniper Outpost Tower Access Ladder (y: 0 to 15.2m)
    { id: 'ladder_sniper_tower', x: 60, z: -54.8, yStart: 0, yEnd: 15.2, rotationY: 0 },
  ],

  // 8. Interactive Ziplines
  ziplines: [
    { id: 'zip_nw_to_center', start: [-40, 11.4, -40], end: [0, 4.4, 0], speed: 32.0 },
    { id: 'zip_se_to_center', start: [40, 11.4, 40], end: [0, 4.4, 0], speed: 32.0 },
    { id: 'zip_north_cross', start: [-40, 11.4, -40], end: [40, 11.4, -40], speed: 32.0 },
    { id: 'zip_south_cross', start: [40, 11.4, 40], end: [-40, 11.4, 40], speed: 32.0 },

    // Long-distance zipline from Sniper Tower down to Central Platform
    { id: 'zip_sniper_to_center', start: [60, 15.4, -60], end: [0, 4.4, 0], speed: 36.0 },
  ]
};

export const DEFAULT_MAP_CONFIG = TESTING_ARENA_CONFIG;

// Map Presets Registry for Futureproofing (Allows instant switching to new maps in future)
export const MAP_PRESETS = {
  testing_arena: TESTING_ARENA_CONFIG,
};

export class TerrainManager {
  constructor(gameScene, config = DEFAULT_MAP_CONFIG) {
    this.gameScene = gameScene;
    this.scene = gameScene.scene;
    this.environmentGroup = gameScene.environmentGroup;
    this.config = config;

    this.ladders = [];
    this.ziplines = [];

    this.materials = {
      floor: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.4 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.3 }),
      platform: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 }),
      accent: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.5, roughness: 0.2 }),
      walkway: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 }),
      cable: new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 0.8, roughness: 0.1 }),
      ladder: new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.3, roughness: 0.3 }),
      handle: new THREE.MeshStandardMaterial({ color: 0xffe600, emissive: 0xffe600, emissiveIntensity: 0.9 }),
    };

    this.buildMap();
  }

  addMesh(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.environmentGroup.add(mesh);
  }

  buildMap() {
    // 1. Build Ground Floor
    const { width, length } = this.config.ground;
    const gridTexture = this.gameScene.createGridTexture();
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(width / 2, length / 2);

    const floorMat = this.materials.floor.clone();
    floorMat.map = gridTexture;

    const floorGeo = new THREE.BoxGeometry(width, 2, length);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, 0);
    this.addMesh(floor);

    // 2. Build Outer Perimeter Walls
    const wallH = this.config.perimeterWalls.height;
    const wallT = this.config.perimeterWalls.thickness;

    const wallGeoH = new THREE.BoxGeometry(width, wallH, wallT);
    const wallGeoV = new THREE.BoxGeometry(wallT, wallH, length);

    const halfW = width / 2;
    const halfL = length / 2;

    const nWall = new THREE.Mesh(wallGeoH, this.materials.wall);
    nWall.position.set(0, wallH / 2, -halfL);
    this.addMesh(nWall);

    const sWall = new THREE.Mesh(wallGeoH, this.materials.wall);
    sWall.position.set(0, wallH / 2, halfL);
    this.addMesh(sWall);

    const wWall = new THREE.Mesh(wallGeoV, this.materials.wall);
    wWall.position.set(-halfW, wallH / 2, 0);
    this.addMesh(wWall);

    const eWall = new THREE.Mesh(wallGeoV, this.materials.wall);
    eWall.position.set(halfW, wallH / 2, 0);
    this.addMesh(eWall);

    // 3. Build Platforms
    this.config.platforms.forEach(p => {
      const geo = new THREE.BoxGeometry(p.width, p.height, p.length);
      const mesh = new THREE.Mesh(geo, this.materials.platform);
      mesh.position.set(p.x, p.y, p.z);
      this.addMesh(mesh);

      // Gold accent border trim around top edge
      const trimGeo = new THREE.BoxGeometry(p.width + 0.2, 0.2, p.length + 0.2);
      const trim = new THREE.Mesh(trimGeo, this.materials.accent);
      trim.position.set(p.x, p.y + p.height / 2, p.z);
      this.addMesh(trim);
    });

    // 4. Build True Triangular Prism Ramps
    this.config.ramps.forEach(r => {
      const rampGeo = createTriangularRampGeometry(r.width, r.height, r.length);
      const rampMesh = new THREE.Mesh(rampGeo, this.materials.platform);
      rampMesh.position.set(r.x, r.y, r.z);
      rampMesh.rotation.y = r.rotationY || 0;
      this.addMesh(rampMesh);
    });

    // 5. Build Pillars
    this.config.pillars.forEach(p => {
      const geo = new THREE.CylinderGeometry(p.radius, p.radius, p.height, 16);
      const mesh = new THREE.Mesh(geo, this.materials.wall);
      mesh.position.set(p.x, p.y, p.z);
      this.addMesh(mesh);

      // Neon accent torus ring
      const ringGeo = new THREE.TorusGeometry(p.radius + 0.1, 0.08, 16, 32);
      const ring = new THREE.Mesh(ringGeo, this.materials.accent);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, p.y - 2, p.z);
      this.addMesh(ring);
    });

    // 6. Build Tactical Cover Short Walls
    this.config.coverWalls.forEach(w => {
      const geo = new THREE.BoxGeometry(w.width, w.height, w.length);
      const mesh = new THREE.Mesh(geo, this.materials.wall);
      mesh.position.set(w.x, w.y, w.z);
      mesh.rotation.y = w.rotationY || 0;
      this.addMesh(mesh);

      // Trim line along top of cover wall
      const trimGeo = new THREE.BoxGeometry(w.width + 0.05, 0.1, w.length + 0.05);
      const trim = new THREE.Mesh(trimGeo, this.materials.accent);
      trim.position.set(w.x, w.y + w.height / 2, w.z);
      trim.rotation.y = w.rotationY || 0;
      this.addMesh(trim);
    });

    // 7. Build Elevated Pillar Walkways (Open sky bridges without vertical side walls)
    this.config.walkways.forEach(wk => {
      const start = new THREE.Vector3(wk.x1, wk.y1, wk.z1);
      const end = new THREE.Vector3(wk.x2, wk.y2, wk.z2);
      const length = start.distanceTo(end);
      const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

      const geo = new THREE.BoxGeometry(wk.width, wk.thickness, length);
      const mesh = new THREE.Mesh(geo, this.materials.walkway);
      mesh.position.copy(midPoint);
      mesh.lookAt(end);
      this.addMesh(mesh);
    });

    // 8. Build Vertical Ladders
    this.config.ladders.forEach(lad => {
      const height = lad.yEnd - lad.yStart;
      const centerY = (lad.yStart + lad.yEnd) / 2;

      const ladderGroup = new THREE.Group();
      ladderGroup.position.set(lad.x, centerY, lad.z);
      ladderGroup.rotation.y = lad.rotationY || 0;

      // Vertical side rails
      const railGeo = new THREE.BoxGeometry(0.1, height, 0.1);
      const leftRail = new THREE.Mesh(railGeo, this.materials.wall);
      leftRail.position.set(-0.5, 0, 0);
      ladderGroup.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, this.materials.wall);
      rightRail.position.set(0.5, 0, 0);
      ladderGroup.add(rightRail);

      // Horizontal glowing rungs
      const numRungs = Math.floor(height / 0.5);
      const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
      for (let i = 0; i < numRungs; i++) {
        const rungY = -height / 2 + (i + 0.5) * 0.5;
        const rung = new THREE.Mesh(rungGeo, this.materials.ladder);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, rungY, 0);
        ladderGroup.add(rung);
      }

      this.addMesh(ladderGroup);
      this.ladders.push({
        ...lad,
        height,
        centerY,
        position: new THREE.Vector3(lad.x, centerY, lad.z)
      });
    });

    // 9. Build Ziplines & Mounting Posts on Top of Pillars
    const postPositions = [
      [-40, 10.0, -40], [40, 10.0, -40],
      [-40, 10.0, 40],  [40, 10.0, 40],
      [0, 3.0, 0]
    ];

    postPositions.forEach(([px, py, pz]) => {
      // Metallic post geometry
      const postGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.4, 12);
      const postMesh = new THREE.Mesh(postGeo, this.materials.wall);
      postMesh.position.set(px, py + 0.7, pz);
      this.addMesh(postMesh);

      // Top glowing pulley ring hook
      const hookGeo = new THREE.TorusGeometry(0.25, 0.05, 12, 24);
      const hookMesh = new THREE.Mesh(hookGeo, this.materials.accent);
      hookMesh.position.set(px, py + 1.4, pz);
      hookMesh.rotation.x = Math.PI / 2;
      this.addMesh(hookMesh);
    });

    this.config.ziplines.forEach(zip => {
      const start = new THREE.Vector3(...zip.start);
      const end = new THREE.Vector3(...zip.end);

      // Cable curve / tube geometry
      const curve = new THREE.LineCurve3(start, end);
      const cableGeo = new THREE.TubeGeometry(curve, 32, 0.08, 8, false);
      const cableMesh = new THREE.Mesh(cableGeo, this.materials.cable);
      this.addMesh(cableMesh);

      // Interactive Handle Grips at both ends
      const handleGeo = new THREE.TorusGeometry(0.35, 0.06, 12, 24);

      const startHandle = new THREE.Mesh(handleGeo, this.materials.handle);
      startHandle.position.copy(start);
      startHandle.rotation.x = Math.PI / 2;
      this.scene.add(startHandle);

      const endHandle = new THREE.Mesh(handleGeo, this.materials.handle);
      endHandle.position.copy(end);
      endHandle.rotation.x = Math.PI / 2;
      this.scene.add(endHandle);

      this.ziplines.push({
        ...zip,
        start,
        end,
        length: start.distanceTo(end),
        dir: new THREE.Vector3().subVectors(end, start).normalize(),
        startHandle,
        endHandle
      });
    });
  }

  // Get closest interactable zipline or ladder near player position
  getClosestInteractable(playerPos, cameraDir) {
    let closest = null;
    let minDist = 4.0; // Distance threshold to cable line or ladder rungs

    // 1. Check Ziplines (Cable segment projection + camera orientation alignment)
    for (const zip of this.ziplines) {
      _scratchV.subVectors(zip.end, zip.start);
      const lenSq = _scratchV.lengthSq();
      if (lenSq === 0) continue;

      _scratchP.subVectors(playerPos, zip.start);
      const t = Math.max(0, Math.min(1, _scratchP.dot(_scratchV) / lenSq));
      _scratchProj.copy(zip.start).lerp(zip.end, t);
      const distToCable = playerPos.distanceTo(_scratchProj);

      if (distToCable < minDist) {
        minDist = distToCable;

        // Determine travel direction based on camera look vector relative to cable direction
        let dirSign = 1;
        if (cameraDir) {
          const dot = cameraDir.dot(zip.dir);
          dirSign = dot >= 0 ? 1 : -1;
        } else {
          dirSign = t < 0.5 ? 1 : -1;
        }

        closest = {
          type: 'zipline',
          data: zip,
          startProgress: t,
          direction: dirSign === 1 ? 'forward' : 'reverse',
          dirSign,
          dist: distToCable
        };
      }
    }

    // 2. Check Ladders
    for (const lad of this.ladders) {
      _scratchLadPos.set(lad.x, playerPos.y, lad.z);
      const dist = playerPos.distanceTo(_scratchLadPos);
      if (dist < 2.5 && playerPos.y >= lad.yStart - 0.5 && playerPos.y <= lad.yEnd + 1.2) {
        // If ladder is attached to a wall/pillar, verify player is in front of outward climbable face
        if (!lad.isFreestanding) {
          _scratchOutwardNormal.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), lad.rotationY || 0);
          _scratchPlayerRel.subVectors(playerPos, _scratchLadPos);
          if (_scratchPlayerRel.dot(_scratchOutwardNormal) < -0.2) continue; // Skip if player is behind/inside the wall
        }

        if (dist < minDist) {
          minDist = dist;
          closest = { type: 'ladder', data: lad, dist: dist };
        }
      }
    }

    return closest;
  }

  // Futureproofing: Method to clear existing map objects and load a new map preset dynamically
  loadMap(configOrPresetKey) {
    const config = typeof configOrPresetKey === 'string'
      ? (MAP_PRESETS[configOrPresetKey] || DEFAULT_MAP_CONFIG)
      : configOrPresetKey;

    // Clear environment group children
    while (this.environmentGroup.children.length > 0) {
      const child = this.environmentGroup.children[0];
      this.environmentGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    this.config = config;
    this.ladders = [];
    this.ziplines = [];

    this.buildMap();

    // Rebuild Octree physics graph node
    if (this.gameScene && this.gameScene.worldOctree) {
      this.gameScene.worldOctree.fromGraphNode(this.environmentGroup);
    }
  }
}
