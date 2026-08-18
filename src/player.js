import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { sound } from './audio.js';
import { EnemyFactory } from './enemies/EnemyFactory.js';
import { CharacterRig } from './rigging/CharacterRig.js';
import { ProceduralAnimator } from './animation/ProceduralAnimator.js';
import { getStructureExclusionZones, VALIDATED_SPAWN_WAYPOINTS } from './terrain.js';

// Preallocated static scratch vectors for zero-allocation physics loop
const _tempVec1 = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _axisY = new THREE.Vector3(0, 1, 0);
const _spawnRay = new THREE.Ray();
const _spawnDown = new THREE.Vector3(0, -1, 0);

const SPAWN_POINTS = VALIDATED_SPAWN_WAYPOINTS;


export class Player {
  constructor(camera, worldOctree) {
    this.camera = camera;
    this.worldOctree = worldOctree;

    // Instantiate Procedural First-Person 1P Body & Arms
    this.body1P = EnemyFactory.createLocal1PBody();
    this.body1P.position.set(0, -0.65, -0.20);
    this.camera.add(this.body1P);

    // Heights
    this.STANDING_HEIGHT = 1.45;
    this.CROUCH_HEIGHT = 0.70;
    this.currentEndHeight = this.STANDING_HEIGHT;

    // Player capsule collider (radius: 0.35m)
    this.collider = new Capsule(
      new THREE.Vector3(0, 0.35, 0),
      new THREE.Vector3(0, this.STANDING_HEIGHT, 0),
      0.35
    );

    // Initial position - dynamic safe spawn algorithm
    const initialSpawn = this.getSafeSpawnPoint();
    this.position = initialSpawn.clone();
    this.collider.start.add(this.position);
    this.collider.end.add(this.position);

    // Physics vectors
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.onGround = false;

    // Camera angles (yaw & pitch)
    this.yaw = 0;
    this.pitch = 0;
    this.bodyYaw = 0;

    // Standardized Character Rig & Procedural Animator
    this.characterRig = new CharacterRig('PROCEDURAL', 0x00f0ff);
    this.characterRig.setHeadVisibility(false); // Mask head mesh for local 1P camera view
    this.animator = new ProceduralAnimator(this.characterRig);

    // Speeds & Physics (Recalibrated for grounded agility & tactile sprint)
    this.GRAVITY = 25.0;
    this.WALK_SPEED = 8.0;
    this.SPRINT_SPEED = 16.0;
    this.CROUCH_SPEED = 4.5;
    this.SLIDE_PENALTY_SPEED = 3.0;
    this.JUMP_FORCE = 12.5;

    // State flags & timers
    this.isSprinting = false;
    this.landGraceTimer = 0;
    this.isCrouching = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideCooldownTimer = 0.0;

    // Zipline & Ladder states
    this.isZiplining = false;
    this.activeZipline = null;
    this.ziplineProgress = 0;
    this.ziplineDirection = 1; // 1 = forward, -1 = reverse
    this.ziplineAttachTimer = 0.0;

    this.isClimbingLadder = false;
    this.activeLadder = null;

    // Health & Spectator state
    this.maxHp = 100;
    this.hp = 100;
    this.isDead = false;
    this.isSpectator = false;
    this.isInvulnerable = false;
    this.damageReduction = 0.0;
    this.speedMultiplier = 1.0;
    this.jumpMultiplier = 1.0;
    this.allowAirJump = false;
    this.hasAirJumped = false;
    this._jumpKeyDownLastFrame = false;

    // Movement distance for bobbing
    this.moveDistance = 0;
    this.screenShakeIntensity = 0.0;
  }

  enableSpectatorMode() {
    this.isSpectator = true;
    this.isDead = true;
    this.isInvulnerable = true;
    this.velocity.set(0, 0, 0);
    if (this.characterRig && this.characterRig.group) {
      this.characterRig.group.visible = false;
    }
    if (this.body1P) {
      this.body1P.visible = false;
    }
    if (this.isZiplining) this.detachZipline(false);
    if (this.isClimbingLadder) this.detachLadder();
    this.isSprinting = false;
    this.isSliding = false;
    this.isCrouching = false;
  }

  disableSpectatorMode() {
    this.isSpectator = false;
    this.isDead = false;
    this.isInvulnerable = false;
    if (this.characterRig && this.characterRig.group) {
      this.characterRig.group.visible = true;
    }
    if (this.body1P) {
      this.body1P.visible = true;
    }
  }

  cancelSprint(controls) {
    if (controls) {
      controls.sprintToggled = false;
      controls.keyState.sprint = false;
    }
    this.isSprinting = false;
  }

  update(deltaTime, controls) {
    if (!controls) return;
    if (!controls.isLocked) return;

    // Handle mouse look / angles
    const mouseDelta = controls.getAndResetMouseDelta();
    const sensitivity = (controls.sensitivity || 0.0022);

    this.yaw -= mouseDelta.x * sensitivity;
    this.pitch -= mouseDelta.y * sensitivity;

    // Clamp pitch between -85 deg and +85 deg
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.1, Math.PI / 2.1);

    if (controls.isFreeLooking) {
      // Clamp camera yaw relative to bodyYaw within [-110 deg, +110 deg]
      const relativeYaw = THREE.MathUtils.clamp(
        this.yaw - this.bodyYaw,
        -THREE.MathUtils.degToRad(110),
        THREE.MathUtils.degToRad(110)
      );
      this.yaw = this.bodyYaw + relativeYaw;
    } else {
      // Smoothly blend bodyYaw back to camera yaw
      this.bodyYaw = THREE.MathUtils.lerp(this.bodyYaw, this.yaw, 1.0 - Math.exp(-12.0 * deltaTime));
    }

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // --- SPECTATOR NOCLIP FLYCAM ---
    if (this.isSpectator) {
      const flySpeed = controls.keyState.sprint ? 36.0 : 18.0;
      const flyDir = new THREE.Vector3();

      if (controls.keyState.forward) flyDir.z -= 1;
      if (controls.keyState.backward) flyDir.z += 1;
      if (controls.keyState.left) flyDir.x -= 1;
      if (controls.keyState.right) flyDir.x += 1;

      if (flyDir.lengthSq() > 0) {
        flyDir.normalize();
        flyDir.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        this.camera.position.addScaledVector(flyDir, flySpeed * deltaTime);
      }

      if (controls.keyState.jump) {
        this.camera.position.y += flySpeed * deltaTime;
      }
      if (controls.keyState.crouch) {
        this.camera.position.y -= flySpeed * deltaTime;
      }

      this.position.copy(this.camera.position);
      return;
    }

    // --- PASSIVE HEALTH REGENERATION (+2.0 HP/s) ---
    if (!this.isDead && !this.isSpectator && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 2.0 * deltaTime);
    }

    // --- ZIPLINE MOVEMENT PHYSICS ---
    if (this.isZiplining && this.activeZipline) {
      if (this.ziplineAttachTimer > 0) {
        this.ziplineAttachTimer -= deltaTime;
      }

      const zip = this.activeZipline;
      const zipSpeed = 32.0; // Clean, exhilarating, smooth 32 m/s traversal (~1.2s smooth slide)
      const deltaProgress = (zipSpeed / zip.length) * deltaTime * this.ziplineDirection;

      this.ziplineProgress += deltaProgress;

      // Check endpoint reached or jump off request (Space / F after 0.35s attach timer)
      const reachedEnd = (this.ziplineDirection === 1 && this.ziplineProgress >= 1.0) ||
        (this.ziplineDirection === -1 && this.ziplineProgress <= 0.0);

      const manualDetach = controls.keyState.jump || (controls.keyState.interact && this.ziplineAttachTimer <= 0);

      if (reachedEnd) {
        this.detachZipline(false);
      } else if (manualDetach) {
        this.detachZipline(true);
        controls.keyState.jump = false;
        controls.keyState.interact = false;
      } else {
        // Position capsule collider smoothly along cable vector
        const clampedProg = Math.max(0, Math.min(1, this.ziplineProgress));
        const currentPos = zip.start.clone().lerp(zip.end, clampedProg);

        this.collider.start.set(currentPos.x, currentPos.y - this.STANDING_HEIGHT + 0.35, currentPos.z);
        this.collider.end.set(currentPos.x, currentPos.y + 0.35, currentPos.z);
        this.position.copy(currentPos);
        this.velocity.set(0, 0, 0);

        // Position camera hanging overhead under cable grip
        this.camera.position.set(currentPos.x, currentPos.y - 0.25, currentPos.z);

        // CRITICAL: Return early during zipline ride so ground gravity & octree collisions don't pull player off wire!
        return;
      }
    }

    // --- LADDER MOVEMENT PHYSICS ---
    if (this.isClimbingLadder && this.activeLadder) {
      const lad = this.activeLadder;
      const climbSpeed = 7.0; // Responsive FPS climb speed (7.0 m/s)
      let climbVel = 0;

      // Offset player 0.6m outward from the ladder wall face so capsule never clips into pillar mesh
      const outwardNormal = _tempDir.set(0, 0, 1).applyAxisAngle(_axisY, lad.rotationY || 0);
      const targetX = lad.x + outwardNormal.x * 0.65;
      const targetZ = lad.z + outwardNormal.z * 0.65;

      // Vertical input
      if (controls.keyState.forward) climbVel += climbSpeed;
      if (controls.keyState.backward) climbVel -= climbSpeed;

      // Zero out horizontal & vertical inertia while climbing
      this.velocity.set(0, 0, 0);

      if (controls.keyState.jump) {
        this.detachLadder();
        _tempDir.set(0, 0, 1).applyAxisAngle(_axisY, this.yaw); // Push back from ladder
        this.velocity.copy(_tempDir.multiplyScalar(6.0));
        this.velocity.y = 8.0;
        sound.playJump();
      } else {
        // Move collider vertically along ladder axis
        _tempVec1.set(0, climbVel * deltaTime, 0);
        this.collider.translate(_tempVec1);

        // Smoothly snap X/Z to ladder center line
        this.collider.start.x = THREE.MathUtils.lerp(this.collider.start.x, targetX, deltaTime * 12);
        this.collider.start.z = THREE.MathUtils.lerp(this.collider.start.z, targetZ, deltaTime * 12);
        this.collider.end.x = THREE.MathUtils.lerp(this.collider.end.x, targetX, deltaTime * 12);
        this.collider.end.z = THREE.MathUtils.lerp(this.collider.end.z, targetZ, deltaTime * 12);

        const currentY = this.collider.start.y;

        if (currentY >= lad.yEnd - 0.1) {
          // Reached top of ladder: step smoothly forward onto walkway platform with ZERO vertical launch!
          _tempDir.set(0, 0, -1).applyAxisAngle(_axisY, this.yaw);
          const landingPos = new THREE.Vector3(targetX, lad.yEnd + 0.35, targetZ).add(_tempDir.multiplyScalar(0.8));

          this.collider.start.copy(landingPos);
          this.collider.end.set(landingPos.x, landingPos.y + (this.STANDING_HEIGHT - 0.35), landingPos.z);
          this.position.copy(landingPos);
          this.velocity.set(0, 0, 0);
          this.onGround = true;
          this.detachLadder();
        } else if (currentY <= lad.yStart - 0.3) {
          // Reached bottom of ladder
          this.velocity.set(0, 0, 0);
          this.onGround = true;
          this.detachLadder();
        } else {
          this.camera.position.copy(this.collider.end);
          return;
        }
      }
    }

    // 2. Crouch & Kinetic Slide Mechanics (Anti-Spam System)
    const wantsCrouch = controls.keyState.crouch;
    const currentHorizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // Sprint Evaluation
    const sprintInputHeld = (controls.keyState.sprint || controls.sprintToggled) && controls.keyState.forward;
    const wantsSprint = sprintInputHeld && !wantsCrouch;
    this.isSprinting = wantsSprint;

    // Auto-cancel toggle sprint if player is not moving forward
    if (!controls.keyState.forward && (controls.sprintToggled || controls.keyState.sprint)) {
      this.cancelSprint(controls);
    }

    // Decrement slide cooldown timer
    if (this.slideCooldownTimer > 0) {
      this.slideCooldownTimer -= deltaTime;
    }

    // Require sprint momentum (>=12.0 m/s) + 1.2s cooldown clearance to slide
    if (wantsCrouch && (sprintInputHeld || this.isSprinting) && this.onGround && !this.isSliding && currentHorizontalSpeed >= 12.0 && this.slideCooldownTimer <= 0) {
      this.isSliding = true;
      this.slideTimer = 0.8; // 0.8s max slide duration

      _tempDir.set(0, 0, -1).applyAxisAngle(_axisY, this.yaw);
      this.velocity.addScaledVector(_tempDir, 12.0); // +12 m/s kinetic slide kick impulse
      sound.playJump();
    }

    if (this.isSliding) {
      this.slideTimer -= deltaTime;
      this.velocity.x *= Math.exp(-2.0 * deltaTime);
      this.velocity.z *= Math.exp(-2.0 * deltaTime);
      if (!wantsCrouch || this.slideTimer <= 0 || currentHorizontalSpeed < 4.5) {
        this.isSliding = false;
        this.slideCooldownTimer = 1.2; // 1.2s Anti-Spam Cooldown
      }
    }

    this.isCrouching = wantsCrouch || this.isSliding;

    const targetEndHeight = this.isCrouching ? this.CROUCH_HEIGHT : this.STANDING_HEIGHT;
    this.currentEndHeight = THREE.MathUtils.lerp(this.currentEndHeight, targetEndHeight, deltaTime * 14);
    this.collider.end.y = this.collider.start.y + (this.currentEndHeight - 0.35);

    // 3. Speed Selection
    let targetSpeed = this.WALK_SPEED;
    if (this.isSprinting) targetSpeed = this.SPRINT_SPEED;
    if (this.isCrouching && !this.isSliding) {
      // Penalize speed if crouching during 1.2s slide cooldown (Anti-Spam)
      targetSpeed = this.slideCooldownTimer > 0 ? this.SLIDE_PENALTY_SPEED : this.CROUCH_SPEED;
    }

    // Apply speed modifiers from active gear items
    targetSpeed *= this.speedMultiplier;

    // 4. Movement Input Direction Math
    this.direction.set(0, 0, 0);
    const hasInput = controls.keyState.forward || controls.keyState.backward || controls.keyState.left || controls.keyState.right;

    if (hasInput) {
      if (controls.keyState.forward) this.direction.z -= 1;
      if (controls.keyState.backward) this.direction.z += 1;
      if (controls.keyState.left) this.direction.x -= 1;
      if (controls.keyState.right) this.direction.x += 1;
      this.direction.normalize().applyAxisAngle(_axisY, this.yaw);
    }

    // Decrement B-Hop landing grace timer
    if (this.landGraceTimer > 0) {
      this.landGraceTimer -= deltaTime;
    }

    // 5. Velocity Acceleration & Friction Physics (Exponential decay k=35.0)
    if (this.onGround) {
      this.landGraceTimer = 0.15; // 150ms B-Hop landing window

      if (!this.isSliding) {
        const targetVelX = hasInput ? this.direction.x * targetSpeed : 0;
        const targetVelZ = hasInput ? this.direction.z * targetSpeed : 0;
        const decayFactor = 1.0 - Math.exp(-35.0 * deltaTime);
        this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVelX, decayFactor);
        this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVelZ, decayFactor);
      }

      if (hasInput) {
        this.moveDistance += deltaTime * (this.isSprinting ? 14 : 8);
      }
    }

    // Jump Execution (Supports Ground Jump, Slide-Jumping, B-Hopping, and Legendary Air-Jump)
    const isJumpPressedThisFrame = Boolean(controls.keyState.jump && !this._jumpKeyDownLastFrame);

    if (controls.keyState.jump && (this.onGround || this.isSliding || this.landGraceTimer > 0)) {
      if (this.isSliding) {
        this.isSliding = false;
        this.isCrouching = false;
        this.slideCooldownTimer = 1.0;
      }
      this.velocity.y = this.JUMP_FORCE * this.jumpMultiplier;
      this.onGround = false;
      this.landGraceTimer = 0;
      this.hasAirJumped = false;
      sound.playJump();
    } else if (isJumpPressedThisFrame && !this.onGround && this.allowAirJump && !this.hasAirJumped && this.landGraceTimer <= 0) {
      this.hasAirJumped = true;
      this.velocity.y = this.JUMP_FORCE * this.jumpMultiplier;
      sound.playJump();
    }
    this._jumpKeyDownLastFrame = Boolean(controls.keyState.jump);

    if (!this.onGround) {
      // Air Control / Air-Strafing Wish Vector Projection
      if (hasInput) {
        const currentAirSpeed = this.velocity.dot(this.direction);
        const addSpeed = 3.0 - currentAirSpeed;
        if (addSpeed > 0) {
          this.velocity.addScaledVector(this.direction, Math.min(addSpeed, 45.0 * deltaTime));
        }
      }

      this.velocity.y -= this.GRAVITY * deltaTime;
      // Zero airborne drag (100% horizontal momentum preservation in mid-air for B-Hopping & Slide-Jumping)
      const airDamping = 0;
      this.velocity.x += this.velocity.x * airDamping;
      this.velocity.z += this.velocity.z * airDamping;
    }

    // 6. Apply Movement to Capsule (Zero Allocation)
    _tempVec1.copy(this.velocity).multiplyScalar(deltaTime);
    this.collider.translate(_tempVec1);

    this.playerCollisions();

    // 7. Dynamic Sprint FOV Expansion & Tactile Camera Effects
    const targetFov = 75.0 + Math.max(0, Math.min(1, (currentHorizontalSpeed - 8.0) / 8.0)) * 11.0;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, deltaTime * 10.0);
    this.camera.updateProjectionMatrix();

    // Lock camera to head of capsule + Lissajous figure-8 bobbing & turn roll tilt
    this.camera.position.copy(this.collider.end);

    const rightVec = _tempDir.set(1, 0, 0).applyAxisAngle(_axisY, this.yaw);
    const strafeSpeed = this.velocity.dot(rightVec);
    const rollAngle = Math.max(-0.045, Math.min(0.045, -strafeSpeed * 0.002));
    this.camera.rotation.z = rollAngle;

    if (this.onGround && currentHorizontalSpeed > 15.0 && !this.isSliding) {
      const bobX = Math.sin(this.moveDistance * 0.5) * 0.03;
      const bobY = Math.abs(Math.sin(this.moveDistance)) * 0.05;
      this.camera.position.add(_tempDir.set(bobX, bobY, 0).applyAxisAngle(_axisY, this.yaw));
    }

    // Dynamic First-Person Local 1P Body Positioning
    if (this.body1P) {
      const lowerBody = this.body1P.getObjectByName('lowerBody1P');
      if (lowerBody) {
        const pitchDownPct = Math.max(0, (this.pitch - 0.15) / 0.85);
        lowerBody.visible = pitchDownPct > 0.02;
        lowerBody.position.set(0, -0.75 + pitchDownPct * 0.1, -0.10 - pitchDownPct * 0.15);
      }
    }

    // Sync Procedural Character Rig & Animator
    if (this.characterRig) {
      this.characterRig.root.position.copy(this.position);
      this.characterRig.root.rotation.y = this.bodyYaw;
      if (this.animator) {
        this.animator.update(
          deltaTime,
          this.velocity,
          this.onGround,
          this.isSliding,
          controls.keyState?.reload || false,
          controls.mouseDown || false
        );
      }
    }

    // 8. Void Fall Death Plane & Safety Net
    if (this.position.y < -25.0 || this.collider.start.y < -25.0) {
      const safePos = new THREE.Vector3(0, 2.0, 0);
      this.position.copy(safePos);
      this.collider.start.set(0, 0.35 + 2.0, 0);
      this.collider.end.set(0, this.currentEndHeight + 2.0, 0);
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      if (window.gameInstance && window.gameInstance.ui) {
        window.gameInstance.ui.addKillFeed("⚠️ VOID FALL PREVENTED - TELEPORTED TO SAFETY");
      }
    }

    // Keep base position in sync with capsule foot level for network snapshot broadcasting
    this.position.set(this.collider.start.x, this.collider.start.y - 0.35, this.collider.start.z);
  }

  playerCollisions() {
    this.onGround = false;

    // Multi-Pass Octree Depenetration Loop (Up to 3 passes to prevent clipping in corners/geometry)
    for (let pass = 0; pass < 3; pass++) {
      const result = this.worldOctree.capsuleIntersect(this.collider);
      if (!result) break;

      if (result.normal.y > 0.25) {
        this.onGround = true;
        this.hasAirJumped = false;
      }

      if (!this.onGround) {
        // Wall sliding: strip perpendicular velocity
        this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
      } else {
        // Slope tangent velocity projection (smooth ramp climbing)
        const normalDotVel = result.normal.dot(this.velocity);
        if (normalDotVel < 0) {
          this.velocity.addScaledVector(result.normal, -normalDotVel);
        }
        this.velocity.y = Math.max(0, this.velocity.y);
      }

      // Step-Up Curb Smoothing (0.35m threshold)
      _tempVec2.copy(result.normal).multiplyScalar(result.depth);
      if (this.onGround && result.depth < 0.35) {
        _tempVec2.y = Math.max(_tempVec2.y, result.depth);
      }
      this.collider.translate(_tempVec2);
    }
  }

  getSafeSpawnPoint() {
    let activeEnemies = [];
    if (window.gameInstance && window.gameInstance.targetManager) {
      activeEnemies = window.gameInstance.targetManager.targets.filter(b => !b.isDestroyed);
    }

    const exclusionZones = getStructureExclusionZones(15.0);
    const candidates = [];
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Sample uniformly in [-450, 450] x [-450, 450] (leaving 50m margin from 1000m map perimeter)
      const sampleX = (Math.random() - 0.5) * 900;
      const sampleZ = (Math.random() - 0.5) * 900;

      // 1. Exclusion Zone Rejection Check
      let inExclusion = false;
      for (let z = 0; z < exclusionZones.length; z++) {
        const zone = exclusionZones[z];
        if (sampleX >= zone.minX && sampleX <= zone.maxX && sampleZ >= zone.minZ && sampleZ <= zone.maxZ) {
          inExclusion = true;
          break;
        }
      }
      if (inExclusion) continue;

      // 2. Downward raycast against worldOctree to find floor & check walkable slope
      if (this.worldOctree) {
        _spawnRay.origin.set(sampleX, 50, sampleZ);
        _spawnRay.direction.copy(_spawnDown);
        const hit = this.worldOctree.rayIntersect(_spawnRay);
        if (hit && hit.point && hit.point.y >= -2.0) {
          // Verify normal vector slope <= 30 deg (normal.y >= cos(30 deg) ≈ 0.866)
          if (hit.normal && hit.normal.y >= 0.866) {
            candidates.push(new THREE.Vector3(hit.point.x, hit.point.y + 0.05, hit.point.z));
            if (candidates.length >= 8) break; // Gathered sufficient candidates
          }
        }
      } else {
        candidates.push(new THREE.Vector3(sampleX, 0.5, sampleZ));
      }
    }

    // Fallback to pre-baked validated perimeter waypoints if sampling failed
    const searchPool = candidates.length > 0 ? candidates : VALIDATED_SPAWN_WAYPOINTS;

    if (activeEnemies.length === 0) {
      return searchPool[Math.floor(Math.random() * searchPool.length)].clone();
    }

    let bestSpawn = searchPool[0];
    let maxMinDist = -1;

    for (const pt of searchPool) {
      let minDistToEnemy = Infinity;
      for (const enemy of activeEnemies) {
        const d = pt.distanceTo(enemy.position);
        if (d < minDistToEnemy) minDistToEnemy = d;
      }

      if (minDistToEnemy > maxMinDist) {
        maxMinDist = minDistToEnemy;
        bestSpawn = pt;
      }
    }

    return bestSpawn.clone();
  }

  reset() {
    this.disableSpectatorMode();
    this.hp = this.maxHp;
    this.isDead = false;
    this.isInvulnerable = false;
    this.hasAirJumped = false;
    this._jumpKeyDownLastFrame = false;
    this.velocity.set(0, 0, 0);

    const safeSpawn = this.getSafeSpawnPoint();
    this.position.copy(safeSpawn);

    this.collider.start.copy(safeSpawn).add(new THREE.Vector3(0, 0.35, 0));
    this.collider.end.copy(safeSpawn).add(new THREE.Vector3(0, this.STANDING_HEIGHT, 0));

    this.yaw = 0;
    this.pitch = 0;

    if (window.gameInstance) {
      window.gameInstance.playerDeaths = (window.gameInstance.playerDeaths || 0) + 1;
      window.gameInstance.ui.addKillFeed("☠️ SPAWNED AT TACTICAL SAFE LOCATION!");
    }
  }

  triggerScreenShake(intensity) {
    // Screen shake disabled per user request
    this.screenShakeIntensity = 0;
  }

  takeDamage(amount, hitY = null, attackerId = null, attackerName = null) {
    if (this.isDead || this.isSpectator || this.isInvulnerable) return;
    const sanitizedAmount = Math.max(0, Math.min(Number(amount) || 0, 200));
    if (sanitizedAmount <= 0) return;

    let isHeadshot = false;
    if (hitY !== null && typeof hitY === 'number') {
      // Capsule headzone is above height 1.1m from the bottom center (start.y)
      const heightAboveBase = hitY - this.collider.start.y;
      if (heightAboveBase >= 1.1) {
        isHeadshot = true;
      }
    }

    if (attackerId) this.lastAttackerId = attackerId;
    if (attackerName) this.lastAttackerName = attackerName;

    const baseDmg = isHeadshot ? sanitizedAmount * 1.5 : sanitizedAmount;
    const reducedAmount = baseDmg * (1 - this.damageReduction);
    this.hp = Math.max(0, this.hp - reducedAmount);

    this.triggerScreenShake(reducedAmount * 0.025);

    if (isHeadshot && window.gameInstance && window.gameInstance.ui) {
      window.gameInstance.ui.addKillFeed("CRITICAL HEADSHOT RECEIVED!");
    }

    if (this.hp <= 0) {
      this.isDead = true;
      sound.playImpact();

      if (window.gameInstance) {
        window.gameInstance.playerDeaths = (window.gameInstance.playerDeaths || 0) + 1;
        const net = window.gameInstance.network;
        if (net && net.isConnected) {
          net.broadcast({
            type: 'kill',
            victim: net.peer?.id || 'local',
            victimName: net.playerName || 'Player',
            attacker: this.lastAttackerId || null,
            attackerName: this.lastAttackerName || 'Enemy',
            isHeadshot: isHeadshot
          });
        }
      }
    }
  }

  attachZipline(ziplineData, startProgress = 0.0, dirSign = 1) {
    this.isZiplining = true;
    this.activeZipline = ziplineData;
    this.ziplineDirection = dirSign;
    this.ziplineProgress = startProgress;
    this.ziplineAttachTimer = 0.35; // 0.35s grace window to prevent instant key-repeat detachment
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    sound.playReload();
  }

  detachZipline(jumpOff = false) {
    if (!this.isZiplining) return;
    this.isZiplining = false;

    if (this.activeZipline) {
      const zip = this.activeZipline;
      const forwardDir = zip.dir.clone().multiplyScalar(this.ziplineDirection);
      if (jumpOff) {
        // Forward jump boost from cable
        this.velocity.copy(forwardDir.multiplyScalar(24.0));
        this.velocity.y = 8.0;
        sound.playJump();
      } else {
        // Smooth, safe ground dismount at end of cable without launching
        this.velocity.copy(forwardDir.multiplyScalar(2.0));
        this.velocity.y = 0.0;
        this.onGround = true;
      }
    }
    this.activeZipline = null;
  }

  attachLadder(ladderData) {
    this.isClimbingLadder = true;
    this.activeLadder = ladderData;
    this.velocity.set(0, 0, 0);
    this.onGround = false;

    // Instant 0.65m outward snap along outer normal to prevent mesh clipping on attach
    const outwardNormal = _tempDir.set(0, 0, 1).applyAxisAngle(_axisY, ladderData.rotationY || 0);
    const targetX = ladderData.x + outwardNormal.x * 0.65;
    const targetZ = ladderData.z + outwardNormal.z * 0.65;

    this.collider.start.x = targetX;
    this.collider.start.z = targetZ;
    this.collider.end.x = targetX;
    this.collider.end.z = targetZ;
    this.position.x = targetX;
    this.position.z = targetZ;

    sound.playReload();
  }

  detachLadder() {
    this.isClimbingLadder = false;
    this.activeLadder = null;
  }
}
