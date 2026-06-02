// nc-enemy.js — NERF OPS: Rogue Protocol — Enemy AI
'use strict';

// ─── Enemy type configs ────────────────────────────────────────────────────────
const ENEMY_TYPES = {
  grunt: {
    label: 'Grunt',
    health: 40,
    speed: 1.2,
    damage: 8,
    fireRate: 1800,   // ms between shots
    sightRange: 7,
    color: '#e05c20',
    accentColor: '#ff8844',
    size: 0.4,
    score: 100,
  },
  scout: {
    label: 'Scout',
    health: 25,
    speed: 2.2,
    damage: 5,
    fireRate: 1200,
    sightRange: 10,
    color: '#20a0e0',
    accentColor: '#44ccff',
    size: 0.35,
    score: 150,
  },
  heavy: {
    label: 'Heavy',
    health: 100,
    speed: 0.7,
    damage: 18,
    fireRate: 2500,
    sightRange: 6,
    color: '#8020e0',
    accentColor: '#bb44ff',
    size: 0.5,
    score: 250,
  },
  sniper: {
    label: 'Sniper',
    health: 30,
    speed: 0.8,
    damage: 30,
    fireRate: 3000,
    sightRange: 15,
    color: '#20e060',
    accentColor: '#44ff88',
    size: 0.38,
    score: 200,
  },
  commander: {
    label: 'Commander',
    health: 80,
    speed: 1.5,
    damage: 12,
    fireRate: 1400,
    sightRange: 12,
    color: '#e0c020',
    accentColor: '#ffdd44',
    size: 0.45,
    score: 400,
  },
  keyguard: {
    label: 'Key Guard',
    health: 50,
    speed: 1.0,
    damage: 10,
    fireRate: 2000,
    sightRange: 8,
    color: '#e02080',
    accentColor: '#ff44aa',
    size: 0.42,
    score: 200,
  },
  general: {
    label: 'Rogue General',
    health: 200,
    speed: 1.8,
    damage: 20,
    fireRate: 900,
    sightRange: 20,
    color: '#ff2020',
    accentColor: '#ff6060',
    size: 0.55,
    score: 1000,
  },
};

// ─── AI States ─────────────────────────────────────────────────────────────────
const AI_STATE = {
  PATROL:  'patrol',
  ALERT:   'alert',    // heard something, investigating
  CHASE:   'chase',
  ATTACK:  'attack',
  DEAD:    'dead',
};

class Enemy {
  constructor(cfg, map) {
    const type = ENEMY_TYPES[cfg.type] || ENEMY_TYPES.grunt;
    this.x = cfg.x;
    this.y = cfg.y;
    this.type = cfg.type;
    this.typeCfg = type;
    this.health = cfg.health || type.health;
    this.maxHealth = this.health;
    this.speed = type.speed;
    this.damage = type.damage;
    this.fireRate = type.fireRate;
    this.sightRange = type.sightRange;
    this.color = type.color;
    this.accentColor = type.accentColor;
    this.size = type.size;
    this.score = type.score;
    this.label = type.label;

    this.isCommander = cfg.isCommander || false;
    this.dropsKey = cfg.dropsKey || false;

    this.patrol = cfg.patrol || [{ x: cfg.x, y: cfg.y }];
    this.patrolIndex = 0;
    this.patrolDir = 1;

    this.state = AI_STATE.PATROL;
    this.angle = 0;
    this.lastShot = 0;
    this.alertTimer = 0;
    this.alertPos = null; // last known player position

    this._map = map;

    // For billboard sprite rendering
    this.screenX = 0;
    this.screenY = 0;
    this.dist = 0;
    this.visible = false;

    // Hit flash
    this._hitFlash = 0;

    // death animation
    this._deathTimer = 0;
    this._deathDuration = 600; // ms
  }

  // ── Main update ──────────────────────────────────────────────────────────────
  update(dt, playerX, playerY, playerAngle, now) {
    if (this.state === AI_STATE.DEAD) {
      this._deathTimer = Math.min(this._deathTimer + dt * 1000, this._deathDuration);
      return;
    }

    if (this._hitFlash > 0) this._hitFlash -= dt * 1000;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const canSee = dist < this.sightRange && this._hasLOS(playerX, playerY);

    switch (this.state) {
      case AI_STATE.PATROL:
        this._doPatrol(dt);
        if (canSee) {
          this.state = AI_STATE.CHASE;
          this.alertPos = { x: playerX, y: playerY };
        }
        break;

      case AI_STATE.ALERT:
        this.alertTimer -= dt * 1000;
        if (canSee) {
          this.state = AI_STATE.CHASE;
          this.alertPos = { x: playerX, y: playerY };
        } else if (this.alertPos) {
          this._moveToward(this.alertPos.x, this.alertPos.y, dt);
          const adx = this.alertPos.x - this.x;
          const ady = this.alertPos.y - this.y;
          if (Math.sqrt(adx*adx + ady*ady) < 0.5 || this.alertTimer <= 0) {
            this.state = AI_STATE.PATROL;
            this.alertPos = null;
          }
        } else {
          this.state = AI_STATE.PATROL;
        }
        break;

      case AI_STATE.CHASE:
        if (canSee) {
          this.alertPos = { x: playerX, y: playerY };
          if (dist < 2.0) {
            this.state = AI_STATE.ATTACK;
          } else {
            this._moveToward(playerX, playerY, dt);
          }
        } else {
          // lost sight — go to last known
          this.state = AI_STATE.ALERT;
          this.alertTimer = 3000;
        }
        break;

      case AI_STATE.ATTACK:
        // Face player
        this.angle = Math.atan2(dy, dx);
        if (!canSee || dist > 3.0) {
          this.state = AI_STATE.CHASE;
        } else {
          // Strafe slightly
          this._strafe(dt);
        }
        break;
    }

    // Always try to shoot if in chase/attack range and has LOS
    if ((this.state === AI_STATE.CHASE || this.state === AI_STATE.ATTACK)
        && canSee && dist < this.sightRange) {
      this._tryShoot(now, dist);
    }
  }

  // ── Shoot ─────────────────────────────────────────────────────────────────────
  _tryShoot(now, dist) {
    if (now - this.lastShot < this.fireRate) return null;
    this.lastShot = now;

    // Accuracy degrades with distance
    const accuracy = Math.max(0.05, 1 - dist / (this.sightRange * 1.5));
    const hit = Math.random() < accuracy;
    return hit ? this.damage : 0;
  }

  // Called by game loop — returns damage dealt this frame (0 if no shot)
  tryShootPlayer(playerX, playerY, now) {
    if (this.state === AI_STATE.DEAD) return 0;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.sightRange) return 0;
    if (!this._hasLOS(playerX, playerY)) return 0;
    if (now - this.lastShot < this.fireRate) return 0;
    this.lastShot = now;
    const accuracy = Math.max(0.05, 1 - dist / (this.sightRange * 1.5));
    return Math.random() < accuracy ? this.damage : 0;
  }

  // ── Patrol ────────────────────────────────────────────────────────────────────
  _doPatrol(dt) {
    if (this.patrol.length < 2) return;
    const target = this.patrol[this.patrolIndex];
    const moved = this._moveToward(target.x, target.y, dt);
    if (!moved) {
      // Reached waypoint
      this.patrolIndex += this.patrolDir;
      if (this.patrolIndex >= this.patrol.length) {
        this.patrolDir = -1;
        this.patrolIndex = this.patrol.length - 2;
      } else if (this.patrolIndex < 0) {
        this.patrolDir = 1;
        this.patrolIndex = 1;
      }
    }
  }

  // ── Move toward target ────────────────────────────────────────────────────────
  _moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return false; // already there

    this.angle = Math.atan2(dy, dx);
    const step = this.speed * dt;
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;

    // Collision check
    if (!this._isSolid(nx, this.y)) this.x = nx;
    if (!this._isSolid(this.x, ny)) this.y = ny;
    return true;
  }

  // ── Strafe ─────────────────────────────────────────────────────────────────────
  _strafe(dt) {
    const perp = this.angle + Math.PI / 2;
    const dir = Math.sin(Date.now() * 0.001) > 0 ? 1 : -1;
    const step = this.speed * 0.5 * dt;
    const nx = this.x + Math.cos(perp) * step * dir;
    const ny = this.y + Math.sin(perp) * step * dir;
    if (!this._isSolid(nx, this.y)) this.x = nx;
    if (!this._isSolid(this.x, ny)) this.y = ny;
  }

  // ── LOS check (simple ray march) ─────────────────────────────────────────────
  _hasLOS(tx, ty) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / 0.1);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const cx = this.x + dx * t;
      const cy = this.y + dy * t;
      if (this._isSolid(cx, cy)) return false;
    }
    return true;
  }

  // ── Solid tile check ──────────────────────────────────────────────────────────
  _isSolid(x, y) {
    const map = this._map;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= map.width || iy >= map.height) return true;
    const t = map.grid[iy * map.width + ix];
    return t === NC_TILE.WALL || t === NC_TILE.CRATE || t === NC_TILE.DOOR;
  }

  // ── Take damage ────────────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (this.state === AI_STATE.DEAD) return false;
    this.health -= amount;
    this._hitFlash = 200;
    if (this.state === AI_STATE.PATROL || this.state === AI_STATE.ALERT) {
      this.state = AI_STATE.CHASE;
    }
    if (this.health <= 0) {
      this.health = 0;
      this.state = AI_STATE.DEAD;
      this._deathTimer = 0;
      return true; // died
    }
    return false;
  }

  // ── Alert nearby enemies ───────────────────────────────────────────────────────
  alert(px, py) {
    if (this.state === AI_STATE.PATROL) {
      this.state = AI_STATE.ALERT;
      this.alertPos = { x: px, y: py };
      this.alertTimer = 4000;
    }
  }

  get isDead() { return this.state === AI_STATE.DEAD; }
  get deathProgress() { return this._deathTimer / this._deathDuration; }
  get isFlashing() { return this._hitFlash > 0; }
}
