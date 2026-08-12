import * as THREE from 'three';

const _v1 = new THREE.Vector3();

/**
 * ProceduralAnimator: Multi-layered mathematical procedural animation engine.
 * Decouples lower-body locomotion gait math from upper-body combat actions.
 */
export class ProceduralAnimator {
  constructor(characterRig) {
    this.rig = characterRig;
    this.time = 0;

    // Locomotion States
    this.locomotionState = 'IDLE'; // 'IDLE' | 'WALK' | 'SPRINT' | 'SLIDE'
    this.reloadProgress = 0;
    this.recoilTimer = 0;
  }

  update(dt, velocity, isGrounded = true, isSliding = false, isReloading = false, isFiring = false) {
    this.time += dt;

    _v1.copy(velocity);
    _v1.y = 0;
    const horizSpeed = _v1.length();

    // 1. Determine Locomotion State
    if (isSliding) {
      this.locomotionState = 'SLIDE';
    } else if (horizSpeed > 8.5 && isGrounded) {
      this.locomotionState = 'SPRINT';
    } else if (horizSpeed > 0.4 && isGrounded) {
      this.locomotionState = 'WALK';
    } else {
      this.locomotionState = 'IDLE';
    }

    // Bone Node References
    const hips = this.rig.getBone('Hips');
    const chest = this.rig.getBone('Chest');
    const leftArm = this.rig.getBone('LeftArm');
    const rightArm = this.rig.getBone('RightArm');
    const leftLeg = this.rig.getBone('LeftLeg');
    const rightLeg = this.rig.getBone('RightLeg');

    if (!hips) return;

    // 2. Lower-Body Gait Kinematics
    if (this.locomotionState === 'SLIDE') {
      // Crouch hips down, tilt chest back, extend legs
      hips.position.y = THREE.MathUtils.lerp(hips.position.y, 0.40, dt * 10.0);
      if (chest) chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, -0.45, dt * 10.0);
      if (leftLeg) leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, -1.20, dt * 10.0);
      if (rightLeg) rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0.70, dt * 10.0);
    } else if (this.locomotionState === 'SPRINT') {
      const gaitFreq = 14.5;
      const strideAngle = 0.72;
      const legCycle = Math.sin(this.time * gaitFreq);

      hips.position.y = 0.85 + Math.abs(Math.sin(this.time * gaitFreq * 2.0)) * 0.06;
      if (chest) chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, 0.35, dt * 8.0);
      if (leftLeg) leftLeg.rotation.x = legCycle * strideAngle;
      if (rightLeg) rightLeg.rotation.x = -legCycle * strideAngle;

      if (leftArm && !isReloading) leftArm.rotation.x = -legCycle * strideAngle * 0.8;
      if (rightArm && !isReloading) rightArm.rotation.x = legCycle * strideAngle * 0.8;
    } else if (this.locomotionState === 'WALK') {
      const gaitFreq = 8.5;
      const strideAngle = 0.42;
      const legCycle = Math.sin(this.time * gaitFreq);

      hips.position.y = 0.85 + Math.abs(Math.sin(this.time * gaitFreq * 2.0)) * 0.03;
      if (chest) chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, 0.08, dt * 8.0);
      if (leftLeg) leftLeg.rotation.x = legCycle * strideAngle;
      if (rightLeg) rightLeg.rotation.x = -legCycle * strideAngle;

      if (leftArm && !isReloading) leftArm.rotation.x = -legCycle * strideAngle * 0.6;
      if (rightArm && !isReloading) rightArm.rotation.x = legCycle * strideAngle * 0.6;
    } else {
      // IDLE: Breathing sway
      hips.position.y = 0.85 + Math.sin(this.time * 2.5) * 0.015;
      if (chest) chest.rotation.x = THREE.MathUtils.lerp(chest.rotation.x, 0, dt * 8.0);
      if (leftLeg) leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, dt * 8.0);
      if (rightLeg) rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, dt * 8.0);

      if (leftArm && !isReloading) leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, dt * 8.0);
      if (rightArm && !isReloading) rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, dt * 8.0);
    }

    // 3. Upper-Body Reload Layering
    if (isReloading) {
      this.reloadProgress += dt / 1.8;
      if (this.reloadProgress >= 1.0) {
        this.reloadProgress = 0;
      }
      const reloadPhase = Math.sin(this.reloadProgress * Math.PI);
      if (leftArm) {
        leftArm.rotation.x = -0.9 - reloadPhase * 0.6;
        leftArm.rotation.y = 0.4 * reloadPhase;
      }
      if (rightArm) {
        rightArm.rotation.x = -0.3 + reloadPhase * 0.2;
      }
    } else {
      this.reloadProgress = 0;
      if (leftArm) leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, dt * 8.0);
    }

    // 4. Fire Recoil Damped Harmonic Impulse
    if (isFiring) {
      this.recoilTimer = 0.15;
    }
    if (this.recoilTimer > 0) {
      this.recoilTimer -= dt;
      if (chest) chest.rotation.x -= 0.05 * Math.max(0, this.recoilTimer / 0.15);
    }
  }
}
