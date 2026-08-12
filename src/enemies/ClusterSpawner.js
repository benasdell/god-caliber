import * as THREE from 'three';

const _spawnCheckSphere = new THREE.Sphere(new THREE.Vector3(), 1.5);

export class ClusterSpawner {
  /**
   * Spawns a tactical cluster of 3-4 enemies buffered >25m away from player and clear of obstacles
   */
  static spawnCluster(enemyFactory, scene, worldOctree, playerPos, existingTargets, count = 4) {
    // 16 Candidate Tactical Spawn Zones across 240x240m map & landmarks
    const candidateZones = [
      // Core Arena
      new THREE.Vector3(-45, 0.5, -25),
      new THREE.Vector3(45, 0.5, -25),
      new THREE.Vector3(-45, 0.5, 25),
      new THREE.Vector3(45, 0.5, 25),
      new THREE.Vector3(0, 0.5, -45),
      new THREE.Vector3(0, 0.5, 45),

      // Landmark 1: Sniper Outpost Region (x: 60, z: -60)
      new THREE.Vector3(60, 0.5, -75),
      new THREE.Vector3(75, 0.5, -60),

      // Landmark 2: Underground Bunker Region (x: -60, z: -60)
      new THREE.Vector3(-60, 0.5, -80),
      new THREE.Vector3(-75, 0.5, -60),

      // Landmark 3: Industrial Warehouses Region (x: -60, z: 60)
      new THREE.Vector3(-60, 0.5, 80),
      new THREE.Vector3(-80, 0.5, 60),

      // Landmark 4: CQB Courtyard Region (x: 60, z: 60)
      new THREE.Vector3(60, 0.5, 80),
      new THREE.Vector3(80, 0.5, 60),

      // Outer Perimeter Zones
      new THREE.Vector3(-95, 0.5, 0),
      new THREE.Vector3(95, 0.5, 0),
    ];

    // Filter candidate zones by player distance buffer (>25m away)
    let validZones = candidateZones.filter(z => !playerPos || z.distanceTo(playerPos) >= 25.0);
    if (validZones.length === 0) validZones = candidateZones;

    const baseZone = validZones[Math.floor(Math.random() * validZones.length)];
    const newBots = [];

    // Squad Composition: 2 Humanoids, 1 Goliath, 1 Drone
    const squadTypes = ['HUMANOID', 'HUMANOID', 'GOLIATH', 'DRONE'];

    for (let i = 0; i < count; i++) {
      const type = squadTypes[i % squadTypes.length];
      
      // Scatter within 8m radius of cluster center node
      const scatterOffset = new THREE.Vector3(
        (Math.random() - 0.5) * 8.0,
        type === 'DRONE' ? 4.0 + Math.random() * 2.0 : 0.5,
        (Math.random() - 0.5) * 8.0
      );

      const spawnPos = baseZone.clone().add(scatterOffset);

      // Check Octree obstacle clearance
      if (worldOctree && type !== 'DRONE') {
        _spawnCheckSphere.center.copy(spawnPos).setY(1.0);
        const colResult = worldOctree.sphereIntersect(_spawnCheckSphere);
        if (colResult) {
          spawnPos.addScaledVector(colResult.normal, colResult.depth + 0.5);
        }
      }

      const botId = `Squad_${Date.now()}_${i + 1}`;
      const bot = enemyFactory.createEnemy(scene, spawnPos, botId, type);
      newBots.push(bot);
    }

    return newBots;
  }
}
