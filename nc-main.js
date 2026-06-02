// nc-main.js — NERF OPS: Rogue Protocol — Campaign Controller
'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const GAME_STATE = {
  MENU:     'menu',
  BRIEFING: 'briefing',
  PLAYING:  'playing',
  PAUSED:   'paused',
  LEVEL_END:'level_end',
  GAME_OVER:'game_over',
  VICTORY:  'victory',
};

const PLAYER_DEFAULTS = {
  health: 100,
  maxHealth: 100,
  ammo: 30,
  maxAmmo: 30,
  speed: 2.8,
  turnSpeed: 2.0,
  hasKey: false,
};

// ─── NerfOpsGame ──────────────────────────────────────────────────────────────
class NerfOpsGame {
  constructor() {
    // DOM
    this.gameCanvas  = document.getElementById('game-canvas');
    this.hudCanvas   = document.getElementById('hud-canvas');
    this.menuOverlay = document.getElementById('menu-overlay');
    this.briefingEl  = document.getElementById('briefing-panel');

    // Size canvases to viewport
    const W = window.innerWidth, H = window.innerHeight;
    this.gameCanvas.width  = W;  this.gameCanvas.height  = H;
    this.hudCanvas.width   = W;  this.hudCanvas.height   = H;

    // Modules
    this.engine = new NCEngine(this.gameCanvas);
    this.hud    = new NCHUD(this.hudCanvas);

    // State
    this.gameState = GAME_STATE.MENU;
    this.currentLevelIndex = 0;
    this.score = 0;
    this.totalScore = 0;
    this.elapsedTime = 0;

    // Player
    this.player = { ...PLAYER_DEFAULTS, x: 0, y: 0, angle: 0, moving: false };

    // Level runtime data
    this.map = null;
    this.enemies = [];
    this.pickups = [];
    this.objectives = [];
    this.exitUnlocked = false;

    // Input
    this._keys = {};
    this._lastShot = 0;
    this._shootCooldown = 250; // ms
    this._reloadTime = 0;
    this._isReloading = false;
    this._stepTimer = 0;

    // Timing
    this._lastTime = 0;
    this._rafId = null;

    // Mouse look
    this._mouseLocked = false;
    this._mouseSensitivity = 0.0018;

    this._bindEvents();
    this._loadSave();
    this._buildMenuUI();
  }

  // ─── Save / Load ─────────────────────────────────────────────────────────────
  _loadSave() {
    try {
      const raw = localStorage.getItem('nerfops_save');
      if (raw) {
        const data = JSON.parse(raw);
        this.currentLevelIndex = Math.min(data.level || 0, NC_LEVELS.length - 1);
        this.totalScore = data.totalScore || 0;
      }
    } catch (e) { /* ignore */ }
  }

  _save() {
    try {
      localStorage.setItem('nerfops_save', JSON.stringify({
        level: this.currentLevelIndex,
        totalScore: this.totalScore,
      }));
    } catch (e) { /* ignore */ }
  }

  _clearSave() {
    localStorage.removeItem('nerfops_save');
    this.currentLevelIndex = 0;
    this.totalScore = 0;
  }

  // ─── Menu ─────────────────────────────────────────────────────────────────────
  _buildMenuUI() {
    const menu = this.menuOverlay;
    menu.innerHTML = `
      <div class="menu-box">
        <div class="menu-logo">NERF OPS</div>
        <div class="menu-subtitle">ROGUE PROTOCOL</div>
        <div class="menu-divider"></div>
        ${this.currentLevelIndex > 0 ? `
          <button class="menu-btn primary" id="btn-continue">
            ▶ CONTINUE — LEVEL ${this.currentLevelIndex + 1}
          </button>` : ''}
        <button class="menu-btn primary" id="btn-start">
          ${this.currentLevelIndex > 0 ? '↺ NEW GAME' : '▶ START MISSION'}
        </button>
        <div class="menu-level-select" id="level-select">
          ${NC_LEVELS.map((l, i) => `
            <button class="menu-btn level-btn ${i > this.currentLevelIndex ? 'locked' : ''}"
              data-level="${i}" ${i > this.currentLevelIndex ? 'disabled' : ''}>
              ${i > this.currentLevelIndex ? '🔒' : '▶'} Level ${l.id}: ${l.name}
            </button>`).join('')}
        </div>
        <div class="menu-controls">
          <span>WASD / Arrows — Move</span>
          <span>Mouse — Aim</span>
          <span>LClick / Space — Fire</span>
          <span>R — Reload</span>
          <span>ESC — Pause</span>
        </div>
        <div class="menu-score">Career Score: ${this.totalScore}</div>
      </div>
    `;

    const btnContinue = document.getElementById('btn-continue');
    if (btnContinue) {
      btnContinue.addEventListener('click', () => this._startLevel(this.currentLevelIndex));
    }
    document.getElementById('btn-start').addEventListener('click', () => {
      if (this.currentLevelIndex > 0) { this._clearSave(); this._buildMenuUI(); return; }
      this._startLevel(0);
    });
    document.querySelectorAll('.level-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this._startLevel(parseInt(btn.dataset.level));
      });
    });

    menu.style.display = 'flex';
  }

  // ─── Level Loading ────────────────────────────────────────────────────────────
  _startLevel(index) {
    this.currentLevelIndex = index;
    const levelDef = NC_LEVELS[index];
    this.menuOverlay.style.display = 'none';
    this._showBriefing(levelDef);
  }

  _showBriefing(levelDef) {
    this.gameState = GAME_STATE.BRIEFING;
    this.briefingEl.style.display = 'flex';
    this.briefingEl.innerHTML = `
      <div class="briefing-box">
        <div class="briefing-level">MISSION ${levelDef.id} / ${NC_LEVELS.length}</div>
        <div class="briefing-title">${levelDef.name}</div>
        <div class="briefing-subtitle">${levelDef.subtitle}</div>
        <div class="briefing-text">
          ${levelDef.briefing.map(b => `<p>${b}</p>`).join('')}
        </div>
        <button class="menu-btn primary" id="btn-deploy">▶ DEPLOY</button>
      </div>
    `;
    document.getElementById('btn-deploy').addEventListener('click', () => {
      this.briefingEl.style.display = 'none';
      this._loadLevel(levelDef);
    });
  }

  _loadLevel(levelDef) {
    // Map
    this.map = {
      width:       levelDef.width,
      height:      levelDef.height,
      grid:        levelDef.grid,
      wallTex:     levelDef.wallTex || 0,
      ambientColor:levelDef.ambientColor,
      fogColor:    levelDef.fogColor,
      fogDepth:    levelDef.fogDepth || 10,
      winCondition:levelDef.winCondition,
      par:         levelDef.par,
      id:          levelDef.id,
      name:        levelDef.name,
    };

    // Player
    const sp = levelDef.playerStart;
    this.player = {
      ...PLAYER_DEFAULTS,
      x: sp.x,
      y: sp.y,
      angle: sp.angle || 0,
      moving: false,
    };

    // Enemies
    this.enemies = levelDef.enemies.map(cfg => new Enemy(cfg, this.map));

    // Pickups (merge level pickups + any from levelDef.pickups)
    this.pickups = (levelDef.pickups || []).map(p => ({ ...p, collected: false }));

    // Objectives
    this.objectives = (levelDef.objectives || []).map(o => ({ ...o, completed: false }));
    // Mark barrels in map for destroy objectives
    for (const obj of this.objectives) {
      if (obj.type === 'destroy_barrel') {
        // Already present in grid as T.BARREL
      }
    }

    // State
    this.score = 0;
    this.elapsedTime = 0;
    this.exitUnlocked = false;
    this._isReloading = false;
    this._reloadTime = 0;
    this.gameState = GAME_STATE.PLAYING;

    // Request pointer lock
    this.gameCanvas.requestPointerLock();

    // Start loop
    this._lastTime = performance.now();
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._loop(this._lastTime);
  }

  // ─── Main Loop ────────────────────────────────────────────────────────────────
  _loop(now) {
    if (this.gameState !== GAME_STATE.PLAYING) {
      this._rafId = requestAnimationFrame(t => this._loop(t));
      return;
    }

    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;
    this.elapsedTime += dt;

    this._handleInput(dt, now);
    this._updateEnemies(dt, now);
    this._checkPickups();
    this._checkWinCondition();

    // Render
    const state = this._buildRenderState();
    this.engine.render(state);
    this.hud.draw(state, dt);

    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  // ─── Build render state ───────────────────────────────────────────────────────
  _buildRenderState() {
    return {
      player:      this.player,
      map:         this.map,
      enemies:     this.enemies,
      pickups:     this.pickups,
      objectives:  this.objectives,
      level:       this.map,
      score:       this.score + this.totalScore,
      elapsedTime: this.elapsedTime,
      shooting:    this._keys[' '] || this._keys['click'],
    };
  }

  // ─── Input ────────────────────────────────────────────────────────────────────
  _handleInput(dt, now) {
    const p = this.player;
    const MOVE_SPD   = p.speed;
    const TURN_SPD   = p.turnSpeed;
    const MOVE_ACCEL = 14.0;
    const TURN_ACCEL = 7.0;
    const WALL_MARGIN = 0.28;

    // Initialise velocity state once
    if (p.velFwd  === undefined) p.velFwd  = 0;
    if (p.velTurn === undefined) p.velTurn = 0;

    // ── Target velocities from keys (matches split-screen Nerf Arena) ──
    const fwd  = this._keys['w'] || this._keys['W'] || this._keys['ArrowUp'];
    const back = this._keys['s'] || this._keys['S'] || this._keys['ArrowDown'];
    const tL   = this._keys['a'] || this._keys['A'] || this._keys['ArrowLeft'];
    const tR   = this._keys['d'] || this._keys['D'] || this._keys['ArrowRight'];

    const targetFwd  = fwd ? MOVE_SPD : back ? -MOVE_SPD * 0.6 : 0;
    const targetTurn = tL  ? -TURN_SPD : tR  ?  TURN_SPD : 0;

    // Smooth acceleration (same feel as split-screen)
    p.velFwd  += (targetFwd  - p.velFwd)  * Math.min(1, MOVE_ACCEL * dt);
    p.velTurn += (targetTurn - p.velTurn) * Math.min(1, TURN_ACCEL * dt);

    // Turn
    p.angle += p.velTurn * dt;

    // Move with axis-separated collision (allows wall sliding)
    const cosA = Math.cos(p.angle), sinA = Math.sin(p.angle);
    const nx = p.x + cosA * p.velFwd * dt;
    const ny = p.y + sinA * p.velFwd * dt;

    if (!this._solid(nx + WALL_MARGIN * Math.sign(cosA), p.y) &&
        !this._solid(nx - WALL_MARGIN * Math.sign(cosA), p.y)) p.x = nx;
    if (!this._solid(p.x, ny + WALL_MARGIN * Math.sign(sinA)) &&
        !this._solid(p.x, ny - WALL_MARGIN * Math.sign(sinA))) p.y = ny;

    p.moving = Math.abs(p.velFwd) > 0.15;
    if (p.moving) {
      this._stepTimer -= dt;
      if (this._stepTimer <= 0) {
        if (typeof Sfx !== 'undefined') Sfx.step();
        this._stepTimer = 0.32;
      }
    }

    // Reload
    if (this._isReloading) {
      this._reloadTime -= dt * 1000;
      if (this._reloadTime <= 0) {
        this._isReloading = false;
        p.ammo = p.maxAmmo;
        this.hud.showMessage('RELOADED', 1000, '#ffcc00');
      }
      return;
    }
    if ((this._keys['r'] || this._keys['R']) && !this._isReloading && p.ammo < p.maxAmmo) {
      this._isReloading = true;
      this._reloadTime = 1500;
      this.hud.showMessage('RELOADING...', 1500, '#ff8800');
      if (typeof Sfx !== 'undefined') Sfx.reload();
      return;
    }

    // Shoot
    const shooting = this._keys[' '] || this._keys['click'];
    if (shooting && p.ammo > 0 && now - this._lastShot > this._shootCooldown) {
      this._shoot(now);
    } else if (shooting && p.ammo <= 0) {
      if (now - this._lastShot > 500) {
        this._lastShot = now;
        this.hud.showMessage('OUT OF AMMO — Press R', 800, '#ff4444');
        if (typeof Sfx !== 'undefined') Sfx.empty();
        if (!this._isReloading) {
          this._isReloading = true;
          this._reloadTime = 1500;
          if (typeof Sfx !== 'undefined') Sfx.reload();
        }
      }
    }
  }

  // ─── Shoot ────────────────────────────────────────────────────────────────────
  _shoot(now) {
    this._lastShot = now;
    this.player.ammo--;
    this.engine.triggerShoot();
    if (typeof Sfx !== 'undefined') Sfx.shoot();

    // Raycast for hit
    const p = this.player;
    const hitEnemy = this._shootRaycast(p.x, p.y, p.angle);

    if (hitEnemy) {
      const dmg = 20 + (Math.random() * 10 | 0);
      const died = hitEnemy.takeDamage(dmg);
      const kill = died;
      if (typeof Sfx !== 'undefined') Sfx.hit();
      this.hud.showHitMarker(kill);
      if (kill) {
        const bonus = hitEnemy.isCommander ? 2 : 1;
        this.score += hitEnemy.typeCfg.score * bonus;
        this.hud.addKillFeed(hitEnemy.label, hitEnemy.isCommander);
        if (hitEnemy.isCommander) {
          this.hud.showMessage(`★ ${hitEnemy.label.toUpperCase()} ELIMINATED`, 3000, '#ffd700');
        }
        // Alert nearby enemies
        this._alertNearbyEnemies(hitEnemy.x, hitEnemy.y, 5);
        // Drop key?
        if (hitEnemy.dropsKey) {
          this.pickups.push({ x: hitEnemy.x, y: hitEnemy.y, type: 'key', collected: false });
          this.hud.showMessage('⚷ KEY DROPPED — Go pick it up!', 3000, '#44ffaa');
        }
      }
    } else {
      // Check barrel hit
      const hitBarrel = this._checkBarrelShot(p.x, p.y, p.angle);
      if (!hitBarrel && typeof Sfx !== 'undefined') Sfx.splat();
    }
  }

  // ─── Shoot raycast ────────────────────────────────────────────────────────────
  _shootRaycast(px, py, angle) {
    let closestEnemy = null;
    let closestDist = Infinity;

    for (const e of this.enemies) {
      if (e.isDead) continue;
      const dx = e.x - px, dy = e.y - py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 15) continue;

      const enemyAngle = Math.atan2(dy, dx);
      let relAngle = enemyAngle - angle;
      while (relAngle >  Math.PI) relAngle -= Math.PI * 2;
      while (relAngle < -Math.PI) relAngle += Math.PI * 2;

      const halfSize = (e.size / dist) * 1.2;
      if (Math.abs(relAngle) < halfSize + 0.05 && dist < closestDist) {
        // Check LOS
        if (e._hasLOS(px, py)) {
          closestDist = dist;
          closestEnemy = e;
        }
      }
    }
    return closestEnemy;
  }

  // ─── Barrel shots ─────────────────────────────────────────────────────────────
  _checkBarrelShot(px, py, angle) {
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    let dist = 0;
    for (let step = 0; step < 10; step++) {
      dist += 0.5;
      const bx = Math.floor(px + cosA * dist);
      const by = Math.floor(py + sinA * dist);
      const idx = by * this.map.width + bx;
      if (bx < 0 || by < 0 || bx >= this.map.width || by >= this.map.height) break;
      const tile = this.map.grid[idx];
      if (tile === NC_TILE.WALL || tile === NC_TILE.CRATE) break;
      if (tile === NC_TILE.BARREL) {
        // Destroy barrel
        this.map.grid[idx] = NC_TILE.EMPTY;
        this.score += 50;
        this.hud.showMessage('BARREL DESTROYED!', 1500, '#ffaa00');
        if (typeof Sfx !== 'undefined') Sfx.hit();
        // Check objectives
        for (const obj of this.objectives) {
          if (obj.type === 'destroy_barrel' && obj.x === bx && obj.y === by) {
            obj.completed = true;
            this.hud.showMessage(`✓ OBJECTIVE: ${obj.label}`, 2500, '#44ff88');
          }
        }
        return true;
      }
    }
    return false;
  }

  // ─── Enemy update ─────────────────────────────────────────────────────────────
  _updateEnemies(dt, now) {
    const p = this.player;
    for (const e of this.enemies) {
      e.update(dt, p.x, p.y, p.angle, now);
      if (!e.isDead) {
        const dmg = e.tryShootPlayer(p.x, p.y, now);
        if (dmg > 0) {
          p.health = Math.max(0, p.health - dmg);
          this.hud.showDamage(dmg);
          if (typeof Sfx !== 'undefined') Sfx.playerHit();
          if (p.health <= 0) {
            this._triggerGameOver();
            return;
          }
        }
      }
    }
  }

  // ─── Alert nearby enemies ────────────────────────────────────────────────────
  _alertNearbyEnemies(ex, ey, radius) {
    for (const e of this.enemies) {
      if (e.isDead) continue;
      const dx = e.x - ex, dy = e.y - ey;
      if (Math.sqrt(dx*dx + dy*dy) <= radius) {
        e.alert(this.player.x, this.player.y);
      }
    }
  }

  // ─── Pickup collection ────────────────────────────────────────────────────────
  _checkPickups() {
    const p = this.player;
    for (const pk of this.pickups) {
      if (pk.collected) continue;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      if (Math.sqrt(dx*dx + dy*dy) < 0.8) {
        pk.collected = true;
        if (typeof Sfx !== 'undefined') Sfx.pickup();
        switch (pk.type) {
          case 'ammo':
            p.ammo = Math.min(p.maxAmmo, p.ammo + (pk.amount || 15));
            this.hud.showMessage(`+${pk.amount} AMMO`, 1200, '#ffcc00');
            break;
          case 'health':
            p.health = Math.min(p.maxHealth, p.health + (pk.amount || 25));
            this.hud.showHeal(pk.amount || 25);
            this.hud.showMessage(`+${pk.amount} HEALTH`, 1200, '#44ff88');
            break;
          case 'key':
            p.hasKey = true;
            this.hud.showMessage('⚷ KEY ACQUIRED — Doors unlocked!', 3000, '#44ffaa');
            if (typeof Sfx !== 'undefined') Sfx.door();
            // Unlock door tiles
            for (let i = 0; i < this.map.grid.length; i++) {
              if (this.map.grid[i] === NC_TILE.DOOR) this.map.grid[i] = NC_TILE.EMPTY;
            }
            break;
        }
      }
    }
  }

  // ─── Win condition ────────────────────────────────────────────────────────────
  _checkWinCondition() {
    const map = this.map;
    const p = this.player;
    const alive = this.enemies.filter(e => !e.isDead);
    const commanders = this.enemies.filter(e => e.isCommander);

    let won = false;

    switch (map.winCondition) {
      case 'eliminate_all':
        if (alive.length === 0) {
          this.exitUnlocked = true;
          won = this._playerOnExit();
          if (!won && !this._exitMsgShown) {
            this._exitMsgShown = true;
            this.hud.showMessage('AREA CLEARED — Reach the exit!', 3000, '#44ffaa');
          }
        }
        break;
      case 'eliminate_commander':
        if (commanders.every(c => c.isDead)) {
          this.exitUnlocked = true;
          won = this._playerOnExit();
          if (!won) {
            // Show message once
            if (!this._exitMsgShown) {
              this._exitMsgShown = true;
              this.hud.showMessage('EXIT UNLOCKED — Reach the exit!', 3000, '#44ffaa');
            }
          }
        }
        break;
      case 'reach_exit':
        won = this._playerOnExit();
        break;
      case 'objectives':
        if (this.objectives.every(o => o.completed)) {
          this.exitUnlocked = true;
          won = this._playerOnExit();
          if (!won && !this._exitMsgShown) {
            this._exitMsgShown = true;
            this.hud.showMessage('ALL OBJECTIVES COMPLETE — Reach the exit!', 3000, '#44ffaa');
          }
        }
        break;
    }

    if (won) this._triggerLevelComplete();
  }

  _playerOnExit() {
    const p = this.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    return this.map.grid[ty * this.map.width + tx] === NC_TILE.EXIT;
  }

  _triggerLevelComplete() {
    if (this.gameState !== GAME_STATE.PLAYING) return;
    this.gameState = GAME_STATE.LEVEL_END;
    document.exitPointerLock();
    if (typeof Sfx !== 'undefined') Sfx.win();

    const timeBonus = Math.max(0, (this.map.par - (this.elapsedTime | 0)) * 10);
    this.score += timeBonus;
    this.totalScore += this.score;
    this._save();

    // Show overlay
    this.hudCanvas.style.display = 'none';
    this.menuOverlay.style.display = 'flex';
    const isLast = this.currentLevelIndex >= NC_LEVELS.length - 1;
    this.menuOverlay.innerHTML = `
      <div class="menu-box">
        <div class="menu-logo" style="color:#44ff88">MISSION COMPLETE</div>
        <div class="briefing-title">${this.map.name}</div>
        <div style="margin:16px 0;color:#ffdd44;font-size:1.1em">
          ${this.elapsedTime <= this.map.par ? '⭐ UNDER PAR!' : 'Complete'}
        </div>
        <div class="score-table">
          <div>Kills Score <span>${this.score - timeBonus}</span></div>
          <div>Time Bonus <span>+${timeBonus}</span></div>
          <div>Level Total <span>${this.score}</span></div>
          <div>Career Total <span>${this.totalScore}</span></div>
        </div>
        ${isLast
          ? `<div style="color:#ffd700;font-size:1.3em;margin:16px 0">🏆 CAMPAIGN COMPLETE!</div>`
          : ''}
        <button class="menu-btn primary" id="btn-next">
          ${isLast ? '🏆 VIEW HALL OF FAME' : '▶ NEXT MISSION'}
        </button>
        <button class="menu-btn" id="btn-retry">↺ REPLAY LEVEL</button>
        <button class="menu-btn" id="btn-menu2">☰ MAIN MENU</button>
      </div>
    `;
    this.hudCanvas.style.display = '';

    document.getElementById('btn-next').addEventListener('click', () => {
      if (isLast) {
        this._showVictory();
      } else {
        this.currentLevelIndex++;
        this._save();
        this._buildMenuUI();
      }
    });
    document.getElementById('btn-retry').addEventListener('click', () => {
      this._startLevel(this.currentLevelIndex);
    });
    document.getElementById('btn-menu2').addEventListener('click', () => {
      this._buildMenuUI();
    });
  }

  _triggerGameOver() {
    if (this.gameState !== GAME_STATE.PLAYING) return;
    this.gameState = GAME_STATE.GAME_OVER;
    document.exitPointerLock();
    if (typeof Sfx !== 'undefined') Sfx.hit();

    this.menuOverlay.style.display = 'flex';
    this.menuOverlay.innerHTML = `
      <div class="menu-box">
        <div class="menu-logo" style="color:#ff2222">MISSION FAILED</div>
        <div class="briefing-subtitle" style="color:#ff6666">You have been eliminated.</div>
        <div style="color:#888;margin:12px 0">Final Score: ${this.score}</div>
        <button class="menu-btn primary" id="btn-retry-go">↺ RETRY MISSION</button>
        <button class="menu-btn" id="btn-menu-go">☰ MAIN MENU</button>
      </div>
    `;
    document.getElementById('btn-retry-go').addEventListener('click', () => {
      this._startLevel(this.currentLevelIndex);
    });
    document.getElementById('btn-menu-go').addEventListener('click', () => {
      this._buildMenuUI();
    });
  }

  // ─── Victory Screen ───────────────────────────────────────────────────────────
  _showVictory() {
    this.menuOverlay.innerHTML = `
      <div class="menu-box">
        <div class="menu-logo" style="background:linear-gradient(135deg,#ffd700,#ff8800);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
          ROGUE PROTOCOL<br>COMPLETE
        </div>
        <div style="color:#ffdd44;font-size:1.2em;margin:12px 0">
          All 6 missions cleared. The Rogue threat is eliminated.
        </div>
        <div class="score-table">
          <div>Career Score <span style="color:#ffd700">${this.totalScore}</span></div>
        </div>
        <button class="menu-btn primary" id="btn-play-again">▶ PLAY AGAIN</button>
        <button class="menu-btn" id="btn-menu3">☰ MAIN MENU</button>
      </div>
    `;
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this._clearSave();
      this._startLevel(0);
    });
    document.getElementById('btn-menu3').addEventListener('click', () => {
      this._clearSave();
      this._buildMenuUI();
    });
  }

  // ─── Collision ───────────────────────────────────────────────────────────────
  _solid(x, y) {
    const map = this.map;
    if (!map) return false;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= map.width || iy >= map.height) return true;
    const t = map.grid[iy * map.width + ix];
    return t === NC_TILE.WALL || t === NC_TILE.CRATE || t === NC_TILE.DOOR || t === NC_TILE.BARREL;
  }

  // ─── Events ──────────────────────────────────────────────────────────────────
  _bindEvents() {
    window.addEventListener('keydown', e => {
      this._keys[e.key] = true;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        this._togglePause();
      }
    });
    window.addEventListener('keyup', e => { this._keys[e.key] = false; });

    this.gameCanvas.addEventListener('click', () => {
      if (!this._mouseLocked) this.gameCanvas.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this._mouseLocked = document.pointerLockElement === this.gameCanvas;
    });

    document.addEventListener('mousemove', e => {
      if (!this._mouseLocked || this.gameState !== GAME_STATE.PLAYING) return;
      this.player.angle += e.movementX * this._mouseSensitivity;
    });

    window.addEventListener('mousedown', e => {
      if (e.button === 0) this._keys['click'] = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this._keys['click'] = false;
    });

    window.addEventListener('resize', () => {
      const W = window.innerWidth, H = window.innerHeight;
      this.engine.resize(W, H);
      this.hud.resize(W, H);
    });
  }

  _togglePause() {
    if (this.gameState === GAME_STATE.PLAYING) {
      this.gameState = GAME_STATE.PAUSED;
      document.exitPointerLock();
    } else if (this.gameState === GAME_STATE.PAUSED) {
      this.gameState = GAME_STATE.PLAYING;
      this.gameCanvas.requestPointerLock();
      this._lastTime = performance.now();
    }
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  window._nerfOps = new NerfOpsGame();
});
