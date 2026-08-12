import * as THREE from 'three';

/**
 * CharacterRig: Standardized 15-bone joint hierarchy and mesh container.
 * Supports both procedural primitive joint groups and rigged GLTF models.
 */
export class CharacterRig {
  constructor(mode = 'PROCEDURAL', color = 0x00f0ff) {
    this.mode = mode; // 'PROCEDURAL' | 'GLTF'
    this.root = new THREE.Group();
    this.bones = new Map();
    this.meshes = new Map();
    this.hitboxes = new Map();

    if (mode === 'PROCEDURAL') {
      this.buildProceduralSkeleton(color);
    }
  }

  buildProceduralSkeleton(color) {
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.35,
      metalness: 0.25
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.2,
      metalness: 0.8
    });

    const visorMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff
    });

    // Helper for establishing joint group nodes
    const createJointGroup = (name, parent, localPos) => {
      const node = new THREE.Group();
      node.name = name;
      node.position.copy(localPos);
      if (parent) {
        parent.add(node);
      } else {
        this.root.add(node);
      }
      this.bones.set(name, node);
      return node;
    };

    // 15-Bone Joint Hierarchy
    const hips = createJointGroup('Hips', null, new THREE.Vector3(0, 0.85, 0));
    const spine = createJointGroup('Spine', hips, new THREE.Vector3(0, 0.25, 0));
    const chest = createJointGroup('Chest', spine, new THREE.Vector3(0, 0.22, 0));
    const neck = createJointGroup('Neck', chest, new THREE.Vector3(0, 0.20, 0));
    const head = createJointGroup('Head', neck, new THREE.Vector3(0, 0.15, 0));

    const leftShoulder = createJointGroup('LeftShoulder', chest, new THREE.Vector3(-0.24, 0.12, 0));
    const leftArm = createJointGroup('LeftArm', leftShoulder, new THREE.Vector3(-0.16, -0.15, 0));
    const leftHand = createJointGroup('LeftHand', leftArm, new THREE.Vector3(0, -0.28, 0));

    const rightShoulder = createJointGroup('RightShoulder', chest, new THREE.Vector3(0.24, 0.12, 0));
    const rightArm = createJointGroup('RightArm', rightShoulder, new THREE.Vector3(0.16, -0.15, 0));
    const rightHand = createJointGroup('RightHand', rightArm, new THREE.Vector3(0, -0.28, 0));

    const leftLeg = createJointGroup('LeftLeg', hips, new THREE.Vector3(-0.16, -0.10, 0));
    const leftFoot = createJointGroup('LeftFoot', leftLeg, new THREE.Vector3(0, -0.40, 0));

    const rightLeg = createJointGroup('RightLeg', hips, new THREE.Vector3(0.16, -0.10, 0));
    const rightFoot = createJointGroup('RightFoot', rightLeg, new THREE.Vector3(0, -0.40, 0));

    // Attach Procedural Geometries to Joint Nodes
    // Head & Visor
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.30), mat);
    headMesh.position.set(0, 0.08, 0);
    headMesh.castShadow = true;
    head.add(headMesh);
    this.meshes.set('Head', headMesh);

    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.10), visorMat);
    visorMesh.position.set(0, 0.08, 0.12);
    head.add(visorMesh);

    // Torso & Chest Armor
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.50, 0.28), mat);
    torsoMesh.position.set(0, -0.05, 0);
    torsoMesh.castShadow = true;
    chest.add(torsoMesh);
    this.meshes.set('Torso', torsoMesh);

    const armorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.08), armorMat);
    armorPlate.position.set(0, -0.05, 0.14);
    chest.add(armorPlate);

    // Arms
    const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 8), mat);
    leftArmMesh.position.set(0, -0.14, 0);
    leftArmMesh.castShadow = true;
    leftArm.add(leftArmMesh);
    this.meshes.set('LeftArm', leftArmMesh);

    const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.32, 8), mat);
    rightArmMesh.position.set(0, -0.14, 0);
    rightArmMesh.castShadow = true;
    rightArm.add(rightArmMesh);
    this.meshes.set('RightArm', rightArmMesh);

    // Legs
    const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.42, 8), mat);
    leftLegMesh.position.set(0, -0.20, 0);
    leftLegMesh.castShadow = true;
    leftLeg.add(leftLegMesh);
    this.meshes.set('LeftLeg', leftLegMesh);

    const rightLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.42, 8), mat);
    rightLegMesh.position.set(0, -0.20, 0);
    rightLegMesh.castShadow = true;
    rightLeg.add(rightLegMesh);
    this.meshes.set('RightLeg', rightLegMesh);

    // Feet / Boots
    const leftFootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.22), armorMat);
    leftFootMesh.position.set(0, -0.05, 0.05);
    leftFoot.add(leftFootMesh);

    const rightFootMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.22), armorMat);
    rightFootMesh.position.set(0, -0.05, 0.05);
    rightFoot.add(rightFootMesh);
  }

  bindGLTFModel(gltfScene, boneMapping = {}) {
    this.mode = 'GLTF';
    this.root.add(gltfScene);

    const DEFAULT_MAP = {
      Hips: ['mixamorigHips', 'pelvis', 'bip_pelvis'],
      Spine: ['mixamorigSpine', 'spine_01', 'bip_spine'],
      Chest: ['mixamorigSpine1', 'spine_02', 'bip_chest'],
      Neck: ['mixamorigNeck', 'neck_01', 'bip_neck'],
      Head: ['mixamorigHead', 'head', 'bip_head'],
      LeftShoulder: ['mixamorigLeftShoulder', 'clavicle_l'],
      LeftArm: ['mixamorigLeftArm', 'upperarm_l'],
      LeftHand: ['mixamorigLeftHand', 'hand_l'],
      RightShoulder: ['mixamorigRightShoulder', 'clavicle_r'],
      RightArm: ['mixamorigRightArm', 'upperarm_r'],
      RightHand: ['mixamorigRightHand', 'hand_r'],
      LeftLeg: ['mixamorigLeftUpLeg', 'thigh_l'],
      LeftFoot: ['mixamorigLeftFoot', 'foot_l'],
      RightLeg: ['mixamorigRightUpLeg', 'thigh_r'],
      RightFoot: ['mixamorigRightFoot', 'foot_r']
    };

    const map = { ...DEFAULT_MAP, ...boneMapping };
    gltfScene.traverse((node) => {
      for (const [stdName, aliases] of Object.entries(map)) {
        if (aliases.includes(node.name) || node.name === stdName) {
          this.bones.set(stdName, node);
        }
      }
    });
  }

  getBone(name) {
    return this.bones.get(name) || null;
  }

  setHeadVisibility(visible) {
    const headMesh = this.meshes.get('Head');
    if (headMesh) {
      headMesh.visible = visible;
    }
    const headBone = this.getBone('Head');
    if (headBone && this.mode === 'GLTF') {
      headBone.scale.setScalar(visible ? 1.0 : 0.0001);
    }
  }

  dispose() {
    this.root.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }
}
