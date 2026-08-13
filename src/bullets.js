import * as THREE from 'three';
import { sound } from './audio.js';
import { HitboxManager } from './hitbox/HitboxManager.js';

const _tempStep = new THREE.Vector3();
const _scratchRay = new THREE.Ray();
const _scratchHitPoint = new THREE.Vector3();
const _scratchCheckPoint = new THREE.Vector3();

export class BulletManager {
  constructor(scene, worldOctree) {
    this.scene = scene;
    this.worldOctree = worldOctree;

    // Bullet Pool (Capacity: 60)
    this.bulletPoolSize = 60;
    this.bulletPool = [];

    // Shared sphere geometry & glowing material
    const bulletGeo = new THREE.SphereGeometry(0.012, 6, 6);
    const bulletMat = new THREE.MeshStandardMaterial({
      color: 0xffcc44,
      emissive: 0xffcc44,
      emissiveIntensity: 3.0,
      metalness: 0.9,
      roughness: 0.1,
    });

    for (let i = 0; i < this.bulletPoolSize; i++) {
      const mesh = new THREE.Mesh(bulletGeo, bulletMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.bulletPool.push({
        mesh: mesh,
        collider: new THREE.Sphere(new THREE.Vector3(), 0.012),
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 3.0,
        active: false,
        isEnemy: false,
      });
    }

    // Enemy Red Bullet Pool (Capacity: 30)
    this.enemyBulletPoolSize = 30;
    this.enemyBulletPool = [];

    const enemyBulletGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const enemyBulletMat = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      emissive: 0xff0000,
      emissiveIntensity: 4.0,
      roughness: 0.1,
    });

    for (let i = 0; i < this.enemyBulletPoolSize; i++) {
      const mesh = new THREE.Mesh(enemyBulletGeo, enemyBulletMat);
      mesh.visible = false;
      this.scene.add(mesh);

      this.enemyBulletPool.push({
        mesh: mesh,
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 3.0,
        damage: 12,
        active: false,
      });
    }

    // Spark Pool (Capacity: 40)
    this.sparkPoolSize = 40;
    this.sparkPool = [];

    const sparkCount = 20;
    const sparkPos = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount * 3; i++) {
      sparkPos[i] = (Math.random() - 0.5) * 0.4;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));

    for (let i = 0; i < this.sparkPoolSize; i++) {
      const mat = new THREE.PointsMaterial({
        color: 0x00f0ff,
        size: 0.08,
        transparent: true,
        opacity: 0,
      });
      const pMesh = new THREE.Points(sparkGeo, mat);
      pMesh.visible = false;
      this.scene.add(pMesh);

      this.sparkPool.push({
        mesh: pMesh,
        lifetime: 0,
        maxLifetime: 0.3,
        active: false,
      });
    }

    // Tracer Pool for instant hitscan visual feedback (Capacity: 20)
    this.tracerPoolSize = 20;
    this.tracerPool = [];

    for (let i = 0; i < this.tracerPoolSize; i++) {
      const lineGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 vertices * 3 coords
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0,
        linewidth: 2.0,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.visible = false;
      this.scene.add(line);

      this.tracerPool.push({
        mesh: line,
        lifetime: 0,
        maxLifetime: 0.15,
        active: false,
      });
    }
  }

  spawnTracer(startPos, endPos, colorHex = 0x00f0ff) {
    const t = this.tracerPool.find(item => !item.active);
    if (!t) return;

    t.active = true;
    t.lifetime = 0;

    const positions = new Float32Array([
      startPos.x, startPos.y, startPos.z,
      endPos.x, endPos.y, endPos.z
    ]);
    t.mesh.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    t.mesh.geometry.attributes.position.needsUpdate = true;
    t.mesh.material.color.setHex(colorHex);
    t.mesh.material.opacity = 0.8;
    t.mesh.visible = true;
  }

  spawnBullet(startPos, direction, damage = 35, speed = 130, targetManager = null, uiManager = null) {
    const actualTargetManager = targetManager || (window.gameInstance ? window.gameInstance.targetManager : null);
    const actualUiManager = uiManager || (window.gameInstance ? window.gameInstance.ui : null);

    _scratchRay.set(startPos, direction);
    const envHit = this.worldOctree.rayIntersect(_scratchRay);

    let hitDist = Infinity;
    const hitPoint = _scratchHitPoint.copy(startPos).addScaledVector(direction, 120);
    let hitBot = null;

    if (envHit) {
      hitPoint.copy(envHit.position);
      hitDist = startPos.distanceTo(envHit.position);
    }

    const netManager = window.gameInstance?.network;
    let hitPeer = null;

    let hitLimbResult = null;

    if (actualTargetManager) {
      for (const bot of actualTargetManager.targets) {
        if (bot.isDestroyed) continue;
        const botPos = bot.position || bot.group?.position;
        if (bot.characterRig && botPos) {
          const isGoliath = bot.type === 'GOLIATH';
          const limbHit = HitboxManager.raycastEntity(_scratchRay, botPos, bot.characterRig, isGoliath);
          if (limbHit && limbHit.distance < hitDist) {
            hitDist = limbHit.distance;
            hitPoint.copy(limbHit.point);
            hitBot = bot;
            hitPeer = null;
            hitLimbResult = limbHit;
          } else if (!limbHit && bot.collider && _scratchRay.intersectSphere(bot.collider, _scratchCheckPoint)) {
            const dist = startPos.distanceTo(_scratchCheckPoint);
            if (dist < hitDist) {
              hitDist = dist;
              hitPoint.copy(_scratchCheckPoint);
              hitBot = bot;
              hitPeer = null;
              hitLimbResult = null;
            }
          }
        } else if (bot.collider && _scratchRay.intersectSphere(bot.collider, _scratchCheckPoint)) {
          const dist = startPos.distanceTo(_scratchCheckPoint);
          if (dist < hitDist) {
            hitDist = dist;
            hitPoint.copy(_scratchCheckPoint);
            hitBot = bot;
            hitPeer = null;
            hitLimbResult = null;
          }
        }
      }
    }

    if (netManager && netManager.peerPlayers) {
      netManager.peerPlayers.forEach((peer) => {
        if (peer.hp > 0) {
          if (peer.characterRig) {
            const limbHit = HitboxManager.raycastEntity(_scratchRay, peer.mesh.position, peer.characterRig);
            if (limbHit && limbHit.distance < hitDist) {
              hitDist = limbHit.distance;
              hitPoint.copy(limbHit.point);
              hitBot = null;
              hitPeer = peer;
              hitLimbResult = limbHit;
            }
          } else if (peer.boundingSphere && _scratchRay.intersectSphere(peer.boundingSphere, _scratchCheckPoint)) {
            const dist = startPos.distanceTo(_scratchCheckPoint);
            if (dist < hitDist) {
              hitDist = dist;
              hitPoint.copy(_scratchCheckPoint);
              hitBot = null;
              hitPeer = peer;
              hitLimbResult = null;
            }
          }
        }
      });
    }

    // Spawn instant laser tracer beam
    this.spawnTracer(startPos, hitPoint, 0x00f0ff);

    // Also broadcast bullet_fire RPC to network peers so they see our tracer
    if (netManager && netManager.isConnected) {
      netManager.broadcast({
        type: 'bullet_fire',
        startPos: [startPos.x, startPos.y, startPos.z],
        hitPoint: [hitPoint.x, hitPoint.y, hitPoint.z]
      });
    }

    // Handle hit feedback for Remote Peer Player
    if (hitPeer) {
      const isHeadshot = hitLimbResult ? hitLimbResult.isHeadshot : (hitPoint.y >= hitPeer.mesh.position.y + 1.4);
      const mult = hitLimbResult ? hitLimbResult.multiplier : (isHeadshot ? 2.5 : 1.0);
      const finalDmg = Math.round(damage * mult);

      if (actualUiManager) {
        actualUiManager.spawnDamageNumber(finalDmg, hitPoint, isHeadshot);
        actualUiManager.triggerHitmarker();
      }
      sound.playHit();

      if (window.gameInstance) {
        window.gameInstance.playerDamageDealt = (window.gameInstance.playerDamageDealt || 0) + finalDmg;
      }

      if (netManager && netManager.isConnected) {
        netManager.broadcast({
          type: 'hit',
          target: hitPeer.id,
          attacker: netManager.peer?.id || 'local',
          attackerName: netManager.playerName || 'Player',
          damage: finalDmg,
          isHeadshot: isHeadshot,
          limb: hitLimbResult ? hitLimbResult.limbZone : 'TORSO'
        });
      }

      this.triggerSpark(hitPoint, 0x00ffcc);
    } else if (hitBot) {
      const isHeadshot = hitLimbResult ? hitLimbResult.isHeadshot : (hitPoint.y >= hitBot.position.y + hitBot.headshotMinY);
      const mult = hitLimbResult ? hitLimbResult.multiplier : (isHeadshot ? 2.5 : 1.0);
      const finalDmg = Math.round(damage * mult);

      hitBot.hp -= finalDmg;

      // Flinch reaction
      hitBot.group.position.z += 0.08;
      setTimeout(() => {
        if (!hitBot.isDestroyed) hitBot.group.position.copy(hitBot.position);
      }, 60);

      // Spawn damage indicators
      if (actualUiManager) {
        actualUiManager.spawnDamageNumber(finalDmg, hitPoint, isHeadshot);
        actualUiManager.triggerHitmarker();
      }
      sound.playHit();

      // Track local damage dealt
      if (window.gameInstance) {
        window.gameInstance.playerDamageDealt = (window.gameInstance.playerDamageDealt || 0) + finalDmg;
      }

      // Check destruction
      if (hitBot.hp <= 0) {
        hitBot.isDestroyed = true;
        hitBot.respawnTimer = 5.0;
        hitBot.group.visible = false;
        if (actualTargetManager) actualTargetManager.rollLootDrop(hitBot.position);

        if (window.gameInstance) {
          window.gameInstance.playerKills = (window.gameInstance.playerKills || 0) + 1;
        }

        if (actualUiManager) {
          const feedText = isHeadshot 
            ? `🎯 HEADSHOT! ELIMINATED ${hitBot.idName} (${hitBot.type})` 
            : `ELIMINATED ${hitBot.idName} (${hitBot.type})`;
          actualUiManager.addKillFeed(feedText);
        }
      } else {
        if (actualUiManager && isHeadshot) {
          actualUiManager.addKillFeed("🎯 CRITICAL HEADSHOT HIT!");
        }
      }

      this.triggerSpark(hitPoint, hitBot.color || 0xff2a6d);
    } else {
      // Hit environment
      sound.playImpact();
      this.triggerSpark(hitPoint, 0x00f0ff);
    }
  }

  update(deltaTime, targetManager, uiManager) {
    // 1. Update Active Pooled Bullets
    for (let i = 0; i < this.bulletPoolSize; i++) {
      const b = this.bulletPool[i];
      if (!b.active) continue;

      b.lifetime += deltaTime;

      if (b.lifetime >= b.maxLifetime) {
        this.deactivateBullet(b);
        continue;
      }

      _tempStep.copy(b.velocity).multiplyScalar(deltaTime);
      b.mesh.position.add(_tempStep);
      b.collider.center.copy(b.mesh.position);

      // Check Target Dummy Collisions
      if (targetManager) {
        const hitTarget = targetManager.checkBulletHit(b.collider, b.damage);
        if (hitTarget) {
          sound.playHit();
          uiManager.triggerHitmarker();

          // Calculate headshot locally to trigger correct floating damage UI
          const isHeadshot = b.collider.center.y >= hitTarget.position.y + hitTarget.headshotMinY;
          const finalDmg = isHeadshot ? b.damage * 1.5 : b.damage;

          uiManager.spawnDamageNumber(finalDmg, b.collider.center, isHeadshot);

          this.triggerSpark(b.mesh.position, hitTarget.color || 0xff2a6d);
          this.deactivateBullet(b);
          continue;
        }
      }

      // Check Octree Environment
      const colResult = this.worldOctree.sphereIntersect(b.collider);
      if (colResult) {
        sound.playImpact();
        this.triggerSpark(b.mesh.position, 0x00f0ff);
        this.deactivateBullet(b);
      }
    }

    // 2. Update Active Enemy Red Bullets
    if (window.gameInstance && window.gameInstance.player) {
      const player = window.gameInstance.player;
      for (let i = 0; i < this.enemyBulletPoolSize; i++) {
        const eb = this.enemyBulletPool[i];
        if (!eb.active) continue;

        eb.lifetime += deltaTime;
        if (eb.lifetime >= eb.maxLifetime) {
          eb.active = false;
          eb.mesh.visible = false;
          continue;
        }

        _tempStep.copy(eb.velocity).multiplyScalar(deltaTime);
        eb.mesh.position.add(_tempStep);

        // Player proximity hit check
        const distToPlayer = eb.mesh.position.distanceTo(player.camera.position);
        if (distToPlayer < 0.85) {
          player.takeDamage(eb.damage);
          sound.playImpact();
          this.triggerSpark(eb.mesh.position, 0xff0000);
          eb.active = false;
          eb.mesh.visible = false;
        }
      }
    }

    // 3. Update Active Pooled Sparks
    for (let i = 0; i < this.sparkPoolSize; i++) {
      const s = this.sparkPool[i];
      if (!s.active) continue;

      s.lifetime += deltaTime;
      const opacity = Math.max(0, 1 - (s.lifetime / s.maxLifetime));
      s.mesh.material.opacity = opacity;

      if (s.lifetime >= s.maxLifetime) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    // 3. Update Active Pooled Tracers
    for (let i = 0; i < this.tracerPoolSize; i++) {
      const t = this.tracerPool[i];
      if (!t.active) continue;

      t.lifetime += deltaTime;
      const opacity = Math.max(0, 0.8 * (1 - (t.lifetime / t.maxLifetime)));
      t.mesh.material.opacity = opacity;

      if (t.lifetime >= t.maxLifetime) {
        t.active = false;
        t.mesh.visible = false;
      }
    }
  }

  triggerSpark(position, colorHex) {
    const s = this.sparkPool.find(item => !item.active);
    if (!s) return;

    s.active = true;
    s.lifetime = 0;
    s.mesh.position.copy(position);
    s.mesh.material.color.setHex(colorHex);
    s.mesh.material.opacity = 1.0;
    s.mesh.visible = true;
  }

  deactivateBullet(b) {
    b.active = false;
    b.mesh.visible = false;
  }

  spawnEnemyProjectile(originPos, targetPos, damage = 12, speed = 45) {
    let eb = this.enemyBulletPool.find(item => !item.active);
    if (!eb) eb = this.enemyBulletPool[0];

    eb.active = true;
    eb.lifetime = 0;
    eb.damage = damage;
    eb.mesh.position.copy(originPos);
    eb.mesh.visible = true;

    // Apply natural enemy aim variance / spread (~5-7 degrees offset) so player can dodge and survive direct fights
    const distToTarget = originPos.distanceTo(targetPos);
    const spreadAmount = 0.14 * Math.min(distToTarget, 25.0);
    const aimTarget = targetPos.clone().add(new THREE.Vector3(
      (Math.random() - 0.5) * spreadAmount,
      (Math.random() - 0.5) * spreadAmount * 0.6,
      (Math.random() - 0.5) * spreadAmount
    ));

    const dir = new THREE.Vector3().subVectors(aimTarget, originPos).normalize();
    eb.velocity.copy(dir).multiplyScalar(speed);

    // Spawn visual red tracer
    this.spawnTracer(originPos, originPos.clone().add(dir.multiplyScalar(2)), 0xff0000);
  }
}
