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
const ROAD_X         = (VIEW_W - ROAD_W) / 2; // 40
const CAR_W          = 46;
const CAR_H          = 72;
const JUMP_VY        = -880;
const GRAVITY_VAL    = 2200;
const LAND_CRUSH_MS  = 120;    // landing squash frames
const LANE_SNAP_SPD  = 14;     // lane lerp multiplier
const STUN_DUR       = 1.2;    // collision stun seconds
const SHAKE_MAX      = 14;
const TOTAL_DIST     = 8000;   // track length in scroll-units

// ─── Colour Palette ──────────────────────────────────────────
const P_COLORS = ['#ff4d6d', '#38bdf8'];
const P_NAMES  = ['Player 1', 'Player 2'];
const BG_TOP   = ['#0f1a35', '#0f1a35'];
const BG_BOT   = ['#1a0a2e', '#1a0a2e'];

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
  { name:'Hazard Zone', minGap:260, maxGap:420, types:['block','block','barrier','debris'] },
  { name:'Pit Run',     minGap:300, maxGap:460, types:['block','pit','boost','slow'] },
  { name:'Chaos Lane',  minGap:220, maxGap:380, types:['block','barrier','debris','debris','pit'] },
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

    // Move obstacles down
    this.obstacles.forEach(o => { o.ys += scrollDelta; });

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
    this.score    += Math.floor(spd * dt * 0.08);

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
    if (this.shieldTimer > 0) { Sfx.shield(); return false; }
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
    if (type === 'block' || type === 'barrier' || type === 'debris') {
      if (this.airborne) { Sfx.nearmiss(); return false; } // cleared it!
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

      // Boost/slow check: only fires once per pass
      if (obs.type === 'boost' || obs.type === 'slow') {
        obs.hit = player.id;
        player.hit(obs.type, ox + obs.w/2, oy + obs.h/2);
        this._addFloat(obs.type === 'boost' ? '🚀 BOOST!' : '🐢 SLOW!',
          ox + obs.w/2, oy, obs.type === 'boost' ? '#ffd060' : '#5599ff');
        continue;
      }

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
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#060e22');
    g.addColorStop(1, '#0d0520');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    // Subtle grid
    ctx.strokeStyle = 'rgba(60,120,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke(); }
    for (let y = 0; y < this.H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.W,y); ctx.stroke(); }
  }

  // ── Single viewport render ─────────────────────────────────
  _drawViewport(ctx, player, obstacles, vx, vy, vw, vh) {
    const t = this._globalTime;

    // ── Sky gradient ──
    const sky = ctx.createLinearGradient(vx, vy, vx, vy+vh);
    sky.addColorStop(0, (player && player.boostTimer > 0) ? '#2a0a0a' : '#0b122a');
    sky.addColorStop(1, '#141e3a');
    ctx.fillStyle = sky;
    ctx.fillRect(vx, vy, vw, vh);

    // Animated stars
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 55; i++) {
      const sx = ((i * 171 + vx) % vw);
      const sy = ((i * 113) % (vh * 0.55));
      const br = 0.5 + 0.5 * Math.sin(t * 1.4 + i * 0.9);
      ctx.fillStyle = `rgba(255,255,255,${br * 0.7})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.restore();

    // ── Horizon glow ──
    const hor = vh * 0.42;
    const hg  = ctx.createLinearGradient(vx, hor-30, vx, hor+60);
    hg.addColorStop(0, 'rgba(40,80,200,0)');
    hg.addColorStop(0.5, 'rgba(40,80,200,0.08)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(vx, hor-30, vw, 90);

    // ── Road ──
    const roadL = vx + (vw - ROAD_W) / 2;
    const roadR = roadL + ROAD_W;
    const roadTop = vy + vh * 0.38;
    const roadBot = vy + vh;

    // Road shadow
    const rsh = ctx.createLinearGradient(roadL, roadTop, roadL, roadBot);
    rsh.addColorStop(0, 'rgba(0,0,0,0)');
    rsh.addColorStop(0.15, 'rgba(0,0,0,0.45)');
    rsh.addColorStop(1, 'rgba(0,0,0,0.7)');

    // Road surface
    const rg = ctx.createLinearGradient(roadL, roadTop, roadR, roadTop);
    rg.addColorStop(0, '#191e2e');
    rg.addColorStop(0.5,'#222840');
    rg.addColorStop(1, '#191e2e');
    ctx.fillStyle = rg;
    ctx.fillRect(roadL, vy, ROAD_W, vh);

    // Road edge lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.moveTo(roadL, vy); ctx.lineTo(roadL, vy+vh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(roadR, vy); ctx.lineTo(roadR, vy+vh); ctx.stroke();

    // Lane dashes
    const dashH = 40, dashGap = 30;
    const dashOff = (this.scrollSpeed * this._globalTime * 0.7) % (dashH + dashGap);
    ctx.setLineDash([dashH, dashGap]);
    ctx.lineDashOffset = -dashOff;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    for (let l = 1; l < LANE_COUNT; l++) {
      const lx = roadL + l * LANE_W;
      ctx.beginPath(); ctx.moveTo(lx, vy); ctx.lineTo(lx, vy+vh); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Curbs
    const curbW = 10;
    const curbH = 18;
    const curbOff = (this.scrollSpeed * this._globalTime * 0.7) % (curbH * 2);
    for (let cy = vy - curbH * 2 + curbOff; cy < vy + vh + curbH; cy += curbH) {
      const even = Math.floor((cy - curbOff) / curbH) % 2 === 0;
      ctx.fillStyle = even ? '#cc3333' : '#eeeeee';
      ctx.fillRect(roadL - curbW, cy, curbW, curbH);
      ctx.fillRect(roadR, cy, curbW, curbH);
    }

    // Outside grass
    const lg = ctx.createLinearGradient(vx, 0, roadL-curbW, 0);
    lg.addColorStop(0, '#1a3812');
    lg.addColorStop(1, '#1f4216');
    ctx.fillStyle = lg;
    ctx.fillRect(vx, vy, roadL - curbW - vx, vh);
    ctx.fillRect(roadR + curbW, vy, vx + vw - roadR - curbW, vh);

    // Scenery (trees) parallax
    const treeOffX = -(this._globalTime * 22 % 280);
    this._drawTrees(ctx, vx, vy, roadL - curbW, vh, treeOffX);
    this._drawTrees(ctx, roadR + curbW, vy, vx+vw - roadR - curbW, vh, treeOffX * 1.3);

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
        ctx.arc(roadL + e.x - (vw - ROAD_W)/2, player.y + (e.y - player.y) + vy + vh - 130, e.r, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });

      // Trail
      const clr = player.color;
      const trailY0 = vy + vh - 130 + CAR_H;
      const trailBaseX = roadL - (vw - ROAD_W)/2;
      for (let i = 1; i < player.trail.length; i++) {
        const a = (i / player.trail.length) * 0.22;
        ctx.strokeStyle = clr.replace(')', `,${a})`).replace('rgb','rgba');
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(roadL + player.trail[i-1].x - (vw-ROAD_W)/2, vy+vh-130 + CAR_H);
        ctx.lineTo(roadL + player.trail[i].x - (vw-ROAD_W)/2, vy+vh-130 + CAR_H);
        ctx.stroke();
      }

      // Sparks
      player.sparks.forEach(s => {
        ctx.save();
        ctx.globalAlpha = clamp(s.life, 0, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(roadL + s.x - (vw-ROAD_W)/2, vy+vh-130 + s.y - (player.groundY - CAR_H/2), 3, 0, Math.PI*2);
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
        const carScreenX = roadL + player.x + CAR_W/2 - (vw-ROAD_W)/2;
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

  _drawTrees(ctx, ox, oy, ow, oh, scrollOff) {
    if (ow < 10) return;
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const tx = ox + ((i * 65 + scrollOff % 280 + 280) % (ow + 80)) - 20;
      const ty = oy + oh * 0.3 + i * 8 % 40;
      const th = 50 + (i*37)%40;
      const tw = 28 + (i*19)%16;
      // trunk
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(tx + tw/2 - 4, ty + th*0.55, 8, th*0.5);
      // canopy
      ctx.fillStyle = i%3===0 ? '#1d5c28' : i%3===1 ? '#245e34' : '#1a4f22';
      ctx.beginPath();
      ctx.ellipse(tx+tw/2, ty+th*0.42, tw/2, th*0.52, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawObstacle(ctx, obs, roadL, vy, vw, vh) {
    const ox = obs.moving ? obs.mx : obs.x;
    const oy = obs.ys + vy;

    if (oy > vy + vh + 80 || oy + obs.h < vy - 20) return;

    ctx.save();

    if (obs.type === 'boost') {
      const bg = ctx.createLinearGradient(roadL+ox, oy, roadL+ox+obs.w, oy+obs.h);
      bg.addColorStop(0, '#ffd060');
      bg.addColorStop(1, '#ff8800');
      ctx.fillStyle = bg;
      this._rRect(ctx, roadL + ox - (vw-ROAD_W)/2, oy, obs.w, obs.h, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 16px Outfit,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚡ BOOST', roadL + ox + obs.w/2 - (vw-ROAD_W)/2, oy + obs.h/2);
    } else if (obs.type === 'slow') {
      ctx.fillStyle = 'rgba(40,80,200,0.5)';
      this._rRect(ctx, roadL + ox - (vw-ROAD_W)/2, oy, obs.w, obs.h, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,220,255,0.85)';
      ctx.font = 'bold 15px Outfit,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🐢 MUD', roadL + ox + obs.w/2 - (vw-ROAD_W)/2, oy + obs.h/2);
    } else if (obs.type === 'pit') {
      // Dark pit spanning road
      ctx.fillStyle = '#020408';
      ctx.fillRect(roadL + obs.x - (vw-ROAD_W)/2, oy, obs.w, obs.h + 6);
      // Pit edges
      const pg = ctx.createLinearGradient(0, oy, 0, oy+obs.h);
      pg.addColorStop(0, 'rgba(255,80,0,0.6)');
      pg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(roadL + obs.x - (vw-ROAD_W)/2, oy, obs.w, 6);
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.font='bold 14px Outfit,sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('⚠ PIT – JUMP!', roadL + obs.x + obs.w/2 - (vw-ROAD_W)/2, oy + obs.h/2);
    } else if (obs.type === 'barrier') {
      const bx = roadL + obs.mx - (vw-ROAD_W)/2;
      // Striped barrier
      const cols = ['#ffcc00','#222'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i%2];
        ctx.fillRect(bx + i*(obs.w/4), oy - obs.h/2, obs.w/4+1, obs.h*1.5);
      }
      // Warning glow
      ctx.strokeStyle = 'rgba(255,200,0,0.5)';
      ctx.lineWidth=3;
      ctx.strokeRect(bx - 2, oy - obs.h/2 - 2, obs.w+4, obs.h*1.5+4);
    } else if (obs.type === 'debris') {
      const dx = roadL + obs.x - (vw-ROAD_W)/2;
      ctx.fillStyle = '#665533';
      this._rRect(ctx, dx, oy, obs.w, obs.h, 6);
      ctx.fill();
      ctx.strokeStyle = '#886644';
      ctx.lineWidth=2;
      ctx.stroke();
      ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('🪨', dx+obs.w/2, oy+obs.h/2);
    } else {
      // block
      const bx = roadL + obs.x - (vw-ROAD_W)/2;
      const blockG = ctx.createLinearGradient(bx, oy, bx, oy+obs.h);
      blockG.addColorStop(0, '#cc2233');
      blockG.addColorStop(1, '#881122');
      ctx.fillStyle = blockG;
      this._rRect(ctx, bx, oy, obs.w, obs.h, 8);
      ctx.fill();
      ctx.strokeStyle='rgba(255,100,100,0.5)';
      ctx.lineWidth=2;
      ctx.stroke();
      // Hazard stripes
      ctx.save();
      ctx.beginPath(); this._rRect(ctx, bx, oy, obs.w, obs.h, 8); ctx.clip();
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=8;
      for (let i=-obs.h; i<obs.w+obs.h; i+=20) {
        ctx.beginPath(); ctx.moveTo(bx+i, oy); ctx.lineTo(bx+i+obs.h, oy+obs.h); ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  _drawCar(ctx, p, roadL, vy, vw, vh) {
    // Car position in viewport space
    const carX = roadL + p.x - (vw-ROAD_W)/2 + p.shakeX;
    const groundScreen = vy + vh - 130;
    const carY = groundScreen + (p.y - p.groundY);

    const W = CAR_W * p.squashX;
    const H = CAR_H * p.squashY;
    const ox = carX + CAR_W/2 - W/2;
    const oy = carY + CAR_H - H;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(carX + CAR_W/2, groundScreen + CAR_H - 4, W/2*0.8, 8, 0, 0, Math.PI*2);
    ctx.fill();

    // Body
    const bodyG = ctx.createLinearGradient(ox, oy, ox+W, oy+H);
    bodyG.addColorStop(0, p.color);
    bodyG.addColorStop(1, this._darken(p.color, -40));
    ctx.fillStyle = bodyG;
    this._rRect(ctx, ox, oy, W, H, 8);
    ctx.fill();

    // Cockpit windshield
    const wg = ctx.createLinearGradient(ox+W*0.1, oy+H*0.1, ox+W*0.9, oy+H*0.45);
    wg.addColorStop(0, 'rgba(160,230,255,0.9)');
    wg.addColorStop(1, 'rgba(80,180,255,0.65)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.roundRect(ox+W*0.12, oy+H*0.1, W*0.76, H*0.32, 6);
    ctx.fill();

    // Spoiler (rear)
    ctx.fillStyle = this._darken(p.color, -60);
    ctx.fillRect(ox+3, oy+H*0.8, W-6, 6);
    ctx.fillRect(ox-4, oy+H*0.78, 6, 10);
    ctx.fillRect(ox+W-2, oy+H*0.78, 6, 10);

    // Headlights
    ctx.fillStyle = '#fffde0';
    ctx.shadowBlur = 12; ctx.shadowColor = '#fffde0';
    ctx.fillRect(ox+4, oy+4, 10, 7);
    ctx.fillRect(ox+W-14, oy+4, 10, 7);
    ctx.shadowBlur = 0;

    // Tail lights
    ctx.fillStyle = '#ff3333';
    ctx.shadowBlur=8; ctx.shadowColor='#ff0000';
    ctx.fillRect(ox+3, oy+H-8, 10, 5);
    ctx.fillRect(ox+W-13, oy+H-8, 10, 5);
    ctx.shadowBlur=0;

    // Wheels
    ctx.fillStyle = '#111';
    [[ox-4, oy+H*0.2], [ox+W-2, oy+H*0.2], [ox-4, oy+H*0.65], [ox+W-2, oy+H*0.65]].forEach(([wx,wy]) => {
      ctx.fillRect(wx, wy, 6, 14);
    });

    // Player badge
    ctx.font = 'bold 12px Outfit,sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillText(p.name.replace('Player ','P'), carX+CAR_W/2, carY+CAR_H/2);

    // Boost flame
    if (p.boostTimer > 0) {
      const ft = p.boostTimer % 0.2;
      ctx.save();
      ctx.globalAlpha = 0.8 + Math.sin(this._globalTime*18)*0.2;
      ctx.fillStyle = '#ff7700';
      ctx.beginPath();
      ctx.moveTo(ox+W*0.25, oy+H);
      ctx.lineTo(ox+W*0.75, oy+H);
      ctx.lineTo(ox+W*0.5, oy+H+18+Math.random()*14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle='#ffdd00';
      ctx.beginPath();
      ctx.moveTo(ox+W*0.35, oy+H);
      ctx.lineTo(ox+W*0.65, oy+H);
      ctx.lineTo(ox+W*0.5, oy+H+10+Math.random()*8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawPlayerHUD(ctx, p, vx, vy, vw, vh) {
    ctx.save();
    // Top-center panel for this viewport
    const cx = vx + vw/2;
    const py = vy + 12;

    // Background
    ctx.fillStyle='rgba(4,10,24,0.82)';
    this._rRect(ctx, cx-110, py, 220, 50, 12);
    ctx.fill();
    ctx.strokeStyle = p.color + '66';
    ctx.lineWidth=2;
    this._rRect(ctx, cx-110, py, 220, 50, 12);
    ctx.stroke();

    // Player name
    ctx.font='bold 12px Outfit,sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillStyle=p.color;
    ctx.fillText(p.name, cx-100, py+14);

    // Score
    ctx.fillStyle='#ffd060';
    ctx.font='bold 16px Outfit,sans-serif';
    ctx.textAlign='right';
    ctx.fillText(Math.floor(p.score).toLocaleString(), cx+100, py+14);

    // Status indicators
    const indicators = [];
    if (p.boostTimer > 0) indicators.push({ icon:'⚡', color:'#ffd060', t:p.boostTimer/2.2 });
    if (p.slowTimer  > 0) indicators.push({ icon:'🐢', color:'#5599ff', t:p.slowTimer/2.5  });
    if (p.stunTimer  > 0) indicators.push({ icon:'💫', color:'#ff4d6d', t:p.stunTimer/STUN_DUR });

    let ix = cx - 95;
    indicators.forEach(ind => {
      ctx.fillStyle='rgba(255,255,255,0.08)';
      this._rRect(ctx, ix, py+28, 62, 14, 5);
      ctx.fill();
      ctx.fillStyle=ind.color;
      ctx.fillRect(ix+1, py+29, Math.round(60*ind.t), 12);
      ctx.font='10px sans-serif'; ctx.textAlign='left';
      ctx.fillStyle='rgba(255,255,255,0.9)';
      ctx.fillText(ind.icon+' '+Math.ceil(ind.t * (ind.icon==='⚡'?2.2:ind.icon==='🐢'?2.5:STUN_DUR))+'s', ix+4, py+36);
      ix += 68;
    });

    // Lives (survival mode)
    if (this.mode === 'survival') {
      ctx.font='16px sans-serif'; ctx.textAlign='right';
      ctx.fillText('❤️'.repeat(Math.max(0,p.lives)), cx+100, py+36);
    }

    // Speed indicator
    const spd = Math.round(this.scrollSpeed * (p.boostTimer>0?1.45:p.slowTimer>0?0.52:1));
    ctx.font='bold 10px Outfit,sans-serif';
    ctx.textAlign='left'; ctx.fillStyle='rgba(180,200,255,0.55)';
    ctx.fillText(spd+'km/h', cx-100, py+38);

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
    const n=parseInt(hex.replace('#',''),16);
    const r=clamp((n>>16)+amt,0,255);
    const g=clamp(((n>>8)&0xff)+amt,0,255);
    const b=clamp((n&0xff)+amt,0,255);
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Boot ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { new LaneBlitz(); });
