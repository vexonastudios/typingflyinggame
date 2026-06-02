// nc-engine.js — NERF OPS: Rogue Protocol — Raycaster + Renderer
'use strict';

class NCEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;

    // Camera
    this.fov = Math.PI / 3; // 60 deg
    this.halfFov = this.fov / 2;
    this.rayCount = this.W;

    // Pre-alloc arrays
    this._zBuf = new Float32Array(this.W);

    // Textures (procedural)
    this._texCache = {};
    this._TEX_SIZE = 64;
    this._genTextures();

    // Floor/ceiling pixel buffer
    this._imgData = this.ctx.createImageData(this.W, this.H);

    // Gun animation state
    this._gunBob = 0;
    this._gunShoot = 0; // 0=idle, 1=full recoil, fades to 0
    this._gunReload = 0;

    // Muzzle flash
    this._muzzleFlash = 0;
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.rayCount = w;
    this._zBuf = new Float32Array(w);
    this._imgData = this.ctx.createImageData(w, h);
  }

  // ── Procedural Texture Generation ─────────────────────────────────────────────
  _genTextures() {
    const S = this._TEX_SIZE;
    const ids = ['concrete', 'brick', 'metal', 'wood', 'camo', 'hazard'];
    for (const id of ids) {
      const off = document.createElement('canvas');
      off.width = S; off.height = S;
      const c = off.getContext('2d');
      this._drawTex(c, id, S);
      this._texCache[id] = off;
    }
  }

  _drawTex(c, type, S) {
    switch (type) {
      case 'concrete': {
        c.fillStyle = '#4a4a4a';
        c.fillRect(0, 0, S, S);
        for (let i = 0; i < 120; i++) {
          const x = Math.random() * S, y = Math.random() * S;
          const v = (Math.random() * 30 - 15) | 0;
          c.fillStyle = `rgba(${74+v},${74+v},${74+v},0.6)`;
          c.fillRect(x, y, 2, 2);
        }
        // cracks
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.moveTo(Math.random()*S, Math.random()*S);
          c.lineTo(Math.random()*S, Math.random()*S);
          c.stroke();
        }
        break;
      }
      case 'brick': {
        c.fillStyle = '#8b3a1a';
        c.fillRect(0, 0, S, S);
        const bH = 8, bW = 16;
        c.fillStyle = '#5a2a10';
        for (let row = 0; row < S / bH; row++) {
          const offset = (row % 2) ? bW / 2 : 0;
          for (let col = -1; col < S / bW + 1; col++) {
            const x = col * bW + offset;
            c.fillRect(x, row * bH, 1, bH);
          }
          c.fillRect(0, row * bH, S, 1);
        }
        break;
      }
      case 'metal': {
        const grad = c.createLinearGradient(0, 0, S, 0);
        grad.addColorStop(0, '#3a3a4a');
        grad.addColorStop(0.5, '#5a5a6a');
        grad.addColorStop(1, '#3a3a4a');
        c.fillStyle = grad;
        c.fillRect(0, 0, S, S);
        // rivets
        c.fillStyle = '#888';
        for (let ry = 8; ry < S; ry += 16) {
          for (let rx = 8; rx < S; rx += 16) {
            c.beginPath();
            c.arc(rx, ry, 2, 0, Math.PI * 2);
            c.fill();
          }
        }
        // horizontal seams
        c.strokeStyle = 'rgba(0,0,0,0.4)';
        c.lineWidth = 1;
        for (let sy = 16; sy < S; sy += 16) {
          c.beginPath(); c.moveTo(0, sy); c.lineTo(S, sy); c.stroke();
        }
        break;
      }
      case 'wood': {
        c.fillStyle = '#6b4020';
        c.fillRect(0, 0, S, S);
        c.strokeStyle = '#4a2a10';
        c.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          c.beginPath();
          const y = i * (S / 8) + Math.random() * 4;
          c.moveTo(0, y);
          c.bezierCurveTo(S/3, y + Math.random()*4-2, 2*S/3, y + Math.random()*4-2, S, y);
          c.stroke();
        }
        break;
      }
      case 'camo': {
        c.fillStyle = '#3a5a20';
        c.fillRect(0, 0, S, S);
        const blobs = [['#2a4010', 12], ['#4a6a30', 8], ['#1a2a08', 10]];
        for (const [col, count] of blobs) {
          c.fillStyle = col;
          for (let i = 0; i < count; i++) {
            const bx = Math.random() * S, by = Math.random() * S;
            const br = 4 + Math.random() * 10;
            c.beginPath();
            c.arc(bx, by, br, 0, Math.PI * 2);
            c.fill();
          }
        }
        break;
      }
      case 'hazard': {
        c.fillStyle = '#1a0000';
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#cc2200';
        // hazard stripes
        for (let i = 0; i < 8; i++) {
          const x = (i / 8) * S;
          c.beginPath();
          c.moveTo(x, 0); c.lineTo(x + S/8, 0);
          c.lineTo(x + S/8 - S/8, S); c.lineTo(x - S/8, S);
          c.closePath();
          if (i % 2 === 0) c.fill();
        }
        // scan lines
        c.fillStyle = 'rgba(0,0,0,0.3)';
        for (let sy = 0; sy < S; sy += 4) {
          c.fillRect(0, sy, S, 2);
        }
        break;
      }
    }
  }

  _getTexCanvas(wallTexId) {
    const names = ['concrete','brick','metal','wood','camo','hazard'];
    return this._texCache[names[wallTexId] || 'concrete'];
  }

  // ── Full Frame Render ──────────────────────────────────────────────────────────
  render(state) {
    const { player, map, enemies, pickups } = state;
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // 1. Draw floor/ceiling
    this._drawFloorCeiling(player, map);

    // 2. Raycast walls
    this._raycastWalls(player, map);

    // 3. Draw sprites (enemies, pickups)
    this._drawSprites(player, enemies, pickups, map);

    // 4. Draw gun viewmodel
    this._drawGun(state);

    // 5. Muzzle flash overlay
    if (this._muzzleFlash > 0) {
      const alpha = this._muzzleFlash / 200;
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha * 0.15})`;
      ctx.fillRect(0, 0, W, H);
      this._muzzleFlash = Math.max(0, this._muzzleFlash - 16);
    }
  }

  // ── Floor & Ceiling ────────────────────────────────────────────────────────────
  _drawFloorCeiling(player, map) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // Ceiling gradient
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, H/2);
    ceilGrad.addColorStop(0, map.ambientColor || '#0d0d1a');
    ceilGrad.addColorStop(1, '#1a1a2a');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, H/2);

    // Floor gradient
    const floorGrad = ctx.createLinearGradient(0, H/2, 0, H);
    floorGrad.addColorStop(0, '#111118');
    floorGrad.addColorStop(1, '#050508');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, H/2, W, H/2);

    // Floor grid lines for depth effect
    ctx.strokeStyle = 'rgba(80,80,120,0.15)';
    ctx.lineWidth = 1;
    for (let fy = H/2 + 10; fy < H; fy += 20) {
      ctx.beginPath();
      ctx.moveTo(0, fy);
      ctx.lineTo(W, fy);
      ctx.stroke();
    }
  }

  // ── Raycaster ─────────────────────────────────────────────────────────────────
  _raycastWalls(player, map) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { x: px, y: py, angle: pa } = player;
    const fogDepth = map.fogDepth || 12;
    const texCanvas = this._getTexCanvas(map.wallTex || 0);
    const S = this._TEX_SIZE;

    for (let col = 0; col < W; col++) {
      const rayAngle = pa - this.halfFov + (col / W) * this.fov;
      const cosA = Math.cos(rayAngle);
      const sinA = Math.sin(rayAngle);

      // DDA setup
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const deltaDistX = Math.abs(1 / (cosA || 0.00001));
      const deltaDistY = Math.abs(1 / (sinA || 0.00001));
      let stepX, stepY, sideDistX, sideDistY;

      if (cosA < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
      else           { stepX =  1; sideDistX = (mapX + 1 - px) * deltaDistX; }
      if (sinA < 0)  { stepY = -1; sideDistY = (py - mapY) * deltaDistY; }
      else           { stepY =  1; sideDistY = (mapY + 1 - py) * deltaDistY; }

      let hit = false, side = 0, dist = 0;
      let wallX = 0;
      const maxDist = fogDepth + 2;

      for (let s = 0; s < 64 && !hit; s++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX; mapX += stepX; side = 0;
        } else {
          sideDistY += deltaDistY; mapY += stepY; side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) { hit = true; break; }
        const tile = map.grid[mapY * map.width + mapX];
        if (tile === NC_TILE.WALL || tile === NC_TILE.CRATE || tile === NC_TILE.DOOR || tile === NC_TILE.BARREL) {
          hit = true;
        }
      }

      if (!hit) { this._zBuf[col] = maxDist; continue; }

      if (side === 0) dist = (mapX - px + (1 - stepX) / 2) / cosA;
      else            dist = (mapY - py + (1 - stepY) / 2) / sinA;

      // Fish-eye correction
      const corrDist = dist * Math.cos(rayAngle - pa);
      this._zBuf[col] = corrDist;

      if (side === 0) wallX = py + dist * sinA;
      else            wallX = px + dist * cosA;
      wallX -= Math.floor(wallX);

      const lineH = Math.min(H * 3, (H / corrDist) | 0);
      const drawStart = Math.max(0, ((H - lineH) >> 1));
      const drawEnd   = Math.min(H - 1, ((H + lineH) >> 1));

      // Fog factor
      const fog = Math.min(1, corrDist / fogDepth);

      // Draw textured column from offscreen canvas
      const texX = Math.floor(wallX * S);
      const shadeFactor = side === 1 ? 0.6 : 1.0;

      ctx.save();
      ctx.globalAlpha = 1;
      // Draw texture slice
      ctx.drawImage(texCanvas, texX, 0, 1, S, col, drawStart, 1, drawEnd - drawStart);
      // Apply shade + fog
      ctx.fillStyle = `rgba(0,0,0,${fog * 0.85 + (1 - shadeFactor) * 0.3})`;
      ctx.fillRect(col, drawStart, 1, drawEnd - drawStart);
      ctx.restore();
    }
  }

  // ── Sprite Rendering ──────────────────────────────────────────────────────────
  _drawSprites(player, enemies, pickups, map) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { x: px, y: py, angle: pa } = player;

    const allSprites = [];

    // Enemies
    for (const e of enemies) {
      const dx = e.x - px, dy = e.y - py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      allSprites.push({ type: 'enemy', obj: e, dist });
    }
    // Pickups
    for (const p of pickups) {
      if (p.collected) continue;
      const dx = p.x - px, dy = p.y - py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      allSprites.push({ type: 'pickup', obj: p, dist });
    }

    // Painter's sort (back to front)
    allSprites.sort((a, b) => b.dist - a.dist);

    for (const s of allSprites) {
      if (s.type === 'enemy') {
        this._drawEnemySprite(s.obj, px, py, pa, W, H);
      } else {
        this._drawPickupSprite(s.obj, px, py, pa, W, H);
      }
    }
  }

  _drawEnemySprite(e, px, py, pa, W, H) {
    const ctx = this.ctx;
    if (e.isDead && e.deathProgress >= 1) return;

    const dx = e.x - px, dy = e.y - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.1 || dist > 20) return;

    // Transform into camera space
    const invDet = 1 / (Math.cos(pa) * (-Math.sin(pa)) - Math.sin(pa) * (-Math.cos(pa)) + 0.0001);
    // Actually: use simple angle-based projection
    const angle = Math.atan2(dy, dx);
    let relAngle = angle - pa;
    while (relAngle > Math.PI)  relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    if (Math.abs(relAngle) > this.halfFov + 0.3) return;

    const screenX = ((relAngle / this.halfFov) * 0.5 + 0.5) * W;
    const corrDist = dist * Math.cos(relAngle);
    if (corrDist <= 0.1) return;

    const spriteH = Math.min(H * 2, (H / corrDist) | 0);
    const spriteW = spriteH;
    const sx = (screenX - spriteW / 2) | 0;
    const sy = ((H - spriteH) / 2) | 0;

    // Fog
    const fogDepth = 12;
    const fog = Math.min(1, corrDist / fogDepth);
    const alpha = e.isDead ? (1 - e.deathProgress) : 1;

    ctx.save();
    ctx.globalAlpha = alpha * (1 - fog * 0.8);

    // Draw enemy body as billboard blocks
    for (let col = 0; col < spriteW; col++) {
      if (sx + col < 0 || sx + col >= W) continue;
      if (corrDist >= this._zBuf[sx + col]) continue; // behind wall

      // Body gradient
      const t = col / spriteW;
      const isFlash = e.isFlashing && Math.floor(Date.now() / 80) % 2 === 0;
      const color = isFlash ? '#ffffff' :
        (e.isCommander ? e.typeCfg.accentColor : e.color);

      // Draw body
      const bodyTop    = sy + spriteH * 0.15;
      const bodyBottom = sy + spriteH * 0.85;
      const headTop    = sy;
      const headBottom = sy + spriteH * 0.2;

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(sx + col, bodyTop | 0, 1, (bodyBottom - bodyTop) | 0);

      // Head (slightly lighter)
      ctx.fillStyle = '#f0c080';
      ctx.fillRect(sx + col, headTop | 0, 1, (headBottom - headTop) | 0);
    }

    // Health bar above enemy
    if (!e.isDead && e.dist < 8) {
      const barW = Math.max(20, spriteW * 0.8);
      const barX = screenX - barW / 2;
      const barY = sy - 10;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, 4);
      const pct = e.health / e.maxHealth;
      ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa00' : '#ff2222';
      ctx.fillRect(barX, barY, barW * pct, 4);
    }

    // Commander crown indicator
    if (e.isCommander && !e.isDead) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = '#ffd700';
      ctx.font = `${Math.max(10, spriteH * 0.15)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('★', screenX, sy - 15);
    }

    e.screenX = screenX;
    e.screenY = sy + spriteH / 2;
    e.dist = dist;
    e.visible = true;

    ctx.restore();
  }

  _drawPickupSprite(p, px, py, pa, W, H) {
    const ctx = this.ctx;
    const dx = p.x - px, dy = p.y - py;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.1 || dist > 15) return;

    const angle = Math.atan2(dy, dx);
    let relAngle = angle - pa;
    while (relAngle > Math.PI)  relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;
    if (Math.abs(relAngle) > this.halfFov + 0.2) return;

    const screenX = ((relAngle / this.halfFov) * 0.5 + 0.5) * W;
    const corrDist = dist * Math.cos(relAngle);
    if (corrDist <= 0.1) return;

    const spriteH = Math.min(H, (H * 0.5 / corrDist) | 0);
    const spriteW = spriteH;
    const sx = (screenX - spriteW / 2) | 0;
    const sy = ((H - spriteH) / 2 + spriteH * 0.25) | 0;

    const fog = Math.min(1, corrDist / 10);
    ctx.save();
    ctx.globalAlpha = 1 - fog * 0.85;

    // Pickup colors/icons by type
    const configs = {
      ammo:   { color: '#ffcc00', label: '⚡', bg: '#332200' },
      health: { color: '#ff4444', label: '♥', bg: '#220000' },
      key:    { color: '#44ffaa', label: '⚷', bg: '#002211' },
    };
    const cfg = configs[p.type] || { color: '#ffffff', label: '?', bg: '#222' };

    // Check z-buf
    const midCol = Math.max(0, Math.min(W - 1, screenX | 0));
    if (corrDist >= this._zBuf[midCol]) { ctx.restore(); return; }

    // Bob animation
    const bob = Math.sin(Date.now() * 0.003 + p.x + p.y) * 3;

    ctx.fillStyle = cfg.bg;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx, sy + bob, spriteW, spriteH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cfg.color;
    ctx.font = `bold ${Math.max(8, spriteH * 0.6)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.label, screenX, sy + spriteH / 2 + bob);

    ctx.restore();
  }

  // ── Gun Viewmodel ──────────────────────────────────────────────────────────────
  _drawGun(state) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const { player } = state;

    // Bob from movement
    const moving = player.moving || false;
    if (moving) {
      this._gunBob += 0.18;
    } else {
      this._gunBob *= 0.85;
    }
    const bobX = Math.sin(this._gunBob) * 6;
    const bobY = Math.abs(Math.cos(this._gunBob)) * 4;

    // Recoil
    if (this._gunShoot > 0) this._gunShoot = Math.max(0, this._gunShoot - 0.08);
    const recoilY = this._gunShoot * 18;
    const recoilX = (Math.random() * 2 - 1) * this._gunShoot * 3;

    const gx = W * 0.65 + bobX + recoilX;
    const gy = H * 0.55 + bobY + recoilY;
    const scale = H / 600;

    ctx.save();
    ctx.translate(gx, gy);
    ctx.scale(scale, scale);

    // ── Nerf blaster body (side view, pointing right = "forward" in screen space)
    // Main body — orange
    const bodyW = 160, bodyH = 55;
    const grad = ctx.createLinearGradient(0, 0, 0, bodyH);
    grad.addColorStop(0, '#ff8c00');
    grad.addColorStop(0.5, '#e06000');
    grad.addColorStop(1, '#c04800');
    ctx.fillStyle = grad;
    this._roundRect(ctx, -30, -bodyH/2, bodyW, bodyH, 8);
    ctx.fill();

    // Body highlight
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    this._roundRect(ctx, -28, -bodyH/2 + 4, bodyW - 4, 12, 4);
    ctx.fill();

    // Top rail
    ctx.fillStyle = '#333';
    ctx.fillRect(-20, -bodyH/2 - 10, 140, 10);

    // Barrel — extending forward (left on screen = "into the scene")
    const barrelGrad = ctx.createLinearGradient(0, -6, 0, 6);
    barrelGrad.addColorStop(0, '#555');
    barrelGrad.addColorStop(0.5, '#aaa');
    barrelGrad.addColorStop(1, '#333');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(-120, -6, 110, 12);

    // Barrel tip (muzzle)
    ctx.fillStyle = '#222';
    ctx.fillRect(-125, -8, 8, 16);

    // Grip / handle
    const gripGrad = ctx.createLinearGradient(40, 0, 40, 80);
    gripGrad.addColorStop(0, '#cc5500');
    gripGrad.addColorStop(1, '#882200');
    ctx.fillStyle = gripGrad;
    this._roundRect(ctx, 30, bodyH/2 - 5, 35, 70, 6);
    ctx.fill();

    // Trigger guard
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(55, bodyH/2 + 15, 18, 0, Math.PI);
    ctx.stroke();

    // Trigger
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(50, bodyH/2 + 8, 6, 18);

    // Ammo drum / mag
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.arc(20, bodyH/2 + 5, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.stroke();
    // drum detail
    ctx.fillStyle = '#cc4400';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(20 + Math.cos(a)*12, bodyH/2 + 5 + Math.sin(a)*12, 3, 0, Math.PI*2);
      ctx.fill();
    }

    // Sight / scope on top
    ctx.fillStyle = '#222';
    ctx.fillRect(40, -bodyH/2 - 22, 50, 12);
    ctx.fillStyle = '#004488';
    ctx.fillRect(44, -bodyH/2 - 20, 42, 8);
    // scope lens glint
    ctx.fillStyle = 'rgba(100,200,255,0.6)';
    ctx.fillRect(44, -bodyH/2 - 20, 10, 4);

    // Side logo
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NERF', 50, 4);

    // Muzzle flash
    if (this._muzzleFlash > 0) {
      const alpha = this._muzzleFlash / 200;
      const flashGrad = ctx.createRadialGradient(-125, 0, 0, -125, 0, 30);
      flashGrad.addColorStop(0, `rgba(255,240,100,${alpha})`);
      flashGrad.addColorStop(0.5, `rgba(255,140,0,${alpha * 0.6})`);
      flashGrad.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(-125, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Trigger animation ──────────────────────────────────────────────────────────
  triggerShoot() {
    this._gunShoot = 1;
    this._muzzleFlash = 200;
  }
}
