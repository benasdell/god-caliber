import * as THREE from 'three';
import { EnemyFactory, disposeHierarchy, GLOBAL_HUMANOID_POOL } from '../enemies/EnemyFactory.js';
import { CharacterRig } from '../rigging/CharacterRig.js';
import { ProceduralAnimator } from '../animation/ProceduralAnimator.js';
import { HitboxManager } from '../hitbox/HitboxManager.js';

export class PeerPlayer {
  constructor(scene, id, displayName = 'Player', color = 0x00ffcc) {
    this.scene = scene;
    this.id = id;
    this.displayName = displayName;
    this.color = color;
    this.hp = 100;
    this.maxHp = 100;
    this.weapon = 'weapon_ar15';
    this.isFiring = false;
    this.speedMultiplier = 1.0;
    this.boots = null;
    this.lastSnapshotTs = 0;

    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;

    // Create 3D humanoid character rig
    this.characterRig = new CharacterRig('PROCEDURAL', color);
    this.animator = new ProceduralAnimator(this.characterRig);
    HitboxManager.attachLimbHitboxes(this.characterRig);

    this.mesh = this.characterRig.root;
    this.scene.add(this.mesh);

    // Bounding sphere for broadphase bullet raycasting hit detection
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.65);
    this.boundingSphere.center.copy(this.mesh.position).add(new THREE.Vector3(0, 1.0, 0));

    // Target positions for smooth interpolation
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Nameplate & HP Bar Sprite
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.spriteMaterial = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.nameplate = new THREE.Sprite(this.spriteMaterial);
    this.nameplate.position.set(0, 2.1, 0);
    this.nameplate.scale.set(1.5, 0.375, 1.0);
    this.mesh.add(this.nameplate);

    this.renderNameplate();
  }

  renderNameplate() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 256, 64);

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.roundRect(10, 8, 236, 48, 8);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.roundRect(10, 8, 236, 48, 8);
    ctx.stroke();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.displayName, 128, 28);

    // Health Bar Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(24, 36, 208, 12);

    // Health Bar Fill
    const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    ctx.fillStyle = hpRatio > 0.5 ? '#00f0ff' : (hpRatio > 0.25 ? '#ffb703' : '#ff2a6d');
    ctx.fillRect(24, 36, 208 * hpRatio, 12);

    this.texture.needsUpdate = true;
  }

  updateSnapshot(pos, yaw, pitch, hp, weapon, firing, ts, boots = null, speedMultiplier = 1.0) {
    if (ts !== undefined && ts !== null) {
      if (ts < this.lastSnapshotTs) {
        return;
      }
      this.lastSnapshotTs = ts;
    }

    if (pos && pos.length >= 3) {
      this.targetPosition.set(pos[0], pos[1], pos[2]);
    }
    if (yaw !== undefined && yaw !== null) {
      this.targetYaw = yaw;
    }
    if (pitch !== undefined && pitch !== null) {
      this.targetPitch = pitch;
    }

    let hpChanged = false;
    if (hp !== undefined && hp !== null && hp !== this.hp) {
      this.hp = hp;
      hpChanged = true;
    }

    if (weapon !== undefined && weapon !== null) {
      this.weapon = weapon;
    }

    if (firing !== undefined && firing !== null) {
      this.isFiring = Boolean(firing);
    }

    if (boots !== undefined && boots !== null) {
      this.boots = boots;
    }

    if (speedMultiplier !== undefined && speedMultiplier !== null && typeof speedMultiplier === 'number') {
      this.speedMultiplier = speedMultiplier;
    }

    if (hpChanged) {
      this.renderNameplate();
    }
  }

  update(deltaTime) {
    const factor = 1.0 - Math.exp(-20.0 * deltaTime);
    
    // Estimate velocity for procedural animation gait
    const prevPos = this.mesh.position.clone();
    this.mesh.position.lerp(this.targetPosition, factor);
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetYaw, factor);

    const estVelocity = this.mesh.position.clone().sub(prevPos).divideScalar(Math.max(0.001, deltaTime));

    if (this.animator) {
      this.animator.update(deltaTime, estVelocity, true, false, false, this.isFiring, this.speedMultiplier);
    }

    if (this.boundingSphere) {
      this.boundingSphere.center.copy(this.mesh.position).add(new THREE.Vector3(0, 1.0, 0));
    }
  }

  destroy() {
    if (this.nameplate && this.nameplate.material) {
      this.nameplate.material.dispose();
    }
    if (this.texture) {
      this.texture.dispose();
    }
    if (this.mesh && this.scene) {
      GLOBAL_HUMANOID_POOL.release('PEER_PLAYER', this.mesh);
      this.scene.remove(this.mesh);
    }
  }
}


