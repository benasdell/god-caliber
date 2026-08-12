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

// "Thunderbird 1000m Sector Arena" Modular Map Configuration — 1000x1000m Battle Royale World
export const TESTING_ARENA_CONFIG = {
  id: "testing_arena",
  name: "Thunderbird 1000m Sector Arena",

  // 1. Ground & Perimeter Walls (1000x1000m)
  ground: { width: 1000, length: 1000 },
  perimeterWalls: { height: 18, thickness: 3 },

  // 2. Central & POI Platforms
  platforms: [
    // POI 1: Sector Zero Citadel (Center x: 0, z: 0)
    { id: 'citadel_central_hub', x: 0, y: 3.0, z: 0, width: 48, height: 6, length: 48, color: 0x1e293b },
    { id: 'citadel_upper_deck', x: 0, y: 9.0, z: 0, width: 32, height: 6, length: 32, color: 0x0f172a },

    // POI 2: Outpost Omega Pillboxes (North-East x: 300, z: -300)
    { id: 'outpost_bunker_base', x: 300, y: 2.0, z: -300, width: 40, height: 4, length: 40, color: 0x1e293b },

    // POI 3: Industrial Complex (North-West x: -300, z: -300)
    { id: 'industrial_plant_slab', x: -300, y: 1.5, z: -300, width: 56, height: 3, length: 40, color: 0x334155 },

    // POI 4: Quantum Core Anomalous Zone (South-West x: -300, z: 300)
    { id: 'quantum_monolith_base', x: -300, y: 5.0, z: 300, width: 24, height: 10, length: 24, color: 0x0f172a },

    // POI 5: Transport Monorail Hub (South-East x: 300, z: 300)
    { id: 'monorail_hub_deck', x: 300, y: 8.0, z: 300, width: 44, height: 4, length: 28, color: 0x1e293b },
  ],

  // 3. Buildings & Modular Architecture
  singleLevelBuildings: [
    { id: 'building_single_nw', x: -280, y: 3.0, z: -280, width: 16, height: 4, length: 20 },
    { id: 'building_single_se', x: 280, y: 0, z: 280, width: 18, height: 4, length: 18 },
  ],

  twoLevelBuildings: [
    { id: 'building_two_level_ind', x: -320, y: 0, z: -300, width: 24, height: 8, length: 24 },
    { id: 'building_two_level_citadel', x: 60, y: 0, z: -60, width: 20, height: 8, length: 20 },
  ],

  movingPlatforms: [
    { id: 'elevator_monorail', x: 300, baseY: 2.0, z: 300, width: 6, height: 0.4, length: 6, travelDistance: 6.0, speed: 1.2 },
    { id: 'elevator_citadel', x: 0, baseY: 3.0, z: 26, width: 5, height: 0.4, length: 5, travelDistance: 5.0, speed: 1.5 },
  ],

  pillboxes: [
    { id: 'pillbox_omega_1', x: 280, y: 4.0, z: -320, width: 8, height: 2.2, length: 8 },
    { id: 'pillbox_omega_2', x: 320, y: 4.0, z: -280, width: 8, height: 2.2, length: 8 },
  ],

  // 4. True Triangular Prism Ramps
  ramps: [
    { id: 'ramp_citadel_south', x: 0, y: 0, z: 30, width: 8, height: 6, length: 16, rotationY: 0 },
    { id: 'ramp_citadel_north', x: 0, y: 0, z: -30, width: 8, height: 6, length: 16, rotationY: Math.PI },
    { id: 'ramp_monorail_east', x: 326, y: 0, z: 300, width: 6, height: 8, length: 20, rotationY: Math.PI / 2 },
  ],

  // 5. Tactical Cover Walls (Full 2.2m Height & Short Barriers)
  coverWalls: [
    // Full player-height cover walls (height: 2.2m)
    { x: -15, y: 6.0, z: 0, width: 0.5, height: 2.2, length: 8, rotationY: 0, fullCover: true },
    { x: 15, y: 6.0, z: 0, width: 0.5, height: 2.2, length: 8, rotationY: 0, fullCover: true },
    { x: 300, y: 4.0, z: -280, width: 8, height: 2.2, length: 0.5, rotationY: 0, fullCover: true },
    { x: -300, y: 3.0, z: -270, width: 12, height: 2.2, length: 0.5, rotationY: 0, fullCover: true },

    // Short tactical walls
    { x: -25, y: 0.5, z: -25, width: 8, height: 1.0, length: 0.4, rotationY: Math.PI / 4 },
    { x: 25, y: 0.5, z: -25, width: 8, height: 1.0, length: 0.4, rotationY: -Math.PI / 4 },
    { x: -25, y: 0.5, z: 25, width: 8, height: 1.0, length: 0.4, rotationY: -Math.PI / 4 },
    { x: 25, y: 0.5, z: 25, width: 8, height: 1.0, length: 0.4, rotationY: Math.PI / 4 },
  ],

  // 6. Pillars & Monoliths
  pillars: [
    { id: 'pillar_citadel_nw', x: -20, y: 6, z: -20, radius: 1.8, height: 12 },
    { id: 'pillar_citadel_ne', x: 20, y: 6, z: -20, radius: 1.8, height: 12 },
    { id: 'pillar_citadel_sw', x: -20, y: 6, z: 20, radius: 1.8, height: 12 },
    { id: 'pillar_citadel_se', x: 20, y: 6, z: 20, radius: 1.8, height: 12 },
  ],

  // 7. Elevated Walkways
  walkways: [
    { id: 'walkway_citadel_n', x1: -20, y1: 12, z1: -20, x2: 20, y2: 12, z2: -20, width: 3.0, thickness: 0.4 },
    { id: 'walkway_citadel_s', x1: -20, y1: 12, z1: 20, x2: 20, y2: 12, z2: 20, width: 3.0, thickness: 0.4 },
    { id: 'walkway_monorail_bridge', x1: 300, y1: 10, z1: 280, x2: 300, y2: 10, z2: 320, width: 3.0, thickness: 0.4 },
  ],

  // 8. Vertical Climbable Ladders
  ladders: [
    { id: 'ladder_citadel_hub', x: 0, z: -24.1, yStart: 0, yEnd: 12.0, rotationY: Math.PI },
    { id: 'ladder_monorail_hub', x: 300, z: 285.8, yStart: 0, yEnd: 10.0, rotationY: 0 },
    { id: 'ladder_industrial_plant', x: -320, z: -312.1, yStart: 0, yEnd: 8.0, rotationY: Math.PI },
    { id: 'ladder_building_single', x: -280, z: -290.1, yStart: 0, yEnd: 4.0, rotationY: 0 },
  ],

  // 9. Interactive Ziplines
  ziplines: [
    { id: 'zip_citadel_to_omega', start: [0, 12.4, 0], end: [300, 4.4, -300], speed: 36.0 },
    { id: 'zip_citadel_to_industrial', start: [0, 12.4, 0], end: [-300, 3.4, -300], speed: 36.0 },
    { id: 'zip_monorail_to_citadel', start: [300, 10.4, 300], end: [0, 6.4, 0], speed: 36.0 },
    { id: 'zip_quantum_to_citadel', start: [-300, 10.4, 300], end: [0, 6.4, 0], speed: 36.0 },
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

    // 5. Tactical Cover Walls (Full 2.2m Height & Short Barriers)
    if (this.config.coverWalls) {
      this.config.coverWalls.forEach(c => {
        const geo = new THREE.BoxGeometry(c.width, c.height, c.length);
        const mat = c.fullCover ? this.materials.wall : this.materials.platform;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(c.x, c.y, c.z);
        if (c.rotationY) mesh.rotation.y = c.rotationY;
        this.addMesh(mesh);

        if (c.fullCover) {
          const trimGeo = new THREE.BoxGeometry(c.width + 0.1, 0.1, c.length + 0.1);
          const trim = new THREE.Mesh(trimGeo, this.materials.accent);
          trim.position.set(c.x, c.y + c.height / 2, c.z);
          if (c.rotationY) trim.rotation.y = c.rotationY;
          this.addMesh(trim);
        }
      });
    }

    // 6. Single-Level Cyberpunk Buildings
    if (this.config.singleLevelBuildings) {
      this.config.singleLevelBuildings.forEach(b => {
        const wallMat = this.materials.wall;
        const thickness = 0.4;
        const halfW = b.width / 2;
        const halfL = b.length / 2;

        const wallN = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, thickness), wallMat);
        wallN.position.set(b.x, b.y + b.height / 2, b.z - halfL);
        this.addMesh(wallN);

        const wallS = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, thickness), wallMat);
        wallS.position.set(b.x, b.y + b.height / 2, b.z + halfL);
        this.addMesh(wallS);

        const wallE = new THREE.Mesh(new THREE.BoxGeometry(thickness, b.height, b.length), wallMat);
        wallE.position.set(b.x + halfW, b.y + b.height / 2, b.z);
        this.addMesh(wallE);

        const wallW = new THREE.Mesh(new THREE.BoxGeometry(thickness, b.height, b.length), wallMat);
        wallW.position.set(b.x - halfW, b.y + b.height / 2, b.z);
        this.addMesh(wallW);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.4, b.length), this.materials.platform);
        roof.position.set(b.x, b.y + b.height, b.z);
        this.addMesh(roof);
      });
    }

    // 7. Two-Level Cyberpunk Buildings with Internal 45° Staircases
    if (this.config.twoLevelBuildings) {
      this.config.twoLevelBuildings.forEach(b => {
        const wallMat = this.materials.wall;
        const thickness = 0.4;
        const halfW = b.width / 2;
        const halfL = b.length / 2;
        const floorH = b.height / 2;

        const wallN = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, thickness), wallMat);
        wallN.position.set(b.x, b.y + b.height / 2, b.z - halfL);
        this.addMesh(wallN);

        const wallS = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, thickness), wallMat);
        wallS.position.set(b.x, b.y + b.height / 2, b.z + halfL);
        this.addMesh(wallS);

        const wallE = new THREE.Mesh(new THREE.BoxGeometry(thickness, b.height, b.length), wallMat);
        wallE.position.set(b.x + halfW, b.y + b.height / 2, b.z);
        this.addMesh(wallE);

        const wallW = new THREE.Mesh(new THREE.BoxGeometry(thickness, b.height, b.length), wallMat);
        wallW.position.set(b.x - halfW, b.y + b.height / 2, b.z);
        this.addMesh(wallW);

        const midFloor = new THREE.Mesh(new THREE.BoxGeometry(b.width - 6, 0.4, b.length), this.materials.platform);
        midFloor.position.set(b.x + 3, b.y + floorH, b.z);
        this.addMesh(midFloor);

        const stairGeo = createTriangularRampGeometry(4, floorH, 8);
        const stairMesh = new THREE.Mesh(stairGeo, this.materials.ramp);
        stairMesh.position.set(b.x - halfW + 3, b.y, b.z);
        this.addMesh(stairMesh);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.width, 0.4, b.length), this.materials.platform);
        roof.position.set(b.x, b.y + b.height, b.z);
        this.addMesh(roof);
      });
    }

    // 8. Moving Elevator Platforms
    this.movingPlatforms = [];
    if (this.config.movingPlatforms) {
      this.config.movingPlatforms.forEach(p => {
        const geo = new THREE.BoxGeometry(p.width, p.height, p.length);
        const mesh = new THREE.Mesh(geo, this.materials.accent);
        mesh.position.set(p.x, p.baseY, p.z);
        this.addMesh(mesh);
        this.movingPlatforms.push({ ...p, mesh });
      });
    }

    // 9. Fortified Pillboxes / Bunkers with 0.3m Firing Slits
    if (this.config.pillboxes) {
      this.config.pillboxes.forEach(p => {
        const wallMat = this.materials.wall;
        const thickness = 0.5;
        const halfW = p.width / 2;
        const halfL = p.length / 2;

        const wallN = new THREE.Mesh(new THREE.BoxGeometry(p.width, 0.9, thickness), wallMat);
        wallN.position.set(p.x, p.y + 0.45, p.z - halfL);
        this.addMesh(wallN);

        const wallS = new THREE.Mesh(new THREE.BoxGeometry(p.width, 0.9, thickness), wallMat);
        wallS.position.set(p.x, p.y + 0.45, p.z + halfL);
        this.addMesh(wallS);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(p.width + 0.8, 0.5, p.length + 0.8), this.materials.platform);
        roof.position.set(p.x, p.y + p.height, p.z);
        this.addMesh(roof);
      });
    }
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

  getRaycastTarget(raycaster) {
    const interactableMeshes = [];

    for (const zip of this.ziplines) {
      if (zip.startHandle) {
        zip.startHandle.userData.terrainInteractable = { type: 'zipline', data: zip, startProgress: 0.0, dirSign: 1 };
        interactableMeshes.push(zip.startHandle);
      }
      if (zip.endHandle) {
        zip.endHandle.userData.terrainInteractable = { type: 'zipline', data: zip, startProgress: 1.0, dirSign: -1 };
        interactableMeshes.push(zip.endHandle);
      }
    }

    for (const lad of this.ladders) {
      if (lad.meshGroup) {
        lad.meshGroup.traverse(child => {
          if (child.isMesh) {
            child.userData.terrainInteractable = { type: 'ladder', data: lad };
            interactableMeshes.push(child);
          }
        });
      }
    }

    const hits = raycaster.intersectObjects(interactableMeshes, false);
    if (hits.length > 0 && hits[0].distance <= 3.5) {
      const targetData = hits[0].object.userData.terrainInteractable;
      if (targetData) {
        return { ...targetData, dist: hits[0].distance };
      }
    }
    return null;
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

  update(deltaTime) {
    if (!this.movingPlatforms) return;
    this.animTime = (this.animTime || 0) + deltaTime;
    for (const p of this.movingPlatforms) {
      if (p.mesh) {
        const offset = Math.sin(this.animTime * p.speed) * (p.travelDistance / 2);
        p.mesh.position.y = p.baseY + (p.travelDistance / 2) + offset;
      }
    }
  }
}
