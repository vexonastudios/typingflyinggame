// tank-duel.js — PvP Tank Duel mode

const DUEL_ROUNDS_TO_WIN = 3;

// ── Duel Arena Map ───────────────────────────────────────────
function emptyGrid(cols, rows, defaultTile) {
  return Array.from({ length: rows }, () => Array(cols).fill(defaultTile));
}

function fillRect(g, x, y, w, h, tile) {
  for (let r = y; r < y + h; r++) {
    if (r >= 0 && r < g.length) {
      for (let c = x; c < x + w; c++) {
        if (c >= 0 && c < g[r].length) {
          g[r][c] = tile;
        }
      }
    }
  }
}

function buildDuelArena() {
  const C = 28, R = 20;
  const g = emptyGrid(C, R, T.SAND);

  // Border walls
  for (let c = 0; c < C; c++) { g[0][c] = T.WALL; g[R-1][c] = T.WALL; }
  for (let r = 0; r < R; r++) { g[r][0] = T.WALL; g[r][C-1] = T.WALL; }

  // Centre cross walls (symmetric obstacles)
  fillRect(g, 11, 7,  6, 2, T.WALL);
  fillRect(g, 11, 11, 6, 2, T.WALL);
  fillRect(g, 13, 5,  2, 10, T.WALL);

  // Side bunkers (symmetrical)
  fillRect(g, 3,  4,  3, 3, T.WALL);
  fillRect(g, 22, 4,  3, 3, T.WALL);
  fillRect(g, 3,  13, 3, 3, T.WALL);
  fillRect(g, 22, 13, 3, 3, T.WALL);

  // Corner trees
  fillRect(g, 2,  2,  2, 2, T.TREE);
  fillRect(g, 24, 2,  2, 2, T.TREE);
  fillRect(g, 2,  16, 2, 2, T.TREE);
  fillRect(g, 24, 16, 2, 2, T.TREE);

  // Mid-side rubble
  fillRect(g, 7,  9,  2, 2, T.RUBBLE);
  fillRect(g, 19, 9,  2, 2, T.RUBBLE);

  return g;
}

// ── Duel Tank — each player has full drive + aim + shoot ─────
class DuelTank {
  constructor(x, y, angle, colorHull, colorTurret, label) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.turretAngle = angle;
    this.speed = 0;
    this.maxSpeed = 160;
    this.reverseMax = 70;
    this.accel = 220;
    this.friction = 190;
    this.turnRate = 2.4;
    this.width = 34; this.height = 50;
    this.colorHull = colorHull;
    this.colorDark = colorTurret;
    this.label = label;

    this.hp = 100; this.maxHp = 100;
    this.alive = true;
    this.flashTimer = 0;
    this.recoilTimer = 0; this.recoilMax = 0.15;

    this.cannonCooldown = 0;
    this.cannonCooldownMax = 1.8;
    this.trackOffset = 0;
  }

  update(dt, fwd, back, left, right, fire, map, projectiles, owner) {
    if (!this.alive) return;

    // Drive
    if (fwd)        this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    else if (back)  this.speed = Math.max(-this.reverseMax, this.speed - this.accel * dt);
    else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - this.friction * dt);
      if (this.speed < 0) this.speed = Math.min(0, this.speed + this.friction * dt);
    }

    const sf = Math.abs(this.speed) / this.maxSpeed;
    const steer = this.turnRate * sf;
    if (left)  { this.angle -= steer * dt * (this.speed >= 0 ? 1 : -1); this.turretAngle -= steer * dt * (this.speed >= 0 ? 1 : -1); }
    if (right) { this.angle += steer * dt * (this.speed >= 0 ? 1 : -1); this.turretAngle += steer * dt * (this.speed >= 0 ? 1 : -1); }

    const r = 20;
    const nx = this.x + Math.sin(this.angle) * this.speed * dt;
    const ny = this.y - Math.cos(this.angle) * this.speed * dt;
    if (!this.circleHit(nx, this.y, r, map)) this.x = nx;
    if (!this.circleHit(this.x, ny, r, map)) this.y = ny;

    this.trackOffset = (this.trackOffset + Math.abs(this.speed) * dt * 0.7) % 12;

    if (this.cannonCooldown > 0) this.cannonCooldown -= dt;
    if (this.recoilTimer   > 0) this.recoilTimer   -= dt;
    if (this.flashTimer    > 0) this.flashTimer     -= dt;

    if (fire && this.cannonCooldown <= 0) {
      this.cannonCooldown = this.cannonCooldownMax;
      this.recoilTimer = this.recoilMax;
      const bx = this.x + Math.sin(this.turretAngle) * 38;
      const by = this.y - Math.cos(this.turretAngle) * 38;
      projectiles.push(new CannonShell(bx, by, this.turretAngle, 580, owner));
      if (typeof playSound === 'function') playSound('cannon');
    }

    if (this.hp <= 0) this.alive = false;
  }

  circleHit(wx, wy, r, map) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = wx + Math.cos(a) * r, cy = wy + Math.sin(a) * r;
      if (isSolid(getTile(map, Math.floor(cx / TILE_SIZE), Math.floor(cy / TILE_SIZE)))) return true;
    }
    return false;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashTimer = 0.3;
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX, sy = this.y - camY;
    const fl = this.flashTimer > 0;

    ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.angle);

    // Tracks
    const tw = 9, th = this.height + 4;
    ctx.fillStyle = fl ? '#888' : '#1a1a1a';
    ctx.fillRect(-this.width/2 - tw + 2, -th/2, tw, th);
    ctx.fillRect(this.width/2 - 2, -th/2, tw, th);
    ctx.fillStyle = fl ? '#aaa' : '#2d2d2d';
    for (let i = 0; i < 7; i++) {
      const yo = -th/2 + ((i * 8 + this.trackOffset) % th);
      ctx.fillRect(-this.width/2 - tw + 3, yo, tw-2, 3);
      ctx.fillRect(this.width/2 - 1, yo, tw-2, 3);
    }

    // Hull
    ctx.fillStyle = fl ? '#fff' : this.colorHull;
    ctx.beginPath();
    ctx.moveTo(-this.width/2 + 4, -this.height/2);
    ctx.lineTo( this.width/2 - 4, -this.height/2);
    ctx.lineTo( this.width/2,     -this.height/2 + 10);
    ctx.lineTo( this.width/2,      this.height/2 - 8);
    ctx.lineTo(-this.width/2,      this.height/2 - 8);
    ctx.lineTo(-this.width/2,     -this.height/2 + 10);
    ctx.closePath(); ctx.fill();

    // Armour side strips
    ctx.fillStyle = fl ? '#ddd' : this.colorDark;
    ctx.fillRect(-this.width/2 + 2, -this.height/2 + 4, 7, this.height - 16);
    ctx.fillRect( this.width/2 - 9, -this.height/2 + 4, 7, this.height - 16);
    ctx.restore();

    // Turret
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.turretAngle);
    const recoil = this.recoilTimer > 0 ? (this.recoilTimer / this.recoilMax) * 8 : 0;
    const barY = -this.height/2 - 18 + recoil;

    // Aim line
    ctx.strokeStyle = `rgba(255,255,255,0.12)`;
    ctx.lineWidth = 1; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, -180); ctx.stroke();
    ctx.setLineDash([]);

    // Barrel
    ctx.fillStyle = fl ? '#eee' : this.colorDark;
    ctx.fillRect(-4, barY, 8, this.height/2 + 16);
    if (this.recoilTimer > this.recoilMax * 0.6) {
      ctx.fillStyle = 'rgba(255,220,80,0.9)';
      ctx.beginPath(); ctx.arc(0, barY, 7, 0, Math.PI*2); ctx.fill();
    }

    // Dome
    ctx.fillStyle = fl ? '#fff' : this.colorHull;
    ctx.beginPath(); ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = fl ? '#eee' : this.colorDark;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI*2); ctx.stroke();
    ctx.restore();

    // Label above
    ctx.fillStyle = this.colorHull;
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.label, sx, sy - 52);
    ctx.textAlign = 'left';

    // HP bar
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx - 22, sy - 46, 44, 5);
    ctx.fillStyle = pct > 0.5 ? this.colorHull : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(sx - 22, sy - 46, 44 * pct, 5);
  }
}

// ── Duel State ────────────────────────────────────────────────
let duelState = 'idle'; // idle | playing | round_end | done
let duelMap, duelProjectiles, duelParticles, duelFloats;
let p1Tank, p2Tank;
let p1Score = 0, p2Score = 0, duelRound = 1;
let duelRoundTimer = 0;
const DUEL_CANVAS = document.getElementById('duelCanvas');
const dCtx = DUEL_CANVAS.getContext('2d');
let dCamX = 0, dCamY = 0;
let duelLastTs = 0;
let duelLoopId = null;

function resizeDuelCanvas() {
  const hudH = document.getElementById('duelHud').offsetHeight || 54;
  DUEL_CANVAS.width  = window.innerWidth;
  DUEL_CANVAS.height = window.innerHeight - hudH;
}
window.addEventListener('resize', resizeDuelCanvas);

function initDuel() {
  resizeDuelCanvas();
  duelMap = buildDuelArena();
  duelProjectiles = []; duelParticles = []; duelFloats = [];

  const mx = duelMap[0].length * TILE_SIZE / 2;
  const my = duelMap.length    * TILE_SIZE / 2;

  p1Tank = new DuelTank(mx - 180, my, 0,           '#4a8c4a', '#2a5c2a', 'P1');
  p2Tank = new DuelTank(mx + 180, my, Math.PI,      '#c44040', '#7a1a1a', 'P2');

  duelState = 'playing';
  updateDuelHUD();
  if (typeof initAudio === 'function') initAudio();

  if (duelLoopId) cancelAnimationFrame(duelLoopId);
  duelLastTs = performance.now();
  duelLoopId = requestAnimationFrame(duelLoop);
}

function resetDuelRound() {
  duelProjectiles = []; duelParticles = []; duelFloats = [];
  const mx = duelMap[0].length * TILE_SIZE / 2;
  const my = duelMap.length    * TILE_SIZE / 2;
  p1Tank.x = mx - 180; p1Tank.y = my; p1Tank.angle = 0; p1Tank.turretAngle = 0;
  p1Tank.hp = 100; p1Tank.speed = 0; p1Tank.alive = true;
  p2Tank.x = mx + 180; p2Tank.y = my; p2Tank.angle = Math.PI; p2Tank.turretAngle = Math.PI;
  p2Tank.hp = 100; p2Tank.speed = 0; p2Tank.alive = true;
  duelState = 'playing';
  updateDuelHUD();
}

function duelLoop(ts) {
  if (duelState === 'idle') return;
  const dt = Math.min((ts - duelLastTs) / 1000, 0.05);
  duelLastTs = ts;
  duelUpdate(dt);
  duelRender();
  duelLoopId = requestAnimationFrame(duelLoop);
}

function duelUpdate(dt) {
  if (duelState === 'round_end') {
    duelRoundTimer -= dt;
    if (duelRoundTimer <= 0) {
      if (p1Score >= DUEL_ROUNDS_TO_WIN || p2Score >= DUEL_ROUNDS_TO_WIN) {
        endDuel();
      } else {
        duelRound++;
        resetDuelRound();
      }
    }
    // Still update particles
    for (let i = duelParticles.length-1; i >= 0; i--) {
      duelParticles[i].update(dt);
      if (!duelParticles[i].alive) duelParticles.splice(i, 1);
    }
    return;
  }
  if (duelState !== 'playing') return;

  // P1 keys: WASD + Q fire
  const p1fwd   = keys['KeyW'];
  const p1back  = keys['KeyS'];
  const p1left  = keys['KeyA'];
  const p1right = keys['KeyD'];
  const p1fire  = keys['KeyQ'];

  // P2 keys: IJKL + U fire
  const p2fwd   = keys['KeyI'];
  const p2back  = keys['KeyK'];
  const p2left  = keys['KeyJ'];
  const p2right = keys['KeyL'];
  const p2fire  = keys['KeyU'];

  if (p1Tank.alive) p1Tank.update(dt, p1fwd, p1back, p1left, p1right, p1fire, duelMap, duelProjectiles, 'p1');
  if (p2Tank.alive) p2Tank.update(dt, p2fwd, p2back, p2left, p2right, p2fire, duelMap, duelProjectiles, 'p2');

  // Projectiles
  for (let i = duelProjectiles.length-1; i >= 0; i--) {
    const p = duelProjectiles[i];
    p.update(dt, duelMap, 0);
    if (p.alive) {
      if (p.owner === 'p1' && p2Tank.alive) {
        if (circleCircle(p.x, p.y, p.radius, p2Tank.x, p2Tank.y, 22)) {
          p2Tank.takeDamage(p.damage);
          spawnExplosion(p.x, p.y, 12, duelParticles);
          if (typeof playSound === 'function') playSound('hit');
          p.alive = false;
        }
      } else if (p.owner === 'p2' && p1Tank.alive) {
        if (circleCircle(p.x, p.y, p.radius, p1Tank.x, p1Tank.y, 22)) {
          p1Tank.takeDamage(p.damage);
          spawnExplosion(p.x, p.y, 12, duelParticles);
          if (typeof playSound === 'function') playSound('hit');
          p.alive = false;
        }
      }
    }
    if (!p.alive) duelProjectiles.splice(i, 1);
  }

  // Particles
  for (let i = duelParticles.length-1; i >= 0; i--) {
    duelParticles[i].update(dt);
    if (!duelParticles[i].alive) duelParticles.splice(i, 1);
  }

  // Floating texts
  for (let i = duelFloats.length-1; i >= 0; i--) {
    duelFloats[i].update(dt);
    if (!duelFloats[i].alive) duelFloats.splice(i, 1);
  }

  // Check round end
  if (!p1Tank.alive || !p2Tank.alive) {
    let winner = null;
    if (!p1Tank.alive && p2Tank.alive) { p2Score++; winner = 'P2'; }
    else if (!p2Tank.alive && p1Tank.alive) { p1Score++; winner = 'P1'; }
    else { winner = 'DRAW'; } // simultaneous kill

    if (!p1Tank.alive) spawnExplosion(p1Tank.x, p1Tank.y, 28, duelParticles);
    if (!p2Tank.alive) spawnExplosion(p2Tank.x, p2Tank.y, 28, duelParticles);
    if (typeof playSound === 'function') playSound('explosion');

    duelState = 'round_end';
    duelRoundTimer = 3.0;
    updateDuelHUD();
    const msg = winner === 'DRAW' ? 'DRAW! Next round...' : `${winner} WINS THE ROUND!`;
    document.getElementById('duelMsg').textContent = msg;
    document.getElementById('duelMsg').className = 'hud-msg blink';
  }

  // Camera: centre between both tanks
  const mx = (p1Tank.x + p2Tank.x) / 2;
  const my = (p1Tank.y + p2Tank.y) / 2;
  const tX = mx - DUEL_CANVAS.width  / 2;
  const tY = my - DUEL_CANVAS.height / 2;
  const k  = 1 - Math.exp(-8 * 0.016);
  dCamX += (tX - dCamX) * k;
  dCamY += (tY - dCamY) * k;

  // Clamp
  const mapW = duelMap[0].length * TILE_SIZE;
  const mapH = duelMap.length    * TILE_SIZE;
  dCamX = Math.max(0, Math.min(dCamX, Math.max(0, mapW - DUEL_CANVAS.width)));
  dCamY = Math.max(0, Math.min(dCamY, Math.max(0, mapH - DUEL_CANVAS.height)));

  updateDuelHUD();
}

function duelRender() {
  dCtx.clearRect(0, 0, DUEL_CANVAS.width, DUEL_CANVAS.height);
  drawMap(dCtx, duelMap, dCamX, dCamY, 0);

  for (const p of duelParticles) p.draw(dCtx, dCamX, dCamY);
  if (p1Tank.alive) p1Tank.draw(dCtx, dCamX, dCamY);
  if (p2Tank.alive) p2Tank.draw(dCtx, dCamX, dCamY);
  for (const p of duelProjectiles) p.draw(dCtx, dCamX, dCamY);
  for (const f of duelFloats) f.draw(dCtx, dCamX, dCamY);

  // Round end overlay
  if (duelState === 'round_end') {
    dCtx.fillStyle = 'rgba(0,0,0,0.4)';
    dCtx.fillRect(0, 0, DUEL_CANVAS.width, DUEL_CANVAS.height);
    dCtx.textAlign = 'center'; dCtx.textBaseline = 'middle';
    dCtx.fillStyle = '#ffdd44';
    dCtx.font = 'bold 44px Outfit, sans-serif';
    dCtx.fillText(document.getElementById('duelMsg').textContent, DUEL_CANVAS.width/2, DUEL_CANVAS.height/2);
    const next = duelRound + 1;
    if (p1Score < DUEL_ROUNDS_TO_WIN && p2Score < DUEL_ROUNDS_TO_WIN) {
      dCtx.font = '20px Outfit, sans-serif';
      dCtx.fillStyle = '#c8e0a0';
      dCtx.fillText(`Round ${next} starting soon...`, DUEL_CANVAS.width/2, DUEL_CANVAS.height/2 + 46);
    }
    dCtx.textAlign = 'left'; dCtx.textBaseline = 'alphabetic';
  }
}

function updateDuelHUD() {
  if (!p1Tank || !p2Tank) return;
  document.getElementById('dHudP1Hp').textContent  = Math.ceil(p1Tank.hp);
  document.getElementById('dHudP2Hp').textContent  = Math.ceil(p2Tank.hp);
  document.getElementById('dHudP1Bar').style.width = (p1Tank.hp / p1Tank.maxHp * 100) + '%';
  document.getElementById('dHudP2Bar').style.width = (p2Tank.hp / p2Tank.maxHp * 100) + '%';

  const r1 = p1Tank.cannonCooldown > 0 ? (1 - p1Tank.cannonCooldown / p1Tank.cannonCooldownMax) * 100 : 100;
  const r2 = p2Tank.cannonCooldown > 0 ? (1 - p2Tank.cannonCooldown / p2Tank.cannonCooldownMax) * 100 : 100;
  document.getElementById('dHudP1Reload').style.width = r1 + '%';
  document.getElementById('dHudP2Reload').style.width = r2 + '%';

  document.getElementById('dScoreP1').textContent = p1Score;
  document.getElementById('dScoreP2').textContent = p2Score;
  document.getElementById('duelRound').textContent = `ROUND ${duelRound} · FIRST TO ${DUEL_ROUNDS_TO_WIN}`;
}

function endDuel() {
  duelState = 'done';
  const winner = p1Score >= DUEL_ROUNDS_TO_WIN ? 'PLAYER 1 🟢' : 'PLAYER 2 🔴';
  showScreen('screen-result');
  document.getElementById('resultEmoji').textContent = '🏆';
  document.getElementById('resultTitle').textContent = `${winner} WINS!`;
  document.getElementById('resultDesc').textContent  = 'Tank duel complete. Rematch?';
  document.getElementById('resultStats').innerHTML   =
    `Player 1 rounds: ${p1Score}<br>Player 2 rounds: ${p2Score}`;
  document.getElementById('btnRetry').textContent    = '↺ REMATCH';
}
