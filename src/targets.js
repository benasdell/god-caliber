import * as THREE from 'three';
import { sound } from './audio.js';
import { ENEMY_REGISTRY } from './enemies/EnemyRegistry.js';
import { SteeringBehaviors } from './enemies/SteeringBehaviors.js';
import { EnemyFactory } from './enemies/EnemyFactory.js';
import { ClusterSpawner } from './enemies/ClusterSpawner.js';

const _forceSeek = new THREE.Vector3();
const _forceArrival = new THREE.Vector3();
const _forceSep = new THREE.Vector3();
const _forceAvoid = new THREE.Vector3();
const _forceStrafe = new THREE.Vector3();
const _forceRepulsion = new THREE.Vector3();
const _forceFlight = new THREE.Vector3();
const _totalForce = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _envSphere = new THREE.Sphere(new THREE.Vector3(), 0.7);

export class TargetManager {
  constructor(scene, worldOctree, uiManager) {
    this.scene = scene;
    this.worldOctree = worldOctree;
    this.uiManager = uiManager;
    this.targets = [];

    this.currentWave = 0;
    this.waveTimer = 30.0;
    this.inIntermission = true;

    this.coverPoints = [
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(-15, 1.5, -15),
      new THREE.Vector3(15, 1.5, -15),
      new THREE.Vector3(-35, 1.5, -35),
      new THREE.Vector3(35, 1.5, -35),
      new THREE.Vector3(-35, 1.5, 35),
      new THREE.Vector3(35, 1.5, 35),
      new THREE.Vector3(0, 1.5, -50),
      new THREE.Vector3(0, 1.5, 50),
      new THREE.Vector3(-50, 1.5, 0),
      new THREE.Vector3(50, 1.5, 0),

      // Landmark POI Cover Points
      new THREE.Vector3(60, 1.5, -60),   // Sniper Outpost
      new THREE.Vector3(-60, -4.0, -60), // Underground Bunker
      new THREE.Vector3(-74, 1.5, 60),   // Warehouse West
      new THREE.Vector3(-46, 1.5, 60),   // Warehouse East
      new THREE.Vector3(60, 1.5, 60),    // CQB Courtyard
      new THREE.Vector3(-85, 1.5, -85),
      new THREE.Vector3(85, 1.5, -85),
      new THREE.Vector3(-85, 1.5, 85),
      new THREE.Vector3(85, 1.5, 85),
    ];
  }

  createEnemyBot(position, idName, type = 'HUMANOID') {
    const bot = EnemyFactory.createEnemy(this.scene, position, idName, type);
    this.targets.push(bot);
    return bot;
  }

  getRandomWaypoint(enemyType) {
    const idx = Math.floor(Math.random() * this.coverPoints.length);
    const wp = this.coverPoints[idx].clone();
    if (enemyType === 'DRONE') {
      wp.y = 4.5 + Math.random() * 2.0;
    } else {
      wp.y = 0.5;
    }
    return wp;
  }

  rollLootDrop(position) {
    if (!this.worldItemManager) return;
    const rand = Math.random();
    if (rand > 0.40) return;

    const roll = Math.random();
    let rarity = 'normal';
    if (roll > 0.92) rarity = 'legendary';
    else if (roll > 0.75) rarity = 'rare';
    else if (roll > 0.45) rarity = 'magic';

    const categories = ['weapon', 'helmet', 'vest', 'gloves'];
    const cat = categories[Math.floor(Math.random() * categories.length)];

    let subType = null;
    if (cat === 'weapon') {
      const weapons = ['weapon_pistol', 'weapon_shotgun', 'weapon_rifle', 'weapon_sniper'];
      subType = weapons[Math.floor(Math.random() * weapons.length)];
    }

    const inv = this.inventoryManager || (window.gameInstance ? window.gameInstance.inventory : null);
    if (!inv) return;

    const itemData = inv.generateRandomItem(subType, rarity);
    if (!itemData) return;

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 8.0,
      3.5 + Math.random() * 2,
      (Math.random() - 0.5) * 8.0
    );

    this.worldItemManager.spawnItem(itemData, position.clone().add(new THREE.Vector3(0, 0.5, 0)), velocity);
  }

  checkBulletHit(bulletSphere, damage = 35) {
    for (const t of this.targets) {
      if (t.isDestroyed) continue;

      if (t.collider.intersectsSphere(bulletSphere)) {
        const isHeadshot = bulletSphere.center.y >= t.position.y + t.headshotMinY;
        const finalDamage = isHeadshot ? damage * 1.5 : damage;

        t.hp -= finalDamage;

        t.group.position.z += 0.08;
        setTimeout(() => {
          if (!t.isDestroyed) t.group.position.copy(t.position);
        }, 60);

        if (t.hp <= 0) {
          t.isDestroyed = true;
          t.respawnTimer = 5.0;
          t.group.visible = false;

          this.rollLootDrop(t.position);

          if (window.gameInstance) {
            window.gameInstance.playerKills = (window.gameInstance.playerKills || 0) + 1;
          }

          if (this.uiManager) {
            const feedText = isHeadshot 
              ? `🎯 HEADSHOT! ELIMINATED ${t.idName} (${t.type})` 
              : `ELIMINATED ${t.idName} (${t.type})`;
            this.uiManager.addKillFeed(feedText);
          }
        } else {
          if (this.uiManager && isHeadshot) {
            this.uiManager.addKillFeed("🎯 CRITICAL HEADSHOT HIT!");
          }
        }

        return t;
      }
    }
    return null;
  }

  update(deltaTime, playerPosition) {
    const gameState = window.gameInstance?.gameState;
    const TARGET_ZONE_POPULATION = gameState ? gameState.targetAICount : 12;
    const activeBots = this.targets.filter(b => !b.isDestroyed);
    const activeBotsCount = activeBots.length;

    // Cleanup dead bots when respawn timer expires
    for (const b of this.targets) {
      if (b.isDestroyed) {
        if (b.respawnTimer === undefined) b.respawnTimer = 4.0;
        b.respawnTimer -= deltaTime;
        if (b.respawnTimer <= 0) {
          this.scene.remove(b.group);
          this.targets = this.targets.filter(t => t !== b);
        }
      }
    }

    // Maintain continuous zone population via Tactical Cluster Spawner (>25m buffer from player)
    if (this.targets.length < TARGET_ZONE_POPULATION) {
      const needed = TARGET_ZONE_POPULATION - this.targets.length;
      const squadCount = Math.min(needed, 4);
      const clusterBots = ClusterSpawner.spawnCluster(EnemyFactory, this.scene, this.worldOctree, playerPosition, this.targets, squadCount);
      this.targets.push(...clusterBots);
    }

    const time = performance.now() * 0.001;

    // --- STEERING PHYSICS & COMBAT AI UPDATE LOOP ---
    for (const b of this.targets) {
      if (b.isDestroyed) continue;

      if (b.attackCooldown > 0) b.attackCooldown -= deltaTime;
      if (playerPosition) b.registerHostileTarget(playerPosition);

      // Periodically switch strafe directions for dynamic movement
      b.strafeTimer = (b.strafeTimer || 3.0) - deltaTime;
      if (b.strafeTimer <= 0) {
        b.strafeTimer = Math.random() * 4.0 + 2.0;
        b.strafeSign = -b.strafeSign;
      }

      // Reset Steering Forces
      _totalForce.set(0, 0, 0);

      if (playerPosition) {
        const distToPlayer = b.position.distanceTo(playerPosition);
        const ranges = b.config ? b.config.ranges : { minStandoff: 12.0, maxStandoff: 25.0 };
        const weights = b.config ? b.config.steering : { wSeek: 1.0, wSeparation: 2.0, wAvoid: 3.0, wStrafe: 1.5, wRepulsion: 4.0 };

        // 1. SEEK / ARRIVAL / FLEE STANCE BASED ON COMBAT DISTANCE BAND
        if (b.type === 'GOLIATH') {
          // Goliath (Melee): Arrival at 2.5m - 3.0m standoff range
          SteeringBehaviors.calcArrival(b, playerPosition, 3.0, _forceArrival);
          _totalForce.addScaledVector(_forceArrival, weights.wArrival || 1.5);
        } else if (b.type === 'HUMANOID') {
          // Humanoid (Ranged): Standoff band 12m - 25m
          if (distToPlayer < ranges.minStandoff) {
            // Player too close -> Flee/Backpedal
            _tempDir.subVectors(b.position, playerPosition).normalize().multiplyScalar(b.speed);
            _totalForce.addScaledVector(_tempDir, 2.0);
          } else if (distToPlayer > ranges.maxStandoff) {
            // Player too far -> Seek
            SteeringBehaviors.calcSeek(b, playerPosition, _forceSeek);
            _totalForce.addScaledVector(_forceSeek, weights.wSeek || 1.0);
          } else {
            // In optimal 12m-25m standoff band -> Dynamic Lateral Strafe
            SteeringBehaviors.calcStrafe(b, playerPosition, b.strafeSign, _forceStrafe);
            _totalForce.addScaledVector(_forceStrafe, weights.wStrafe || 1.8);
          }
        } else if (b.type === 'DRONE') {
          // Drone (Flying): Seek + 3D Flight Arc
          SteeringBehaviors.calcSeek(b, playerPosition, _forceSeek);
          _totalForce.addScaledVector(_forceSeek, weights.wSeek || 1.5);

          const flight = b.config ? b.config.flight : { baseAltitude: 4.5, sineAmplitude: 1.2, sineFrequency: 2.0 };
          SteeringBehaviors.calcFlightAltitude(b, flight.baseAltitude, flight.sineAmplitude, flight.sineFrequency, time, _forceFlight);
          _totalForce.addScaledVector(_forceFlight, 1.0);
        }

        // 2. CROWD SEPARATION (Prevents enemy stacking/clumping)
        SteeringBehaviors.calcSeparation(b, this.targets, 2.5, _forceSep);
        _totalForce.addScaledVector(_forceSep, weights.wSeparation || 2.5);

        // 3. OBSTACLE AVOIDANCE
        SteeringBehaviors.calcObstacleAvoidance(b, this.worldOctree, _forceAvoid);
        _totalForce.addScaledVector(_forceAvoid, weights.wObstacleAvoidance || 3.0);

        // 4. HARD PLAYER CAPSULE REPULSION (Strictly prevents occupying same space as player)
        SteeringBehaviors.calcPlayerRepulsion(b, playerPosition, 2.5, _forceRepulsion);
        _totalForce.addScaledVector(_forceRepulsion, weights.wRepulsion || 4.0);
      }

      // Truncate total steering force to maxForce
      if (_totalForce.lengthSq() > 0.0001) {
        _totalForce.clampLength(0, b.maxForce || 18.0);
        b.velocity.addScaledVector(_totalForce, deltaTime);
        if (b.type !== 'DRONE') b.velocity.y -= 25.0 * deltaTime; // Gravity for ground units
        b.velocity.clampLength(0, b.speed);
      }

      // --- COMBAT ATTACK AI & WEAPON BEHAVIORS ---
      if (playerPosition && !b.isDestroyed) {
        const distToPlayer = b.position.distanceTo(playerPosition);

        // 1. DRONE: Kamikaze Suicidal Run
        if (b.type === 'DRONE') {
          if (distToPlayer <= 1.8) {
            b.isDestroyed = true;
            b.hp = 0;
            b.group.visible = false;
            sound.playImpact();

            if (window.gameInstance && window.gameInstance.player) {
              window.gameInstance.player.takeDamage(45);
              if (window.gameInstance.ui) {
                window.gameInstance.ui.addKillFeed("💥 DRONE KAMIKAZE DETONATED (-45 HP)!");
              }
            }
            continue;
          }
        }
        // 2. GOLIATH: Battleaxe Melee Slash
        else if (b.type === 'GOLIATH') {
          if (distToPlayer <= 2.8 && b.attackCooldown <= 0) {
            b.attackCooldown = 1.5;
            sound.playImpact();
            if (window.gameInstance && window.gameInstance.player) {
              window.gameInstance.player.takeDamage(35);
              if (window.gameInstance.ui) {
                window.gameInstance.ui.addKillFeed("🪓 GOLIATH BATTLEAXE SLASH (-35 HP)!");
              }
            }
          }
        }
        // 3. HUMANOID: Ranged Pistol / Rifle Burst Firing
        else if (b.type === 'HUMANOID') {
          if (distToPlayer <= 30.0 && b.attackCooldown <= 0) {
            const bulletMgr = window.gameInstance ? window.gameInstance.bulletManager : null;
            if (bulletMgr) {
              const origin = b.position.clone().add(new THREE.Vector3(0, 1.2, 0));
              if (b.weaponType === 'PISTOL') {
                b.attackCooldown = 1.2;
                bulletMgr.spawnEnemyProjectile(origin, playerPosition, 12, 50);
                sound.playImpact();
              } else {
                b.attackCooldown = 2.0;
                bulletMgr.spawnEnemyProjectile(origin, playerPosition, 10, 60);
                setTimeout(() => {
                  if (!b.isDestroyed) bulletMgr.spawnEnemyProjectile(origin, playerPosition, 10, 60);
                }, 100);
                setTimeout(() => {
                  if (!b.isDestroyed) bulletMgr.spawnEnemyProjectile(origin, playerPosition, 10, 60);
                }, 200);
                sound.playImpact();
              }
            }
          }
        }
      }

      // Steering orientation towards movement direction
      if (b.velocity.x !== 0 || b.velocity.z !== 0) {
        b.group.rotation.y = Math.atan2(b.velocity.x, b.velocity.z);
      }

      // Step position by velocity
      b.position.x += b.velocity.x * deltaTime;
      b.position.y += b.velocity.y * deltaTime;
      b.position.z += b.velocity.z * deltaTime;

      // Octree terrain collision for ground bots
      if (b.type !== 'DRONE') {
        _envSphere.center.copy(b.position).add(b.colliderOffset);
        _envSphere.radius = b.collisionRadius;
        const colResult = this.worldOctree.sphereIntersect(_envSphere);
        if (colResult) {
          b.position.addScaledVector(colResult.normal, colResult.depth);
          if (colResult.normal.y > 0.3) b.velocity.y = 0;
        }
      } else {
        b.position.y = Math.max(2.5, b.position.y);
      }

      // Sync sphere hit collider and 3D mesh
      b.collider.center.copy(b.position).add(b.colliderOffset);
      b.group.position.copy(b.position);
    }
  }

  spawnSingleZoneBot(type) {
    return this.createEnemyBot(new THREE.Vector3(0, 0.5, 0), `ZoneMob_${Date.now()}`, type);
  }

  startNextWave() {
    this.currentWave++;
    this.inIntermission = false;

    if (window.gameInstance && typeof window.gameInstance.spawnWaveChests === 'function') {
      window.gameInstance.spawnWaveChests();
    }

    this.targets.forEach(b => {
      this.scene.remove(b.group);
    });
    this.targets = [];

    const w = this.currentWave;
    const numHumanoids = 2 + w;
    const numDrones = Math.max(0, w - 1);
    const numGoliaths = Math.max(0, w - 2);

    const playerPos = window.gameInstance && window.gameInstance.player ? window.gameInstance.player.position : null;
    const totalCount = numHumanoids + numDrones + numGoliaths;
    const clusterBots = ClusterSpawner.spawnCluster(EnemyFactory, this.scene, this.worldOctree, playerPos, this.targets, totalCount);
    this.targets.push(...clusterBots);

    sound.playImpact();
    if (this.uiManager) {
      this.uiManager.addKillFeed(`⚠️ WAVE ${w} STARTED! PREPARE FOR ENGAGEMENT.`);
    }
  }
}
