import * as THREE from 'three';

export const LIMB_CONFIG = {
  HEAD:       { multiplier: 2.50, name: 'CRITICAL HEADSHOT', isHeadshot: true },
  TORSO:      { multiplier: 1.00, name: 'BODY HIT',          isHeadshot: false },
  LEFT_ARM:   { multiplier: 0.75, name: 'LIMB HIT',          isHeadshot: false },
  RIGHT_ARM:  { multiplier: 0.75, name: 'LIMB HIT',          isHeadshot: false },
  LEFT_LEG:   { multiplier: 0.75, name: 'LIMB HIT',          isHeadshot: false },
  RIGHT_LEG:  { multiplier: 0.75, name: 'LIMB HIT',          isHeadshot: false },
  DRONE_CORE: { multiplier: 1.50, name: 'CORE HIT',          isHeadshot: true }
};

const _broadSphere = new THREE.Sphere();
const _hitPoint = new THREE.Vector3();
const _invMatrix = new THREE.Matrix4();
const _localRay = new THREE.Ray();

/**
 * HitboxManager: Manages segmented limb hitboxes and 2-pass raycasting.
 */
export class HitboxManager {
  /**
   * Attaches low-poly collision volumes to a CharacterRig instance.
   */
  static attachLimbHitboxes(rig) {
    const createHitbox = (limbZone, boneName, box3) => {
      rig.hitboxes.set(limbZone, {
        limbZone,
        boneName,
        localBounds: box3,
        config: LIMB_CONFIG[limbZone]
      });
    };

    // Standard Humanoid & Goliath Hitboxes (Generous bounds to ensure reliable hit registration)
    createHitbox('HEAD', 'Head', new THREE.Box3(new THREE.Vector3(-0.25, -0.05, -0.25), new THREE.Vector3(0.25, 0.38, 0.25)));
    createHitbox('TORSO', 'Chest', new THREE.Box3(new THREE.Vector3(-0.35, -0.45, -0.25), new THREE.Vector3(0.35, 0.40, 0.25)));
    createHitbox('LEFT_ARM', 'LeftArm', new THREE.Box3(new THREE.Vector3(-0.18, -0.45, -0.18), new THREE.Vector3(0.18, 0.10, 0.18)));
    createHitbox('RIGHT_ARM', 'RightArm', new THREE.Box3(new THREE.Vector3(-0.18, -0.45, -0.18), new THREE.Vector3(0.18, 0.10, 0.18)));
    createHitbox('LEFT_LEG', 'LeftLeg', new THREE.Box3(new THREE.Vector3(-0.18, -0.55, -0.18), new THREE.Vector3(0.18, 0.10, 0.18)));
    createHitbox('RIGHT_LEG', 'RightLeg', new THREE.Box3(new THREE.Vector3(-0.18, -0.55, -0.18), new THREE.Vector3(0.18, 0.10, 0.18)));

    // Flying Drone Core Hitbox
    createHitbox('DRONE_CORE', 'droneCore', new THREE.Box3(new THREE.Vector3(-0.60, -0.60, -0.60), new THREE.Vector3(0.60, 0.60, 0.60)));
  }

  /**
   * Performs 2-pass raycast against entity limb hitboxes.
   * Pass 1: Broadphase bounding sphere test (Generous 2.8m radius).
   * Pass 2: Narrowphase bone-local matrix transformation & OBB intersection.
   */
  static raycastEntity(ray, entityPosition, rig, isGoliath = false) {
    if (!rig || rig.hitboxes.size === 0) return null;

    // Pass 1: Broadphase Discard (Generous radius to encompass scaled Goliaths & Flying Drones)
    const broadRadius = isGoliath ? 3.5 : 2.5;
    _broadSphere.set(entityPosition.clone().add(new THREE.Vector3(0, 1.25, 0)), broadRadius);
    if (!ray.intersectsSphere(_broadSphere)) {
      return null;
    }

    // Pass 2: Narrowphase Segmented Limb Hitbox Raycast
    let closestHit = null;
    let minDistance = Infinity;

    for (const [limbZone, hitbox] of rig.hitboxes.entries()) {
      let bone = rig.getBone(hitbox.boneName);
      // Fallback for Drones if bone is stored under Head/Chest
      if (!bone && limbZone === 'DRONE_CORE') {
        bone = rig.getBone('Head') || rig.getBone('Chest') || rig.root;
      }
      if (!bone) continue;

      bone.updateMatrixWorld(true);
      _invMatrix.copy(bone.matrixWorld).invert();

      _localRay.copy(ray).applyMatrix4(_invMatrix);

      const localHitPoint = _localRay.intersectBox(hitbox.localBounds, _hitPoint);
      if (localHitPoint) {
        const worldHitPoint = localHitPoint.clone().applyMatrix4(bone.matrixWorld);
        const dist = ray.origin.distanceTo(worldHitPoint);

        if (dist < minDistance) {
          minDistance = dist;
          closestHit = {
            hit: true,
            distance: dist,
            point: worldHitPoint,
            limbZone,
            multiplier: hitbox.config.multiplier,
            isHeadshot: hitbox.config.isHeadshot,
            config: hitbox.config
          };
        }
      }
    }

    return closestHit;
  }
}
