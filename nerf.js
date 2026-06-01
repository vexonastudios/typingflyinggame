'use strict';

// ═══════════════════════════════════════════════════════════
//  NERF ARENA — Split-Screen Raycasting FPS
//  Classic Wolfenstein-style raycasting, 2-player keyboard duel
// ═══════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────
const FOV         = Math.PI / 2.8;   // field of view (~64°)
const HALF_FOV    = FOV / 2;
const MOVE_SPD    = 2.8;             // tiles/sec
const TURN_SPD    = 2.2;             // rad/sec
const DART_SPD    = 10.0;            // tiles/sec
const MAX_AMMO    = 6;               // darts per clip
const RELOAD_TIME = 1.8;             // seconds
const HIT_DIST    = 0.55;            // hit radius in tiles

// Wall colour palette — Nerf orange/blue/green theme
const WALL_PALETTES = [
  // Classic arena
  [ null, '#ff6b20', '#1e88e5', '#43a047', '#9c27b0', '#e53935', '#ff9800', '#00acc1' ],
  // Maze (cooler tones)
  [ null, '#1565c0', '#0288d1', '#006064', '#4a148c', '#880e4f', '#1b5e20', '#e65100' ],
  // Fortress (earthy)
  [ null, '#5d4037', '#6d4c41', '#4e342e', '#795548', '#8d6e63', '#a1887f', '#bf360c' ],
];

// ─── Arena Maps (0=empty, 1-7=wall colour index) ────────────
const MAPS = [
  // 0: Classic Arena (20x20)
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
  // 1: Maze (20x20)
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
  // 2: Fortress (20x20) — two bases at top/bottom
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

// Player start positions per arena
const STARTS = [
  [ {x:2.5,y:2.5,a:Math.PI*0.25},  {x:17.5,y:17.5,a:Math.PI*1.25} ],
  [ {x:1.5,y:1.5,a:0},              {x:18.5,y:18.5,a:Math.PI} ],
  [ {x:2.5,y:2.5,a:Math.PI*0.25},  {x:17.5,y:17.5,a:Math.PI*1.25} ],
];

const P_COLORS  = ['#ff6b35', '#38bdf8'];
const P_NAMES   = ['Player 1', 'Player 2'];
const GUN_COLORS = ['#ff6b35', '#38bdf8'];

// ─── Audio ──────────────────────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _tone(f, type, dur, vol=0.07, slide=null) {
    try {
      this._r();
      const o=_ac.createOscillator(), g=_ac.createGain();
      o.type=type; o.frequency.setValueAtTime(f,_ac.currentTime);
      if(slide) o.frequency.exponentialRampToValueAtTime(slide,_ac.currentTime+dur);
      g.gain.setValueAtTime(vol,_ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,_ac.currentTime+dur);
      o.connect(g); g.connect(_ac.destination); o.start(); o.stop(_ac.currentTime+dur);
    } catch(e){}
  },
  _noise(dur,vol=0.05) {
    try {
      this._r();
      const buf=_ac.createBuffer(1,_ac.sampleRate*dur,_ac.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*vol;
      const src=_ac.createBufferSource(), g=_ac.createGain();
      src.buffer=buf; g.gain.setValueAtTime(vol,_ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,_ac.currentTime+dur);
      src.connect(g); g.connect(_ac.destination); src.start();
    } catch(e){}
  },
  shoot()    { this._tone(300,'sawtooth',0.06,0.08,180); this._noise(0.07,0.06); },
  empty()    { this._tone(120,'square',0.1,0.06); },
  reload()   { this._tone(200,'triangle',0.15,0.06,280); setTimeout(()=>this._tone(350,'triangle',0.15,0.07,420),200); },
  hit()      { this._tone(600,'sine',0.12,0.09,300); this._noise(0.1,0.08); },
  splat()    { this._tone(180,'sawtooth',0.2,0.1,50); this._noise(0.15,0.07); },
  countdown(){ this._tone(440,'square',0.13,0.07); },
  go()       { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.09),i*85)); },
  win()      { [523,659,784,1047,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.28,0.09),i*100)); },
  click()    { this._tone(600,'sine',0.04,0.04); },
  step()     { this._noise(0.04, 0.015); }, // Soft static burst for footsteps
};

// ─── Utilities ──────────────────────────────────────────────
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const lerp  = (a,b,t)   => a+(b-a)*t;

// ═══════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(id, ctrl, startPos, palette) {
    this.id      = id;
    this.ctrl    = ctrl;
    this.color   = P_COLORS[id];
    this.name    = P_NAMES[id];
    this.palette = palette;
    this.x       = startPos.x;
    this.y       = startPos.y;
    this.angle   = startPos.a;
    this.ammo    = MAX_AMMO;
    this.reloading = false;
    this.reloadTimer = 0;
    this.hits    = 0;   // hits scored ON opponent
    this.hitFlash = 0;  // screen flash when hit by opponent
    this.shootFlash = 0;
    this.darts   = []; // active dart projectiles {x,y,vx,vy,ownerId}
    this.splatMarks = []; // { wx,wy, color, life }
    this.bobTimer = 0;
    this.gunRecoil = 0;
    this.gunSwayX = 0;
    this.gunSwayY = 0;
    this._shootCd = 0;
    this._stepTimer = 0;
    this.alive = true;
  }
}

// ═══════════════════════════════════════════════════════════
//  RAYCASTER
// ═══════════════════════════════════════════════════════════
function castRay(map, px, py, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // DDA algorithm
  const mapX0 = Math.floor(px), mapY0 = Math.floor(py);
  const stepX  = cosA > 0 ? 1 : -1;
  const stepY  = sinA > 0 ? 1 : -1;
  const deltaX = Math.abs(1 / (cosA || 1e-9));
  const deltaY = Math.abs(1 / (sinA || 1e-9));

  let sideDistX = cosA > 0 ? (mapX0+1-px)*deltaX : (px-mapX0)*deltaX;
  let sideDistY = sinA > 0 ? (mapY0+1-py)*deltaY : (py-mapY0)*deltaY;

  let mx = mapX0, my = mapY0;
  let side = 0, dist = 0;
  const MAX_DIST = 25;

  for (let i = 0; i < 64; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaX; mx += stepX; side = 0;
    } else {
      sideDistY += deltaY; my += stepY; side = 1;
    }
    if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) break;
    if (map[my][mx] > 0) {
      dist = side === 0
        ? (mx - px + (1-stepX)/2) / cosA
        : (my - py + (1-stepY)/2) / sinA;
      return { dist: Math.abs(dist), wallType: map[my][mx], side };
    }
  }
  return { dist: MAX_DIST, wallType: 0, side: 0 };
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME
// ═══════════════════════════════════════════════════════════
class NerfArena {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.keys   = {};
    this.state  = 'setup';
    this.lastTs = 0;
    this.time   = 0;

    this.players   = [];
    this.map       = null;
    this.palette   = null;
    this.targetHits = 5;
    this.arenaIdx  = 0;

    this._cdCount = 3;
    this._cdTimer = 0;
    this._globalShake = 0;

    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      const blocked = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD','KeyQ','KeyE','KeyR','Enter','Slash','Comma','Period'];
      if (blocked.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

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
    document.getElementById('startBtn').addEventListener('click',   () => this._startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _startGame() {
    Sfx._r();
    const tEl = document.querySelector('input[name="target"]:checked');
    const aEl = document.querySelector('input[name="arena"]:checked');
    this.targetHits = parseInt(tEl?.value || '5');
    this.arenaIdx   = parseInt(aEl?.value || '0');
    this.map     = MAPS[this.arenaIdx];
    this.palette = WALL_PALETTES[this.arenaIdx];

    document.getElementById('gameSetup').style.display   = 'none';
    document.getElementById('gameResults').style.display = 'none';

    const starts = STARTS[this.arenaIdx];
    const C1 = { fwd:'KeyW', back:'KeyS', turnL:'KeyA', turnR:'KeyD', shoot:'Space', reload:'KeyR' };
    const C2 = { fwd:'ArrowUp', back:'ArrowDown', turnL:'ArrowLeft', turnR:'ArrowRight', shoot:'Enter', reload:'Slash' };

    this.players = [
      new Player(0, C1, starts[0], this.palette),
      new Player(1, C2, starts[1], this.palette),
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

  // ─── Loop ────────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this.time  += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Update ──────────────────────────────────────────────
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

    this._globalShake *= Math.pow(0.65, dt * 60);
    if (this._globalShake < 0.15) this._globalShake = 0;

    this.players.forEach((p, i) => {
      const opp = this.players[1 - i];
      this._updatePlayer(p, opp, dt);
    });

    // Win check
    const winner = this.players.find(p => p.hits >= this.targetHits);
    if (winner && this.state === 'playing') {
      this.state = 'done';
      Sfx.win();
      setTimeout(() => this._showResults(winner), 1500);
    }
  }

  _updatePlayer(p, opp, dt) {
    const keys = this.keys;
    const map  = this.map;

    p.hitFlash   = Math.max(0, p.hitFlash   - dt);
    p.shootFlash = Math.max(0, p.shootFlash - dt);
    p.gunRecoil  = Math.max(0, p.gunRecoil  - dt * 5);
    p._shootCd   = Math.max(0, p._shootCd   - dt);

    // ── Reload ──
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.ammo = MAX_AMMO;
        p.reloading = false;
      }
    }
    if (!p.reloading && keys[p.ctrl.reload] && p.ammo < MAX_AMMO) {
      p.reloading = true;
      p.reloadTimer = RELOAD_TIME;
      Sfx.reload();
    }

    // ── Shoot ──
    if (keys[p.ctrl.shoot] && !p.reloading && p._shootCd <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        p._shootCd = 0.22;
        p.shootFlash = 0.08;
        p.gunRecoil  = 0.35;
        Sfx.shoot();
        // Spawn dart in world space
        const spread = (Math.random() - 0.5) * 0.04; // tiny spread
        p.darts.push({
          x: p.x, y: p.y,
          vx: Math.cos(p.angle + spread) * DART_SPD,
          vy: Math.sin(p.angle + spread) * DART_SPD,
          ownerId: p.id,
          life: 3.0,
          trail: [],
        });
      } else if (p._shootCd <= 0) {
        p._shootCd = 0.4;
        Sfx.empty();
        // auto-reload on empty
        if (!p.reloading) { p.reloading = true; p.reloadTimer = RELOAD_TIME; Sfx.reload(); }
      }
    }

    // ── Move & turn ──
    if (this.state !== 'playing') return;

    let speed = 0, strafe = 0, turn = 0;
    if (keys[p.ctrl.fwd])   speed  =  MOVE_SPD;
    if (keys[p.ctrl.back])  speed  = -MOVE_SPD * 0.65;
    if (keys[p.ctrl.turnL]) turn   = -TURN_SPD;
    if (keys[p.ctrl.turnR]) turn   =  TURN_SPD;

    p.angle += turn * dt;

    const cosA = Math.cos(p.angle), sinA = Math.sin(p.angle);
    const cosS = Math.cos(p.angle + Math.PI/2), sinS = Math.sin(p.angle + Math.PI/2);

    let nx = p.x + (cosA * speed + cosS * strafe) * dt;
    let ny = p.y + (sinA * speed + sinS * strafe) * dt;

    const MARGIN = 0.3;
    if (!this._wallAt(Math.floor(nx), Math.floor(p.y))) p.x = nx;
    if (!this._wallAt(Math.floor(p.x), Math.floor(ny))) p.y = ny;

    // Gun bob & footsteps
    if (speed !== 0 || strafe !== 0) {
      p.bobTimer += dt * 6;
      p.gunSwayX = Math.sin(p.bobTimer) * 4;
      p.gunSwayY = Math.abs(Math.sin(p.bobTimer)) * 3;
      
      p._stepTimer -= dt;
      if (p._stepTimer <= 0) {
        Sfx.step();
        p._stepTimer = 0.35; // play step sound every 0.35s while walking
      }
    } else {
      p.bobTimer += dt * 1.5;
      p.gunSwayX = Math.sin(p.bobTimer) * 0.8;
      p.gunSwayY = 0;
      p._stepTimer = 0;
    }

    // ── Update darts ──
    p.darts = p.darts.filter(dart => {
      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
      dart.life -= dt;
      dart.trail.push({ x: dart.x, y: dart.y });
      if (dart.trail.length > 5) dart.trail.shift();

      // Hit wall?
      if (this._wallAt(Math.floor(dart.x), Math.floor(dart.y))) {
        // Leave a splat mark at impact
        p.splatMarks.push({
          wx: dart.x, wy: dart.y,
          color: p.color,
          life: 20.0,
        });
        Sfx.splat();
        return false;
      }

      // Hit opponent?
      const dx = dart.x - opp.x, dy = dart.y - opp.y;
      if (Math.sqrt(dx*dx + dy*dy) < HIT_DIST) {
        p.hits++;
        opp.hitFlash = 0.45;
        this._globalShake = 8;
        Sfx.hit();
        this._showBanner(p.hits >= this.targetHits ? '🏆 GAME OVER!' : `🎯 HIT! ${p.name}: ${p.hits}/${this.targetHits}`);
        return false;
      }

      return dart.life > 0;
    });

    // Age splat marks
    p.splatMarks = p.splatMarks.filter(s => { s.life -= dt; return s.life > 0; });
  }

  _wallAt(mx, my) {
    if (my < 0 || my >= this.map.length || mx < 0 || mx >= this.map[0].length) return true;
    return this.map[my][mx] > 0;
  }

  _showResults(winner) {
    this.state = 'results';
    document.getElementById('gameResults').style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    const sorted = [...this.players].sort((a,b) => b.hits - a.hits);
    document.getElementById('resultsIcon').textContent = '🏆';
    document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;
    sorted.forEach((p, i) => {
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
  //  DRAWING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this._globalShake > 0.1) {
      ctx.translate((Math.random()-0.5)*this._globalShake, (Math.random()-0.5)*this._globalShake);
    }
    ctx.clearRect(-20,-20,this.W+40,this.H+40);

    if (this.state === 'setup' || this.state === 'results') {
      ctx.fillStyle = '#060c1a';
      ctx.fillRect(0,0,this.W,this.H);
      ctx.restore();
      return;
    }

    const vpW = Math.floor(this.W / 2);
    const vpH = this.H;

    // Draw P1 view (left half)
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[0], this.players[1], 0, 0, vpW, vpH);
    ctx.restore();

    // Draw P2 view (right half)
    ctx.save();
    ctx.beginPath(); ctx.rect(vpW, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[1], this.players[0], vpW, 0, vpW, vpH);
    ctx.restore();

    // Center divider
    ctx.fillStyle = '#000';
    ctx.fillRect(vpW-2, 0, 4, vpH);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(vpW, 0, 1, vpH);

    // Countdown overlay
    if (this.state === 'countdown') {
      this._drawCountdown(ctx);
    }

    ctx.restore();
  }

  _drawView(ctx, p, opp, ox, oy, vpW, vpH) {
    const halfH = vpH / 2;
    const rays   = vpW; // one ray per pixel column

    // ── Ceiling ──
    const ceilGrad = ctx.createLinearGradient(ox, oy, ox, oy + halfH);
    ceilGrad.addColorStop(0, '#1a1a2e');
    ceilGrad.addColorStop(1, '#2d2d4e');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(ox, oy, vpW, halfH);

    // ── Floor ──
    const floorGrad = ctx.createLinearGradient(ox, oy + halfH, ox, oy + vpH);
    floorGrad.addColorStop(0, '#2a2a1a');
    floorGrad.addColorStop(1, '#1a1a0a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(ox, oy + halfH, vpW, halfH);

    // Floor grid (simple)
    ctx.strokeStyle = 'rgba(255,200,100,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = oy + halfH + (vpH / 2) * (i / 6) ** 0.5 * (vpH / 2);
      if (y > oy + vpH) break;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox+vpW, y); ctx.stroke();
    }

    // ── Walls (raycasting) ──
    const zBuffer = new Float32Array(vpW);

    for (let col = 0; col < vpW; col++) {
      const rayAngle = p.angle - HALF_FOV + (col / vpW) * FOV;
      const { dist, wallType, side } = castRay(this.map, p.x, p.y, rayAngle);

      // Fix fisheye
      const corrDist = Math.max(0.05, dist * Math.cos(rayAngle - p.angle));
      zBuffer[col] = corrDist;

      const wallH  = Math.min(vpH * 2.2, vpH / corrDist);
      const wallY  = (vpH - wallH) / 2;

      // Wall colour
      let baseColor = this.palette[wallType] || '#888888';
      // Darken for side walls and by distance
      const shade = Math.max(0.18, 1 - corrDist / 14) * (side === 1 ? 0.72 : 1.0);
      ctx.fillStyle = this._shadeColor(baseColor, shade);
      ctx.fillRect(ox + col, oy + wallY, 1, wallH);

      // Wall top/bottom cap shade
      const capH = Math.max(1, wallH * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(ox + col, oy + wallY, 1, capH);
      ctx.fillRect(ox + col, oy + wallY + wallH - capH, 1, capH);
    }

    // ── Opponent sprite ──
    this._drawSprite(ctx, p, opp, ox, oy, vpW, vpH, zBuffer);

    // ── Active darts (from all players, projected into this view) ──
    this.players.forEach(shooter => {
      shooter.darts.forEach(dart => {
        this._drawDartSprite(ctx, p, dart, shooter.color, ox, oy, vpW, vpH, zBuffer);
      });
    });

    // ── Hit flash overlay ──
    if (p.hitFlash > 0) {
      const alpha = p.hitFlash * 0.65;
      ctx.fillStyle = `rgba(255,40,40,${alpha})`;
      ctx.fillRect(ox, oy, vpW, vpH);

      // Hit marker (crosshair flash)
      ctx.strokeStyle = `rgba(255,80,80,${alpha*2})`;
      ctx.lineWidth = 2;
      const cx = ox + vpW/2, cy = oy + vpH/2;
      ctx.beginPath(); ctx.moveTo(cx-20,cy); ctx.lineTo(cx+20,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy-20); ctx.lineTo(cx,cy+20); ctx.stroke();
    }

    // ── Shoot flash ──
    if (p.shootFlash > 0) {
      ctx.fillStyle = `rgba(255,200,80,${p.shootFlash * 4})`;
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── Crosshair ──
    const cxr = ox + vpW/2, cyr = oy + vpH/2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cxr-10,cyr); ctx.lineTo(cxr-4,cyr); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxr+4,cyr);  ctx.lineTo(cxr+10,cyr); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxr,cyr-10); ctx.lineTo(cxr,cyr-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxr,cyr+4);  ctx.lineTo(cxr,cyr+10); ctx.stroke();
    ctx.beginPath(); ctx.arc(cxr,cyr,2,0,Math.PI*2); ctx.stroke();

    // ── Gun sprite ──
    this._drawGun(ctx, p, ox, oy, vpW, vpH);

    // ── HUD ──
    this._drawHUD(ctx, p, ox, oy, vpW, vpH);
  }

  _drawSprite(ctx, viewer, sprite, ox, oy, vpW, vpH, zBuffer) {
    const dx = sprite.x - viewer.x;
    const dy = sprite.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.3) return;

    // Angle to sprite relative to viewer facing
    const spriteAngle = Math.atan2(dy, dx) - viewer.angle;
    const normAngle   = Math.atan2(Math.sin(spriteAngle), Math.cos(spriteAngle));

    if (Math.abs(normAngle) > HALF_FOV + 0.2) return;

    const screenX = (normAngle / FOV + 0.5) * vpW;
    const spriteH = Math.min(vpH * 1.8, vpH / dist);
    const spriteW = spriteH * 0.6;
    const spriteTop = (vpH - spriteH) / 2;

    const startCol = Math.floor(screenX - spriteW / 2);
    const endCol   = Math.floor(screenX + spriteW / 2);

    for (let col = Math.max(0, startCol); col < Math.min(vpW, endCol); col++) {
      if (zBuffer[col] < dist) continue; // hidden behind wall

      const texU = (col - startCol) / (endCol - startCol);

      // ── Pro Sci-Fi Armor Sprite Redesign ──
      
      // Head (top 22%)
      if (texU > 0.3 && texU < 0.7) {
        const headTop = spriteTop;
        const headH = spriteH * 0.22;
        
        // Outline (left/right edges)
        if (texU < 0.35 || texU > 0.65) {
            ctx.fillStyle = `rgba(10,10,15,${Math.max(0.4, 1-dist/10)})`; // Dark outline
            ctx.fillRect(ox+col, oy+headTop, 1, headH);
        } else {
            // Helmet Base (White/Light Grey armor)
            ctx.fillStyle = `rgba(240,245,255,${Math.max(0.4, 1-dist/10)})`;
            ctx.fillRect(ox+col, oy+headTop, 1, headH);
            
            // Glowing Visor
            if (texU > 0.38 && texU < 0.62) {
                const visorTop = headTop + headH * 0.3;
                const visorH = headH * 0.35;
                // Bright glowing team color (NO distance fading so it POPS)
                ctx.fillStyle = sprite.color; 
                ctx.fillRect(ox+col, oy+visorTop, 1, visorH);
                // White hot center of visor
                if (texU > 0.45 && texU < 0.55) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(ox+col, oy+visorTop + visorH*0.2, 1, visorH*0.6);
                }
            }
        }
      }

      // Shoulders & Arms (Outer 15%)
      if ((texU > 0.15 && texU <= 0.3) || (texU >= 0.7 && texU < 0.85)) {
        const armTop = spriteTop + spriteH * 0.22;
        const armH   = spriteH * 0.45;
        
        if (texU < 0.2 || texU > 0.8) {
             // Outline
             ctx.fillStyle = `rgba(10,10,15,${Math.max(0.4, 1-dist/10)})`;
             ctx.fillRect(ox+col, oy+armTop, 1, armH);
        } else {
             // Shoulder pad (Team color)
             const padH = armH * 0.35;
             ctx.fillStyle = sprite.color;
             ctx.fillRect(ox+col, oy+armTop, 1, padH);
             
             // Lower arm (Dark grey body suit)
             ctx.fillStyle = `rgba(60,65,70,${Math.max(0.3, 1-dist/10)})`;
             ctx.fillRect(ox+col, oy+armTop+padH, 1, armH-padH);
        }
        
        // Blaster in right hand (viewer's left side)
        if (texU > 0.15 && texU <= 0.3) {
            const gunTop = armTop + armH - spriteH*0.1;
            const gunH = spriteH * 0.22;
            ctx.fillStyle = `rgba(10,10,15,${Math.max(0.4, 1-dist/10)})`; // Gun outline
            ctx.fillRect(ox+col, oy+gunTop-1, 1, gunH+2);
            ctx.fillStyle = '#ff6600'; // Bright Nerf Orange (no fade)
            ctx.fillRect(ox+col, oy+gunTop, 1, gunH);
        }
      }

      // Torso (middle 40%)
      if (texU > 0.3 && texU < 0.7) {
        const bodyTop = spriteTop + spriteH*0.22;
        const bodyH   = spriteH * 0.45;
        
        // Outline
        if (texU < 0.35 || texU > 0.65) {
            ctx.fillStyle = `rgba(10,10,15,${Math.max(0.4, 1-dist/10)})`;
            ctx.fillRect(ox+col, oy+bodyTop, 1, bodyH);
        } else {
            // White armor plate
            ctx.fillStyle = `rgba(240,245,255,${Math.max(0.4, 1-dist/10)})`;
            ctx.fillRect(ox+col, oy+bodyTop, 1, bodyH);
            
            // Glowing chest core
            if (texU > 0.45 && texU < 0.55) {
                const coreTop = bodyTop + bodyH * 0.2;
                const coreH = bodyH * 0.3;
                ctx.fillStyle = sprite.color; // Emissive team color
                ctx.fillRect(ox+col, oy+coreTop, 1, coreH);
            }
            
            // Dark tactical belt
            const beltTop = bodyTop + bodyH - spriteH * 0.08;
            const beltH = spriteH * 0.08;
            ctx.fillStyle = `rgba(30,30,35,${Math.max(0.4, 1-dist/10)})`;
            ctx.fillRect(ox+col, oy+beltTop, 1, beltH);
        }
      }

      // Legs (bottom 33%)
      if (texU > 0.3 && texU < 0.7) {
        if (texU > 0.45 && texU < 0.55) {
            // Gap between legs
        } else {
            const legTop = spriteTop + spriteH * 0.67;
            const legH   = spriteH * 0.33;
            
            // Outline around each leg
            if (texU < 0.35 || texU > 0.65 || (texU > 0.42 && texU < 0.45) || (texU > 0.55 && texU < 0.58)) {
                ctx.fillStyle = `rgba(10,10,15,${Math.max(0.4, 1-dist/10)})`;
                ctx.fillRect(ox+col, oy+legTop, 1, legH);
            } else {
                // Leg armor (Dark Grey)
                ctx.fillStyle = `rgba(80,85,90,${Math.max(0.3, 1-dist/10)})`;
                ctx.fillRect(ox+col, oy+legTop, 1, legH);
                
                // Glowing knee pads
                const kneeTop = legTop + legH * 0.3;
                const kneeH = legH * 0.25;
                ctx.fillStyle = sprite.color; // Emissive team color
                ctx.fillRect(ox+col, oy+kneeTop, 1, kneeH);
            }
        }
      }
    }
  }

  _drawDartSprite(ctx, viewer, dart, dartColor, ox, oy, vpW, vpH, zBuffer) {
    const dx = dart.x - viewer.x;
    const dy = dart.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.2 || dist > 18) return;

    const spriteAngle = Math.atan2(dy, dx) - viewer.angle;
    const normAngle   = Math.atan2(Math.sin(spriteAngle), Math.cos(spriteAngle));
    if (Math.abs(normAngle) > HALF_FOV + 0.1) return;

    const screenX = (normAngle / FOV + 0.5) * vpW;
    const dartH   = Math.min(vpH * 0.5, 8 / dist * 6);
    const dartW   = dartH * 3;
    const dartY   = vpH / 2 - dartH / 2;

    const startCol = Math.floor(screenX - dartW/2);
    const endCol   = Math.floor(screenX + dartW/2);

    for (let col = Math.max(0, startCol); col < Math.min(vpW, endCol); col++) {
      if (zBuffer[col] < dist) continue;
      const t = (col - startCol) / Math.max(1, endCol - startCol);
      // Dart body: orange/yellow gradient, tip darker
      const brightness = Math.max(0.4, 1 - dist/14);
      ctx.fillStyle = t < 0.3
        ? `rgba(80,40,20,${brightness})`  // tip (suction cup)
        : `rgba(255,160,30,${brightness})`; // foam body
      ctx.fillRect(ox+col, oy+dartY, 1, dartH);
    }
  }

  _drawGun(ctx, p, ox, oy, vpW, vpH) {
    const gx = ox + vpW/2 + p.gunSwayX + (p.id === 0 ? -40 : -40);
    const gy = oy + vpH - 130 + p.gunSwayY + p.gunRecoil * 30;
    const reloading = p.reloading;

    // Gun body
    const gunColor = GUN_COLORS[p.id];

    // Main body
    ctx.fillStyle = gunColor;
    ctx.beginPath();
    ctx.roundRect(gx-18, gy+10, 90, 28, 6);
    ctx.fill();

    // Barrel
    ctx.fillStyle = this._shadeColor(gunColor, 0.7);
    ctx.beginPath();
    ctx.roundRect(gx+55, gy+16, 48, 14, 4);
    ctx.fill();

    // Barrel tip (orange tip, classic Nerf)
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.roundRect(gx+99, gy+16, 10, 14, 2);
    ctx.fill();

    // Handle
    ctx.fillStyle = this._shadeColor(gunColor, 0.6);
    ctx.beginPath();
    ctx.roundRect(gx+5, gy+34, 22, 36, 5);
    ctx.fill();

    // Trigger
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.roundRect(gx+18, gy+44, 6, 16, 2);
    ctx.fill();

    // Dart chamber (shows loaded darts)
    for (let i = 0; i < p.ammo; i++) {
      const dx2 = gx + 10 + i * 10;
      const dy2 = gy + 14;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.roundRect(dx2, dy2, 7, 10, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,60,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(dx2, dy2, 4, 4, 1);
      ctx.fill();
    }

    // Reload flash
    if (reloading) {
      const rProgress = 1 - p.reloadTimer / RELOAD_TIME;
      ctx.fillStyle = `rgba(255,255,100,${0.15 + Math.sin(this.time * 18) * 0.1})`;
      ctx.beginPath();
      ctx.roundRect(gx-18, gy+10, 90 * rProgress, 28, 6);
      ctx.fill();
    }
  }

  _drawHUD(ctx, p, ox, oy, vpW, vpH) {
    // Score display
    ctx.font = 'bold 26px Outfit';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(`${p.hits}`, ox + vpW/2, oy + 44);
    ctx.fillText(`${p.hits}`, ox + vpW/2, oy + 44);

    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`/ ${this.targetHits} hits`, ox + vpW/2, oy + 59);

    // Player name
    ctx.font = 'bold 13px Outfit';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    ctx.fillText(p.name, ox + 12, oy + 24);

    // Ammo (foam dart icons)
    const dartIconW = 10, dartIconH = 5, dartGap = 4;
    const ammoStartX = ox + 14;
    const ammoY = oy + vpH - 70;
    for (let i = 0; i < MAX_AMMO; i++) {
      const dx2 = ammoStartX + i * (dartIconW + dartGap);
      const loaded = i < p.ammo;
      ctx.fillStyle = loaded ? '#ffaa00' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(dx2, ammoY, dartIconW, dartIconH, 2);
      ctx.fill();
      if (loaded) {
        ctx.fillStyle = 'rgba(255,60,0,0.6)';
        ctx.beginPath();
        ctx.roundRect(dx2, ammoY, 4, dartIconH, 1);
        ctx.fill();
      }
    }

    // Ammo label
    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('AMMO', ammoStartX, ammoY - 4);

    // Reload indicator
    if (p.reloading) {
      const pct = 1 - p.reloadTimer / RELOAD_TIME;
      const barW = 90, barH = 6;
      const barX = ox + vpW/2 - barW/2, barY = oy + vpH - 90;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.roundRect(barX-1, barY-1, barW+2, barH+2, 4); ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 3); ctx.fill();

      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW * pct, barH, 3); ctx.fill();

      ctx.font = 'bold 11px Outfit';
      ctx.fillStyle = 'rgba(255,220,0,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('RELOADING…', ox + vpW/2, barY - 5);
    }

    // Hit streak
    if (p.hits > 0) {
      ctx.font = 'bold 11px Outfit';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'right';
      ctx.fillText(`🎯 ${p.hits} hit${p.hits>1?'s':''}`, ox + vpW - 12, oy + 24);
    }
  }

  _drawCountdown(ctx) {
    const text  = this._cdCount > 0 ? String(this._cdCount) : 'GO!';
    const scale = 1 + (1 - this._cdTimer / 0.9) * 0.25;
    ctx.save();
    ctx.translate(this.W/2, this.H/2 - 30);
    ctx.scale(scale, scale);
    ctx.font = `bold 72px Outfit`;
    ctx.fillStyle = this._cdCount > 0 ? '#fff' : '#ffcc00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,200,0,0.4)';
    ctx.shadowBlur = 20;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _shadeColor(hex, amt) {
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    r = clamp(Math.round(r*amt),0,255);
    g = clamp(Math.round(g*amt),0,255);
    b = clamp(Math.round(b*amt),0,255);
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Boot ───────────────────────────────────────────────────
new NerfArena();
