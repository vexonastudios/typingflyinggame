'use strict';

// ═══════════════════════════════════════════════════════════
//  LANE BLITZ  –  Split-Screen Arcade Racer
//  Architecture: two independent side-by-side viewports,
//  auto-forward scrolling, lane-switch & jump mechanics
// ═══════════════════════════════════════════════════════════

// ─── Tuning Constants ───────────────────────────────────────
const SCROLL_BASE    = 280;    // pixels/sec at start
const SCROLL_MAX     = 680;    // max scroll speed
const SCROLL_ACCEL   = 8;      // speed increase per second
const LANE_COUNT     = 5;
const LANE_W         = 96;
const ROAD_W         = LANE_COUNT * LANE_W;   // 480
const VIEW_W         = 560;    // each player's viewport width
const VIEW_H_FRAC    = 1.0;    // fraction of canvas height
const ROAD_X         = 0;      // track origin
const CAR_W          = 46;
const CAR_H          = 72;
const JUMP_VY        = -880;
const GRAVITY_VAL    = 2200;
const LAND_CRUSH_MS  = 120;    // landing squash frames
const LANE_SNAP_SPD  = 14;     // lane lerp multiplier
const STUN_DUR       = 1.2;    // collision stun seconds
const SHAKE_MAX      = 14;
const TOTAL_DIST     = 24000;  // extended track length in scroll-units

// ─── Colour Palette (Synthwave) ──────────────────────────────
const P_COLORS   = ['#ff2d78', '#00f0ff'];
const P_GLOW     = ['rgba(255,45,120,0.6)', 'rgba(0,240,255,0.6)'];
const P_NAMES    = ['Player 1', 'Player 2'];
const NEON_GRID  = '#2a0060';
const NEON_EDGE  = '#b44fff';

// ─── Web-Audio SFX Engine ───────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _tone(f, type, dur, vol = 0.1, slide = null) {
    try {
      this._r();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, _ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, _ac.currentTime + dur);
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      o.connect(g); g.connect(_ac.destination);
      o.start(); o.stop(_ac.currentTime + dur);
    } catch(e) {}
  },
  jump()   { this._tone(350, 'square', 0.12, 0.07, 520); },
  land()   { this._tone(110, 'triangle', 0.1, 0.1, 60); },
  boost()  { this._tone(400, 'sawtooth', 0.22, 0.09, 900); },
  crash()  { this._tone(180, 'sawtooth', 0.35, 0.14, 60); this._tone(80, 'triangle', 0.35, 0.1, 40); },
  shield() { this._tone(600, 'sine', 0.18, 0.07, 800); },
  nearmiss() { this._tone(440, 'sine', 0.08, 0.05); },
  blip()   { this._tone(880, 'sine', 0.06, 0.04); },
  go()     { [523, 659, 784, 1047].forEach((f,i) => setTimeout(() => this._tone(f,'sine',0.22,0.12), i*100)); },
  countdown() { this._tone(440, 'square', 0.14, 0.08); },
  win()    { [523,659,784,1047,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.3,0.1),i*120)); },
  lose()   { [400,320,240,180].forEach((f,i)=>setTimeout(()=>this._tone(f,'sawtooth',0.25,0.09),i*120)); },
};

// ─── Utility Helpers ────────────────────────────────────────
const lerp    = (a,b,t)  => a + (b-a)*t;
const clamp   = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rand    = (lo,hi)   => lo + Math.random()*(hi-lo);
const randInt = (lo,hi)   => Math.floor(rand(lo,hi+1));
const pick    = arr       => arr[Math.floor(Math.random()*arr.length)];

// ─── Lane utilities ─────────────────────────────────────────
function laneX(lane) {           // centre-x of lane [0..4] in road space
  return ROAD_X + lane * LANE_W + LANE_W / 2;
}
function laneToCar(lane) {       // pixel left-edge so car centred
  return laneX(lane) - CAR_W / 2;
}

// ─── Obstacle Definitions ───────────────────────────────────
// type: 'block' | 'gap' | 'boost' | 'slow' | 'jumper' | 'barrier' | 'debris'
// pattern: array of lane indices to cover
// w, h in pixels; h controls how tall on road; gapH how tall the pit appears

const OBS_TEMPLATES = [
  // ── Simple single-lane block ──
  { type:'block',   w:70, h:52, pattern:(n)=>   [[randInt(0,4)]] },
  // ── Double block ──
  { type:'block',   w:70, h:52, pattern:(n)=>   [pick([[0,1],[1,2],[2,3],[3,4],[0,2],[2,4]])] },
  // ── Three-wide wall with one gap ──
  { type:'block',   w:70, h:52, pattern:(n)=>   [pick([[0,1,2],[1,2,3],[2,3,4]])] },
  // ── Boost strip (all 5 lanes) ──
  { type:'boost',   w:86, h:36, pattern:(n)=>   [[randInt(0,4)]] },
  // ── Slow mud patch ──
  { type:'slow',    w:80, h:42, pattern:(n)=>   [[randInt(0,3), randInt(1,4)]] },
  // ── Pit / gap – must jump ──
  { type:'pit',     w:ROAD_W-16, h:24 },
  // ── Moving barrier ──
  { type:'barrier', w:16, h:66, pattern:(n)=>   [[0,1,2]], moving:true },
  // ── Debris scatter ──
  { type:'debris',  w:28, h:28, pattern:(n)=>   [[randInt(0,4)]] },
];

// ─── Track Section Definitions ──────────────────────────────
// Sections repeat with increasing difficulty
const SECTIONS = [
  { name:'Open Road',   minGap:340, maxGap:520, types:['block','boost'] },
  { name:'Traffic Jam', minGap:280, maxGap:460, types:['vehicle','block','slow'] },
  { name:'Hazard Zone', minGap:260, maxGap:420, types:['block','block','barrier','debris'] },
  { name:'Pit Run',     minGap:280, maxGap:460, types:['block','pit','boost','slow'] },
  { name:'Laser Field', minGap:240, maxGap:400, types:['laser','block','shield'] },
  { name:'Chaos Lane',  minGap:200, maxGap:350, types:['block','barrier','debris','vehicle','pit','laser'] },
];

// ═══════════════════════════════════════════════════════════
//  OBSTACLE GENERATOR
// ═══════════════════════════════════════════════════════════
class ObstacleSequencer {
  constructor(difficulty) {
    this.diff       = difficulty;   // 0=easy 1=med 2=hard
    this.scrollPos  = 0;            // how far we've generated up to
    this.obstacles  = [];           // { y, lane[], type, w, h, vx, vy, hit, moving }
    this.nextY      = -VIEW_H_FRAC * 600; // spawn ahead of screen top
    this._history   = [];
    this._section   = 0;
    this._sectionDist = 0;
  }

  update(scrollDelta, canvasH) {
    this.scrollPos += scrollDelta;
    this.nextY -= scrollDelta;

    // Move obstacles down
    this.obstacles.forEach(o => {
      o.ys += scrollDelta;
      if (o.type === 'vehicle') {
        // vehicle drives forward, so we subtract some delta from its screen progression
        o.ys -= 180 * (scrollDelta / 500); 
      }
      if (o.type === 'laser') {
        o.timer = (o.timer || 0) + (scrollDelta / 500);
        o.active = (Math.sin(o.timer * 6) > 0);
      }
    });

    // Moving barrier logic
    this.obstacles.forEach(o => {
      if (o.moving) {
        o.mx = (o.mx || ROAD_X) + (o.mvx || 60) * (scrollDelta / 160);
        if (o.mx > ROAD_X + ROAD_W - o.w) o.mvx = -(Math.abs(o.mvx || 60));
        if (o.mx < ROAD_X) o.mvx = Math.abs(o.mvx || 60);
      }
    });

    // Cull off-screen
    this.obstacles = this.obstacles.filter(o => o.ys < canvasH + 120);

    // Spawn new ones
    while (this.nextY < 0) {
      this._spawnNext(canvasH);
    }
  }

  _spawnNext(canvasH) {
    const sec  = SECTIONS[this._section % SECTIONS.length];
    const diffMult = [1.0, 0.8, 0.62][this.diff];
    const gap  = rand(sec.minGap, sec.maxGap) * diffMult;

    const type = pick(sec.types);
    const obs  = this._buildObs(type);
    obs.ys     = this.nextY;
    this.obstacles.push(obs);

    this.nextY       += gap;
    this._sectionDist += gap;

    if (this._sectionDist > 1200 + this.diff * 200) {
      this._section++;
      this._sectionDist = 0;
    }
  }

  _buildObs(type) {
    if (type === 'vehicle') {
      const lane = randInt(0, 4);
      return { type:'vehicle', ys:0, lane, x:laneX(lane)-CAR_W/2, w:CAR_W, h:CAR_H+10, hit:false };
    }
    if (type === 'shield') {
      const lane = randInt(0, 4);
      return { type:'shield', ys:0, lane, x:laneX(lane)-20, w:40, h:40, hit:false };
    }
    if (type === 'laser') {
      return { type:'laser', ys:0, x:ROAD_X, w:ROAD_W, h:18, hit:false, timer:0, active:true };
    }
    if (type === 'pit') {
      return {
        type:'pit', ys:0,
        x: ROAD_X + 8, w: ROAD_W - 16, h: 30,
        hit: false
      };
    }
    if (type === 'boost') {
      const lane = randInt(0, 4);
      return { type:'boost', ys:0, lane, x:laneX(lane)-40, w:80, h:38, hit:false };
    }
    if (type === 'slow') {
      const lane = randInt(0,3);
      return { type:'slow', ys:0, lane, x:ROAD_X+lane*LANE_W, w:LANE_W*2, h:44, hit:false };
    }
    if (type === 'barrier') {
      const numLanes = 3 + this.diff;
      const startL = randInt(0, LANE_COUNT - numLanes);
      return {
        type:'barrier', ys:0, moving:true,
        mx:ROAD_X, mvx: 65 + this.diff * 25,
        x:ROAD_X, w:16, h:62, hit:false
      };
    }
    if (type === 'debris') {
      const lane = randInt(0,4);
      return { type:'debris', ys:0, lane, x:laneX(lane)-14, w:28, h:28, hit:false };
    }
    // default: block
    const pool    = [
      [randInt(0,4)],
      [pick([[0,1],[1,2],[2,3],[3,4]])].flat(),
    ];
    const lanes   = pick(pool).flat ? pick(pool) : pool[0];
    const laneset = Array.isArray(lanes) ? lanes : [lanes];
    const leftLane = Math.min(...laneset);
    const rightLane= Math.max(...laneset);
    return {
      type:'block', ys:0,
      x: laneX(leftLane) - CAR_W/2 - 4,
      w: (rightLane - leftLane) * LANE_W + CAR_W + 8,
      h: 54,
      hit: false,
      lanes: laneset,
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════
class RacerPlayer {
  constructor(id, controls, color, mode, diff) {
    this.id       = id;
    this.ctrl     = controls;
    this.color    = color;
    this.name     = P_NAMES[id];
    this.mode     = mode;
    this.diff     = diff;

    this.lane     = 2;            // centre lane
    this.targetLane = 2;
    this.x        = laneToCar(2);
    this.groundY  = 0;            // set on first draw
    this.y        = 0;
    this.vy       = 0;
    this.airborne = false;
    this.jumping  = false;

    this.score    = 0;
    this.distance = 0;
    this.finished = false;
    this.lives    = (mode === 'survival') ? 3 : 99;
    this.stunTimer= 0;
    this.boostTimer=0;
    this.slowTimer= 0;
    this.shieldTimer=0;
    this.nearMissTimer = 0;

    this.squashY  = 1.0;        // landing squash
    this.squashX  = 1.0;
    this.shakeX   = 0;
    this.flashTimer=0;
    this.flashColor='#fff';

    this.trail    = [];
    this.sparks   = [];
    this.exhaust  = [];

    this._prevInputLeft  = false;
    this._prevInputRight = false;
    this._prevInputJump  = false;
    this._laneChangeCd   = 0;

    this.completedRace = false;
    this.finishTime    = null;
  }

  update(dt, keys, scrollSpeed, viewH) {
    if (this.finished) return;
    if (!this.groundY) this.groundY = viewH - 110;
    if (!this.y) this.y = this.groundY;

    const left  = !!keys[this.ctrl.left];
    const right = !!keys[this.ctrl.right];
    const jump  = !!keys[this.ctrl.jump];

    this._laneChangeCd = Math.max(0, this._laneChangeCd - dt);

    // ── Stun ──
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      // wobble while stunned
      this.shakeX = Math.sin(this.stunTimer * 40) * 18;
    } else {
      this.shakeX = 0;
    }

    const canAct = this.stunTimer <= 0;

    // ── Lane movement ──
    if (canAct && this._laneChangeCd <= 0) {
      if (left && !this._prevInputLeft && this.targetLane > 0) {
        this.targetLane--;
        this._laneChangeCd = 0.14;
        Sfx.blip();
      }
      if (right && !this._prevInputRight && this.targetLane < LANE_COUNT-1) {
        this.targetLane++;
        this._laneChangeCd = 0.14;
        Sfx.blip();
      }
    }
    this._prevInputLeft  = left;
    this._prevInputRight = right;

    // Smooth lane snap
    const targetX = laneToCar(this.targetLane);
    this.x = lerp(this.x, targetX, Math.min(1, LANE_SNAP_SPD * dt));

    // ── Jumping ──
    if (canAct && jump && !this._prevInputJump && !this.airborne) {
      this.vy = JUMP_VY;
      this.airborne = true;
      Sfx.jump();
    }
    this._prevInputJump = jump;

    if (this.airborne) {
      this.vy += GRAVITY_VAL * dt;
      this.y  += this.vy * dt;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.airborne = false;
        this.squashY  = 0.62;
        this.squashX  = 1.45;
        Sfx.land();
      }
    }

    // Squash recovery
    this.squashY = lerp(this.squashY, 1.0, Math.min(1, 12 * dt));
    this.squashX = lerp(this.squashX, 1.0, Math.min(1, 12 * dt));

    // Timers
    this.boostTimer  = Math.max(0, this.boostTimer  - dt);
    this.slowTimer   = Math.max(0, this.slowTimer   - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.flashTimer  = Math.max(0, this.flashTimer  - dt);
    this.nearMissTimer= Math.max(0, this.nearMissTimer - dt);

    // Distance
    let spd = scrollSpeed;
    if (this.boostTimer > 0) spd *= 1.45;
    if (this.slowTimer  > 0) spd *= 0.52;
    this.distance += spd * dt;
    this.score    += spd * dt * 0.08;

    // Exhaust particles
    if (Math.random() < 0.4) {
      this.exhaust.push({
        x: this.x + CAR_W/2 + rand(-8,8),
        y: this.y + CAR_H + rand(0,4),
        vx: rand(-15,15), vy: rand(18,50),
        life: rand(0.25, 0.55),
        r: rand(3,7),
        color: this.boostTimer > 0 ? '#ff9244' : '#88aacc',
      });
    }
    this.exhaust = this.exhaust.filter(e => {
      e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt; return e.life > 0;
    });

    // Trail
    this.trail.push({ x: this.x + CAR_W/2, y: this.y + CAR_H });
    if (this.trail.length > 40) this.trail.shift();

    // Cooling sparks
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 800*dt; s.life -= dt; return s.life > 0;
    });
  }

  emitSparks(n, cx, cy, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(60, 280);
      this.sparks.push({ x:cx, y:cy, vx:Math.cos(a)*v, vy:Math.sin(a)*v - 100, life:rand(0.4,1.1), color });
    }
  }

  stun() {
    this.stunTimer = STUN_DUR;
    this.flashTimer= 0.4;
    this.flashColor= '#ff4d4d';
    Sfx.crash();
  }

  hit(type, x, y) {
    if (type === 'shield') {
      this.shieldTimer = 6.0;
      this.flashTimer= 0.3;
      this.flashColor= '#aaddff';
      Sfx.shield();
      return false;
    }
    if (this.shieldTimer > 0 && type !== 'boost' && type !== 'slow') { 
      this.shieldTimer = 0; // shield breaks on hit
      Sfx.shield(); 
      this.emitSparks(30, x, y, '#aaddff');
      return false; 
    }
    if (type === 'boost') {
      this.boostTimer = 2.2;
      this.flashTimer = 0.25;
      this.flashColor = '#ffd060';
      this.score += 150;
      this.emitSparks(18, x, y, '#ffd060');
      Sfx.boost();
      return false;
    }
    if (type === 'slow') {
      this.slowTimer = 2.5;
      this.flashTimer= 0.3;
      this.flashColor= '#5599ff';
      return false;
    }
    if (type === 'pit' && !this.airborne) {
      this.stun();
      this.emitSparks(25, x, y, this.color);
      return true;
    }
    if (type === 'block' || type === 'barrier' || type === 'debris' || type === 'vehicle' || type === 'laser') {
      if (this.airborne && type !== 'laser' && type !== 'vehicle') { Sfx.nearmiss(); return false; } // cleared it!
      this.stun();
      this.emitSparks(22, x, y, this.color);
      return true;
    }
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════
class LaneBlitz {
  constructor() {
    this.canvas  = document.getElementById('raceCanvas');
    this.ctx     = this.canvas.getContext('2d');
    this.keys    = {};
    this.state   = 'setup';
    this.lastTs  = 0;
    this._shake  = 0;
    this._globalTime = 0;

    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
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
    // Mode selector
    document.querySelectorAll('.mode-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.mode-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        // show/hide P2 hint
        const mode = el.querySelector('input').value;
        document.querySelector('.ctrl-divider').style.opacity = mode === 'solo' ? '0.2' : '1';
        document.querySelector('.p2-ctrl').style.opacity = mode === 'solo' ? '0.3' : '1';
      });
    });

    // Difficulty selector
    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
      });
    });

    document.getElementById('startRaceBtn').addEventListener('click', () => this._startRace());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _readSettings() {
    const modeEl = document.querySelector('input[name="mode"]:checked');
    const diffEl = document.querySelector('input[name="diff"]:checked');
    this.mode    = modeEl ? modeEl.value : 'versus';
    const diffStr= diffEl ? diffEl.value : 'medium';
    this.diff    = { easy:0, medium:1, hard:2 }[diffStr] ?? 1;
    this.isSolo  = this.mode === 'solo';
  }

  _startRace() {
    this._readSettings();
    Sfx._r();

    document.getElementById('raceSetup').style.display   = 'none';
    document.getElementById('raceResults').style.display = 'none';

    // Player controls
    const CTRL_P1 = { left:'ArrowLeft', right:'ArrowRight', jump:'ArrowUp' };
    const CTRL_P2 = { left:'KeyA', right:'KeyD', jump:'KeyW' };

    this.scrollSpeed = SCROLL_BASE * [1.0, 1.0, 1.15][this.diff];
    this.raceTimer   = 0;
    this.raceFinished= false;
    this._cdCount    = 3;
    this._cdTimer    = 1.0;
    this._cdPhase    = 'num';
    this._floatTexts = [];

    // Create sequencers (shared pattern, seeded differently visually but same logic for fairness)
    this.seq1 = new ObstacleSequencer(this.diff);
    this.seq2 = new ObstacleSequencer(this.diff);
    // Mirror same seed by copying obstacles at gen time
    this._syncSequencers = true;

    this.p1 = new RacerPlayer(0, CTRL_P1, P_COLORS[0], this.mode, this.diff);
    this.p2 = this.isSolo ? null : new RacerPlayer(1, CTRL_P2, P_COLORS[1], this.mode, this.diff);

    this.state = 'countdown';
    Sfx.countdown();
  }

  _goSetup() {
    document.getElementById('raceSetup').style.display   = '';
    document.getElementById('raceResults').style.display = 'none';
    this.state = 'setup';
  }

  // ─── MAIN LOOP ────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this._globalTime += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _update(dt) {
    if (this.state === 'setup') return;
    if (this.state === 'results') return;

    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        if (this._cdPhase === 'num') {
          this._cdCount--;
          if (this._cdCount > 0) { Sfx.countdown(); this._cdTimer = 1.0; }
          else { this._cdPhase = 'go'; this._cdTimer = 0.85; Sfx.go(); }
        } else {
          this.state = 'racing';
        }
      }
      return;
    }

    if (this.state === 'racing') {
      this.raceTimer += dt;

      // Ramp speed
      this.scrollSpeed = Math.min(
        SCROLL_MAX * [0.78, 1.0, 1.28][this.diff],
        this.scrollSpeed + SCROLL_ACCEL * dt
      );

      // Sync: make seq2 obstacles mirror seq1
      if (this._syncSequencers) {
        // Both sequencers advance together so both see same patterns
        this.seq1.update(this.scrollSpeed * dt, this.H);
        // Deep copy seq1 obstacles to seq2 (same positions, so it's fair)
        this.seq2.obstacles = this.seq1.obstacles.map(o => ({ ...o }));
        this.seq2.nextY     = this.seq1.nextY;
      }

      // Update players
      [this.p1, this.p2].forEach(p => {
        if (p) p.update(dt, this.keys, this.scrollSpeed, this.H);
      });

      // Collision detection for each player vs their own obstacle stream
      this._checkCollisions(this.p1, this.seq1.obstacles);
      if (this.p2) this._checkCollisions(this.p2, this.seq2.obstacles);

      // Float text updates
      this._floatTexts = this._floatTexts.filter(f => {
        f.y -= 55 * dt; f.life -= dt; return f.life > 0;
      });

      // Shake decay
      this._shake *= Math.pow(0.75, dt * 60);
      if (this._shake < 0.2) this._shake = 0;

      // Check finish
      if (!this.raceFinished) {
        const p1done = this.p1.distance >= TOTAL_DIST;
        const p2done = this.p2 ? this.p2.distance >= TOTAL_DIST : true;
        if (p1done && !this.p1.finished) { this.p1.finished = true; this.p1.finishTime = this.raceTimer; }
        if (this.p2 && p2done && !this.p2.finished) { this.p2.finished = true; this.p2.finishTime = this.raceTimer; }
        if ((p1done && p2done) || (p1done && this.isSolo)) {
          this.raceFinished = true;
          setTimeout(() => this._endRace(), 1800);
        }
      }

      // Survival: lives depleted
      if (this.mode === 'survival') {
        if (this.p1.lives <= 0 || (this.p2 && this.p2.lives <= 0)) {
          if (!this.raceFinished) { this.raceFinished = true; setTimeout(() => this._endRace(), 1400); }
        }
      }
    }
  }

  _checkCollisions(player, obstacles) {
    if (!player || player.stunTimer > 0.6) return;

    const pLeft  = player.x;
    const pRight = player.x + CAR_W;
    const pTop   = player.y;
    const pBot   = player.y + CAR_H;

    for (const obs of obstacles) {
      if (obs.hit === player.id || (Array.isArray(obs.hit) && obs.hit.includes(player.id))) continue;

      const ox = obs.moving ? obs.mx : obs.x;
      // Obstacle spans from ys to ys+h, positioned near bottom third of screen for readability
      // Map ys to viewport: obstacles enter from top, exit at bottom
      const oy  = obs.ys;
      const ox2 = ox + obs.w;
      const oy2 = oy + obs.h;

      // AABB check (only when player on ground for blocks, or always for pit)
      if (pRight <= ox || pLeft >= ox2) continue;
      if (pBot  <= oy || pTop >= oy2) continue;

      // Boost/slow/shield check: only fires once per pass
      if (obs.type === 'boost' || obs.type === 'slow' || obs.type === 'shield') {
        obs.hit = player.id;
        player.hit(obs.type, ox + obs.w/2, oy + obs.h/2);
        if (obs.type === 'shield') this._addFloat('🛡️ SHIELD!', ox + obs.w/2, oy, '#aaddff');
        else this._addFloat(obs.type === 'boost' ? '🚀 BOOST!' : '🐢 SLOW!', ox + obs.w/2, oy, obs.type === 'boost' ? '#ffd060' : '#5599ff');
        continue;
      }
      
      // Laser active check
      if (obs.type === 'laser' && !obs.active) continue;

      // Damaging types
      const wasHit = player.hit(obs.type, ox + obs.w/2, oy + obs.h/2);
      if (wasHit) {
        if (!Array.isArray(obs.hit)) obs.hit = [];
        obs.hit.push(player.id);
        this._shake = Math.min(SHAKE_MAX, this._shake + 10);
        if (this.mode === 'survival') player.lives = Math.max(0, player.lives - 1);
        this._addFloat('💥 CRASH!', ox + obs.w/2, oy, '#ff4d6d');
      }
    }
  }

  _addFloat(text, x, y, color) {
    this._floatTexts.push({ text, x, y, color, life: 1.4 });
  }

  _endRace() {
    this.state = 'results';
    const el = document.getElementById('raceResults');
    el.style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    let winner = null, loser = null;

    if (this.isSolo) {
      const el2 = document.getElementById('resultsIcon');
      el2.textContent = '⏱️';
      document.getElementById('resultsTitle').textContent = 'Time Trial Result';
      const entry = document.createElement('div');
      entry.className = 'result-entry';
      entry.innerHTML = `
        <span class="result-pos">🌟</span>
        <span class="result-swatch" style="background:${this.p1.color}"></span>
        <span class="result-name">${this.p1.name}</span>
        <span class="result-time">${this._fmt(this.p1.finishTime || this.raceTimer)}</span>`;
      list.appendChild(entry);
    } else {
      // Determine winner
      if (this.mode === 'survival') {
        // Whoever has more lives wins, or whoever survived longer
        const p1alive = this.p1.lives > 0;
        const p2alive = this.p2 ? this.p2.lives > 0 : false;
        if (p1alive && !p2alive) winner = this.p1;
        else if (!p1alive && p2alive) winner = this.p2;
        else { // both alive or both dead: by distance
          winner = this.p1.distance >= (this.p2?.distance ?? 0) ? this.p1 : this.p2;
        }
      } else {
        // Versus: finish time or distance
        if (this.p1.finishTime && this.p2?.finishTime) {
          winner = this.p1.finishTime <= this.p2.finishTime ? this.p1 : this.p2;
        } else if (this.p1.finishTime) { winner = this.p1; }
        else if (this.p2?.finishTime)  { winner = this.p2; }
        else { winner = this.p1.distance >= (this.p2?.distance ?? 0) ? this.p1 : this.p2; }
      }
      loser = winner === this.p1 ? this.p2 : this.p1;

      document.getElementById('resultsIcon').textContent = '🏆';
      document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;

      [winner, loser].forEach((p, i) => {
        if (!p) return;
        const e = document.createElement('div');
        e.className = 'result-entry';
        const dist = Math.floor(p.distance);
        e.innerHTML = `
          <span class="result-pos">${i===0?'🥇':'🥈'} ${i===0?'1st':'2nd'}</span>
          <span class="result-swatch" style="background:${p.color}"></span>
          <span class="result-name">${p.name}</span>
          <span class="result-time">${p.finishTime ? this._fmt(p.finishTime) : dist+'m'}</span>`;
        list.appendChild(e);
      });

      if (winner === this.p1) Sfx.win(); else Sfx.lose();
    }
  }

  _fmt(t) {
    if (!t) return '--:--.--';
    const m = Math.floor(t/60);
    const s = (t%60).toFixed(2).padStart(5,'0');
    return `${m}:${s}`;
  }

  // ═══════════════════════════════════════════════════════════
  //  DRAWING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();

    if (this._shake > 0.2) {
      ctx.translate((Math.random()-0.5)*this._shake, (Math.random()-0.5)*this._shake);
    }

    ctx.clearRect(-20,-20, this.W+40, this.H+40);

    if (this.state === 'setup' || this.state === 'results') {
      this._drawMenuBg(ctx);
      ctx.restore();
      return;
    }

    const W = this.W, H = this.H;

    if (!this.isSolo) {
      // Split screen: P1 left, P2 right
      const vpW = W / 2;

      // Draw left viewport
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, vpW, H); ctx.clip();
      this._drawViewport(ctx, this.p1, this.seq1.obstacles, 0, 0, vpW, H);
      ctx.restore();

      // Draw right viewport
      ctx.save();
      ctx.beginPath(); ctx.rect(vpW, 0, vpW, H); ctx.clip();
      ctx.translate(vpW, 0);
      this._drawViewport(ctx, this.p2, this.seq2.obstacles, 0, 0, vpW, H);
      ctx.restore();

      // Center divider
      const grad = ctx.createLinearGradient(vpW-3,0,vpW+3,0);
      grad.addColorStop(0,   'rgba(255,255,255,0.01)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1,   'rgba(255,255,255,0.01)');
      ctx.fillStyle = grad;
      ctx.fillRect(vpW-3, 0, 6, H);

      // VS badge at center
      if (this.state === 'countdown' || this.state === 'racing') {
        ctx.save();
        ctx.fillStyle = 'rgba(4,10,24,0.88)';
        this._rRect(ctx, vpW-22, H/2-22, 44, 44, 12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 13px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VS', vpW, H/2);
        ctx.restore();
      }
    } else {
      // Solo: full screen
      this._drawViewport(ctx, this.p1, this.seq1.obstacles, 0, 0, W, H);
    }

    // Countdown overlay
    if (this.state === 'countdown') this._drawCountdown(ctx);

    ctx.restore();
  }

  _drawMenuBg(ctx) {
    const t = this._globalTime;
    const W = this.W, H = this.H;

    // Deep space gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05000e');
    g.addColorStop(0.55, '#0d0025');
    g.addColorStop(1, '#1a0040');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.save();
    for (let i = 0; i < 120; i++) {
      const sx = (i * 197 + 13) % W;
      const sy = (i * 113 + 7) % (H * 0.7);
      const br = 0.4 + 0.6 * Math.sin(t * 1.2 + i * 0.8);
      ctx.globalAlpha = br * 0.7;
      ctx.fillStyle = i % 3 === 0 ? '#c0a0ff' : i % 3 === 1 ? '#00eeff' : '#fff';
      const sz = i % 5 === 0 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.restore();

    // Retro synthwave sun
    const sunX = W / 2, sunY = H * 0.55;
    const sunR = Math.min(W, H) * 0.28;
    const sunG = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR);
    sunG.addColorStop(0, '#ffbb44');
    sunG.addColorStop(0.4, '#ff4488');
    sunG.addColorStop(0.75, '#8800cc');
    sunG.addColorStop(1, 'transparent');
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunG;
    ctx.fill();
    // Horizontal stripe cutouts
    ctx.globalCompositeOperation = 'destination-out';
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const progress = i / stripes;
      const stripY = sunY + progress * sunR * 0.9;
      const halfW = Math.sqrt(Math.max(0, sunR * sunR - (stripY - sunY) ** 2));
      const stripeH = sunR / (stripes * 1.4) * (0.6 + progress * 0.8);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(sunX - halfW, stripY, halfW * 2, stripeH);
    }
    ctx.restore();

    // Scrolling neon grid floor
    const gridY = H * 0.56;
    const scrollOff = (t * 60) % 80;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, gridY, W, H - gridY);
    ctx.clip();
    // Floor gradient
    const fg = ctx.createLinearGradient(0, gridY, 0, H);
    fg.addColorStop(0, '#1a0040');
    fg.addColorStop(1, '#05000e');
    ctx.fillStyle = fg;
    ctx.fillRect(0, gridY, W, H - gridY);
    // Grid lines - horizontal (perspective)
    ctx.lineWidth = 1;
    for (let row = 0; row < 14; row++) {
      const p = (row + scrollOff / 80) / 13;
      const gy = gridY + (H - gridY) * (p * p);
      const alpha = 0.08 + p * 0.35;
      ctx.strokeStyle = `rgba(180,80,255,${alpha})`;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    // Grid lines - vertical (perspective)
    const vLines = 16;
    for (let col = 0; col <= vLines; col++) {
      const t0 = col / vLines;
      const alpha = 0.08 + Math.abs(t0 - 0.5) * 0.25;
      ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
      ctx.beginPath();
      ctx.moveTo(W * t0, gridY);
      ctx.lineTo(W * (0.5 + (t0 - 0.5) * 4), H);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Single viewport render ─────────────────────────────────
  _drawViewport(ctx, player, obstacles, vx, vy, vw, vh) {
    const t = this._globalTime;
    const isBoosting = player && player.boostTimer > 0;

    // ── Synthwave Sky ──
    const sky = ctx.createLinearGradient(vx, vy, vx, vy + vh * 0.55);
    sky.addColorStop(0, isBoosting ? '#1a0005' : '#05000e');
    sky.addColorStop(0.5, isBoosting ? '#2a0020' : '#0d0025');
    sky.addColorStop(1, '#1a0040');
    ctx.fillStyle = sky;
    ctx.fillRect(vx, vy, vw, vh);

    // Stars
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const sx = vx + ((i * 197 + 13) % vw);
      const sy = vy + ((i * 113 + 7) % (vh * 0.45));
      const br = 0.4 + 0.6 * Math.sin(t * 1.1 + i * 0.77);
      ctx.globalAlpha = br * 0.65;
      ctx.fillStyle = i % 4 === 0 ? '#c0a0ff' : i % 4 === 1 ? '#00eeff' : i % 4 === 2 ? '#ff80c0' : '#fff';
      ctx.fillRect(sx, sy, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
    ctx.restore();

    // Retro sun
    const sunX = vx + vw / 2;
    const sunY = vy + vh * 0.44;
    const sunR = vh * 0.18;
    const sunG = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR);
    sunG.addColorStop(0, isBoosting ? '#ff8800' : '#ffcc44');
    sunG.addColorStop(0.45, isBoosting ? '#ff2200' : '#ff4488');
    sunG.addColorStop(0.8, isBoosting ? '#660000' : '#7700aa');
    sunG.addColorStop(1, 'transparent');
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunG;
    ctx.fill();
    // Horizontal stripe mask
    ctx.globalCompositeOperation = 'destination-out';
    const stripes = 7;
    for (let i = 0; i < stripes; i++) {
      const p = i / stripes;
      const stripY = sunY + p * sunR * 0.88;
      const hW = Math.sqrt(Math.max(0, sunR * sunR - (stripY - sunY) ** 2));
      const strH = sunR / (stripes * 1.3) * (0.5 + p * 0.9);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(sunX - hW, stripY, hW * 2, strH);
    }
    ctx.restore();

    // Horizon glow
    const horizonY = vy + vh * 0.52;
    const hg = ctx.createLinearGradient(vx, horizonY - 40, vx, horizonY + 80);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.4, isBoosting ? 'rgba(255,60,0,0.18)' : 'rgba(180,0,255,0.18)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(vx, horizonY - 40, vw, 120);

    // ── Neon Grid Ground (outside road) ──
    const roadL = vx + (vw - ROAD_W) / 2;
    const roadR = roadL + ROAD_W;
    const gridY = horizonY;
    const sideW = Math.max(0, roadL - vx);

    // Draw neon grid on left and right sides
    ['left', 'right'].forEach(side => {
      const gx = side === 'left' ? vx : roadR + 12;
      const gw = side === 'left' ? (roadL - 12 - vx) : (vx + vw - roadR - 12);
      if (gw <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(gx, gridY, gw, vh - gridY + vy);
      ctx.clip();
      // Floor fill
      const gfl = ctx.createLinearGradient(0, gridY, 0, vy + vh);
      gfl.addColorStop(0, '#1a0040');
      gfl.addColorStop(1, '#05000e');
      ctx.fillStyle = gfl;
      ctx.fillRect(gx, gridY, gw, vh);
      const scrollOff = (t * this.scrollSpeed * 0.15) % 80;
      // Horizontal grid lines
      for (let row = 0; row < 16; row++) {
        const p = (row + scrollOff / 80) / 15;
        const gy = gridY + (vy + vh - gridY) * (p * p);
        const alpha = 0.05 + p * 0.4;
        ctx.strokeStyle = `rgba(180,80,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke();
      }
      // Vertical perspective lines
      const vp = side === 'left' ? roadL : roadR; // vanishing point x
      const vLines = 6;
      for (let col = 0; col <= vLines; col++) {
        const bx = gx + (gw / vLines) * col;
        const alpha = 0.07 + (col / vLines) * 0.2;
        ctx.strokeStyle = `rgba(0,220,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vp, gridY);
        ctx.lineTo(bx, vy + vh);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Speed lines when boosting
    if (isBoosting) {
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 20);
      for (let i = 0; i < 12; i++) {
        const lx = vx + (i / 12) * vw;
        const len = 30 + Math.random() * 80;
        ctx.strokeStyle = i % 2 === 0 ? '#ff2d78' : '#00f0ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, vy + Math.random() * vh);
        ctx.lineTo(lx, vy + Math.random() * vh + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Road surface ──
    const rg = ctx.createLinearGradient(roadL, 0, roadR, 0);
    rg.addColorStop(0, '#0a0020');
    rg.addColorStop(0.15, '#130035');
    rg.addColorStop(0.5, '#160040');
    rg.addColorStop(0.85, '#130035');
    rg.addColorStop(1, '#0a0020');
    ctx.fillStyle = rg;
    ctx.fillRect(roadL, vy, ROAD_W, vh);

    // Road edge neon lines
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = NEON_EDGE;
    ctx.strokeStyle = NEON_EDGE;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(roadL, vy); ctx.lineTo(roadL, vy + vh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(roadR, vy); ctx.lineTo(roadR, vy + vh); ctx.stroke();
    ctx.restore();

    // Lane dashes (neon cyan)
    const dashH = 44, dashGap = 28;
    const dashOff = (this.scrollSpeed * t * 0.75) % (dashH + dashGap);
    ctx.setLineDash([dashH, dashGap]);
    ctx.lineDashOffset = -dashOff;
    ctx.save();
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,220,255,0.5)';
    ctx.strokeStyle = 'rgba(0,220,255,0.2)';
    ctx.lineWidth = 2;
    for (let l = 1; l < LANE_COUNT; l++) {
      const lx = roadL + l * LANE_W;
      ctx.beginPath(); ctx.moveTo(lx, vy); ctx.lineTo(lx, vy + vh); ctx.stroke();
    }
    ctx.restore();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Curbs — neon pink/white alternating
    const curbW = 12;
    const curbH = 16;
    const curbOff = (this.scrollSpeed * t * 0.75) % (curbH * 2);
    for (let cy = vy - curbH * 2 + curbOff; cy < vy + vh + curbH; cy += curbH) {
      const even = Math.floor((cy - curbOff) / curbH) % 2 === 0;
      ctx.fillStyle = even ? '#ff2d78' : '#fff';
      ctx.fillRect(roadL - curbW, cy, curbW, curbH);
      ctx.fillRect(roadR, cy, curbW, curbH);
    }

    // City silhouette on horizon
    this._drawCityline(ctx, vx, vy, vw, vh, roadL, roadR);

    // ── Obstacles ──
    for (const obs of obstacles) {
      this._drawObstacle(ctx, obs, roadL, vy, vw, vh);
    }

    // Progress bar
    if (player) this._drawProgressBar(ctx, player, vx, vy, vw, vh);

    // ── Player vehicle ──
    if (player) {
      // Exhaust particles
      player.exhaust.forEach(e => {
        ctx.save();
        ctx.globalAlpha = e.life * 0.5;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(roadL + e.x, player.y + (e.y - player.y) + vy + vh - 130, e.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });

      // Trail
      const clr = player.color;
      const trailY0 = vy + vh - 130 + CAR_H;
      const trailBaseX = roadL;
      for (let i = 1; i < player.trail.length; i++) {
        const a = (i / player.trail.length) * 0.22;
        ctx.strokeStyle = clr.replace(')', `,${a})`).replace('rgb','rgba');
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(roadL + player.trail[i-1].x, vy+vh-130 + CAR_H);
        ctx.lineTo(roadL + player.trail[i].x, vy+vh-130 + CAR_H);
        ctx.stroke();
      }

      // Sparks
      player.sparks.forEach(s => {
        ctx.save();
        ctx.globalAlpha = clamp(s.life, 0, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(roadL + s.x, vy+vh-130 + s.y - (player.groundY - CAR_H/2), 3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });

      this._drawCar(ctx, player, roadL, vy, vw, vh);

      // Player HUD panel
      this._drawPlayerHUD(ctx, player, vx, vy, vw, vh);



      // Float texts
      for (const f of this._floatTexts) {
        const fx = roadL + (ROAD_W/2);
        ctx.save();
        ctx.globalAlpha = clamp(f.life, 0, 1);
        ctx.font = 'bold 22px Outfit,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 4;
        ctx.strokeText(f.text, fx, f.y + vy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, fx, f.y + vy);
        ctx.restore();
      }

      // Flash overlay
      if (player.flashTimer > 0) {
        ctx.save();
        ctx.globalAlpha = (player.flashTimer / 0.4) * 0.22;
        ctx.fillStyle = player.flashColor;
        ctx.fillRect(vx, vy, vw, vh);
        ctx.restore();
      }

      // Stun overlay
      if (player.stunTimer > 0.3) {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(vx, vy, vw, vh);
        ctx.restore();
        // Stars spinning above car
        const carScreenX = roadL + player.x + CAR_W/2;
        const carScreenY = vy + vh - 130;
        for (let s = 0; s < 4; s++) {
          const sa = this._globalTime * 4 + s * Math.PI / 2;
          const sr = 28;
          ctx.save();
          ctx.font = '16px sans-serif';
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText('⭐', carScreenX + Math.cos(sa)*sr, carScreenY - 20 + Math.sin(sa)*10);
          ctx.restore();
        }
      }

      // FINISH banner per-player
      if (player.finished && player.finishTime) {
        ctx.save();
        ctx.fillStyle='rgba(0,0,0,0.6)';
        this._rRect(ctx, vx+vw/2-100, vy+vh/2-30, 200, 60, 18);
        ctx.fill();
        ctx.font='bold 26px Outfit,sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='#ffd060';
        ctx.fillText('✓ FINISHED!', vx+vw/2, vy+vh/2);
        ctx.restore();
      }
    }
  }

  _drawCityline(ctx, vx, vy, vw, vh, roadL, roadR) {
    const t = this._globalTime;
    // Draw neon city silhouette on horizon
    const hY = vy + vh * 0.51;
    const colors = ['#b44fff', '#00f0ff', '#ff2d78', '#8800cc', '#0088ff'];
    ctx.save();
    const buildings = 18;
    for (let i = 0; i < buildings; i++) {
      const bx = vx + (i / buildings) * vw - 10;
      const bw = (vw / buildings) * 0.82;
      const bh = 25 + (i * 37 + 13) % 60;
      const by = hY - bh;
      // Building silhouette
      ctx.fillStyle = '#080015';
      ctx.fillRect(bx, by, bw, bh + 2);
      // Neon window lights
      const col = colors[i % colors.length];
      const winFlicker = 0.3 + 0.7 * (Math.sin(t * 1.5 + i * 2.1) > 0.5 ? 1 : 0);
      ctx.save();
      ctx.globalAlpha = winFlicker * 0.55;
      ctx.fillStyle = col;
      // Row of windows
      for (let wr = 0; wr < 3; wr++) {
        for (let wc = 0; wc < 2; wc++) {
          const wx = bx + 3 + wc * (bw / 2 - 2);
          const wy = by + 6 + wr * 10;
          if (wy + 4 < hY) ctx.fillRect(wx, wy, 5, 4);
        }
      }
      ctx.restore();
      // Antenna/rooftop neon
      if (i % 3 === 0) {
        ctx.save();
        ctx.shadowBlur = 8; ctx.shadowColor = col;
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bx + bw / 2, by); ctx.lineTo(bx + bw / 2, by - 10); ctx.stroke();
        ctx.fillStyle = col;
        ctx.fillRect(bx + bw / 2 - 2, by - 12, 4, 4);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _drawObstacle(ctx, obs, roadL, vy, vw, vh) {
    const ox = obs.moving ? obs.mx : obs.x;
    const oy = obs.ys + vy;

    if (oy > vy + vh + 80 || oy + obs.h < vy - 20) return;

    ctx.save();

    if (obs.type === 'boost') {
      // Glowing neon boost pad
      const cx = roadL + ox + obs.w / 2;
      const bg = ctx.createLinearGradient(roadL+ox, oy, roadL+ox+obs.w, oy+obs.h);
      bg.addColorStop(0, '#00ff88');
      bg.addColorStop(1, '#00cc66');
      ctx.fillStyle = bg;
      this._rRect(ctx, roadL + ox, oy, obs.w, obs.h, 6);
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 18; ctx.shadowColor = '#00ff88';
      ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
      this._rRect(ctx, roadL + ox, oy, obs.w, obs.h, 6);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Outfit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚡ BOOST', cx, oy + obs.h / 2);
    } else if (obs.type === 'slow') {
      // Purple slime/slow field
      const cx = roadL + ox + obs.w / 2;
      ctx.fillStyle = 'rgba(100,0,160,0.6)';
      this._rRect(ctx, roadL + ox, oy, obs.w, obs.h, 8);
      ctx.fill();
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = '#8800ff';
      ctx.strokeStyle = '#aa44ff'; ctx.lineWidth = 2;
      this._rRect(ctx, roadL + ox, oy, obs.w, obs.h, 8);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(200,160,255,0.9)';
      ctx.font = 'bold 13px Outfit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐢 SLOW', cx, oy + obs.h / 2);
    } else if (obs.type === 'pit') {
      // Glowing chasm
      ctx.fillStyle = '#000';
      ctx.fillRect(roadL + obs.x, oy, obs.w, obs.h + 8);
      // Cyan neon edges
      ctx.save();
      ctx.shadowBlur = 20; ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(roadL + obs.x, oy);
      ctx.lineTo(roadL + obs.x + obs.w, oy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(roadL + obs.x, oy + obs.h);
      ctx.lineTo(roadL + obs.x + obs.w, oy + obs.h);
      ctx.stroke();
      ctx.restore();
      // Warning text
      ctx.fillStyle = 'rgba(0,240,255,0.85)';
      ctx.font = 'bold 13px Outfit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲ JUMP!', roadL + obs.x + obs.w / 2, oy + obs.h / 2);
    } else if (obs.type === 'barrier') {
      const bx = roadL + obs.mx;
      // Neon electric barrier
      ctx.save();
      ctx.shadowBlur = 22; ctx.shadowColor = '#ff2d78';
      const bH = obs.h * 1.6;
      const bY = oy - obs.h * 0.3;
      // Striped neon core
      const stripes = 5;
      for (let i = 0; i < stripes; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,45,120,0.9)' : 'rgba(20,0,40,0.8)';
        ctx.fillRect(bx + (i / stripes) * obs.w, bY, obs.w / stripes + 1, bH);
      }
      ctx.strokeStyle = '#ff2d78'; ctx.lineWidth = 3;
      ctx.strokeRect(bx, bY, obs.w, bH);
      ctx.restore();
      // Electric sparks at top
      for (let s = 0; s < 3; s++) {
        const sx = bx + (s / 2) * obs.w;
        const flicker = 0.6 + 0.4 * Math.sin(this._globalTime * 22 + s * 1.7);
        ctx.save();
        ctx.globalAlpha = flicker;
        ctx.shadowBlur = 10; ctx.shadowColor = '#ff80c0';
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 1, bY - 6, 2, 6);
        ctx.restore();
      }
    } else if (obs.type === 'debris') {
      const dx = roadL + obs.x;
      // Neon-outlined debris chunks
      ctx.save();
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff8800';
      ctx.fillStyle = '#331100';
      this._rRect(ctx, dx, oy, obs.w, obs.h, 5);
      ctx.fill();
      ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 2;
      this._rRect(ctx, dx, oy, obs.w, obs.h, 5);
      ctx.stroke();
      ctx.restore();
      ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🪨', dx + obs.w / 2, oy + obs.h / 2);
    } else if (obs.type === 'vehicle') {
      // Rival neon car (coming toward player)
      const vxPos = roadL + obs.x;
      const wobble = Math.sin(this._globalTime * 4 + obs.x) * 2;
      ctx.save();
      ctx.translate(wobble, 0);
      // Body
      const vbg = ctx.createLinearGradient(vxPos, oy, vxPos + obs.w, oy + obs.h);
      vbg.addColorStop(0, '#1a0035');
      vbg.addColorStop(0.5, '#2a0055');
      vbg.addColorStop(1, '#1a0035');
      ctx.fillStyle = vbg;
      this._rRect(ctx, vxPos, oy, obs.w, obs.h, 6);
      ctx.fill();
      // Neon trim glow
      ctx.shadowBlur = 14; ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00c8ff'; ctx.lineWidth = 2;
      this._rRect(ctx, vxPos, oy, obs.w, obs.h, 6);
      ctx.stroke();
      // Windshield
      ctx.fillStyle = 'rgba(0,240,255,0.15)';
      ctx.fillRect(vxPos + 6, oy + 8, obs.w - 12, obs.h * 0.28);
      // Red glowing taillights (player sees back of rivals)
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(vxPos + 4, oy + obs.h - 8, 10, 5);
      ctx.fillRect(vxPos + obs.w - 14, oy + obs.h - 8, 10, 5);
      ctx.restore();
    } else if (obs.type === 'shield') {
      const sx = roadL + obs.x;
      ctx.save();
      ctx.shadowBlur = 24; ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = 'rgba(0,200,255,0.2)';
      ctx.beginPath(); ctx.arc(sx + obs.w / 2, oy + obs.h / 2, obs.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore();
      ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', sx + obs.w / 2, oy + obs.h / 2);
    } else if (obs.type === 'laser') {
      if (obs.active) {
        ctx.save();
        ctx.shadowBlur = 30; ctx.shadowColor = '#ff0055';
        ctx.fillStyle = 'rgba(255,0,85,0.3)';
        ctx.fillRect(roadL, oy - 2, ROAD_W, obs.h + 4);
        ctx.strokeStyle = '#ff0055'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(roadL, oy + obs.h / 2); ctx.lineTo(roadL + ROAD_W, oy + obs.h / 2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(roadL, oy + obs.h / 2); ctx.lineTo(roadL + ROAD_W, oy + obs.h / 2); ctx.stroke();
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(255,0,85,0.15)';
        ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
        ctx.beginPath(); ctx.moveTo(roadL, oy + obs.h / 2); ctx.lineTo(roadL + ROAD_W, oy + obs.h / 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      // Neon block barricade
      const bx = roadL + obs.x;
      ctx.save();
      ctx.shadowBlur = 20; ctx.shadowColor = '#ff2d78';
      const bG = ctx.createLinearGradient(bx, oy, bx, oy + obs.h);
      bG.addColorStop(0, '#2a0018');
      bG.addColorStop(0.5, '#400028');
      bG.addColorStop(1, '#2a0018');
      ctx.fillStyle = bG;
      this._rRect(ctx, bx, oy, obs.w, obs.h, 6);
      ctx.fill();
      // Neon glow edge
      ctx.strokeStyle = '#ff2d78'; ctx.lineWidth = 2.5;
      this._rRect(ctx, bx, oy, obs.w, obs.h, 6);
      ctx.stroke();
      // Internal highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,80,140,0.12)';
      ctx.fillRect(bx + 6, oy + 4, obs.w - 12, 6);
      ctx.restore();
      // Warning icon
      ctx.font = 'bold 11px Outfit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,150,180,0.8)';
      ctx.fillText('▌▌', bx + obs.w / 2, oy + obs.h / 2);
    }

    ctx.restore();
  }

  _drawCar(ctx, p, roadL, vy, vw, vh) {
    const carX = roadL + p.x + p.shakeX;
    const groundScreen = vy + vh - 130;
    const airborneRaise = p.y - p.groundY;
    const carY = groundScreen + airborneRaise;

    const W = CAR_W * p.squashX;
    const H = CAR_H * p.squashY;
    const ox = carX + CAR_W / 2 - W / 2;
    const oy = carY + CAR_H - H;

    // Bank angle when lane-changing
    const bankTarget = (p.targetLane - p.lane) * 0.22;
    p._bankAngle = p._bankAngle || 0;
    p._bankAngle += (bankTarget - p._bankAngle) * 0.18;
    const bank = p._bankAngle;

    ctx.save();
    ctx.translate(carX + CAR_W / 2, carY + CAR_H / 2);
    ctx.rotate(bank);
    ctx.translate(-(carX + CAR_W / 2), -(carY + CAR_H / 2));

    // Shadow on ground (stays at groundScreen regardless of air height)
    const shadowY = groundScreen + CAR_H - 4;
    const shadowScale = 1 - clamp(-airborneRaise / 200, 0, 0.6);
    ctx.save();
    ctx.globalAlpha = 0.5 * shadowScale;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.ellipse(carX + CAR_W / 2, shadowY, W / 2 * 0.9, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Neon glow aura
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = p.color;
    ctx.globalAlpha = 0.7;
    const glowG = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
    glowG.addColorStop(0, p.color);
    glowG.addColorStop(1, 'transparent');
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    this._rRect(ctx, ox - 1, oy - 1, W + 2, H + 2, 10);
    ctx.stroke();
    ctx.restore();

    // Car body — sleek wedge shape using paths
    ctx.save();
    const bodyG = ctx.createLinearGradient(ox, oy, ox, oy + H);
    bodyG.addColorStop(0, this._lighten(p.color, 40));
    bodyG.addColorStop(0.3, p.color);
    bodyG.addColorStop(1, this._darken(p.color, 60));
    ctx.fillStyle = bodyG;
    // Wedge-shaped body (narrow at front/top, wide at rear/bottom)
    ctx.beginPath();
    ctx.moveTo(ox + W * 0.15, oy);           // front-left top
    ctx.lineTo(ox + W * 0.85, oy);           // front-right top
    ctx.lineTo(ox + W, oy + H * 0.35);       // front-right mid
    ctx.lineTo(ox + W + 4, oy + H);          // rear-right bottom
    ctx.lineTo(ox - 4, oy + H);              // rear-left bottom
    ctx.lineTo(ox, oy + H * 0.35);           // front-left mid
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Cockpit / windshield
    const wg = ctx.createLinearGradient(ox + W * 0.15, oy, ox + W * 0.85, oy + H * 0.4);
    wg.addColorStop(0, 'rgba(220,255,255,0.85)');
    wg.addColorStop(1, 'rgba(100,200,255,0.4)');
    ctx.fillStyle = wg;
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(150,230,255,0.5)';
    ctx.beginPath();
    ctx.roundRect(ox + W * 0.14, oy + H * 0.08, W * 0.72, H * 0.3, 5);
    ctx.fill();
    ctx.restore();

    // Neon underglow stripe
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(ox + 4, oy + H - 4, W - 8, 3);
    ctx.restore();

    // Spoiler
    ctx.fillStyle = this._darken(p.color, 50);
    ctx.fillRect(ox + 2, oy + H * 0.78, W - 4, 5);
    ctx.fillRect(ox - 5, oy + H * 0.74, 5, 12);
    ctx.fillRect(ox + W, oy + H * 0.74, 5, 12);

    // Headlights (neon glow)
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = '#ffffaa';
    ctx.fillStyle = '#ffff88';
    ctx.fillRect(ox + 3, oy + 4, 10, 6);
    ctx.fillRect(ox + W - 13, oy + 4, 10, 6);
    ctx.restore();

    // Tail lights
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillRect(ox + 3, oy + H - 7, 10, 4);
    ctx.fillRect(ox + W - 13, oy + H - 7, 10, 4);
    ctx.restore();

    // Wheels
    const wheelColor = '#0a0015';
    const wheelRimColor = this._darken(p.color, 20);
    [[ox - 5, oy + H * 0.18], [ox + W - 1, oy + H * 0.18],
     [ox - 5, oy + H * 0.60], [ox + W - 1, oy + H * 0.60]].forEach(([wx, wy]) => {
      ctx.fillStyle = wheelColor;
      ctx.fillRect(wx, wy, 6, 16);
      ctx.fillStyle = wheelRimColor;
      ctx.fillRect(wx + 1, wy + 3, 4, 10);
    });

    // Player badge on car
    ctx.font = 'bold 10px Outfit,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('P' + (p.id + 1), carX + CAR_W / 2, carY + CAR_H * 0.55);

    ctx.restore(); // end bank rotation

    // Boost flame
    if (p.boostTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85 + Math.sin(this._globalTime * 22) * 0.15;
      ctx.shadowBlur = 24; ctx.shadowColor = '#ff8800';
      // Outer flame
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.moveTo(ox + W * 0.18, oy + H);
      ctx.lineTo(ox + W * 0.82, oy + H);
      ctx.lineTo(ox + W * 0.5, oy + H + 26 + Math.random() * 18);
      ctx.closePath();
      ctx.fill();
      // Inner flame
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.moveTo(ox + W * 0.32, oy + H);
      ctx.lineTo(ox + W * 0.68, oy + H);
      ctx.lineTo(ox + W * 0.5, oy + H + 14 + Math.random() * 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Shield bubble
    if (p.shieldTimer > 0) {
      ctx.save();
      const sa = 0.5 + 0.2 * Math.sin(this._globalTime * 12);
      ctx.globalAlpha = sa;
      ctx.shadowBlur = 30; ctx.shadowColor = '#00f0ff';
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(carX + CAR_W / 2, carY + CAR_H * 0.5, CAR_W * 0.9, CAR_H * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.07)';
      ctx.fill();
      ctx.restore();
    }
  }

  _lighten(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = clamp((n & 0xff) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  _drawPlayerHUD(ctx, p, vx, vy, vw, vh) {
    ctx.save();
    const cx = vx + vw / 2;
    const py = vy + 10;
    const panelW = 240, panelH = 54;

    // HUD glass panel
    ctx.fillStyle = 'rgba(5, 0, 20, 0.78)';
    this._rRect(ctx, cx - panelW / 2, py, panelW, panelH, 14);
    ctx.fill();
    // Neon border
    ctx.save();
    ctx.shadowBlur = 12; ctx.shadowColor = p.color;
    ctx.strokeStyle = p.color + '99';
    ctx.lineWidth = 1.5;
    this._rRect(ctx, cx - panelW / 2, py, panelW, panelH, 14);
    ctx.stroke();
    ctx.restore();

    // Player name with neon color
    ctx.font = 'bold 11px Outfit,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.fillText(p.name, cx - panelW / 2 + 12, py + 15);
    ctx.restore();

    // Score (gold)
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = '#ffd060';
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 15px Outfit,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(p.score).toLocaleString(), cx + panelW / 2 - 12, py + 15);
    ctx.restore();

    // Speed bar
    const spd = Math.round(this.scrollSpeed * (p.boostTimer > 0 ? 1.45 : p.slowTimer > 0 ? 0.52 : 1));
    const maxSpd = SCROLL_MAX * 1.45;
    const spdPct = clamp(spd / maxSpd, 0, 1);
    const barX = cx - panelW / 2 + 12;
    const barW = panelW - 24;
    const barH = 6;
    const barY = py + 34;
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    this._rRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();
    const speedG = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    speedG.addColorStop(0, p.color);
    speedG.addColorStop(0.6, '#ff8800');
    speedG.addColorStop(1, '#ff2200');
    ctx.fillStyle = speedG;
    this._rRect(ctx, barX, barY, barW * spdPct, barH, 3);
    ctx.fill();
    ctx.font = 'bold 9px Outfit,sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(180,200,255,0.5)';
    ctx.fillText(spd + ' km/h', barX, barY - 2);

    // Status badges
    const indicators = [];
    if (p.boostTimer > 0) indicators.push({ icon: '⚡', color: '#00ff88' });
    if (p.slowTimer  > 0) indicators.push({ icon: '🐢', color: '#aa44ff' });
    if (p.stunTimer  > 0) indicators.push({ icon: '💫', color: '#ff2d78' });
    if (p.shieldTimer > 0) indicators.push({ icon: '🛡️', color: '#00f0ff' });
    indicators.forEach((ind, i) => {
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(ind.icon, cx + panelW / 2 - 12 - (indicators.length - i) * 20, py + 36);
    });

    // Lives (survival)
    if (this.mode === 'survival') {
      ctx.font = '13px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('❤️'.repeat(Math.max(0, p.lives)), cx + panelW / 2 - 12, py + 36);
    }

    ctx.restore();
  }

  _drawProgressBar(ctx, p, vx, vy, vw, vh) {
    const pct = clamp(p.distance / TOTAL_DIST, 0, 1);
    const bw  = vw * 0.55;
    const bh  = 6;
    const bx  = vx + vw/2 - bw/2;
    const by  = vy + vh - 18;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this._rRect(ctx, bx, by, bw, bh, 3);
    ctx.fill();

    const pg = ctx.createLinearGradient(bx, 0, bx+bw, 0);
    pg.addColorStop(0, p.color);
    pg.addColorStop(1, '#ffd060');
    ctx.fillStyle=pg;
    this._rRect(ctx, bx, by, bw*pct, bh, 3);
    ctx.fill();

    // Track label
    ctx.font='bold 10px Outfit,sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(180,210,255,0.45)';
    ctx.fillText('START', bx, by+bh/2);
    ctx.textAlign='right';
    ctx.fillText('FINISH', bx+bw, by+bh/2);

    // Car icon on bar
    ctx.fillStyle=p.color;
    ctx.beginPath();
    ctx.arc(bx + bw*pct, by+bh/2, 5, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  _drawCountdown(ctx) {
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.textAlign='center'; ctx.textBaseline='middle';

    if (this._cdPhase === 'go') {
      ctx.font='bold 180px Outfit,sans-serif';
      ctx.strokeStyle='rgba(0,0,0,0.8)'; ctx.lineWidth=12;
      ctx.fillStyle='#ffd060';
      const pulse = 1 + 0.12 * Math.sin(this._globalTime * 18);
      ctx.save(); ctx.translate(this.W/2, this.H/2); ctx.scale(pulse,pulse);
      ctx.strokeText('GO!', 0, 0); ctx.fillText('GO!', 0, 0);
      ctx.restore();
    } else {
      const COLS = { 3:'#e84040', 2:'#f5a623', 1:'#2ec97a' };
      const scale = 1 + (1.0 - this._cdTimer) * 0.5;
      ctx.save(); ctx.translate(this.W/2, this.H/2); ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(this._cdTimer * 2.5, 1);
      ctx.font='bold 220px Outfit,sans-serif';
      ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=14;
      ctx.fillStyle=COLS[this._cdCount]||'#fff';
      ctx.strokeText(String(this._cdCount), 0, 0);
      ctx.fillText(String(this._cdCount), 0, 0);
      ctx.restore();

      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.font='bold 30px Outfit,sans-serif';
      ctx.fillText('Get Ready!', this.W/2, this.H/2+145);
    }
    ctx.restore();
  }

  // ─── Utility drawing helpers ───────────────────────────────
  _rRect(ctx, x, y, w, h, r) {
    const R = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+R, y);
    ctx.lineTo(x+w-R, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+R);
    ctx.lineTo(x+w, y+h-R);
    ctx.quadraticCurveTo(x+w, y+h, x+w-R, y+h);
    ctx.lineTo(x+R, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-R);
    ctx.lineTo(x, y+R);
    ctx.quadraticCurveTo(x, y, x+R, y);
    ctx.closePath();
  }

  _darken(hex, amt) {
    const n = parseInt(hex.replace('#',''), 16);
    const r = clamp((n >> 16) - amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) - amt, 0, 255);
    const b = clamp((n & 0xff) - amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Boot ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { new LaneBlitz(); });
