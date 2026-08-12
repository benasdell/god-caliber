import * as THREE from 'three';

// Preallocated scratch vectors for zero-allocation performance
const _desired = new THREE.Vector3();
const _steering = new THREE.Vector3();
const _tempAway = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _envSphere = new THREE.Sphere(new THREE.Vector3(), 0.7);

export class SteeringBehaviors {
  /**
   * Craig Reynolds Seek Steering Force
   */
  static calcSeek(bot, targetPos, forceOut) {
    forceOut.subVectors(targetPos, bot.position);
    if (forceOut.lengthSq() > 0.0001) {
      forceOut.normalize().multiplyScalar(bot.speed);
      forceOut.sub(bot.velocity);
    }
  }

  /**
   * Craig Reynolds Arrival Steering Force (Decelerates smoothly within slowingRadius)
   */
  static calcArrival(bot, targetPos, slowingRadius, forceOut) {
    forceOut.subVectors(targetPos, bot.position);
    const distance = forceOut.length();

    if (distance > 0.0001) {
      const rampedSpeed = bot.speed * Math.min(1.0, distance / Math.max(0.1, slowingRadius));
      forceOut.normalize().multiplyScalar(rampedSpeed);
      forceOut.sub(bot.velocity);
    }
  }

  /**
   * Craig Reynolds Separation Steering Force (Prevents enemy stacking/clumping)
   */
  static calcSeparation(bot, allBots, separationRadius, forceOut) {
    forceOut.set(0, 0, 0);
    let neighborCount = 0;

    for (let i = 0; i < allBots.length; i++) {
      const other = allBots[i];
      if (other === bot || other.isDestroyed) continue;

      const dist = bot.position.distanceTo(other.position);
      if (dist > 0.001 && dist < separationRadius) {
        _tempAway.subVectors(bot.position, other.position);
        _tempAway.normalize().divideScalar(dist); // Weight inverse to distance squared
        forceOut.add(_tempAway);
        neighborCount++;
      }
    }

    if (neighborCount > 0) {
      forceOut.divideScalar(neighborCount);
      if (forceOut.lengthSq() > 0.0001) {
        forceOut.normalize().multiplyScalar(bot.speed);
        forceOut.sub(bot.velocity);
      }
    }
  }

  /**
   * Dynamic Lateral Strafe Force (Orbiting player at standoff range)
   */
  static calcStrafe(bot, playerPos, strafeSign, forceOut) {
    _desired.subVectors(playerPos, bot.position);
    _desired.y = 0;
    if (_desired.lengthSq() > 0.0001) {
      _desired.normalize();
      // Cross with up vector to obtain perpendicular lateral vector
      forceOut.crossVectors(_desired, _up).normalize().multiplyScalar(bot.speed * strafeSign);
      forceOut.sub(bot.velocity);
    }
  }

  /**
   * Player Capsule Hard Repulsion Force (Enforces physical buffer from player capsule)
   */
  static calcPlayerRepulsion(bot, playerPos, minRadius, forceOut) {
    forceOut.set(0, 0, 0);
    _tempAway.subVectors(bot.position, playerPos);
    if (bot.type !== 'DRONE') _tempAway.y = 0; // Horizontal push for ground bots
    const dist = _tempAway.length();

    if (dist < minRadius && dist > 0.0001) {
      const pushStrength = (1.0 - (dist / minRadius)) * bot.speed * 3.0;
      forceOut.copy(_tempAway).normalize().multiplyScalar(pushStrength);
    }
  }

  /**
   * 3D Parametric Sine Altitude Flight Vector (for Flying Drones)
   */
  static calcFlightAltitude(bot, baseAltitude, amplitude, frequency, time, forceOut) {
    const targetY = baseAltitude + Math.sin(time * frequency + (bot.idName ? bot.idName.charCodeAt(0) : 0)) * amplitude;
    const dy = targetY - bot.position.y;
    forceOut.set(0, dy * 4.0, 0);
  }

  /**
   * Raycast / Sphere Octree Obstacle Avoidance Force
   */
  static calcObstacleAvoidance(bot, worldOctree, forceOut) {
    forceOut.set(0, 0, 0);
    if (!worldOctree) return;

    _envSphere.center.copy(bot.position).add(bot.colliderOffset);
    _envSphere.radius = bot.collisionRadius * 1.3; // Extended feeler radius

    const colResult = worldOctree.sphereIntersect(_envSphere);
    if (colResult) {
      forceOut.copy(colResult.normal).multiplyScalar(colResult.depth * 25.0);
    }
  }
}
