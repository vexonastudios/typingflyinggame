// tank-main.js — Game loop, state machine, zone management, HUD

// ── State ─────────────────────────────────────────────────
const STATE = { MENU: 0, PLAYING: 1, ZONE_CLEAR: 2, OVER: 3, WIN: 4, PAUSED: 5 };
const FIXED_STEP = 1 / 120;
let state = STATE.MENU;
let lastTs = 0;
let simAccumulator = 0;
let gameLoopId = null;
let gameMode = 'coop'; // 'coop' | 'duel'

// ── Game world ────────────────────────────────────────────
let playerTank, projectiles, particles, enemies, ammoCrates, floatingTexts;
let currentZone, zoneMap, worldOffsetX;
let kills = 0, zoneClearTimer = 0, zoneStarted = false;
let zoneEnemyTotal = 0, objectiveUnlocked = false, missionIntroTimer = 0;
let damageFlash = 0, treadTimer = 0;
let scorchMarks = [], treadMarks = [];
let pausedFromState = STATE.PLAYING;

// ── HUD refs ──────────────────────────────────────────────
const hudSpeed    = document.getElementById('hudSpeed');
const hudGear     = document.getElementById('hudGear');
const hudHpBar    = document.getElementById('hudHpBar');
const hudHpVal    = document.getElementById('hudHpVal');
const hudShells   = document.getElementById('hudShells');
const hudReloadBar= document.getElementById('hudReloadBar');
const hudMgBar    = document.getElementById('hudMgBar');
const hudMgState  = document.getElementById('hudMgState');
const hudKills    = document.getElementById('hudKills');
const hudZone     = document.getElementById('hudZone');
const hudMsg      = document.getElementById('hudMsg');
const hudObjective= document.getElementById('hudObjective');
const hudThreats  = document.getElementById('hudThreats');

// ── Zone loader ───────────────────────────────────────────
function loadZone(zoneIndex) {
  const def = ZONE_DEFS[zoneIndex];
  zoneMap = def.tiles;
  worldOffsetX = 0;          // Zone always starts at world X=0 (camera adjusts)
  currentZone = zoneIndex;

  projectiles = [];
  particles   = [];
  enemies     = [];
  ammoCrates  = [];
  floatingTexts = [];
  scorchMarks = [];
  treadMarks = [];
  zoneStarted = false;
  objectiveUnlocked = false;
  missionIntroTimer = 3.4;
  damageFlash = 0;
  treadTimer = 0;

  // Spawn enemies
  for (const s of def.enemySpawns) {
    const wx = s.col * TILE_SIZE + TILE_SIZE / 2;
    const wy = s.row * TILE_SIZE + TILE_SIZE / 2;
    if (s.type === 'infantry') enemies.push(new EnemyInfantry(wx, wy));
    else if (s.type === 'bunker') enemies.push(new EnemyBunker(wx, wy));
    else if (s.type === 'tank')   enemies.push(new EnemyTank(wx, wy));
    else if (s.type === 'commander') enemies.push(new EnemyCommander(wx, wy));
  }
  zoneEnemyTotal = enemies.length;

  // Place player at spawn
  let spawnCol = 2, spawnRow = Math.floor(def.rows / 2);
  for (let r = 0; r < def.rows; r++) {
    let found = false;
    for (let c = 0; c < def.cols; c++) {
      if (def.tiles[r][c] === 7) { // T.SPAWN
        spawnCol = c;
        spawnRow = r;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!playerTank) {
    playerTank = new PlayerTank(
      spawnCol * TILE_SIZE + TILE_SIZE / 2,
      spawnRow * TILE_SIZE + TILE_SIZE / 2
    );
  } else {
    // Reset position but keep stats
    playerTank.x = spawnCol * TILE_SIZE + TILE_SIZE / 2;
    playerTank.y = spawnRow * TILE_SIZE + TILE_SIZE / 2;
    playerTank.speed = 0;
    playerTank.angle = 0;
    playerTank.hp = playerTank.maxHp;
    playerTank.alive = true;
  }
  playerTank.spawnShield = 4.2;

  snapCameraToTank(playerTank, zoneMap);
  hudZone.textContent = def.name;
  hudObjective.textContent = currentZone === ZONE_DEFS.length - 1 ? 'ELIMINATE THE COMMANDER' : 'CLEAR THE SECTOR';
  hudThreats.textContent = `${zoneEnemyTotal} HOSTILES`;
  showMessage('');
}

// ── Init full game ────────────────────────────────────────
function initGame() {
  kills = 0;
  playerTank = null;
  showScreen('screen-game');
  resizeCanvas();
  loadZone(0);
  state = STATE.PLAYING;
  lastTs = performance.now();
  simAccumulator = 0;
  initAudio();
  document.getElementById('btnRetry').textContent = '↺ START OVER';
  if (gameLoopId) cancelAnimationFrame(gameLoopId);
  gameLoopId = requestAnimationFrame(gameLoop);
}

// ── Main loop ─────────────────────────────────────────────
function gameLoop(ts) {
  if (state === STATE.OVER || state === STATE.WIN) { gameLoopId = null; return; }

  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  simAccumulator = Math.min(0.08, simAccumulator + dt);
  while (simAccumulator >= FIXED_STEP) {
    update(FIXED_STEP);
    simAccumulator -= FIXED_STEP;
  }
  render();
  gameLoopId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (state === STATE.PAUSED) return;
  if (state === STATE.ZONE_CLEAR) {
    zoneClearTimer -= dt;
    if (zoneClearTimer <= 0) {
      const next = currentZone + 1;
      if (next >= ZONE_DEFS.length) {
        doWin();
      } else {
        loadZone(next);
        state = STATE.PLAYING;
      }
    }
    return;
  }

  if (state !== STATE.PLAYING) return;

  missionIntroTimer = Math.max(0, missionIntroTimer - dt);
  damageFlash = Math.max(0, damageFlash - dt * 2.8);
  playerTank.spawnShield = Math.max(0, (playerTank.spawnShield || 0) - dt);

  // Player
  playerTank.update(dt, keys, zoneMap, worldOffsetX, enemies);
  if (!playerTank.alive) { doGameOver('Your tank was destroyed!'); return; }

  treadTimer -= dt;
  if (Math.abs(playerTank.speed) > 30 && treadTimer <= 0) {
    treadTimer = 0.075;
    treadMarks.push({ x: playerTank.x, y: playerTank.y, angle: playerTank.angle, life: 8 });
    if (treadMarks.length > 180) treadMarks.shift();
  }

  // ── Weapon firing ─────────────────────────────────────
  if (keys['KeyW']) {
    if (playerTank.fireCannon(projectiles)) {
      spawnExplosion(
        playerTank.x + Math.sin(playerTank.turretAngle) * 42,
        playerTank.y - Math.cos(playerTank.turretAngle) * 42,
        6, particles
      );
      shakeScreen();
      playSound('cannon');
    }
  }
  if (keys['KeyS']) {
    if (playerTank.fireMG(projectiles)) {
      playSound('mg');
    }
  }

  // ── Camera ────────────────────────────────────────────
  updateCamera(playerTank, dt);

  // Clamp camera to map bounds
  const mapW = zoneMap[0].length * TILE_SIZE;
  const mapH = zoneMap.length * TILE_SIZE;
  camX = Math.max(0, Math.min(camX, mapW - gameCanvas.width));
  camY = Math.max(0, Math.min(camY, mapH - gameCanvas.height));

  // ── Projectiles ───────────────────────────────────────
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.update(dt, zoneMap, worldOffsetX);

    if (!p.alive) {
      if (p instanceof CannonShell) {
        addScorch(p.x, p.y, 14);
        spawnExplosion(p.x, p.y, 8, particles);
      }
      projectiles.splice(i, 1);
      continue;
    }

    if (p.alive) {
      // Player shells / MG hit enemies
      if (p.owner === 'player') {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (circleCircle(p.x, p.y, p.radius, e.x, e.y, 22)) {
            const killed = e.takeDamage(p.damage);
            spawnExplosion(p.x, p.y, p instanceof CannonShell ? 12 : 4, particles);
            if (killed) {
              spawnExplosion(e.x, e.y, 20, particles);
              addScorch(e.x, e.y, e instanceof EnemyInfantry ? 10 : 22);
              kills++;
              hudKills.textContent = kills;
              playSound('explosion');
              // Floating kill text
              const pts = e.score || 100;
              floatingTexts.push(new FloatingText(e.x, e.y - 20, `+${pts}`, '#ffdd44'));
              // 25% ammo crate drop
              if (Math.random() < 0.25) {
                ammoCrates.push(new AmmoCrate(e.x + (Math.random()-0.5)*40, e.y + (Math.random()-0.5)*40));
              }
            }
            p.alive = false;
          }
        }
      }
      // Enemy projectiles hit player
      else {
        if (circleCircle(p.x, p.y, p.radius, playerTank.x, playerTank.y, 24)) {
          if (playerTank.spawnShield > 0) {
            spawnExplosion(p.x, p.y, 5, particles);
          } else {
            playerTank.takeDamage(p.damage);
            damageFlash = Math.min(1, damageFlash + (p instanceof CannonShell ? 0.75 : 0.16));
          }
          spawnExplosion(p.x, p.y, p instanceof CannonShell ? 14 : 4, particles);
          if (p instanceof CannonShell) {
            shakeScreen();
            playSound('hit');
          }
          p.alive = false;
        }
      }
    }

    if (!p.alive) { projectiles.splice(i, 1); }
  }

  // ── Enemies ───────────────────────────────────────────
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) { enemies.splice(i, 1); continue; }
    e.update(dt, playerTank, projectiles, zoneMap);
  }

  // ── Tank crushes infantry ─────────────────────────────
  // Player tank (radius 22) overlapping infantry (radius 12) = kill
  for (const e of enemies) {
    if (!e.alive || !(e instanceof EnemyInfantry) || e.crushed) continue;
    if (circleCircle(playerTank.x, playerTank.y, 22, e.x, e.y, 12)) {
      e.crushed = true;
      e.crushTimer = 0.6;  // flatten animation duration
      kills++;
      hudKills.textContent = kills;
      const pts = e.score || 50;
      floatingTexts.push(new FloatingText(e.x, e.y - 20, `☠ CRUSHED +${pts}`, '#cc2222'));
      spawnExplosion(e.x, e.y, 5, particles);
      playSound('hit');
    }
  }

  // ── Ammo crates ───────────────────────────────────────
  for (let i = ammoCrates.length - 1; i >= 0; i--) {
    ammoCrates[i].update(dt, playerTank);
    if (!ammoCrates[i].alive) ammoCrates.splice(i, 1);
  }

  // ── Floating texts ────────────────────────────────────
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].update(dt);
    if (!floatingTexts[i].alive) floatingTexts.splice(i, 1);
  }

  // ── Particles ─────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (!particles[i].alive) particles.splice(i, 1);
  }

  for (const mark of scorchMarks) mark.life -= dt;
  scorchMarks = scorchMarks.filter(mark => mark.life > 0);
  for (const mark of treadMarks) mark.life -= dt;
  treadMarks = treadMarks.filter(mark => mark.life > 0);

  // ── Zone clear check ──────────────────────────────────
  // zoneStarted guard prevents false trigger if a zone has 0 enemies
  if (!zoneStarted && state === STATE.PLAYING) zoneStarted = true;
  if (zoneStarted && enemies.length === 0 && state === STATE.PLAYING) {
    if (!objectiveUnlocked) {
      objectiveUnlocked = true;
      hudObjective.textContent = 'REACH EXTRACTION';
      showMessage('SECTOR CLEAR — MOVE TO EXTRACTION');
    }
    const objective = ZONE_DEFS[currentZone].objective;
    const objectiveX = (objective.col + 0.5) * TILE_SIZE;
    const objectiveY = (objective.row + 0.5) * TILE_SIZE;
    if (Math.hypot(playerTank.x - objectiveX, playerTank.y - objectiveY) < 48) {
      showMessage(currentZone < ZONE_DEFS.length - 1 ? 'EXTRACTION SECURED' : 'COMMAND POST SECURED');
      state = STATE.ZONE_CLEAR;
      zoneClearTimer = 3.0;
    }
  }

  // ── HUD update ────────────────────────────────────────
  updateHUD();
}

// ── Render ────────────────────────────────────────────────
function render() {
  gctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  // Map
  drawMap(gctx, zoneMap, camX, camY, worldOffsetX);

  drawGroundMarks(gctx);

  // Particles (below entities)
  for (const p of particles) p.draw(gctx, camX, camY);

  // Ammo crates
  for (const c of ammoCrates) c.draw(gctx, camX, camY);

  // Entities
  for (const e of enemies) e.draw(gctx, camX, camY);
  playerTank.draw(gctx, camX, camY);

  // Projectiles
  for (const p of projectiles) p.draw(gctx, camX, camY);

  // Floating texts (top layer)
  for (const ft of floatingTexts) ft.draw(gctx, camX, camY);

  const boss = enemies.find(enemy => enemy.isBoss && enemy.alive);
  if (boss) drawBossStatus(gctx, boss);

  let guidanceTarget = null;
  let guidanceLabel = '';
  if (objectiveUnlocked) {
    const objective = ZONE_DEFS[currentZone].objective;
    guidanceTarget = { x: (objective.col + 0.5) * TILE_SIZE, y: (objective.row + 0.5) * TILE_SIZE };
    guidanceLabel = 'EXTRACT';
  } else if (enemies.length) {
    guidanceTarget = enemies.reduce((nearest, enemy) => {
      if (!nearest) return enemy;
      const nd = Math.hypot(nearest.x - playerTank.x, nearest.y - playerTank.y);
      const ed = Math.hypot(enemy.x - playerTank.x, enemy.y - playerTank.y);
      return ed < nd ? enemy : nearest;
    }, null);
    guidanceLabel = guidanceTarget?.isBoss ? 'COMMANDER' : 'HOSTILE';
  }
  drawObjectiveGuidance(gctx, playerTank, guidanceTarget, camX, camY, guidanceLabel);

  if (missionIntroTimer > 0 && state === STATE.PLAYING) drawMissionIntro(gctx);

  // Zone clear overlay
  if (state === STATE.ZONE_CLEAR) {
    gctx.fillStyle = 'rgba(0,0,0,0.35)';
    gctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    gctx.fillStyle = '#ffdd44';
    gctx.font = 'bold 42px Outfit, sans-serif';
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.fillText('⭐ ZONE CLEAR ⭐', gameCanvas.width/2, gameCanvas.height/2 - 20);
    gctx.font = '20px Outfit, sans-serif';
    gctx.fillStyle = '#c8e0a0';
    const nextIdx = currentZone + 1;
    if (nextIdx < ZONE_DEFS.length) {
      gctx.fillText(ZONE_DEFS[nextIdx].name, gameCanvas.width/2, gameCanvas.height/2 + 26);
    } else {
      gctx.fillText('Returning to base...', gameCanvas.width/2, gameCanvas.height/2 + 26);
    }
    gctx.textAlign = 'left';
    gctx.textBaseline = 'alphabetic';
  }

  // Minimap
  drawBattlefieldOverlay(gctx, damageFlash);

  drawMinimap(zoneMap, worldOffsetX, playerTank, enemies, camX, camY, gameCanvas.width, gameCanvas.height);
}

function addScorch(x, y, radius) {
  scorchMarks.push({ x, y, radius, life: 16, rotation: Math.random() * Math.PI });
  if (scorchMarks.length > 90) scorchMarks.shift();
}

function drawGroundMarks(ctx) {
  for (const mark of treadMarks) {
    const alpha = Math.min(0.22, mark.life * 0.04);
    const sx = mark.x - camX;
    const sy = mark.y - camY;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(mark.angle);
    ctx.strokeStyle = `rgba(24,28,18,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -8); ctx.lineTo(15, -8);
    ctx.moveTo(-15, 8); ctx.lineTo(15, 8);
    ctx.stroke();
    ctx.restore();
  }
  for (const mark of scorchMarks) {
    const alpha = Math.min(0.34, mark.life * 0.035);
    const sx = mark.x - camX;
    const sy = mark.y - camY;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(mark.rotation);
    const crater = ctx.createRadialGradient(0, 0, 1, 0, 0, mark.radius);
    crater.addColorStop(0, `rgba(18,16,12,${alpha})`);
    crater.addColorStop(0.7, `rgba(37,29,19,${alpha * 0.75})`);
    crater.addColorStop(1, 'rgba(30,24,18,0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.ellipse(0, 0, mark.radius, mark.radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMissionIntro(ctx) {
  const alpha = Math.min(1, missionIntroTimer, (3.4 - missionIntroTimer) * 2.5);
  const def = ZONE_DEFS[currentZone];
  ctx.save();
  ctx.globalAlpha = alpha;
  const w = Math.min(460, ctx.canvas.width - 40);
  const x = (ctx.canvas.width - w) / 2;
  const y = 34;
  ctx.fillStyle = 'rgba(7,13,7,0.88)';
  ctx.fillRect(x, y, w, 82);
  ctx.fillStyle = '#ffc94f';
  ctx.fillRect(x, y, 5, 82);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffc94f';
  ctx.font = '800 11px Share Tech Mono, monospace';
  ctx.fillText(`MISSION ${currentZone + 1} / ${ZONE_DEFS.length}`, x + 22, y + 23);
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px Outfit, sans-serif';
  ctx.fillText(def.name.replace(/^ZONE \d+ — /, ''), x + 22, y + 51);
  ctx.fillStyle = '#c8d8bd';
  ctx.font = '600 12px Outfit, sans-serif';
  const task = currentZone === ZONE_DEFS.length - 1 ? 'Break the defense and destroy the command tank.' : 'Clear the sector, then reach the extraction marker.';
  ctx.fillText(task, x + 22, y + 70);
  ctx.restore();
}

function drawBossStatus(ctx, boss) {
  const w = Math.min(420, ctx.canvas.width - 80);
  const x = (ctx.canvas.width - w) / 2;
  const y = ctx.canvas.height - 34;
  const pct = boss.hp / boss.maxHp;
  ctx.save();
  ctx.fillStyle = 'rgba(12,8,5,0.82)';
  ctx.fillRect(x, y, w, 22);
  ctx.fillStyle = '#6b1e1e';
  ctx.fillRect(x + 4, y + 4, (w - 8) * pct, 14);
  ctx.strokeStyle = 'rgba(255,199,76,0.65)';
  ctx.strokeRect(x, y, w, 22);
  ctx.fillStyle = '#fff3ce';
  ctx.font = '800 10px Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COMMAND TANK', ctx.canvas.width / 2, y - 7);
  ctx.restore();
}

// ── HUD helpers ───────────────────────────────────────────
function updateHUD() {
  const t = playerTank;
  const speedKmh = Math.abs(Math.round((t.speed / t.maxSpeed) * 80));
  hudSpeed.textContent = speedKmh;
  hudGear.textContent  = keys['ArrowUp'] ? 'D' : (keys['ArrowDown'] ? 'R' : 'N');

  const hpPct = (t.hp / t.maxHp) * 100;
  hudHpBar.style.width = hpPct + '%';
  hudHpVal.textContent = Math.ceil(t.hp);
  hudHpBar.className = 'hud-bar hud-bar--hp' +
    (hpPct < 25 ? ' danger' : hpPct < 50 ? ' warn' : '');

  hudShells.textContent = t.shells;
  const reloadPct = t.cannonCooldown > 0
    ? (1 - t.cannonCooldown / t.cannonCooldownMax) * 100
    : 100;
  hudReloadBar.style.width = reloadPct + '%';

  const mgPct = t.mgHeat * 100;
  hudMgBar.style.width = mgPct + '%';
  hudMgState.textContent = t.mgOverheat ? 'OVERHEAT' : 'READY';
  hudMgState.style.color = t.mgOverheat ? '#ff5555' : '#78f050';
  const remaining = enemies.filter(enemy => enemy.alive).length;
  hudThreats.textContent = objectiveUnlocked ? 'EXTRACTION OPEN' : `${remaining} / ${zoneEnemyTotal} HOSTILES`;
}

let msgTimeout;
function showMessage(txt) {
  hudMsg.textContent = txt;
  hudMsg.className = txt ? 'hud-msg blink' : 'hud-msg';
  clearTimeout(msgTimeout);
  if (txt && txt.indexOf('Zone') === -1 && txt.indexOf('ZONE') === -1) {
    msgTimeout = setTimeout(() => { hudMsg.textContent = ''; hudMsg.className = 'hud-msg'; }, 3000);
  }
}

// ── Screen shake ──────────────────────────────────────────
function shakeScreen() {
  const el = document.getElementById('screen-game');
  el.classList.remove('shake');
  void el.offsetWidth; // reflow trick
  el.classList.add('shake');
}

// ── Screen switching ──────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('gameTools').classList.toggle('hidden', id !== 'screen-game' && id !== 'screen-duel');
}

// ── Win / Game Over ───────────────────────────────────────
function doGameOver(msg) {
  state = STATE.OVER;
  showScreen('screen-result');
  document.getElementById('resultEmoji').textContent  = '💥';
  document.getElementById('resultTitle').textContent  = 'MISSION FAILED';
  document.getElementById('resultDesc').textContent   = msg;
  document.getElementById('resultStats').innerHTML    =
    `Enemies eliminated: ${kills}<br>Zone reached: ${currentZone + 1} / ${ZONE_DEFS.length}`;
  document.getElementById('pauseOverlay').classList.add('hidden');

  const btnRestart = document.getElementById('btnRestartLevel');
  if (btnRestart) {
    // Show restart level button if we are on zone 2 or 3 (index 1 or 2) and not in duel mode
    if (gameMode !== 'duel' && currentZone >= 1) {
      btnRestart.style.display = 'block';
    } else {
      btnRestart.style.display = 'none';
    }
  }
}

function doWin() {
  state = STATE.WIN;
  showScreen('screen-result');
  document.getElementById('resultEmoji').textContent  = '🏆';
  document.getElementById('resultTitle').textContent  = 'MISSION ACCOMPLISHED';
  document.getElementById('resultDesc').textContent   = 'All three zones cleared. Outstanding teamwork!';
  document.getElementById('resultStats').innerHTML    =
    `Enemies eliminated: ${kills}<br>Zones completed: ${ZONE_DEFS.length} / ${ZONE_DEFS.length}`;
  document.getElementById('pauseOverlay').classList.add('hidden');
  document.getElementById('btnRestartLevel').style.display = 'none';
}

// ── Menu canvas animation (animated top-down tank preview) ──
(function menuCanvas() {
  const mc = document.getElementById('menuCanvas');
  const mctx = mc.getContext('2d');
  let mt = 0;
  let prevTs = 0;

  function resize() { mc.width = window.innerWidth; mc.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  // Generate some "map tiles" for the background
  const bgTiles = [];
  for (let i = 0; i < 40; i++) {
    bgTiles.push({
      x: Math.random() * 2000 - 200,
      y: Math.random() * 1200 - 100,
      type: [T.WALL, T.TREE, T.ROAD, T.SAND, T.RUBBLE][Math.floor(Math.random() * 5)],
      size: 32 + Math.random() * 24
    });
  }
  // Roaming "ghost" tanks
  const ghosts = Array.from({length: 3}, (_, i) => ({
    x: 100 + i * 300, y: 100 + i * 200,
    angle: Math.random() * Math.PI * 2,
    speed: 40 + Math.random() * 30
  }));

  function animMenu(ts) {
    if (document.getElementById('screen-menu').classList.contains('active')) {
      const dt = Math.min((ts - prevTs) / 1000, 0.05);
      prevTs = ts;
      mt += dt;

      mctx.clearRect(0, 0, mc.width, mc.height);

      // Scrolling BG tiles
      for (const tile of bgTiles) {
        const tx = (tile.x + mt * 18) % (mc.width + 200) - 100;
        const ty = tile.y;
        mctx.fillStyle = TILE_COLORS[tile.type] || '#888';
        mctx.globalAlpha = 0.3;
        mctx.fillRect(tx, ty, tile.size, tile.size);
        mctx.globalAlpha = 1;
      }

      // Ghost tanks
      for (const g of ghosts) {
        g.x += Math.sin(g.angle) * g.speed * (1/60);
        g.y -= Math.cos(g.angle) * g.speed * (1/60);
        if (g.x > mc.width + 60) g.x = -60;
        if (g.x < -60) g.x = mc.width + 60;
        if (g.y > mc.height + 60) g.y = -60;
        if (g.y < -60) g.y = mc.height + 60;
        g.angle += (Math.random() - 0.5) * 0.04;

        mctx.save();
        mctx.globalAlpha = 0.25;
        mctx.translate(g.x, g.y);
        mctx.rotate(g.angle);
        mctx.fillStyle = '#4a6741';
        mctx.fillRect(-16, -22, 32, 44);
        mctx.fillStyle = '#334c2a';
        mctx.fillRect(-3, -30, 6, 26);
        mctx.restore();
      }
    }
    requestAnimationFrame(animMenu);
  }
  requestAnimationFrame(animMenu);
})();

// ── Button wiring ─────────────────────────────────────────
let _selectedMode = 'coop';

document.getElementById('btnCoop').addEventListener('click', () => {
  _selectedMode = 'coop';
  document.getElementById('btnCoop').classList.add('selected');
  document.getElementById('btnDuel').classList.remove('selected');
  document.getElementById('coopControls').classList.remove('hidden');
  document.getElementById('duelControls').classList.add('hidden');
  document.getElementById('btnStart').textContent = '⚔ CO-OP DEPLOY';
});

document.getElementById('btnDuel').addEventListener('click', () => {
  _selectedMode = 'duel';
  document.getElementById('btnDuel').classList.add('selected');
  document.getElementById('btnCoop').classList.remove('selected');
  document.getElementById('duelControls').classList.remove('hidden');
  document.getElementById('coopControls').classList.add('hidden');
  document.getElementById('btnStart').textContent = '⚔ DUEL START';
});

document.getElementById('btnStart').addEventListener('click', () => {
  gameMode = _selectedMode;
  document.getElementById('pauseOverlay').classList.add('hidden');
  if (gameMode === 'duel') {
    p1Score = 0; p2Score = 0; duelRound = 1;
    showScreen('screen-duel');
    resizeDuelCanvas();
    initDuel();
  } else {
    initGame();
  }
});

document.getElementById('btnRetry').addEventListener('click', () => {
  document.getElementById('pauseOverlay').classList.add('hidden');
  if (gameMode === 'duel') {
    p1Score = 0; p2Score = 0; duelRound = 1;
    showScreen('screen-duel');
    resizeDuelCanvas();
    initDuel();
  } else {
    initGame();
  }
});

const btnRestartLevel = document.getElementById('btnRestartLevel');
if (btnRestartLevel) {
  btnRestartLevel.addEventListener('click', () => {
    if (playerTank) {
      playerTank.maxHp += 50;
      playerTank.hp = playerTank.maxHp;
      playerTank.alive = true;
      playerTank.shells = 30;
      playerTank.mgHeat = 0;
      playerTank.mgOverheat = false;
      playerTank.cannonCooldown = 0;
    }
    loadZone(currentZone);
    state = STATE.PLAYING;
    lastTs = performance.now();
    simAccumulator = 0;
    showScreen('screen-game');
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameLoop);
  });
}

function setPauseUi(paused) {
  document.getElementById('pauseOverlay').classList.toggle('hidden', !paused);
  const button = document.getElementById('pauseBtn');
  button.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  button.title = paused ? 'Resume' : 'Pause (P or Esc)';
  button.innerHTML = `<i data-lucide="${paused ? 'play' : 'pause'}"></i>`;
  if (window.lucide) window.lucide.createIcons();
}

function pauseGame() {
  const coopActive = document.getElementById('screen-game').classList.contains('active');
  const duelActive = document.getElementById('screen-duel').classList.contains('active');
  if (coopActive && (state === STATE.PLAYING || state === STATE.ZONE_CLEAR)) {
    pausedFromState = state;
    state = STATE.PAUSED;
    setPauseUi(true);
  } else if (duelActive && duelState !== 'idle' && duelState !== 'done' && !duelPaused) {
    duelPaused = true;
    setPauseUi(true);
  }
}

function resumeGame() {
  if (state === STATE.PAUSED) {
    state = pausedFromState;
    lastTs = performance.now();
    simAccumulator = 0;
  }
  if (duelPaused) {
    duelPaused = false;
    duelLastTs = performance.now();
    duelAccumulator = 0;
  }
  setPauseUi(false);
}

function togglePause() {
  if (state === STATE.PAUSED || duelPaused) resumeGame();
  else pauseGame();
}

function toggleFullscreen() {
  const action = document.fullscreenElement
    ? document.exitFullscreen?.()
    : document.documentElement.requestFullscreen?.();
  action?.catch?.(() => {});
}

document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
document.getElementById('restartMissionBtn').addEventListener('click', () => {
  setPauseUi(false);
  if (gameMode === 'duel') {
    p1Score = 0; p2Score = 0; duelRound = 1; duelPaused = false;
    showScreen('screen-duel');
    initDuel();
  } else {
    initGame();
  }
});

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'KeyF') {
    e.preventDefault();
    toggleFullscreen();
  } else if ((e.code === 'KeyP' || e.code === 'Escape') &&
             (document.getElementById('screen-game').classList.contains('active') ||
              document.getElementById('screen-duel').classList.contains('active'))) {
    e.preventDefault();
    togglePause();
  }
});

window.addEventListener('blur', () => {
  Object.keys(keys).forEach(key => { if (Object.prototype.hasOwnProperty.call(keys, key)) keys[key] = false; });
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
document.addEventListener('fullscreenchange', () => {
  const button = document.getElementById('fullscreenBtn');
  const active = Boolean(document.fullscreenElement);
  button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  button.title = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
  button.innerHTML = `<i data-lucide="${active ? 'minimize' : 'maximize'}"></i>`;
  if (window.lucide) window.lucide.createIcons();
});

if (window.lucide) window.lucide.createIcons();

// ── Web Audio — Procedural Sound System ───────────────────
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) { /* audio not available */ }
}

function playSound(type) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    switch(type) {

      case 'cannon': {
        // Deep thud + rumble
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.4, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / audioCtx.sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 12) * 0.9
                  + Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 8) * 0.5;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        src.connect(gain);
        gain.connect(audioCtx.destination);
        src.start();
        break;
      }

      case 'mg': {
        // Short sharp click
        const osc = audioCtx.createOscillator();
        const g   = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.07);
        break;
      }

      case 'explosion': {
        // Burst of noise with low thud
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.6, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / audioCtx.sampleRate;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.8
                  + Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t * 5) * 0.4;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        src.connect(gain); gain.connect(audioCtx.destination);
        src.start();
        break;
      }

      case 'hit': {
        // Metal clang
        const osc = audioCtx.createOscillator();
        const g   = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(g); g.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.26);
        break;
      }
    }
  } catch(e) { /* silent fail */ }
}
