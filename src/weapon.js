import * as THREE from 'three';
import { sound } from './audio.js';

// Preallocated static vectors
const _targetOffsetZero = new THREE.Vector3(0, 0, 0);

const WEAPON_MATERIAL_CACHE = {
  receiver: new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.85, roughness: 0.25 }),
  barrel: new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.95, roughness: 0.15 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.4, roughness: 0.5 }),
  neon: new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 4.0, metalness: 0.1, roughness: 0.1 }),
  neonPink: new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 4.0, metalness: 0.1, roughness: 0.1 })
};
Object.values(WEAPON_MATERIAL_CACHE).forEach(m => { m._isCached = true; });

// Unified Weapon Blueprints Database
// Easy to read, edit, balance, and add new weapons in the future
export const WEAPON_BLUEPRINTS = {
  weapon_ar15: {
    name: 'COMBAT RIFLE',
    magazineCapacity: 50,
    fireRate: 0.1333, // 450 RPM
    reloadDuration: 1.2,
    baseDamage: 35,
    isSniper: false,
    isShotgun: false,
    spread: 0.015,
    muzzleOffset: new THREE.Vector3(0, 0.04, -0.64),
    restingPosition: new THREE.Vector3(0.24, -0.20, -0.40),
    adsPos: new THREE.Vector3(0, -0.145, -0.28),
    adsFov: 60,
  },
  weapon_pistol: {
    name: 'P-57 PISTOL',
    magazineCapacity: 15,
    fireRate: 0.3, // 200 RPM
    reloadDuration: 0.9,
 baseDamage: 20,
    isSniper: false,
    isShotgun: false,
    spread: 0.01,
    muzzleOffset: new THREE.Vector3(0, 0.02, -0.32),
    restingPosition: new THREE.Vector3(0.20, -0.22, -0.35),
    adsPos: new THREE.Vector3(0, -0.135, -0.22),
    adsFov: 65,
  },
  weapon_sniper: {
    name: 'A-20 SNIPER RIFLE',
    magazineCapacity: 1,
    fireRate: 1.2, // Bolt-action, slow
    reloadDuration: 2.2,
    baseDamage: 75, // Oneshot drone (50 HP), 75% body shot humanoid (100 HP)
    isSniper: true,
    isShotgun: false,
    spread: 0.0, // Scoped is 100% accurate
    muzzleOffset: new THREE.Vector3(0, 0.04, -0.92),
    restingPosition: new THREE.Vector3(0.26, -0.18, -0.50),
    adsPos: new THREE.Vector3(0, -0.140, -0.30),
    adsFov: 30,
  },
  weapon_shotgun: {
    name: 'S-12 SHOTGUN',
    magazineCapacity: 8,
    fireRate: 0.8, // Pump-action
    reloadDuration: 1.8,
    baseDamage: 10, // Per-pellet damage
    isSniper: false,
    isShotgun: true,
    pellets: 12,
    spread: 0.08, // Wide pellet spread cone
    muzzleOffset: new THREE.Vector3(0, 0.04, -0.60),
    restingPosition: new THREE.Vector3(0.24, -0.20, -0.45),
    adsPos: new THREE.Vector3(0, -0.140, -0.26),
    adsFov: 62,
  }
};

export class Weapon {
  constructor(camera) {
    this.camera = camera;

    // Config defaults (will be overwritten dynamically by setWeaponType)
    this.magazineCapacity = 50;
    this.currentAmmo = 50;
    this.isReloading = false;
    this.reloadDuration = 1.2;
    this.reloadTimer = 0;

    this.fireRate = 0.1333;
    this.fireTimer = 0;

    this.muzzleFlashTimer = 0;
    this.fireRateMultiplier = 1.0;
    this.damageMultiplier = 1.0;

    this.recoilOffset = new THREE.Vector3();
    this.recoilRotation = new THREE.Euler();

    this.targetRecoilOffset = new THREE.Vector3();
    this.targetRecoilRotation = new THREE.Euler();

    this.restingPosition = new THREE.Vector3(0.24, -0.20, -0.40);
    this.restingRotation = new THREE.Euler(0, -Math.PI / 40, 0);

    this.stowOffset = new THREE.Vector3(0, 0, 0);
    this.muzzlePoint = new THREE.Vector3(0, 0.04, -0.64);

    // Main Weapon Group attached to camera
    this.weaponGroup = new THREE.Group();
    this.camera.add(this.weaponGroup);

    this.currentWeaponType = 'weapon_ar15';
    this.currentBlueprint = WEAPON_BLUEPRINTS.weapon_ar15;

    // Scoped state
    this.isScoped = false;
    this.scopeProgress = 0.0;

    // Initialize with default AR-15
    this.setWeaponType('weapon_ar15');

    this.isActive = true;
    this.isMeleeActive = false;
  }

  get adsProgress() {
    return this.scopeProgress;
  }

  set adsProgress(val) {
    this.scopeProgress = val;
  }

  setWeaponType(baseId) {
    if (!baseId || !WEAPON_BLUEPRINTS[baseId]) {
      this.currentBlueprint = null;
      this.currentWeaponType = null;
      this.setActive(false);
      return;
    }

    this.currentWeaponType = baseId;
    this.currentBlueprint = WEAPON_BLUEPRINTS[baseId];

    this.magazineCapacity = this.currentBlueprint.magazineCapacity;
    this.fireRate = this.currentBlueprint.fireRate;
    this.reloadDuration = this.currentBlueprint.reloadDuration;
    this.restingPosition.copy(this.currentBlueprint.restingPosition);
    this.currentAmmo = Math.min(this.currentAmmo, this.magazineCapacity);

    // Clean up scoped zoom if switching weapons
    if (this.isScoped) {
      this.isScoped = false;
      this.scopeProgress = 0.0;
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
      const scopeUI = document.getElementById('sniper-scope');
      if (scopeUI) {
        scopeUI.classList.add('hidden');
        scopeUI.style.opacity = 0;
      }
    }

    // Rebuild visual meshes for the new weapon
    this.rebuildWeaponModel(baseId);
    this.setActive(true);
  }

  rebuildWeaponModel(baseId) {
    // Clear & dispose old visual children
    while (this.weaponGroup.children.length > 0) {
      const child = this.weaponGroup.children[0];
      this.weaponGroup.remove(child);
      child.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material && !c.material._isCached) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }

    this.muzzlePoint.copy(this.currentBlueprint.muzzleOffset);

    // Call procedural mesh builder
    this.buildProceduralModel(baseId);

    // Attach lighting & visual muzzle flash planes
    this.createMuzzleFlash();
  }

  buildProceduralModel(baseId) {
    const receiverMat = WEAPON_MATERIAL_CACHE.receiver;
    const barrelMat = WEAPON_MATERIAL_CACHE.barrel;
    const trimMat = WEAPON_MATERIAL_CACHE.trim;
    const neonMat = WEAPON_MATERIAL_CACHE.neon;
    const neonPinkMat = WEAPON_MATERIAL_CACHE.neonPink;

    const addPart = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.weaponGroup.add(mesh);
    };

    if (baseId === 'weapon_pistol') {
      // P-57 Pistol Model (Futuristic Halo-inspired Sidearm)
      // Slide
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.20), receiverMat);
      slide.position.set(0, 0.02, -0.05);
      addPart(slide);

      // Frame & Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.10, 0.045), trimMat);
      grip.position.set(0, -0.05, 0.01);
      grip.rotation.x = Math.PI / 8;
      addPart(grip);

      // Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.15);
      addPart(barrel);

      // Cyber Neon Highlights
      const highlight = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.006, 0.18), neonMat);
      highlight.position.set(0, 0.043, -0.05);
      addPart(highlight);

    } else if (baseId === 'weapon_sniper') {
      // A-20 Sniper Rifle Model (Bolt-action CS AWP inspired)
      // Receiver
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.35), receiverMat);
      rec.position.set(0, 0.02, 0.05);
      addPart(rec);

      // Extra-long Heavy Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.70), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.45);
      addPart(barrel);

      // Futuristic Heavy Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.30), trimMat);
      stock.position.set(0, -0.02, 0.35);
      addPart(stock);

      // Large Sniper Scope Cylinder
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22), receiverMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.09, 0.05);
      addPart(scope);

      const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.08), trimMat);
      scopeMount.position.set(0, 0.06, 0.05);
      addPart(scopeMount);

      // Cyber Neon Highlights
      const barrelNeon = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 8, 16), neonPinkMat);
      barrelNeon.rotation.x = Math.PI / 2;
      barrelNeon.position.set(0, 0.02, -0.50);
      addPart(barrelNeon);

      const scopeNeon = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.005, 0.18), neonPinkMat);
      scopeNeon.position.set(0, 0.112, 0.05);
      addPart(scopeNeon);

    } else if (baseId === 'weapon_shotgun') {
      // S-12 Shotgun Model (SPAS-12 bulky futuristic pump-action)
      // Bulky Receiver
      const rec = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.38), receiverMat);
      rec.position.set(0, 0.02, 0.02);
      addPart(rec);

      // Under-barrel Tubular Magazine
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44), barrelMat);
      magTube.rotation.x = Math.PI / 2;
      magTube.position.set(0, 0.00, -0.32);
      addPart(magTube);

      // Barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.46), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.035, -0.34);
      addPart(barrel);

      // Pump Handle (Movable slide handguard)
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 8), trimMat);
      pump.rotation.x = Math.PI / 2;
      pump.position.set(0, 0.01, -0.28);
      addPart(pump);

      // Rear Stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.24), trimMat);
      stock.position.set(0, -0.01, 0.30);
      addPart(stock);

      // Neon Accent Panels on receiver
      const sidePanelL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.16), neonMat);
      sidePanelL.position.set(-0.033, 0.02, 0.02);
      addPart(sidePanelL);

      const sidePanelR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.16), neonMat);
      sidePanelR.position.set(0.033, 0.02, 0.02);
      addPart(sidePanelR);

    } else {
      // Default: AR-15 Assault Rifle Model
      // Receiver
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 0.18), receiverMat);
      lower.position.set(0, 0, 0);
      addPart(lower);

      // A2 Pistol Grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.05), trimMat);
      grip.position.set(0, -0.09, 0.05);
      grip.rotation.x = Math.PI / 8;
      addPart(grip);

      // Upper Receiver & Picatinny Rail
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.22), receiverMat);
      upper.position.set(0, 0.045, -0.02);
      addPart(upper);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.48), barrelMat);
      rail.position.set(0, 0.082, -0.15);
      addPart(rail);

      // M-LOK Shroud Handguard
      const handguard = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.32, 8), trimMat);
      handguard.rotation.x = Math.PI / 2;
      handguard.position.set(0, 0.04, -0.28);
      addPart(handguard);

      // Extended Barrel & Flash Hider
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.36);
      addPart(barrel);

      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), barrelMat);
      flashHider.rotation.x = Math.PI / 2;
      flashHider.position.set(0, 0.04, -0.61);
      addPart(flashHider);

      // Curved STANAG Mag
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.20, 0.075), barrelMat);
      mag.position.set(0, -0.11, -0.06);
      mag.rotation.x = Math.PI / 10;
      addPart(mag);

      // Crane Stock
      const craneStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), trimMat);
      craneStock.position.set(0, 0.01, 0.24);
      addPart(craneStock);

      // Neon Highlight Rails
      const highlightL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.26), neonMat);
      highlightL.position.set(-0.037, 0.04, -0.28);
      addPart(highlightL);

      const highlightR = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.015, 0.26), neonMat);
      highlightR.position.set(0.037, 0.04, -0.28);
      addPart(highlightR);
    }
  }

  createMuzzleFlash() {
    this.muzzleLight = new THREE.PointLight(0xffe4a0, 0, 6);
    this.muzzleLight.position.copy(this.muzzlePoint);
    this.weaponGroup.add(this.muzzleLight);

    const flashGeo = new THREE.OctahedronGeometry(0.045, 0);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffe4a0,
      transparent: true,
      opacity: 0,
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.copy(this.muzzlePoint);
    this.weaponGroup.add(this.muzzleFlashMesh);
  }

  shoot() {
    if (!this.isActive) return false;
    if (this.isReloading) return false;
    if (this.fireTimer > 0) return false;

    if (this.currentAmmo <= 0) {
      sound.playEmpty();
      this.reload();
      return false;
    }

    this.currentAmmo--;
    this.fireTimer = this.fireRate * this.fireRateMultiplier;

    // Recoil Configuration based on weapon blueprints
    if (this.currentWeaponType === 'weapon_sniper') {
      this.targetRecoilOffset.z += 0.22;
      this.targetRecoilOffset.y += 0.08;
      this.targetRecoilRotation.x += 0.40;
    } else if (this.currentWeaponType === 'weapon_shotgun') {
      this.targetRecoilOffset.z += 0.16;
      this.targetRecoilOffset.y += 0.05;
      this.targetRecoilRotation.x += 0.28;
    } else if (this.currentWeaponType === 'weapon_pistol') {
      this.targetRecoilOffset.z += 0.04;
      this.targetRecoilOffset.y += 0.012;
      this.targetRecoilRotation.x += 0.08;
    } else {
      // AR-15
      this.targetRecoilOffset.z += 0.06;
      this.targetRecoilOffset.y += 0.022;
      this.targetRecoilRotation.x += 0.14;
      this.targetRecoilRotation.y += (Math.random() - 0.5) * 0.03;
    }

    sound.playGunshot();
    this.triggerMuzzleFlash();
    return true;
  }

  triggerMuzzleFlash() {
    this.muzzleFlashTimer = 0.045;
    this.muzzleLight.intensity = 5.5;
    this.muzzleFlashMesh.material.opacity = 0.85;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    const s = Math.random() * 0.5 + 0.85; // Randomize muzzle blast scale (0.85x to 1.35x)
    this.muzzleFlashMesh.scale.set(s, s, s * 1.5);
  }

  reload() {
    if (!this.isActive) return;
    if (this.isReloading || this.currentAmmo === this.magazineCapacity) return;

    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    sound.playReload();
  }

  update(deltaTime, controls) {
    if (!this.isActive) {
      this.weaponGroup.visible = false;
      return;
    }

    // ADS (Aim Down Sights) smooth zoom logic for all weapons
    const isSniper = this.currentBlueprint?.isSniper;
    const wantsScope = controls.rightMouseDown && !this.isReloading;

    if (wantsScope) {
      this.scopeProgress = Math.min(1.0, this.scopeProgress + deltaTime * 6.0); // 0.16s ADS speed
    } else {
      this.scopeProgress = Math.max(0.0, this.scopeProgress - deltaTime * 6.0);
    }

    this.isScoped = this.scopeProgress > 0.05;

    // Calculate camera FOV smoothly based on weapon's adsFov
    const targetFovAngle = this.currentBlueprint?.adsFov || 60;
    const targetFov = THREE.MathUtils.lerp(75, targetFovAngle, this.scopeProgress);
    if (this.camera.fov !== targetFov) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Sniper scope overlay fade-in (ONLY for Sniper Rifle)
    const scopeUI = document.getElementById('sniper-scope');
    if (scopeUI) {
      if (isSniper && this.scopeProgress > 0.90) {
        scopeUI.classList.remove('hidden');
        scopeUI.style.opacity = (this.scopeProgress - 0.90) / 0.10; // Fades in quickly in the last 10%
      } else {
        scopeUI.classList.add('hidden');
        scopeUI.style.opacity = 0;
      }
    }

    // Hide weapon model completely ONLY when sniper optical scope overlay is fully visible
    if (isSniper && this.scopeProgress > 0.95) {
      this.weaponGroup.visible = false;
    } else {
      this.weaponGroup.visible = !this.isMeleeActive;
    }

    if (this.fireTimer > 0) {
      this.fireTimer -= deltaTime;
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= deltaTime;
      const opacity = Math.max(0, this.muzzleFlashTimer / 0.045);
      this.muzzleLight.intensity = 5.5 * opacity;
      this.muzzleFlashMesh.material.opacity = opacity * 0.85;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleLight.intensity = 0;
        this.muzzleFlashMesh.material.opacity = 0;
      }
    }

    if (this.isReloading) {
      this.reloadTimer -= deltaTime;

      const progress = 1 - (this.reloadTimer / this.reloadDuration);
      let stowY = 0;
      let stowZ = 0;
      let reloadRoll = 0;

      if (progress < 0.25) {
        // Lower weapon
        const p = progress / 0.25;
        stowY = -0.25 * p;
        stowZ = 0.08 * p;
        reloadRoll = -Math.PI / 6 * p;
      } else if (progress < 0.75) {
        // Active reloading click movement
        stowY = -0.25;
        stowZ = 0.08;
        reloadRoll = -Math.PI / 6 + Math.sin((progress - 0.25) / 0.5 * Math.PI * 4) * 0.03; // mechanical shake
      } else {
        // Raise weapon
        const p = (progress - 0.75) / 0.25;
        stowY = -0.25 * (1 - p);
        stowZ = 0.08 * (1 - p);
        reloadRoll = -Math.PI / 6 * (1 - p);
      }

      this.stowOffset.set(0, stowY, stowZ);
      this.recoilRotation.z = reloadRoll;

      if (this.reloadTimer <= 0) {
        this.currentAmmo = this.magazineCapacity;
        this.isReloading = false;
        this.stowOffset.set(0, 0, 0);
        this.recoilRotation.z = 0;
      }
    }

    if (controls.keyState.reload && !this.isReloading) {
      this.reload();
    }

    const mouseDelta = controls.getAndResetMouseDelta();
    // Reduce sway when scoped/aimed
    const swayFactor = this.isScoped ? 0.00008 : 0.0003;
    const swayX = -mouseDelta.x * swayFactor;
    const swayY = -mouseDelta.y * swayFactor;

    this.targetRecoilOffset.lerp(_targetOffsetZero, deltaTime * 16);
    this.targetRecoilRotation.x += (0 - this.targetRecoilRotation.x) * deltaTime * 16;
    this.targetRecoilRotation.y += (0 - this.targetRecoilRotation.y) * deltaTime * 16;
    this.targetRecoilRotation.z += (0 - this.targetRecoilRotation.z) * deltaTime * 16;

    this.recoilOffset.lerp(this.targetRecoilOffset, deltaTime * 24);
    this.recoilRotation.x += (this.targetRecoilRotation.x - this.recoilRotation.x) * deltaTime * 24;
    this.recoilRotation.y += (this.targetRecoilRotation.y - this.recoilRotation.y) * deltaTime * 24;
    this.recoilRotation.z += (this.targetRecoilRotation.z - this.recoilRotation.z) * deltaTime * 24;

    // Smoothly translate position and rotation toward center screen for Iron Sights ADS look
    const targetAimPos = this.currentBlueprint?.adsPos || new THREE.Vector3(0, -0.145, -0.28);
    const targetAimRot = new THREE.Euler(0, 0, 0);

    const posX = THREE.MathUtils.lerp(this.restingPosition.x + swayX, targetAimPos.x, this.scopeProgress);
    const posY = THREE.MathUtils.lerp(this.restingPosition.y + swayY + this.stowOffset.y, targetAimPos.y, this.scopeProgress);
    const posZ = THREE.MathUtils.lerp(this.restingPosition.z, targetAimPos.z, this.scopeProgress);

    const rotX = THREE.MathUtils.lerp(this.restingRotation.x + swayY * 0.5, targetAimRot.x, this.scopeProgress);
    const rotY = THREE.MathUtils.lerp(this.restingRotation.y + swayX * 0.5, targetAimRot.y, this.scopeProgress);
    const rotZ = THREE.MathUtils.lerp(this.restingRotation.z + swayX * 0.8, targetAimRot.z, this.scopeProgress);

    this.weaponGroup.position.x = posX + this.recoilOffset.x;
    this.weaponGroup.position.y = posY + this.recoilOffset.y;
    this.weaponGroup.position.z = posZ + this.recoilOffset.z;

    this.weaponGroup.rotation.x = rotX + this.recoilRotation.x;
    this.weaponGroup.rotation.y = rotY + this.recoilRotation.y;
    this.weaponGroup.rotation.z = rotZ + this.recoilRotation.z;
  }

  getMuzzleWorldPosition(outVec) {
    if (!outVec) outVec = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(outVec);
    return outVec;
  }

  setActive(active) {
    this.isActive = active;
    if (this.isScoped && !active) {
      this.isScoped = false;
      this.scopeProgress = 0.0;
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
      const scopeUI = document.getElementById('sniper-scope');
      if (scopeUI) {
        scopeUI.classList.add('hidden');
        scopeUI.style.opacity = 0;
      }
    }
    this.weaponGroup.visible = active && !this.isMeleeActive && !this.isScoped;
    if (!active) {
      this.isReloading = false;
    }
  }
}
