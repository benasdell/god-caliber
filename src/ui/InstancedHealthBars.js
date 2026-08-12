import * as THREE from 'three';

const _dummyMatrix = new THREE.Matrix4();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

/**
 * InstancedHealthBars: Renders overhead billboard health bars for mass enemies
 * using a single InstancedMesh draw call and custom camera-facing GLSL shader.
 */
export class InstancedHealthBars {
  constructor(scene, maxInstances = 200) {
    this.maxInstances = maxInstances;

    const baseGeometry = new THREE.PlaneGeometry(1.2, 0.14);

    this.hpRatios = new Float32Array(maxInstances);
    this.hpAttribute = new THREE.InstancedBufferAttribute(this.hpRatios, 1);
    baseGeometry.setAttribute('aHpRatio', this.hpAttribute);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCameraRight: { value: _camRight },
        uCameraUp: { value: _camUp }
      },
      vertexShader: `
        attribute float aHpRatio;
        varying float vHpRatio;
        varying vec2 vUv;

        uniform vec3 uCameraRight;
        uniform vec3 uCameraUp;

        void main() {
          vHpRatio = aHpRatio;
          vUv = uv;

          // Spherical Billboard Vertex Offset
          vec3 worldPosition = instanceMatrix[3].xyz
            + uCameraRight * position.x * 1.25
            + uCameraUp * position.y * 1.25;

          gl_Position = projectionMatrix * viewMatrix * vec4(worldPosition, 1.0);
        }
      `,
      fragmentShader: `
        varying float vHpRatio;
        varying vec2 vUv;

        void main() {
          // High-contrast slate dark border frame (2px outline)
          if (vUv.x < 0.04 || vUv.x > 0.96 || vUv.y < 0.12 || vUv.y > 0.88) {
            gl_FragColor = vec4(0.06, 0.09, 0.16, 0.95);
            return;
          }

          // Background void slot
          if (vUv.x > vHpRatio) {
            gl_FragColor = vec4(0.09, 0.12, 0.18, 0.65);
            return;
          }

          // High-contrast fill gradient (Cyan > Amber > Crimson)
          vec3 fill;
          if (vHpRatio > 0.50) {
            fill = vec3(0.0, 0.94, 1.0); // Electric Cyan #00f0ff
          } else if (vHpRatio > 0.25) {
            fill = vec3(1.0, 0.72, 0.01); // Neon Amber #ffb703
          } else {
            fill = vec3(1.0, 0.16, 0.43); // Crimson Red #ff2a6d
          }

          gl_FragColor = vec4(fill, 1.0);
        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });

    this.mesh = new THREE.InstancedMesh(baseGeometry, this.material, maxInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  updateBars(enemies, camera) {
    if (!camera) return;

    // Extract camera right and up vectors for billboard orientation
    camera.matrixWorld.extractBasis(_camRight, _camUp, new THREE.Vector3());
    this.material.uniforms.uCameraRight.value.copy(_camRight);
    this.material.uniforms.uCameraUp.value.copy(_camUp);

    let count = 0;
    for (let i = 0; i < enemies.length && count < this.maxInstances; i++) {
      const enemy = enemies[i];
      if (!enemy.alive && !enemy.isAlive) continue;

      const pos = enemy.position || enemy.group?.position;
      if (!pos) continue;

      const yOffset = enemy.type === 'GOLIATH' ? 2.8 : (enemy.type === 'DRONE' ? 1.4 : 2.1);
      _dummyMatrix.setPosition(pos.x, pos.y + yOffset, pos.z);
      this.mesh.setMatrixAt(count, _dummyMatrix);

      const maxHp = enemy.maxHp || 100;
      const curHp = enemy.hp !== undefined ? enemy.hp : maxHp;
      this.hpRatios[count] = Math.max(0.0, Math.min(1.0, curHp / maxHp));

      count++;
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.hpAttribute.needsUpdate = true;
  }
}
