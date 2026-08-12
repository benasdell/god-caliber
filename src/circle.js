import * as THREE from 'three';

export class CircleManager {
  constructor(scene) {
    this.scene = scene;
    
    // Circle state
    this.currentRadius = 80;       // Current visual radius
    this.targetRadius = 80;        // Target radius to shrink toward
    this.centerX = 0;
    this.centerZ = 0;
    this.targetCenterX = 0;
    this.targetCenterZ = 0;
    this.shrinkSpeed = 0;          // Units per second
    this.damagePerSecond = 0;
    this.damageAccumulator = 0;    // For 0.5s tick intervals
    this.isActive = false;
    
    // Circle stage definitions
    this.stages = [
      { radius: 80, centerOffset: 0, dps: 0, shrinkDuration: 0 },          // Stage 0: inactive
      { radius: 50, centerOffset: 15, dps: 5, shrinkDuration: 30 },        // Stage 1
      { radius: 30, centerOffset: 8, dps: 10, shrinkDuration: 25 },        // Stage 2
      { radius: 15, centerOffset: 4, dps: 20, shrinkDuration: 20 },        // Stage 3
      { radius: 5, centerOffset: 1, dps: 40, shrinkDuration: 15 },         // Stage 4 (final)
    ];

    // 3D force field mesh
    this.wallMesh = null;
    this.groundRingMesh = null;
    this.buildForceField();
  }

  buildForceField() {
    const wallGeometry = new THREE.CylinderGeometry(
      this.currentRadius, this.currentRadius, 25, 64, 1, true // open-ended
    );
    
    // ShaderMaterial with animated vertical energy lines
    const wallMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x00f0ff) },  // Cyan
        uColor2: { value: new THREE.Color(0xff00aa) },   // Magenta
        uOpacity: { value: 0.18 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uOpacity;
        varying vec2 vUv;
        varying vec3 vPosition;
        
        void main() {
          // Scrolling vertical energy lines
          float line = sin(vUv.x * 80.0 + uTime * 2.0) * 0.5 + 0.5;
          line = pow(line, 8.0); // Sharpen lines
          
          // Horizontal pulse wave
          float pulse = sin(vUv.y * 6.28 - uTime * 3.0) * 0.5 + 0.5;
          
          // Color mix
          vec3 color = mix(uColor1, uColor2, pulse);
          
          // Edge glow (brighter at top and bottom)
          float edgeGlow = 1.0 - abs(vUv.y - 0.5) * 2.0;
          edgeGlow = 1.0 - pow(edgeGlow, 2.0);
          
          float alpha = uOpacity + line * 0.3 + edgeGlow * 0.15;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    this.wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
    this.wallMesh.position.set(0, 12.5, 0); // Center vertically
    this.wallMesh.visible = false;
    this.scene.add(this.wallMesh);
    
    // Ground ring glow
    const ringGeometry = new THREE.RingGeometry(
      this.currentRadius - 0.5, this.currentRadius + 0.5, 64
    );
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.groundRingMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.groundRingMesh.rotation.x = -Math.PI / 2;
    this.groundRingMesh.position.y = 0.05;
    this.groundRingMesh.visible = false;
    this.scene.add(this.groundRingMesh);
  }

  activateStage(stageIndex) {
    if (stageIndex < 0 || stageIndex >= this.stages.length) return;
    
    const stage = this.stages[stageIndex];
    this.isActive = true;
    this.targetRadius = stage.radius;
    this.damagePerSecond = stage.dps;
    
    // Random center offset
    const angle = Math.random() * Math.PI * 2;
    this.targetCenterX = Math.cos(angle) * stage.centerOffset;
    this.targetCenterZ = Math.sin(angle) * stage.centerOffset;
    
    if (stage.shrinkDuration > 0) {
      this.shrinkSpeed = (this.currentRadius - stage.radius) / stage.shrinkDuration;
    } else {
      this.shrinkSpeed = 0;
    }
    
    this.wallMesh.visible = true;
    this.groundRingMesh.visible = true;
  }

  update(deltaTime, playerPosition) {
    if (!this.isActive) return { isOutside: false, damage: 0 };

    // Update shader time
    if (this.wallMesh && this.wallMesh.material.uniforms) {
      this.wallMesh.material.uniforms.uTime.value += deltaTime;
    }

    // Shrink radius toward target
    if (this.currentRadius > this.targetRadius) {
      this.currentRadius -= this.shrinkSpeed * deltaTime;
      this.currentRadius = Math.max(this.currentRadius, this.targetRadius);
    }
    
    // Lerp center position
    this.centerX += (this.targetCenterX - this.centerX) * deltaTime * 0.5;
    this.centerZ += (this.targetCenterZ - this.centerZ) * deltaTime * 0.5;
    
    // Update 3D mesh geometry scale/position
    this.rebuildMesh();

    // Check if player is outside circle
    let damage = 0;
    let isOutside = false;
    
    if (playerPosition) {
      const dx = playerPosition.x - this.centerX;
      const dz = playerPosition.z - this.centerZ;
      const distFromCenter = Math.sqrt(dx * dx + dz * dz);
      
      if (distFromCenter > this.currentRadius) {
        isOutside = true;
        this.damageAccumulator += deltaTime;
        if (this.damageAccumulator >= 0.5) {
          damage = this.damagePerSecond * 0.5; // Damage per tick (0.5s)
          this.damageAccumulator -= 0.5;
        }
      } else {
        this.damageAccumulator = 0;
      }
    }

    return { isOutside, damage };
  }

  rebuildMesh() {
    const scale = this.currentRadius / 80; // 80 = original geometry radius
    this.wallMesh.scale.set(scale, 1, scale);
    this.wallMesh.position.set(this.centerX, 12.5, this.centerZ);

    this.groundRingMesh.scale.set(scale, scale, 1);
    this.groundRingMesh.position.set(this.centerX, 0.05, this.centerZ);
  }

  reset() {
    this.currentRadius = 80;
    this.targetRadius = 80;
    this.centerX = 0;
    this.centerZ = 0;
    this.targetCenterX = 0;
    this.targetCenterZ = 0;
    this.isActive = false;
    this.damagePerSecond = 0;
    this.damageAccumulator = 0;
    if (this.wallMesh) this.wallMesh.visible = false;
    if (this.groundRingMesh) this.groundRingMesh.visible = false;
  }
  
  dispose() {
    if (this.wallMesh) {
      this.wallMesh.geometry.dispose();
      this.wallMesh.material.dispose();
      this.scene.remove(this.wallMesh);
    }
    if (this.groundRingMesh) {
      this.groundRingMesh.geometry.dispose();
      this.groundRingMesh.material.dispose();
      this.scene.remove(this.groundRingMesh);
    }
  }
}
