import * as THREE from 'three';
import { EnemyFactory } from '../enemies/EnemyFactory.js';

export class PeerPlayer {
  constructor(scene, id, displayName = 'Player', color = 0x00ffcc) {
    this.scene = scene;
    this.id = id;
    this.displayName = displayName;
    this.hp = 100;
    this.maxHp = 100;
    this.weapon = 'weapon_ar15';
    this.isFiring = false;
    this.lastSnapshotTs = 0;

    this.kills = 0;
    this.deaths = 0;
    this.damageDealt = 0;

    // Create 3D humanoid mesh
    if (typeof EnemyFactory.createHumanoidMesh === 'function') {
      this.mesh = EnemyFactory.createHumanoidMesh(color);
    } else {
      this.mesh = this.createDefaultHumanoidMesh(color);
    }
    this.scene.add(this.mesh);

    // Bounding sphere for bullet raycasting hit detection
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.65);
    this.boundingSphere.center.copy(this.mesh.position).add(new THREE.Vector3(0, 1.0, 0));

    // Target positions for smooth interpolation
    this.targetPosition = new THREE.Vector3(0, 0, 0);
    this.targetYaw = 0;
    this.targetPitch = 0;

    // Nameplate & HP Bar Sprite
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 80;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: this.texture, transparent: true });
    this.nameplate = new THREE.Sprite(spriteMaterial);
    this.nameplate.scale.set(2.2, 0.7, 1.0);
    this.nameplate.position.set(0, 2.3, 0);
    this.mesh.add(this.nameplate);

    this.renderNameplate();
  }

  renderNameplate() {
    const ctx = this.ctx;
    const name = this.displayName;
    const hp = Math.max(0, Math.min(this.maxHp, this.hp));

    ctx.clearRect(0, 0, 256, 80);

    // Card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(8, 6, 240, 68, 8);
      ctx.fill();
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillRect(8, 6, 240, 68);
    }

    // Name text
    ctx.font = 'bold 18px Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 24);

    // Health bar background
    const barX = 24;
    const barY = 44;
    const barW = 208;
    const barH = 12;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();
    } else {
      ctx.fillRect(barX, barY, barW, barH);
    }

    // Health bar fill
    const pct = hp / this.maxHp;
    if (pct > 0) {
      const fillW = Math.max(4, barW * pct);
      const fillColor = pct > 0.5 ? '#00f0ff' : (pct > 0.25 ? '#ffb703' : '#ff2a6d');
      ctx.fillStyle = fillColor;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX, barY, fillW, barH, 4);
        ctx.fill();
      } else {
        ctx.fillRect(barX, barY, fillW, barH);
      }
    }

    // HP Text
    ctx.font = 'bold 10px Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(hp)} / ${this.maxHp}`, 128, barY + barH / 2);

    this.texture.needsUpdate = true;
  }

  updateSnapshot(pos, yaw, pitch, hp, weapon, firing, ts) {
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

    if (hpChanged) {
      this.renderNameplate();
    }
  }

  update(deltaTime) {
    const factor = 1.0 - Math.exp(-20.0 * deltaTime);
    this.mesh.position.lerp(this.targetPosition, factor);
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetYaw, factor);

    if (this.boundingSphere) {
      this.boundingSphere.center.copy(this.mesh.position).add(new THREE.Vector3(0, 1.0, 0));
    }
  }

  createDefaultHumanoidMesh(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 2.0 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), bodyMat);
    head.position.set(0, 1.7, 0);
    group.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.05), visorMat);
    visor.position.set(0, 1.72, 0.2);
    group.add(visor);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.35), bodyMat);
    torso.position.set(0, 1.05, 0);
    group.add(torso);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), bodyMat);
    leftLeg.position.set(-0.16, 0.33, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), bodyMat);
    rightLeg.position.set(0.16, 0.33, 0);
    group.add(rightLeg);

    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.45), armorMat);
    gun.position.set(0.32, 1.1, 0.25);
    group.add(gun);

    return group;
  }

  destroy() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
    }
    if (this.nameplate && this.nameplate.material) {
      this.nameplate.material.dispose();
    }
    if (this.texture) {
      this.texture.dispose();
    }
  }
}

