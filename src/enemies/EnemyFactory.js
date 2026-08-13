import * as THREE from 'three';
import { ENEMY_REGISTRY } from './EnemyRegistry.js';
import { CharacterRig } from '../rigging/CharacterRig.js';
import { ProceduralAnimator } from '../animation/ProceduralAnimator.js';
import { HitboxManager } from '../hitbox/HitboxManager.js';

/**
 * -----------------------------------------------------------------------------
 * 1. STATIC ASSET CACHE & ZERO-ALLOCATION MATERIAL/GEOMETRY POOLING
 * -----------------------------------------------------------------------------
 */

export const GEOMETRY_CACHE = {
  // Head & Visor
  head: new THREE.BoxGeometry(0.36, 0.36, 0.36),
  visor: new THREE.BoxGeometry(0.30, 0.09, 0.06),
  helmetCrest: new THREE.BoxGeometry(0.12, 0.08, 0.38),

  // Torso & Armor Plating
  torso: new THREE.BoxGeometry(0.52, 0.70, 0.32),
  chestPlate: new THREE.BoxGeometry(0.44, 0.48, 0.08),
  backPack: new THREE.BoxGeometry(0.38, 0.50, 0.14),
  shoulderGuard: new THREE.BoxGeometry(0.22, 0.22, 0.22),
  goliathShoulder: new THREE.BoxGeometry(0.35, 0.35, 0.35),
  kneePad: new THREE.BoxGeometry(0.18, 0.16, 0.08),

  // Upper & Lower Limb Segments
  upperArm: new THREE.BoxGeometry(0.15, 0.32, 0.15),
  lowerArm: new THREE.BoxGeometry(0.13, 0.30, 0.13),
  hand: new THREE.BoxGeometry(0.11, 0.12, 0.11),
  upperLeg: new THREE.BoxGeometry(0.19, 0.36, 0.19),
  lowerLeg: new THREE.BoxGeometry(0.16, 0.34, 0.16),
  foot: new THREE.BoxGeometry(0.16, 0.10, 0.26),

  // Articulated Joint Mechanics
  jointSphere: new THREE.SphereGeometry(0.08, 8, 8),
  jointCylinder: new THREE.CylinderGeometry(0.07, 0.07, 0.14, 8),

  // Goliath Heavy Additions
  goliathChest: new THREE.BoxGeometry(0.70, 0.90, 0.45),
  goliathPlate: new THREE.BoxGeometry(0.60, 0.65, 0.12),
  axeHandle: new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8),
  axeBlade: new THREE.BoxGeometry(0.06, 0.55, 0.40),

  // Flying Drone Geometries
  droneCore: new THREE.SphereGeometry(0.36, 12, 12),
  droneVisorRing: new THREE.TorusGeometry(0.32, 0.04, 8, 24),
  droneRotorPod: new THREE.CylinderGeometry(0.16, 0.16, 0.10, 12),
  droneRotorBlade: new THREE.BoxGeometry(0.38, 0.015, 0.05),
  droneFin: new THREE.BoxGeometry(0.04, 0.22, 0.28),

  // First-Person Local 1P Body Geometries
  fpsArmUpper: new THREE.BoxGeometry(0.12, 0.34, 0.12),
  fpsArmLower: new THREE.BoxGeometry(0.10, 0.32, 0.10),
  fpsGlove: new THREE.BoxGeometry(0.09, 0.14, 0.09),

  // Quad Geometry for Billboard Health Bars
  quadPlane: new THREE.PlaneGeometry(1, 1),
};

// Flag geometries as cached so custom disposers preserve shared primitives
Object.values(GEOMETRY_CACHE).forEach(geo => { geo._isCached = true; });

export const MATERIAL_CACHE = {
  bodyObsidian: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.5
  }),
  armorPlate: new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.8,
    roughness: 0.2
  }),
  visorCyan: new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 3.0,
    metalness: 0.1,
    roughness: 0.1
  }),
  visorAmber: new THREE.MeshStandardMaterial({
    color: 0xffb703,
    emissive: 0xffb703,
    emissiveIntensity: 3.0,
    metalness: 0.1,
    roughness: 0.1
  }),
  jointDark: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.3
  }),
  goliathBody: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.7
  }),
  goliathArmor: new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.9,
    roughness: 0.15
  }),
  goliathAmber: new THREE.MeshStandardMaterial({
    color: 0xffb703,
    emissive: 0xffb703,
    emissiveIntensity: 1.5,
    roughness: 0.2
  }),
  droneCoreMat: new THREE.MeshStandardMaterial({
    color: 0x090d16,
    metalness: 0.85,
    roughness: 0.2
  }),
  droneThrusterGlow: new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 4.5,
    roughness: 0.1
  }),
  fpsSuitMat: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.4
  }),
  fpsGloveTrim: new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: 0x00f0ff,
    emissiveIntensity: 2.5,
    roughness: 0.2
  })
};

Object.values(MATERIAL_CACHE).forEach(mat => { mat._isCached = true; });

const PEER_MATERIAL_CACHE = new Map();

export function getPeerPlayerMaterial(hexColor = 0x00ffcc) {
  if (PEER_MATERIAL_CACHE.has(hexColor)) {
    return PEER_MATERIAL_CACHE.get(hexColor);
  }
  const mat = new THREE.MeshStandardMaterial({
    color: hexColor,
    roughness: 0.35,
    metalness: 0.6
  });
  mat._isCached = true;
  PEER_MATERIAL_CACHE.set(hexColor, mat);
  return mat;
}

/**
 * Zero-allocation WebGL object hierarchy disposal utility
 */
export function disposeHierarchy(object, removeSelfFromParent = true) {
  if (!object) return;

  object.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry && !child.geometry._isCached) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            if (!m._isCached) m.dispose();
          });
        } else if (!child.material._isCached) {
          child.material.dispose();
        }
      }
    }
  });

  if (removeSelfFromParent && object.parent) {
    object.parent.remove(object);
  }
}

/**
 * Humanoid Entity Mesh Pooling Engine
 */
export class HumanoidMeshPool {
  constructor() {
    this.pools = {
      HUMANOID: [],
      GOLIATH: [],
      DRONE: [],
      PEER_PLAYER: [],
    };
  }

  get(type = 'HUMANOID', customColor = null) {
    const list = this.pools[type] || this.pools.HUMANOID;
    if (list.length > 0) {
      const mesh = list.pop();
      mesh.visible = true;
      return mesh;
    }
    return ProceduralHumanoidFactory.createMesh(type, customColor);
  }

  release(type = 'HUMANOID', mesh) {
    if (!mesh) return;
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
    const list = this.pools[type] || this.pools.HUMANOID;
    if (list.length < 32) {
      list.push(mesh);
    } else {
      disposeHierarchy(mesh, true);
    }
  }
}

export const GLOBAL_HUMANOID_POOL = new HumanoidMeshPool();

/**
 * -----------------------------------------------------------------------------
 * 2. PROCEDURAL HUMANOID MESH FACTORY & ARCHETYPE BUILDERS
 * -----------------------------------------------------------------------------
 */

export class ProceduralHumanoidFactory {
  /**
   * Main entry point for constructing 3D procedural humanoid entities and variants
   */
  static createMesh(type = 'HUMANOID', colorOrOptions = null) {
    switch (type) {
      case 'GOLIATH':
        return this.buildGoliathMesh();
      case 'DRONE':
        return this.buildDroneMesh();
      case 'PEER_PLAYER':
        return this.buildPeerPlayerMesh(typeof colorOrOptions === 'number' ? colorOrOptions : 0x00ffcc);
      case 'LOCAL_1P_BODY':
        return this.buildLocal1PBodyMesh();
      case 'HUMANOID':
      default:
        return this.buildHumanoidMesh(colorOrOptions);
    }
  }

  /**
   * Constructs complete 3D procedural humanoid geometry hierarchy:
   * (Head, Visor, Torso, Armor, Upper/Lower Arms, Joints, Upper/Lower Legs, Feet)
   */
  static buildHumanoidMesh(color = null) {
    const group = new THREE.Group();
    const bodyMat = color !== null && typeof color === 'number' ? getPeerPlayerMaterial(color) : MATERIAL_CACHE.bodyObsidian;
    const armorMat = MATERIAL_CACHE.armorPlate;
    const visorMat = MATERIAL_CACHE.visorCyan;
    const jointMat = MATERIAL_CACHE.jointDark;

    // --- 1. TORSO & CHEST ARMOR GRAPH ---
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'torsoGroup';
    torsoGroup.position.set(0, 1.05, 0);

    const torsoMesh = new THREE.Mesh(GEOMETRY_CACHE.torso, bodyMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    torsoGroup.add(torsoMesh);

    // Armor Plate
    const plateMesh = new THREE.Mesh(GEOMETRY_CACHE.chestPlate, armorMat);
    plateMesh.position.set(0, 0.04, 0.18);
    plateMesh.castShadow = true;
    torsoGroup.add(plateMesh);

    // Tactical Backpack
    const packMesh = new THREE.Mesh(GEOMETRY_CACHE.backPack, armorMat);
    packMesh.position.set(0, 0.05, -0.22);
    torsoGroup.add(packMesh);

    group.add(torsoGroup);

    // --- 2. HEAD & NEON VISOR GRAPH ---
    const headGroup = new THREE.Group();
    headGroup.name = 'headGroup';
    headGroup.position.set(0, 1.68, 0);

    const headMesh = new THREE.Mesh(GEOMETRY_CACHE.head, bodyMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const visorMesh = new THREE.Mesh(GEOMETRY_CACHE.visor, visorMat);
    visorMesh.position.set(0, 0.02, 0.19);
    headGroup.add(visorMesh);

    const crestMesh = new THREE.Mesh(GEOMETRY_CACHE.helmetCrest, armorMat);
    crestMesh.position.set(0, 0.20, -0.02);
    headGroup.add(crestMesh);

    // Overhead Health Bar Anchor Node
    const barAnchor = new THREE.Object3D();
    barAnchor.name = 'healthBarAnchor';
    barAnchor.position.set(0, 0.42, 0);
    headGroup.add(barAnchor);

    group.add(headGroup);

    // --- 3. UPPER & LOWER ARMS WITH SHOULDER/ELBOW JOINTS ---
    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.name = 'leftArmGroup';
    leftArmGroup.position.set(-0.33, 1.35, 0);

    const shoulderL = new THREE.Mesh(GEOMETRY_CACHE.jointSphere, jointMat);
    leftArmGroup.add(shoulderL);

    const shoulderGuardL = new THREE.Mesh(GEOMETRY_CACHE.shoulderGuard, armorMat);
    shoulderGuardL.position.set(-0.06, 0.04, 0);
    leftArmGroup.add(shoulderGuardL);

    const upperArmL = new THREE.Mesh(GEOMETRY_CACHE.upperArm, bodyMat);
    upperArmL.position.set(-0.04, -0.18, 0);
    upperArmL.castShadow = true;
    leftArmGroup.add(upperArmL);

    const elbowL = new THREE.Mesh(GEOMETRY_CACHE.jointCylinder, jointMat);
    elbowL.position.set(-0.04, -0.34, 0);
    leftArmGroup.add(elbowL);

    const lowerArmL = new THREE.Mesh(GEOMETRY_CACHE.lowerArm, bodyMat);
    lowerArmL.position.set(-0.04, -0.50, 0);
    lowerArmL.castShadow = true;
    leftArmGroup.add(lowerArmL);

    const handL = new THREE.Mesh(GEOMETRY_CACHE.hand, armorMat);
    handL.position.set(-0.04, -0.67, 0);
    leftArmGroup.add(handL);

    group.add(leftArmGroup);

    // Right Arm (Armed)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.name = 'rightArmGroup';
    rightArmGroup.position.set(0.33, 1.35, 0);

    const shoulderR = new THREE.Mesh(GEOMETRY_CACHE.jointSphere, jointMat);
    rightArmGroup.add(shoulderR);

    const shoulderGuardR = new THREE.Mesh(GEOMETRY_CACHE.shoulderGuard, armorMat);
    shoulderGuardR.position.set(0.06, 0.04, 0);
    rightArmGroup.add(shoulderGuardR);

    const upperArmR = new THREE.Mesh(GEOMETRY_CACHE.upperArm, bodyMat);
    upperArmR.position.set(0.04, -0.18, 0);
    upperArmR.castShadow = true;
    rightArmGroup.add(upperArmR);

    const elbowR = new THREE.Mesh(GEOMETRY_CACHE.jointCylinder, jointMat);
    elbowR.position.set(0.04, -0.34, 0);
    rightArmGroup.add(elbowR);

    const lowerArmR = new THREE.Mesh(GEOMETRY_CACHE.lowerArm, bodyMat);
    lowerArmR.position.set(0.04, -0.50, 0.10);
    lowerArmR.rotation.x = -Math.PI / 4;
    lowerArmR.castShadow = true;
    rightArmGroup.add(lowerArmR);

    const handR = new THREE.Mesh(GEOMETRY_CACHE.hand, armorMat);
    handR.position.set(0.04, -0.62, 0.22);
    rightArmGroup.add(handR);

    // Weapon Socket Node with 3D Assault Rifle Model
    const weaponSocket = new THREE.Group();
    weaponSocket.name = 'weaponSocket';
    weaponSocket.position.set(0.04, -0.62, 0.25);

    const rifleGroup = new THREE.Group();
    rifleGroup.name = 'assaultRifle';

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.38), armorMat);
    receiver.castShadow = true;
    rifleGroup.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.40, 8), jointMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.35);
    barrel.castShadow = true;
    rifleGroup.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.08), bodyMat);
    mag.position.set(0, -0.12, 0.08);
    mag.rotation.x = 0.25;
    rifleGroup.add(mag);

    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.12), visorMat);
    scope.position.set(0, 0.08, 0.02);
    rifleGroup.add(scope);

    const muzzleTip = new THREE.Object3D();
    muzzleTip.name = 'muzzleTip';
    muzzleTip.position.set(0, 0.02, 0.58);
    rifleGroup.add(muzzleTip);

    weaponSocket.add(rifleGroup);
    rightArmGroup.add(weaponSocket);

    group.add(rightArmGroup);

    // --- 4. UPPER & LOWER LEGS WITH HIP/KNEE JOINTS & FEET ---
    // Left Leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.name = 'leftLegGroup';
    leftLegGroup.position.set(-0.16, 0.70, 0);

    const hipL = new THREE.Mesh(GEOMETRY_CACHE.jointSphere, jointMat);
    leftLegGroup.add(hipL);

    const upperLegL = new THREE.Mesh(GEOMETRY_CACHE.upperLeg, bodyMat);
    upperLegL.position.set(0, -0.18, 0);
    upperLegL.castShadow = true;
    leftLegGroup.add(upperLegL);

    const kneeL = new THREE.Mesh(GEOMETRY_CACHE.jointCylinder, jointMat);
    kneeL.position.set(0, -0.36, 0);
    leftLegGroup.add(kneeL);

    const kneePadL = new THREE.Mesh(GEOMETRY_CACHE.kneePad, armorMat);
    kneePadL.position.set(0, -0.36, 0.10);
    leftLegGroup.add(kneePadL);

    const lowerLegL = new THREE.Mesh(GEOMETRY_CACHE.lowerLeg, bodyMat);
    lowerLegL.position.set(0, -0.53, 0);
    lowerLegL.castShadow = true;
    leftLegGroup.add(lowerLegL);

    const footL = new THREE.Mesh(GEOMETRY_CACHE.foot, armorMat);
    footL.position.set(0, -0.68, 0.04);
    footL.castShadow = true;
    leftLegGroup.add(footL);

    group.add(leftLegGroup);

    // Right Leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.name = 'rightLegGroup';
    rightLegGroup.position.set(0.16, 0.70, 0);

    const hipR = new THREE.Mesh(GEOMETRY_CACHE.jointSphere, jointMat);
    rightLegGroup.add(hipR);

    const upperLegR = new THREE.Mesh(GEOMETRY_CACHE.upperLeg, bodyMat);
    upperLegR.position.set(0, -0.18, 0);
    upperLegR.castShadow = true;
    rightLegGroup.add(upperLegR);

    const kneeR = new THREE.Mesh(GEOMETRY_CACHE.jointCylinder, jointMat);
    kneeR.position.set(0, -0.36, 0);
    rightLegGroup.add(kneeR);

    const kneePadR = new THREE.Mesh(GEOMETRY_CACHE.kneePad, armorMat);
    kneePadR.position.set(0, -0.36, 0.10);
    rightLegGroup.add(kneePadR);

    const lowerLegR = new THREE.Mesh(GEOMETRY_CACHE.lowerLeg, bodyMat);
    lowerLegR.position.set(0, -0.53, 0);
    lowerLegR.castShadow = true;
    rightLegGroup.add(lowerLegR);

    const footR = new THREE.Mesh(GEOMETRY_CACHE.foot, armorMat);
    footR.position.set(0, -0.68, 0.04);
    footR.castShadow = true;
    rightLegGroup.add(footR);

    group.add(rightLegGroup);

    return group;
  }

  /**
   * Heavy Goliath Archetype Variant (Reinforced armor, 1.5x scale, Battleaxe node)
   */
  static buildGoliathMesh() {
    const group = this.buildHumanoidMesh();

    // Scale up overall hierarchy
    group.scale.set(1.5, 1.5, 1.5);

    // Apply Goliath Heavy Armor & Amber Visor Overrides
    const bodyMat = MATERIAL_CACHE.goliathBody;
    const armorMat = MATERIAL_CACHE.goliathArmor;
    const amberMat = MATERIAL_CACHE.goliathAmber;

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Heavy Goliath Shoulder Pauldrons
    const shoulderL = new THREE.Mesh(GEOMETRY_CACHE.goliathShoulder, armorMat);
    shoulderL.position.set(-0.48, 1.45, 0);
    group.add(shoulderL);

    const shoulderR = new THREE.Mesh(GEOMETRY_CACHE.goliathShoulder, armorMat);
    shoulderR.position.set(0.48, 1.45, 0);
    group.add(shoulderR);

    // 3D Battleaxe Attachment
    const axeGroup = new THREE.Group();
    axeGroup.position.set(0.45, 1.05, 0.25);
    axeGroup.rotation.z = -Math.PI / 4;

    const handle = new THREE.Mesh(GEOMETRY_CACHE.axeHandle, armorMat);
    axeGroup.add(handle);

    const blade = new THREE.Mesh(GEOMETRY_CACHE.axeBlade, amberMat);
    blade.position.set(0.20, 0.45, 0);
    axeGroup.add(blade);

    group.add(axeGroup);

    return group;
  }

  /**
   * Flying Drone Archetype Variant (Core, Visor Ring, 4 Thruster Pods, Rotor Blades)
   */
  static buildDroneMesh() {
    const group = new THREE.Group();
    const coreMat = MATERIAL_CACHE.droneCoreMat;
    const thrusterMat = MATERIAL_CACHE.droneThrusterGlow;
    const armorMat = MATERIAL_CACHE.armorPlate;

    // Central Sphere Core (Named droneCore for CharacterRig bone binding)
    const droneCore = new THREE.Group();
    droneCore.name = 'droneCore';
    droneCore.position.set(0, 0.45, 0);

    const core = new THREE.Mesh(GEOMETRY_CACHE.droneCore, coreMat);
    core.castShadow = true;
    droneCore.add(core);

    // Also register headGroup and torsoGroup aliases for Drone
    const headAlias = new THREE.Object3D(); headAlias.name = 'headGroup'; droneCore.add(headAlias);
    const torsoAlias = new THREE.Object3D(); torsoAlias.name = 'torsoGroup'; droneCore.add(torsoAlias);

    group.add(droneCore);

    // Glowing Visor Ring
    const visorRing = new THREE.Mesh(GEOMETRY_CACHE.droneVisorRing, thrusterMat);
    visorRing.rotation.x = Math.PI / 2;
    visorRing.position.set(0, 0.45, 0.05);
    group.add(visorRing);

    // 4 Rotor Thruster Pods & Spinning Blades
    const podOffsets = [
      [-0.45, 0.45, 0.30],
      [0.45, 0.45, 0.30],
      [-0.45, 0.45, -0.30],
      [0.45, 0.45, -0.30]
    ];

    podOffsets.forEach(([px, py, pz]) => {
      const pod = new THREE.Mesh(GEOMETRY_CACHE.droneRotorPod, armorMat);
      pod.position.set(px, py, pz);
      group.add(pod);

      const blade = new THREE.Mesh(GEOMETRY_CACHE.droneRotorBlade, thrusterMat);
      blade.position.set(px, py + 0.06, pz);
      group.add(blade);

      const fin = new THREE.Mesh(GEOMETRY_CACHE.droneFin, armorMat);
      fin.position.set(px * 0.6, py, pz * 0.6);
      group.add(fin);
    });

    // Health Bar Anchor Node
    const barAnchor = new THREE.Object3D();
    barAnchor.name = 'healthBarAnchor';
    barAnchor.position.set(0, 0.95, 0);
    group.add(barAnchor);

    return group;
  }

  /**
   * Peer Multiplayer Player Archetype
   */
  static buildPeerPlayerMesh(color = 0x00ffcc) {
    return this.buildHumanoidMesh(color);
  }

  /**
   * First-Person Local 1P Body & Arms Model
   */
  static buildLocal1PBodyMesh() {
    const group = new THREE.Group();
    const suitMat = MATERIAL_CACHE.fpsSuitMat;
    const trimMat = MATERIAL_CACHE.fpsGloveTrim;

    // FPS Left Arm
    const armL = new THREE.Mesh(GEOMETRY_CACHE.fpsArmLower, suitMat);
    armL.position.set(-0.24, -0.22, -0.35);
    armL.rotation.set(0.3, 0.2, -0.1);
    group.add(armL);

    const gloveL = new THREE.Mesh(GEOMETRY_CACHE.fpsGlove, trimMat);
    gloveL.position.set(-0.24, -0.36, -0.48);
    group.add(gloveL);

    // FPS Right Arm (Holds weapon)
    const armR = new THREE.Mesh(GEOMETRY_CACHE.fpsArmLower, suitMat);
    armR.position.set(0.24, -0.20, -0.35);
    armR.rotation.set(0.3, -0.2, 0.1);
    group.add(armR);

    const gloveR = new THREE.Mesh(GEOMETRY_CACHE.fpsGlove, trimMat);
    gloveR.position.set(0.24, -0.34, -0.48);
    group.add(gloveR);

    // Lower Body (Torso, Legs, Feet for looking down)
    const lowerBody = new THREE.Group();
    lowerBody.name = 'lowerBody1P';
    lowerBody.position.set(0, -0.85, -0.10);

    const torso1P = new THREE.Mesh(GEOMETRY_CACHE.torso, suitMat);
    lowerBody.add(torso1P);

    const legL1P = new THREE.Mesh(GEOMETRY_CACHE.lowerLeg, suitMat);
    legL1P.position.set(-0.16, -0.45, 0);
    lowerBody.add(legL1P);

    const footL1P = new THREE.Mesh(GEOMETRY_CACHE.foot, trimMat);
    footL1P.position.set(-0.16, -0.62, 0.06);
    lowerBody.add(footL1P);

    const legR1P = new THREE.Mesh(GEOMETRY_CACHE.lowerLeg, suitMat);
    legR1P.position.set(0.16, -0.45, 0);
    lowerBody.add(legR1P);

    const footR1P = new THREE.Mesh(GEOMETRY_CACHE.foot, trimMat);
    footR1P.position.set(0.16, -0.62, 0.06);
    lowerBody.add(footR1P);

    group.add(lowerBody);

    return group;
  }
}

/**
 * -----------------------------------------------------------------------------
 * 3. INSTANCED OVERHEAD BILLBOARD HEALTH BARS (GLSL SHADER & MANAGER)
 * -----------------------------------------------------------------------------
 */

export const HEALTHBAR_BILLBOARD_SHADER = {
  vertexShader: /* glsl */`
    attribute vec3 instancePosition;
    attribute float instanceHpRatio;
    attribute vec2 instanceSize;
    attribute float instanceVisibility;

    varying vec2 vUv;
    varying float vHpRatio;
    varying float vVisibility;

    void main() {
      vUv = uv;
      vHpRatio = clamp(instanceHpRatio, 0.0, 1.0);
      vVisibility = instanceVisibility;

      // Extract spherical camera-facing orientation from view matrix
      vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 cameraUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

      vec3 worldPosition = instancePosition
        + (cameraRight * position.x * instanceSize.x)
        + (cameraUp * position.y * instanceSize.y);

      vec4 mvPosition = viewMatrix * vec4(worldPosition, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */`
    uniform float uTime;
    varying vec2 vUv;
    varying float vHpRatio;
    varying float vVisibility;

    void main() {
      if (vVisibility < 0.5) {
        discard;
      }

      vec2 uv = vUv;

      // 1. Dark Slate Border Frame (#0f172a / #1e293b)
      float borderWidthX = 0.04;
      float borderWidthY = 0.12;

      bool isBorder = uv.x < borderWidthX || uv.x > (1.0 - borderWidthX) ||
                      uv.y < borderWidthY || uv.y > (1.0 - borderWidthY);

      if (isBorder) {
        vec3 borderSlate  = vec3(0.06, 0.09, 0.16); // Slate #0f172a
        vec3 borderAccent = vec3(0.20, 0.27, 0.38); // Slate #334155
        float edgeGlow = smoothstep(0.0, 0.1, uv.y) * smoothstep(1.0, 0.9, uv.y);
        gl_FragColor = vec4(mix(borderSlate, borderAccent, edgeGlow * 0.4), 0.95);
        return;
      }

      // 2. Inner Bar Container Void (#090d16)
      vec2 innerUv = vec2(
        (uv.x - borderWidthX) / (1.0 - 2.0 * borderWidthX),
        (uv.y - borderWidthY) / (1.0 - 2.0 * borderWidthY)
      );

      vec3 voidBg = vec3(0.035, 0.05, 0.085);

      // 3. Dynamic Cyan-Amber-Crimson Gradient Fill based on HP Percentage
      // High HP (> 0.5): Electric Cyan (#00f0ff = vec3(0.0, 0.94, 1.0))
      // Mid HP (0.25 - 0.5): Amber (#ffb703 = vec3(1.0, 0.72, 0.01))
      // Low HP (< 0.25): Crimson (#ff2a6d = vec3(1.0, 0.16, 0.43))
      vec3 cyan    = vec3(0.00, 0.94, 1.00);
      vec3 amber   = vec3(1.00, 0.72, 0.01);
      vec3 crimson = vec3(1.00, 0.16, 0.43);

      vec3 fillColor;
      if (vHpRatio > 0.5) {
        float t = (vHpRatio - 0.5) * 2.0;
        fillColor = mix(amber, cyan, t);
      } else {
        float t = vHpRatio * 2.0;
        fillColor = mix(crimson, amber, t);
      }

      // Dynamic low health pulse
      if (vHpRatio < 0.25) {
        float pulse = 0.75 + 0.25 * sin(uTime * 12.0);
        fillColor *= pulse;
      }

      // Smooth step fill edge along inner horizontal UV
      float fillMask = smoothstep(vHpRatio + 0.005, vHpRatio - 0.005, innerUv.x);

      // Leading edge glow line
      float edgeLine = smoothstep(0.02, 0.0, abs(innerUv.x - vHpRatio)) * step(0.01, vHpRatio);
      vec3 finalColor = mix(voidBg, fillColor, fillMask) + (fillColor * edgeLine * 1.5);

      gl_FragColor = vec4(finalColor, 0.95);
    }
  `
};

export class InstancedHealthBarManager {
  constructor(maxInstances = 128) {
    this.maxInstances = maxInstances;

    // Single Instanced Geometry based on preallocated Quad Plane
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.copy(GEOMETRY_CACHE.quadPlane);

    // Preallocated Float32Array Buffers for zero allocation during render loop
    this.posArray = new Float32Array(maxInstances * 3);
    this.hpArray  = new Float32Array(maxInstances);
    this.sizeArray = new Float32Array(maxInstances * 2);
    this.visArray  = new Float32Array(maxInstances);

    this.posAttribute  = new THREE.InstancedBufferAttribute(this.posArray, 3);
    this.hpAttribute   = new THREE.InstancedBufferAttribute(this.hpArray, 1);
    this.sizeAttribute = new THREE.InstancedBufferAttribute(this.sizeArray, 2);
    this.visAttribute  = new THREE.InstancedBufferAttribute(this.visArray, 1);

    this.geometry.setAttribute('instancePosition', this.posAttribute);
    this.geometry.setAttribute('instanceHpRatio', this.hpAttribute);
    this.geometry.setAttribute('instanceSize', this.sizeAttribute);
    this.geometry.setAttribute('instanceVisibility', this.visAttribute);

    this.material = new THREE.ShaderMaterial({
      vertexShader: HEALTHBAR_BILLBOARD_SHADER.vertexShader,
      fragmentShader: HEALTHBAR_BILLBOARD_SHADER.fragmentShader,
      uniforms: {
        uTime: { value: 0 }
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, maxInstances);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(entities, peerPlayers = [], camera = null, deltaTime = 0.016) {
    this.material.uniforms.uTime.value += deltaTime;

    let index = 0;

    const processEntity = (ent, defaultHeight = 2.15, defaultSize = [1.6, 0.24]) => {
      if (index >= this.maxInstances) return;
      if (!ent || ent.isDestroyed || ent.hp <= 0) return;

      let pos = ent.position;
      if (ent.group && ent.group.position) {
        pos = ent.group.position;
      }

      let yOffset = defaultHeight;
      if (ent.type === 'GOLIATH') yOffset = 3.1;
      else if (ent.type === 'DRONE') yOffset = 1.25;

      const hpRatio = ent.maxHp > 0 ? ent.hp / ent.maxHp : 1.0;

      const i3 = index * 3;
      this.posArray[i3]     = pos.x;
      this.posArray[i3 + 1] = pos.y + yOffset;
      this.posArray[i3 + 2] = pos.z;

      this.hpArray[index] = hpRatio;

      const i2 = index * 2;
      this.sizeArray[i2]     = defaultSize[0];
      this.sizeArray[i2 + 1] = defaultSize[1];

      this.visArray[index] = 1.0;
      index++;
    };

    if (Array.isArray(entities)) {
      for (let i = 0; i < entities.length; i++) {
        processEntity(entities[i]);
      }
    }

    if (Array.isArray(peerPlayers)) {
      for (let i = 0; i < peerPlayers.length; i++) {
        processEntity(peerPlayers[i], 2.45, [1.8, 0.28]);
      }
    }

    // Zero out remaining instances
    for (let i = index; i < this.maxInstances; i++) {
      this.visArray[i] = 0.0;
    }

    this.mesh.count = index;
    this.posAttribute.needsUpdate = true;
    this.hpAttribute.needsUpdate = true;
    this.sizeAttribute.needsUpdate = true;
    this.visAttribute.needsUpdate = true;
  }

  dispose() {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}

/**
 * -----------------------------------------------------------------------------
 * 4. ENEMY FACTORY INTERFACE
 * -----------------------------------------------------------------------------
 */

export class EnemyFactory {
  static createEnemy(scene, position, idName, type = 'HUMANOID') {
    const config = ENEMY_REGISTRY[type] || ENEMY_REGISTRY.HUMANOID;

    // Fetch pooled or build procedural mesh archetype
    const group = GLOBAL_HUMANOID_POOL.get(type, config.color);
    group.position.copy(position);

    if (type === 'GOLIATH') {
      group.scale.set(config.scale.x, config.scale.y, config.scale.z);
    }

    scene.add(group);

    const colliderOffset = new THREE.Vector3(config.colliderOffset.x, config.colliderOffset.y, config.colliderOffset.z);
    const collider = new THREE.Sphere(position.clone().add(colliderOffset), config.colRadius);

    const weaponType = type === 'HUMANOID'
      ? (Math.random() < config.weapon.rifleChance ? 'RIFLE' : 'PISTOL')
      : (type === 'GOLIATH' ? 'BATTLEAXE' : 'KAMIKAZE');

    const characterRig = new CharacterRig('PROCEDURAL', config.color, group);
    const animator = new ProceduralAnimator(characterRig);
    HitboxManager.attachLimbHitboxes(characterRig);

    return {
      idName: idName,
      type: type,
      weaponType: weaponType,
      config: config,
      group: group,
      characterRig: characterRig,
      animator: animator,
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
    return ProceduralHumanoidFactory.createMesh('PEER_PLAYER', color);
  }

  static createLocal1PBody() {
    return ProceduralHumanoidFactory.createMesh('LOCAL_1P_BODY');
  }
}

