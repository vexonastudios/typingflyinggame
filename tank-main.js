// tank-main.js — Game loop, state machine, zone management, HUD

// ── State ─────────────────────────────────────────────────
const STATE = { MENU: 0, PLAYING: 1, ZONE_CLEAR: 2, OVER: 3, WIN: 4 };
let state = STATE.MENU;
let lastTs = 0;
let gameMode = 'coop'; // 'coop' | 'duel'

// ── Game world ────────────────────────────────────────────
let playerTank, projectiles, particles, enemies, ammoCrates, floatingTexts;
let currentZone, zoneMap, worldOffsetX;
let kills = 0, zoneClearTimer = 0, zoneStarted = false;

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
  zoneStarted = false;

  // Spawn enemies
  for (const s of def.enemySpawns) {
    const wx = s.col * TILE_SIZE + TILE_SIZE / 2;
    const wy = s.row * TILE_SIZE + TILE_SIZE / 2;
    if (s.type === 'infantry') enemies.push(new EnemyInfantry(wx, wy));
    else if (s.type === 'bunker') enemies.push(new EnemyBunker(wx, wy));
    else if (s.type === 'tank')   enemies.push(new EnemyTank(wx, wy));
  }

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
  }

  hudZone.textContent = def.name;
  showMessage('');
}

// ── Init full game ────────────────────────────────────────
function initGame() {
  kills = 0;
  playerTank = null;
  loadZone(0);
  state = STATE.PLAYING;
  lastTs = performance.now();
  initAudio();
  showScreen('screen-game');
  // Small delay before starting loop so the screen is visible
  requestAnimationFrame(gameLoop);
}

// ── Main loop ─────────────────────────────────────────────
function gameLoop(ts) {
  if (state === STATE.OVER || state === STATE.WIN) return;

  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
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

  // Player
  playerTank.update(dt, keys, zoneMap, worldOffsetX, enemies);
  if (!playerTank.alive) { doGameOver('Your tank was destroyed!'); return; }

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
          playerTank.takeDamage(p.damage);
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

  // ── Zone clear check ──────────────────────────────────
  // zoneStarted guard prevents false trigger if a zone has 0 enemies
  if (!zoneStarted && state === STATE.PLAYING) zoneStarted = true;
  if (zoneStarted && enemies.length === 0 && state === STATE.PLAYING) {
    // Check if we're at the objective (zone 3) or just zone clear
    const totalZones = ZONE_DEFS.length;
    const msg = currentZone < totalZones - 1
      ? `ZONE CLEAR! Advancing in 3s...`
      : `OBJECTIVE REACHED! Mission complete!`;
    showMessage(msg);
    state = STATE.ZONE_CLEAR;
    zoneClearTimer = 3.0;
  }

  // ── HUD update ────────────────────────────────────────
  updateHUD();
}

// ── Render ────────────────────────────────────────────────
function render() {
  gctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  // Map
  drawMap(gctx, zoneMap, camX, camY, worldOffsetX);

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
  drawMinimap(zoneMap, worldOffsetX, playerTank, enemies);
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
    showScreen('screen-game');
    requestAnimationFrame(gameLoop);
  });
}

// Pause on P key
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP') {
    if (state === STATE.PLAYING) {
      state = STATE.ZONE_CLEAR; // repurpose as "paused" indicator
      zoneClearTimer = Infinity;
      showMessage('⏸ PAUSED — Press P to resume');
    } else if (state === STATE.ZONE_CLEAR && zoneClearTimer === Infinity) {
      state = STATE.PLAYING;
      showMessage('');
    }
  }
});

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

