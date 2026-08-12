import * as THREE from 'three';
import { ENEMY_REGISTRY } from './EnemyRegistry.js';

export class EnemyFactory {
  /**
   * Constructs an enemy object instance with 3D mesh graph, stats, and collider
   */
  static createEnemy(scene, position, idName, type = 'HUMANOID') {
    const config = ENEMY_REGISTRY[type] || ENEMY_REGISTRY.HUMANOID;
    const group = new THREE.Group();
    group.position.copy(position);

    // Shared Materials
    const bodyMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.4 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 2.0 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

    if (type === 'DRONE') {
      // 3D Flying Drone Mesh
      const coreGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const core = new THREE.Mesh(coreGeo, bodyMat);
      core.position.set(0, 0.45, 0);
      core.castShadow = true;
      group.add(core);

      const visorGeo = new THREE.BoxGeometry(0.28, 0.08, 0.05);
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.45, 0.32);
      group.add(visor);

      const rotorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 8);
      const rotorL = new THREE.Mesh(rotorGeo, armorMat);
      rotorL.position.set(-0.4, 0.45, 0);
      group.add(rotorL);

      const rotorR = new THREE.Mesh(rotorGeo, armorMat);
      rotorR.position.set(0.4, 0.45, 0);
      group.add(rotorR);

    } else {
      // Humanoid or Goliath Mesh
      const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 1.7, 0);
      head.castShadow = true;
      group.add(head);

      const visorGeo = new THREE.BoxGeometry(0.32, 0.1, 0.05);
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 1.72, 0.2);
      group.add(visor);

      const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
      const torso = new THREE.Mesh(torsoGeo, bodyMat);
      torso.position.set(0, 1.05, 0);
      torso.castShadow = true;
      group.add(torso);

      const plateGeo = new THREE.BoxGeometry(0.45, 0.5, 0.05);
      const plate = new THREE.Mesh(plateGeo, armorMat);
      plate.position.set(0, 1.1, 0.18);
      group.add(plate);

      const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
      const leftLeg = new THREE.Mesh(legGeo, bodyMat);
      leftLeg.position.set(-0.16, 0.33, 0);
      leftLeg.castShadow = true;
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, bodyMat);
      rightLeg.position.set(0.16, 0.33, 0);
      rightLeg.castShadow = true;
      group.add(rightLeg);

      if (type === 'GOLIATH') {
        const shoulderGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
        const shoulderL = new THREE.Mesh(shoulderGeo, armorMat);
        shoulderL.position.set(-0.35, 1.35, 0);
        group.add(shoulderL);

        const shoulderR = new THREE.Mesh(shoulderGeo, armorMat);
        shoulderR.position.set(0.35, 1.35, 0);
        group.add(shoulderR);

        // 3D Battleaxe
        const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
        const handle = new THREE.Mesh(handleGeo, armorMat);
        handle.rotation.z = -Math.PI / 4;
        handle.position.set(0.45, 1.1, 0.25);
        group.add(handle);

        const bladeGeo = new THREE.BoxGeometry(0.05, 0.45, 0.35);
        const blade = new THREE.Mesh(bladeGeo, armorMat);
        blade.position.set(0.65, 1.4, 0.3);
        group.add(blade);

        group.scale.set(config.scale.x, config.scale.y, config.scale.z);
      } else if (type === 'HUMANOID') {
        // 3D Gun attached to right arm
        const gunGeo = new THREE.BoxGeometry(0.12, 0.15, 0.45);
        const gun = new THREE.Mesh(gunGeo, armorMat);
        gun.position.set(0.32, 1.1, 0.25);
        group.add(gun);
      }
    }

    scene.add(group);

    const colliderOffset = new THREE.Vector3(config.colliderOffset.x, config.colliderOffset.y, config.colliderOffset.z);
    const collider = new THREE.Sphere(position.clone().add(colliderOffset), config.colRadius);

    const weaponType = type === 'HUMANOID'
      ? (Math.random() < config.weapon.rifleChance ? 'RIFLE' : 'PISTOL')
      : (type === 'GOLIATH' ? 'BATTLEAXE' : 'KAMIKAZE');

    return {
      idName: idName,
      type: type,
      weaponType: weaponType,
      config: config,
      group: group,
      position: position.clone(),
      velocity: new THREE.Vector3(),
      strafeSign: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: Math.random() * 4.0 + 2.0,
      
      collider: collider,
      colliderOffset: colliderOffset,
      headshotMinY: config.headshotMinY,
      collisionRadius: config.colRadius,
      speed: config.speed,
      maxForce: config.maxForce,
      hp: config.hp,
      maxHp: config.hp,
      color: config.color,
      isDestroyed: false,
      respawnTimer: 0,

      // Combat API
      attackCooldown: 0,
      hostileTarget: null,

      canAttack() {
        return !this.isDestroyed && this.attackCooldown <= 0 && this.hostileTarget !== null;
      },

      registerHostileTarget(targetPos) {
        this.hostileTarget = targetPos;
      }
    };
  }

  static createHumanoidMesh(color = 0x00ffcc) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 2.0 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });

    const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 1.7, 0);
    head.castShadow = true;
    group.add(head);

    const visorGeo = new THREE.BoxGeometry(0.32, 0.1, 0.05);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.72, 0.2);
    group.add(visor);

    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.35);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.set(0, 1.05, 0);
    torso.castShadow = true;
    group.add(torso);

    const plateGeo = new THREE.BoxGeometry(0.45, 0.5, 0.05);
    const plate = new THREE.Mesh(plateGeo, armorMat);
    plate.position.set(0, 1.1, 0.18);
    group.add(plate);

    const legGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    const leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.16, 0.33, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.16, 0.33, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const gunGeo = new THREE.BoxGeometry(0.12, 0.15, 0.45);
    const gun = new THREE.Mesh(gunGeo, armorMat);
    gun.position.set(0.32, 1.1, 0.25);
    group.add(gun);

    return group;
  }
}
