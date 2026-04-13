'use strict';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const CW = 1440;
const CH = 810;
const TRACK_WIDTH = 102;
const LAPS = 3;

const P_COLORS  = ['#e84040', '#2e9bf0', '#2ec97a', '#f5a623'];
const P_NAMES   = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const P_LABELS  = ['P1', 'P2', 'P3', 'P4'];
const ORDINALS  = ['1st', '2nd', '3rd', '4th'];
const MEDALS    = ['🥇', '🥈', '🥉', '  '];

const CONTROLS = [
  { up:'ArrowUp',  down:'ArrowDown',  left:'ArrowLeft',  right:'ArrowRight' },
  { up:'KeyW',     down:'KeyS',       left:'KeyA',       right:'KeyD'       },
  { up:'KeyI',     down:'KeyK',       left:'KeyJ',       right:'KeyL'       },
  { up:'Numpad8',  down:'Numpad2',    left:'Numpad4',    right:'Numpad6'    },
];

const CTRL_LABELS = [
  'Arrow Keys',
  'W A S D',
  'I J K L',
  'Numpad 8 4 2 6',
];

// Track centre-line waypoints (hand-tuned to give a fun circuit on 1440×810)
const RAW_WP = [
  [720,730], [970,728], [1180,674], [1330,554],
  [1388,408],[1328,256],[1164,155],[936,112],
  [720,104], [506,112], [308,165], [164,270],
  [106,410], [158,548], [318,642], [516,714],
  [720,730]   // close the loop (same as first)
];

// Physical constants
const MAX_SPEED   = 375;
const MAX_GRASS   = 140;
const ACCEL       = 300;
const FRICTION    = 0.92;   // per-frame multiplier (applied each physics tick)
const TURN_SPD    = 2.7;    // rad/s at full speed
const MIN_TURN_V  = 35;     // minimum speed to allow turning
const CAR_HL      = 24;     // half-length of car rect
const CAR_HW      = 13;     // half-width
const COL_RADIUS  = 22;     // circle collision radius per car

// ─────────────────────────────────────────────
// Maths helpers
// ─────────────────────────────────────────────
function catmullRomPt(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return {
    x: 0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    y: 0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
  };
}

function buildSpline(raw, sps = 28) {
  // raw last point == raw first point (closed loop); segments = raw.length-1
  const segs = raw.length - 1;
  const pts  = [];
  for (let i = 0; i < segs; i++) {
    const p0 = raw[(i - 1 + segs) % segs];
    const p1 = raw[i];
    const p2 = raw[(i + 1) % segs];
    const p3 = raw[(i + 2) % segs];
    for (let s = 0; s < sps; s++) {
      pts.push(catmullRomPt(p0, p1, p2, p3, s / sps));
    }
  }
  return pts;
}

function rrect(ctx, x, y, w, h, r) {
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

function darken(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, (n>>16)+amt);
  const g = Math.max(0, ((n>>8)&0xff)+amt);
  const b = Math.max(0, (n&0xff)+amt);
  return `rgb(${r},${g},${b})`;
}

// ─────────────────────────────────────────────
// Sound Engine (Web Audio API)
// ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  resume: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
  
  playTone: (freq, type, duration, vol=0.1, rampOut=true) => {
    try {
      Sfx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      if (rampOut) {
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      } else {
        gain.gain.setValueAtTime(vol, audioCtx.currentTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      }
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  },

  bump: (force) => {
    try {
      Sfx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.15);
      
      const v = Math.min(force * 0.0015, 0.4);
      gain.gain.setValueAtTime(v, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch(e) {}
  },

  countdownBeep: () => Sfx.playTone(440, 'square', 0.15, 0.08, false),
  countdownGo: ()   => Sfx.playTone(880, 'square', 0.4, 0.12, false),
  lapComplete: ()   => Sfx.playTone(600, 'sine', 0.25, 0.1),
  raceFinish: ()    => {
    Sfx.playTone(523.25, 'sine', 0.15, 0.1);
    setTimeout(() => Sfx.playTone(659.25, 'sine', 0.15, 0.1), 150);
    setTimeout(() => Sfx.playTone(783.99, 'sine', 0.4, 0.1), 300);
  }
};

// ─────────────────────────────────────────────
// Main game class
// ─────────────────────────────────────────────
class PixelRacer {
  constructor() {
    this.canvas = document.getElementById('raceCanvas');
    this.ctx    = this.canvas.getContext('2d');

    // Build track geometry
    this.tPts = buildSpline(RAW_WP, 28);   // ~448 pts
    this.N    = this.tPts.length;
    this._buildWalls();

    // State
    this.keys        = {};
    this.playerCount = 2;
    this.players     = [];
    this.state       = 'setup';
    this.raceTimer   = 0;
    this.results     = [];
    this.lastTs      = 0;
    this._raceEndCountdown = null;
    this._colSparks  = [];   // shared collision spark pool
    this._shake      = 0;    // screen-shake intensity

    this._bindEvents();
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
    this._buildControlsGrid();
    requestAnimationFrame(ts => this._loop(ts));
  }

  // ── Build outer/inner wall arrays ──────────
  _buildWalls() {
    this.outer = [];
    this.inner = [];
    const hw = TRACK_WIDTH / 2;
    for (let i = 0; i < this.N; i++) {
      const nx = this.tPts[(i + 1) % this.N];
      const dx = nx.x - this.tPts[i].x;
      const dy = nx.y - this.tPts[i].y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py =  dx / len;
      this.outer.push({ x: this.tPts[i].x + px * hw, y: this.tPts[i].y + py * hw });
      this.inner.push({ x: this.tPts[i].x - px * hw, y: this.tPts[i].y - py * hw });
    }
  }

  // ── Canvas scaling ─────────────────────────
  _resizeCanvas() {
    const wR = window.innerWidth  / CW;
    const hR = window.innerHeight / CH;
    const s  = Math.min(wR, hR);
    this.canvas.style.width  = (CW * s) + 'px';
    this.canvas.style.height = (CH * s) + 'px';
  }

  // ── Controls grid in setup ─────────────────
  _buildControlsGrid() {
    const grid = document.getElementById('controlsGrid');
    const update = () => {
      grid.innerHTML = '';
      for (let i = 0; i < this.playerCount; i++) {
        const div = document.createElement('div');
        div.className = 'ctrl-card';
        div.innerHTML = `
          <div class="ctrl-dot" style="background:${P_COLORS[i]}"></div>
          <div class="ctrl-info">
            <div class="ctrl-name">${P_NAMES[i]}</div>
            <div class="ctrl-keys">${CTRL_LABELS[i]}</div>
          </div>`;
        grid.appendChild(div);
      }
    };
    update();
    // Expose for re-call when count changes
    this._refreshControls = update;
  }

  // ── Event binding ──────────────────────────
  _bindEvents() {
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      // Prevent page scroll from arrow / space keys during race
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    document.getElementById('p2Btn').addEventListener('click', () => this._setCount(2));
    document.getElementById('p3Btn').addEventListener('click', () => this._setCount(3));
    document.getElementById('p4Btn').addEventListener('click', () => this._setCount(4));
    document.getElementById('startRaceBtn').addEventListener('click', () => this._startRace());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _setCount(n) {
    this.playerCount = n;
    [2, 3, 4].forEach(i => {
      document.getElementById(`p${i}Btn`).classList.toggle('active', i === n);
    });
    if (this._refreshControls) this._refreshControls();
  }

  // ── Race start ─────────────────────────────
  _startRace() {
    document.getElementById('raceSetup').style.display   = 'none';
    document.getElementById('raceHUD').style.display     = '';
    document.getElementById('raceResults').style.display = 'none';

    this._initPlayers();
    this._buildHUDCards();
    this.results              = [];
    this.raceTimer            = 0;
    this._raceEndCountdown    = null;
    this.state                = 'countdown';
    this._countdown           = 3;
    this._cdTimer             = 1.0;
    this._cdPhase             = 'num';   // 'num' | 'go'
    
    // Resume audio context on start button click (requires user interaction)
    Sfx.resume();
    Sfx.countdownBeep();
  }

  _goSetup() {
    document.getElementById('raceSetup').style.display   = '';
    document.getElementById('raceHUD').style.display     = 'none';
    document.getElementById('raceResults').style.display = 'none';
    this.state = 'setup';
  }

  // ── Player init ────────────────────────────
  _initPlayers() {
    // Staggered grid just behind start/finish line at ~x=720, facing right
    const starts = [
      { x: 685, y: 748, a: 0.015 },
      { x: 685, y: 728, a: 0.015 },
      { x: 635, y: 748, a: 0.015 },
      { x: 635, y: 728, a: 0.015 },
    ];
    this.players = [];
    for (let i = 0; i < this.playerCount; i++) {
      const s = starts[i];
      this.players.push({
        id:             i,
        color:          P_COLORS[i],
        label:          P_LABELS[i],
        x:              s.x,
        y:              s.y,
        angle:          s.a,
        speed:          0,
        lap:            1,
        progress:       0,
        _prevProg:      0,
        quartersDone:   new Set(),
        finished:       false,
        finishTime:     null,
        finishPos:      null,
        racePos:        i + 1,
        trail:          [],
        sparks:         [],
        onGrass:        false,
        angularVel:     0,    // spin from collisions (rad/s)
        colTimer:       0,    // cooldown so one bump doesn't retrigger instantly
      });
    }
  }

  // ── HUD per-player cards ───────────────────
  _buildHUDCards() {
    const bar = document.getElementById('hudPlayers');
    bar.innerHTML = '';
    this.players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'hud-card';
      div.id        = `hud-p${p.id}`;
      div.style.borderColor = p.color + '88';
      div.innerHTML = `
        <div class="hud-card-label" style="color:${p.color}">${p.label}</div>
        <div class="hud-pos">1st</div>
        <div class="hud-lap">Lap 1/${LAPS}</div>`;
      bar.appendChild(div);
    });
  }

  // ── Find closest track point ───────────────
  _closest(x, y) {
    let best = Infinity, idx = 0;
    for (let i = 0; i < this.N; i++) {
      const dx = x - this.tPts[i].x;
      const dy = y - this.tPts[i].y;
      const d  = dx * dx + dy * dy;
      if (d < best) { best = d; idx = i; }
    }
    return { idx, dist: Math.sqrt(best) };
  }

  // ── Player physics update ──────────────────
  _updatePlayer(p, dt) {
    if (p.finished) return;

    const c     = CONTROLS[p.id];
    const up    = !!this.keys[c.up];
    const down  = !!this.keys[c.down];
    const left  = !!this.keys[c.left];
    const right = !!this.keys[c.right];

    // Track distance
    const { idx, dist } = this._closest(p.x, p.y);
    p.onGrass   = dist > (TRACK_WIDTH / 2 - 6);
    p.progress  = idx;
    const maxV  = p.onGrass ? MAX_GRASS : MAX_SPEED;

    // Acceleration / braking
    if (up) {
      p.speed = Math.min(p.speed + ACCEL * dt, maxV);
    } else if (down) {
      p.speed = Math.max(p.speed - ACCEL * dt * 0.65, -maxV * 0.38);
    }

    // Friction
    if (!up && !down) {
      p.speed *= Math.pow(FRICTION, dt * 60);
      if (Math.abs(p.speed) < 2) p.speed = 0;
    }

    // Extra grass drag
    if (p.onGrass && p.speed > MAX_GRASS) {
      p.speed = MAX_GRASS + (p.speed - MAX_GRASS) * Math.pow(0.4, dt * 60);
    }

    // Turning (scaled by speed fraction)
    if (Math.abs(p.speed) > MIN_TURN_V) {
      const tf   = Math.min(Math.abs(p.speed) / (maxV * 0.55), 1.0);
      const turn = TURN_SPD * dt * tf * Math.sign(p.speed);
      if (left)  p.angle -= turn;
      if (right) p.angle += turn;
    }

    // Apply collision spin and decay it
    p.angle      += p.angularVel * dt;
    p.angularVel *= Math.pow(0.82, dt * 60);
    if (Math.abs(p.angularVel) < 0.005) p.angularVel = 0;
    p.colTimer    = Math.max(0, p.colTimer - dt);

    // Move
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;

    // ── Lap / checkpoint logic ──
    const N  = this.N;
    const q1 = Math.floor(N * 0.23);
    const q2 = Math.floor(N * 0.48);
    const q3 = Math.floor(N * 0.73);
    const W  = 18;

    if (idx > q1-W && idx < q1+W) p.quartersDone.add(1);
    if (idx > q2-W && idx < q2+W) p.quartersDone.add(2);
    if (idx > q3-W && idx < q3+W) p.quartersDone.add(3);

    // Detect lap crossing (progress wraps from high → low)
    const prev = p._prevProg;
    p._prevProg = idx;

    if (prev > N * 0.88 && idx < N * 0.12 && p.quartersDone.size >= 3) {
      p.lap++;
      p.quartersDone.clear();

      if (p.lap > LAPS) {
        if (this.results.length === 0) Sfx.raceFinish();
        
        p.finished    = true;
        p.finishTime  = this.raceTimer;
        p.finishPos   = this.results.length + 1;
        this.results.push(p);
        this._emitSparks(p, 40);
        if (this.results.length === 1) {
          // Give remaining players 45 s to finish
          this._raceEndCountdown = 45;
        }
        if (this.results.length >= this.playerCount) {
          this._endRace();
        }
      } else {
        Sfx.lapComplete();
      }
    }

    // Trail
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 45) p.trail.shift();

    // Sparks update
    p.sparks = p.sparks.filter(s => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      return s.life > 0;
    });
  }

  _emitSparks(p, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 220;
      p.sparks.push({ x: p.x, y: p.y, vx: Math.cos(a)*v, vy: Math.sin(a)*v, life: 1.2 + Math.random() });
    }
  }

  // ── Car-to-car collision ───────────────────
  _resolveCollisions() {
    const MIN_D = COL_RADIUS * 2;
    const n     = this.players.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.players[i];
        const b = this.players[j];
        // Skip if both finished or either is in cooldown
        if ((a.finished && b.finished) || a.colTimer > 0 || b.colTimer > 0) continue;

        const dx   = b.x - a.x;
        const dy   = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= MIN_D || dist < 0.5) continue;

        // ── Separate overlapping cars ──
        const nx      = dx / dist;
        const ny      = dy / dist;
        const overlap = (MIN_D - dist) * 0.52;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // ── World-space velocity vectors ──
        const avx = Math.cos(a.angle) * a.speed;
        const avy = Math.sin(a.angle) * a.speed;
        const bvx = Math.cos(b.angle) * b.speed;
        const bvy = Math.sin(b.angle) * b.speed;

        // Relative velocity along the collision normal
        const rvx = avx - bvx;
        const rvy = avy - bvy;
        const dot = rvx * nx + rvy * ny;

        // Only resolve if cars are approaching each other
        if (dot >= 0) continue;

        const restitution = 0.52;    // bounciness (0=no bounce, 1=perfectly elastic)
        const impulse     = -(1 + restitution) * dot / 2;

        // New velocity vectors after impulse
        const nAvx = avx + impulse * nx;
        const nAvy = avy + impulse * ny;
        const nBvx = bvx - impulse * nx;
        const nBvy = bvy - impulse * ny;

        // Energy loss coefficient
        const damp = 0.80;

        // Project new velocity onto each car's heading → update speed
        // Perpendicular component → spin (angularVel)
        const aHx = Math.cos(a.angle), aHy = Math.sin(a.angle);
        const bHx = Math.cos(b.angle), bHy = Math.sin(b.angle);

        a.speed      = (nAvx * aHx + nAvy * aHy) * damp;
        a.angularVel = Math.max(-6, Math.min(6,
          a.angularVel + (-nAvx * aHy + nAvy * aHx) * 0.055
        ));

        b.speed      = (nBvx * bHx + nBvy * bHy) * damp;
        b.angularVel = Math.max(-6, Math.min(6,
          b.angularVel + (-nBvx * bHy + nBvy * bHx) * 0.055
        ));

        // Cooldown to prevent jitter
        a.colTimer = b.colTimer = 0.08;

        // ── Impact sparks at contact point ──
        const cx       = (a.x + b.x) / 2;
        const cy       = (a.y + b.y) / 2;
        const impact   = Math.abs(dot);
        const numSparks = Math.min(Math.floor(impact / 25) + 6, 22);
        for (let k = 0; k < numSparks; k++) {
          const sa = Math.random() * Math.PI * 2;
          const sv = 70 + Math.random() * 210;
          this._colSparks.push({
            x: cx, y: cy,
            vx: Math.cos(sa) * sv,
            vy: Math.sin(sa) * sv,
            life: 0.35 + Math.random() * 0.45,
            color: Math.random() < 0.5 ? a.color : b.color,
          });
        }

        // ── Screen shake (scales with impact force) ──
        this._shake = Math.min((this._shake || 0) + impact * 0.025, 14);
        
        Sfx.bump(impact);
      }
    }
  }

  // ── Rank players by totalProgress ──────────
  _rankPlayers() {
    const N = this.N;
    const sorted = [...this.players].sort((a, b) => {
      const ap = (a.lap * N + a.progress);
      const bp = (b.lap * N + b.progress);
      return bp - ap;
    });
    sorted.forEach((p, i) => { p.racePos = i + 1; });
  }

  // ── Race end ───────────────────────────────
  _endRace() {
    if (this.state === 'finished') return;
    this.state = 'finished';

    // Assign remaining DNF positions
    const dnf = this.players.filter(p => !p.finished)
      .sort((a, b) => (b.lap * this.N + b.progress) - (a.lap * this.N + a.progress));
    dnf.forEach(p => { p.finishPos = this.results.length + 1; this.results.push(p); });

    setTimeout(() => this._showResults(), 2000);
  }

  _showResults() {
    document.getElementById('raceResults').style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    this.results.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'result-entry';
      div.innerHTML = `
        <span class="result-pos">${MEDALS[i]||''} ${ORDINALS[i]}</span>
        <span class="result-swatch" style="background:${p.color}"></span>
        <span class="result-name">${P_NAMES[p.id]}</span>
        <span class="result-time">${p.finishTime ? this._fmtTime(p.finishTime) : 'DNF'}</span>`;
      list.appendChild(div);
    });
  }

  _fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  }

  // ── Update HUD ──────────────────────────────
  _updateHUD() {
    this.players.forEach(p => {
      const el = document.getElementById(`hud-p${p.id}`);
      if (!el) return;
      el.querySelector('.hud-pos').textContent = ORDINALS[p.racePos - 1] || '-';
      el.querySelector('.hud-lap').textContent = `Lap ${Math.min(p.lap, LAPS)}/${LAPS}`;
    });
    const t = document.getElementById('raceTimerDisplay');
    if (t) t.textContent = this._fmtTime(this.raceTimer);
  }

  // ── Main update ────────────────────────────
  _update(dt) {
    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        if (this._cdPhase === 'num') {
          this._countdown--;
          if (this._countdown > 0) {
            Sfx.countdownBeep();
            this._cdTimer = 1.0;
          } else {
            // Show GO
            Sfx.countdownGo();
            this._cdPhase = 'go';
            this._cdTimer = 0.9;
          }
        } else {
          // GO phase ended → start racing
          this.state = 'racing';
        }
      }
    }

    if (this.state === 'racing') {
      this.raceTimer += dt;
      this.players.forEach(p => this._updatePlayer(p, dt));
      if (this.players.length > 1) this._resolveCollisions();
      this._rankPlayers();
      this._updateHUD();

      // Update shared collision sparks
      this._colSparks = this._colSparks.filter(s => {
        s.x    += s.vx * dt;
        s.y    += s.vy * dt;
        s.life -= dt;
        return s.life > 0;
      });

      // Decay screen shake
      this._shake *= Math.pow(0.78, dt * 60);
      if (this._shake < 0.3) this._shake = 0;

      if (this._raceEndCountdown !== null) {
        this._raceEndCountdown -= dt;
        if (this._raceEndCountdown <= 0) this._endRace();
      }

      if (this.players.every(p => p.finished)) this._endRace();
    }
  }

  // ─────────────────────────────────────────────
  // Drawing
  // ─────────────────────────────────────────────
  _draw() {
    const ctx   = this.ctx;
    const shake = this._shake || 0;

    ctx.save();
    if (shake > 0.3) {
      // Apply random screen shake offset
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    ctx.clearRect(-shake, -shake, CW + shake*2, CH + shake*2);

    this._drawGrass(ctx);
    this._drawTrackSurface(ctx);
    this._drawCurbs(ctx);
    this._drawStartLine(ctx);
    this._drawCheckpointLines(ctx);
    this._drawTrails(ctx);

    // Per-player finish sparks
    this.players.forEach(p => {
      p.sparks.forEach(s => this._drawSpark(ctx, s, p.color));
    });

    // Collision impact sparks (drawn under cars so they feel grounded)
    this._colSparks.forEach(s => this._drawSpark(ctx, s, s.color));

    this.players.forEach(p => this._drawCar(ctx, p));

    if (this.state === 'countdown') this._drawCountdown(ctx);
    if (this.state === 'racing' || this.state === 'finished') this._drawOnCanvasTimer(ctx);

    ctx.restore();
  }

  _drawGrass(ctx) {
    const g = ctx.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, '#2d5a22');
    g.addColorStop(1, '#1e4018');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth   = 1;
    for (let x = 0; x < CW; x += 48) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke(); }
    for (let y = 0; y < CH; y += 48) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke(); }
  }

  _drawTrackSurface(ctx) {
    const N = this.N;
    // Shadow
    ctx.save();
    ctx.translate(4, 5);
    ctx.beginPath();
    this.outer.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    const rev = [...this.inner].reverse();
    rev.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();
    ctx.restore();

    // Asphalt fill
    ctx.beginPath();
    this.outer.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    [...this.inner].reverse().forEach(p => ctx.lineTo(p.x, p.y));
    ctx.fillStyle = '#2e2e2e';
    ctx.fill();

    // Centre line dashes (white dashed line along centerline)
    ctx.setLineDash([24, 20]);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    this.tPts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawCurbs(ctx) {
    const N = this.N;
    const CURB = 9;
    for (let i = 0; i < N; i++) {
      const even = (Math.floor(i / 10) % 2 === 0);
      const col  = even ? 'rgba(215,40,40,0.85)' : 'rgba(240,240,240,0.85)';
      ctx.strokeStyle = col;
      ctx.lineWidth   = CURB;

      const oa = this.outer[i], ob = this.outer[(i+1)%N];
      ctx.beginPath(); ctx.moveTo(oa.x, oa.y); ctx.lineTo(ob.x, ob.y); ctx.stroke();

      const ia = this.inner[i], ib = this.inner[(i+1)%N];
      ctx.beginPath(); ctx.moveTo(ia.x, ia.y); ctx.lineTo(ib.x, ib.y); ctx.stroke();
    }
  }

  _drawStartLine(ctx) {
    const p  = this.tPts[0];
    const nxt = this.tPts[1];
    const dx  = nxt.x - p.x, dy = nxt.y - p.y;
    const len = Math.hypot(dx, dy);
    const px  = -dy / len, py = dx / len; // perpendicular
    const fwd = { x: dx/len, y: dy/len };
    const hw  = TRACK_WIDTH / 2;
    const segs = 8;
    const segLen = 16;
    for (let i = 0; i < segs; i++) {
      const t0 = -hw + (i / segs) * hw * 2;
      const t1 = -hw + ((i+1) / segs) * hw * 2;
      ctx.beginPath();
      ctx.moveTo(p.x + px*t0,                  p.y + py*t0);
      ctx.lineTo(p.x + px*t1,                  p.y + py*t1);
      ctx.lineTo(p.x + px*t1 + fwd.x*segLen,   p.y + py*t1 + fwd.y*segLen);
      ctx.lineTo(p.x + px*t0 + fwd.x*segLen,   p.y + py*t0 + fwd.y*segLen);
      ctx.closePath();
      ctx.fillStyle = (i % 2 === 0) ? '#fff' : '#111';
      ctx.fill();
    }
  }

  _drawCheckpointLines(ctx) {
    // Faint yellow dashed lines at quarter points (for debugging / effect)
    const N = this.N;
    [Math.floor(N*0.23), Math.floor(N*0.48), Math.floor(N*0.73)].forEach(idx => {
      const p  = this.tPts[idx];
      const nxt = this.tPts[(idx+1)%N];
      const dx  = nxt.x - p.x, dy = nxt.y - p.y;
      const len = Math.hypot(dx, dy);
      const px  = -dy / len, py = dx / len;
      const hw  = TRACK_WIDTH / 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,220,60,0.28)';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + px*hw, p.y + py*hw);
      ctx.lineTo(p.x - px*hw, p.y - py*hw);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  _drawTrails(ctx) {
    this.players.forEach(p => {
      for (let i = 1; i < p.trail.length; i++) {
        const a = (i / p.trail.length) * 0.28;
        ctx.strokeStyle = `rgba(30,30,30,${a})`;
        ctx.lineWidth   = 4;
        ctx.beginPath();
        ctx.moveTo(p.trail[i-1].x, p.trail[i-1].y);
        ctx.lineTo(p.trail[i].x,   p.trail[i].y);
        ctx.stroke();
      }
    });
  }

  _drawSpark(ctx, s, color) {
    ctx.save();
    ctx.globalAlpha = s.life * 0.88;
    ctx.fillStyle   = color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawCar(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 5, CAR_HL * 0.78, CAR_HW * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = p.color;
    rrect(ctx, -CAR_HL, -CAR_HW, CAR_HL * 2, CAR_HW * 2, 5);
    ctx.fill();

    // Windshield
    const wg = ctx.createLinearGradient(CAR_HL*0.08, -CAR_HW*0.55, CAR_HL*0.08, CAR_HW*0.55);
    wg.addColorStop(0, 'rgba(160,225,255,0.92)');
    wg.addColorStop(1, 'rgba(90,180,255,0.72)');
    ctx.fillStyle = wg;
    ctx.fillRect(CAR_HL * 0.08, -CAR_HW * 0.55, CAR_HL * 0.38, CAR_HW * 1.1);

    // Rear spoiler
    ctx.fillStyle = darken(p.color, -35);
    ctx.fillRect(-CAR_HL, -CAR_HW * 0.88, 7, CAR_HW * 1.76);

    // Wheels
    ctx.fillStyle = '#1a1a1a';
    [[-CAR_HL*0.52, -CAR_HW-2], [-CAR_HL*0.52, CAR_HW-3],
     [ CAR_HL*0.32, -CAR_HW-2], [ CAR_HL*0.32,  CAR_HW-3]].forEach(([wx,wy]) => {
      ctx.fillRect(wx - 3.5, wy, 7, 5);
    });

    // Label on car
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font      = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.label, -CAR_HL * 0.28, 0);

    ctx.restore();

    // Bubble above car showing position
    if (!p.finished) {
      ctx.save();
      ctx.translate(p.x, p.y - 30);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      rrect(ctx, -15, -10, 30, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#ffd060';
      ctx.font      = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ORDINALS[p.racePos - 1], 0, 0);
      ctx.restore();
    } else {
      // Finished banner
      ctx.save();
      ctx.translate(p.x, p.y - 34);
      ctx.fillStyle = '#ffd700';
      ctx.font      = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓ FINISH', 0, 0);
      ctx.restore();
    }
  }

  _drawCountdown(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    if (this._cdPhase === 'go') {
      ctx.font        = 'bold 160px sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 10;
      ctx.fillStyle   = '#ffd700';
      ctx.strokeText('GO!', CW/2, CH/2);
      ctx.fillText  ('GO!', CW/2, CH/2);
    } else {
      const COLORS = {3:'#e84040', 2:'#f5a623', 1:'#2ec97a'};
      const elapsed = 1.0 - this._cdTimer;
      const scale   = 1 + elapsed * 0.55;
      ctx.save();
      ctx.translate(CW/2, CH/2);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(this._cdTimer * 2, 1);
      ctx.font        = 'bold 200px sans-serif';
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = 12;
      ctx.fillStyle   = COLORS[this._countdown] || '#fff';
      ctx.strokeText(String(this._countdown), 0, 0);
      ctx.fillText  (String(this._countdown), 0, 0);
      ctx.restore();

      // "Get Ready!" text
      ctx.fillStyle   = 'rgba(255,255,255,0.75)';
      ctx.font        = 'bold 28px sans-serif';
      ctx.fillText('Get Ready!', CW/2, CH/2 + 130);
    }
    ctx.restore();
  }

  _drawOnCanvasTimer(ctx) {
    const txt = this._fmtTime(this.raceTimer);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rrect(ctx, CW/2 - 68, 10, 136, 36, 8);
    ctx.fill();
    ctx.fillStyle    = '#c8e4ff';
    ctx.font         = 'bold 20px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, CW/2, 28);
    ctx.restore();
  }

  // ── Main loop ──────────────────────────────
  _loop(ts) {
    const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts => this._loop(ts));
  }
}

// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { new PixelRacer(); });
