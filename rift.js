'use strict';
// ═══════════════════════════════════════════════════════════════
//  RIFT RACER — True Independent Split-Screen Arcade Obstacle Racer
//  Core architecture: static course data + per-player progress offset
//  Each player has their own camera, speed, physics, and course window.
// ═══════════════════════════════════════════════════════════════

// ── Tuning Constants ─────────────────────────────────────────────
const TRACK_LENGTH  = 12000;   // Total course distance (units)
const VIEW_DEPTH    = 620;     // Units visible ahead of player
const LANE_COUNT    = 5;
const LANE_W        = 90;      // Pixels per lane
const ROAD_W        = LANE_COUNT * LANE_W;  // 450
const CAR_W         = 42;
const CAR_H         = 68;
const CAR_Y_FRAC    = 0.78;    // Player's car Y as fraction of viewport H
const HORIZON_FRAC  = 0.10;    // Horizon Y as fraction of viewport H
const SPEED_START   = [210, 265, 330]; // per difficulty (easy/med/hard)
const SPEED_PEAK    = [390, 510, 640]; // max speed per difficulty
const SPEED_RAMP    = 4.5;     // units/sec² acceleration
const JUMP_VY       = -880;
const GRAVITY_V     = 2300;
const JUMP_CLEAR_PX = 90;      // pixels off ground that clears low obstacles
const STUN_DUR      = 1.6;     // seconds
const STUN_SPD_MULT = 0.20;    // speed factor while stunned
const BOOST_MULT    = 1.48;
const SLOW_MULT     = 0.46;
const LANE_SNAP     = 13;      // lane interpolation speed
const LANE_CD       = 0.13;    // seconds between lane changes
const NEAR_MISS_Z   = 40;      // units for near-miss bonus
const P_COLORS      = ['#ff4466', '#00ccff'];
const P_NAMES       = ['Player 1', 'Player 2'];
const COLL_ZONES    = 45;      // units around z=0 considered collision zone

// ── Utility ──────────────────────────────────────────────────────
const lerp    = (a, b, t)    => a + (b - a) * t;
const clamp   = (v, lo, hi)  => Math.max(lo, Math.min(hi, v));
const rand    = (lo, hi)     => lo + Math.random() * (hi - lo);
const randInt = (lo, hi)     => Math.floor(rand(lo, hi + 1));
const pick    = arr          => arr[Math.floor(Math.random() * arr.length)];

// ── SFX Engine ────────────────────────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _t(f, type, dur, vol = 0.08, slide = null) {
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
    } catch (e) {}
  },
  jump()     { this._t(300, 'square',   0.13, 0.07, 500); },
  land()     { this._t(100, 'triangle', 0.10, 0.10, 55); },
  crash()    { this._t(170, 'sawtooth', 0.35, 0.13, 55); this._t(70, 'triangle', 0.3, 0.09, 38); },
  boost()    { this._t(420, 'sawtooth', 0.22, 0.09, 920); },
  shield()   { this._t(620, 'sine',     0.18, 0.07, 820); },
  nearMiss() { this._t(880, 'sine',     0.08, 0.06); },
  coin()     { this._t(1047,'sine',     0.08, 0.06, 1320); },
  blip()     { this._t(900, 'sine',     0.05, 0.04); },
  countdown(){ this._t(440, 'square',   0.15, 0.08); },
  go()       { [523,659,784,1047].forEach((f,i) => setTimeout(() => this._t(f,'sine',0.22,0.11), i*90)); },
  win()      { [523,659,784,1047,1318].forEach((f,i) => setTimeout(() => this._t(f,'sine',0.30,0.10), i*110)); },
  lose()     { [400,300,220,160].forEach((f,i) => setTimeout(() => this._t(f,'sawtooth',0.24,0.09), i*110)); },
};

// ══════════════════════════════════════════════════════════════════
//  COURSE BUILDER  — Handcrafted static track definition
//  Each obstacle: { id, z, type, ...type-specific fields }
//  'z' = absolute position along the track (0 → TRACK_LENGTH)
// ══════════════════════════════════════════════════════════════════
let _obsId = 0;
const obs = (z, type, extra = {}) => ({ id: _obsId++, z, type, ...extra });

function buildCourse() {
  const c = [];

  // ── Helper shortcuts ─────
  const block     = (z, lanes)         => obs(z, 'block',    { lanes });
  const pit       = (z, width)         => obs(z, 'pit',      { width: width || ROAD_W - 20, laneOffset: 0 });
  const vehicle   = (z, lane, spd)     => obs(z, 'vehicle',  { lane, sineSpeed: spd || 0.8, sineRange: LANE_W * 1.5, baseX: lane * LANE_W + LANE_W / 2 });
  const barrier   = (z, spd)           => obs(z, 'barrier',  { sineSpeed: spd || 1.1, width: LANE_W * 2.2 });
  const laser     = (z, period, phase) => obs(z, 'laser',    { period: period || 2.2, phaseOffset: phase || 0 });
  const gate      = (z, openLane)      => obs(z, 'gate',     { openLane });
  const ramp      = (z, lane)          => obs(z, 'ramp',     { lane });
  const boost     = (z, lane)          => obs(z, 'boost',    { lane });
  const slow      = (z, lane)          => obs(z, 'slow',     { lane });
  const shield    = (z, lane)          => obs(z, 'shield',   { lane });
  const coin      = (z, lane)          => obs(z, 'coin',     { lane });

  // ════════════════════════════════════════════════════════
  //  SECTION 1: Open Road (z 0–1400)
  //  Goal: Teach lane switching, warm up, feel the speed
  // ════════════════════════════════════════════════════════
  c.push(boost(200, 2));
  c.push(coin(280, 2));
  c.push(block(400, [1]));
  c.push(block(420, [3]));
  c.push(boost(560, 0));
  c.push(coin(600, 4));
  c.push(block(700, [2]));
  c.push(block(800, [0, 1]));
  c.push(block(900, [3, 4]));
  c.push(coin(960, 2));
  c.push(boost(1050, 4));
  c.push(block(1150, [1, 2]));
  c.push(block(1280, [2, 3]));
  c.push(shield(1350, 2));

  // ════════════════════════════════════════════════════════
  //  SECTION 2: Weave Zone (z 1400–2800)
  //  Goal: Force continuous lane changes, alternating patterns
  // ════════════════════════════════════════════════════════
  c.push(block(1500, [0, 1, 2]));  // must go right
  c.push(block(1650, [2, 3, 4]));  // must go left
  c.push(block(1800, [0, 1, 2]));
  c.push(boost(1900, 4));
  c.push(block(2000, [2, 3, 4]));
  c.push(block(2100, [0]));
  c.push(block(2100, [4]));
  c.push(coin(2150, 2));
  c.push(block(2220, [1, 2, 3]));   // centre blocked, edges safe
  c.push(barrier(2350, 1.0));
  c.push(block(2450, [0, 1]));
  c.push(block(2470, [3, 4]));      // double threat
  c.push(slow(2550, 2));
  c.push(block(2650, [1, 2, 3]));
  c.push(boost(2730, 0));
  c.push(shield(2780, 4));

  // ════════════════════════════════════════════════════════
  //  SECTION 3: Pit Run (z 2800–4200)
  //  Goal: Introduce pits—must jump over wide gaps
  // ════════════════════════════════════════════════════════
  c.push(ramp(2900, 2));
  c.push(pit(3050));
  c.push(block(3200, [0, 1]));
  c.push(ramp(3300, 3));
  c.push(pit(3450));
  c.push(boost(3550, 2));
  c.push(block(3650, [2, 3, 4]));
  c.push(ramp(3750, 1));
  c.push(pit(3900));
  c.push(coin(4000, 2));
  c.push(block(4050, [1, 2]));
  c.push(barrier(4140, 1.3));
  c.push(ramp(4160, 0));
  c.push(pit(4200));           // back-to-back pit immediately after ramp

  // ════════════════════════════════════════════════════════
  //  SECTION 4: Traffic Block (z 4200–5600)
  //  Goal: Weave through slow-moving AI vehicles
  // ════════════════════════════════════════════════════════
  c.push(vehicle(4350, 1, 0.7));
  c.push(vehicle(4500, 3, 0.9));
  c.push(boost(4550, 0));
  c.push(vehicle(4650, 0, 0.6));
  c.push(vehicle(4700, 4, 0.8));
  c.push(vehicle(4850, 2, 1.1));
  c.push(coin(4900, 4));
  c.push(block(5000, [1, 2]));
  c.push(vehicle(5100, 3, 0.75));
  c.push(vehicle(5150, 1, 0.95));
  c.push(slow(5250, 2));
  c.push(vehicle(5350, 0, 0.65));
  c.push(vehicle(5380, 4, 0.85));
  c.push(shield(5450, 2));
  c.push(vehicle(5520, 2, 1.2));

  // ════════════════════════════════════════════════════════
  //  SECTION 5: Narrow Gauntlet (z 5600–7000)
  //  Goal: Precision — only one lane is safe, must read in advance
  // ════════════════════════════════════════════════════════
  c.push(gate(5700, 4));   // only lane 4 open
  c.push(gate(5870, 0));   // only lane 0 open
  c.push(boost(5940, 2));
  c.push(gate(6050, 3));
  c.push(barrier(6150, 1.4));
  c.push(gate(6250, 1));
  c.push(coin(6310, 1));
  c.push(gate(6400, 0));
  c.push(gate(6550, 4));
  c.push(pit(6650));
  c.push(gate(6750, 2));
  c.push(block(6850, [0, 1, 3, 4]));
  c.push(gate(6950, 2));

  // ════════════════════════════════════════════════════════
  //  SECTION 6: Laser Grid (z 7000–8400)
  //  Goal: Timing skills — lasers blink, must read the rhythm
  // ════════════════════════════════════════════════════════
  c.push(laser(7100, 2.0, 0.0));
  c.push(boost(7200, 2));
  c.push(laser(7300, 2.0, 1.0));   // opposite phase
  c.push(block(7400, [0, 1]));
  c.push(laser(7500, 1.8, 0.4));
  c.push(laser(7600, 1.8, 1.3));
  c.push(shield(7650, 4));
  c.push(barrier(7700, 1.6));
  c.push(laser(7800, 1.5, 0.2));
  c.push(pit(7900));
  c.push(laser(8000, 1.5, 0.9));
  c.push(laser(8100, 1.5, 1.8));   // rapid cycle  
  c.push(boost(8200, 0));
  c.push(laser(8300, 1.2, 0.0));

  // ════════════════════════════════════════════════════════
  //  SECTION 7: Chaos Storm (z 8400–10200)
  //  Goal: Everything mixed, dense, intense, recovery matters
  // ════════════════════════════════════════════════════════
  c.push(vehicle(8500, 2, 1.3));
  c.push(block(8500, [0, 1]));
  c.push(vehicle(8600, 4, 0.9));
  c.push(laser(8700, 1.4, 0.5));
  c.push(barrier(8800, 1.8));
  c.push(pit(8900));
  c.push(block(9000, [2, 3, 4]));
  c.push(vehicle(9050, 1, 1.0));
  c.push(shield(9100, 2));
  c.push(gate(9200, 3));
  c.push(laser(9300, 1.3, 0.3));
  c.push(vehicle(9350, 0, 0.75));
  c.push(pit(9450));
  c.push(barrier(9550, 2.0));
  c.push(boost(9600, 2));
  c.push(block(9650, [0, 1, 2]));
  c.push(laser(9750, 1.2, 0.0));
  c.push(vehicle(9800, 3, 1.1));
  c.push(gate(9900, 1));
  c.push(pit(9980));
  c.push(block(10050, [3, 4]));
  c.push(laser(10130, 1.1, 0.7));
  c.push(coin(10180, 2));

  // ════════════════════════════════════════════════════════
  //  SECTION 8: Final Surge (z 10200–12000)
  //  Goal: Maximum speed, densest pattern, prove yourself
  // ════════════════════════════════════════════════════════
  c.push(block(10250, [1, 2]));
  c.push(vehicle(10350, 3, 1.4));
  c.push(laser(10450, 1.0, 0.0));
  c.push(gate(10550, 0));
  c.push(pit(10650));
  c.push(boost(10700, 2));
  c.push(barrier(10800, 2.2));
  c.push(block(10900, [0, 1, 3, 4]));
  c.push(laser(11000, 0.9, 0.45));
  c.push(vehicle(11050, 2, 1.5));
  c.push(pit(11150));
  c.push(gate(11250, 4));
  c.push(block(11350, [0, 1, 2]));
  c.push(laser(11450, 0.85, 0.2));
  c.push(boost(11500, 4));
  c.push(shield(11520, 0));
  c.push(barrier(11600, 2.4));
  c.push(pit(11700));
  c.push(gate(11800, 2));
  c.push(laser(11850, 0.8, 0.0));
  c.push(block(11900, [1, 3]));
  c.push(boost(11950, 2));
  // Final clear stretch to the line
  c.push(coin(11980, 2)); // last coin for triumph

  return c.sort((a, b) => a.z - b.z);
}

const COURSE = buildCourse();

// ══════════════════════════════════════════════════════════════════
//  PLAYER  — All independent per-player state and physics
// ══════════════════════════════════════════════════════════════════
class Player {
  constructor(id, ctrl, diff) {
    this.id    = id;
    this.ctrl  = ctrl;
    this.color = P_COLORS[id];
    this.name  = P_NAMES[id];
    this.diff  = diff;

    // ── Core race state ──
    this.progress    = 0;
    this.speed       = SPEED_START[diff];
    this.score       = 0;
    this.finished    = false;
    this.finishTime  = null;
    this.sectionName = 'Open Road';

    // ── Lane physics ──
    this.lane        = 2;  // center
    this.targetLane  = 2;
    this.x           = this._laneCenter(2); // pixel x in road space
    this.laneCd      = 0;

    // ── Jump physics ──
    this.groundY     = 0;   // set on first render
    this.jumpY       = 0;   // offset above ground (>0 = in air, growing upward)
    this.jumpVY      = 0;
    this.airborne    = false;

    // ── Powerup timers ──
    this.stunTimer   = 0;
    this.boostTimer  = 0;
    this.slowTimer   = 0;
    this.shieldTimer = 0;
    this.lives       = 3;

    // ── Visual feedback ──
    this.flashTimer  = 0;
    this.flashColor  = '#fff';
    this.shakeX      = 0;
    this.squashX     = 1;
    this.squashY     = 1;
    this.nearMissTimer = 0;

    // ── Particles ──
    this.sparks      = [];
    this.exhaust     = [];
    this.trail       = [];

    // ── Input tracking ──
    this._prevLeft   = false;
    this._prevRight  = false;
    this._prevJump   = false;

    // ── Obstacle tracking (per-player) ──
    this._hitSet     = new Set();  // ids of obstacles already processed
    this._nearMissSet= new Set();
  }

  _laneCenter(lane) {
    return lane * LANE_W + LANE_W / 2;
  }

  update(dt, keys, gameTime) {
    if (this.finished) return;

    const left  = !!keys[this.ctrl.left];
    const right = !!keys[this.ctrl.right];
    const jump  = !!keys[this.ctrl.jump];

    // ── Timers ──
    this.laneCd      = Math.max(0, this.laneCd      - dt);
    this.stunTimer   = Math.max(0, this.stunTimer   - dt);
    this.boostTimer  = Math.max(0, this.boostTimer  - dt);
    this.slowTimer   = Math.max(0, this.slowTimer   - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.flashTimer  = Math.max(0, this.flashTimer  - dt);
    this.nearMissTimer= Math.max(0, this.nearMissTimer - dt);
    const stunned = this.stunTimer > 0;

    // ── Stun wobble ──
    this.shakeX = stunned ? Math.sin(this.stunTimer * 45) * 20 : 0;

    // ── Lane input ──
    if (!stunned && this.laneCd <= 0) {
      if (left && !this._prevLeft && this.targetLane > 0) {
        this.targetLane--;
        this.laneCd = LANE_CD;
        Sfx.blip();
      }
      if (right && !this._prevRight && this.targetLane < LANE_COUNT - 1) {
        this.targetLane++;
        this.laneCd = LANE_CD;
        Sfx.blip();
      }
    }
    this._prevLeft  = left;
    this._prevRight = right;

    // ── Smooth lane snap ──
    const targetX = this._laneCenter(this.targetLane);
    this.x = lerp(this.x, targetX, Math.min(1, LANE_SNAP * dt));
    this.lane = Math.round((this.x - LANE_W / 2) / LANE_W);  // approx current lane

    // ── Jump ──
    if (!stunned && jump && !this._prevJump && !this.airborne) {
      this.jumpVY  = JUMP_VY;
      this.airborne = true;
      Sfx.jump();
    }
    this._prevJump = jump;

    if (this.airborne) {
      this.jumpVY += GRAVITY_V * dt;
      this.jumpY  -= this.jumpVY * dt;   // jumpY is upward displacement in pixels (+= up)
      if (this.jumpY <= 0) {
        this.jumpY    = 0;
        this.jumpVY   = 0;
        this.airborne = false;
        this.squashY  = 0.60;
        this.squashX  = 1.48;
        Sfx.land();
      }
    }

    // ── Squash recovery ──
    this.squashY = lerp(this.squashY, 1.0, Math.min(1, 13 * dt));
    this.squashX = lerp(this.squashX, 1.0, Math.min(1, 13 * dt));

    // ── Speed & Progress ──
    let spd = this.speed;
    if (stunned)             spd = this.speed * STUN_SPD_MULT;
    else if (this.boostTimer > 0) spd *= BOOST_MULT;
    else if (this.slowTimer  > 0) spd *= SLOW_MULT;

    if (!stunned) {
      this.speed = Math.min(SPEED_PEAK[this.diff], this.speed + SPEED_RAMP * dt);
    }
    this.progress += spd * dt;
    this.score    += spd * dt * 0.09;

    if (this.progress >= TRACK_LENGTH && !this.finished) {
      this.finished   = true;
      this.finishTime = gameTime;
    }

    // ── Exhaust particles ──
    if (Math.random() < 0.45) {
      this.exhaust.push({
        rx: this.x + rand(-10, 10), // road-space x
        jumpY: this.jumpY,
        vx: rand(-18, 18), vy: rand(20, 55),
        life: rand(0.22, 0.5),
        r: rand(3, 7),
        color: this.boostTimer > 0 ? '#ff8844' : '#7799bb',
      });
    }
    this.exhaust = this.exhaust.filter(e => {
      e.rx += e.vx * dt; e.life -= dt; return e.life > 0;
    });

    // ── Trail ──
    this.trail.push({ x: this.x });
    if (this.trail.length > 38) this.trail.shift();

    // ── Sparks ──
    this.sparks = this.sparks.filter(s => {
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
      s.vy += 1100 * dt;
      s.life -= dt;
      return s.life > 0;
    });

    // ── Obstacle collision ──
    this._checkCollisions(gameTime);
  }

  _checkCollisions(gameTime) {
    // Scan obstacles visible/near this player's progress
    const lo = this.progress - COLL_ZONES * 2;
    const hi = this.progress + COLL_ZONES;

    for (const obs of COURSE) {
      if (obs.z < lo || obs.z > hi) continue;
      if (this._hitSet.has(obs.id)) continue;

      const ahead = obs.z - this.progress; // <0 = player passed it, >0 = ahead

      // Check if centre of obstacle is in collision range
      if (Math.abs(ahead) > COLL_ZONES) continue;

      this._processObstacle(obs, ahead, gameTime);
    }
  }

  _processObstacle(obs, ahead, gameTime) {
    const type = obs.type;

    // Near-miss detection (just cleared an obstacle without hitting)
    if (ahead < -5 && !this._nearMissSet.has(obs.id)) {
      if ((type === 'block' || type === 'gate' || type === 'vehicle') && this.airborne) {
        // airborne pass = near miss or clear
        if (Math.abs(ahead) < NEAR_MISS_Z) {
          this.nearMissTimer = 0.7;
          this.score += 75;
          Sfx.nearMiss();
        }
      }
      this._nearMissSet.add(obs.id);
    }

    if (this._hitSet.has(obs.id)) return;

    // ── Pickups (positive, one-shot) ──
    if (type === 'boost') {
      this._hitSet.add(obs.id);
      this.boostTimer = 2.4;
      this.flashTimer = 0.28; this.flashColor = '#ffd060';
      this.score += 120;
      this._sparks(20, '#ffd060');
      Sfx.boost();
      return;
    }
    if (type === 'slow') {
      if (this.shieldTimer > 0) return;
      this._hitSet.add(obs.id);
      this.slowTimer = 2.8;
      this.flashTimer = 0.3; this.flashColor = '#5599ff';
      return;
    }
    if (type === 'shield') {
      this._hitSet.add(obs.id);
      this.shieldTimer = 7.0;
      this.flashTimer = 0.28; this.flashColor = '#aaddff';
      Sfx.shield();
      return;
    }
    if (type === 'coin') {
      this._hitSet.add(obs.id);
      this.score += 200;
      Sfx.coin();
      return;
    }

    // ── Ramp — auto-launch player ──
    if (type === 'ramp') {
      const inLane = Math.abs(this.x - (obs.lane * LANE_W + LANE_W / 2)) < LANE_W * 0.7;
      if (inLane && !this.airborne && this.stunTimer <= 0) {
        this._hitSet.add(obs.id);
        this.jumpVY  = JUMP_VY * 0.85;
        this.airborne = true;
        Sfx.jump();
      }
      return;
    }

    // ── Damaging / blocking obstacles ──
    // These only fire when player is NOT shielded; airborne may cancel some

    if (type === 'pit') {
      if (this.airborne && this.jumpY > 20) { this._hitSet.add(obs.id); return; }
      this._damage(obs);
      return;
    }
    if (type === 'block') {
      if (this.airborne && this.jumpY > JUMP_CLEAR_PX) { this._hitSet.add(obs.id); return; }
      // Check lane overlap
      const myLane = Math.round((this.x - LANE_W / 2) / LANE_W);
      if (!obs.lanes.includes(myLane)) { this._hitSet.add(obs.id); return; }
      this._damage(obs);
      return;
    }
    if (type === 'gate') {
      if (this.airborne && this.jumpY > JUMP_CLEAR_PX) { this._hitSet.add(obs.id); return; }
      const myLane = Math.round((this.x - LANE_W / 2) / LANE_W);
      if (myLane === obs.openLane) { this._hitSet.add(obs.id); return; }
      this._damage(obs);
      return;
    }
    if (type === 'vehicle') {
      if (this.airborne && this.jumpY > JUMP_CLEAR_PX) { this._hitSet.add(obs.id); return; }
      // Vehicle x is animated; check current pos (observer computes it at render time, we share gameTime)
      const vehX = obs.baseX + Math.sin(gameTime * obs.sineSpeed) * obs.sineRange * 0.5;
      const myX  = this.x;
      if (Math.abs(myX - vehX) > LANE_W * 1.3) { this._hitSet.add(obs.id); return; }
      this._damage(obs);
      return;
    }
    if (type === 'barrier') {
      if (this.airborne && this.jumpY > JUMP_CLEAR_PX * 1.5) { this._hitSet.add(obs.id); return; }
      const barX = ROAD_W / 2 + Math.sin(gameTime * obs.sineSpeed) * (ROAD_W / 2 - obs.width / 2);
      const myX  = this.x;
      if (Math.abs(myX - barX) > obs.width / 2 + CAR_W / 2) { this._hitSet.add(obs.id); return; }
      this._damage(obs);
      return;
    }
    if (type === 'laser') {
      // Laser: blinks, skip if currently off
      const isOn = (Math.sin((_ac.currentTime + obs.phaseOffset) * Math.PI * 2 / obs.period) > 0);
      if (!isOn) return;   // don't hit set — can still be triggered on next frame if it turns on
      this._damage(obs);
      return;
    }
  }

  _damage(obs) {
    if (this.shieldTimer > 0) {
      this.shieldTimer = 0;
      this._hitSet.add(obs.id);
      this._sparks(28, '#aaddff');
      Sfx.shield();
      return;
    }
    this._hitSet.add(obs.id);
    this.stunTimer  = STUN_DUR;
    this.flashTimer = 0.45; this.flashColor = '#ff3333';
    this.lives = Math.max(0, this.lives - 1);
    this._sparks(24, this.color);
    Sfx.crash();
  }

  _sparks(n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(55, 260);
      this.sparks.push({
        x: this.x, y: 0,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80,
        life: rand(0.35, 1.0),
        color,
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  RIFT RACER  — Main game class
// ══════════════════════════════════════════════════════════════════
class RiftRacer {
  constructor() {
    this.canvas = document.getElementById('riftCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.W = this.H = 0;
    this.keys = {};
    this.state = 'setup';
    this._gt   = 0;   // global game time
    this._lt   = 0;   // last timestamp
    this._shake = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      const prevent = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
      if (prevent.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    this._bindUI();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  _bindUI() {
    // Mode selection
    document.querySelectorAll('.mode-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.mode-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        const mode = el.querySelector('input').value;
        const p2 = document.getElementById('p2ctrl');
        const div = document.querySelector('.ctrl-divider');
        const fade = mode === 'solo' ? '0.25' : '1';
        if (p2) p2.style.opacity = fade;
        if (div) div.style.opacity = fade;
      });
    });

    // Difficulty selection
    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
      });
    });

    document.getElementById('riftStartBtn').addEventListener('click', () => this._startGame());
    document.getElementById('riftPlayAgainBtn')?.addEventListener('click', () => this._startGame());
    document.getElementById('riftMenuBtn')?.addEventListener('click', () => this._showSetup());
  }

  _readSettings() {
    const modeEl = document.querySelector('input[name="mode"]:checked');
    const diffEl = document.querySelector('input[name="diff"]:checked');
    this.mode = modeEl?.value ?? 'versus';
    const diffStr = diffEl?.value ?? 'medium';
    this.diff = { easy: 0, medium: 1, hard: 2 }[diffStr] ?? 1;
    this.isSolo = this.mode === 'solo';
  }

  _startGame() {
    Sfx._r();
    this._readSettings();

    document.getElementById('riftSetup').style.display   = 'none';
    document.getElementById('riftResults').style.display = 'none';

    const CTRL_P1 = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' };
    const CTRL_P2 = { left: 'KeyA',      right: 'KeyD',       jump: 'KeyW'    };

    this.p1 = new Player(0, CTRL_P1, this.diff);
    this.p2 = this.isSolo ? null : new Player(1, CTRL_P2, this.diff);

    _obsId = 0;            // reset for fresh IDs if needed
    this._gt         = 0;
    this._lt         = 0;
    this._shake      = 0;
    this._floats     = [];   // floating text events
    this._cdCount    = 3;
    this._cdTimer    = 1.0;
    this._cdPhase    = 'num';
    this._raceOver   = false;

    this.state = 'countdown';
    Sfx.countdown();
  }

  _showSetup() {
    document.getElementById('riftSetup').style.display   = '';
    document.getElementById('riftResults').style.display = 'none';
    this.state = 'setup';
  }

  // ── LOOP ─────────────────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - (this._lt || ts)) / 1000, 0, 0.05);
    this._lt = ts;
    if (this.state !== 'setup' && this.state !== 'results') {
      this._gt += dt;
    }
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _update(dt) {
    if (this.state === 'setup' || this.state === 'results') return;

    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        if (this._cdPhase === 'num') {
          this._cdCount--;
          if (this._cdCount > 0) { Sfx.countdown(); this._cdTimer = 1.0; }
          else { this._cdPhase = 'go'; this._cdTimer = 0.90; Sfx.go(); }
        } else {
          this.state = 'racing';
        }
      }
      return;
    }

    if (this.state === 'racing') {
      this.p1.update(dt, this.keys, this._gt);
      if (this.p2) this.p2.update(dt, this.keys, this._gt);

      // Floating text updates
      this._floats = this._floats.filter(f => { f.y -= 50 * dt; f.life -= dt; return f.life > 0; });

      // Screen shake decay
      this._shake *= Math.pow(0.7, dt * 60);
      if (this._shake < 0.15) this._shake = 0;

      // Survival: lives check
      if (this.mode === 'survival') {
        if (this.p1.lives <= 0 || (this.p2 && this.p2.lives <= 0)) {
          if (!this._raceOver) { this._raceOver = true; setTimeout(() => this._endRace(), 1500); }
        }
      }

      // Finish check
      const p1done = this.p1.finished;
      const p2done = !this.p2 || this.p2.finished;
      if (!this._raceOver && (p1done && p2done || (p1done && this.isSolo))) {
        this._raceOver = true;
        setTimeout(() => this._endRace(), 1800);
      }
      // Timeout: if one player finishes but the other hasn't after 45s, end
      if (!this._raceOver && (this.p1.finished || (this.p2?.finished)) ) {
        const leaderTime = this.p1.finishTime ?? this.p2?.finishTime;
        if (leaderTime !== null && this._gt - leaderTime > 45) {
          this._raceOver = true;
          setTimeout(() => this._endRace(), 1000);
        }
      }
    }
  }

  _addFloat(text, color, vpX, vpW) {
    const cx = vpX + vpW / 2;
    this._floats.push({ text, color, x: cx, y: this.H * 0.5, life: 1.2 });
  }

  _endRace() {
    this.state = 'results';
    const el = document.getElementById('riftResults');
    el.style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    if (this.isSolo) {
      document.getElementById('resultsEmoji').textContent     = '⏱️';
      document.getElementById('resultsHeadline').textContent  = 'Time Trial Complete!';
      const t = this.p1.finishTime ? this._fmtTime(this.p1.finishTime) : `${(this.p1.progress / 100).toFixed(0)}%`;
      list.innerHTML = `<div class="result-entry"><span class="result-pos">🌟 Solo</span><span class="result-dot" style="background:${this.p1.color}"></span><span class="result-name">${this.p1.name}</span><span class="result-stat">${t} &nbsp; ${Math.floor(this.p1.score).toLocaleString()} pts</span></div>`;
    } else {
      let winner, loser;
      if (this.p1.finishTime !== null && this.p2?.finishTime !== null) {
        winner = this.p1.finishTime <= this.p2.finishTime ? this.p1 : this.p2;
      } else if (this.p1.finishTime !== null) { winner = this.p1; }
      else if (this.p2?.finishTime !== null)  { winner = this.p2; }
      else { winner = this.p1.progress >= (this.p2?.progress ?? 0) ? this.p1 : this.p2; }

      loser = winner === this.p1 ? this.p2 : this.p1;

      document.getElementById('resultsEmoji').textContent    = '🏆';
      document.getElementById('resultsHeadline').textContent = `${winner.name} Wins!`;

      [winner, loser].filter(Boolean).forEach((p, i) => {
        const stat = p.finishTime !== null ? this._fmtTime(p.finishTime) : `${Math.floor(p.progress/120)}m`;
        const entry = document.createElement('div');
        entry.className = 'result-entry';
        entry.innerHTML = `<span class="result-pos">${i===0?'🥇 1st':'🥈 2nd'}</span><span class="result-dot" style="background:${p.color}"></span><span class="result-name">${p.name}</span><span class="result-stat">${stat} &nbsp; ${Math.floor(p.score).toLocaleString()} pts</span>`;
        list.appendChild(entry);
      });

      if (winner === this.p1) Sfx.win(); else Sfx.lose();
    }
  }

  _fmtTime(t) {
    if (!t) return '--:--.--';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  DRAWING
  // ══════════════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();

    if (this._shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake);
    }

    ctx.clearRect(-20, -20, this.W + 40, this.H + 40);

    if (this.state === 'setup' || this.state === 'results') {
      this._drawMenuBg(ctx);
      ctx.restore();
      return;
    }

    const W = this.W, H = this.H;

    if (this.isSolo) {
      this._drawPlayerView(ctx, this.p1, 0, 0, W, H);
    } else {
      const vpW = Math.floor(W / 2);

      // P1 LEFT
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, vpW, H); ctx.clip();
      this._drawPlayerView(ctx, this.p1, 0, 0, vpW, H);
      ctx.restore();

      // P2 RIGHT
      ctx.save();
      ctx.beginPath(); ctx.rect(vpW, 0, vpW, H); ctx.clip();
      this._drawPlayerView(ctx, this.p2, vpW, 0, vpW, H);
      ctx.restore();

      // ── Split line ──
      const grad = ctx.createLinearGradient(vpW - 2, 0, vpW + 2, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0.0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.20)');
      grad.addColorStop(1,   'rgba(255,255,255,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(vpW - 2, 0, 4, H);

      // VS badge at center
      if (this.state === 'countdown' || this.state === 'racing') {
        ctx.fillStyle = 'rgba(3,6,18,0.88)';
        this._rRect(ctx, vpW - 20, H / 2 - 20, 40, 40, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = 'bold 12px Outfit,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('VS', vpW, H / 2);
      }
    }

    if (this.state === 'countdown') this._drawCountdown(ctx);
    ctx.restore();
  }

  _drawMenuBg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#04060e');
    g.addColorStop(1, '#060310');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.strokeStyle = 'rgba(60,100,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 70) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,this.H); ctx.stroke(); }
    for (let y = 0; y < this.H; y += 70) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(this.W,y); ctx.stroke(); }
  }

  // ── Single viewport ──────────────────────────────────────────────
  _drawPlayerView(ctx, player, vpX, vpY, vpW, vpH) {
    const gt = this._gt;

    // ── Background ──
    const skyG = ctx.createLinearGradient(vpX, vpY, vpX, vpY + vpH);
    skyG.addColorStop(0, player?.boostTimer > 0 ? '#220a0a' : '#080e22');
    skyG.addColorStop(1, '#121830');
    ctx.fillStyle = skyG;
    ctx.fillRect(vpX, vpY, vpW, vpH);

    // Stars
    ctx.save();
    for (let i = 0; i < 50; i++) {
      const sx = vpX + ((i * 173 + vpX) % vpW);
      const sy = vpY + (i * 117 % (vpH * 0.45));
      const br = 0.4 + 0.5 * Math.sin(gt * 1.5 + i * 0.8);
      ctx.fillStyle = `rgba(255,255,255,${br * 0.65})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.restore();

    // ── Road ──
    const roadX = vpX + (vpW - ROAD_W) / 2;
    const roadR = roadX + ROAD_W;

    // Road surface
    const roadG = ctx.createLinearGradient(roadX, 0, roadR, 0);
    roadG.addColorStop(0,   '#171c2d');
    roadG.addColorStop(0.5, '#1e2438');
    roadG.addColorStop(1,   '#171c2d');
    ctx.fillStyle = roadG;
    ctx.fillRect(roadX, vpY, ROAD_W, vpH);

    // Road edges
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth   = 3;
    ctx.beginPath(); ctx.moveTo(roadX, vpY); ctx.lineTo(roadX, vpY + vpH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(roadR, vpY); ctx.lineTo(roadR, vpY + vpH); ctx.stroke();

    // Lane dashes (scroll speed based on player speed)
    const spd = player?.speed ?? SPEED_START[1];
    const dashH = 42, dashGap = 32;
    const scrollOff = (spd * gt * 0.6) % (dashH + dashGap);
    ctx.setLineDash([dashH, dashGap]);
    ctx.lineDashOffset = -scrollOff;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    for (let l = 1; l < LANE_COUNT; l++) {
      const lx = roadX + l * LANE_W;
      ctx.beginPath(); ctx.moveTo(lx, vpY); ctx.lineTo(lx, vpY + vpH); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Animated curbs
    const curbW = 11, curbH = 16;
    const curbOff = (spd * gt * 0.55) % (curbH * 2);
    for (let cy = vpY - curbH * 2 + curbOff; cy < vpY + vpH + curbH; cy += curbH) {
      const even = Math.floor((cy - curbOff) / curbH) % 2 === 0;
      ctx.fillStyle = even ? '#cc2233' : '#eeeeee';
      ctx.fillRect(roadX - curbW, cy, curbW, curbH);
      ctx.fillRect(roadR, cy, curbW, curbH);
    }

    // Scenery (outside grass + trees)
    ctx.fillStyle = '#152611';
    ctx.fillRect(vpX, vpY, roadX - curbW - vpX, vpH);
    ctx.fillRect(roadR + curbW, vpY, vpX + vpW - roadR - curbW, vpH);
    this._drawScenery(ctx, vpX, vpY, roadX - curbW - vpX, vpH, spd * gt);
    this._drawScenery(ctx, roadR + curbW, vpY, vpX + vpW - roadR - curbW, vpH, spd * gt * 1.25);

    if (!player) { ctx.restore(); return; }

    // ── Compute screen geometry for this player ──
    const carScreenY  = vpY + vpH * CAR_Y_FRAC;
    const horizonY    = vpY + vpH * HORIZON_FRAC;
    const roadHeight  = carScreenY - horizonY;  // vertical pixels available for obstacles

    // ── Obstacles (filtered by player progress) ──
    const lo = player.progress - 80;
    const hi = player.progress + VIEW_DEPTH + 20;

    for (const obs of COURSE) {
      if (obs.z < lo || obs.z > hi) continue;
      const ahead = obs.z - player.progress;
      if (ahead < -60) continue;
      this._drawObstacle(ctx, obs, ahead, roadX, carScreenY, horizonY, roadHeight, vpX, vpW, vpH, vpY, player);
    }

    // ── Section name ──
    const secBands = [
      [0,1400,'Open Road'],
      [1400,2800,'Weave Zone'],
      [2800,4200,'Pit Run'],
      [4200,5600,'Traffic Block'],
      [5600,7000,'Narrow Gauntlet'],
      [7000,8400,'Laser Grid'],
      [8400,10200,'Chaos Storm'],
      [10200,12000,'Final Surge'],
    ];
    const sec = secBands.find(s => player.progress >= s[0] && player.progress < s[1]);
    if (sec) player.sectionName = sec[2];

    // ── Exhaust particles ──
    player.exhaust.forEach(e => {
      const ex = roadX + e.rx;
      const ey = carScreenY + CAR_H - e.jumpY + 5;
      ctx.save();
      ctx.globalAlpha = e.life * 0.55;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(ex, ey, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ── Trail ──
    for (let i = 1; i < player.trail.length; i++) {
      const a = (i / player.trail.length) * 0.20;
      ctx.strokeStyle = player.color.replace(')', `,${a})`).replace(/^#/, 'rgba(').replace('rgba(', 'rgba(');
      // Fallback: use rgba directly
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(roadX + player.trail[i-1].x, carScreenY + CAR_H);
      ctx.lineTo(roadX + player.trail[i].x,   carScreenY + CAR_H);
      ctx.stroke();
    }

    // ── Sparks ──
    player.sparks.forEach(s => {
      ctx.save();
      ctx.globalAlpha = clamp(s.life, 0, 1);
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(roadX + s.x, carScreenY + CAR_H / 2 - s.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // ── Car ──
    this._drawCar(ctx, player, roadX, carScreenY, vpX, vpW, vpH, vpY);

    // ── HUD ──
    this._drawHUD(ctx, player, vpX, vpY, vpW, vpH);
    this._drawProgressBar(ctx, player, vpX, vpY, vpW, vpH);

    // ── Flash overlay ──
    if (player.flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = (player.flashTimer / 0.45) * 0.20;
      ctx.fillStyle   = player.flashColor;
      ctx.fillRect(vpX, vpY, vpW, vpH);
      ctx.restore();
    }

    // ── Stun overlay ──
    if (player.stunTimer > 0.3) {
      ctx.save();
      ctx.globalAlpha = 0.13;
      ctx.fillStyle   = '#ff1111';
      ctx.fillRect(vpX, vpY, vpW, vpH);
      ctx.restore();
      // Stars spinning above car
      const carSX = roadX + player.x + player.shakeX + CAR_W / 2;
      for (let s = 0; s < 4; s++) {
        const sa = gt * 4.5 + s * Math.PI / 2;
        ctx.save();
        ctx.font = '15px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⭐', carSX + Math.cos(sa) * 26, carScreenY - player.jumpY - 18 + Math.sin(sa) * 8);
        ctx.restore();
      }
    }

    // ── Near-Miss flash ──
    if (player.nearMissTimer > 0) {
      ctx.save();
      ctx.fillStyle   = 'rgba(255,220,50,0.12)';
      ctx.fillRect(vpX, vpY, vpW, vpH);
      ctx.font        = 'bold 20px Outfit,sans-serif';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillStyle   = '#ffd040';
      ctx.fillText('NEAR MISS! +75', vpX + vpW / 2, vpY + vpH * 0.38);
      ctx.restore();
    }

    // ── FINISHED banner ──
    if (player.finished) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,6,18,0.72)';
      this._rRect(ctx, vpX + vpW / 2 - 110, vpY + vpH / 2 - 32, 220, 64, 18);
      ctx.fill();
      ctx.font = 'bold 28px Outfit,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd060';
      ctx.fillText('✓ FINISHED!', vpX + vpW / 2, vpY + vpH / 2);
      ctx.restore();
    }
  }

  _drawScenery(ctx, ox, oy, ow, oh, scrollVal) {
    if (ow < 12) return;
    const off = (scrollVal * 0.065) % (ow + 80);
    ctx.save();
    for (let i = 0; i < 9; i++) {
      const tx = ox + ((i * 68 + off) % (ow + 80)) - 20;
      const ty = oy + oh * 0.25 + (i * 41) % 55;
      const th = 45 + (i * 35) % 38;
      const tw = 26 + (i * 17) % 14;
      ctx.fillStyle = '#3a1e0e';
      ctx.fillRect(tx + tw / 2 - 4, ty + th * 0.55, 8, th * 0.5);
      ctx.fillStyle = i % 3 === 0 ? '#1a5c28' : i % 3 === 1 ? '#225c34' : '#184f20';
      ctx.beginPath();
      ctx.ellipse(tx + tw / 2, ty + th * 0.4, tw / 2, th * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _obsScreenY(ahead, carScreenY, horizonY, roadHeight) {
    // ahead=0 → carScreenY (at player), ahead=VIEW_DEPTH → horizonY
    return carScreenY - (ahead / VIEW_DEPTH) * roadHeight;
  }

  _perspScale(ahead) {
    return Math.max(0.2, 1.0 - (ahead / VIEW_DEPTH) * 0.72);
  }

  _drawObstacle(ctx, obs, ahead, roadX, carScreenY, horizonY, roadHeight, vpX, vpW, vpH, vpY, player) {
    if (ahead > VIEW_DEPTH + 30 || ahead < -50) return;

    const screenY = this._obsScreenY(ahead, carScreenY, horizonY, roadHeight);
    const ps      = this._perspScale(ahead);
    const type    = obs.type;
    const gt      = this._gt;

    // Fade out very near (passed) obstacles
    if (ahead < 0) {
      ctx.save();
      ctx.globalAlpha = clamp(1 + ahead / 50, 0, 1);
    } else {
      ctx.save();
    }

    const roadCenter = roadX + ROAD_W / 2;

    if (type === 'block') {
      const ll  = Math.min(...obs.lanes);
      const rl  = Math.max(...obs.lanes);
      const bx1 = roadCenter + ((ll * LANE_W) - ROAD_W / 2) * ps;
      const bx2 = roadCenter + (((rl + 1) * LANE_W) - ROAD_W / 2) * ps;
      const bh  = Math.max(6, 50 * ps);
      const bw  = bx2 - bx1;

      const g = ctx.createLinearGradient(bx1, screenY, bx1, screenY + bh);
      g.addColorStop(0, '#dd2233'); g.addColorStop(1, '#881122');
      ctx.fillStyle = g;
      this._rRect(ctx, bx1, screenY, bw, bh, 6 * ps);
      ctx.fill();
      // Hazard stripes
      ctx.save();
      ctx.beginPath(); this._rRect(ctx, bx1, screenY, bw, bh, 6 * ps); ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 8 * ps;
      for (let i = -bh; i < bw + bh; i += 18 * ps) {
        ctx.beginPath(); ctx.moveTo(bx1 + i, screenY); ctx.lineTo(bx1 + i + bh, screenY + bh); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,100,100,0.4)'; ctx.lineWidth = 2;
      this._rRect(ctx, bx1, screenY, bw, bh, 6 * ps); ctx.stroke();

    } else if (type === 'pit') {
      const bx1 = roadCenter - (ROAD_W / 2 - 10) * ps;
      const bx2 = roadCenter + (ROAD_W / 2 - 10) * ps;
      const bh  = Math.max(6, 28 * ps);
      ctx.fillStyle = '#010204';
      ctx.fillRect(bx1, screenY, bx2 - bx1, bh + 4);
      const pg = ctx.createLinearGradient(0, screenY, 0, screenY + bh);
      pg.addColorStop(0, 'rgba(255,60,0,0.65)'); pg.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = pg;
      ctx.fillRect(bx1, screenY, bx2 - bx1, bh);
      if (ps > 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `bold ${Math.round(13 * ps)}px Outfit,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚠ PIT', roadCenter, screenY + bh / 2);
      }

    } else if (type === 'gate') {
      // 4 lanes blocked, 1 open — draw the wall with a gap
      const bh = Math.max(6, 55 * ps);
      for (let l = 0; l < LANE_COUNT; l++) {
        if (l === obs.openLane) continue;
        const lx1 = roadCenter + (l * LANE_W - ROAD_W / 2) * ps;
        const lw  = LANE_W * ps;
        const g = ctx.createLinearGradient(lx1, screenY, lx1, screenY + bh);
        g.addColorStop(0, '#9933dd'); g.addColorStop(1, '#661199');
        ctx.fillStyle = g;
        this._rRect(ctx, lx1, screenY, lw, bh, 4 * ps);
        ctx.fill();
      }
      // Highlight the open lane
      if (ps > 0.3) {
        const ox1 = roadCenter + (obs.openLane * LANE_W - ROAD_W / 2) * ps;
        const ow  = LANE_W * ps;
        ctx.strokeStyle = 'rgba(150,255,150,0.5)'; ctx.lineWidth = 2;
        ctx.strokeRect(ox1, screenY - 4, ow, Math.max(6, 60 * ps) + 4);
        if (ps > 0.5) {
          ctx.fillStyle = 'rgba(150,255,150,0.9)';
          ctx.font = `bold ${Math.round(11 * ps)}px Outfit,sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('GO', ox1 + ow / 2, screenY + Math.max(6, 60 * ps) / 2);
        }
      }

    } else if (type === 'vehicle') {
      const vx   = obs.baseX + Math.sin(gt * obs.sineSpeed) * obs.sineRange * 0.5;
      const vsCX = roadCenter + (vx - ROAD_W / 2) * ps;
      const vw   = Math.max(8, CAR_W * ps);
      const vh2  = Math.max(12, (CAR_H + 10) * ps);
      const vxL  = vsCX - vw / 2;

      ctx.fillStyle = '#7a9988';
      this._rRect(ctx, vxL, screenY, vw, vh2, 5 * ps);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(vxL + vw * 0.1, screenY + vh2 * 0.1, vw * 0.8, vh2 * 0.28);
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(vxL + vw * 0.05, screenY + vh2 - vh2 * 0.1, vw * 0.2, vh2 * 0.07);
      ctx.fillRect(vxL + vw * 0.75, screenY + vh2 - vh2 * 0.1, vw * 0.2, vh2 * 0.07);

    } else if (type === 'barrier') {
      const bx   = roadCenter + Math.sin(gt * obs.sineSpeed) * (ROAD_W / 2 - obs.width * ps / 2);
      const bw   = obs.width * ps;
      const bh   = Math.max(8, 62 * ps);
      const cols = ['#ffcc00', '#222'];
      const strW = Math.max(2, bw / 4);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[i % 2];
        ctx.fillRect(bx - bw / 2 + i * strW, screenY, strW + 1, bh);
      }
      ctx.strokeStyle = 'rgba(255,200,0,0.55)'; ctx.lineWidth = 2;
      ctx.strokeRect(bx - bw / 2 - 2, screenY - 2, bw + 4, bh + 4);

    } else if (type === 'laser') {
      const isOn = (Math.sin((gt + obs.phaseOffset) * Math.PI * 2 / obs.period) > 0);
      const lh   = Math.max(4, 16 * ps);
      const lx1  = roadCenter - ROAD_W / 2 * ps;
      const lw   = ROAD_W * ps;
      if (isOn) {
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(lx1, screenY, lw, lh);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(lx1, screenY + lh / 2 - 1, lw, 2);
        ctx.strokeStyle = 'rgba(255,0,85,0.6)'; ctx.lineWidth = 4;
        ctx.strokeRect(lx1, screenY, lw, lh);
      } else {
        // Warning dash — laser coming
        ctx.strokeStyle = 'rgba(255,0,85,0.18)';
        ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.moveTo(lx1, screenY + lh / 2); ctx.lineTo(lx1 + lw, screenY + lh / 2);
        ctx.stroke(); ctx.setLineDash([]);
      }

    } else if (type === 'ramp') {
      const rx  = roadCenter + (obs.lane * LANE_W + LANE_W / 2 - ROAD_W / 2) * ps;
      const rw  = LANE_W * ps;
      const rh  = Math.max(6, 30 * ps);
      const g   = ctx.createLinearGradient(rx - rw / 2, screenY, rx - rw / 2, screenY + rh);
      g.addColorStop(0, '#ffe060'); g.addColorStop(1, '#cc8800');
      ctx.fillStyle = g;
      this._rRect(ctx, rx - rw / 2, screenY, rw, rh, 5 * ps);
      ctx.fill();
      if (ps > 0.45) {
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(11 * ps)}px Outfit,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('↑ RAMP', rx, screenY + rh / 2);
      }

    } else if (type === 'boost') {
      const bx  = roadCenter + (obs.lane * LANE_W + LANE_W / 2 - ROAD_W / 2) * ps;
      const bw  = LANE_W * ps * 0.85;
      const bh  = Math.max(5, 34 * ps);
      const g   = ctx.createLinearGradient(bx - bw / 2, screenY, bx + bw / 2, screenY);
      g.addColorStop(0, '#ffd060'); g.addColorStop(1, '#ff8800');
      ctx.fillStyle = g;
      this._rRect(ctx, bx - bw / 2, screenY, bw, bh, 6 * ps);
      ctx.fill();
      if (ps > 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.round(11 * ps)}px Outfit,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚡ BOOST', bx, screenY + bh / 2);
      }

    } else if (type === 'slow') {
      const bx  = roadCenter + (obs.lane * LANE_W + LANE_W / 2 - ROAD_W / 2) * ps;
      const bw  = LANE_W * ps;
      const bh  = Math.max(5, 38 * ps);
      ctx.fillStyle = 'rgba(40,80,200,0.55)';
      this._rRect(ctx, bx - bw / 2, screenY, bw, bh, 6 * ps);
      ctx.fill();
      if (ps > 0.4) {
        ctx.fillStyle = 'rgba(180,220,255,0.9)'; ctx.font = `bold ${Math.round(11 * ps)}px Outfit,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🐢 MUD', bx, screenY + bh / 2);
      }

    } else if (type === 'shield') {
      const bx  = roadCenter + (obs.lane * LANE_W + LANE_W / 2 - ROAD_W / 2) * ps;
      const r   = 18 * ps;
      ctx.fillStyle = 'rgba(100,200,255,0.35)';
      ctx.beginPath(); ctx.arc(bx, screenY + r, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#aaddff'; ctx.lineWidth = 2;
      ctx.stroke();
      if (ps > 0.45) {
        ctx.font = `${Math.round(16 * ps)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', bx, screenY + r);
      }

    } else if (type === 'coin') {
      const bx = roadCenter + (obs.lane * LANE_W + LANE_W / 2 - ROAD_W / 2) * ps;
      const r  = 14 * ps * (0.85 + 0.15 * Math.sin(gt * 5 + obs.id));
      ctx.fillStyle = '#ffd060';
      ctx.beginPath(); ctx.arc(bx, screenY + r, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2 * ps;
      ctx.stroke();
      if (ps > 0.55) {
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(10 * ps)}px Outfit,sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', bx, screenY + r);
      }
    }

    ctx.restore();
  }

  _drawCar(ctx, player, roadX, carScreenY, vpX, vpW, vpH, vpY) {
    const carX = roadX + player.x + player.shakeX;
    const airOff = -player.jumpY; // jumpY is upward displacement
    const cY   = carScreenY + airOff;

    const W = CAR_W * player.squashX;
    const H = CAR_H * player.squashY;
    const ox = carX - W / 2;
    const oy = cY + CAR_H - H;

    ctx.save();

    // Shadow (on ground)
    const shadowAlpha = clamp(0.35 - player.jumpY / 500, 0.05, 0.38);
    ctx.fillStyle = 'rgba(0,0,0,' + shadowAlpha + ')';
    ctx.beginPath();
    ctx.ellipse(carX, carScreenY + CAR_H - 3, W / 2 * 0.85, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyG = ctx.createLinearGradient(ox, oy, ox + W, oy + H);
    bodyG.addColorStop(0, player.color);
    bodyG.addColorStop(1, this._darken(player.color, -45));
    ctx.fillStyle = bodyG;
    this._rRect(ctx, ox, oy, W, H, 8);
    ctx.fill();

    // Windshield
    const wg = ctx.createLinearGradient(ox + W * 0.1, oy + H * 0.1, ox + W * 0.9, oy + H * 0.44);
    wg.addColorStop(0, 'rgba(160,235,255,0.92)');
    wg.addColorStop(1, 'rgba(80,180,255,0.64)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.roundRect(ox + W * 0.12, oy + H * 0.1, W * 0.76, H * 0.31, 5);
    ctx.fill();

    // Spoiler
    ctx.fillStyle = this._darken(player.color, -65);
    ctx.fillRect(ox + 3,      oy + H * 0.79, W - 6, 5);
    ctx.fillRect(ox - 5,      oy + H * 0.77, 6, 10);
    ctx.fillRect(ox + W - 1,  oy + H * 0.77, 6, 10);

    // Headlights
    ctx.fillStyle = '#fffde0';
    ctx.shadowBlur = 12; ctx.shadowColor = '#fffde0';
    ctx.fillRect(ox + 4,      oy + 4, 9, 6);
    ctx.fillRect(ox + W - 13, oy + 4, 9, 6);
    ctx.shadowBlur = 0;

    // Tail-lights
    ctx.fillStyle = '#ff2222';
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff0000';
    ctx.fillRect(ox + 3,      oy + H - 7, 9, 5);
    ctx.fillRect(ox + W - 12, oy + H - 7, 9, 5);
    ctx.shadowBlur = 0;

    // Wheels
    ctx.fillStyle = '#0a0a0a';
    [[ox - 5, oy + H * 0.2], [ox + W - 1, oy + H * 0.2],
     [ox - 5, oy + H * 0.63], [ox + W - 1, oy + H * 0.63]].forEach(([wx, wy]) => {
      ctx.fillRect(wx, wy, 6, 13);
    });

    // Player label
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = 'bold 11px Outfit,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(player.name.replace('Player ', 'P'), carX, cY + CAR_H / 2);

    // Boost flame
    if (player.boostTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.82 + Math.sin(this._gt * 20) * 0.18;
      ctx.fillStyle = '#ff7700';
      ctx.beginPath();
      ctx.moveTo(ox + W * 0.22, oy + H);
      ctx.lineTo(ox + W * 0.78, oy + H);
      ctx.lineTo(ox + W * 0.5, oy + H + 20 + Math.random() * 12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath();
      ctx.moveTo(ox + W * 0.33, oy + H);
      ctx.lineTo(ox + W * 0.67, oy + H);
      ctx.lineTo(ox + W * 0.5, oy + H + 11 + Math.random() * 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Shield aura
    if (player.shieldTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.2 * Math.sin(this._gt * 10);
      ctx.strokeStyle = '#aaddff';
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 12; ctx.shadowColor = '#aaddff';
      ctx.beginPath();
      ctx.arc(carX, cY + CAR_H / 2, CAR_W, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,220,255,0.12)';
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawHUD(ctx, player, vpX, vpY, vpW, vpH) {
    ctx.save();
    const cx = vpX + vpW / 2;
    const py = vpY + 10;

    // Background pill
    ctx.fillStyle = 'rgba(3,6,18,0.84)';
    this._rRect(ctx, cx - 115, py, 230, 54, 13);
    ctx.fill();
    ctx.strokeStyle = player.color + '55';
    ctx.lineWidth = 1.5;
    this._rRect(ctx, cx - 115, py, 230, 54, 13);
    ctx.stroke();

    // Name
    ctx.fillStyle = player.color;
    ctx.font = 'bold 12px Outfit,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(player.name, cx - 104, py + 15);

    // Score
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 16px Outfit,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.floor(player.score).toLocaleString(), cx + 104, py + 15);

    // Status bars
    const indicators = [];
    if (player.boostTimer  > 0) indicators.push({ icon: '⚡', color: '#ffd060', t: player.boostTimer  / 2.4  });
    if (player.slowTimer   > 0) indicators.push({ icon: '🐢', color: '#5599ff', t: player.slowTimer   / 2.8  });
    if (player.stunTimer   > 0) indicators.push({ icon: '💫', color: '#ff4466', t: player.stunTimer   / STUN_DUR });
    if (player.shieldTimer > 0) indicators.push({ icon: '🛡️', color: '#aaddff', t: player.shieldTimer / 7.0  });

    let ix = cx - 104;
    indicators.slice(0, 3).forEach(ind => {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this._rRect(ctx, ix, py + 31, 64, 13, 4); ctx.fill();
      ctx.fillStyle = ind.color;
      const fw = Math.max(0, Math.round(62 * ind.t));
      if (fw > 0) { this._rRect(ctx, ix + 1, py + 32, fw, 11, 3); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(ind.icon, ix + 3, py + 38);
      ix += 70;
    });

    // Speed readout
    const spd = Math.round(player.speed * (player.boostTimer > 0 ? BOOST_MULT : player.slowTimer > 0 ? SLOW_MULT : 1));
    ctx.font = 'bold 10px Outfit,sans-serif';
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(150,180,255,0.5)';
    ctx.fillText(`${spd} u/s`, cx + 104, py + 38);

    // Section name
    ctx.fillStyle = 'rgba(150,180,255,0.35)';
    ctx.font = 'bold 9px Outfit,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(player.sectionName?.toUpperCase() ?? '', cx, py + 38);

    ctx.restore();
  }

  _drawProgressBar(ctx, player, vpX, vpY, vpW, vpH) {
    const pct = clamp(player.progress / TRACK_LENGTH, 0, 1);
    const bw  = vpW * 0.55;
    const bh  = 6;
    const bx  = vpX + vpW / 2 - bw / 2;
    const by  = vpY + vpH - 16;

    ctx.save();

    // Background track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    this._rRect(ctx, bx, by, bw, bh, 3); ctx.fill();

    // Fill
    const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    pg.addColorStop(0, player.color);
    pg.addColorStop(1, '#ffd060');
    ctx.fillStyle = pg;
    if (pct > 0) { this._rRect(ctx, bx, by, bw * pct, bh, 3); ctx.fill(); }

    // Labels
    ctx.font = 'bold 9px Outfit,sans-serif';
    ctx.fillStyle = 'rgba(150,180,255,0.4)';
    ctx.textAlign = 'left';  ctx.textBaseline = 'middle'; ctx.fillText('START',  bx,      by + bh / 2);
    ctx.textAlign = 'right'; ctx.fillText('FINISH', bx + bw, by + bh / 2);

    // Car dot
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(bx + bw * pct, by + bh / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawCountdown(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (this._cdPhase === 'go') {
      const pulse = 1 + 0.14 * Math.sin(this._gt * 20);
      ctx.save(); ctx.translate(this.W / 2, this.H / 2); ctx.scale(pulse, pulse);
      ctx.font = 'bold 200px Outfit,sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 14;
      ctx.fillStyle = '#ffd060';
      ctx.strokeText('GO!', 0, 0); ctx.fillText('GO!', 0, 0);
      ctx.restore();
    } else {
      const COLS = { 3: '#e84040', 2: '#f5a323', 1: '#22dd77' };
      const scale = 1 + (1.0 - this._cdTimer) * 0.5;
      ctx.save(); ctx.translate(this.W / 2, this.H / 2); ctx.scale(scale, scale);
      ctx.globalAlpha = Math.min(this._cdTimer * 2.5, 1);
      ctx.font = 'bold 240px Outfit,sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 16;
      ctx.fillStyle = COLS[this._cdCount] || '#fff';
      ctx.strokeText(String(this._cdCount), 0, 0);
      ctx.fillText(String(this._cdCount), 0, 0);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = 'bold 32px Outfit,sans-serif';
      ctx.fillText('Get Ready!', this.W / 2, this.H / 2 + 155);
    }
    ctx.restore();
  }

  // ── Drawing utilities ─────────────────────────────────────────────
  _rRect(ctx, x, y, w, h, r) {
    const R = Math.min(r, w / 2, h / 2, 0.5);
    ctx.beginPath();
    ctx.moveTo(x + R, y);
    ctx.lineTo(x + w - R, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + R);
    ctx.lineTo(x + w, y + h - R);
    ctx.quadraticCurveTo(x + w, y + h, x + w - R, y + h);
    ctx.lineTo(x + R, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - R);
    ctx.lineTo(x, y + R);
    ctx.quadraticCurveTo(x, y, x + R, y);
    ctx.closePath();
  }

  _darken(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = clamp((n & 0xff) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
}

// ── Boot ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => { new RiftRacer(); });
