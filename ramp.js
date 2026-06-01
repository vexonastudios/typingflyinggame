'use strict';

// ═══════════════════════════════════════════════════════════
//  RAMP RACER — Physics-Based Car Jumping Game
//  Drive, rev up, launch off ramps, and land on platforms!
// ═══════════════════════════════════════════════════════════

// ─── Physics Constants ──────────────────────────────────────
const GRAVITY       = 1100;     // px/s²
const MAX_SPEED     = 680;      // max launch speed
const ACCEL_RATE    = 165;      // speed/sec while holding key
const AIR_TILT_SPD  = 2.8;     // rad/s air tilt rate
const CAR_W         = 62;
const CAR_H         = 28;
const WHEEL_R       = 10;
const PLATFORM_H    = 50;      // visual thickness
const RAMP_LEN      = 90;      // ramp surface length in px
const STAR_R        = 14;
const GROUND_Y_BASE = 420;     // base platform Y in world coords

// ─── Game Config ────────────────────────────────────────────
const ADVENTURE_LEVELS = 25;
const VERSUS_ROUNDS    = 5;
const LIVES_DEFAULT    = 3;

// ─── Colour Palettes (per world) ────────────────────────────
const WORLDS = [
  { name:'Sunny Fields',   sky1:'#5bb8f5', sky2:'#c8e6fc', ground:'#4caf50', dirt:'#6d4c41', accent:'#8bc34a',
    cloud:'rgba(255,255,255,0.7)', mtn1:'#78a87e', mtn2:'#5d9463' },
  { name:'Canyon Crossing', sky1:'#f4845f', sky2:'#ffd9b3', ground:'#d4a373', dirt:'#8d5524', accent:'#e6b980',
    cloud:'rgba(255,240,220,0.6)', mtn1:'#c17f59', mtn2:'#a06030' },
  { name:'Sky Bridges',     sky1:'#7986cb', sky2:'#c5cae9', ground:'#78909c', dirt:'#546e7a', accent:'#b0bec5',
    cloud:'rgba(200,210,230,0.6)', mtn1:'#6a7b8a', mtn2:'#4e6070' },
  { name:'Moving Mayhem',   sky1:'#26a69a', sky2:'#b2dfdb', ground:'#2e7d6f', dirt:'#1b5e50', accent:'#4db6ac',
    cloud:'rgba(200,240,230,0.5)', mtn1:'#3a9080', mtn2:'#267065' },
  { name:'Stunt Circus',    sky1:'#8e24aa', sky2:'#e1bee7', ground:'#9c27b0', dirt:'#6a1b9a', accent:'#ce93d8',
    cloud:'rgba(230,210,240,0.5)', mtn1:'#7b1fa2', mtn2:'#5c1580' },
];

const P_COLORS = ['#ff6b35', '#38bdf8'];
const P_NAMES  = ['Player 1', 'Player 2'];

// ─── Web-Audio SFX Engine ───────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _tone(f, type, dur, vol = 0.08, slide = null) {
    try {
      this._r();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, _ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, _ac.currentTime + dur);
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      o.connect(g); g.connect(_ac.destination);
      o.start(); o.stop(_ac.currentTime + dur);
    } catch(e) {}
  },
  _noise(dur, vol = 0.05) {
    try {
      this._r();
      const buf = _ac.createBuffer(1, _ac.sampleRate * dur, _ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * vol;
      const src = _ac.createBufferSource();
      const g = _ac.createGain();
      src.buffer = buf;
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      src.connect(g); g.connect(_ac.destination);
      src.start();
    } catch(e) {}
  },
  rev(pitch)   { this._tone(80 + pitch * 120, 'sawtooth', 0.08, 0.04); },
  launch()     { this._tone(200, 'sawtooth', 0.35, 0.1, 600); this._noise(0.2, 0.08); },
  land()       { this._tone(120, 'triangle', 0.15, 0.1, 60); this._noise(0.12, 0.06); },
  crash()      { this._tone(100, 'sawtooth', 0.45, 0.12, 30); this._noise(0.35, 0.1); },
  star()       { this._tone(880, 'sine', 0.15, 0.07, 1320); },
  perfect()    { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.08),i*80)); },
  countdown()  { this._tone(440, 'square', 0.14, 0.07); },
  go()         { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.22,0.1),i*90)); },
  win()        { [523,659,784,1047,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.28,0.09),i*110)); },
  fail()       { [400,320,240,180].forEach((f,i)=>setTimeout(()=>this._tone(f,'sawtooth',0.22,0.07),i*110)); },
  click()      { this._tone(600, 'sine', 0.05, 0.04); },
};

// ─── Utilities ──────────────────────────────────────────────
const lerp   = (a,b,t)   => a + (b - a) * t;
const clamp  = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rand   = (lo,hi)   => lo + Math.random() * (hi - lo);
const degRad = d          => d * Math.PI / 180;

// ─── Level Generation ───────────────────────────────────────
function generateJump(mode, jumpNum, diff) {
  // diff: 0=easy, 1=medium, 2=hard
  const dMult = [0.72, 1.0, 1.35][diff];
  const wMult = [1.4, 1.0, 0.65][diff]; // platform width multiplier (wider = easier)

  let gapDist, platW, rampAngle, heightDiff, worldIdx;

  if (mode === 'adventure') {
    worldIdx = Math.floor((jumpNum - 1) / 5);
    const stage = (jumpNum - 1) % 5;

    gapDist   = (170 + worldIdx * 45 + stage * 22) * dMult;
    platW     = Math.max(55, (230 - worldIdx * 22 - stage * 10) * wMult);
    rampAngle = 28 + rand(-4, 8) + (worldIdx >= 2 ? rand(-3, 5) : 0);
    heightDiff = worldIdx >= 2 ? (rand(-0.35, 0.5)) * (worldIdx - 1) * 30 : 0;
  } else {
    // endless / versus
    worldIdx = Math.min(4, Math.floor(jumpNum / 6));
    gapDist   = (155 + jumpNum * 10 + rand(0, 35)) * dMult;
    platW     = Math.max(45, (210 - jumpNum * 3.5 + rand(0, 25)) * wMult);
    rampAngle = 25 + rand(0, 22);
    heightDiff = jumpNum > 4 ? rand(-0.4, 0.55) * Math.min(jumpNum * 6, 90) : 0;
  }

  rampAngle = clamp(rampAngle, 18, 52);

  // Compute geometry
  const rampRad   = degRad(rampAngle);
  const rampH     = RAMP_LEN * Math.sin(rampRad);
  const rampHoriz = RAMP_LEN * Math.cos(rampRad);

  const startPlatW = 320;
  const startY     = GROUND_Y_BASE;
  const startX     = 0;

  const rampBaseX = startX + startPlatW - rampHoriz;
  const rampTipX  = startX + startPlatW;
  const rampTipY  = startY - rampH;

  const targetX = rampTipX + gapDist;
  const targetY = startY - heightDiff;

  // Compute ideal speed range (for the green zone)
  const cosA = Math.cos(rampRad);
  const sinA = Math.sin(rampRad);

  function speedForDist(d) {
    const h = targetY - rampTipY; // positive = target lower, negative = target higher
    const denom = d * Math.tan(rampRad) + h;  // should be > 0 for ramp to go up
    // fix: when launching upward, vy is negative (up), and we go up then come down
    // The time to reach horizontal distance d: t = d / (v * cosA)
    // Vertical: h = -v*sinA*t + 0.5*g*t²
    // h = -v*sinA * d/(v*cosA) + 0.5*g*(d/(v*cosA))²
    // h = -d*tanA + g*d² / (2*v²*cos²A)
    // g*d² / (2*v²*cos²A) = h + d*tanA
    // v² = g*d² / (2*cos²A*(h + d*tanA))
    const val = h + d * Math.tan(rampRad);
    if (val <= 0) return MAX_SPEED * 2; // impossible angle
    return Math.sqrt(GRAVITY * d * d / (2 * cosA * cosA * val));
  }

  const idealMin = speedForDist(gapDist);            // reach near edge
  const idealMax = speedForDist(gapDist + platW);     // don't overshoot
  const idealMid = speedForDist(gapDist + platW / 2); // center of platform

  // Generate 3 stars along the ideal arc
  const stars = [];
  const vx = idealMid * cosA;
  const vy = -idealMid * sinA;
  const tFlight = gapDist / vx;
  for (let i = 0; i < 3; i++) {
    const t = tFlight * (0.2 + i * 0.3);
    const sx = vx * t;
    const sy = vy * t + 0.5 * GRAVITY * t * t;
    stars.push({ x: rampTipX + sx, y: rampTipY + sy, collected: false });
  }

  return {
    startX, startY, startPlatW,
    rampBaseX, rampTipX, rampTipY, rampAngle, rampRad, rampHoriz,
    gapDist, targetX, targetY, platW,
    idealMin, idealMax, idealMid,
    stars,
    worldIdx: clamp(worldIdx, 0, 4),
  };
}

// ═══════════════════════════════════════════════════════════
//  PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════
class Particles {
  constructor() { this.list = []; }

  emit(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      const a = opts.angle != null ? opts.angle + rand(-opts.spread || 0.5, opts.spread || 0.5)
                                   : rand(0, Math.PI * 2);
      const spd = rand(opts.minSpd || 60, opts.maxSpd || 250);
      this.list.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd + (opts.vy || 0),
        life: rand(opts.minLife || 0.3, opts.maxLife || 0.9),
        maxLife: 0,
        r: rand(opts.minR || 2, opts.maxR || 5),
        color: opts.colors ? opts.colors[Math.floor(Math.random() * opts.colors.length)] : '#ffa040',
        gravity: opts.gravity !== false,
      });
      this.list[this.list.length - 1].maxLife = this.list[this.list.length - 1].life;
    }
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += 500 * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }

  draw(ctx, camX, camY) {
    for (const p of this.list) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - camX, p.y - camY, p.r * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER STATE (for versus mode)
// ═══════════════════════════════════════════════════════════
class PlayerState {
  constructor(id, controls) {
    this.id       = id;
    this.ctrl     = controls; // { accel, tiltUp, tiltDown }
    this.color    = P_COLORS[id];
    this.name     = P_NAMES[id];
    this.reset();
  }

  reset() {
    this.phase      = 'charging'; // charging | launching | airborne | landed | crashed
    this.speed      = 0;
    this.carX       = 60;
    this.carY       = 0; // set per jump
    this.vx         = 0;
    this.vy         = 0;
    this.angle      = 0; // car visual rotation
    this.wheelAngle = 0;
    this.onRamp     = false;
    this.score      = 0;
    this.totalScore = 0;
    this.jumpScore  = 0;
    this.starsCollected = 0;
    this.streak     = 0;
    this.lives      = LIVES_DEFAULT;
    this.jumpsDone  = 0;
    this.landingQuality = ''; // 'perfect' | 'good' | 'ok' | ''
    this.particles  = new Particles();
    this.shakeTimer = 0;
    this.revving    = false;
    this._lastAccel = false;
    this.launchTriggered = false;
    this.flashTimer = 0;
    this.flashColor = '#fff';
    this.exhaust    = [];
    this.trailDots  = [];
    this.ghostTrail = null;
  }

  resetForJump(jump) {
    this.phase = 'charging';
    this.speed = 0;
    this.carX  = jump.startX + 60;
    this.carY  = jump.startY - CAR_H;
    this.vx    = 0;
    this.vy    = 0;
    this.angle = 0;
    this.onRamp = false;
    this.jumpScore = 0;
    this.landingQuality = '';
    this.revving = false;
    this._lastAccel = false;
    this.launchTriggered = false;
    this.flashTimer = 0;
    this.trailDots = [];
    this.exhaust = [];
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════
class RampRacer {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.keys   = {};
    this.state  = 'setup'; // setup | countdown | playing | results
    this.lastTs = 0;
    this.time   = 0;
    this._shake = 0;

    // Game state
    this.mode   = 'adventure';
    this.diff   = 1;
    this.jump   = null;     // current jump definition
    this.jumpNum = 0;
    this.players = [];
    this.roundScores = []; // versus mode
    this.floatTexts = [];
    this.cloudOffsets = Array.from({length:12}, () => ({ x: rand(0, 2000), y: rand(30, 200), w: rand(60,160), speed: rand(8,25) }));

    // Camera
    this.camX = 0;
    this.camY = 0;
    this.camTargetX = 0;
    this.camTargetY = 0;

    // Countdown
    this._cdCount = 3;
    this._cdTimer = 0;

    // Level banner
    this._bannerTimer = 0;
    this._bannerText  = '';

    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD'].includes(e.code)) e.preventDefault();
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

  // ─── UI Binding ───────────────────────────────────────────
  _bindUI() {
    document.querySelectorAll('.mode-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.mode-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        const mode = el.querySelector('input').value;
        document.querySelector('.ctrl-divider').style.opacity = mode === 'versus' ? '1' : '0.2';
        document.querySelector('.p2-ctrl').style.opacity = mode === 'versus' ? '1' : '0.3';
        Sfx.click();
      });
    });

    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        Sfx.click();
      });
    });

    document.getElementById('startBtn').addEventListener('click', () => this._startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _readSettings() {
    const modeEl = document.querySelector('input[name="mode"]:checked');
    const diffEl = document.querySelector('input[name="diff"]:checked');
    this.mode = modeEl ? modeEl.value : 'adventure';
    const diffStr = diffEl ? diffEl.value : 'medium';
    this.diff = { easy:0, medium:1, hard:2 }[diffStr] ?? 1;
    this.isVersus = this.mode === 'versus';
  }

  // ─── Start / Setup ────────────────────────────────────────
  _startGame() {
    this._readSettings();
    Sfx._r();

    document.getElementById('gameSetup').style.display = 'none';
    document.getElementById('gameResults').style.display = 'none';

    const CTRL_P1 = { accel:'ArrowRight', tiltUp:'ArrowUp', tiltDown:'ArrowDown' };
    const CTRL_P2 = { accel:'KeyD', tiltUp:'KeyW', tiltDown:'KeyS' };

    this.players = [new PlayerState(0, CTRL_P1)];
    if (this.isVersus) this.players.push(new PlayerState(1, CTRL_P2));

    this.jumpNum = 0;
    this.roundScores = [];
    this.floatTexts = [];

    this._nextJump();
  }

  _nextJump() {
    this.jumpNum++;
    const effectiveMode = this.isVersus ? 'endless' : this.mode;
    this.jump = generateJump(effectiveMode, this.jumpNum, this.diff);

    // Reset players for this jump
    this.players.forEach(p => {
      p.resetForJump(this.jump);
      p.carY = this.jump.startY - CAR_H;
    });

    // Reset stars
    this.jump.stars.forEach(s => s.collected = false);

    // Camera
    this.camX = this.jump.startX - 80;
    this.camY = Math.min(this.jump.startY, this.jump.targetY) - this.H * 0.55;
    this.camTargetX = this.camX;
    this.camTargetY = this.camY;

    // Level banner
    const world = WORLDS[this.jump.worldIdx];
    if (this.mode === 'adventure') {
      this._bannerText = `${world.name} — Level ${this.jumpNum}`;
    } else if (this.isVersus) {
      this._bannerText = `Round ${this.jumpNum} of ${VERSUS_ROUNDS}`;
    } else {
      this._bannerText = `Jump ${this.jumpNum}`;
    }
    this._bannerTimer = 2.0;
    const bannerEl = document.getElementById('levelBanner');
    bannerEl.textContent = this._bannerText;
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth;
    bannerEl.classList.add('show');

    // Countdown
    this._cdCount = 3;
    this._cdTimer = 0.9;
    this.state = 'countdown';
    Sfx.countdown();
  }

  _goSetup() {
    document.getElementById('gameSetup').style.display = '';
    document.getElementById('gameResults').style.display = 'none';
    this.state = 'setup';
  }

  // ─── Main Loop ────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this.time += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Update ───────────────────────────────────────────────
  _update(dt) {
    if (this.state === 'setup' || this.state === 'results') return;

    // Countdown
    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        this._cdCount--;
        if (this._cdCount > 0) {
          this._cdTimer = 0.9;
          Sfx.countdown();
        } else {
          this.state = 'playing';
          Sfx.go();
        }
      }
      return;
    }

    // Banner timer
    if (this._bannerTimer > 0) this._bannerTimer -= dt;

    // Float texts
    this.floatTexts = this.floatTexts.filter(f => {
      f.y -= 45 * dt; f.life -= dt; f.scale = lerp(f.scale, 1, 6 * dt); return f.life > 0;
    });

    // Shake decay
    this._shake *= Math.pow(0.7, dt * 60);
    if (this._shake < 0.3) this._shake = 0;

    // Update each player
    this.players.forEach(p => this._updatePlayer(p, dt));

    // Check if all players finished this jump
    const allDone = this.players.every(p => p.phase === 'landed' || p.phase === 'crashed');
    if (allDone) {
      // Wait a beat then proceed
      // (handled by landing/crash timer in player update)
    }

    // Camera follow — track the most advanced player
    let focusP = this.players[0];
    if (this.players.length > 1) {
      focusP = this.players.reduce((a, b) => a.carX > b.carX ? a : b);
    }
    this.camTargetX = focusP.carX - this.W * 0.3;
    this.camTargetY = Math.min(this.jump.startY, this.jump.targetY, focusP.carY - 50) - this.H * 0.45;
    this.camX = lerp(this.camX, this.camTargetX, Math.min(1, 3 * dt));
    this.camY = lerp(this.camY, this.camTargetY, Math.min(1, 3 * dt));
  }

  _updatePlayer(p, dt) {
    const keys = this.keys;
    const jump = this.jump;

    p.particles.update(dt);
    p.flashTimer = Math.max(0, p.flashTimer - dt);
    p.shakeTimer = Math.max(0, p.shakeTimer - dt);

    // Exhaust particles update
    p.exhaust = p.exhaust.filter(e => {
      e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 100 * dt; e.life -= dt;
      return e.life > 0;
    });

    if (p.phase === 'charging') {
      const accelDown = !!keys[p.ctrl.accel];

      if (accelDown) {
        p.speed = Math.min(MAX_SPEED, p.speed + ACCEL_RATE * dt);
        p.revving = true;

        // Rev sound (throttled)
        if (Math.random() < 0.15) Sfx.rev(p.speed / MAX_SPEED);

        // Vibrate car
        p.carX = jump.startX + 60 + Math.sin(this.time * 35) * (p.speed / MAX_SPEED) * 3;
        p.carY = jump.startY - CAR_H + Math.sin(this.time * 28) * (p.speed / MAX_SPEED) * 1.5;

        // Exhaust
        if (Math.random() < 0.3 + p.speed / MAX_SPEED * 0.5) {
          p.exhaust.push({
            x: p.carX - 5, y: p.carY + CAR_H - 4,
            vx: rand(-40, -10), vy: rand(-15, 15),
            life: rand(0.2, 0.5),
            r: rand(3, 6 + p.speed / MAX_SPEED * 4),
            color: p.speed > MAX_SPEED * 0.7 ? '#ff6b35' : '#8899aa',
          });
        }

        p.wheelAngle += p.speed * 0.005 * dt * 60;
      } else if (p._lastAccel && !accelDown && p.speed > 10) {
        // Released! LAUNCH!
        p.phase = 'launching';
        p.launchTriggered = true;
        Sfx.launch();
      }

      p._lastAccel = accelDown;
    }

    if (p.phase === 'launching') {
      // Car drives forward across the platform and up the ramp
      const driveSpeed = p.speed * 2.5; // visual drive speed
      p.carX += driveSpeed * dt;
      p.wheelAngle += driveSpeed * 0.01 * dt * 60;

      // Check if on ramp surface
      if (p.carX + CAR_W / 2 >= jump.rampBaseX) {
        // On ramp — follow ramp surface
        const rampProgress = clamp((p.carX + CAR_W / 2 - jump.rampBaseX) / jump.rampHoriz, 0, 1);
        p.carY = jump.startY - CAR_H - rampProgress * (jump.startY - jump.rampTipY);
        p.angle = -jump.rampRad; // tilt up with ramp
        p.onRamp = true;
      } else {
        p.carY = jump.startY - CAR_H;
      }

      // Reached ramp tip — go airborne
      if (p.carX + CAR_W / 2 >= jump.rampTipX) {
        p.phase = 'airborne';
        p.carX = jump.rampTipX - CAR_W / 2;
        p.carY = jump.rampTipY - CAR_H;
        p.vx = p.speed * Math.cos(jump.rampRad);
        p.vy = -p.speed * Math.sin(jump.rampRad);
        p.angle = -jump.rampRad;

        // Launch particles
        p.particles.emit(jump.rampTipX, jump.rampTipY, 25, {
          angle: -jump.rampRad - Math.PI,
          spread: 0.8,
          minSpd: 80, maxSpd: 250,
          colors: ['#ffa040', '#ff6b35', '#ffcc00', '#fff'],
          minR: 2, maxR: 6,
        });
      }
    }

    if (p.phase === 'airborne') {
      // Air tilt
      const tiltUp   = !!keys[p.ctrl.tiltUp];
      const tiltDown = !!keys[p.ctrl.tiltDown];
      if (tiltUp)   { p.angle -= AIR_TILT_SPD * dt; p.vy -= 35 * dt; }
      if (tiltDown) { p.angle += AIR_TILT_SPD * dt; p.vy += 25 * dt; }

      // Physics
      p.vy += GRAVITY * dt;
      p.carX += p.vx * dt;
      p.carY += p.vy * dt;

      // Auto-rotate towards velocity
      const velAngle = Math.atan2(p.vy, p.vx);
      p.angle = lerp(p.angle, velAngle, Math.min(1, 2.5 * dt));

      // Trail dots
      if (p.trailDots.length === 0 || Math.hypot(p.carX - p.trailDots[p.trailDots.length-1].x, p.carY - p.trailDots[p.trailDots.length-1].y) > 15) {
        p.trailDots.push({ x: p.carX + CAR_W/2, y: p.carY + CAR_H/2 });
      }

      // Wind/exhaust trail
      if (Math.random() < 0.35) {
        p.exhaust.push({
          x: p.carX, y: p.carY + CAR_H / 2,
          vx: rand(-60, -20) + p.vx * -0.1,
          vy: rand(-10, 10),
          life: rand(0.15, 0.4),
          r: rand(2, 4),
          color: '#aabbcc',
        });
      }

      // Star collection
      jump.stars.forEach(s => {
        if (s.collected) return;
        const dx = (p.carX + CAR_W/2) - s.x;
        const dy = (p.carY + CAR_H/2) - s.y;
        if (Math.hypot(dx, dy) < STAR_R + 20) {
          s.collected = true;
          p.starsCollected++;
          p.jumpScore += 200;
          Sfx.star();
          p.particles.emit(s.x, s.y, 15, {
            colors: ['#ffcc00', '#ffe066', '#fff'],
            minSpd: 40, maxSpd: 150,
            minR: 2, maxR: 5,
          });
          this._addFloat('⭐ +200', s.x, s.y, '#ffcc00', p.id);
        }
      });

      // Landing check
      const carBottom = p.carY + CAR_H;
      const carCenterX = p.carX + CAR_W / 2;

      // Check target platform
      if (carBottom >= jump.targetY && p.vy > 0) {
        if (carCenterX >= jump.targetX && carCenterX <= jump.targetX + jump.platW) {
          // LANDED!
          this._handleLanding(p);
          return;
        }
      }

      // Check if fell below everything
      if (p.carY > Math.max(jump.startY, jump.targetY) + 300) {
        this._handleCrash(p);
        return;
      }

      // Check if went way past the target
      if (p.carX > jump.targetX + jump.platW + 100 && carBottom >= jump.targetY) {
        this._handleCrash(p);
        return;
      }
    }

    if (p.phase === 'landed') {
      p._landTimer -= dt;
      // Settle animation
      p.angle = lerp(p.angle, 0, Math.min(1, 10 * dt));
      if (p._landTimer <= 0 && !p._doneProcessed) {
        p._doneProcessed = true;
        this._processJumpEnd();
      }
    }

    if (p.phase === 'crashed') {
      p._crashTimer -= dt;
      // Tumble
      p.angle += 8 * dt;
      p.carY += 120 * dt;
      if (p._crashTimer <= 0 && !p._doneProcessed) {
        p._doneProcessed = true;
        this._processJumpEnd();
      }
    }
  }

  _handleLanding(p) {
    const jump = this.jump;
    p.phase = 'landed';
    p.carY = jump.targetY - CAR_H;
    p.vy = 0;
    p.vx = 0;
    p._landTimer = 1.8;
    p._doneProcessed = false;

    // Calculate landing precision
    const carCenter = p.carX + CAR_W / 2;
    const platCenter = jump.targetX + jump.platW / 2;
    const distFromCenter = Math.abs(carCenter - platCenter);
    const precision = 1 - clamp(distFromCenter / (jump.platW / 2), 0, 1);

    // Scoring
    let landPoints = 500;
    if (precision > 0.85) {
      p.landingQuality = 'perfect';
      landPoints = 1500;
      Sfx.perfect();
      this._addFloat('🎯 PERFECT!', carCenter, p.carY - 30, '#ffcc00', p.id);
    } else if (precision > 0.5) {
      p.landingQuality = 'great';
      landPoints = 1000;
      Sfx.land();
      this._addFloat('✨ GREAT!', carCenter, p.carY - 30, '#66ff88', p.id);
    } else {
      p.landingQuality = 'ok';
      Sfx.land();
      this._addFloat('👍 OK!', carCenter, p.carY - 30, '#88ccff', p.id);
    }

    // Streak bonus
    p.streak++;
    if (p.streak > 1) {
      const streakBonus = p.streak * 100;
      landPoints += streakBonus;
      this._addFloat(`🔥 ${p.streak}x Streak! +${streakBonus}`, carCenter, p.carY - 60, '#ff8844', p.id);
    }

    p.jumpScore += landPoints;
    p.totalScore += p.jumpScore;
    p.jumpsDone++;

    // Landing particles
    p.particles.emit(carCenter, jump.targetY, 30, {
      angle: -Math.PI / 2,
      spread: 1.2,
      minSpd: 50, maxSpd: 200,
      colors: p.landingQuality === 'perfect'
        ? ['#ffcc00', '#ffe066', '#fff', '#ff8800']
        : ['#8B7355', '#A0926B', '#C4B99A'],
      minR: 2, maxR: 6,
    });

    this._shake = p.landingQuality === 'perfect' ? 8 : 4;
    p.flashTimer = 0.3;
    p.flashColor = '#ffe066';
  }

  _handleCrash(p) {
    p.phase = 'crashed';
    p._crashTimer = 1.5;
    p._doneProcessed = false;
    p.streak = 0;
    p.lives--;

    Sfx.crash();
    this._shake = 12;

    // Save ghost trail for retry hint
    p.ghostTrail = [...p.trailDots];

    // Crash particles
    p.particles.emit(p.carX + CAR_W/2, p.carY + CAR_H/2, 40, {
      minSpd: 80, maxSpd: 300,
      colors: ['#ff4444', '#ff8844', '#ffcc44', '#888'],
      minR: 3, maxR: 8,
      minLife: 0.4, maxLife: 1.2,
    });

    this._addFloat('💥 CRASH!', p.carX + CAR_W/2, p.carY, '#ff4444', p.id);
  }

  _processJumpEnd() {
    // Check if ALL players are done
    const allDone = this.players.every(p => p.phase === 'landed' || p.phase === 'crashed');
    if (!allDone) return;

    if (this.isVersus) {
      // Record round result
      const p1 = this.players[0], p2 = this.players[1];
      const p1score = p1.phase === 'landed' ? p1.jumpScore : 0;
      const p2score = p2.phase === 'landed' ? p2.jumpScore : 0;
      this.roundScores.push({ p1: p1score, p2: p2score });

      if (this.jumpNum >= VERSUS_ROUNDS) {
        setTimeout(() => this._showResults(), 800);
        return;
      }
    } else {
      // Adventure / Endless
      const p = this.players[0];

      if (p.phase === 'crashed') {
        if (p.lives <= 0) {
          setTimeout(() => this._showResults(), 600);
          return;
        }
        // Retry same jump
        setTimeout(() => {
          p.resetForJump(this.jump);
          p.carY = this.jump.startY - CAR_H;
          this.jump.stars.forEach(s => s.collected = false);
          this.camX = this.jump.startX - 80;
          this._cdCount = 1;
          this._cdTimer = 0.5;
          this.state = 'countdown';
        }, 400);
        return;
      }

      // Check if adventure complete
      if (this.mode === 'adventure' && this.jumpNum >= ADVENTURE_LEVELS) {
        setTimeout(() => this._showResults(), 800);
        return;
      }
    }

    // Next jump
    setTimeout(() => this._nextJump(), 500);
  }

  _showResults() {
    this.state = 'results';
    const el = document.getElementById('gameResults');
    el.style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    if (this.isVersus) {
      const p1wins = this.roundScores.filter(r => r.p1 > r.p2).length;
      const p2wins = this.roundScores.filter(r => r.p2 > r.p1).length;
      const winner = p1wins >= p2wins ? this.players[0] : this.players[1];

      document.getElementById('resultsIcon').textContent = '🏆';
      document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;

      this.players.forEach((p, i) => {
        const wins = i === 0 ? p1wins : p2wins;
        const e = document.createElement('div');
        e.className = 'result-entry';
        e.innerHTML = `
          <span class="result-pos">${p === winner ? '🥇 1st' : '🥈 2nd'}</span>
          <span class="result-swatch" style="background:${p.color}"></span>
          <span class="result-name">${p.name}</span>
          <span class="result-stat">${wins} wins · ${p.totalScore} pts</span>`;
        list.appendChild(e);
      });

      Sfx.win();
    } else {
      const p = this.players[0];
      document.getElementById('resultsIcon').textContent =
        this.mode === 'adventure' && p.jumpsDone >= ADVENTURE_LEVELS ? '🎉' : '🏁';
      document.getElementById('resultsTitle').textContent =
        this.mode === 'adventure' && p.jumpsDone >= ADVENTURE_LEVELS ? 'Adventure Complete!' : 'Game Over';

      const e = document.createElement('div');
      e.className = 'result-entry';
      e.innerHTML = `
        <span class="result-pos">🌟</span>
        <span class="result-swatch" style="background:${p.color}"></span>
        <span class="result-name">Score: ${p.totalScore}</span>
        <span class="result-stat">${p.jumpsDone} jumps · ⭐ ${p.starsCollected}</span>`;
      list.appendChild(e);

      if (p.jumpsDone >= ADVENTURE_LEVELS) Sfx.win(); else Sfx.fail();
    }
  }

  _addFloat(text, x, y, color, playerId) {
    this.floatTexts.push({ text, x, y, color, life: 1.8, scale: 1.6, playerId });
  }

  // ═══════════════════════════════════════════════════════════
  //  DRAWING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.save();

    // Screen shake
    if (this._shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake);
    }

    if (this.state === 'setup' || this.state === 'results') {
      this._drawBackground(ctx, 0, 0, W, H, 0);
      ctx.restore();
      return;
    }

    // Draw game world
    this._drawBackground(ctx, this.camX, this.camY, W, H, this.jump.worldIdx);
    this._drawWorld(ctx);

    // Draw players
    this.players.forEach(p => this._drawPlayer(ctx, p));

    // HUD
    this._drawHUD(ctx);

    // Countdown
    if (this.state === 'countdown') {
      this._drawCountdown(ctx);
    }

    // Float texts
    this.floatTexts.forEach(f => {
      const sx = f.x - this.camX;
      const sy = f.y - this.camY;
      const alpha = clamp(f.life / 1.0, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${18 * f.scale}px Outfit`;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillText(f.text, sx, sy);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  _drawBackground(ctx, camX, camY, W, H, worldIdx) {
    const world = WORLDS[worldIdx || 0];

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, world.sky1);
    skyGrad.addColorStop(1, world.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Clouds (parallax)
    ctx.fillStyle = world.cloud;
    this.cloudOffsets.forEach(c => {
      const cx = ((c.x - camX * 0.08 + this.time * c.speed) % (W + 300)) - 150;
      const cy = c.y - camY * 0.03;
      this._drawCloud(ctx, cx, cy, c.w);
    });

    // Distant mountains (parallax layer 1)
    this._drawMountains(ctx, camX * 0.15, camY * 0.1, W, H, world.mtn1, 0.6, 180);

    // Mid mountains (parallax layer 2)
    this._drawMountains(ctx, camX * 0.35, camY * 0.2, W, H, world.mtn2, 0.8, 120);
  }

  _drawCloud(ctx, x, y, w) {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.18, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.2, y + 5, w * 0.3, w * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.22, y + 3, w * 0.28, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawMountains(ctx, offX, offY, W, H, color, alpha, baseH) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const mtnW = 200;
    for (let x = -mtnW; x < W + mtnW; x += mtnW * 0.6) {
      const mx = x + Math.sin((x + offX) * 0.003) * 80;
      const my = H - baseH - Math.abs(Math.sin((x + offX) * 0.005)) * 100 + offY;
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawWorld(ctx) {
    const jump = this.jump;
    const world = WORLDS[jump.worldIdx];
    const cx = this.camX, cy = this.camY;

    // ── Start Platform ──
    this._drawPlatform(ctx, jump.startX, jump.startY, jump.startPlatW, world);

    // ── Ramp ──
    ctx.fillStyle = world.dirt;
    ctx.beginPath();
    ctx.moveTo(jump.rampBaseX - cx, jump.startY - cy);
    ctx.lineTo(jump.rampTipX - cx, jump.rampTipY - cy);
    ctx.lineTo(jump.rampTipX - cx, jump.startY - cy);
    ctx.closePath();
    ctx.fill();

    // Ramp surface line
    ctx.strokeStyle = world.ground;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(jump.rampBaseX - cx, jump.startY - cy);
    ctx.lineTo(jump.rampTipX - cx, jump.rampTipY - cy);
    ctx.stroke();

    // Ramp arrow indicator
    const arrowX = (jump.rampBaseX + jump.rampTipX) / 2 - cx;
    const arrowY = (jump.startY + jump.rampTipY) / 2 - cy - 15;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 22px Outfit';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(-jump.rampRad);
    ctx.fillText('▶', 0, 0);
    ctx.restore();

    // ── Target Platform ──
    this._drawPlatform(ctx, jump.targetX, jump.targetY, jump.platW, world);

    // Platform center marker
    const markerX = jump.targetX + jump.platW / 2 - cx;
    const markerY = jump.targetY - cy - 3;
    ctx.strokeStyle = 'rgba(255,220,0,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(markerX, markerY);
    ctx.lineTo(markerX, markerY - 25);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Stars ──
    jump.stars.forEach((s, i) => {
      if (s.collected) return;
      const sx = s.x - cx;
      const sy = s.y - cy;
      const pulse = 1 + Math.sin(this.time * 4 + i * 2) * 0.15;

      // Glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(sx, sy, STAR_R * pulse * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Star shape
      ctx.globalAlpha = 1;
      this._drawStar(ctx, sx, sy, STAR_R * pulse, '#ffcc00', '#fff8e0');
    });

    // ── Ghost trail (from previous crash) ──
    this.players.forEach(p => {
      if (p.ghostTrail && p.phase === 'charging') {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        p.ghostTrail.forEach((dot, i) => {
          i === 0 ? ctx.moveTo(dot.x - cx, dot.y - cy) : ctx.lineTo(dot.x - cx, dot.y - cy);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    });

    // ── Gap danger zone ──
    // Draw some "danger" indicators in the gap
    const gapCenterX = (jump.rampTipX + jump.targetX) / 2 - cx;
    const gapBottom  = Math.max(jump.startY, jump.targetY) + 80 - cy;
    ctx.globalAlpha = 0.08 + Math.sin(this.time * 3) * 0.04;
    ctx.fillStyle = '#ff4444';
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 25 + Math.sin(this.time * 2 + i) * 5;
      ctx.font = '18px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText('⚠', gapCenterX + dx, gapBottom + i * 20);
    }
    ctx.globalAlpha = 1;
  }

  _drawPlatform(ctx, x, y, w, world) {
    const cx = this.camX, cy = this.camY;
    const px = x - cx, py = y - cy;

    // Main body
    ctx.fillStyle = world.dirt;
    ctx.fillRect(px, py, w, PLATFORM_H);

    // Grass top
    const grassGrad = ctx.createLinearGradient(0, py - 6, 0, py + 8);
    grassGrad.addColorStop(0, world.ground);
    grassGrad.addColorStop(1, world.dirt);
    ctx.fillStyle = grassGrad;
    ctx.fillRect(px, py - 4, w, 12);

    // Grass blades
    ctx.fillStyle = world.accent;
    for (let gx = px + 5; gx < px + w - 5; gx += 12 + Math.random() * 8) {
      const gh = 4 + Math.random() * 6;
      ctx.fillRect(gx, py - 4 - gh, 2, gh);
    }

    // Bottom edge shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(px, py + PLATFORM_H - 3, w, 3);

    // Side texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    for (let ly = py + 14; ly < py + PLATFORM_H; ly += 8) {
      ctx.beginPath();
      ctx.moveTo(px, ly);
      ctx.lineTo(px + w, ly);
      ctx.stroke();
    }
  }

  _drawStar(ctx, x, y, r, fill, highlight) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i * 72 - 90) * Math.PI / 180;
      const a2 = ((i * 72) + 36 - 90) * Math.PI / 180;
      ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.fillStyle = highlight;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawPlayer(ctx, p) {
    const cx = this.camX, cy = this.camY;

    // Trail dots (airborne)
    if (p.trailDots.length > 1) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      p.trailDots.forEach((d, i) => {
        i === 0 ? ctx.moveTo(d.x - cx, d.y - cy) : ctx.lineTo(d.x - cx, d.y - cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Exhaust particles
    p.exhaust.forEach(e => {
      const alpha = clamp(e.life / 0.4, 0, 0.6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x - cx, e.y - cy, e.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Particle system
    p.particles.draw(ctx, cx, cy);

    // Flash overlay
    if (p.flashTimer > 0) {
      ctx.globalAlpha = p.flashTimer * 2;
    }

    // Car body
    const carSX = p.carX - cx;
    const carSY = p.carY - cy;

    ctx.save();
    ctx.translate(carSX + CAR_W / 2, carSY + CAR_H / 2);
    ctx.rotate(p.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(2, CAR_H / 2 + 6, CAR_W * 0.45, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createLinearGradient(0, -CAR_H / 2, 0, CAR_H / 2);
    bodyGrad.addColorStop(0, p.flashTimer > 0 ? p.flashColor : this._lighten(p.color, 25));
    bodyGrad.addColorStop(1, p.flashTimer > 0 ? p.flashColor : p.color);
    ctx.fillStyle = bodyGrad;

    // Car shape
    ctx.beginPath();
    ctx.moveTo(-CAR_W / 2 + 4, CAR_H / 2 - WHEEL_R);
    ctx.lineTo(-CAR_W / 2 + 4, -CAR_H / 2 + 6);
    ctx.quadraticCurveTo(-CAR_W / 2 + 6, -CAR_H / 2, -CAR_W / 2 + 12, -CAR_H / 2);
    ctx.lineTo(CAR_W / 2 - 6, -CAR_H / 2);
    ctx.quadraticCurveTo(CAR_W / 2 - 2, -CAR_H / 2, CAR_W / 2 - 2, -CAR_H / 2 + 6);
    ctx.lineTo(CAR_W / 2 - 2, CAR_H / 2 - WHEEL_R);
    ctx.closePath();
    ctx.fill();

    // Cabin/window
    ctx.fillStyle = 'rgba(130,200,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(-6, -CAR_H / 2 + 2);
    ctx.lineTo(-2, -CAR_H / 2 - 8);
    ctx.lineTo(14, -CAR_H / 2 - 8);
    ctx.lineTo(18, -CAR_H / 2 + 2);
    ctx.closePath();
    ctx.fill();

    // Window shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, -CAR_H / 2 - 6, 4, 5);

    // Headlight
    ctx.fillStyle = '#ffe680';
    ctx.beginPath();
    ctx.ellipse(CAR_W / 2 - 4, -2, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Taillight
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.ellipse(-CAR_W / 2 + 6, -2, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels
    this._drawWheel(ctx, -CAR_W / 2 + 16, CAR_H / 2 - 2, WHEEL_R, p.wheelAngle);
    this._drawWheel(ctx, CAR_W / 2 - 16, CAR_H / 2 - 2, WHEEL_R, p.wheelAngle);

    ctx.restore();
    ctx.globalAlpha = 1;

    // Player label (versus mode)
    if (this.isVersus) {
      ctx.font = 'bold 11px Outfit';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.name, carSX + CAR_W / 2, carSY - 14);
    }
  }

  _drawWheel(ctx, x, y, r, angle) {
    // Tire
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Hub
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = angle + i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
      ctx.stroke();
    }
  }

  _drawHUD(ctx) {
    const W = this.W, H = this.H;
    const p = this.players[0]; // primary player for HUD

    // ── Speed Gauge ──
    if (p.phase === 'charging') {
      this._drawSpeedGauge(ctx, p);
    }

    // ── Lives ──
    ctx.font = 'bold 18px Outfit';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    const livesText = '❤️'.repeat(Math.max(0, p.lives));
    ctx.fillText(livesText, 20, 36);

    // ── Score ──
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`Score: ${p.totalScore}`, W - 20, 30);

    // ── Jump number ──
    ctx.font = '13px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    if (this.mode === 'adventure') {
      ctx.fillText(`Level ${this.jumpNum} / ${ADVENTURE_LEVELS}`, W - 20, 50);
    } else if (this.isVersus) {
      ctx.fillText(`Round ${this.jumpNum} / ${VERSUS_ROUNDS}`, W - 20, 50);
    } else {
      ctx.fillText(`Jump ${this.jumpNum}`, W - 20, 50);
    }

    // ── Stars collected ──
    ctx.textAlign = 'left';
    ctx.font = '14px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`⭐ ${p.starsCollected}`, 20, 60);

    // ── Streak ──
    if (p.streak > 1) {
      ctx.font = 'bold 14px Outfit';
      ctx.fillStyle = '#ff8844';
      ctx.fillText(`🔥 ${p.streak}x streak`, 20, 82);
    }

    // ── Versus: P2 info ──
    if (this.isVersus && this.players[1]) {
      const p2 = this.players[1];
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Outfit';
      ctx.fillStyle = p2.color;
      ctx.fillText(`${p2.name}: ${p2.totalScore} pts`, W / 2, 30);
    }

    // ── Instruction text ──
    if (p.phase === 'charging' && p.speed === 0) {
      ctx.textAlign = 'center';
      ctx.font = '15px Outfit';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('Hold → to rev engine, release to launch!', W / 2, H - 30);
    }
  }

  _drawSpeedGauge(ctx, p) {
    const W = this.W, H = this.H;
    const gaugeX = W / 2;
    const gaugeY = H - 80;
    const gaugeR = 80;

    const speedFrac = p.speed / MAX_SPEED;
    const startAngle = Math.PI * 0.8;
    const endAngle   = Math.PI * 0.2;
    const totalArc   = (2 * Math.PI) - (startAngle - endAngle);
    const needleAngle = startAngle + totalArc * speedFrac;

    // Background arc
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, gaugeR, startAngle, startAngle + totalArc);
    ctx.stroke();

    // Colored arc (fill based on speed)
    ctx.globalAlpha = 0.8;
    const arcGrad = ctx.createConicGradient(startAngle, gaugeX, gaugeY);
    arcGrad.addColorStop(0, '#44ff44');
    arcGrad.addColorStop(0.3, '#88ff44');
    arcGrad.addColorStop(0.5, '#ffcc00');
    arcGrad.addColorStop(0.7, '#ff8800');
    arcGrad.addColorStop(1, '#ff3333');
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, gaugeR, startAngle, needleAngle);
    ctx.stroke();

    // Needle
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(gaugeX, gaugeY);
    ctx.lineTo(
      gaugeX + Math.cos(needleAngle) * (gaugeR - 8),
      gaugeY + Math.sin(needleAngle) * (gaugeR - 8)
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Speed text
    ctx.font = 'bold 22px Outfit';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(p.speed), gaugeX, gaugeY - 18);

    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('MPH', gaugeX, gaugeY - 2);

    ctx.globalAlpha = 1;
  }

  _drawCountdown(ctx) {
    const W = this.W, H = this.H;
    const text = this._cdCount > 0 ? this._cdCount.toString() : 'GO!';
    const scale = 1 + (1 - this._cdTimer / 0.9) * 0.3;

    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(scale, scale);
    ctx.font = 'bold 72px Outfit';
    ctx.fillStyle = this._cdCount > 0 ? '#fff' : '#ffcc00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = this._cdCount > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,200,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _lighten(hex, amount) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgb(${Math.min(255,r+amount)},${Math.min(255,g+amount)},${Math.min(255,b+amount)})`;
  }
}

// ─── Boot ───────────────────────────────────────────────────
new RampRacer();
