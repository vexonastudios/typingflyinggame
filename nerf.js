'use strict';

// ═══════════════════════════════════════════════════════════
//  NERF ARENA — Split-Screen Raycasting FPS  v3.0
//  Pro rewrite: texture mapping, minimap, proper collision,
//  invincibility frames, acceleration, muzzle flash, polish
// ═══════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────
const FOV          = Math.PI / 2.5;   // field of view (~72°)
const HALF_FOV     = FOV / 2;
const MOVE_SPD     = 3.5;             // tiles/sec
const MOVE_ACCEL   = 14.0;            // acceleration smoothing
const TURN_SPD     = 1.55;            // rad/sec — tuned for accurate aiming
const TURN_ACCEL   = 7.0;             // lower = more momentum, easier to stop on target
const DART_SPD     = 12.0;            // tiles/sec
const MAX_AMMO     = 8;               // darts per clip
const RELOAD_TIME  = 1.5;             // seconds
const HIT_DIST     = 0.5;             // hit radius in tiles
const WALL_MARGIN  = 0.28;            // collision margin
const INVINCIBLE_T = 1.2;             // invincibility seconds after hit

// ─── Palette: each arena has 8 wall variant colours ─────────
const WALL_PALETTES = [
  [ null, '#c44a0a', '#1565c0', '#2e7d32', '#7b1fa2', '#b71c1c', '#e65100', '#00838f' ],
  [ null, '#0d47a1', '#01579b', '#004d40', '#311b92', '#6a1b4d', '#1b5e20', '#bf360c' ],
  [ null, '#4e342e', '#5d4037', '#3e2723', '#6d4c41', '#8d6e63', '#795548', '#bc5000' ],
];

// ─── Arena Maps ─────────────────────────────────────────────
//  0=empty, 1-7=wall texture type (maps to palette + texture style)
const MAPS = [
  // 0: Classic Arena
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,2,0,0,0,0,3,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,3,0,0,0,0,2,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 1: Maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,0,0,1,0,0,1,0,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,1,0,2,2,2,2,0,1,0,0,0,1,0,1],
    [1,0,1,1,0,0,1,0,2,0,0,2,0,1,0,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,0,1,0,2,0,0,2,0,1,0,0,1,1,0,1],
    [1,0,1,0,0,0,1,0,2,2,2,2,0,1,0,0,0,1,0,1],
    [1,0,1,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,0,1,0,0,1,0,0,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,1,1,0,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 2: Fortress
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,3,3,3,3,3,3,0,0,3,3,3,3,3,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,3,3,3,3,3,0,0,3,3,3,3,3,3,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

const STARTS = [
  [ {x:2.5,y:2.5,a:Math.PI*0.25},  {x:17.5,y:17.5,a:Math.PI*1.25} ],
  [ {x:1.5,y:1.5,a:0.1},           {x:18.5,y:18.5,a:Math.PI+0.1}  ],
  [ {x:2.5,y:2.5,a:Math.PI*0.25},  {x:17.5,y:17.5,a:Math.PI*1.25} ],
];

const P_COLORS  = ['#ff6b35', '#38bdf8'];
const P_NAMES   = ['Player 1', 'Player 2'];

// ─── Audio Engine ────────────────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },

  _osc(freq, type, dur, vol = 0.08, freqEnd = null, attack = 0.005) {
    try {
      this._r();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, _ac.currentTime);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, _ac.currentTime + dur);
      g.gain.setValueAtTime(0.001, _ac.currentTime);
      g.gain.linearRampToValueAtTime(vol, _ac.currentTime + attack);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      o.connect(g); g.connect(_ac.destination);
      o.start(); o.stop(_ac.currentTime + dur);
    } catch (e) {}
  },

  _noise(dur, vol = 0.05, hiPass = 0) {
    try {
      this._r();
      const len = Math.ceil(_ac.sampleRate * dur);
      const buf = _ac.createBuffer(1, len, _ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
      const src = _ac.createBufferSource();
      src.buffer = buf;
      const g = _ac.createGain();
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      if (hiPass > 0) {
        const f = _ac.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = hiPass;
        src.connect(f); f.connect(g);
      } else {
        src.connect(g);
      }
      g.connect(_ac.destination);
      src.start();
    } catch (e) {}
  },

  // Nerf blaster pop — compressed air burst
  shoot() {
    this._osc(180, 'sawtooth', 0.06, 0.1, 60);
    this._noise(0.05, 0.07, 800);
    this._osc(90, 'square', 0.08, 0.05, 40);
  },

  // Hollow clunk of empty gun
  empty() {
    this._osc(140, 'square', 0.08, 0.05, 100);
    this._noise(0.04, 0.03, 200);
  },

  // Satisfying click-clack reload
  reload() {
    this._noise(0.04, 0.04, 400);
    setTimeout(() => { this._osc(260, 'triangle', 0.1, 0.06, 380); }, 120);
    setTimeout(() => { this._noise(0.03, 0.05, 600); this._osc(320, 'triangle', 0.1, 0.07, 440); }, 350);
  },

  // Hit — meaty thwack
  hit() {
    this._osc(800, 'sine', 0.05, 0.1, 200);
    this._noise(0.12, 0.09, 100);
    this._osc(120, 'sawtooth', 0.15, 0.06, 60);
  },

  // Dart hitting a wall — soft splat
  splat() {
    this._noise(0.08, 0.06, 300);
    this._osc(160, 'sine', 0.1, 0.04, 80);
  },

  // Countdown beep
  countdown() { this._osc(520, 'sine', 0.15, 0.06); },

  // GO fanfare
  go() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._osc(f, 'sine', 0.22, 0.08), i * 80)); },

  // Victory fanfare
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._osc(f, 'sine', 0.3, 0.09), i * 90)); },

  // UI click
  click() { this._osc(700, 'sine', 0.04, 0.04); },

  // Footstep — muffled thud
  step() { this._noise(0.035, 0.012, 80); this._osc(60, 'sine', 0.04, 0.015); },
};

// ─── Utilities ───────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════
//  PLAYER STATE
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(id, ctrl, startPos) {
    this.id         = id;
    this.ctrl       = ctrl;
    this.color      = P_COLORS[id];
    this.name       = P_NAMES[id];
    this.x          = startPos.x;
    this.y          = startPos.y;
    this.angle      = startPos.a;
    this.velFwd     = 0;   // smoothed forward velocity
    this.velTurn    = 0;   // smoothed turn rate

    // Combat
    this.ammo       = MAX_AMMO;
    this.reloading  = false;
    this.reloadTimer= 0;
    this.hits       = 0;
    this.invincible = 0;   // seconds of invincibility after being hit
    this.darts      = [];  // {x,y,vx,vy,life}
    this._shootCd   = 0;

    // Visual / HUD
    this.hitFlash   = 0;
    this.muzzleFlash= 0;
    this.bobTimer   = 0;
    this.gunRecoil  = 0;
    this.gunSwayX   = 0;
    this.gunSwayY   = 0;
    this._stepTimer = 0;

    // Score animation
    this.hitPop     = 0;   // briefly enlarge score on hit
  }
}

// ═══════════════════════════════════════════════════════════
//  DDA RAYCASTER
// ═══════════════════════════════════════════════════════════
function castRay(map, px, py, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const mapX0 = Math.floor(px), mapY0 = Math.floor(py);
  const stepX = cosA > 0 ? 1 : -1;
  const stepY = sinA > 0 ? 1 : -1;
  const dX = Math.abs(1 / (cosA || 1e-9));
  const dY = Math.abs(1 / (sinA || 1e-9));
  let sdX = cosA > 0 ? (mapX0 + 1 - px) * dX : (px - mapX0) * dX;
  let sdY = sinA > 0 ? (mapY0 + 1 - py) * dY : (py - mapY0) * dY;
  let mx = mapX0, my = mapY0, side = 0;

  for (let i = 0; i < 80; i++) {
    if (sdX < sdY) { sdX += dX; mx += stepX; side = 0; }
    else           { sdY += dY; my += stepY; side = 1; }
    if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) break;
    if (map[my][mx] > 0) {
      const dist = side === 0
        ? (mx - px + (1 - stepX) / 2) / cosA
        : (my - py + (1 - stepY) / 2) / sinA;
      const absDist = Math.abs(dist);
      let wallX = side === 0 ? py + absDist * sinA : px + absDist * cosA;
      wallX -= Math.floor(wallX);
      return { dist: absDist, wallType: map[my][mx], side, wallX };
    }
  }
  return { dist: 30, wallType: 0, side: 0, wallX: 0 };
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════
class NerfArena {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.keys   = {};
    this.state  = 'setup';
    this.lastTs = 0;
    this.time   = 0;
    this.textures = [];

    this.players    = [];
    this.map        = null;
    this.palette    = null;
    this.targetHits = 5;
    this.arenaIdx   = 0;

    this._cdCount     = 3;
    this._cdTimer     = 0;
    this._globalShake = 0;
    this._shakeAngle  = 0;

    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    const BLOCKED = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',
                     'KeyW','KeyS','KeyA','KeyD','KeyR','Enter','Slash'];
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (BLOCKED.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    // Invalidate pre-drawn gradients on resize
    this._floorCeilCache = null;
  }

  // ─── UI Binding ────────────────────────────────────────────
  _bindUI() {
    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        const grp = el.closest('.option-group');
        grp.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        Sfx.click();
      });
    });
    document.getElementById('startBtn').addEventListener('click', () => this._startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _startGame() {
    Sfx._r();
    this.targetHits = parseInt(document.querySelector('input[name="target"]:checked')?.value || '5');
    this.arenaIdx   = parseInt(document.querySelector('input[name="arena"]:checked')?.value  || '0');
    this.map        = MAPS[this.arenaIdx];
    this.palette    = WALL_PALETTES[this.arenaIdx];
    this._generateTextures();
    this._floorCeilCache = null;

    document.getElementById('gameSetup').style.display   = 'none';
    document.getElementById('gameResults').style.display = 'none';

    const starts = STARTS[this.arenaIdx];
    const C1 = { fwd:'KeyW', back:'KeyS', turnL:'KeyA', turnR:'KeyD', shoot:'Space', reload:'KeyR' };
    const C2 = { fwd:'ArrowUp', back:'ArrowDown', turnL:'ArrowLeft', turnR:'ArrowRight', shoot:'Enter', reload:'Slash' };

    this.players = [
      new Player(0, C1, starts[0]),
      new Player(1, C2, starts[1]),
    ];

    this._cdCount = 3;
    this._cdTimer = 0.9;
    this.state = 'countdown';
    Sfx.countdown();
    this._showBanner('NERF ARENA!');
  }

  _goSetup() {
    document.getElementById('gameSetup').style.display   = '';
    document.getElementById('gameResults').style.display = 'none';
    this.state = 'setup';
  }

  _showBanner(text) {
    const el = document.getElementById('levelBanner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ─── Procedural Textures ────────────────────────────────────
  _generateTextures() {
    this.textures = [];
    const S = 128;
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const base = this.palette[i] || '#444';

      // Parse base color for tinting
      const r0 = parseInt(base.slice(1,3),16);
      const g0 = parseInt(base.slice(3,5),16);
      const b0 = parseInt(base.slice(5,7),16);

      if (i === 0) {
        // Transparent / empty
        this.textures.push(c);
        continue;
      }

      // Fill base
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);

      // ── Sci-Fi Panel Wall (types 1, 6, 7)
      if (i === 1 || i === 6 || i === 7) {
        // Gradient overlay (lighter top, darker bottom)
        const grad = g.createLinearGradient(0,0,0,S);
        grad.addColorStop(0, `rgba(255,255,255,0.12)`);
        grad.addColorStop(1, `rgba(0,0,0,0.2)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, S, S);

        // Panel frame (dark inset)
        g.fillStyle = `rgba(0,0,0,0.5)`;
        g.fillRect(0, 0, S, 7); g.fillRect(0, S-7, S, 7);
        g.fillRect(0, 0, 7, S); g.fillRect(S-7, 0, 7, S);
        // Inner highlight
        g.fillStyle = `rgba(255,255,255,0.08)`;
        g.fillRect(7, 7, S-14, 4);

        // Center divider
        g.fillStyle = `rgba(0,0,0,0.35)`;
        g.fillRect(0, S/2-2, S, 4);
        // Light trim on divider
        g.fillStyle = `rgba(255,255,255,0.06)`;
        g.fillRect(0, S/2-2, S, 1);

        // Rivets (rounded squares)
        g.fillStyle = `rgba(0,0,0,0.6)`;
        const rv = [[10,10],[S-14,10],[10,S-14],[S-14,S-14]];
        rv.forEach(([rx,ry]) => {
          g.beginPath(); g.roundRect(rx, ry, 4, 4, 1); g.fill();
        });
        // Rivet shine
        g.fillStyle = `rgba(255,255,255,0.25)`;
        rv.forEach(([rx,ry]) => { g.fillRect(rx, ry, 2, 1); });
      }

      // ── Grate / Vent (type 2)
      else if (i === 2) {
        // Dark background
        g.fillStyle = `rgba(0,0,0,0.55)`;
        g.fillRect(0, 0, S, S);
        // Horizontal slats
        for (let y = 0; y < S; y += 14) {
          g.fillStyle = base;
          g.fillRect(0, y, S, 7);
          // Slat highlight
          g.fillStyle = `rgba(255,255,255,0.1)`;
          g.fillRect(0, y, S, 1);
          g.fillStyle = `rgba(0,0,0,0.3)`;
          g.fillRect(0, y+6, S, 1);
        }
        // Vertical supports
        g.fillStyle = this._mixColor(r0,g0,b0, 0.65);
        g.fillRect(28, 0, 14, S); g.fillRect(86, 0, 14, S);
        g.fillStyle = `rgba(0,0,0,0.4)`;
        g.fillRect(28, 0, 1, S); g.fillRect(41, 0, 1, S);
        g.fillRect(86, 0, 1, S); g.fillRect(99, 0, 1, S);
      }

      // ── Hazard Stripes (type 3)
      else if (i === 3) {
        g.fillStyle = '#e0a800';
        g.fillRect(0, 0, S, S);
        g.fillStyle = '#111';
        for (let j = -S; j < S*2; j += 30) {
          g.beginPath();
          g.moveTo(j, 0); g.lineTo(j+30, 0);
          g.lineTo(j-S+30, S); g.lineTo(j-S, S);
          g.closePath(); g.fill();
        }
        // Heavy border
        g.fillStyle = `rgba(0,0,0,0.55)`;
        g.fillRect(0,0,S,8); g.fillRect(0,S-8,S,8);
        g.fillRect(0,0,8,S); g.fillRect(S-8,0,8,S);
        g.fillStyle = `rgba(255,255,255,0.06)`;
        g.fillRect(8, 8, S-16, 2);
      }

      // ── Blast Door (type 4)
      else if (i === 4) {
        // Recessed panel
        g.fillStyle = this._mixColor(r0,g0,b0, 0.75);
        g.fillRect(12, 12, S-24, S-24);
        g.fillStyle = `rgba(255,255,255,0.07)`;
        g.fillRect(12, 12, S-24, 2);

        // Glowing neon indicator light in centre
        const lx = S/2-6, ly = S/2-20, lw = 12, lh = 40;
        g.shadowColor = '#00e5ff'; g.shadowBlur = 20;
        g.fillStyle = '#00e5ff';
        g.fillRect(lx, ly, lw, lh);
        g.shadowBlur = 0;
        // Lock symbol
        g.fillStyle = `rgba(0,0,0,0.7)`;
        g.fillRect(lx+2, ly+lh*0.5, lw-4, lh*0.45);

        // Bolts along sides
        [0.2, 0.5, 0.8].forEach(t => {
          g.fillStyle = `rgba(0,0,0,0.5)`;
          g.beginPath(); g.roundRect(4, t*S-3, 8, 6, 1); g.fill();
          g.beginPath(); g.roundRect(S-12, t*S-3, 8, 6, 1); g.fill();
        });
      }

      // ── Server / Tech Core (type 5)
      else if (i === 5) {
        g.fillStyle = '#111';
        g.fillRect(0, 0, S, S);
        for (let cx = 6; cx < S-6; cx += 22) {
          g.fillStyle = '#2a2a2a';
          g.fillRect(cx, 4, 16, S-8);
          g.fillStyle = '#1a1a1a';
          g.fillRect(cx, 4, 1, S-8);
          g.fillRect(cx+15, 4, 1, S-8);
          // Blinking server lights
          for (let cy = 10; cy < S-10; cy += 10) {
            const lit = Math.random() > 0.28;
            if (lit) {
              const colors = ['#ff2020','#20ff40','#2090ff','#ffaa00'];
              g.fillStyle = colors[Math.floor(Math.random()*colors.length)];
              g.fillRect(cx+4, cy, 8, 4);
            }
          }
        }
      }

      // ── Add surface grit / noise to all non-empty textures ──
      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (let n = 0; n < 400; n++) g.fillRect(Math.random()*S, Math.random()*S, 2, 2);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let n = 0; n < 250; n++) g.fillRect(Math.random()*S, Math.random()*S, 2, 2);

      this.textures.push(c);
    }
  }

  // ─── Game Loop ───────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this.time  += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Update ─────────────────────────────────────────────────
  _update(dt) {
    if (this.state === 'setup' || this.state === 'results') return;

    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        this._cdCount--;
        if (this._cdCount > 0) { this._cdTimer = 0.9; Sfx.countdown(); }
        else { this.state = 'playing'; Sfx.go(); }
      }
      return;
    }

    // Decay screen shake
    this._globalShake = Math.max(0, this._globalShake - dt * 18);
    this._shakeAngle += dt * 37;

    this.players.forEach((p, i) => this._updatePlayer(p, this.players[1-i], dt));

    // Win check
    if (this.state === 'playing') {
      const winner = this.players.find(p => p.hits >= this.targetHits);
      if (winner) {
        this.state = 'done';
        Sfx.win();
        setTimeout(() => this._showResults(winner), 1800);
      }
    }
  }

  _updatePlayer(p, opp, dt) {
    const k = this.keys;

    // Timers
    p.hitFlash    = Math.max(0, p.hitFlash    - dt);
    p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    p.gunRecoil   = Math.max(0, p.gunRecoil   - dt * 6);
    p._shootCd    = Math.max(0, p._shootCd    - dt);
    p.invincible  = Math.max(0, p.invincible  - dt);
    p.hitPop      = Math.max(0, p.hitPop      - dt * 3);

    // ── Reload ──
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) { p.ammo = MAX_AMMO; p.reloading = false; }
    }
    if (!p.reloading && k[p.ctrl.reload] && p.ammo < MAX_AMMO) {
      p.reloading = true; p.reloadTimer = RELOAD_TIME; Sfx.reload();
    }

    // ── Shoot ──
    if (k[p.ctrl.shoot] && !p.reloading && p._shootCd <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        p._shootCd    = 0.18;
        p.muzzleFlash = 0.10;
        p.gunRecoil   = 0.4;
        Sfx.shoot();
        // Small random spread
        const spread = (Math.random() - 0.5) * 0.03;
        p.darts.push({
          x: p.x, y: p.y,
          vx: Math.cos(p.angle + spread) * DART_SPD,
          vy: Math.sin(p.angle + spread) * DART_SPD,
          life: 3.0,
        });
      } else {
        p._shootCd = 0.4;
        Sfx.empty();
        if (!p.reloading) { p.reloading = true; p.reloadTimer = RELOAD_TIME; Sfx.reload(); }
      }
    }

    // ── Movement (acceleration model) ──
    if (this.state !== 'playing') return;

    const targetFwd  = k[p.ctrl.fwd]   ? MOVE_SPD : k[p.ctrl.back] ? -MOVE_SPD * 0.6 : 0;
    const targetTurn = k[p.ctrl.turnL] ? -TURN_SPD : k[p.ctrl.turnR] ? TURN_SPD : 0;

    p.velFwd  += (targetFwd  - p.velFwd)  * Math.min(1, MOVE_ACCEL  * dt);
    p.velTurn += (targetTurn - p.velTurn) * Math.min(1, TURN_ACCEL  * dt);

    p.angle += p.velTurn * dt;

    // AABB collision with margin
    const cosA = Math.cos(p.angle), sinA = Math.sin(p.angle);
    const nx = p.x + cosA * p.velFwd * dt;
    const ny = p.y + sinA * p.velFwd * dt;
    const m  = WALL_MARGIN;

    // Axis-separated collision (allows sliding along walls)
    if (!this._wallAt(nx + m*Math.sign(cosA), p.y) &&
        !this._wallAt(nx - m*Math.sign(cosA), p.y)) p.x = nx;
    if (!this._wallAt(p.x, ny + m*Math.sign(sinA)) &&
        !this._wallAt(p.x, ny - m*Math.sign(sinA))) p.y = ny;

    // Gun bob / step sounds
    const moving = Math.abs(p.velFwd) > 0.15;
    if (moving) {
      p.bobTimer  += dt * 7;
      p.gunSwayX   = Math.sin(p.bobTimer) * 5;
      p.gunSwayY   = Math.abs(Math.sin(p.bobTimer)) * 4;
      p._stepTimer -= dt;
      if (p._stepTimer <= 0) { Sfx.step(); p._stepTimer = 0.32; }
    } else {
      p.bobTimer  += dt * 1.2;
      p.gunSwayX   = Math.sin(p.bobTimer) * 0.9;
      p.gunSwayY   = 0;
      p._stepTimer = 0;
    }

    // ── Dart physics ──
    p.darts = p.darts.filter(dart => {
      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
      dart.life -= dt;

      if (this._wallAt(Math.floor(dart.x), Math.floor(dart.y))) {
        Sfx.splat(); return false;
      }
      // Hit opponent (only if opponent is not invincible)
      if (opp.invincible <= 0) {
        const ddx = dart.x - opp.x, ddy = dart.y - opp.y;
        if (ddx*ddx + ddy*ddy < HIT_DIST*HIT_DIST) {
          p.hits++;
          opp.hitFlash   = 0.55;
          opp.invincible = INVINCIBLE_T;
          p.hitPop       = 1.0;
          this._globalShake = 7;
          Sfx.hit();
          const msg = p.hits >= this.targetHits
            ? `🏆 ${p.name} WINS!`
            : `🎯 ${p.name} hits! ${p.hits}/${this.targetHits}`;
          this._showBanner(msg);
          return false;
        }
      }
      return dart.life > 0;
    });
  }

  _wallAt(mx, my) {
    if (my < 0 || my >= this.map.length || mx < 0 || mx >= this.map[0].length) return true;
    return this.map[Math.floor(my)][Math.floor(mx)] > 0;
  }

  _showResults(winner) {
    this.state = 'results';
    document.getElementById('gameResults').style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    document.getElementById('resultsIcon').textContent  = '🏆';
    document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;
    [...this.players].sort((a,b) => b.hits - a.hits).forEach((p, i) => {
      const e = document.createElement('div');
      e.className = 'result-entry';
      e.innerHTML = `
        <span class="result-pos">${i===0?'🥇 1st':'🥈 2nd'}</span>
        <span class="result-swatch" style="background:${p.color}"></span>
        <span class="result-name">${p.name}</span>
        <span class="result-stat">${p.hits} hits</span>`;
      list.appendChild(e);
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();

    // Screen shake (directional, not random every frame for smoother feel)
    if (this._globalShake > 0.05) {
      const sx = Math.cos(this._shakeAngle) * this._globalShake;
      const sy = Math.sin(this._shakeAngle * 1.3) * this._globalShake * 0.6;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(-20, -20, this.W+40, this.H+40);

    if (this.state === 'setup' || this.state === 'results') {
      ctx.fillStyle = '#060c1a';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
      return;
    }

    const vpW = Math.floor(this.W / 2);
    const vpH = this.H;

    // P1 — left half
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[0], this.players[1], 0, 0, vpW, vpH);
    this._drawMinimap(ctx, this.players[0], 0, vpW, vpH);
    ctx.restore();

    // P2 — right half
    ctx.save();
    ctx.beginPath(); ctx.rect(vpW, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[1], this.players[0], vpW, 0, vpW, vpH);
    this._drawMinimap(ctx, this.players[1], vpW, vpW, vpH);
    ctx.restore();

    // Divider — a glowing seam
    ctx.fillStyle = '#000';
    ctx.fillRect(vpW-2, 0, 4, vpH);
    const divGrad = ctx.createLinearGradient(vpW-2, 0, vpW+2, 0);
    divGrad.addColorStop(0, 'rgba(255,255,255,0)');
    divGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    divGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = divGrad;
    ctx.fillRect(vpW-2, 0, 4, vpH);

    if (this.state === 'countdown') this._drawCountdown(ctx);

    ctx.restore();
  }

  _drawView(ctx, p, opp, ox, oy, vpW, vpH) {
    const halfH = vpH / 2;

    // ── Ceiling ──
    const ceilG = ctx.createLinearGradient(0, oy, 0, oy + halfH);
    ceilG.addColorStop(0, '#060609');
    ceilG.addColorStop(1, '#141420');
    ctx.fillStyle = ceilG;
    ctx.fillRect(ox, oy, vpW, halfH);

    // ── Floor ──
    const floorG = ctx.createLinearGradient(0, oy + halfH, 0, oy + vpH);
    floorG.addColorStop(0, '#030303');
    floorG.addColorStop(0.45, '#0d0d12');
    floorG.addColorStop(1, '#191926');
    ctx.fillStyle = floorG;
    ctx.fillRect(ox, oy + halfH, vpW, halfH);

    // ── Neon floor grid (horizontal + vanishing verticals) ──
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 18; i++) {
      const t = Math.pow(i / 18, 1.8);
      const y = oy + halfH + t * halfH;
      if (y > oy + vpH) break;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + vpW, y); ctx.stroke();
    }
    // Vertical grid lines (perspective-converging)
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.07)';
    for (let j = -6; j <= 6; j++) {
      const px2 = ox + vpW/2 + j * vpW * 0.16;
      ctx.beginPath();
      ctx.moveTo(ox + vpW/2, oy + halfH);
      ctx.lineTo(px2, oy + vpH);
      ctx.stroke();
    }
    ctx.restore();

    // ── Textured Walls ──
    const zBuf = new Float32Array(vpW);

    for (let col = 0; col < vpW; col++) {
      const rayAngle = p.angle - HALF_FOV + (col / vpW) * FOV;
      const { dist, wallType, side, wallX } = castRay(this.map, p.x, p.y, rayAngle);

      // Fisheye correction
      const cDist = Math.max(0.04, dist * Math.cos(rayAngle - p.angle));
      zBuf[col] = cDist;

      if (wallType === 0) continue;

      const wallH = Math.min(vpH * 4, vpH / cDist);
      const wallY = (vpH - wallH) / 2;

      const tex = this.textures[wallType] || this.textures[1];
      const TW = tex.width, TH = tex.height;
      let texX = Math.floor(wallX * TW);
      // Flip correction to prevent seams at wall faces
      if (side === 0 && Math.cos(rayAngle) > 0) texX = TW - texX - 1;
      if (side === 1 && Math.sin(rayAngle) < 0) texX = TW - texX - 1;
      texX = clamp(texX, 0, TW-1);

      // Draw 1px wide texture slice
      ctx.drawImage(tex, texX, 0, 1, TH, ox+col, oy+wallY, 1, wallH);

      // ── Distance Fog ──
      // Correct formula: fog = 0 at distance 0, 1 at max draw distance
      let fog = clamp(cDist / 14, 0, 1) * 0.92;
      // Side walls (N/S faces) get extra darkening for directional lighting
      if (side === 1) fog = clamp(fog + 0.22, 0, 1);

      if (fog > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${fog.toFixed(2)})`;
        ctx.fillRect(ox+col, oy+wallY, 1, wallH);
      }

      // ── Ambient Occlusion at base of walls ──
      const aoY = oy + wallY + wallH;
      if (aoY > oy + halfH && aoY < oy + vpH) {
        const aoH = Math.min(wallH * 0.18, 55);
        ctx.fillStyle = `rgba(0,0,0,0.5)`;
        ctx.fillRect(ox+col, aoY - aoH, 1, aoH);
      }
    }

    // ── Opponent sprite ──
    this._drawSprite(ctx, p, opp, ox, oy, vpW, vpH, zBuf);

    // ── Dart projectiles ──
    this.players.forEach(shooter => {
      shooter.darts.forEach(dart => {
        this._drawDart(ctx, p, dart, shooter.color, ox, oy, vpW, vpH, zBuf);
      });
    });

    // ── Muzzle flash ──
    if (p.muzzleFlash > 0) {
      const mf = p.muzzleFlash / 0.10;
      ctx.fillStyle = `rgba(255,220,80,${mf * 0.18})`;
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── Hit damage overlay ──
    if (p.hitFlash > 0) {
      // Pulsing red vignette
      const hf = p.hitFlash / 0.55;
      const vigG = ctx.createRadialGradient(
        ox+vpW/2, oy+vpH/2, vpH*0.1,
        ox+vpW/2, oy+vpH/2, vpH*0.85
      );
      vigG.addColorStop(0, `rgba(200,0,0,0)`);
      vigG.addColorStop(1, `rgba(220,0,0,${hf * 0.55})`);
      ctx.fillStyle = vigG;
      ctx.fillRect(ox, oy, vpW, vpH);

      // Center "you got hit" flash
      ctx.fillStyle = `rgba(255,30,30,${hf * 0.15})`;
      ctx.fillRect(ox, oy, vpW, vpH);

      // Hit direction markers (4 corners flash)
      ctx.strokeStyle = `rgba(255,60,60,${hf * 0.8})`;
      ctx.lineWidth   = 2.5;
      const cx2 = ox+vpW/2, cy2 = oy+vpH/2, mk = 18, mg = 5;
      ctx.beginPath(); ctx.moveTo(cx2-mk-mg, cy2); ctx.lineTo(cx2-mg, cy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2+mg, cy2);     ctx.lineTo(cx2+mk+mg, cy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2, cy2-mk-mg);  ctx.lineTo(cx2, cy2-mg); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2, cy2+mg);     ctx.lineTo(cx2, cy2+mk+mg); ctx.stroke();
    }

    // ── Invincibility flicker ──
    if (p.invincible > 0 && Math.floor(this.time * 12) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── Crosshair ──
    this._drawCrosshair(ctx, p, ox, oy, vpW, vpH);

    // ── Gun sprite ──
    this._drawGun(ctx, p, ox, oy, vpW, vpH);

    // ── HUD ──
    this._drawHUD(ctx, p, ox, oy, vpW, vpH);
  }

  // ─── Opponent Sprite ────────────────────────────────────────
  _drawSprite(ctx, viewer, sprite, ox, oy, vpW, vpH, zBuf) {
    const dx = sprite.x - viewer.x, dy = sprite.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.25) return;

    const spriteAngle = Math.atan2(dy, dx) - viewer.angle;
    const normAngle   = Math.atan2(Math.sin(spriteAngle), Math.cos(spriteAngle));
    if (Math.abs(normAngle) > HALF_FOV + 0.25) return;

    const screenX  = (normAngle / FOV + 0.5) * vpW;
    const spriteH  = Math.min(vpH * 1.9, vpH / dist);
    const spriteW  = spriteH * 0.62;
    const spriteTop = (vpH - spriteH) / 2;
    const brt      = Math.max(0.35, 1 - dist / 11);

    const startCol = Math.floor(screenX - spriteW/2);
    const endCol   = Math.floor(screenX + spriteW/2);

    // Invincibility flicker on the sprite too
    const flickOff = sprite.invincible > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (flickOff) return;

    for (let col = Math.max(0, startCol); col < Math.min(vpW, endCol); col++) {
      if (zBuf[col] < dist) continue;

      const u = (col - startCol) / Math.max(1, endCol - startCol);

      // ── Head / Helmet ──
      if (u > 0.28 && u < 0.72) {
        const hTop = spriteTop, hH = spriteH * 0.22;
        if (u < 0.33 || u > 0.67) {
          // Dark outline
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
        } else {
          ctx.fillStyle = `rgba(235,240,255,${brt})`;
        }
        ctx.fillRect(ox+col, oy+hTop, 1, hH);

        // Glowing visor strip
        if (u > 0.37 && u < 0.63) {
          const vTop = hTop + hH*0.28, vH = hH*0.38;
          ctx.fillStyle = sprite.color;
          ctx.fillRect(ox+col, oy+vTop, 1, vH);
          if (u > 0.44 && u < 0.56) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ox+col, oy+vTop+2, 1, vH-4);
          }
        }
        // Helmet chin detail
        if (u > 0.35 && u < 0.65) {
          const cTop = hTop + hH * 0.75, cH = hH * 0.25;
          ctx.fillStyle = `rgba(180,185,200,${brt})`;
          ctx.fillRect(ox+col, oy+cTop, 1, cH);
        }
      }

      // ── Arms / Shoulder pads ──
      if ((u > 0.12 && u <= 0.28) || (u >= 0.72 && u < 0.88)) {
        const aTop = spriteTop + spriteH*0.21, aH = spriteH*0.46;
        if (u < 0.17 || u > 0.83) {
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
        } else {
          const isPad = (u < 0.28 && u > 0.17) || (u > 0.72 && u < 0.83);
          ctx.fillStyle = isPad ? sprite.color : `rgba(55,60,65,${brt})`;
        }
        ctx.fillRect(ox+col, oy+aTop, 1, aH);
        // Hand
        const handTop = aTop + aH*0.8;
        ctx.fillStyle = `rgba(225,175,115,${brt})`;
        ctx.fillRect(ox+col, oy+handTop, 1, aH*0.2);
        // Blaster in right hand
        if (u > 0.14 && u <= 0.28) {
          const gTop = handTop - spriteH*0.04, gH = spriteH*0.2;
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
          ctx.fillRect(ox+col, oy+gTop-1, 1, gH+2);
          ctx.fillStyle = '#ff6600';
          ctx.fillRect(ox+col, oy+gTop, 1, gH);
        }
      }

      // ── Torso ──
      if (u > 0.28 && u < 0.72) {
        const tTop = spriteTop + spriteH*0.22, tH = spriteH*0.45;
        if (u < 0.33 || u > 0.67) {
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
        } else {
          ctx.fillStyle = `rgba(235,240,255,${brt})`;
        }
        ctx.fillRect(ox+col, oy+tTop, 1, tH);
        // Chest reactor
        if (u > 0.44 && u < 0.56) {
          const rTop = tTop+tH*0.18, rH = tH*0.32;
          ctx.fillStyle = sprite.color;
          ctx.fillRect(ox+col, oy+rTop, 1, rH);
        }
        // Belt
        const bTop = tTop+tH-spriteH*0.07, bH = spriteH*0.07;
        ctx.fillStyle = `rgba(25,25,30,${brt})`;
        ctx.fillRect(ox+col, oy+bTop, 1, bH);
      }

      // ── Legs ──
      if (u > 0.3 && u < 0.7 && !(u > 0.46 && u < 0.54)) {
        const lTop = spriteTop+spriteH*0.67, lH = spriteH*0.33;
        if (u < 0.34 || u > 0.66 || (u > 0.43 && u < 0.46) || (u > 0.54 && u < 0.57)) {
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
        } else {
          ctx.fillStyle = `rgba(75,80,88,${brt})`;
        }
        ctx.fillRect(ox+col, oy+lTop, 1, lH);
        // Knee pads
        const kTop = lTop+lH*0.28, kH = lH*0.26;
        ctx.fillStyle = sprite.color;
        ctx.fillRect(ox+col, oy+kTop, 1, kH);
      }
    }
  }

  // ─── Dart Projectile ────────────────────────────────────────
  _drawDart(ctx, viewer, dart, color, ox, oy, vpW, vpH, zBuf) {
    const dx = dart.x - viewer.x, dy = dart.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.18 || dist > 20) return;

    const sa = Math.atan2(dy, dx) - viewer.angle;
    const na = Math.atan2(Math.sin(sa), Math.cos(sa));
    if (Math.abs(na) > HALF_FOV + 0.12) return;

    const sx = (na / FOV + 0.5) * vpW;
    const dH = clamp(7 / dist * 5, 3, vpH * 0.4);
    const dW = dH * 2.8;
    const dY = vpH / 2 - dH / 2;

    const sC = Math.floor(sx - dW/2), eC = Math.floor(sx + dW/2);
    for (let col = Math.max(0, sC); col < Math.min(vpW, eC); col++) {
      if (zBuf[col] < dist) continue;
      const t = (col - sC) / Math.max(1, eC - sC);
      const brt = Math.max(0.5, 1 - dist/12);
      if (t < 0.22) {
        ctx.fillStyle = `rgba(60,30,15,${brt})`;  // suction cup tip
      } else if (t < 0.5) {
        ctx.fillStyle = `rgba(255,200,40,${brt})`; // foam body - yellow
      } else {
        ctx.fillStyle = `rgba(255,130,20,${brt})`; // foam body - orange
      }
      ctx.fillRect(ox+col, oy+dY, 1, dH);
    }
  }

  // ─── Crosshair ──────────────────────────────────────────────
  _drawCrosshair(ctx, p, ox, oy, vpW, vpH) {
    const cx = ox + vpW/2, cy = oy + vpH/2;
    const reloading = p.reloading;

    ctx.save();
    ctx.strokeStyle = reloading ? 'rgba(255,200,0,0.6)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;

    if (reloading) {
      // Show reload arc instead of crosshair
      const pct = 1 - p.reloadTimer / RELOAD_TIME;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, -Math.PI/2, -Math.PI/2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,0,0.5)';
      ctx.font = 'bold 9px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', cx, cy);
    } else {
      // Classic tactical crosshair with dot
      const gap = 5, len = 10;
      ctx.beginPath(); ctx.moveTo(cx-gap-len, cy); ctx.lineTo(cx-gap, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+gap, cy);     ctx.lineTo(cx+gap+len, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy-gap-len); ctx.lineTo(cx, cy-gap); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy+gap);     ctx.lineTo(cx, cy+gap+len); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ─── Gun Viewmodel (True 3D Projection FPS) ─────────────────
  // Renders solid 3D blocks projecting towards a vanishing point at the crosshair.
  _drawGun(ctx, p, ox, oy, vpW, vpH) {
    const gunColor = p.color;

    const swayX   = p.gunSwayX * 1.5;
    const swayY   = p.gunSwayY * 1.2;
    const recoilY = p.gunRecoil * 45;

    // Anchor at bottom right of viewport
    const scale = vpH / 700;
    const ax = ox + vpW * 0.85 + swayX;
    const ay = oy + vpH + 50 * scale + recoilY + swayY;

    // Crosshair position (vanishing point)
    const cx = ox + vpW / 2;
    const cy = oy + vpH / 2;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(scale, scale);

    // Calculate vanishing point in local scaled coordinates
    const vpX = (cx - ax) / scale;
    const vpY = (cy - ay) / scale;

    // 3D Projection function: z=1 is closest, higher z is further away
    function pt(x, y, z) {
      return [
        vpX + (x - vpX) / z,
        vpY + (y - vpY) / z
      ];
    }

    function drawFace(fill, pts) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    const mix = (hex, amt) => {
      const [r, g, b] = this._hexToRgb(hex);
      const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
      return `rgb(${clamp(r*amt)},${clamp(g*amt)},${clamp(b*amt)})`;
    };

    // Draws a solid 3D box. Because vpX and vpY are always negative (up and left),
    // we only ever see the Top, Left, and Back (closest) faces.
    function drawBlock(x1, x2, y1, y2, z1, z2, baseColor) {
      const cTop   = mix(baseColor, 1.15); // Lighter top
      const cSide  = mix(baseColor, 0.65); // Darker left side
      const cBack  = baseColor;            // Base colour facing player

      // Left face
      drawFace(cSide, [ pt(x1,y1,z1), pt(x1,y1,z2), pt(x1,y2,z2), pt(x1,y2,z1) ]);
      // Top face
      drawFace(cTop,  [ pt(x1,y1,z1), pt(x2,y1,z1), pt(x2,y1,z2), pt(x1,y1,z2) ]);
      // Back face (closest to camera, drawn last to overlay edges)
      drawFace(cBack, [ pt(x1,y1,z1), pt(x2,y1,z1), pt(x2,y2,z1), pt(x1,y2,z1) ]);
    }

    // ── Draw blocks from furthest (high Z) to closest (low Z) ──

    // 7. Orange Tip Front
    drawBlock(-20, 20, -35, 35, 3.4, 3.6, '#ff5500');
    // 6. Orange Tip Base
    drawBlock(-24, 24, -40, 40, 3.2, 3.4, '#cc3300');
    
    // 5. Barrel Rail
    drawBlock(-8, 8, -42, -30, 1.8, 3.0, '#1a1a1a');
    // 4. Barrel Main
    drawBlock(-18, 18, -30, 25, 1.8, 3.2, '#333333');
    
    // 3. Receiver Front
    drawBlock(-35, 35, -45, 60, 1.3, 1.8, gunColor);
    
    // 2. Ammo Clip (Visible on left side)
    if (p.ammo > 0) {
      drawBlock(-65, -35, -15, 45, 1.25, 1.45, '#ffaa00');
      
      // Dart detail on clip
      const cDart = mix('#ff2200', 0.8);
      drawFace(cDart, [ pt(-65,-15,1.25), pt(-65,-15,1.45), pt(-65,-5,1.45), pt(-65,-5,1.25) ]);
    }
    
    // 1. Receiver Back
    drawBlock(-35, 35, -45, 60, 1.0, 1.3, gunColor);
    
    // 0. Grip
    drawBlock(-15, 15, 60, 200, 1.0, 1.25, '#2a2a2a');

    // ── Muzzle Flash ──
    if (p.muzzleFlash > 0) {
      const mf = p.muzzleFlash / 0.10;
      ctx.save();
      ctx.globalAlpha = mf;
      
      // Project the flash exactly at the tip of the barrel
      const [fx, fy] = pt(0, -5, 3.6);
      
      const glowG = ctx.createRadialGradient(fx, fy, 2, fx, fy, 120);
      glowG.addColorStop(0, 'rgba(255,255,200,1)');
      glowG.addColorStop(0.3, 'rgba(255,180,30,0.8)');
      glowG.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = glowG;
      ctx.beginPath(); ctx.arc(fx, fy, 120, 0, Math.PI*2); ctx.fill();
      
      ctx.strokeStyle = '#ffffbb';
      ctx.lineWidth = 4;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + (Math.random()*0.2);
        const len2 = 40 + Math.random() * 40;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(ang)*len2, fy + Math.sin(ang)*len2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx, fy, 15, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // ── Reload Shimmer ──
    if (p.reloading) {
      const pct = 1 - p.reloadTimer / RELOAD_TIME;
      const pulse = 0.5 + Math.abs(Math.sin(this.time * 14)) * 0.5;
      ctx.globalAlpha = 0.3 * pulse;
      drawBlock(-38, 38, -48, 63, 1.0, 1.0 + pct * 2.2, '#ffff00');
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  // ─── HUD ────────────────────────────────────────────────────
  _drawHUD(ctx, p, ox, oy, vpW, vpH) {
    ctx.save();

    const px2 = ox + 14;

    // ── Player tag (top left) ──
    ctx.font = 'bold 13px Outfit';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    ctx.fillText(p.name, px2, oy + 24);

    // ── Score (top center) — animates on hit ──
    const scorePop = 1 + p.hitPop * 0.35;
    ctx.save();
    ctx.translate(ox + vpW/2, oy + 46);
    ctx.scale(scorePop, scorePop);
    ctx.font = 'bold 30px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(`${p.hits}`, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(`${p.hits}`, 0, 0);
    ctx.restore();

    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(`/ ${this.targetHits} to win`, ox + vpW/2, oy + 62);

    // ── Ammo bar (bottom left) ──
    const aX = ox + 14, aY = oy + vpH - 68;
    ctx.font = '10px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText('AMMO', aX, aY - 5);

    const dW2 = 11, dH2 = 6, dGap = 3;
    for (let i = 0; i < MAX_AMMO; i++) {
      const lx = aX + i * (dW2 + dGap);
      const loaded = i < p.ammo;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(lx+1, aY+1, dW2, dH2, 2); ctx.fill();
      // Dart pip
      ctx.fillStyle = loaded ? '#ffaa00' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.roundRect(lx, aY, dW2, dH2, 2); ctx.fill();
      if (loaded) {
        ctx.fillStyle = '#ff5500';
        ctx.beginPath(); ctx.roundRect(lx, aY, 4, dH2, [2,0,0,2]); ctx.fill();
      }
    }

    // ── Bottom right: controls reminder ──
    ctx.font = '9px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'right';
    const ctrlStr = p.id === 0 ? 'WASD·Turn | SPC·Fire | R·Reload' : '↑↓←→·Turn | ENT·Fire | /·Reload';
    ctx.fillText(ctrlStr, ox+vpW-10, oy+vpH-10);

    ctx.restore();
  }

  // ─── Minimap ────────────────────────────────────────────────
  _drawMinimap(ctx, p, ox, vpW, vpH) {
    const map  = this.map;
    const ROWS = map.length, COLS = map[0].length;
    const S    = 4.5;   // pixels per cell
    const mW   = COLS * S, mH = ROWS * S;
    const mx   = ox + vpW - mW - 12;
    const my   = vpH - mH - 12;

    ctx.save();
    ctx.globalAlpha = 0.72;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mW + 8, mH + 8, 5);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mW + 8, mH + 8, 5);
    ctx.stroke();

    // Cells
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = map[row][col];
        if (cell > 0) {
          const baseColor = this.palette[cell] || '#555';
          ctx.fillStyle = this._mixColor(...this._hexToRgb(baseColor), 0.6);
          ctx.fillRect(mx + col*S, my + row*S, S-0.5, S-0.5);
        }
      }
    }

    // Opponent dot
    const opp = this.players.find(pl => pl.id !== p.id);
    if (opp) {
      ctx.fillStyle = opp.color;
      ctx.beginPath();
      ctx.arc(mx + opp.x*S, my + opp.y*S, 2.5, 0, Math.PI*2);
      ctx.fill();
    }

    // Player dot + direction arrow
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(mx + p.x*S, my + p.y*S, 3, 0, Math.PI*2);
    ctx.fill();

    // Direction indicator
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx + p.x*S, my + p.y*S);
    ctx.lineTo(mx + p.x*S + Math.cos(p.angle)*6, my + p.y*S + Math.sin(p.angle)*6);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Countdown ──────────────────────────────────────────────
  _drawCountdown(ctx) {
    const txt = this._cdCount > 0 ? String(this._cdCount) : 'GO!';
    const scale = 1 + (1 - this._cdTimer / 0.9) * 0.22;
    ctx.save();
    ctx.translate(this.W/2, this.H/2 - 20);
    ctx.scale(scale, scale);
    ctx.font = `900 80px Outfit`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this._cdCount > 0 ? '#fff' : '#ffcc00';
    ctx.shadowColor = this._cdCount > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,200,0,0.5)';
    ctx.shadowBlur = 28;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  // ─── Colour Helpers ─────────────────────────────────────────
  _hexToRgb(hex) {
    return [
      parseInt(hex.slice(1,3),16),
      parseInt(hex.slice(3,5),16),
      parseInt(hex.slice(5,7),16),
    ];
  }

  _mixColor(r, g, b, amt) {
    return `rgb(${Math.round(r*amt)},${Math.round(g*amt)},${Math.round(b*amt)})`;
  }

  _shadeColor(hex, amt) {
    const [r,g,b] = this._hexToRgb(hex);
    return this._mixColor(r,g,b,amt);
  }
}

// ─── Boot ────────────────────────────────────────────────────
new NerfArena();
