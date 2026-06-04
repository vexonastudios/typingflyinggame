// pool.js — 8-Ball Pool — Full Game Engine
(function () {
  'use strict';
  const $ = id => document.getElementById(id);

  // ======== RESPONSIVE TABLE SIZING ========
  // Base dimensions — we scale up/down from these based on viewport
  const BASE_W = 960, BASE_H = 520;
  function calcDimensions() {
    const maxW = Math.min(window.innerWidth - 40, 1400);
    const maxH = Math.min(window.innerHeight - 200, 780);
    const scale = Math.min(maxW / BASE_W, maxH / BASE_H, 1.5);
    return {
      W: Math.round(BASE_W * scale),
      H: Math.round(BASE_H * scale),
      scale,
    };
  }
  let dims = calcDimensions();
  let W = dims.W, H = dims.H, SCALE = dims.scale;

  const RAIL_BASE = 32;
  let RAIL, TL, TT, TR, TB, TW, TH;
  let BALL_R, POCKET_R, POCKET_RS;

  function recalcLayout() {
    RAIL = Math.round(RAIL_BASE * SCALE);
    TL = RAIL; TT = RAIL;
    TR = W - RAIL; TB = H - RAIL;
    TW = TR - TL; TH = TB - TT;
    BALL_R = Math.round(11 * SCALE);
    POCKET_R = Math.round(22 * SCALE);
    POCKET_RS = Math.round(18 * SCALE);
  }
  recalcLayout();

  // Pocket positions (recalculated on resize)
  function getPockets() {
    return [
      { x: TL - 2, y: TT - 2, r: POCKET_R },
      { x: W / 2, y: TT - 4, r: POCKET_RS },
      { x: TR + 2, y: TT - 2, r: POCKET_R },
      { x: TL - 2, y: TB + 2, r: POCKET_R },
      { x: W / 2, y: TB + 4, r: POCKET_RS },
      { x: TR + 2, y: TB + 2, r: POCKET_R },
    ];
  }
  let POCKETS = getPockets();

  const FRICTION = 0.986;
  const RESTITUTION = 0.96;
  const RAIL_REST = 0.72;
  const MIN_SPEED_BASE = 0.12;
  let MIN_SPEED = MIN_SPEED_BASE * SCALE;
  const MAX_POWER_BASE = 22;
  let MAX_POWER = MAX_POWER_BASE * SCALE;
  const SUBSTEPS = 3;

  // Ball colours (0=cue, 1-7=solids, 8=eight, 9-15=stripes)
  const BC = [
    '#ffffff', '#f5d800', '#003db5', '#d40000', '#4b0082',
    '#ff6600', '#006b3c', '#800020', '#1a1a1a', '#f5d800',
    '#003db5', '#d40000', '#4b0082', '#ff6600', '#006b3c', '#800020',
  ];

  // Rack order
  const RACK = [
    [1], [9, 2], [10, 8, 3], [11, 4, 12, 5], [6, 14, 13, 7, 15],
  ];

  // ======== AUDIO — Pre-generated ElevenLabs Sound Effects ========
  const SFX = {
    _ctx: null,
    _buffers: {},

    init() {
      if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this._ctx.state === 'suspended') this._ctx.resume();
    },

    // Load all pre-generated MP3 files
    async loadAll() {
      const files = {
        ball_hit1: 'sounds/pool-ball-hit1.mp3',
        ball_hit2: 'sounds/pool-ball-hit2.mp3',
        ball_hit3: 'sounds/pool-ball-hit3.mp3',
        rail:      'sounds/pool-rail.mp3',
        pocket:    'sounds/pool-pocket.mp3',
        cue_hit:   'sounds/pool-cue-hit.mp3',
        cue_break: 'sounds/pool-break.mp3',
        scratch:   'sounds/pool-scratch.mp3',
        foul:      'sounds/pool-foul.mp3',
        win:       'sounds/pool-win.mp3',
      };
      const entries = Object.entries(files);
      await Promise.allSettled(entries.map(async ([name, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${res.status}`);
          const buf = await this._ctx.decodeAudioData(await res.arrayBuffer());
          this._buffers[name] = buf;
        } catch (e) {
          console.warn(`[SFX] Failed to load "${name}":`, e.message);
        }
      }));
      console.log('[SFX] Loaded:', Object.keys(this._buffers).join(', '));
    },

    // Play a decoded buffer
    _play(name, vol = 0.6, rate = 1.0) {
      if (!this._buffers[name] || !this._ctx) return;
      try {
        if (this._ctx.state === 'suspended') this._ctx.resume();
        const src = this._ctx.createBufferSource();
        src.buffer = this._buffers[name];
        src.playbackRate.value = rate;
        const g = this._ctx.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(this._ctx.destination);
        src.start();
      } catch (e) {}
    },

    // --- Game sound methods ---
    hit(v) {
      const names = ['ball_hit1', 'ball_hit2', 'ball_hit3'];
      const name = names[Math.floor(Math.random() * names.length)];
      this._play(name, Math.min(0.8, v * 0.65), 0.92 + Math.random() * 0.16);
    },
    rail(v) {
      this._play('rail', Math.min(0.6, v * 0.5), 0.9 + Math.random() * 0.2);
    },
    pocket() {
      this._play('pocket', 0.7);
    },
    cueHit(pwr) {
      if (pwr > 0.7) {
        this._play('cue_break', 0.5 + pwr * 0.3);
      } else {
        this._play('cue_hit', 0.5 + pwr * 0.3, 0.95 + Math.random() * 0.1);
      }
    },
    foul() {
      this._play('foul', 0.55);
    },
    scratchSfx() {
      this._play('scratch', 0.6);
    },
    win() {
      this._play('win', 0.7);
    },
  };

  // ======== DOM ========
  const canvas = $('poolCanvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Update scoreboard/bottom-bar widths to match canvas
  function syncUIWidth() {
    const sb = $('scoreboard');
    const bb = document.querySelector('.bottom-bar');
    if (sb) sb.style.width = W + 'px';
    if (bb) bb.style.width = W + 'px';
  }
  syncUIWidth();

  // Handle window resize
  window.addEventListener('resize', () => {
    if (phase === PHASE.SETUP || phase === PHASE.OVER) {
      dims = calcDimensions();
      W = dims.W; H = dims.H; SCALE = dims.scale;
      canvas.width = W; canvas.height = H;
      recalcLayout();
      POCKETS = getPockets();
      MIN_SPEED = MIN_SPEED_BASE * SCALE;
      MAX_POWER = MAX_POWER_BASE * SCALE;
      syncUIWidth();
    }
  });

  // ======== STATE ========
  const PHASE = { SETUP: 0, AIM: 1, POWER: 2, ROLLING: 3, PLACING: 4, OVER: 5 };
  let phase = PHASE.SETUP;
  let turn = 1;
  let p1Type = null;
  let p2Type = null;
  let p1Pocketed = [];
  let p2Pocketed = [];
  let balls = [];
  let showGuide = true;
  let isBreak = true;
  let gameRunning = false;
  let animFrame = null;

  // Shot tracking
  let firstHitBall = null;
  let pocketedThisTurn = [];
  let cueScratch = false;

  // Input
  let mouse = { x: 0, y: 0 };
  let aimAngle = 0;
  let aimLocked = false;
  let powerDist = 0;
  let clickStart = null;

  // Placing cue ball
  let placeGhost = null;

  // ======== HELPERS ========
  function lighten(hex, f) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, Math.round(r * f));
    g = Math.min(255, Math.round(g * f));
    b = Math.min(255, Math.round(b * f));
    return `rgb(${r},${g},${b})`;
  }

  function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
  function speed(b) { return Math.sqrt(b.vx * b.vx + b.vy * b.vy); }

  // ======== BALL CREATION ========
  function createBalls() {
    balls = [];
    balls.push({ id: 0, x: TL + TW * 0.25, y: TT + TH / 2, vx: 0, vy: 0, pocketed: false });
    const rackX = TL + TW * 0.72;
    const rackY = TT + TH / 2;
    const rowGap = BALL_R * 2 * Math.cos(Math.PI / 6);
    RACK.forEach((row, ri) => {
      const rowY = rackY - (row.length - 1) * BALL_R;
      row.forEach((id, ci) => {
        balls.push({
          id,
          x: rackX + ri * rowGap,
          y: rowY + ci * BALL_R * 2,
          vx: 0, vy: 0, pocketed: false,
        });
      });
    });
  }

  function cueBall() { return balls.find(b => b.id === 0); }
  function activeBalls() { return balls.filter(b => !b.pocketed); }
  function allStopped() { return activeBalls().every(b => speed(b) < MIN_SPEED); }

  // ======== PHYSICS ========
  function updatePhysics() {
    for (const b of balls) {
      if (b.pocketed) continue;
      b.vx *= FRICTION;
      b.vy *= FRICTION;
      if (speed(b) < MIN_SPEED) { b.vx = 0; b.vy = 0; }
    }
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of balls) {
        if (b.pocketed) continue;
        b.x += b.vx / SUBSTEPS;
        b.y += b.vy / SUBSTEPS;
      }
      resolveBallCollisions();
      resolveRails();
      checkPockets();
    }
  }

  function resolveBallCollisions() {
    const active = activeBalls();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const minD = BALL_R * 2;
        if (d < minD && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          const overlap = (minD - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          b.x += nx * overlap; b.y += ny * overlap;
          const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dvn > 0) {
            const imp = dvn * (1 + RESTITUTION) / 2;
            a.vx -= imp * nx; a.vy -= imp * ny;
            b.vx += imp * nx; b.vy += imp * ny;
            onBallHit(a, b);
          }
        }
      }
    }
  }

  function onBallHit(a, b) {
    const relSpd = Math.sqrt((a.vx - b.vx) ** 2 + (a.vy - b.vy) ** 2);
    SFX.hit(Math.min(1, relSpd / (12 * SCALE)));
    if (firstHitBall === null) {
      if (a.id === 0) firstHitBall = b;
      else if (b.id === 0) firstHitBall = a;
    }
  }

  function resolveRails() {
    for (const b of balls) {
      if (b.pocketed) continue;
      let nearPocket = false;
      for (const p of POCKETS) {
        if (dist(b, p) < p.r + 4) { nearPocket = true; break; }
      }
      if (nearPocket) continue;
      if (b.x - BALL_R < TL) { b.x = TL + BALL_R; b.vx = Math.abs(b.vx) * RAIL_REST; SFX.rail(speed(b) / (10 * SCALE)); }
      if (b.x + BALL_R > TR) { b.x = TR - BALL_R; b.vx = -Math.abs(b.vx) * RAIL_REST; SFX.rail(speed(b) / (10 * SCALE)); }
      if (b.y - BALL_R < TT) { b.y = TT + BALL_R; b.vy = Math.abs(b.vy) * RAIL_REST; SFX.rail(speed(b) / (10 * SCALE)); }
      if (b.y + BALL_R > TB) { b.y = TB - BALL_R; b.vy = -Math.abs(b.vy) * RAIL_REST; SFX.rail(speed(b) / (10 * SCALE)); }
    }
  }

  function checkPockets() {
    for (const b of balls) {
      if (b.pocketed) continue;
      for (const p of POCKETS) {
        if (dist(b, p) < p.r - 2) {
          b.pocketed = true;
          b.vx = 0; b.vy = 0;
          if (b.id === 0) {
            SFX.scratchSfx();
            cueScratch = true;
          } else {
            SFX.pocket();
          }
          pocketedThisTurn.push(b.id);
          break;
        }
      }
    }
  }

  // ======== TRAJECTORY GUIDE ========
  function findFirstHit(ox, oy, dx, dy) {
    let best = { t: 9999, type: null, ball: null };
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return best;
    const ndx = dx / len, ndy = dy / len;

    for (const b of balls) {
      if (b.pocketed || b.id === 0) continue;
      const ex = ox - b.x, ey = oy - b.y;
      const a2 = ndx * ndx + ndy * ndy;
      const b2 = 2 * (ex * ndx + ey * ndy);
      const c2 = ex * ex + ey * ey - (BALL_R * 2) ** 2;
      const disc = b2 * b2 - 4 * a2 * c2;
      if (disc < 0) continue;
      const t = (-b2 - Math.sqrt(disc)) / (2 * a2);
      if (t > 1 && t < best.t) {
        best = { t, type: 'ball', ball: b, px: ox + ndx * t, py: oy + ndy * t };
      }
    }

    if (ndx < 0) { const t = (TL + BALL_R - ox) / ndx; if (t > 1 && t < best.t) best = { t, type: 'rail', px: TL + BALL_R, py: oy + ndy * t }; }
    if (ndx > 0) { const t = (TR - BALL_R - ox) / ndx; if (t > 1 && t < best.t) best = { t, type: 'rail', px: TR - BALL_R, py: oy + ndy * t }; }
    if (ndy < 0) { const t = (TT + BALL_R - oy) / ndy; if (t > 1 && t < best.t) best = { t, type: 'rail', px: ox + ndx * t, py: TT + BALL_R }; }
    if (ndy > 0) { const t = (TB - BALL_R - oy) / ndy; if (t > 1 && t < best.t) best = { t, type: 'rail', px: ox + ndx * t, py: TB - BALL_R }; }
    return best;
  }

  // ======== SHOOTING ========
  function shoot(power) {
    const cb = cueBall();
    if (!cb || cb.pocketed) return;
    cb.vx = Math.cos(aimAngle) * power;
    cb.vy = Math.sin(aimAngle) * power;
    SFX.cueHit(power / MAX_POWER);
    firstHitBall = null;
    pocketedThisTurn = [];
    cueScratch = false;
    phase = PHASE.ROLLING;
    updateStatus('Balls in motion...');
  }

  // ======== TURN MANAGEMENT ========
  function endTurn() {
    const eightPocketed = pocketedThisTurn.includes(8);
    const playerType = turn === 1 ? p1Type : p2Type;

    if (isBreak && eightPocketed) {
      const e8 = balls.find(b => b.id === 8);
      e8.pocketed = false;
      e8.x = TL + TW * 0.72; e8.y = TT + TH / 2;
      e8.vx = 0; e8.vy = 0;
      pocketedThisTurn = pocketedThisTurn.filter(id => id !== 8);
      showMessage('8-ball re-spotted!', '#ffcc00');
    }

    if (p1Type === null && !isBreak) {
      const nonEight = pocketedThisTurn.filter(id => id !== 0 && id !== 8);
      if (nonEight.length > 0) {
        const isSolid = nonEight[0] >= 1 && nonEight[0] <= 7;
        if (turn === 1) { p1Type = isSolid ? 'solids' : 'stripes'; p2Type = isSolid ? 'stripes' : 'solids'; }
        else { p2Type = isSolid ? 'solids' : 'stripes'; p1Type = isSolid ? 'stripes' : 'solids'; }
        showMessage(`Player ${turn} is ${turn === 1 ? p1Type : p2Type}!`, '#44ff88');
        updateScoreboard();
      }
    }
    isBreak = false;

    for (const id of pocketedThisTurn) {
      if (id === 0 || id === 8) continue;
      if (turn === 1) p1Pocketed.push(id);
      else p2Pocketed.push(id);
    }

    if (eightPocketed && !isBreak) {
      const allCleared = playerCleared(turn);
      if (allCleared && !cueScratch) { gameOver(turn); return; }
      else { gameOver(turn === 1 ? 2 : 1); return; }
    }

    let foul = false, foulReason = '';
    if (cueScratch) { foul = true; foulReason = 'Scratch! Cue ball pocketed.'; }
    else if (firstHitBall === null) { foul = true; foulReason = 'Foul! No ball hit.'; }
    else if (playerType) {
      const hitSolid = firstHitBall.id >= 1 && firstHitBall.id <= 7;
      const hitStripe = firstHitBall.id >= 9 && firstHitBall.id <= 15;
      const wantsSolids = playerType === 'solids';
      const cleared = playerCleared(turn);
      if (cleared) { if (firstHitBall.id !== 8) { foul = true; foulReason = 'Foul! Must hit the 8-ball.'; } }
      else if (wantsSolids && !hitSolid) { foul = true; foulReason = "Foul! Hit opponent's ball first."; }
      else if (!wantsSolids && !hitStripe) { foul = true; foulReason = "Foul! Hit opponent's ball first."; }
    }

    if (foul) {
      SFX.foul();
      showMessage(foulReason, '#ff4444');
      respawnCue();
      switchTurn();
      phase = PHASE.PLACING;
      updateStatus('Place the cue ball');
      return;
    }

    const playerPocketed = pocketedThisTurn.filter(id => {
      if (id === 0 || id === 8) return false;
      if (!playerType) return true;
      const isSolid = id >= 1 && id <= 7;
      return (playerType === 'solids') === isSolid;
    });

    if (playerPocketed.length > 0) {
      showMessage('Nice shot! Go again.', '#44ff88');
      phase = PHASE.AIM;
      updateStatus('Your turn — aim your shot');
    } else {
      switchTurn();
      phase = PHASE.AIM;
      updateStatus('Aim your shot');
    }
    updateScoreboard();
  }

  function playerCleared(p) {
    const type = p === 1 ? p1Type : p2Type;
    if (!type) return false;
    const isSolids = type === 'solids';
    return balls.filter(b => !b.pocketed && (isSolids ? (b.id >= 1 && b.id <= 7) : (b.id >= 9 && b.id <= 15))).length === 0;
  }

  function switchTurn() { turn = turn === 1 ? 2 : 1; updateTurnIndicator(); }

  function respawnCue() {
    const cb = cueBall();
    cb.pocketed = false; cb.vx = 0; cb.vy = 0;
    cb.x = TL + TW * 0.25; cb.y = TT + TH / 2;
  }

  function gameOver(winner) {
    phase = PHASE.OVER;
    gameRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    SFX.win();
    $('resultsEmoji').textContent = winner === 1 ? '🔴' : '🔵';
    $('resultsHeadline').textContent = `Player ${winner} Wins!`;
    $('resultsHeadline').className = 'results-headline ' + (winner === 1 ? 'p1-win' : 'p2-win');
    $('resultsSub').textContent = `Solids: ${balls.filter(b => b.pocketed && b.id >= 1 && b.id <= 7).length}/7  •  Stripes: ${balls.filter(b => b.pocketed && b.id >= 9 && b.id <= 15).length}/7`;
    setTimeout(() => { $('resultsOverlay').style.display = 'flex'; }, 600);
  }

  // ======== RENDERING ========
  function drawTable() {
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(0, 0, W, H);

    const woodGrad = ctx.createLinearGradient(0, 0, W, H);
    woodGrad.addColorStop(0, '#5c2e0e');
    woodGrad.addColorStop(0.3, '#7a3d14');
    woodGrad.addColorStop(0.5, '#6b3210');
    woodGrad.addColorStop(0.7, '#7a3d14');
    woodGrad.addColorStop(1, '#5c2e0e');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(4, 4, W - 8, H - 8);

    ctx.fillStyle = '#4a2208';
    ctx.fillRect(RAIL - 6, RAIL - 6, TW + 12, TH + 12);

    const feltGrad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, TW * 0.7);
    feltGrad.addColorStop(0, '#1e7a3a');
    feltGrad.addColorStop(1, '#145a28');
    ctx.fillStyle = feltGrad;
    ctx.fillRect(TL, TT, TW, TH);

    // Felt grain
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(TL + Math.random() * TW, TT + Math.random() * TH, 2 * SCALE, 1);
    }

    // Head string
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(TL + TW * 0.25, TT);
    ctx.lineTo(TL + TW * 0.25, TB);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spots
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(TL + TW * 0.72, TT + TH / 2, 3 * SCALE, 0, Math.PI * 2); ctx.fill();

    // Diamond sights
    ctx.fillStyle = '#c9a84c';
    for (let i = 1; i <= 7; i++) {
      const x = TL + (TW / 8) * i;
      ctx.beginPath(); ctx.arc(x, TT - RAIL / 2 + 2, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, TB + RAIL / 2 - 2, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 1; i <= 3; i++) {
      const y = TT + (TH / 4) * i;
      ctx.beginPath(); ctx.arc(TL - RAIL / 2 + 2, y, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(TR + RAIL / 2 - 2, y, 3 * SCALE, 0, Math.PI * 2); ctx.fill();
    }

    // Cushion edge
    ctx.strokeStyle = '#2a8a48';
    ctx.lineWidth = 2;
    ctx.strokeRect(TL, TT, TW, TH);

    // Pockets
    for (const p of POCKETS) {
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      const pGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      pGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
      pGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pGrad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBall(b) {
    if (b.pocketed) return;
    const { x, y, id } = b;
    const color = BC[id];
    const isCue = id === 0;
    const isStripe = id >= 9;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * SCALE, y + 2 * SCALE, BALL_R, BALL_R * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isCue) {
      const g = ctx.createRadialGradient(x - 3 * SCALE, y - 3 * SCALE, 1, x, y, BALL_R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#e8e8e8');
      g.addColorStop(1, '#aaaaaa');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
    } else if (isStripe) {
      const g = ctx.createRadialGradient(x - 3 * SCALE, y - 3 * SCALE, 1, x, y, BALL_R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#eeeeee');
      g.addColorStop(1, '#aaaaaa');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, BALL_R - 0.5, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(x - BALL_R, y - BALL_R * 0.42, BALL_R * 2, BALL_R * 0.84);
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(x - 3 * SCALE, y - 3 * SCALE, 1, x, y, BALL_R);
      g.addColorStop(0, lighten(color, 1.4));
      g.addColorStop(0.6, color);
      g.addColorStop(1, lighten(color, 0.5));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
    }

    if (!isCue) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, BALL_R * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = `bold ${Math.round(BALL_R * 0.65)}px Outfit, Arial`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(id, x, y + 0.5);
    }

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x - BALL_R * 0.25, y - BALL_R * 0.3, BALL_R * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.stroke();
  }

  function drawAimLine() {
    const cb = cueBall();
    if (!cb || cb.pocketed) return;
    if (phase !== PHASE.AIM && phase !== PHASE.POWER) return;
    const dirX = Math.cos(aimAngle), dirY = Math.sin(aimAngle);

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(cb.x, cb.y);
    ctx.lineTo(cb.x + dirX * 500 * SCALE, cb.y + dirY * 500 * SCALE);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!showGuide) return;
    const hit = findFirstHit(cb.x, cb.y, dirX, dirY);
    if (hit.t < 9000) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hit.px, hit.py, BALL_R, 0, Math.PI * 2); ctx.stroke();

      if (hit.type === 'ball') {
        const tb = hit.ball;
        const nx = (tb.x - hit.px) / (BALL_R * 2);
        const ny = (tb.y - hit.py) / (BALL_R * 2);

        ctx.strokeStyle = 'rgba(255,200,50,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(tb.x, tb.y);
        ctx.lineTo(tb.x + nx * 80 * SCALE, tb.y + ny * 80 * SCALE);
        ctx.stroke();

        const dot = dirX * nx + dirY * ny;
        const cdx = dirX - dot * nx, cdy = dirY - dot * ny;
        const cl = Math.sqrt(cdx * cdx + cdy * cdy) || 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.moveTo(hit.px, hit.py);
        ctx.lineTo(hit.px + (cdx / cl) * 60 * SCALE, hit.py + (cdy / cl) * 60 * SCALE);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawCueStick() {
    const cb = cueBall();
    if (!cb || cb.pocketed) return;
    if (phase !== PHASE.AIM && phase !== PHASE.POWER) return;
    const backAngle = aimAngle + Math.PI;
    const pullback = phase === PHASE.POWER ? (powerDist / (150 * SCALE)) * 60 * SCALE + 15 * SCALE : 15 * SCALE;
    const stickLen = 220 * SCALE;

    ctx.save();
    ctx.translate(cb.x + Math.cos(backAngle) * pullback, cb.y + Math.sin(backAngle) * pullback);
    ctx.rotate(backAngle);

    ctx.fillStyle = '#eee';
    ctx.fillRect(0, -1.5 * SCALE, 8 * SCALE, 3 * SCALE);
    const shaftGrad = ctx.createLinearGradient(8 * SCALE, 0, stickLen * 0.6, 0);
    shaftGrad.addColorStop(0, '#ddb86a');
    shaftGrad.addColorStop(0.5, '#c9a84c');
    shaftGrad.addColorStop(1, '#b8923a');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(8 * SCALE, -2 * SCALE, stickLen * 0.55, 4 * SCALE);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(8 * SCALE + stickLen * 0.55, -2.5 * SCALE, 20 * SCALE, 5 * SCALE);
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(28 * SCALE + stickLen * 0.55, -3 * SCALE, stickLen * 0.3, 6 * SCALE);
    ctx.fillStyle = '#111';
    ctx.fillRect(28 * SCALE + stickLen * 0.55 + stickLen * 0.3, -3.5 * SCALE, 8 * SCALE, 7 * SCALE);
    ctx.restore();

    // Power bar
    if (phase === PHASE.POWER && powerDist > 5) {
      const pwr = Math.min(1, powerDist / (150 * SCALE));
      const barH = 140 * SCALE;
      const barX = W - 30 * SCALE;
      const barY = H / 2 - barH / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX - 8 * SCALE, barY - 4, 16 * SCALE, barH + 8);
      const fillH = barH * pwr;
      const barGrad = ctx.createLinearGradient(0, barY + barH, 0, barY);
      barGrad.addColorStop(0, '#44ff44');
      barGrad.addColorStop(0.5, '#ffcc00');
      barGrad.addColorStop(1, '#ff2222');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX - 5 * SCALE, barY + barH - fillH, 10 * SCALE, fillH);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(10 * SCALE)}px Outfit`;
      ctx.textAlign = 'center';
      ctx.fillText('PWR', barX, barY - 10 * SCALE);
      ctx.fillText(`${Math.round(pwr * 100)}%`, barX, barY + barH + 16 * SCALE);
    }
  }

  function drawPlacingGhost() {
    if (phase !== PHASE.PLACING) return;
    const gx = Math.max(TL + BALL_R, Math.min(TR - BALL_R, mouse.x));
    const gy = Math.max(TT + BALL_R, Math.min(TB - BALL_R, mouse.y));
    let valid = true;
    for (const b of balls) {
      if (b.pocketed || b.id === 0) continue;
      if (dist({ x: gx, y: gy }, b) < BALL_R * 2.2) { valid = false; break; }
    }
    placeGhost = valid ? { x: gx, y: gy } : null;
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = valid ? '#44ff88' : '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx, gy, BALL_R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = valid ? 'rgba(255,255,255,0.3)' : 'rgba(255,100,100,0.2)';
    ctx.beginPath(); ctx.arc(gx, gy, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawTable();
    for (const b of balls) { if (b.id !== 0) drawBall(b); }
    drawBall(cueBall());
    drawAimLine();
    drawCueStick();
    drawPlacingGhost();
  }

  // ======== GAME LOOP ========
  function gameLoop() {
    if (!gameRunning) return;
    if (phase === PHASE.ROLLING) {
      updatePhysics();
      if (allStopped()) endTurn();
    }
    render();
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ======== UI HELPERS ========
  function showMessage(text, color) {
    const el = $('msgFlash');
    $('msgText').textContent = text;
    $('msgText').style.color = color || '#fff';
    el.style.display = 'flex';
    setTimeout(() => { el.style.display = 'none'; }, 2200);
  }

  function updateTurnIndicator() {
    const el = $('turnIndicator');
    el.textContent = `Player ${turn}'s Turn`;
    el.className = 'turn-indicator ' + (turn === 1 ? 'p1-turn' : 'p2-turn');
  }

  function updateStatus(text) { $('turnStatus').textContent = text; }

  function updateScoreboard() {
    $('p1Type').textContent = p1Type ? (p1Type === 'solids' ? '● Solids (1-7)' : '◐ Stripes (9-15)') : '';
    $('p2Type').textContent = p2Type ? (p2Type === 'solids' ? '● Solids (1-7)' : '◐ Stripes (9-15)') : '';
    function renderPocketed(elId, pocketed) {
      const el = $(elId);
      el.innerHTML = '';
      for (const id of pocketed) {
        if (id === 0 || id === 8) continue;
        const div = document.createElement('div');
        div.className = 'pocketed-ball';
        div.style.background = BC[id];
        div.textContent = id;
        if (id >= 9) {
          div.style.background = `linear-gradient(to bottom, #fff 20%, ${BC[id]} 40%, ${BC[id]} 60%, #fff 80%)`;
          div.style.color = '#111';
        }
        el.appendChild(div);
      }
    }
    const solids = balls.filter(b => b.pocketed && b.id >= 1 && b.id <= 7).map(b => b.id);
    const stripes = balls.filter(b => b.pocketed && b.id >= 9 && b.id <= 15).map(b => b.id);
    if (p1Type === 'solids') { renderPocketed('p1Pocketed', solids); renderPocketed('p2Pocketed', stripes); }
    else if (p1Type === 'stripes') { renderPocketed('p1Pocketed', stripes); renderPocketed('p2Pocketed', solids); }
    else { renderPocketed('p1Pocketed', []); renderPocketed('p2Pocketed', []); }
  }

  // ======== INPUT ========
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (W / rect.width);
    mouse.y = (e.clientY - rect.top) * (H / rect.height);
    if (phase === PHASE.AIM) {
      const cb = cueBall();
      if (cb && !cb.pocketed) aimAngle = Math.atan2(mouse.y - cb.y, mouse.x - cb.x);
    } else if (phase === PHASE.POWER && clickStart) {
      const backDirX = -Math.cos(aimAngle), backDirY = -Math.sin(aimAngle);
      const dx = mouse.x - clickStart.x, dy = mouse.y - clickStart.y;
      powerDist = Math.max(0, dx * backDirX + dy * backDirY);
    }
  });

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (phase === PHASE.PLACING) {
      if (placeGhost) {
        const cb = cueBall();
        cb.x = placeGhost.x; cb.y = placeGhost.y;
        cb.pocketed = false;
        phase = PHASE.AIM;
        updateStatus('Aim your shot');
      }
      return;
    }
    if (phase === PHASE.AIM) {
      const cb = cueBall();
      if (!cb || cb.pocketed) return;
      aimLocked = true;
      clickStart = { x: mouse.x, y: mouse.y };
      powerDist = 0;
      phase = PHASE.POWER;
    }
  });

  canvas.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    if (phase === PHASE.POWER) {
      if (powerDist > 8 * SCALE) {
        const pwr = Math.min(MAX_POWER, (powerDist / (150 * SCALE)) * MAX_POWER);
        shoot(pwr);
      } else {
        phase = PHASE.AIM;
      }
      aimLocked = false;
      clickStart = null;
      powerDist = 0;
    }
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ======== GAME START ========
  function startGame() {
    // Apply latest dimensions
    dims = calcDimensions();
    W = dims.W; H = dims.H; SCALE = dims.scale;
    canvas.width = W; canvas.height = H;
    recalcLayout();
    POCKETS = getPockets();
    MIN_SPEED = MIN_SPEED_BASE * SCALE;
    MAX_POWER = MAX_POWER_BASE * SCALE;
    syncUIWidth();

    createBalls();
    turn = 1;
    p1Type = null; p2Type = null;
    p1Pocketed = []; p2Pocketed = [];
    isBreak = true;
    phase = PHASE.AIM;
    gameRunning = true;
    firstHitBall = null;
    pocketedThisTurn = [];
    cueScratch = false;

    updateTurnIndicator();
    updateStatus('Break Shot — aim and fire!');
    updateScoreboard();
    render();

    if (animFrame) cancelAnimationFrame(animFrame);
    gameLoop();
  }

  // ======== UI EVENTS ========
  $('startBtn').addEventListener('click', () => {
    SFX.init();
    showGuide = $('guideToggle').checked;
    $('guideToggleGame').checked = showGuide;
    $('setupOverlay').style.display = 'none';
    $('gameArea').style.display = 'flex';

    // Load ElevenLabs sound effects in background (non-blocking)
    SFX.loadAll().then(() => console.log('[Pool] SFX loaded'));

    // Start procedural jazz music
    PoolMusic.init(SFX._ctx);
    PoolMusic.start();

    startGame();
  });

  $('guideToggleGame').addEventListener('change', e => { showGuide = e.target.checked; });

  $('menuBtn').addEventListener('click', () => {
    gameRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    PoolMusic.stop();
    $('gameArea').style.display = 'none';
    $('resultsOverlay').style.display = 'none';
    $('setupOverlay').style.display = 'flex';
  });

  $('rematchBtn').addEventListener('click', () => {
    $('resultsOverlay').style.display = 'none';
    PoolMusic.start();
    startGame();
  });

  $('backMenuBtn').addEventListener('click', () => {
    $('resultsOverlay').style.display = 'none';
    $('gameArea').style.display = 'none';
    PoolMusic.stop();
    $('setupOverlay').style.display = 'flex';
  });

})();

