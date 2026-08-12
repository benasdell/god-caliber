import * as THREE from 'three';

const _tempVec = new THREE.Vector3();

// Maximum number of ground items before oldest are garbage-collected.
const MAX_GROUND_ITEMS = 60;

function disposeItemMeshGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry && !child.geometry._isShared) child.geometry.dispose();
      if (child.material && !child.material._isShared) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    }
  });
}

export class WorldItemManager {
  constructor(scene, worldOctree) {
    this.scene = scene;
    this.worldOctree = worldOctree;

    // List of active ground items
    this.groundItems = [];
    this.GRAVITY = 20.0;

    // --- SHARED MATERIALS ---
    this.steelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.2,
    });

    this.polymerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.1,
      roughness: 0.7,
    });

    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.1,
    });

    this.vestMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });

    // --- SHARED GEOMETRIES ---
    this.geo_receiver = new THREE.BoxGeometry(0.1, 0.15, 0.4);
    this.geo_barrel = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    this.geo_mag = new THREE.BoxGeometry(0.05, 0.2, 0.1);
    this.geo_stock = new THREE.BoxGeometry(0.08, 0.12, 0.25);

    this.geo_blade = new THREE.BoxGeometry(0.01, 0.04, 0.3);
    this.geo_guard = new THREE.BoxGeometry(0.04, 0.06, 0.02);
    this.geo_grip = new THREE.CylinderGeometry(0.015, 0.015, 0.15);

    this.geo_dome = new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.geo_visor = new THREE.TorusGeometry(0.185, 0.015, 8, 24);

    this.geo_plate = new THREE.BoxGeometry(0.32, 0.4, 0.14);
    this.geo_strap = new THREE.BoxGeometry(0.06, 0.12, 0.16);
    this.geo_buckle = new THREE.BoxGeometry(0.03, 0.04, 0.16);

    this.geo_glove = new THREE.BoxGeometry(0.1, 0.05, 0.15);
  }

  // Spawn an item in the 3D world
  spawnItem(itemData, position, velocityKick = null) {
    while (this.groundItems.length >= MAX_GROUND_ITEMS) {
      const oldest = this.groundItems.shift();
      disposeItemMeshGroup(oldest.meshGroup);
      this.scene.remove(oldest.meshGroup);
    }

    const group = new THREE.Group();
    group.position.copy(position);

    // Create custom procedural mesh based on item type
    this.buildItemMesh(itemData, group);

    // Add transparent tapering loot beam matching item rarity
    const beam = this.createLootBeam(itemData);
    group.add(beam);

    this.scene.add(group);

    const velocity = velocityKick ? velocityKick.clone() : new THREE.Vector3();

    const groundItem = {
      id: `${itemData.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      itemData: itemData,
      meshGroup: group,
      velocity: velocity,
      collider: new THREE.Sphere(position.clone(), 0.35),
      onGround: false,
    };

    this.groundItems.push(groundItem);
    return groundItem;
  }

  createLootBeam(itemData) {
    const height = 4.35; // 3x standard player height (1.45m * 3)

    // Base thickness depends on rarity
    let radius = 0.06;
    if (itemData.rarity === 'magic') radius = 0.09;
    else if (itemData.rarity === 'rare') radius = 0.13;
    else if (itemData.rarity === 'epic') radius = 0.18;
    else if (itemData.rarity === 'legendary') radius = 0.24;

    const beamGeo = new THREE.ConeGeometry(radius, height, 12, 1, true); // Open-ended cone for tapering cylinder
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(itemData.borderColor || '#64748b'),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(beamGeo, beamMat);
    // Align base of cone at ground: offset center of cone up by height / 2
    mesh.position.set(0, height / 2, 0);
    return mesh;
  }

  buildItemMesh(itemData, group) {
    const addPart = (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    if (itemData.isChest) {
      // Visual: Bulky lockbox with golden panels, steel trim, and front latch
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.45), this.goldMat);
      box.position.set(0, 0.25, 0);
      addPart(box);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.1, 0.49), this.steelMat);
      trim.position.set(0, 0.15, 0);
      addPart(trim);

      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.08), this.steelMat);
      lock.position.set(0, 0.25, 0.235);
      addPart(lock);
    } else if (itemData.type === 'primary') {
      if (itemData.baseId === 'weapon_pistol') {
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.22), this.polymerMat);
        slide.position.set(0, 0.025, 0);
        addPart(slide);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.055), this.polymerMat);
        grip.position.set(0, -0.055, 0.04);
        grip.rotation.x = Math.PI / 8;
        addPart(grip);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.025, -0.11);
        addPart(barrel);

      } else if (itemData.baseId === 'weapon_sniper') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.45), this.polymerMat);
        addPart(body);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.6);
        addPart(barrel);

        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.28), this.steelMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.075, -0.05);
        addPart(scope);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.28), this.polymerMat);
        stock.position.set(0, -0.01, 0.32);
        addPart(stock);

      } else if (itemData.baseId === 'weapon_shotgun') {
        const rec = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.095, 0.44), this.polymerMat);
        addPart(rec);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.58), this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.025, -0.51);
        addPart(barrel);

        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.22), this.goldMat);
        pump.position.set(0, -0.02, -0.32);
        addPart(pump);

        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.10, 0.26), this.polymerMat);
        stock.position.set(0, 0.0, 0.31);
        addPart(stock);

      } else {
        // Default AR-15 / Combat Rifle
        const rec = new THREE.Mesh(this.geo_receiver, this.polymerMat);
        rec.position.set(0, 0.05, 0);
        addPart(rec);

        const barrel = new THREE.Mesh(this.geo_barrel, this.steelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.05, -0.4);
        addPart(barrel);

        const mag = new THREE.Mesh(this.geo_mag, this.steelMat);
        mag.position.set(0, -0.1, -0.05);
        mag.rotation.x = Math.PI / 12;
        addPart(mag);

        const stock = new THREE.Mesh(this.geo_stock, this.polymerMat);
        stock.position.set(0, 0.05, 0.3);
        addPart(stock);
      }

    } else if (itemData.type === 'melee') {
      const blade = new THREE.Mesh(this.geo_blade, this.steelMat);
      blade.position.set(0, 0, -0.05);
      addPart(blade);

      const guard = new THREE.Mesh(this.geo_guard, this.steelMat);
      guard.position.set(0, 0, 0.1);
      addPart(guard);

      const grip = new THREE.Mesh(this.geo_grip, this.polymerMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0, 0, 0.185);
      addPart(grip);

    } else if (itemData.type === 'head') {
      const dome = new THREE.Mesh(this.geo_dome, this.polymerMat);
      dome.position.set(0, 0.05, 0);
      addPart(dome);

      const visor = new THREE.Mesh(this.geo_visor, this.steelMat);
      visor.rotation.x = Math.PI / 2;
      visor.position.set(0, 0.05, 0);
      addPart(visor);

    } else if (itemData.type === 'torso') {
      const plate = new THREE.Mesh(this.geo_plate, this.vestMat);
      plate.position.set(0, 0.2, 0);
      addPart(plate);

      const strapL = new THREE.Mesh(this.geo_strap, this.polymerMat);
      strapL.position.set(-0.11, 0.42, 0);
      addPart(strapL);

      const strapR = new THREE.Mesh(this.geo_strap, this.polymerMat);
      strapR.position.set(0.11, 0.42, 0);
      addPart(strapR);

      const buckleL = new THREE.Mesh(this.geo_buckle, this.goldMat);
      buckleL.position.set(-0.11, 0.28, 0.01);
      addPart(buckleL);

      const buckleR = new THREE.Mesh(this.geo_buckle, this.goldMat);
      buckleR.position.set(0.11, 0.28, 0.01);
      addPart(buckleR);

    } else if (itemData.type === 'gloves') {
      const gloveL = new THREE.Mesh(this.geo_glove, this.polymerMat);
      gloveL.position.set(-0.08, 0.02, 0);
      addPart(gloveL);

      const gloveR = new THREE.Mesh(this.geo_glove, this.polymerMat);
      gloveR.position.set(0.08, 0.02, 0);
      addPart(gloveR);
    }
  }

  update(deltaTime) {
    for (const g of this.groundItems) {
      if (g.onGround) {
        g.meshGroup.rotation.y += deltaTime * 0.5;
        continue;
      }

      g.velocity.y -= this.GRAVITY * deltaTime;

      _tempVec.copy(g.velocity).multiplyScalar(deltaTime);
      g.meshGroup.position.add(_tempVec);
      g.collider.center.copy(g.meshGroup.position);

      const result = this.worldOctree.sphereIntersect(g.collider);
      if (result) {
        g.onGround = true;
        g.velocity.set(0, 0, 0);

        _tempVec.copy(result.normal).multiplyScalar(result.depth);
        g.meshGroup.position.add(_tempVec);
        g.collider.center.copy(g.meshGroup.position);

        g.meshGroup.rotation.set(0, Math.random() * Math.PI, 0);
      }
    }
  }

  getClosestInteractable(playerPosition) {
    let closestItem = null;
    let minDist = 2.5;

    for (const g of this.groundItems) {
      const dist = g.meshGroup.position.distanceTo(playerPosition);
      if (dist < minDist) {
        minDist = dist;
        closestItem = g;
      }
    }

    return closestItem;
  }

  removeItem(groundItem) {
    const idx = this.groundItems.indexOf(groundItem);
    if (idx !== -1) {
      this.groundItems.splice(idx, 1);
    }
    disposeItemMeshGroup(groundItem.meshGroup);
    this.scene.remove(groundItem.meshGroup);
  }
}
