'use strict';

// ═══════════════════════════════════════════════════════════
//  RAMP RACER v2 — Continuous Track + Horizontal Split-Screen
//  Drive, rev, launch off ramps, chain jumps, race to finish!
// ═══════════════════════════════════════════════════════════

// ─── Physics / Tuning ───────────────────────────────────────
const GRAVITY       = 1050;
const MAX_SPEED     = 640;
const ACCEL_RATE    = 150;
const DRIVE_SPEED   = 380;    // auto-roll speed between jumps (px/s)
const AIR_TILT_SPD  = 2.6;
const CAR_W         = 58;
const CAR_H         = 26;
const WHEEL_R       = 10;
const PLATFORM_H    = 48;
const STAR_R        = 13;
const RESPAWN_PENALTY = 3.0; // seconds lost on crash

// ─── Track config ───────────────────────────────────────────
const ADVENTURE_JUMPS = 15;   // jumps per adventure track
const VERSUS_JUMPS    = 12;   // jumps per versus race
const ENDLESS_LIVES   = 3;

// ─── World themes ───────────────────────────────────────────
const WORLDS = [
  { name:'Sunny Fields',    sky1:'#5bb8f5', sky2:'#c8e6fc', ground:'#4caf50', dirt:'#6d4c41', accent:'#8bc34a', mtn1:'#78a87e', mtn2:'#5d9463' },
  { name:'Canyon Crossing', sky1:'#f4845f', sky2:'#ffd9b3', ground:'#d4a373', dirt:'#8d5524', accent:'#e6b980', mtn1:'#c17f59', mtn2:'#a06030' },
  { name:'Sky Bridges',     sky1:'#7986cb', sky2:'#c5cae9', ground:'#78909c', dirt:'#546e7a', accent:'#b0bec5', mtn1:'#6a7b8a', mtn2:'#4e6070' },
  { name:'Moving Mayhem',   sky1:'#26a69a', sky2:'#b2dfdb', ground:'#2e7d6f', dirt:'#1b5e50', accent:'#4db6ac', mtn1:'#3a9080', mtn2:'#267065' },
  { name:'Stunt Circus',    sky1:'#8e24aa', sky2:'#e1bee7', ground:'#9c27b0', dirt:'#6a1b9a', accent:'#ce93d8', mtn1:'#7b1fa2', mtn2:'#5c1580' },
];

const P_COLORS = ['#ff6b35', '#38bdf8'];
const P_NAMES  = ['Player 1', 'Player 2'];

// ─── Web-Audio ───────────────────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _tone(f, type, dur, vol = 0.07, slide = null) {
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
  _noise(dur, vol = 0.04) {
    try {
      this._r();
      const buf = _ac.createBuffer(1, _ac.sampleRate * dur, _ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*vol;
      const src = _ac.createBufferSource(), g = _ac.createGain();
      src.buffer = buf;
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      src.connect(g); g.connect(_ac.destination); src.start();
    } catch(e) {}
  },
  rev(p)      { this._tone(80 + p*110, 'sawtooth', 0.07, 0.035); },
  launch()    { this._tone(200, 'sawtooth', 0.3, 0.09, 560); this._noise(0.18, 0.07); },
  land()      { this._tone(130, 'triangle', 0.14, 0.09, 55); this._noise(0.1, 0.05); },
  crash()     { this._tone(90, 'sawtooth', 0.4, 0.11, 28); this._noise(0.3, 0.09); },
  star()      { this._tone(880, 'sine', 0.13, 0.06, 1320); },
  perfect()   { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.18,0.07),i*75)); },
  countdown() { this._tone(440, 'square', 0.13, 0.07); },
  go()        { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.09),i*85)); },
  win()       { [523,659,784,1047,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.26,0.08),i*100)); },
  fail()      { [400,320,240,180].forEach((f,i)=>setTimeout(()=>this._tone(f,'sawtooth',0.2,0.07),i*100)); },
  click()     { this._tone(600,'sine',0.04,0.04); },
  finish()    { [784,1047,1318,1568].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.3,0.09),i*80)); },
};

// ─── Utilities ──────────────────────────────────────────────
const lerp   = (a,b,t)   => a + (b-a)*t;
const clamp  = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rand   = (lo,hi)   => lo + Math.random()*(hi-lo);
const degRad = d          => d * Math.PI / 180;

// ═══════════════════════════════════════════════════════════
//  TRACK GENERATION  — full multi-jump track, stitched end-to-end
// ═══════════════════════════════════════════════════════════
function generateTrack(numJumps, diff, mode) {
  const dMult = [0.70, 1.0, 1.38][diff];
  const wMult = [1.45, 1.0, 0.62][diff];

  const RAMP_LEN   = 88;
  const START_PLAT = 300; // first platform width
  const BASE_Y     = 320; // Y of the ground level (top of first platform)

  const platforms = []; // { x, y, w }
  const ramps     = []; // { baseX, baseY, tipX, tipY, rad }
  const stars     = []; // { x, y, collected }
  const jumps     = []; // metadata per jump

  // First platform
  let curX = 0;
  let curY = BASE_Y;
  let curW = START_PLAT;
  platforms.push({ x: curX, y: curY, w: curW });

  for (let j = 0; j < numJumps; j++) {
    const worldProgress = j / numJumps;
    const difficulty    = worldProgress * 0.6 + 0.4; // ramps up 0.4→1.0

    const gapDist   = (140 + j * 18 + rand(0, 30)) * dMult * difficulty;
    const platW     = Math.max(50, (220 - j * 5 + rand(0, 25)) * wMult);
    const rampAngle = clamp(24 + rand(0, 20) * difficulty, 18, 50);
    const rampRad   = degRad(rampAngle);
    const rampH     = RAMP_LEN * Math.sin(rampRad);
    const rampHoriz = RAMP_LEN * Math.cos(rampRad);

    // Height variation increases with progression
    let heightDiff = 0;
    if (j > 3) heightDiff = rand(-1, 1) * Math.min(j * 8, 80) * difficulty;

    const rampBaseX = curX + curW - rampHoriz;
    const rampTipX  = curX + curW;
    const rampTipY  = curY - rampH;

    const nextX = rampTipX + gapDist;
    const nextY = clamp(curY + heightDiff, BASE_Y - 100, BASE_Y + 120);
    const nextW = platW;

    ramps.push({ baseX: rampBaseX, baseY: curY, tipX: rampTipX, tipY: rampTipY, rad: rampRad, hLen: rampHoriz, startY: curY });
    platforms.push({ x: nextX, y: nextY, w: nextW });

    // Compute ideal speed
    const cosA = Math.cos(rampRad), sinA = Math.sin(rampRad);
    const h = nextY - rampTipY;
    function speedForDist(d) {
      const val = h + d * Math.tan(rampRad);
      if (val <= 0) return MAX_SPEED;
      return Math.sqrt(GRAVITY * d * d / (2 * cosA * cosA * val));
    }
    const idealMid = speedForDist(gapDist + platW / 2);

    // Stars along arc
    const vxS = idealMid * cosA, vyS = -idealMid * sinA;
    const tFlight = gapDist / (vxS || 1);
    for (let s = 0; s < 3; s++) {
      const t = tFlight * (0.2 + s * 0.3);
      stars.push({
        x: rampTipX + vxS * t,
        y: rampTipY + vyS * t + 0.5 * GRAVITY * t * t,
        jumpIdx: j,
        collected: false,
      });
    }

    jumps.push({ gapDist, platW, rampAngle, rampRad, nextX, nextY, nextW, idealMid,
                 rampBaseX, rampTipX, rampTipY, rampHoriz, startY: curY });

    curX = nextX; curY = nextY; curW = nextW;
  }

  // Finish line at the end of the last platform
  const finishX = curX + curW;
  const finishY = curY;

  return { platforms, ramps, stars, jumps, finishX, finishY, totalW: finishX + 200 };
}

// ═══════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════
class Particles {
  constructor() { this.list = []; }
  emit(x, y, n, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = opts.angle != null
        ? opts.angle + rand(-(opts.spread||0.5), opts.spread||0.5)
        : rand(0, Math.PI * 2);
      const spd = rand(opts.minSpd||50, opts.maxSpd||240);
      const p = {
        x, y,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd + (opts.vy||0),
        life: rand(opts.minLife||0.3, opts.maxLife||0.9),
        r: rand(opts.minR||2, opts.maxR||5),
        color: opts.colors ? opts.colors[Math.floor(Math.random()*opts.colors.length)] : '#ffa040',
        grav: opts.grav !== false,
      };
      p.maxLife = p.life;
      this.list.push(p);
    }
  }
  update(dt) {
    for (let i = this.list.length-1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx*dt; p.y += p.vy*dt;
      if (p.grav) p.vy += 480*dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }
  draw(ctx, cx, cy) {
    for (const p of this.list) {
      const a = clamp(p.life/p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x-cx, p.y-cy, p.r*(0.5+a*0.5), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ═══════════════════════════════════════════════════════════
//  PLAYER
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(id, ctrl) {
    this.id    = id;
    this.ctrl  = ctrl; // { accel, tiltUp, tiltDown }
    this.color = P_COLORS[id];
    this.name  = P_NAMES[id];
    this.particles = new Particles();
    this._init();
  }
  _init() {
    this.phase      = 'charging'; // charging|launching|airborne|driving|respawning|finished
    this.x          = 60;
    this.y          = 0;
    this.vx         = 0;
    this.vy         = 0;
    this.speed      = 0;
    this.angle      = 0;
    this.wheelAngle = 0;
    this.jumpIdx    = 0;      // which jump in the track we're at
    this.lives      = ENDLESS_LIVES;
    this.totalScore = 0;
    this.starsGot   = 0;
    this.streak     = 0;
    this.raceTime   = 0;      // total elapsed race time
    this.penaltyTime= 0;      // accumulated penalty seconds
    this.respawnTimer = 0;
    this.flashTimer = 0;
    this.flashColor = '#fff';
    this.exhaust    = [];
    this.trailDots  = [];
    this.ghostTrail = null;
    this.finished   = false;
    this.finishTime = null;
    this._lastAccel = false;
    this.camX       = 0;
    this.camY       = 0;
  }

  initForTrack(track) {
    this._init();
    const firstPlat = track.platforms[0];
    this.x = firstPlat.x + 60;
    this.y = firstPlat.y - CAR_H;
    this.camX = this.x - 200;
    this.camY = this.y - 150;
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME
// ═══════════════════════════════════════════════════════════
class RampRacer {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.keys   = {};
    this.state  = 'setup';
    this.lastTs = 0;
    this.time   = 0;
    this._globalShake = 0;

    this.track   = null;
    this.players = [];
    this.mode    = 'adventure';
    this.diff    = 1;
    this.isVersus = false;

    this._cdCount = 3;
    this._cdTimer = 0;
    this.floatTexts = [];
    this.clouds = Array.from({length:14}, () => ({
      x: rand(0, 3000), y: rand(20, 180), w: rand(65, 160), spd: rand(8, 24)
    }));

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

  // ─── UI ─────────────────────────────────────────────────
  _bindUI() {
    document.querySelectorAll('.mode-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.mode-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
        const m = el.querySelector('input').value;
        document.querySelector('.ctrl-divider').style.opacity = m === 'versus' ? '1' : '0.2';
        document.querySelector('.p2-ctrl').style.opacity = m === 'versus' ? '1' : '0.3';
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
    document.getElementById('startBtn').addEventListener('click',   () => this._startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _readSettings() {
    const mEl = document.querySelector('input[name="mode"]:checked');
    const dEl = document.querySelector('input[name="diff"]:checked');
    this.mode      = mEl ? mEl.value : 'adventure';
    const ds       = dEl ? dEl.value : 'medium';
    this.diff      = { easy:0, medium:1, hard:2 }[ds] ?? 1;
    this.isVersus  = this.mode === 'versus';
    this.isEndless = this.mode === 'endless';
  }

  _startGame() {
    this._readSettings();
    Sfx._r();
    document.getElementById('gameSetup').style.display   = 'none';
    document.getElementById('gameResults').style.display = 'none';

    const numJumps = this.isEndless ? 30 : this.isVersus ? VERSUS_JUMPS : ADVENTURE_JUMPS;
    this.track = generateTrack(numJumps, this.diff, this.mode);

    const C1 = { accel:'ArrowRight', tiltUp:'ArrowUp',    tiltDown:'ArrowDown' };
    const C2 = { accel:'KeyD',       tiltUp:'KeyW',        tiltDown:'KeyS'     };

    this.players = [new Player(0, C1)];
    if (this.isVersus) this.players.push(new Player(1, C2));

    this.players.forEach(p => p.initForTrack(this.track));
    this.floatTexts = [];
    this.raceStarted = false;

    this._cdCount = 3;
    this._cdTimer = 0.95;
    this.state = 'countdown';
    Sfx.countdown();
  }

  _goSetup() {
    document.getElementById('gameSetup').style.display   = '';
    document.getElementById('gameResults').style.display = 'none';
    this.state = 'setup';
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
        if (this._cdCount > 0) { this._cdTimer = 0.95; Sfx.countdown(); }
        else { this.state = 'racing'; this.raceStarted = true; Sfx.go(); }
      }
      return;
    }

    // Float texts
    this.floatTexts = this.floatTexts.filter(f => {
      f.y -= 42*dt; f.life -= dt; return f.life > 0;
    });

    // Global shake
    this._globalShake *= Math.pow(0.7, dt*60);
    if (this._globalShake < 0.2) this._globalShake = 0;

    // Update players
    this.players.forEach(p => {
      if (!p.finished) p.raceTime += dt;
      this._updatePlayer(p, dt);
    });

    // Check race finish
    const allDone = this.players.every(p => p.finished);
    if (allDone && this.state === 'racing') {
      this.state = 'done';
      setTimeout(() => this._showResults(), 1200);
    }

    // Cameras
    this.players.forEach(p => this._updateCamera(p, dt));
  }

  _updateCamera(p, dt) {
    const vpH = this.isVersus ? this.H / 2 : this.H;
    const targetCX = p.x - this.W * 0.28;
    const targetCY = p.y - vpH * 0.42;
    p.camX = lerp(p.camX, targetCX, Math.min(1, 4*dt));
    p.camY = lerp(p.camY, targetCY, Math.min(1, 3.5*dt));
  }

  _updatePlayer(p, dt) {
    const track = this.track;
    p.particles.update(dt);
    p.flashTimer = Math.max(0, p.flashTimer - dt);

    // Exhaust update
    p.exhaust = p.exhaust.filter(e => {
      e.x += e.vx*dt; e.y += e.vy*dt; e.vy += 90*dt; e.life -= dt;
      return e.life > 0;
    });

    // --- RESPAWNING ---
    if (p.phase === 'respawning') {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        // Put car back at start of current jump's platform
        const ramp = track.ramps[p.jumpIdx];
        const plat = track.platforms[p.jumpIdx];
        p.x = plat.x + 60;
        p.y = plat.y - CAR_H;
        p.vx = 0; p.vy = 0; p.speed = 0;
        p.angle = 0;
        p.trailDots = [];
        p.ghostTrail = [...(p._lastTrail||[])];
        p.phase = 'charging';
        p.flashTimer = 0.3;
        p.flashColor = '#88aaff';
      }
      return;
    }

    // --- FINISHED ---
    if (p.phase === 'finished') return;

    // --- CHARGING ---
    if (p.phase === 'charging') {
      const accel = !!this.keys[p.ctrl.accel];
      if (accel) {
        p.speed = Math.min(MAX_SPEED, p.speed + ACCEL_RATE * dt);
        // vibrate car while revving
        const shake = (p.speed / MAX_SPEED);
        p.x = track.platforms[p.jumpIdx].x + 60 + Math.sin(this.time * 36) * shake * 2.5;
        p.y = track.platforms[p.jumpIdx].y - CAR_H + Math.sin(this.time * 29) * shake * 1.2;
        p.wheelAngle += p.speed * 0.005 * dt * 60;
        if (Math.random() < 0.25 + shake*0.5) {
          p.exhaust.push({
            x: p.x - 6, y: p.y + CAR_H - 4,
            vx: rand(-35,-8), vy: rand(-12,12),
            life: rand(0.2,0.45), r: rand(3, 5 + shake*4),
            color: p.speed > MAX_SPEED*0.7 ? '#ff6b35' : '#8899aa',
          });
        }
        if (Math.random() < 0.14) Sfx.rev(p.speed / MAX_SPEED);
      } else if (p._lastAccel && p.speed > 8) {
        // Released — launch!
        p.phase = 'launching';
        Sfx.launch();
      }
      p._lastAccel = accel;
    }

    // --- LAUNCHING (driving across platform and up ramp) ---
    if (p.phase === 'launching') {
      const ramp = track.ramps[p.jumpIdx];
      const driveSpd = p.speed * 2.4;
      p.x += driveSpd * dt;
      p.wheelAngle += driveSpd * 0.01 * dt * 60;

      // Follow ramp slope when on it
      if (p.x + CAR_W/2 >= ramp.baseX) {
        const progress = clamp((p.x + CAR_W/2 - ramp.baseX) / ramp.hLen, 0, 1);
        p.y = ramp.startY - CAR_H - progress * (ramp.startY - ramp.tipY);
        p.angle = -ramp.rad;
      } else {
        p.y = ramp.startY - CAR_H;
      }

      // Take off!
      if (p.x + CAR_W/2 >= ramp.tipX) {
        p.phase = 'airborne';
        p.x     = ramp.tipX - CAR_W/2;
        p.y     = ramp.tipY - CAR_H;
        p.vx    = p.speed * Math.cos(ramp.rad);
        p.vy    = -p.speed * Math.sin(ramp.rad);
        p.angle = -ramp.rad;
        p._lastTrail = [];
        p.trailDots = [];
        p.particles.emit(ramp.tipX, ramp.tipY, 22, {
          angle: -ramp.rad - Math.PI, spread: 0.85,
          minSpd:70, maxSpd:230,
          colors:['#ffa040','#ff6b35','#ffcc00','#fff'],
          minR:2, maxR:5,
        });
      }
    }

    // --- AIRBORNE ---
    if (p.phase === 'airborne') {
      const tiltUp   = !!this.keys[p.ctrl.tiltUp];
      const tiltDown = !!this.keys[p.ctrl.tiltDown];
      if (tiltUp)   { p.angle -= AIR_TILT_SPD*dt; p.vy -= 30*dt; }
      if (tiltDown) { p.angle += AIR_TILT_SPD*dt; p.vy += 22*dt; }

      p.vy += GRAVITY * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.angle = lerp(p.angle, Math.atan2(p.vy, p.vx), Math.min(1, 2.2*dt));
      p.wheelAngle += 4 * dt;

      // Trail
      const last = p.trailDots[p.trailDots.length-1];
      if (!last || Math.hypot(p.x-last.x, p.y-last.y) > 14) {
        p.trailDots.push({x:p.x+CAR_W/2, y:p.y+CAR_H/2});
        if (p._lastTrail) p._lastTrail.push({x:p.x+CAR_W/2, y:p.y+CAR_H/2});
      }

      // Air exhaust
      if (Math.random() < 0.3) {
        p.exhaust.push({
          x:p.x, y:p.y+CAR_H/2,
          vx:rand(-50,-18)+p.vx*-0.08, vy:rand(-8,8),
          life:rand(0.12,0.35), r:rand(2,4), color:'#aabbcc',
        });
      }

      // Star collection
      track.stars.forEach(s => {
        if (s.collected || s.jumpIdx !== p.jumpIdx) return;
        if (Math.hypot((p.x+CAR_W/2)-s.x, (p.y+CAR_H/2)-s.y) < STAR_R+18) {
          s.collected = true;
          p.starsGot++;
          p.totalScore += 200;
          Sfx.star();
          p.particles.emit(s.x, s.y, 14, {
            colors:['#ffcc00','#ffe066','#fff'], minSpd:40, maxSpd:140, minR:2, maxR:5,
          });
          this._addFloat('⭐ +200', s.x, s.y, '#ffcc00', p);
        }
      });

      // Target platform
      const nextPlat = track.platforms[p.jumpIdx + 1];
      const carBot  = p.y + CAR_H;
      const carCx   = p.x + CAR_W/2;

      if (nextPlat && carBot >= nextPlat.y && p.vy > 0) {
        if (carCx >= nextPlat.x && carCx <= nextPlat.x + nextPlat.w) {
          this._handleLanding(p, nextPlat);
          return;
        }
      }

      // Fell too far
      if (p.y > Math.max(...track.platforms.map(pl => pl.y)) + 350) {
        this._handleCrash(p);
        return;
      }
      // Overshot
      if (nextPlat && p.x > nextPlat.x + nextPlat.w + 80 && carBot >= nextPlat.y) {
        this._handleCrash(p);
        return;
      }
    }

    // --- DRIVING (rolling to next ramp after landing) ---
    if (p.phase === 'driving') {
      const ramp = track.ramps[p.jumpIdx];
      if (!ramp) {
        // No more ramps — reached finish line area
        if (p.x >= track.finishX) {
          p.phase = 'finished';
          p.finished = true;
          p.finishTime = p.raceTime;
          Sfx.finish();
          this._addFloat('🏁 FINISH!', p.x, p.y - 40, '#ffcc00', p);
          p.particles.emit(p.x + CAR_W/2, p.y, 50, {
            colors:['#ffcc00','#ff6b35','#fff','#66ff88'],
            minSpd:80, maxSpd:300, minR:2, maxR:7,
            angle:-Math.PI/2, spread:Math.PI,
          });
        }
        p.x += DRIVE_SPEED * dt;
        p.wheelAngle += DRIVE_SPEED * 0.012 * dt * 60;

        // Exhaust while driving
        if (Math.random() < 0.2) {
          p.exhaust.push({
            x:p.x-6, y:p.y+CAR_H-4,
            vx:rand(-25,-8), vy:rand(-8,8),
            life:rand(0.15,0.3), r:rand(2,4), color:'#8899aa',
          });
        }
        return;
      }

      // Roll toward the next ramp base
      p.x += DRIVE_SPEED * dt;
      p.y = track.platforms[p.jumpIdx].y - CAR_H; // stay on platform
      p.angle = lerp(p.angle, 0, Math.min(1, 12*dt));
      p.wheelAngle += DRIVE_SPEED * 0.012 * dt * 60;

      if (Math.random() < 0.2) {
        p.exhaust.push({
          x:p.x-6, y:p.y+CAR_H-4,
          vx:rand(-25,-8), vy:rand(-8,8),
          life:rand(0.15,0.3), r:rand(2,4), color:'#8899aa',
        });
      }

      // Arrived at ramp base
      if (p.x + CAR_W/2 >= ramp.baseX - 10) {
        p.x = ramp.baseX - CAR_W/2 - 12;
        p.y = track.platforms[p.jumpIdx].y - CAR_H;
        p.speed = 0;
        p._lastAccel = false;
        p.phase = 'charging';
        p.trailDots = [];
      }
    }
  }

  _handleLanding(p, plat) {
    const carCx = p.x + CAR_W/2;
    const platCenter = plat.x + plat.w/2;
    const precision = 1 - clamp(Math.abs(carCx - platCenter) / (plat.w/2), 0, 1);

    p.phase = 'driving';
    p.y  = plat.y - CAR_H;
    p.vx = 0; p.vy = 0;
    p.trailDots = [];
    p.jumpIdx++;

    // Score & feedback
    let pts = 500;
    let label = '👍 OK!', col = '#88ccff';
    if (precision > 0.85) {
      pts = 1500; label = '🎯 PERFECT!'; col = '#ffcc00'; Sfx.perfect();
      p.particles.emit(carCx, plat.y, 35, {
        angle:-Math.PI/2, spread:1.3,
        colors:['#ffcc00','#ffe066','#fff','#ff8800'], minSpd:50, maxSpd:220, minR:2, maxR:6,
      });
    } else if (precision > 0.5) {
      pts = 1000; label = '✨ GREAT!'; col = '#66ff88'; Sfx.land();
      p.particles.emit(carCx, plat.y, 20, {
        angle:-Math.PI/2, spread:1.0,
        colors:['#8B7355','#A0926B','#C4B99A'], minSpd:40, maxSpd:180, minR:2, maxR:5,
      });
    } else {
      Sfx.land();
    }

    p.streak++;
    if (p.streak > 1) {
      const bonus = p.streak * 100;
      pts += bonus;
      this._addFloat(`🔥 ${p.streak}x +${bonus}`, carCx, plat.y - 60, '#ff8844', p);
    }

    p.totalScore += pts;
    this._addFloat(label, carCx, plat.y - 30, col, p);
    this._globalShake = precision > 0.85 ? 7 : 3;
    p.flashTimer = 0.25; p.flashColor = '#ffe066';
  }

  _handleCrash(p) {
    p.phase = 'respawning';
    p.respawnTimer = RESPAWN_PENALTY;
    p.streak = 0;
    p.lives  = Math.max(0, p.lives - 1);
    p.vx = 0; p.vy = 0;
    Sfx.crash();
    this._globalShake = 11;
    p._lastTrail = p.trailDots.slice();
    p.particles.emit(p.x+CAR_W/2, p.y+CAR_H/2, 38, {
      colors:['#ff4444','#ff8844','#ffcc44','#888'],
      minSpd:80, maxSpd:280, minR:3, maxR:8, minLife:0.4, maxLife:1.1,
    });
    this._addFloat('💥 CRASH!', p.x+CAR_W/2, p.y, '#ff4444', p);
    p.flashTimer = 0.5; p.flashColor = '#ff4444';

    // Endless: out of lives
    if (this.isEndless && p.lives <= 0) {
      setTimeout(() => this._showResults(), 1000);
    }
  }

  _showResults() {
    this.state = 'results';
    document.getElementById('gameResults').style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    if (this.isVersus) {
      const sorted = [...this.players].sort((a,b) => (a.finishTime||99999) - (b.finishTime||99999));
      const winner = sorted[0];
      document.getElementById('resultsIcon').textContent = '🏆';
      document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;
      sorted.forEach((p, i) => {
        const e = document.createElement('div');
        e.className = 'result-entry';
        const t = p.finishTime ? this._fmtTime(p.finishTime) : 'DNF';
        e.innerHTML = `
          <span class="result-pos">${i===0?'🥇 1st':'🥈 2nd'}</span>
          <span class="result-swatch" style="background:${p.color}"></span>
          <span class="result-name">${p.name}</span>
          <span class="result-stat">${t} · ⭐${p.starsGot} · ${p.totalScore}pts</span>`;
        list.appendChild(e);
      });
      Sfx.win();
    } else {
      const p = this.players[0];
      const completed = p.finished;
      document.getElementById('resultsIcon').textContent = completed ? '🏁' : '💀';
      document.getElementById('resultsTitle').textContent = completed ? 'Track Complete!' : 'Game Over';
      const e = document.createElement('div');
      e.className = 'result-entry';
      e.innerHTML = `
        <span class="result-pos">🌟</span>
        <span class="result-swatch" style="background:${p.color}"></span>
        <span class="result-name">${p.totalScore} pts</span>
        <span class="result-stat">${this._fmtTime(p.raceTime)} · ⭐${p.starsGot} · ${p.jumpIdx}/${this.track.jumps.length} jumps</span>`;
      list.appendChild(e);
      if (completed) Sfx.win(); else Sfx.fail();
    }
  }

  _fmtTime(t) {
    if (!t) return '--:--.--';
    const m = Math.floor(t/60);
    const s = (t%60).toFixed(2).padStart(5,'0');
    return `${m}:${s}`;
  }

  _addFloat(text, x, y, color, player) {
    this.floatTexts.push({text, x, y, color, life:1.7, player});
  }

  // ═══════════════════════════════════════════════════════════
  //  DRAWING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this._globalShake > 0.2) {
      ctx.translate((Math.random()-0.5)*this._globalShake, (Math.random()-0.5)*this._globalShake);
    }

    ctx.clearRect(-20,-20, this.W+40, this.H+40);

    if (this.state === 'setup' || this.state === 'results') {
      this._drawBackground(ctx, 0, 0, this.W, this.H, 0);
      ctx.restore();
      return;
    }

    if (this.isVersus) {
      const vpH = Math.floor(this.H / 2);
      // Player 1 — top half
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, this.W, vpH); ctx.clip();
      this._drawViewport(ctx, this.players[0], 0, 0, this.W, vpH);
      ctx.restore();

      // Player 2 — bottom half
      ctx.save();
      ctx.beginPath(); ctx.rect(0, vpH, this.W, vpH); ctx.clip();
      ctx.translate(0, vpH);
      this._drawViewport(ctx, this.players[1], 0, 0, this.W, vpH);
      ctx.restore();

      // Divider line
      ctx.fillStyle = '#000';
      ctx.fillRect(0, vpH - 2, this.W, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, vpH - 1, this.W, 1);

      // Player labels on divider
      ['P1 ▲', 'P2 ▼'].forEach((label, i) => {
        const px = 20;
        const py = vpH + (i === 0 ? -8 : 14);
        ctx.font = 'bold 11px Outfit';
        ctx.fillStyle = P_COLORS[i];
        ctx.textAlign = 'left';
        ctx.fillText(label, px, py);
      });
    } else {
      // Single player full screen
      this._drawViewport(ctx, this.players[0], 0, 0, this.W, this.H);
    }

    ctx.restore();
  }

  _drawViewport(ctx, p, ox, oy, vpW, vpH) {
    const worldIdx = Math.min(4, Math.floor(p.jumpIdx / Math.ceil(this.track.jumps.length / 5)));

    // Background
    this._drawBackground(ctx, p.camX, p.camY, vpW, vpH, worldIdx);

    // World elements (relative to player's camera)
    ctx.save();
    ctx.translate(-p.camX + ox, -p.camY + oy);
    this._drawTrack(ctx, p.camX, p.camY, p.camX + vpW, p.camY + vpH, worldIdx);
    this._drawPlayer(ctx, p, 0, 0);
    ctx.restore();

    // Full-screen impact flash
    if (p.flashTimer > 0) {
      ctx.globalAlpha = Math.min(1, p.flashTimer * 3);
      ctx.fillStyle = p.flashColor;
      ctx.fillRect(ox, oy, vpW, vpH);
      ctx.globalAlpha = 1;
    }

    // Countdown
    if (this.state === 'countdown') {
      this._drawCountdown(ctx, ox, oy, vpW, vpH);
    }

    // Float texts for this player
    this.floatTexts.forEach(f => {
      if (f.player && f.player.id !== p.id) return;
      const sx = f.x - p.camX + ox;
      const sy = f.y - p.camY + oy;
      if (sx < ox || sx > ox+vpW || sy < oy || sy > oy+vpH) return;
      const alpha = clamp(f.life / 1.0, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 17px Outfit';
      ctx.fillStyle = f.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.strokeText(f.text, sx, sy);
      ctx.fillText(f.text, sx, sy);
    });
    ctx.globalAlpha = 1;

    // HUD
    this._drawHUD(ctx, p, ox, oy, vpW, vpH);
  }

  _drawBackground(ctx, camX, camY, vpW, vpH, worldIdx) {
    const world = WORLDS[worldIdx || 0];
    const grad = ctx.createLinearGradient(0, 0, 0, vpH);
    grad.addColorStop(0, world.sky1);
    grad.addColorStop(1, world.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vpW, vpH);

    // Dynamic sun/moon
    const sunX = (vpW * 0.75 - camX * 0.01) % (vpW + 400) - 200;
    const sunY = vpH * 0.25 + Math.sin(this.time * 0.5) * 10;
    const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 150);
    sunG.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    sunG.addColorStop(0.3, 'rgba(255, 255, 200, 0.2)');
    sunG.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = sunG;
    ctx.beginPath(); ctx.arc(sunX, sunY, 150, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sunX, sunY, 35, 0, Math.PI*2); ctx.fill();

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    this.clouds.forEach(c => {
      const cx = ((c.x - camX*0.04 + this.time*c.spd) % (vpW + 300)) - 120;
      const cy = c.y - camY * 0.025;
      this._drawCloud(ctx, cx, cy, c.w);
    });

    // Parallax mountains with depth
    this._drawMountains(ctx, camX*0.08, camY*0.05, vpW, vpH, this._lighten(world.mtn1, 30), 0.4, 220, 80);
    this._drawMountains(ctx, camX*0.16, camY*0.10, vpW, vpH, world.mtn1, 0.6, 160, 110);
    this._drawMountains(ctx, camX*0.32, camY*0.18, vpW, vpH, world.mtn2, 0.85, 100, 150);
  }

  _drawCloud(ctx, x, y, w) {
    ctx.beginPath();
    ctx.arc(x - w*0.25, y, w*0.2, 0, Math.PI*2);
    ctx.arc(x, y - w*0.1, w*0.28, 0, Math.PI*2);
    ctx.arc(x + w*0.25, y, w*0.22, 0, Math.PI*2);
    ctx.fill();
    
    // Cloud bottom flattening
    ctx.fillRect(x - w*0.25, y, w*0.5, w*0.2);
  }

  _drawMountains(ctx, offX, offY, vpW, vpH, color, alpha, baseH, freq) {
    ctx.globalAlpha = alpha;
    
    const grad = ctx.createLinearGradient(0, vpH - baseH - 100, 0, vpH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, this._lighten(color, -40));
    ctx.fillStyle = grad;

    ctx.beginPath(); ctx.moveTo(0, vpH);
    for (let x = -200; x < vpW+200; x += 80) {
      const mx = x + Math.sin((x+offX)*0.002)*freq;
      const my = vpH - baseH - Math.abs(Math.sin((x+offX)*0.004))*120 + offY;
      ctx.lineTo(mx, my);
    }
    ctx.lineTo(vpW+10, vpH); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawTrack(ctx, visL, visT, visR, visB, worldIdx) {
    const world = WORLDS[worldIdx || 0];
    const track  = this.track;

    // Platforms
    track.platforms.forEach(pl => {
      if (pl.x > visR || pl.x + pl.w < visL) return;
      this._drawPlatform(ctx, pl.x, pl.y, pl.w, world);
    });

    // Ramps with slick racing stripes
    track.ramps.forEach(ramp => {
      if (ramp.tipX < visL || ramp.baseX > visR) return;
      
      // Ramp body
      ctx.fillStyle = this._lighten(world.dirt, -15);
      ctx.beginPath();
      ctx.moveTo(ramp.baseX, ramp.startY);
      ctx.lineTo(ramp.tipX, ramp.tipY);
      ctx.lineTo(ramp.tipX, ramp.startY);
      ctx.closePath(); ctx.fill();

      // Ramp top surface (racing stripe texture)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(ramp.baseX, ramp.startY);
      ctx.lineTo(ramp.tipX, ramp.tipY);
      ctx.lineTo(ramp.tipX, ramp.tipY + 12);
      ctx.lineTo(ramp.baseX, ramp.startY + 12);
      ctx.closePath();
      ctx.clip();
      
      // Draw alternating stripes
      const stripeW = 24;
      const numStripes = Math.ceil(ramp.hLen / (stripeW * Math.cos(ramp.rad)));
      for(let i=0; i<numStripes; i++) {
        ctx.fillStyle = (i%2===0) ? '#ffb347' : '#222';
        const sx = ramp.baseX + i * stripeW * Math.cos(ramp.rad);
        const sy = ramp.startY - i * stripeW * Math.sin(ramp.rad);
        ctx.beginPath();
        ctx.moveTo(sx, sy+20); ctx.lineTo(sx, sy-50);
        const nx = sx + stripeW * Math.cos(ramp.rad);
        const ny = sy - stripeW * Math.sin(ramp.rad);
        ctx.lineTo(nx, ny-50); ctx.lineTo(nx, ny+20);
        ctx.fill();
      }
      ctx.restore();

      // Top glowing edge
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(ramp.baseX, ramp.startY);
      ctx.lineTo(ramp.tipX, ramp.tipY);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Stars
    track.stars.forEach((s, i) => {
      if (s.collected) return;
      if (s.x < visL-30 || s.x > visR+30) return;
      const pulse = 1 + Math.sin(this.time*4 + i*2)*0.14;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(s.x, s.y, STAR_R*pulse*1.8, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      this._drawStar(ctx, s.x, s.y, STAR_R*pulse);
    });

    // Finish line
    const fx = track.finishX, fy = track.finishY;
    if (fx >= visL && fx <= visR) {
      ctx.fillStyle = '#fff'; ctx.fillRect(fx, fy - 120, 6, 120);
      const flagColors = ['#fff','#111'];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          ctx.fillStyle = flagColors[(row+col)%2];
          ctx.fillRect(fx + 6 + col*14, fy - 120 + row*14 + Math.sin(this.time*4 + col)*4, 14, 14);
        }
      }
      ctx.font = '900 16px Outfit';
      ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center';
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      ctx.fillText('FINISH', fx + 34, fy - 130);
      ctx.shadowBlur = 0;

      ctx.strokeStyle = 'rgba(255,204,0,0.6)';
      ctx.lineWidth = 4; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(fx+3, fy); ctx.lineTo(fx+3, fy - 120); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawPlatform(ctx, x, y, w, world) {
    // Dirt body with gradient depth
    const dirtG = ctx.createLinearGradient(0, y, 0, y+PLATFORM_H);
    dirtG.addColorStop(0, world.dirt);
    dirtG.addColorStop(1, this._lighten(world.dirt, -20));
    ctx.fillStyle = dirtG;
    ctx.beginPath(); ctx.roundRect(x, y, w, PLATFORM_H, [0,0,8,8]); ctx.fill();

    // Thick grassy top
    const grad = ctx.createLinearGradient(0, y-8, 0, y+10);
    grad.addColorStop(0, this._lighten(world.ground, 20));
    grad.addColorStop(0.4, world.ground);
    grad.addColorStop(1, this._lighten(world.dirt, 10));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y-6, w, 16, [6,6,0,0]); ctx.fill();

    // Decorative repeating grass blades
    ctx.fillStyle = world.accent;
    for (let gx = x+8; gx < x+w-8; gx += 14) {
      const gh = 4 + Math.sin(gx)*3;
      ctx.beginPath();
      ctx.moveTo(gx, y-6);
      ctx.lineTo(gx+2, y-6-gh);
      ctx.lineTo(gx+4, y-6);
      ctx.fill();
    }
  }

  _drawStar(ctx, x, y, r) {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i*72-90)*Math.PI/180, a2 = (i*72+36-90)*Math.PI/180;
      ctx.lineTo(x+Math.cos(a1)*r, y+Math.sin(a1)*r);
      ctx.lineTo(x+Math.cos(a2)*r*0.42, y+Math.sin(a2)*r*0.42);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.arc(x-r*0.18, y-r*0.18, r*0.28, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  _drawPlayer(ctx, p, ox, oy) {
    // Ghost trail
    if (p.ghostTrail && p.ghostTrail.length > 1 && (p.phase === 'charging' || p.phase === 'driving')) {
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5,8]);
      ctx.beginPath();
      p.ghostTrail.forEach((d,i)=>{ i===0?ctx.moveTo(d.x,d.y):ctx.lineTo(d.x,d.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Air trail dots
    if (p.trailDots.length > 1) {
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([3,6]);
      ctx.beginPath();
      p.trailDots.forEach((d,i)=>{ i===0?ctx.moveTo(d.x,d.y):ctx.lineTo(d.x,d.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // Wind lines (Speed lines)
    if (p.phase === 'airborne' && Math.hypot(p.vx, p.vy) > 300) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = Math.atan2(p.vy, p.vx);
      for(let i=0; i<4; i++) {
        const lx = p.x + CAR_W/2 + rand(-40, 40);
        const ly = p.y + CAR_H/2 + rand(-30, 30);
        const len = rand(40, 100);
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx - Math.cos(a)*len, ly - Math.sin(a)*len);
      }
      ctx.stroke();
    }

    // Exhaust
    p.exhaust.forEach(e => {
      ctx.globalAlpha = clamp(e.life/0.35, 0, 0.55);
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Particles
    p.particles.draw(ctx, 0, 0);

    // Respawn ghost
    if (p.phase === 'respawning') {
      const t = 1 - p.respawnTimer / RESPAWN_PENALTY;
      ctx.globalAlpha = 0.3 + Math.sin(this.time * 10) * 0.15;
      ctx.font = 'bold 20px Outfit';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#88aaff';
      ctx.fillText(`Respawn ${Math.ceil(p.respawnTimer)}s…`, p.x + CAR_W/2, p.y - 20);
      ctx.globalAlpha = 1;
    }

    // ── Stylized Race Car ──
    ctx.save();
    ctx.translate(p.x + CAR_W/2, p.y + CAR_H/2);
    ctx.rotate(p.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(0, CAR_H/2+4, CAR_W*0.48, 5, 0, 0, Math.PI*2); ctx.fill();

    // Spoiler
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.roundRect(-CAR_W/2 - 2, -CAR_H/2 - 8, 8, 12, 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.roundRect(-CAR_W/2 - 6, -CAR_H/2 - 8, 14, 4, 2); ctx.fill();

    // Body
    const bodyG = ctx.createLinearGradient(0, -CAR_H/2, 0, CAR_H/2);
    bodyG.addColorStop(0, this._lighten(p.color, 40));
    bodyG.addColorStop(0.4, p.color);
    bodyG.addColorStop(1, this._lighten(p.color, -30));
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.moveTo(-CAR_W/2, CAR_H/2 - WHEEL_R);
    ctx.lineTo(-CAR_W/2, -CAR_H/2 + 8);
    ctx.quadraticCurveTo(-CAR_W/2 + 2, -CAR_H/2, -CAR_W/2 + 12, -CAR_H/2); // rear slope
    ctx.lineTo(CAR_W/2 - 12, -CAR_H/2 + 2); // roof
    ctx.quadraticCurveTo(CAR_W/2 + 4, -CAR_H/2 + 4, CAR_W/2 + 8, -CAR_H/2 + 10); // hood slope
    ctx.lineTo(CAR_W/2 + 8, CAR_H/2 - WHEEL_R);
    ctx.closePath(); ctx.fill();

    // Racing Stripe
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-CAR_W/2 + 2, -CAR_H/2 + 5);
    ctx.lineTo(CAR_W/2 - 4, -CAR_H/2 + 5);
    ctx.lineTo(CAR_W/2 - 4, -CAR_H/2 + 8);
    ctx.lineTo(-CAR_W/2 + 2, -CAR_H/2 + 8);
    ctx.fill();

    // Windows (cockpit)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(-4, -CAR_H/2 + 2);
    ctx.lineTo(12, -CAR_H/2 + 2);
    ctx.lineTo(18, -CAR_H/2 + 8);
    ctx.lineTo(-2, -CAR_H/2 + 8);
    ctx.closePath(); ctx.fill();
    
    // Window reflection
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(4, -CAR_H/2+2); ctx.lineTo(10, -CAR_H/2+2); ctx.lineTo(14, -CAR_H/2+6); ctx.lineTo(6, -CAR_H/2+6); ctx.fill();

    // Headlight / Taillight
    ctx.fillStyle = (p.phase === 'charging') ? '#fff' : '#ffe680';
    ctx.beginPath(); ctx.ellipse(CAR_W/2 + 7, -2, 3, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowColor = (p.phase === 'charging' && p.speed > 100) ? '#ffe680' : 'transparent';
    ctx.shadowBlur = 10;
    ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff2222';
    ctx.beginPath(); ctx.ellipse(-CAR_W/2 + 1, -2, 2, 5, 0, 0, Math.PI*2); ctx.fill();

    // Glowing exhaust pipe if charging
    if (p.phase === 'charging' && p.speed > 50) {
      ctx.fillStyle = '#555';
      ctx.fillRect(-CAR_W/2 - 4, CAR_H/2 - 8, 5, 4);
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(-CAR_W/2 - 4, CAR_H/2 - 6, 2 + Math.random()*2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Wheels
    this._drawWheel(ctx, -CAR_W/2+12, CAR_H/2, WHEEL_R + 2, p.wheelAngle);
    this._drawWheel(ctx,  CAR_W/2-10, CAR_H/2, WHEEL_R + 2, p.wheelAngle);

    ctx.restore();
  }

  _drawWheel(ctx, x, y, r, a) {
    // Tire
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    // Rim Edge
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    // Inner Rim
    ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x,y,r*0.6,0,Math.PI*2); ctx.fill();
    // Spokes
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const s = a + i*Math.PI*2/5;
      ctx.beginPath(); ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(s)*r*0.6, y+Math.sin(s)*r*0.6); ctx.stroke();
    }
    // Hub
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x,y,r*0.25,0,Math.PI*2); ctx.fill();
  }

  _drawHUD(ctx, p, ox, oy, vpW, vpH) {
    // Speed gauge (only when charging)
    if (p.phase === 'charging') {
      this._drawGauge(ctx, p, ox + vpW/2, oy + vpH - 78);
    }

    // Progress bar
    const totalJumps = this.track.jumps.length;
    const progress   = p.finished ? 1 : p.jumpIdx / totalJumps;
    const barW = vpW * 0.45, barH = 8;
    const barX = ox + (vpW - barW) / 2, barY = oy + 14;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.roundRect(barX-2, barY-2, barW+4, barH+4, 5); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();

    const fillW = progress * barW;
    if (fillW > 0) {
      const barGrad = ctx.createLinearGradient(barX, 0, barX+fillW, 0);
      barGrad.addColorStop(0, p.color);
      barGrad.addColorStop(1, this._lighten(p.color, 30));
      ctx.fillStyle = barGrad;
      ctx.beginPath(); ctx.roundRect(barX, barY, fillW, barH, 4); ctx.fill();
    }

    // Car icon on bar
    ctx.font = '12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('🚗', barX + fillW, barY - 5);

    // Flag at end
    ctx.fillText('🏁', barX + barW, barY - 5);

    // Jump counter
    ctx.font = 'bold 12px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(`Jump ${p.jumpIdx}/${totalJumps}`, barX + barW/2, barY + barH + 14);

    // Player name (versus mode)
    if (this.isVersus) {
      ctx.font = 'bold 13px Outfit';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.name, ox + 12, oy + 26);
    }

    // Race timer
    ctx.font = 'bold 13px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(this._fmtTime(p.raceTime), ox + vpW - 14, oy + 26);

    // Lives (endless)
    if (this.isEndless) {
      ctx.textAlign = 'left';
      ctx.font = '15px Outfit';
      ctx.fillText('❤️'.repeat(Math.max(0, p.lives)), ox + 14, oy + vpH - 14);
    }

    // Stars
    ctx.textAlign = 'left';
    ctx.font = '13px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`⭐ ${p.starsGot}`, ox + 14, oy + 46);

    // Respawn warning overlay
    if (p.phase === 'respawning') {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(ox, oy, vpW, vpH);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 24px Outfit';
      ctx.fillStyle = '#ff6666';
      ctx.textAlign = 'center';
      ctx.fillText(`💥 RESPAWNING… ${Math.ceil(p.respawnTimer)}s`, ox + vpW/2, oy + vpH/2);
    }

    // Instruction hint
    if (p.phase === 'charging' && p.speed === 0) {
      ctx.font = '13px Outfit';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'center';
      ctx.fillText('Hold → to rev, release to launch!', ox + vpW/2, oy + vpH - 28);
    }

    // Score
    ctx.textAlign = 'right';
    ctx.font = '12px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${p.totalScore} pts`, ox + vpW - 14, oy + 46);
  }

  _drawGauge(ctx, p, cx, cy) {
    const r      = 75;
    const frac   = clamp(p.speed / MAX_SPEED, 0, 1);
    const sAngle = Math.PI * 0.75;
    const totalA = Math.PI * 1.5;
    const nAngle = sAngle + totalA * frac;

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Track background
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, sAngle, sAngle+totalA); ctx.stroke();

    // Tick marks
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let i=0; i<=10; i++) {
      const ta = sAngle + totalA * (i/10);
      const isMajor = (i%5===0);
      const len = isMajor ? 12 : 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta)*(r-10), cy + Math.sin(ta)*(r-10));
      ctx.lineTo(cx + Math.cos(ta)*(r-10+len), cy + Math.sin(ta)*(r-10+len));
      ctx.stroke();
    }

    // Neon Fill
    if (frac > 0) {
      const arcG = ctx.createConicGradient(sAngle, cx, cy);
      arcG.addColorStop(0, '#00ffff');
      arcG.addColorStop(0.35, '#00ffaa');
      arcG.addColorStop(0.6, '#ffee00');
      arcG.addColorStop(0.85, '#ff4400');
      arcG.addColorStop(1, '#ff0000');
      ctx.strokeStyle = arcG;
      ctx.lineWidth = 14;
      ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(cx, cy, r, sAngle, nAngle); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Glowing Needle
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(nAngle)*(r-12), cy + Math.sin(nAngle)*(r-12));
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Centre Hub
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.fill();

    // Digital Speed Text
    ctx.font = '900 24px Outfit';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
    ctx.fillText(Math.floor(p.speed), cx, cy - 20);
    ctx.font = '600 11px Outfit';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('MPH', cx, cy - 6);
    ctx.shadowBlur = 0;
    
    // Rev warning
    if (frac > 0.95) {
      ctx.fillStyle = '#ff0000';
      if (Math.floor(this.time * 10) % 2 === 0) {
        ctx.fillText('MAX!', cx, cy + 25);
      }
    }
  }

  _drawCountdown(ctx, ox, oy, vpW, vpH) {
    const text  = this._cdCount > 0 ? String(this._cdCount) : 'GO!';
    const scale = 1 + (1 - this._cdTimer/0.95) * 0.28;
    ctx.save();
    ctx.translate(ox + vpW/2, oy + vpH/2 - 30);
    ctx.scale(scale, scale);
    ctx.font = `bold 66px Outfit`;
    ctx.fillStyle = this._cdCount > 0 ? '#fff' : '#ffcc00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = this._cdCount > 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,200,0,0.4)';
    ctx.shadowBlur = 18;
    ctx.fillText(text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _lighten(colorStr, amt) {
    if (!colorStr) return 'rgb(128,128,128)';
    let r = 0, g = 0, b = 0;
    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0]+hex[0], 16);
        g = parseInt(hex[1]+hex[1], 16);
        b = parseInt(hex[2]+hex[2], 16);
      } else {
        r = parseInt(hex.slice(0,2), 16) || 0;
        g = parseInt(hex.slice(2,4), 16) || 0;
        b = parseInt(hex.slice(4,6), 16) || 0;
      }
    } else if (colorStr.startsWith('rgb')) {
      const match = colorStr.match(/\d+/g);
      if (match && match.length >= 3) {
        r = parseInt(match[0], 10);
        g = parseInt(match[1], 10);
        b = parseInt(match[2], 10);
      }
    } else {
      return colorStr;
    }
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Boot ───────────────────────────────────────────────────
new RampRacer();
