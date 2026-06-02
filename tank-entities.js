// tank-entities.js — All game object classes

// ────────────────────────────────────────────────────────────
//  PLAYER TANK
// ────────────────────────────────────────────────────────────
class PlayerTank {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;          // Hull facing angle (radians)
    this.turretAngle = 0;    // Turret world angle (independent, 360°)
    this.speed = 0;
    this.maxSpeed = 180;
    this.reverseMax = 80;
    this.accel = 240;
    this.friction = 200;
    this.turnRate = 2.2;     // rad/s at full speed
    this.width = 36;
    this.height = 52;
    this.vx = 0;
    this.vy = -1;

    this.hp = 250;
    this.maxHp = 250;
    this.alive = true;

    // Cannon
    this.shells = 30;
    this.cannonCooldown = 0;
    this.cannonCooldownMax = 2.0;

    // MG
    this.mgHeat = 0;
    this.mgOverheat = false;
    this.mgCooldown = 0;
    this.mgFireRate = 0.08;

    // Damage flash + recoil
    this.flashTimer = 0;
    this.recoilTimer = 0;   // barrel recoil
    this.recoilMax = 0.15;

    // Track animation
    this.trackOffset = 0;
  }

  update(dt, keys, map, worldOffsetX, enemies) {
    if (!this.alive) return;

    // ── Driver: absolute directional movement (Arrow keys) ────
    const up    = keys['ArrowUp'];
    const down  = keys['ArrowDown'];
    const left  = keys['ArrowLeft'];
    const right = keys['ArrowRight'];

    let moveX = 0;
    let moveY = 0;

    if (up)    moveY -= 1;
    if (down)  moveY += 1;
    if (left)  moveX -= 1;
    if (right) moveX += 1;

    const isMoving = (moveX !== 0 || moveY !== 0);

    if (isMoving) {
      // Normalize vector
      const mag = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= mag;
      moveY /= mag;

      // Target angle
      const targetAngle = Math.atan2(moveX, -moveY);
      
      // Smooth rotate hull towards target angle
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, 15 * dt);

      this.vx = moveX;
      this.vy = moveY;
      this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    } else {
      // Friction
      this.speed = Math.max(0, this.speed - this.friction * dt);
    }

    // Move — use circle collider (radius 22) for rotation-invariant sliding
    const r = 22;
    const nx = this.x + this.vx * this.speed * dt;
    const ny = this.y + this.vy * this.speed * dt;

    // X axis
    if (!this.circleCollidesWithMap(nx, this.y, r, map) && !this.circleCollidesWithBunkers(nx, this.y, r, enemies)) this.x = nx;
    // Y axis
    if (!this.circleCollidesWithMap(this.x, ny, r, map) && !this.circleCollidesWithBunkers(this.x, ny, r, enemies)) this.y = ny;

    // Track animation
    this.trackOffset = (this.trackOffset + Math.abs(this.speed) * dt * 0.8) % 12;

    // ── Gunner: rotate turret 360° (A/D) ──────────────────────
    const turretSpeed = 2.5; // rad/s
    if (keys['KeyA']) this.turretAngle -= turretSpeed * dt;
    if (keys['KeyD']) this.turretAngle += turretSpeed * dt;

    // Weapons timers
    if (this.cannonCooldown > 0) this.cannonCooldown -= dt;

    // MG heat / cooldown — key is KeyS (e.code)
    const mgFiring = keys['KeyS'];
    if (!mgFiring) {
      if (this.mgHeat > 0) this.mgHeat = Math.max(0, this.mgHeat - dt * 0.4);
      if (this.mgOverheat && this.mgHeat <= 0) this.mgOverheat = false;
    }
    if (this.mgCooldown > 0) this.mgCooldown -= dt;

    // Muzzle flash / recoil timers
    if (this.recoilTimer > 0) this.recoilTimer -= dt;

    // Flash
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // Death check
    if (this.hp <= 0) this.alive = false;
  }

  circleCollidesWithBunkers(wx, wy, r, enemies) {
    if (!enemies) return false;
    for (const e of enemies) {
      if (e instanceof EnemyBunker && e.alive) {
        const dx = wx - e.x;
        const dy = wy - e.y;
        if (dx*dx + dy*dy < (r + 20)*(r + 20)) return true;
      }
    }
    return false;
  }

  // Circle collider — rotation-invariant, feels great for a tank
  circleCollidesWithMap(wx, wy, r, map) {
    // Check 8 points on the circle perimeter
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = wx + Math.cos(a) * r;
      const cy = wy + Math.sin(a) * r;
      const col = Math.floor(cx / TILE_SIZE);
      const row = Math.floor(cy / TILE_SIZE);
      if (isSolid(getTile(map, col, row))) return true;
    }
    return false;
  }

  // Legacy AABB — kept for reference but no longer called
  collidesWithMap(wx, wy, map) {
    const hw = this.width / 2 - 4, hh = this.height / 2 - 4;
    const corners = [
      {x: wx-hw, y: wy-hh}, {x: wx+hw, y: wy-hh},
      {x: wx+hw, y: wy+hh}, {x: wx-hw, y: wy+hh},
    ];
    for (const c of corners) {
      if (isSolid(getTile(map, Math.floor(c.x/TILE_SIZE), Math.floor(c.y/TILE_SIZE)))) return true;
    }
    return false;
  }

  fireCannon(projectiles) {
    if (this.cannonCooldown > 0 || this.shells <= 0) return false;
    this.cannonCooldown = this.cannonCooldownMax;
    this.recoilTimer = this.recoilMax;
    this.shells--;

    // Spawn shell from barrel tip
    const bx = this.x + Math.sin(this.turretAngle) * 40;
    const by = this.y - Math.cos(this.turretAngle) * 40;
    projectiles.push(new CannonShell(bx, by, this.turretAngle, 600, 'player'));
    return true;
  }

  fireMG(projectiles) {
    if (this.mgCooldown > 0 || this.mgOverheat) return false;
    this.mgCooldown = this.mgFireRate;
    this.mgHeat = Math.min(1, this.mgHeat + 0.06);
    if (this.mgHeat >= 1) this.mgOverheat = true;

    const spread = (Math.random() - 0.5) * 0.08;
    const bx = this.x + Math.sin(this.turretAngle) * 38;
    const by = this.y - Math.cos(this.turretAngle) * 38;
    projectiles.push(new MGBullet(bx, by, this.turretAngle + spread, 900, 'player'));
    return true;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.flashTimer = 0.25;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;

    ctx.save();
    ctx.translate(sx, sy);

    // Flash overlay
    const flashing = this.flashTimer > 0;

    ctx.rotate(this.angle);

    // --- Tracks ---
    ctx.fillStyle = flashing ? '#ff6666' : '#1a1a1a';
    const tw = 10, th = this.height + 4;
    ctx.fillRect(-this.width/2 - tw + 2, -th/2, tw, th);
    ctx.fillRect( this.width/2 - 2,       -th/2, tw, th);

    // Track tread marks
    ctx.fillStyle = flashing ? '#ff9999' : '#2d2d2d';
    for (let i = 0; i < 7; i++) {
      const yOff = -th/2 + ((i * 8 + this.trackOffset) % th);
      ctx.fillRect(-this.width/2 - tw + 3, yOff, tw - 2, 3);
      ctx.fillRect(this.width/2 - 1, yOff, tw - 2, 3);
    }

    // --- Hull ---
    ctx.fillStyle = flashing ? '#ff8888' : '#4a6741';
    ctx.beginPath();
    ctx.moveTo(-this.width/2 + 4, -this.height/2);
    ctx.lineTo( this.width/2 - 4, -this.height/2);
    ctx.lineTo( this.width/2,     -this.height/2 + 12);
    ctx.lineTo( this.width/2,      this.height/2 - 10);
    ctx.lineTo(-this.width/2,      this.height/2 - 10);
    ctx.lineTo(-this.width/2,     -this.height/2 + 12);
    ctx.closePath();
    ctx.fill();

    // Hull detail - armour plates
    ctx.fillStyle = flashing ? '#ff9999' : '#3d5735';
    ctx.fillRect(-this.width/2 + 2, -this.height/2 + 4, 8, this.height - 18);
    ctx.fillRect( this.width/2 - 10, -this.height/2 + 4, 8, this.height - 18);

    // Hull hatch
    ctx.fillStyle = flashing ? '#ffaaaa' : '#2c3d28';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // --- Turret (independent rotation) ---
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.turretAngle);

    // Recoil: push barrel back during recoilTimer
    const recoilOffset = this.recoilTimer > 0
      ? (this.recoilTimer / this.recoilMax) * 8
      : 0;

    // Aim line (faint dashed line from barrel tip)
    ctx.save();
    ctx.strokeStyle = 'rgba(200,255,150,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.lineTo(0, -160);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Barrel
    ctx.fillStyle = flashing ? '#ff8888' : '#334c2a';
    const barrelY = -this.height/2 - 20 + recoilOffset;
    ctx.fillRect(-4, barrelY, 8, this.height/2 + 18);

    // Muzzle flash
    if (this.recoilTimer > this.recoilMax * 0.6) {
      ctx.fillStyle = 'rgba(255,220,80,0.85)';
      ctx.beginPath();
      ctx.arc(0, barrelY, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Barrel tip
    ctx.fillStyle = flashing ? '#ff6666' : '#222';
    ctx.fillRect(-3, barrelY, 6, 5);

    // Turret dome
    ctx.fillStyle = flashing ? '#ff8888' : '#4a6741';
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turret armour ring
    ctx.strokeStyle = flashing ? '#ff9999' : '#3d5735';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 13, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // HP bar above tank
    const hpPct = this.hp / this.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - 24, sy - 46, 48, 6);
    ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(sx - 24, sy - 46, 48 * hpPct, 6);
  }
}

// ────────────────────────────────────────────────────────────
//  ENEMY BASE
// ────────────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, hp) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.alive = true;
    this.flashTimer = 0;
    this.score = 100;
  }
  takeDamage(dmg) {
    this.hp -= dmg;
    this.flashTimer = 0.2;
    if (this.hp <= 0) { this.alive = false; return true; }
    return false;
  }
  drawHpBar(ctx, sx, sy, w = 36) {
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - w/2, sy - 36, w, 5);
    ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(sx - w/2, sy - 36, w * pct, 5);
  }
}

// Infantry unit — moves toward tank, fires MG
class EnemyInfantry extends Enemy {
  constructor(x, y) {
    super(x, y, 30);
    this.angle = 0;
    this.speed = 55;
    this.fireTimer = 1.5 + Math.random();
    this.score = 50;
    this.radius = 12;
    this.stuckTimer = 0;      // time spent unable to move
    this.escapeAngle = 0;     // direction to try when stuck
    this.escapeTimer = 0;     // how long to force escape angle
    // Crush state
    this.crushed = false;
    this.crushTimer = 0;
  }

  update(dt, playerTank, projectiles, map) {
    if (!this.alive) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // ── Crush death — if crushed, play flatten anim then die ──
    if (this.crushed) {
      this.crushTimer -= dt;
      if (this.crushTimer <= 0) this.alive = false;
      return;
    }

    const dx = playerTank.x - this.x;
    const dy = playerTank.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    this.angle = Math.atan2(dx, -dy);
    const hasLoS = hasLineOfSight(this.x, this.y, playerTank.x, playerTank.y, map);

    let moveAngle = this.angle;
    if (!hasLoS) {
      moveAngle += (Math.sin(this.x * 0.05) > 0 ? 0.8 : -0.8);
    }

    // ── Wall-escape recovery: if stuck inside solid, push outward ──
    const myCol = Math.floor(this.x / TILE_SIZE);
    const myRow = Math.floor(this.y / TILE_SIZE);
    if (isSolid(getTile(map, myCol, myRow))) {
      // Immediately step away from the wall center
      const tileCx = (myCol + 0.5) * TILE_SIZE;
      const tileCy = (myRow + 0.5) * TILE_SIZE;
      this.x += (this.x - tileCx) * 0.3 + 1;
      this.y += (this.y - tileCy) * 0.3 + 1;
      return; // skip normal movement this frame
    }

    if (this.escapeTimer > 0) {
      this.escapeTimer -= dt;
      moveAngle = this.escapeAngle;
    }

    if (dist > 120 || !hasLoS || this.escapeTimer > 0) {
      const nx = this.x + Math.sin(moveAngle) * this.speed * dt;
      const ny = this.y - Math.cos(moveAngle) * this.speed * dt;

      // Circle-based wall check (r=10)
      let colX = false, colY = false;
      const r = 10;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (!colX && isSolid(getTile(map, Math.floor((nx + Math.cos(a)*r) / TILE_SIZE), Math.floor((this.y + Math.sin(a)*r) / TILE_SIZE)))) colX = true;
        if (!colY && isSolid(getTile(map, Math.floor((this.x + Math.cos(a)*r) / TILE_SIZE), Math.floor((ny + Math.sin(a)*r) / TILE_SIZE)))) colY = true;
      }

      if (!colX) this.x = nx;
      if (!colY) this.y = ny;

      // Stuck detection: if sliding against any wall, eventually bounce away
      if ((colX || colY) && this.escapeTimer <= 0) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 0.2) {
          this.escapeTimer = 0.5 + Math.random() * 0.5; // escape for 0.5 to 1s
          this.escapeAngle = moveAngle + (Math.random() < 0.5 ? 1.5 : -1.5);
          this.stuckTimer = 0;
        }
      } else if (!colX && !colY) {
        this.stuckTimer = 0;
      }
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist < 350 && hasLoS) {
      this.fireTimer = 1.2 + Math.random() * 0.8;
      const spread = (Math.random() - 0.5) * 0.18;
      projectiles.push(new MGBullet(this.x, this.y, this.angle + spread, 400, 'enemy'));
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    if (!this.alive) return;

    // ── Crushed: draw flattened splat ──
    if (this.crushed) {
      const pct = Math.max(0, this.crushTimer / 0.6);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.globalAlpha = pct;
      // Blood splat
      ctx.fillStyle = '#8B0000';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI*2);
      ctx.fill();
      // Flattened body
      ctx.fillStyle = '#3a2a0a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    const fl = this.flashTimer > 0;
    // Body
    ctx.fillStyle = fl ? '#ff8888' : '#5c4a2a';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    // Body shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 8, 5, 0, 0, Math.PI*2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = fl ? '#ff9999' : '#3d5735';
    ctx.beginPath();
    ctx.arc(0, -2, 7, Math.PI, 0);
    ctx.fill();
    // Helmet band
    ctx.strokeStyle = fl ? '#ffaaaa' : '#2c3d22';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -2); ctx.lineTo(7, -2);
    ctx.stroke();
    // Rifle
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-1.5, -17, 3, 15);
    // Rifle grip
    ctx.fillStyle = '#3a2a10';
    ctx.fillRect(-1.5, -8, 3, 4);

    ctx.restore();
    // Ground shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 4, 10, 6, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    this.drawHpBar(ctx, sx, sy, 24);
  }
}

// Bunker — stationary, armoured, fires shells
class EnemyBunker extends Enemy {
  constructor(x, y) {
    super(x, y, 150);
    this.fireTimer = 3 + Math.random() * 2;
    this.angle = 0;
    this.score = 150;
  }

  update(dt, playerTank, projectiles, map) {
    if (!this.alive) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    const dx = playerTank.x - this.x;
    const dy = playerTank.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    this.angle = Math.atan2(dx, -dy);

    this.fireTimer -= dt;
    // Only fire when player is in sight
    if (this.fireTimer <= 0 && dist < 600 && hasLineOfSight(this.x, this.y, playerTank.x, playerTank.y, map)) {
      this.fireTimer = 2.5 + Math.random();
      const spread = (Math.random() - 0.5) * 0.05;
      projectiles.push(new CannonShell(this.x, this.y, this.angle + spread, 350, 'enemy'));
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    if (!this.alive) return;

    const fl = this.flashTimer > 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Bunker base
    ctx.fillStyle = fl ? '#888877' : '#555a4a';
    ctx.fillRect(-22, -22, 44, 44);

    // Sandbags
    ctx.fillStyle = fl ? '#ccbb88' : '#9a8a60';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a)*20, Math.sin(a)*20, 8, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rotating turret
    ctx.rotate(this.angle);
    ctx.fillStyle = fl ? '#aaaaaa' : '#444';
    ctx.fillRect(-4, -26, 8, 20);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI*2);
    ctx.fillStyle = fl ? '#999988' : '#4a4a3a';
    ctx.fill();

    ctx.restore();
    this.drawHpBar(ctx, sx, sy, 44);
  }
}

// Enemy Tank — moves, aims, fires cannon
class EnemyTank extends Enemy {
  constructor(x, y) {
    super(x, y, 200);
    this.angle = Math.PI;
    this.turretAngle = Math.PI;
    this.speed = 0;
    this.maxSpeed = 80;
    this.fireTimer = 4 + Math.random() * 2;
    this.moveTimer = 0;
    this.moveDir = 1;
    this.score = 300;
    this.width = 32;
    this.height = 48;
    this.trackOffset = 0;
    this.stuckTimer = 0;
    this.escapeTimer = 0;
    this.escapeAngle = 0;
  }

  update(dt, playerTank, projectiles, map) {
    if (!this.alive) return;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    const dx = playerTank.x - this.x;
    const dy = playerTank.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Turret always aims at player
    this.turretAngle = Math.atan2(dx, -dy);

    // Simple patrol/approach AI
    this.moveTimer -= dt;
    if (this.moveTimer <= 0) {
      this.moveTimer = 1.5 + Math.random() * 2;
      this.moveDir = Math.random() < 0.7 ? 1 : -1;
      if (dist > 300) {
        this.angle = this.turretAngle + (Math.random()-0.5)*0.5;
      } else {
        this.angle += (Math.random()-0.5) * 0.8;
      }
    }

    if (dist > 150 || this.escapeTimer > 0) {
      this.speed = Math.min(this.maxSpeed, this.speed + 120 * dt);
    } else {
      this.speed = Math.max(0, this.speed - 180 * dt);
    }

    if (this.escapeTimer > 0) {
      this.escapeTimer -= dt;
      this.angle = this.escapeAngle;
      this.moveDir = 1;
    }

    // Move with wall slide collision
    const nx = this.x + Math.sin(this.angle) * this.speed * dt * this.moveDir;
    const ny = this.y - Math.cos(this.angle) * this.speed * dt * this.moveDir;
    
    // Circle-based wall check for the tank body
    let colX = false, colY = false;
    const r = 20; // Enemy tank radius

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!colX && isSolid(getTile(map, Math.floor((nx + Math.cos(a)*r) / TILE_SIZE), Math.floor((this.y + Math.sin(a)*r) / TILE_SIZE)))) colX = true;
      if (!colY && isSolid(getTile(map, Math.floor((this.x + Math.cos(a)*r) / TILE_SIZE), Math.floor((ny + Math.sin(a)*r) / TILE_SIZE)))) colY = true;
    }

    if (!colX) this.x = nx;
    if (!colY) this.y = ny;

    if ((colX || colY) && this.escapeTimer <= 0) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 0.3) {
        this.escapeTimer = 0.8 + Math.random();
        this.escapeAngle = this.angle + (Math.random() < 0.5 ? 1.5 : -1.5);
        this.stuckTimer = 0;
      }
    } else if (!colX && !colY) {
      this.stuckTimer = 0;
    }

    this.trackOffset = (this.trackOffset + this.speed * dt * 0.6) % 12;

    // Fire
    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && dist < 500 && hasLineOfSight(this.x, this.y, playerTank.x, playerTank.y, map)) {
      this.fireTimer = 3 + Math.random() * 2;
      projectiles.push(new CannonShell(this.x, this.y, this.turretAngle, 350, 'enemy'));
    }
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    if (!this.alive) return;
    const fl = this.flashTimer > 0;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Tracks
    ctx.fillStyle = fl ? '#884444' : '#1a1a1a';
    const tw = 9, th = this.height + 4;
    ctx.fillRect(-this.width/2 - tw + 2, -th/2, tw, th);
    ctx.fillRect( this.width/2 - 2,      -th/2, tw, th);

    // Tread marks
    ctx.fillStyle = fl ? '#aa6666' : '#2d2d2d';
    for (let i = 0; i < 7; i++) {
      const yOff = -th/2 + ((i * 8 + this.trackOffset) % th);
      ctx.fillRect(-this.width/2 - tw + 3, yOff, tw-2, 3);
      ctx.fillRect(this.width/2 - 1, yOff, tw-2, 3);
    }

    // Hull — red/brown enemy colour
    ctx.fillStyle = fl ? '#ff8888' : '#6b3a3a';
    ctx.beginPath();
    ctx.moveTo(-this.width/2 + 4, -this.height/2);
    ctx.lineTo( this.width/2 - 4, -this.height/2);
    ctx.lineTo( this.width/2,     -this.height/2 + 10);
    ctx.lineTo( this.width/2,      this.height/2 - 8);
    ctx.lineTo(-this.width/2,      this.height/2 - 8);
    ctx.lineTo(-this.width/2,     -this.height/2 + 10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Turret
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.turretAngle);

    ctx.fillStyle = fl ? '#ff7777' : '#4a2222';
    ctx.fillRect(-3, -this.height/2 - 14, 6, this.height/2 + 12);
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = fl ? '#ff8888' : '#6b3a3a';
    ctx.fill();

    ctx.restore();
    this.drawHpBar(ctx, sx, sy, 40);
  }
}

// ────────────────────────────────────────────────────────────
//  PROJECTILES
// ────────────────────────────────────────────────────────────
class CannonShell {
  constructor(x, y, angle, speed, owner) {
    this.x = x;
    this.y = y;
    this.vx = Math.sin(angle) * speed;
    this.vy = -Math.cos(angle) * speed;
    this.angle = angle;
    this.owner = owner; // 'player' or 'enemy'
    this.alive = true;
    this.damage = this.owner === 'player' ? 50 : 25;
    this.radius = 5;
    this.trail = [];
  }
  update(dt, map, worldOffX) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Tile collision
    const col = Math.floor((this.x + worldOffX) / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    if (isSolid(getTile(map, col, row))) {
      this.alive = false;
    }
  }
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const a = i / this.trail.length;
      ctx.fillStyle = `rgba(255,180,50,${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(this.trail[i].x - camX, this.trail[i].y - camY, this.radius * a, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.fillStyle = this.owner === 'player' ? '#ffdd44' : '#ff4444';
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sx - 1, sy - 1, 2, 0, Math.PI*2);
    ctx.fill();
  }
}

class MGBullet {
  constructor(x, y, angle, speed, owner) {
    this.x = x;
    this.y = y;
    this.vx = Math.sin(angle) * speed;
    this.vy = -Math.cos(angle) * speed;
    this.angle = angle;
    this.owner = owner;
    this.alive = true;
    this.damage = this.owner === 'player' ? 8 : 4;
    this.radius = 3;
    this.life = 1.2;
  }
  update(dt, map, worldOffX) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }

    const col = Math.floor((this.x + worldOffX) / TILE_SIZE);
    const row = Math.floor(this.y / TILE_SIZE);
    if (isSolid(getTile(map, col, row))) this.alive = false;
  }
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    // Tracer line
    ctx.strokeStyle = this.owner === 'player' ? 'rgba(200,240,255,0.8)' : 'rgba(255,100,100,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - this.vx * 0.03, sy - this.vy * 0.03);
    ctx.stroke();

    ctx.fillStyle = this.owner === 'player' ? '#c8f0ff' : '#ff8888';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI*2);
    ctx.fill();
  }
}

// ────────────────────────────────────────────────────────────
//  PARTICLES
// ────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.alive = true;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx, camX, camY) {
    const a = this.life / this.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camX, this.y - camY, this.size * a, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function spawnExplosion(x, y, size, particles) {
  const count = Math.floor(size * 1.5);
  const colors = ['#ff5500','#ff8800','#ffcc00','#ffffff','#884422'];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * size * 5;
    const color = colors[Math.floor(Math.random() * colors.length)];
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color,
      0.5 + Math.random() * 0.5,
      2 + Math.random() * (size / 6)
    ));
  }
  // Smoke
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 40;
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 30,
      `rgba(80,80,80,0.8)`,
      0.8 + Math.random() * 0.6,
      4 + Math.random() * (size / 4)
    ));
  }
}

// ────────────────────────────────────────────────────────────
//  MAP HELPER (used by entities)
// ────────────────────────────────────────────────────────────
function getTile(map, col, row) {
  if (row < 0 || row >= map.length) return T.WALL;
  if (col < 0 || col >= map[0].length) return T.WALL;
  return map[row][col];
}

// ────────────────────────────────────────────────────────────
//  AMMO CRATE — dropped by killed enemies (25% chance)
// ────────────────────────────────────────────────────────────
class AmmoCrate {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.alive = true;
    this.pulse = Math.random() * Math.PI * 2; // phase offset for pulsing glow
  }
  update(dt, playerTank) {
    this.pulse += dt * 3;
    // Pickup radius
    const dx = playerTank.x - this.x;
    const dy = playerTank.y - this.y;
    if (dx*dx + dy*dy < 32*32) {
      playerTank.shells = Math.min(30, playerTank.shells + 10);
      this.alive = false;
    }
  }
  draw(ctx, camX, camY) {
    const sx = this.x - camX;
    const sy = this.y - camY;
    const glow = 0.4 + 0.3 * Math.sin(this.pulse);

    // Glow ring
    ctx.strokeStyle = `rgba(255,220,50,${glow})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.stroke();

    // Crate body
    ctx.fillStyle = '#5a4a1a';
    ctx.fillRect(sx - 11, sy - 11, 22, 22);
    ctx.fillStyle = '#8a7a3a';
    ctx.fillRect(sx - 9, sy - 9, 18, 18);

    // Cross straps
    ctx.fillStyle = '#4a3a10';
    ctx.fillRect(sx - 11, sy - 2, 22, 4);
    ctx.fillRect(sx - 2, sy - 11, 4, 22);

    // Shell symbol
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔴', sx, sy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

// ────────────────────────────────────────────────────────────
//  FLOATING TEXT — kill confirmation feedback
// ────────────────────────────────────────────────────────────
class FloatingText {
  constructor(x, y, text, color = '#ffdd44') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 1.4;
    this.maxLife = 1.4;
    this.vy = -60; // floats upward
    this.alive = true;
  }
  update(dt) {
    this.y += this.vy * dt;
    this.vy *= 0.93;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx, camX, camY) {
    const alpha = Math.min(1, this.life / this.maxLife * 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.text, this.x - camX, this.y - camY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }
}

