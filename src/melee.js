import * as THREE from 'three';
import { sound } from './audio.js';

const _meleeRayOrigin = new THREE.Vector3();
const _meleeRayDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

// Melee States
const MELEE_IDLE = 0;
const MELEE_DRAW = 1;
const MELEE_SWING = 2;
const MELEE_RECOVER = 3;

export class MeleeWeapon {
  constructor(camera) {
    this.camera = camera;

    // State machine
    this.state = MELEE_IDLE;
    this.stateTimer = 0;

    // Timing (seconds)
    this.DRAW_TIME = 0.08;
    this.SWING_TIME = 0.10;
    this.RECOVER_TIME = 0.12;

    // Damage
    this.damage = 50;
    this.damageMultiplier = 1.0;

    // Has the swing raycast already hit this cycle?
    this.hasHitThisSwing = false;

    // Build procedural knife mesh
    this.knifeGroup = new THREE.Group();
    this.createKnifeMesh();

    // Initial hidden state
    this.knifeGroup.visible = false;
    this.camera.add(this.knifeGroup);

    // Resting position (right side, below camera view)
    this.restPosition = new THREE.Vector3(0.22, -0.35, -0.30);
    this.knifeGroup.position.copy(this.restPosition);
  }

  createKnifeMesh() {
    // Materials
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.95,
      roughness: 0.15,
    });

    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.2,
      roughness: 0.8,
    });

    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });

    const addPart = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.knifeGroup.add(mesh);
    };

    // 1. Blade — elongated wedge (tapered via ExtrudeGeometry)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.018, 0.005);
    bladeShape.lineTo(0.018, 0.20);
    bladeShape.lineTo(0, 0.22);       // Tip point
    bladeShape.lineTo(-0.018, 0.20);
    bladeShape.lineTo(-0.018, 0.005);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.003,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 1,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.x = -Math.PI / 2;
    blade.position.set(0, 0.02, -0.04);
    addPart(blade);

    // 2. Guard (crossguard)
    const guardGeo = new THREE.BoxGeometry(0.06, 0.012, 0.02);
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.set(0, 0.015, 0);
    addPart(guard);

    // 3. Grip / Handle
    const gripGeo = new THREE.BoxGeometry(0.024, 0.10, 0.022);
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.04, 0);
    addPart(grip);

    // 4. Grip texture ridges
    for (let i = 0; i < 4; i++) {
      const ridgeGeo = new THREE.BoxGeometry(0.026, 0.004, 0.024);
      const ridge = new THREE.Mesh(ridgeGeo, guardMat);
      ridge.position.set(0, -0.015 + i * -0.02, 0);
      addPart(ridge);
    }

    // 5. Pommel (end cap)
    const pommelGeo = new THREE.BoxGeometry(0.032, 0.015, 0.026);
    const pommel = new THREE.Mesh(pommelGeo, guardMat);
    pommel.position.set(0, -0.10, 0);
    addPart(pommel);
  }

  // Trigger the melee attack
  startMelee() {
    if (this.state !== MELEE_IDLE) return false;
    this.state = MELEE_DRAW;
    this.stateTimer = 0;
    this.hasHitThisSwing = false;
    this.knifeGroup.visible = true;
    return true;
  }

  // Check for hits during swing phase
  checkHit(targetManager) {
    if (this.state !== MELEE_SWING || this.hasHitThisSwing) return null;

    this.camera.getWorldPosition(_meleeRayOrigin);
    this.camera.getWorldDirection(_meleeRayDir);
    _meleeRayDir.normalize();

    if (targetManager && targetManager.targets) {
      for (const t of targetManager.targets) {
        if (t.isDestroyed) continue;

        const dist = _meleeRayOrigin.distanceTo(t.collider.center);
        if (dist <= 2.5) {
          _toTarget.subVectors(t.collider.center, _meleeRayOrigin).normalize();
          const dot = _meleeRayDir.dot(_toTarget);

          if (dot > 0.5) { // Within ~60 degree cone in front
            const finalDamage = this.damage * this.damageMultiplier;
            t.hp -= finalDamage;
            this.hasHitThisSwing = true;

            if (t.hp <= 0) {
              t.isDestroyed = true;
              t.respawnTimer = 5.0;
              t.group.visible = false;
              const tier = t.difficultyTier || (t.type === 'GOLIATH' ? 'Elite' : 'Minion');
              targetManager.rollLootDrop(t.position, tier);
              if (window.gameInstance) {
                window.gameInstance.playerKills = (window.gameInstance.playerKills || 0) + 1;
                if (window.gameInstance.ui) {
                  window.gameInstance.ui.addKillFeed(`🗡️ MELEE ELIMINATED ${t.idName} (${t.type})`);
                }
              }
            }

            return t;
          }
        }
      }
    }

    return null;
  }

  update(deltaTime) {
    if (this.state === MELEE_IDLE) return;

    this.stateTimer += deltaTime;

    switch (this.state) {
      case MELEE_DRAW: {
        const progress = Math.min(1, this.stateTimer / this.DRAW_TIME);
        const y = THREE.MathUtils.lerp(-0.55, -0.10, progress);
        const z = THREE.MathUtils.lerp(-0.25, -0.30, progress);
        this.knifeGroup.position.set(0.22, y, z);
        this.knifeGroup.rotation.set(0, 0, 0);

        if (progress >= 1) {
          this.state = MELEE_SWING;
          this.stateTimer = 0;
          sound.playMeleeSwing();
        }
        break;
      }

      case MELEE_SWING: {
        const progress = Math.min(1, this.stateTimer / this.SWING_TIME);
        const z = THREE.MathUtils.lerp(-0.30, -0.55, progress);
        const y = THREE.MathUtils.lerp(-0.10, -0.15, progress);
        const rotX = THREE.MathUtils.lerp(0, -Math.PI / 3, progress);
        this.knifeGroup.position.set(0.22, y, z);
        this.knifeGroup.rotation.set(rotX, 0, 0);

        if (progress >= 1) {
          this.state = MELEE_RECOVER;
          this.stateTimer = 0;
        }
        break;
      }

      case MELEE_RECOVER: {
        const progress = Math.min(1, this.stateTimer / this.RECOVER_TIME);
        const y = THREE.MathUtils.lerp(-0.15, -0.55, progress);
        const rotX = THREE.MathUtils.lerp(-Math.PI / 3, 0, progress);
        this.knifeGroup.position.set(0.22, y, -0.55);
        this.knifeGroup.rotation.set(rotX, 0, 0);

        if (progress >= 1) {
          this.state = MELEE_IDLE;
          this.stateTimer = 0;
          this.knifeGroup.visible = false;
          this.knifeGroup.position.copy(this.restPosition);
          this.knifeGroup.rotation.set(0, 0, 0);
        }
        break;
      }
    }
  }

  get isActive() {
    return this.state !== MELEE_IDLE;
  }
}
