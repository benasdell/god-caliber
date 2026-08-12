import * as THREE from 'three';

export class MinimapManager {
  constructor(canvasId = 'minimap-canvas') {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    this.width = 180;
    this.height = 180;
    this.center = 90;

    this.mapSize = 240;
    this.halfMap = 120;
    this.scaleFactor = 180 / 240; // 0.75 px per meter

    this.landmarks = [
      { name: 'Sector Zero Citadel', icon: '🏰', x: 0, z: 0 },
      { name: 'Outpost Omega', icon: '⬡', x: 300, z: -300 },
      { name: 'Industrial Complex', icon: '🏭', x: -300, z: -300 },
      { name: 'Quantum Core', icon: '⚛️', x: -300, z: 300 },
      { name: 'Monorail Hub', icon: '🚟', x: 300, z: 300 }
    ];

    this.dpr = 1;
    this.setupDPR();
  }

  setupDPR() {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    if (this.ctx.resetTransform) {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this.ctx.scale(dpr, dpr);
  }

  worldToCanvas(x, z, playerPos) {
    if (!playerPos) {
      const cx = (x + this.halfMap) * this.scaleFactor;
      const cy = (z + this.halfMap) * this.scaleFactor;
      return { x: cx, y: cy };
    }
    const relX = x - playerPos.x;
    const relZ = z - playerPos.z;
    return {
      x: this.center + relX * this.scaleFactor,
      y: this.center + relZ * this.scaleFactor
    };
  }

  render(player, circleManager, targets = []) {
    if (!this.canvas || !this.ctx) return;

    const currentDPR = window.devicePixelRatio || 1;
    if (currentDPR !== this.dpr) {
      this.setupDPR();
    }

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = this.center;
    const cy = this.center;

    const playerPos = player ? (player.camera ? player.camera.position : player.position) : null;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 1, 0, Math.PI * 2);
    ctx.clip();

    // 1. Background Grid
    ctx.fillStyle = 'rgba(10, 14, 23, 0.92)';
    ctx.fillRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    const gridStepMeters = 50;
    
    // Dynamic scrolling grid lines relative to player
    const pX = playerPos ? playerPos.x : 0;
    const pZ = playerPos ? playerPos.z : 0;

    const startX = Math.floor((pX - 120) / gridStepMeters) * gridStepMeters;
    const endX = Math.ceil((pX + 120) / gridStepMeters) * gridStepMeters;
    for (let wx = startX; wx <= endX; wx += gridStepMeters) {
      const px = this.worldToCanvas(wx, 0, playerPos).x;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }

    const startZ = Math.floor((pZ - 120) / gridStepMeters) * gridStepMeters;
    const endZ = Math.ceil((pZ + 120) / gridStepMeters) * gridStepMeters;
    for (let wz = startZ; wz <= endZ; wz += gridStepMeters) {
      const py = this.worldToCanvas(0, wz, playerPos).y;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, h);
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // 2. Next Safe Zone Ring (gold dashed stroke)
    if (circleManager && typeof circleManager.targetRadius === 'number') {
      const targetPos = this.worldToCanvas(circleManager.targetCenterX || 0, circleManager.targetCenterZ || 0, playerPos);
      const targetRadiusPx = circleManager.targetRadius * this.scaleFactor;

      ctx.save();
      ctx.beginPath();
      ctx.arc(targetPos.x, targetPos.y, targetRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffb703';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Active Shrinking Circle (cyan stroke)
    if (circleManager && typeof circleManager.currentRadius === 'number') {
      const currentPos = this.worldToCanvas(circleManager.centerX || 0, circleManager.centerZ || 0, playerPos);
      const currentRadiusPx = circleManager.currentRadius * this.scaleFactor;

      ctx.save();
      ctx.beginPath();
      ctx.arc(currentPos.x, currentPos.y, currentRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Landmark Icons (Citadel 🏰, Omega ⬡, Industrial 🏭, Quantum ⚛️, Monorail 🚟)
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const lm of this.landmarks) {
      const pos = this.worldToCanvas(lm.x, lm.z, playerPos);
      ctx.fillText(lm.icon, pos.x, pos.y);
    }

    // 5. Enemy Markers (red dots with elevation chevrons ▲/▼ for height diff > 2.5m & edge clamping)
    const playerY = playerPos ? playerPos.y : 0;
    const maxClampRadius = cx - 8;

    if (Array.isArray(targets)) {
      for (const bot of targets) {
        if (!bot || bot.isDestroyed || (bot.hp !== undefined && bot.hp <= 0)) continue;
        const bPos = bot.position || (bot.group ? bot.group.position : null);
        if (!bPos) continue;

        const raw = this.worldToCanvas(bPos.x, bPos.z, playerPos);
        const dx = raw.x - cx;
        const dy = raw.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let drawX = raw.x;
        let drawY = raw.y;

        if (dist > maxClampRadius) {
          drawX = cx + (dx / dist) * maxClampRadius;
          drawY = cy + (dy / dist) * maxClampRadius;
        }

        ctx.fillStyle = '#ff2a6d';
        ctx.beginPath();
        ctx.arc(drawX, drawY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (playerPos) {
          const heightDiff = bPos.y - playerY;
          ctx.fillStyle = '#ff2a6d';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';

          if (heightDiff > 2.5) {
            ctx.textBaseline = 'bottom';
            ctx.fillText('▲', drawX, drawY - 3);
          } else if (heightDiff < -2.5) {
            ctx.textBaseline = 'top';
            ctx.fillText('▼', drawX, drawY + 3);
          }
        }
      }
    }

    // 6. Player Heading Chevron Arrow (#00f0ff) ALWAYS CENTERED at (cx, cy)
    if (playerPos) {
      let yawAngle = 0;
      if (player.camera && player.camera.getWorldDirection) {
        const dir = new THREE.Vector3();
        player.camera.getWorldDirection(dir);
        yawAngle = Math.atan2(dir.z, dir.x) + Math.PI / 2;
      } else if (typeof player.yaw === 'number') {
        yawAngle = player.yaw;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(yawAngle);

      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#05070a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 2);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }
}
