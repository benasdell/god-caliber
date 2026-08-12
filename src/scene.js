import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { TerrainManager, DEFAULT_MAP_CONFIG } from './terrain.js';

export class GameScene {
  constructor(canvas) {
    this.canvas = canvas;
    
    // Scene setup - Late Afternoon Outdoor Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Bright late-afternoon sky blue
    this.scene.fog = new THREE.FogExp2(0xfef08a, 0.012); // Soft warm atmospheric haze (adjusted for 140m far clip)

    // Camera setup - Near clipping plane set to 0.01 so FPS gun is never clipped!
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01, // Near plane 0.01 prevents weapon clipping
      140 // Optimized render distance (down from 1000)
    );
    this.camera.rotation.order = 'YXZ';

    // CRITICAL THREE.JS FIX: Add Camera to Scene so its children (Weapon Group) are rendered!
    this.scene.add(this.camera);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.generateLateAfternoonHDR();

    // Octree physics container
    this.worldOctree = new Octree();
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    this.initLights();
    
    // Instantiate Modular Terrain Manager (handles platforms, triangular ramps, cover walls, walkways, ladders & ziplines)
    this.terrainManager = new TerrainManager(this, DEFAULT_MAP_CONFIG);

    // Build Octree from environment group
    this.worldOctree.fromGraphNode(this.environmentGroup);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  generateLateAfternoonHDR() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#38bdf8');   // Zenith bright sky blue
    grad.addColorStop(0.4, '#7dd3fc');
    grad.addColorStop(0.7, '#fde047');  // Golden hour horizon
    grad.addColorStop(1.0, '#f97316');  // Sunset warm glow
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(380, 160, 40, 0, Math.PI * 2);
    ctx.fill();

    const hdrTexture = new THREE.CanvasTexture(canvas);
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

    const envMap = this.pmremGenerator.fromEquirectangular(hdrTexture).texture;
    this.scene.environment = envMap;
    hdrTexture.dispose();
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xfff1d0, 1.8);
    this.scene.add(ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffe4a0, 4.5);
    this.sunLight.position.set(35, 30, 20);
    this.sunLight.castShadow = true;
    
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 160;
    
    const d = 50;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 1.2);
    fillLight.position.set(-30, 20, -20);
    this.scene.add(fillLight);
  }

  buildTacticalArena() {
    const gridTexture = this.createGridTexture();
    gridTexture.wrapS = THREE.RepeatWrapping;
    gridTexture.wrapT = THREE.RepeatWrapping;
    gridTexture.repeat.set(80, 80); // Double texture repeats for double floor size

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      map: gridTexture,
      roughness: 0.4,
      metalness: 0.4,
    });

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.5,
      metalness: 0.3,
    });

    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.5,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });

    const addMeshToZone = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.environmentGroup.add(mesh);
    };

    // 1. Ground Floor (160 x 160) — Double length and width
    const floorGeo = new THREE.BoxGeometry(160, 2, 160);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -1, 0);
    addMeshToZone(floor);

    // 2. Outer Perimeter Walls (Double length/width)
    const wallGeoH = new THREE.BoxGeometry(160, 12, 2);
    const wallGeoV = new THREE.BoxGeometry(2, 12, 160);

    const northWall = new THREE.Mesh(wallGeoH, wallMat);
    northWall.position.set(0, 6, -80);
    addMeshToZone(northWall);

    const southWall = new THREE.Mesh(wallGeoH, wallMat);
    southWall.position.set(0, 6, 80);
    addMeshToZone(southWall);

    const westWall = new THREE.Mesh(wallGeoV, wallMat);
    westWall.position.set(-80, 6, 0);
    addMeshToZone(westWall);

    const eastWall = new THREE.Mesh(wallGeoV, wallMat);
    eastWall.position.set(80, 6, 0);
    addMeshToZone(eastWall);

    // 3. Central Platform
    const centerPlatformGeo = new THREE.BoxGeometry(16, 3, 16);
    const centerPlatform = new THREE.Mesh(centerPlatformGeo, platformMat);
    centerPlatform.position.set(0, 1.5, 0);
    addMeshToZone(centerPlatform);

    this.createRamp(0, 1.5, -12, 6, 3, 8, 0, platformMat, addMeshToZone);
    this.createRamp(0, 1.5, 12, 6, 3, 8, Math.PI, platformMat, addMeshToZone);

    // 4. Tactical Cover Blocks (Scattered across expanded map)
    const coverGeo = new THREE.BoxGeometry(3, 3, 3);
    const coverPositions = [
      [-15, 1.5, -15], [15, 1.5, -15],
      [-15, 1.5, 15],  [15, 1.5, 15],
      [-35, 1.5, 0],   [35, 1.5, 0],
      [0, 1.5, -35],   [0, 1.5, 35],
      [-55, 1.5, -35], [55, 1.5, -35],
      [-35, 1.5, 55],  [35, 1.5, 55],
      [-55, 1.5, 55],  [55, 1.5, -55],
    ];

    coverPositions.forEach(([x, y, z]) => {
      const cover = new THREE.Mesh(coverGeo, platformMat);
      cover.position.set(x, y, z);
      addMeshToZone(cover);

      const trimGeo = new THREE.BoxGeometry(3.1, 0.2, 3.1);
      const trim = new THREE.Mesh(trimGeo, accentMat);
      trim.position.set(x, y + 1.5, z);
      addMeshToZone(trim);
    });

    // 5. Pillars (Scattered across expanded map)
    const pillarGeo = new THREE.CylinderGeometry(1.2, 1.2, 12, 16);
    const pillarPositions = [
      [-58, 6, -58], [58, 6, -58],
      [-58, 6, 58],  [58, 6, 58],
      [-28, 6, -28], [28, 6, -28],
      [-28, 6, 28],  [28, 6, 28]
    ];

    pillarPositions.forEach(([x, y, z]) => {
      const pillar = new THREE.Mesh(pillarGeo, wallMat);
      pillar.position.set(x, y, z);
      addMeshToZone(pillar);

      const ringGeo = new THREE.TorusGeometry(1.3, 0.1, 16, 32);
      const ring = new THREE.Mesh(ringGeo, accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 4, z);
      addMeshToZone(ring);
    });
  }

  createRamp(x, y, z, width, height, length, rotationY, material, addFn) {
    const rampGeo = new THREE.BoxGeometry(width, height, length);
    const ramp = new THREE.Mesh(rampGeo, material);
    ramp.position.set(x, y, z);
    ramp.rotation.x = Math.PI / 6;
    ramp.rotation.y = rotationY;
    addFn(ramp);
  }

  createGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 128);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, 0); ctx.lineTo(64, 128);
    ctx.moveTo(0, 64); ctx.lineTo(128, 64);
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
