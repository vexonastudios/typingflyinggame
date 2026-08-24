'use strict';

// ═══════════════════════════════════════════════════════════
//  RAMP RACER v3 — Continuous Stunt Run + Horizontal Split-Screen
//  Hold boost, chain jumps, control the landing, race to finish!
// ═══════════════════════════════════════════════════════════

// ─── Physics / Tuning ───────────────────────────────────────
const GRAVITY       = 1050;
const MAX_SPEED     = 790;
const START_SPEED   = 470;
const MIN_SPEED     = 420;
const ACCEL_RATE    = 320;
const COAST_DRAG    = 46;
const AIR_TILT_SPD  = 2.6;
const FIXED_STEP    = 1 / 120;
const CAR_W         = 58;
const CAR_H         = 26;
const WHEEL_R       = 10;
const PLATFORM_H    = 48;
const STAR_R        = 13;
const RESPAWN_PENALTY = 0.65;

// ─── Track config ───────────────────────────────────────────
const ADVENTURE_JUMPS = 15;   // jumps per adventure track
const VERSUS_JUMPS    = 12;   // jumps per versus race
const ENDLESS_LIVES   = 3;

// ─── World themes ───────────────────────────────────────────
const WORLDS = [
  { name:'Morning Hills', sky1:'#51b7df', sky2:'#d8f2e8', ground:'#3e9b5f', dirt:'#65462f', accent:'#8ed45f', mtn1:'#78a889', mtn2:'#4f8668' },
  { name:'Redrock Run', sky1:'#ef8a66', sky2:'#ffe0ae', ground:'#c89555', dirt:'#914b2e', accent:'#f0c56b', mtn1:'#bd7051', mtn2:'#8f452c' },
  { name:'Alpine Airfield', sky1:'#679acb', sky2:'#e5edf2', ground:'#668a83', dirt:'#405b62', accent:'#b9d7cf', mtn1:'#718999', mtn2:'#4e6471' },
  { name:'Neon Harbor', sky1:'#238f93', sky2:'#b9e5d7', ground:'#268478', dirt:'#22525b', accent:'#59d1bd', mtn1:'#347b7c', mtn2:'#275e68' },
  { name:'Stunt Festival', sky1:'#73599c', sky2:'#efc9c4', ground:'#b24f63', dirt:'#613449', accent:'#f6c453', mtn1:'#8c5878', mtn2:'#59415f' },
];

const TOUR_STUNTS = [
  { name:'First Flight', gap:145, width:260, angle:24, rise:0 },
  { name:'Orchard Hop', gap:165, width:240, angle:28, rise:-15 },
  { name:'Creek Skip', gap:190, width:230, angle:30, rise:20 },
  { name:'Redrock Reach', gap:200, width:230, angle:28, rise:20 },
  { name:'Mesa Step-Up', gap:220, width:210, angle:34, rise:-45 },
  { name:'Dustbowl Drop', gap:240, width:220, angle:26, rise:70 },
  { name:'Hangar Bound', gap:230, width:220, angle:38, rise:-35 },
  { name:'Tailwind Gap', gap:270, width:200, angle:32, rise:0 },
  { name:'High Road', gap:250, width:190, angle:42, rise:-40 },
  { name:'Dockside Dive', gap:260, width:200, angle:30, rise:55 },
  { name:'Crane Leap', gap:290, width:180, angle:38, rise:-25 },
  { name:'Needle Deck', gap:275, width:170, angle:34, rise:0 },
  { name:'Big Top Bound', gap:300, width:185, angle:42, rise:20 },
  { name:'Moonshot', gap:330, width:175, angle:46, rise:-30 },
  { name:'Last Light', gap:350, width:200, angle:40, rise:45 },
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
const normAngle = a       => Math.atan2(Math.sin(a), Math.cos(a));

// ═══════════════════════════════════════════════════════════
//  TRACK GENERATION  — full multi-jump track, stitched end-to-end
// ═══════════════════════════════════════════════════════════
function generateTrack(numJumps, diff, mode) {
  const dMult = [0.90, 1.0, 1.08][diff];
  const wMult = [1.28, 1.0, 0.78][diff];

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
    const profile = TOUR_STUNTS[j % TOUR_STUNTS.length];
    const cycle = Math.floor(j / TOUR_STUNTS.length);
    const gapDist = (profile.gap + cycle * 18) * dMult;
    const platW = Math.max(86, profile.width * wMult - cycle * 8);
    const rampAngle = clamp(profile.angle + cycle * 1.5, 20, 48);
    const rampRad   = degRad(rampAngle);
    const rampH     = RAMP_LEN * Math.sin(rampRad);
    const rampHoriz = RAMP_LEN * Math.cos(rampRad);

    const heightDiff = profile.rise;

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
    const safeMargin = clamp(platW * 0.15, 18, 34);
    const edgeA = speedForDist(gapDist + safeMargin);
    const edgeB = speedForDist(gapDist + platW - safeMargin);
    const minSpeed = Math.min(edgeA, edgeB);
    const maxSpeed = Math.min(MAX_SPEED, Math.max(edgeA, edgeB));
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

    jumps.push({
      name: cycle ? `${profile.name} +` : profile.name,
      worldIdx: Math.floor((j % TOUR_STUNTS.length) / 3),
      gapDist, platW, rampAngle, rampRad, nextX, nextY, nextW,
      idealMid, minSpeed, maxSpeed,
      rampBaseX, rampTipX, rampTipY, rampHoriz, startY: curY
    });

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
    this.phase      = 'driving'; // driving|launching|airborne|respawning|finished
    this.x          = 60;
    this.y          = 0;
    this.vx         = 0;
    this.vy         = 0;
    this.speed      = START_SPEED;
    this.angle      = 0;
    this.wheelAngle = 0;
    this.jumpIdx    = 0;      // which jump in the track we're at
    this.lives      = ENDLESS_LIVES;
    this.totalScore = 0;
    this.starsGot   = 0;
    this.streak     = 0;
    this.bestStreak = 0;
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
    this.speed = START_SPEED;
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
    this.accumulator = 0;
    this.time   = 0;
    this._globalShake = 0;
    this._resumeState = 'racing';
    this._bannerTimer = 0;
    this.touch = { accel:false, tiltUp:false, tiltDown:false };

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
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyS','KeyA','KeyD','KeyR','KeyF','Escape'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Escape') this._togglePause();
      if (e.code === 'KeyF') this._toggleFullscreen();
      if (e.code === 'KeyR' && !this.isVersus) this._retryStunt();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => {
      this._clearInput();
      if (this.state === 'racing' || this.state === 'countdown') this._pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'racing' || this.state === 'countdown')) this._pause();
    });
    document.addEventListener('fullscreenchange', () => this._updateFullscreenIcon());
    this._updateSetupUI();
    this._updateFullscreenIcon();
    this._refreshIcons();
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
    document.querySelectorAll('input[name="mode"], input[name="diff"]').forEach(input => {
      input.addEventListener('change', () => {
        this._updateSetupUI();
        Sfx.click();
      });
    });
    document.getElementById('startBtn').addEventListener('click',   () => this._startGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._startGame());
    document.getElementById('resultsSetupBtn').addEventListener('click', () => this._goSetup());
    document.getElementById('pauseBtn').addEventListener('click', () => this._pause());
    document.getElementById('resumeBtn').addEventListener('click', () => this._resume());
    document.getElementById('restartTrackBtn').addEventListener('click', () => this._startGame());
    document.getElementById('setupBtn').addEventListener('click', () => this._goSetup());
    document.getElementById('retryBtn').addEventListener('click', () => this._retryStunt());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    document.querySelectorAll('[data-touch]').forEach(button => {
      const action = button.dataset.touch;
      const setPressed = pressed => {
        this.touch[action] = pressed;
        button.classList.toggle('active', pressed);
        if (pressed) Sfx._r();
      };
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        setPressed(true);
      });
      button.addEventListener('pointerup', () => setPressed(false));
      button.addEventListener('pointercancel', () => setPressed(false));
      button.addEventListener('lostpointercapture', () => setPressed(false));
    });
  }

  _refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  _updateSetupUI() {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'adventure';
    const diff = document.querySelector('input[name="diff"]:checked')?.value || 'medium';
    document.querySelectorAll('.select-option').forEach(option => {
      option.classList.toggle('selected', option.querySelector('input').checked);
    });
    document.getElementById('playerTwoControls').classList.toggle('muted-control', mode !== 'versus');
    const startLabels = { adventure:'Start Tour', endless:'Start Survival', versus:'Start Split Race' };
    document.querySelector('#startBtn span').textContent = startLabels[mode];
    const notes = {
      easy:'Wide landings and forgiving speed targets',
      medium:'Balanced landing zones and speed targets',
      hard:'Narrow decks and precise boost timing'
    };
    document.getElementById('difficultyNote').textContent = notes[diff];
    const best = this._loadBest();
    document.getElementById('bestRecord').textContent = best
      ? `Best tour: ${best.score.toLocaleString()} pts`
      : 'Best tour: --';
    this._refreshIcons();
  }

  _bestKey() {
    return typeof ProfileManager !== 'undefined'
      ? ProfileManager.getKey('ramp_racer_best')
      : 'ramp_racer_best';
  }

  _loadBest() {
    try { return JSON.parse(localStorage.getItem(this._bestKey())); }
    catch (e) { return null; }
  }

  _saveBest(player) {
    if (this.mode !== 'adventure' || !player.finished) return;
    const previous = this._loadBest();
    if (!previous || player.totalScore > previous.score) {
      localStorage.setItem(this._bestKey(), JSON.stringify({ score:player.totalScore, time:player.raceTime }));
    }
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
    this._clearInput();
    document.getElementById('gameSetup').classList.add('hidden');
    document.getElementById('gameResults').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('gameTools').classList.remove('hidden');
    document.getElementById('retryBtn').classList.toggle('hidden', this.isVersus);
    document.body.classList.add('playing');
    document.body.classList.toggle('versus-mode', this.isVersus);

    const numJumps = this.isEndless ? 30 : this.isVersus ? VERSUS_JUMPS : ADVENTURE_JUMPS;
    this.track = generateTrack(numJumps, this.diff, this.mode);

    const C1 = { accel:'ArrowRight', accelAlt:'Space', tiltUp:'ArrowUp', tiltDown:'ArrowDown' };
    const C2 = { accel:'KeyD',       tiltUp:'KeyW',        tiltDown:'KeyS'     };

    this.players = [new Player(0, C1)];
    if (this.isVersus) this.players.push(new Player(1, C2));

    this.players.forEach(p => p.initForTrack(this.track));
    this.floatTexts = [];
    this.raceStarted = false;
    this.accumulator = 0;

    this._cdCount = 2;
    this._cdTimer = 0.72;
    this.state = 'countdown';
    this._showStuntBanner(this.players[0]);
    Sfx.countdown();
  }

  _goSetup() {
    this._clearInput();
    document.getElementById('gameSetup').classList.remove('hidden');
    document.getElementById('gameResults').classList.add('hidden');
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('gameTools').classList.add('hidden');
    document.getElementById('levelBanner').classList.add('hidden');
    document.body.classList.remove('playing', 'versus-mode');
    this.state = 'setup';
    this._updateSetupUI();
  }

  _clearInput() {
    Object.keys(this.keys).forEach(key => { this.keys[key] = false; });
    Object.keys(this.touch).forEach(key => { this.touch[key] = false; });
    document.querySelectorAll('[data-touch]').forEach(button => button.classList.remove('active'));
  }

  _pressed(player, action) {
    const primary = player.ctrl[action];
    const alternate = action === 'accel' ? player.ctrl.accelAlt : null;
    const keyboard = Boolean(this.keys[primary] || (alternate && this.keys[alternate]));
    const touchInput = player.id === 0 && !this.isVersus && Boolean(this.touch[action]);
    return keyboard || touchInput;
  }

  _togglePause() {
    if (this.state === 'paused') this._resume();
    else this._pause();
  }

  _pause() {
    if (this.state !== 'racing' && this.state !== 'countdown') return;
    this._resumeState = this.state;
    this.state = 'paused';
    this._clearInput();
    document.getElementById('pauseOverlay').classList.remove('hidden');
  }

  _resume() {
    if (this.state !== 'paused') return;
    document.getElementById('pauseOverlay').classList.add('hidden');
    this.state = this._resumeState || 'racing';
  }

  _retryStunt() {
    if (this.isVersus || !this.players.length || !['racing','countdown'].includes(this.state)) return;
    const p = this.players[0];
    if (p.finished) return;
    const plat = this.track.platforms[p.jumpIdx];
    p.x = plat.x + 60;
    p.y = plat.y - CAR_H;
    p.vx = 0; p.vy = 0; p.speed = START_SPEED; p.angle = 0;
    p.phase = 'driving';
    p._lastAccel = false;
    p.trailDots = [];
    p.streak = 0;
    p.raceTime += 0.5;
    p.flashTimer = 0.22;
    p.flashColor = '#f6c453';
    this._showStuntBanner(p);
    Sfx.click();
  }

  async _toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (e) {
      console.warn('Fullscreen is unavailable:', e);
    }
  }

  _updateFullscreenIcon() {
    const button = document.getElementById('fullscreenBtn');
    const active = Boolean(document.fullscreenElement);
    button.innerHTML = `<i data-lucide="${active ? 'minimize' : 'maximize'}"></i>`;
    button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    button.title = active ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
    this._refreshIcons();
  }

  _showStuntBanner(player) {
    if (!this.track || !this.track.jumps[player.jumpIdx]) return;
    const jump = this.track.jumps[player.jumpIdx];
    const banner = document.getElementById('levelBanner');
    document.getElementById('bannerWorld').textContent = WORLDS[jump.worldIdx].name;
    document.getElementById('bannerStunt').textContent = `${player.jumpIdx + 1}. ${jump.name}`;
    banner.classList.remove('hidden');
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
    window.clearTimeout(this._bannerTimer);
    this._bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), 1050);
  }

  // ─── Loop ────────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this.time  += dt;
    this.accumulator = Math.min(0.08, this.accumulator + dt);
    while (this.accumulator >= FIXED_STEP) {
      this._update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this._draw();
    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Update ──────────────────────────────────────────────
  _update(dt) {
    if (this.state === 'setup' || this.state === 'results' || this.state === 'paused') return;

    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        this._cdCount--;
        if (this._cdCount > 0) { this._cdTimer = 0.72; Sfx.countdown(); }
        else { this.state = 'racing'; this.raceStarted = true; Sfx.go(); }
      }
      this.players.forEach(p => this._updateCamera(p, dt));
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
    const touchRail = !this.isVersus && this.W <= 900 && this.H <= 560 ? 188 : 0;
    const portrait = !this.isVersus && this.W <= 640 && this.H > 560;
    const vpW = this.W - touchRail;
    const zoom = this._getZoom(vpW, vpH);
    const worldW = vpW / zoom;
    const worldH = vpH / zoom;
    const forwardSpeed = p.phase === 'airborne' ? p.vx : p.speed;
    const maxLead = portrait ? 0 : worldW * (touchRail ? 0.035 : 0.14);
    const speedLead = clamp(forwardSpeed * 0.18, 0, maxLead);
    const anchor = portrait ? 0.06 : (touchRail ? 0.14 : 0.30);
    const targetCX = p.x - worldW * anchor + speedLead;
    const targetCY = p.y - worldH * 0.60;
    p.camX = lerp(p.camX, targetCX, Math.min(1, 5.2*dt));
    p.camY = lerp(p.camY, targetCY, Math.min(1, 4.4*dt));
  }

  _getZoom(vpW, vpH) {
    if (this.isVersus) return clamp(vpW / 1150, 1.05, 1.28);
    if (vpW <= 640 && vpH > 560) return 0.72;
    return clamp(vpW / 1000, 1.18, 1.55);
  }

  _updateDriveSpeed(p, dt) {
    const boosting = this._pressed(p, 'accel');
    if (boosting) p.speed = Math.min(MAX_SPEED, p.speed + ACCEL_RATE * dt);
    else p.speed = Math.max(MIN_SPEED, p.speed - COAST_DRAG * dt);

    p._lastAccel = boosting;
    if (boosting) {
      if (Math.random() < dt * 8) Sfx.rev(p.speed / MAX_SPEED);
      if (Math.random() < 0.42) {
        p.exhaust.push({
          x:p.x-5, y:p.y+CAR_H-5,
          vx:rand(-75,-28), vy:rand(-14,14),
          life:rand(0.12,0.3), r:rand(2,5),
          color:p.speed > MAX_SPEED * 0.76 ? '#ff6b35' : '#f6c453',
        });
      }
    }
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
        p.vx = 0; p.vy = 0; p.speed = START_SPEED;
        p.angle = 0;
        p.trailDots = [];
        p.ghostTrail = [...(p._lastTrail||[])];
        p.phase = 'driving';
        p.flashTimer = 0.3;
        p.flashColor = '#88aaff';
      }
      return;
    }

    // --- FINISHED ---
    if (p.phase === 'finished') return;

    // --- LAUNCHING (driving across platform and up ramp) ---
    if (p.phase === 'launching') {
      const ramp = track.ramps[p.jumpIdx];
      this._updateDriveSpeed(p, dt);
      const driveSpd = p.speed;
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
      const tiltUp   = this._pressed(p, 'tiltUp');
      const tiltDown = this._pressed(p, 'tiltDown');
      if (tiltUp) p.angle -= AIR_TILT_SPD * dt;
      if (tiltDown) p.angle += AIR_TILT_SPD * dt;

      p.vy += GRAVITY * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      const flightAngle = Math.atan2(p.vy, p.vx);
      p.angle = lerp(p.angle, flightAngle * 0.32, Math.min(1, 0.45 * dt));
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
          if (Math.abs(normAngle(p.angle)) > 1.05) {
            this._handleCrash(p, 'BAD LANDING');
            return;
          }
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
      this._updateDriveSpeed(p, dt);
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
        p.x += p.speed * dt;
        p.wheelAngle += p.speed * 0.012 * dt * 60;

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
      p.x += p.speed * dt;
      p.y = track.platforms[p.jumpIdx].y - CAR_H; // stay on platform
      p.angle = lerp(p.angle, 0, Math.min(1, 12*dt));
      p.wheelAngle += p.speed * 0.012 * dt * 60;

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
        p.phase = 'launching';
        p.trailDots = [];
        Sfx.launch();
        if (p.jumpIdx > 0 && p.jumpIdx % 3 === 0) this._showStuntBanner(p);
      }
    }
  }

  _handleLanding(p, plat) {
    const carCx = p.x + CAR_W/2;
    const platCenter = plat.x + plat.w/2;
    const centerScore = 1 - clamp(Math.abs(carCx - platCenter) / (plat.w/2), 0, 1);
    const angleError = Math.abs(normAngle(p.angle));
    const uprightScore = 1 - clamp(angleError / 1.05, 0, 1);
    const precision = centerScore * 0.72 + uprightScore * 0.28;

    p.phase = 'driving';
    p.y  = plat.y - CAR_H;
    p.vx = 0; p.vy = 0;
    p.trailDots = [];
    p.jumpIdx++;

    // Score & feedback
    let pts = 500;
    let label = '👍 OK!', col = '#88ccff';
    if (precision > 0.88 && angleError < 0.28) {
      pts = 1500; label = '🎯 PERFECT!'; col = '#ffcc00'; Sfx.perfect();
      p.speed = Math.min(MAX_SPEED, p.speed + 34);
      p.particles.emit(carCx, plat.y, 35, {
        angle:-Math.PI/2, spread:1.3,
        colors:['#ffcc00','#ffe066','#fff','#ff8800'], minSpd:50, maxSpd:220, minR:2, maxR:6,
      });
    } else if (precision > 0.56 && angleError < 0.62) {
      pts = 1000; label = '✨ GREAT!'; col = '#66ff88'; Sfx.land();
      p.speed = Math.min(MAX_SPEED, p.speed + 18);
      p.particles.emit(carCx, plat.y, 20, {
        angle:-Math.PI/2, spread:1.0,
        colors:['#8B7355','#A0926B','#C4B99A'], minSpd:40, maxSpd:180, minR:2, maxR:5,
      });
    } else if (angleError > 0.72) {
      pts = 250; label = 'ROUGH LANDING'; col = '#ff9a5c'; Sfx.land();
      p.streak = 0;
      p.speed = Math.max(MIN_SPEED, p.speed - 55);
    } else {
      Sfx.land();
    }

    p.streak++;
    p.bestStreak = Math.max(p.bestStreak, p.streak);
    if (p.streak > 1) {
      const bonus = p.streak * 100;
      pts += bonus;
      this._addFloat(`FLOW x${p.streak}  +${bonus}`, carCx, plat.y - 60, '#ff8844', p);
    }

    p.totalScore += pts;
    this._addFloat(label, carCx, plat.y - 30, col, p);
    this._globalShake = precision > 0.85 ? 7 : 3;
    p.flashTimer = 0.25; p.flashColor = '#ffe066';
  }

  _handleCrash(p, reason = 'CRASH') {
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
    this._addFloat(`💥 ${reason}!`, p.x+CAR_W/2, p.y, '#ff4444', p);
    p.flashTimer = 0.5; p.flashColor = '#ff4444';

    // Endless: out of lives
    if (this.isEndless && p.lives <= 0) {
      setTimeout(() => this._showResults(), 1000);
    }
  }

  _showResults() {
    this.state = 'results';
    this._clearInput();
    document.getElementById('gameResults').classList.remove('hidden');
    document.getElementById('gameTools').classList.add('hidden');
    const list = document.getElementById('resultsList');
    list.innerHTML = '';

    if (this.isVersus) {
      const sorted = [...this.players].sort((a,b) => (a.finishTime||99999) - (b.finishTime||99999));
      const winner = sorted[0];
      document.getElementById('resultsIcon').innerHTML = '<i data-lucide="trophy"></i>';
      document.getElementById('resultsKicker').textContent = 'Split race complete';
      document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;
      sorted.forEach((p, i) => {
        const e = document.createElement('div');
        e.className = 'result-entry';
        const t = p.finishTime ? this._fmtTime(p.finishTime) : 'DNF';
        e.innerHTML = `
          <span class="result-pos">${i + 1}</span>
          <span class="result-name">${p.name}</span>
          <span class="result-stat">${t} · ⭐${p.starsGot} · ${p.totalScore}pts</span>`;
        list.appendChild(e);
      });
      Sfx.win();
    } else {
      const p = this.players[0];
      const completed = p.finished;
      this._saveBest(p);
      document.getElementById('resultsIcon').innerHTML = `<i data-lucide="${completed ? 'flag' : 'shield-x'}"></i>`;
      document.getElementById('resultsKicker').textContent = completed ? 'Event complete' : 'Survival ended';
      document.getElementById('resultsTitle').textContent = completed ? (this.isEndless ? 'Survival Complete' : 'Tour Complete') : 'Out of Lives';
      const e = document.createElement('div');
      e.className = 'result-entry';
      e.innerHTML = `
        <span class="result-pos">★</span>
        <span class="result-name">${p.totalScore.toLocaleString()} pts</span>
        <span class="result-stat">${this._fmtTime(p.raceTime)} · ⭐${p.starsGot} · Flow x${p.bestStreak} · ${p.jumpIdx}/${this.track.jumps.length}</span>`;
      list.appendChild(e);
      if (completed) Sfx.win(); else Sfx.fail();
    }
    this._refreshIcons();
    this._updateSetupUI();
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

    if (this.state === 'setup') {
      this._drawBackground(ctx, 0, 0, this.W, this.H, 0);
      this._drawSetupPreview(ctx);
      ctx.restore();
      return;
    }

    if (this.state === 'results') {
      this._drawBackground(ctx, 0, 0, this.W, this.H, 4);
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

    } else {
      // Single player full screen
      const touchRail = this.W <= 900 && this.H <= 560 ? 188 : 0;
      const playW = this.W - touchRail;
      this._drawViewport(ctx, this.players[0], 0, 0, playW, this.H);
      if (touchRail) {
        ctx.fillStyle = 'rgba(6,13,14,0.92)';
        ctx.fillRect(playW, 0, touchRail, this.H);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(playW, 0, 1, this.H);
      }
    }

    ctx.restore();
  }

  _drawSetupPreview(ctx) {
    const world = WORLDS[0];
    const baseY = this.H * 0.66;
    const startX = this.W * 0.52;
    const startW = this.W * 0.20;
    const rampW = Math.min(150, this.W * 0.09);
    const rampH = rampW * 0.48;
    const landingX = startX + startW + this.W * 0.10;
    const landingW = this.W * 0.18;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 28;
    this._drawPlatform(ctx, startX, baseY, startW, world, 0, 0);
    this._drawPlatform(ctx, landingX, baseY - 22, landingW, world, 0, 1);
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#593a2b';
    ctx.beginPath();
    ctx.moveTo(startX + startW - rampW, baseY);
    ctx.lineTo(startX + startW, baseY - rampH);
    ctx.lineTo(startX + startW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f6c453';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(startX + startW - rampW, baseY);
    ctx.lineTo(startX + startW, baseY - rampH);
    ctx.stroke();

    const arc = (Math.sin(this.time * 0.9) * 0.5 + 0.5);
    const carX = lerp(startX + startW - 20, landingX + 45, arc);
    const carY = lerp(baseY - rampH - 40, baseY - 75, arc) - Math.sin(arc * Math.PI) * 120;
    const carAngle = lerp(-0.42, 0.12, arc);
    this._drawPreviewCar(ctx, carX, carY, carAngle);

    for (let i = 0; i < 3; i++) {
      const sx = lerp(startX + startW + 45, landingX - 35, (i + 1) / 4);
      const sy = baseY - 105 - Math.sin(((i + 1) / 4) * Math.PI) * 90;
      this._drawStar(ctx, sx, sy, 15 + Math.sin(this.time * 3 + i) * 1.5);
    }
    ctx.restore();
  }

  _drawPreviewCar(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#20282a';
    ctx.beginPath(); ctx.roundRect(-38, -16, 76, 27, 7); ctx.fill();
    const body = ctx.createLinearGradient(0, -18, 0, 14);
    body.addColorStop(0, '#ff9a64');
    body.addColorStop(0.5, '#f25c35');
    body.addColorStop(1, '#9c2f22');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-36, 8); ctx.lineTo(-32, -12); ctx.lineTo(16, -15);
    ctx.quadraticCurveTo(34, -13, 40, 3); ctx.lineTo(40, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d9f3f2';
    ctx.beginPath(); ctx.roundRect(-5, -12, 22, 9, 2); ctx.fill();
    this._drawWheel(ctx, -22, 10, 12, this.time * 4);
    this._drawWheel(ctx, 24, 10, 12, this.time * 4);
    ctx.restore();
  }

  _drawViewport(ctx, p, ox, oy, vpW, vpH) {
    const jump = this.track.jumps[Math.min(p.jumpIdx, this.track.jumps.length - 1)];
    const worldIdx = jump ? jump.worldIdx : 4;
    const zoom = this._getZoom(vpW, vpH);
    const worldW = vpW / zoom;
    const worldH = vpH / zoom;

    // Background
    this._drawBackground(ctx, p.camX, p.camY, vpW, vpH, worldIdx);

    // World elements (relative to player's camera)
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);
    ctx.translate(-p.camX, -p.camY);
    this._drawTrack(ctx, p.camX, p.camY, p.camX + worldW, p.camY + worldH, worldIdx);
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
      const sx = (f.x - p.camX) * zoom + ox;
      const sy = (f.y - p.camY) * zoom + oy;
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
    track.platforms.forEach((pl, index) => {
      if (pl.x > visR || pl.x + pl.w < visL) return;
      this._drawPlatform(ctx, pl.x, pl.y, pl.w, world, worldIdx, index);
      if (index > 0) this._drawLandingZone(ctx, pl, track.jumps[index - 1], worldIdx);
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

  _drawPlatform(ctx, x, y, w, world, worldIdx = 0, index = 0) {
    // Underside silhouette gives each floating section visible structure.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + 12, y + PLATFORM_H);
    ctx.lineTo(x + w - 12, y + PLATFORM_H);
    ctx.lineTo(x + w - 28, y + PLATFORM_H + 42);
    ctx.lineTo(x + 28, y + PLATFORM_H + 42);
    ctx.closePath();
    ctx.fill();

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

    // Theme-specific structure keeps the five districts visually distinct.
    if (worldIdx === 1) {
      ctx.strokeStyle = 'rgba(255,220,160,0.2)';
      ctx.lineWidth = 2;
      for (let sy = y + 17; sy < y + PLATFORM_H; sy += 10) {
        ctx.beginPath(); ctx.moveTo(x + 12, sy); ctx.lineTo(x + w - 12, sy + Math.sin(index + sy) * 3); ctx.stroke();
      }
    } else if (worldIdx === 2 || worldIdx === 3) {
      ctx.strokeStyle = worldIdx === 3 ? 'rgba(89,209,189,0.52)' : 'rgba(220,235,238,0.42)';
      ctx.lineWidth = 4;
      const left = x + Math.min(34, w * 0.2);
      const right = x + w - Math.min(34, w * 0.2);
      ctx.beginPath();
      ctx.moveTo(left, y + PLATFORM_H); ctx.lineTo(left + 8, y + PLATFORM_H + 54);
      ctx.moveTo(right, y + PLATFORM_H); ctx.lineTo(right - 8, y + PLATFORM_H + 54);
      ctx.moveTo(left + 4, y + PLATFORM_H + 24); ctx.lineTo(right - 4, y + PLATFORM_H + 42);
      ctx.moveTo(right - 4, y + PLATFORM_H + 24); ctx.lineTo(left + 4, y + PLATFORM_H + 42);
      ctx.stroke();
    } else if (worldIdx === 4) {
      ctx.fillStyle = index % 2 ? '#f6c453' : '#f25c35';
      for (let fx = x + 18; fx < x + w - 10; fx += 32) {
        ctx.beginPath(); ctx.moveTo(fx, y + PLATFORM_H - 5); ctx.lineTo(fx + 10, y + PLATFORM_H - 5); ctx.lineTo(fx + 5, y + PLATFORM_H + 8); ctx.fill();
      }
    }
  }

  _drawLandingZone(ctx, platform, jump, worldIdx) {
    const margin = clamp(platform.w * 0.15, 18, 34);
    const zx = platform.x + margin;
    const zw = Math.max(24, platform.w - margin * 2);
    ctx.save();
    ctx.fillStyle = worldIdx === 3 ? 'rgba(89,209,189,0.34)' : 'rgba(246,196,83,0.25)';
    ctx.fillRect(zx, platform.y - 9, zw, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(platform.x + platform.w / 2, platform.y - 9);
    ctx.lineTo(platform.x + platform.w / 2, platform.y + 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f6c453';
    ctx.fillRect(zx, platform.y - 17, 3, 14);
    ctx.fillRect(zx + zw - 3, platform.y - 17, 3, 14);
    ctx.restore();
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
    if (p.ghostTrail && p.ghostTrail.length > 1 && (p.phase === 'driving' || p.phase === 'launching')) {
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

    // Wind lines make the continuous run read at a glance.
    const travelSpeed = p.phase === 'airborne' ? Math.hypot(p.vx, p.vy) : p.speed;
    if (!['respawning', 'finished'].includes(p.phase) && travelSpeed > 500) {
      ctx.strokeStyle = `rgba(255,255,255,${clamp((travelSpeed - 440) / 600, 0.16, 0.58)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a = p.phase === 'airborne' ? Math.atan2(p.vy, p.vx) : 0;
      for(let i=0; i<6; i++) {
        const lx = p.x + CAR_W/2 + rand(-55, 48);
        const ly = p.y + CAR_H/2 + rand(-42, 38);
        const len = rand(34, 74) * clamp(travelSpeed / 540, 0.8, 1.45);
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
    ctx.fillStyle = p._lastAccel ? '#fff' : '#ffe680';
    ctx.beginPath(); ctx.ellipse(CAR_W/2 + 7, -2, 3, 5, 0, 0, Math.PI*2); ctx.fill();
    ctx.shadowColor = p._lastAccel ? '#ffe680' : 'transparent';
    ctx.shadowBlur = 10;
    ctx.fill(); ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff2222';
    ctx.beginPath(); ctx.ellipse(-CAR_W/2 + 1, -2, 2, 5, 0, 0, Math.PI*2); ctx.fill();

    // Glowing exhaust pipe while boosting
    if (p._lastAccel && p.phase !== 'airborne') {
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
    const hudShade = ctx.createLinearGradient(0, oy, 0, oy + 62);
    hudShade.addColorStop(0, 'rgba(5,12,13,0.58)');
    hudShade.addColorStop(1, 'rgba(5,12,13,0)');
    ctx.fillStyle = hudShade;
    ctx.fillRect(ox, oy, vpW, 62);

    // Speed target stays visible so the player can set up the next launch in motion.
    if (p.phase !== 'respawning' && p.phase !== 'finished') {
      const touchClearance = !this.isVersus && vpW <= 640 && vpH > 560 ? 98 : 18;
      this._drawGauge(ctx, p, ox + vpW/2, oy + vpH - touchClearance, Math.min(430, vpW * 0.48));
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

    // Car marker and finish post
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(barX + fillW, barY - 5, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f7f3e8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(barX + barW, barY + 5); ctx.lineTo(barX + barW, barY - 12); ctx.stroke();
    ctx.fillStyle = '#f7f3e8';
    ctx.fillRect(barX + barW, barY - 12, 10, 7);

    // Jump counter
    ctx.font = 'bold 12px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText(`Stunt ${Math.min(p.jumpIdx + 1, totalJumps)}/${totalJumps}`, barX + barW/2, barY + barH + 14);

    // Player name (versus mode)
    if (this.isVersus) {
      ctx.font = 'bold 13px Outfit';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.name, ox + 12, oy + 26);
    } else {
      const jump = this.track.jumps[Math.min(p.jumpIdx, totalJumps - 1)];
      ctx.font = 'bold 13px Outfit';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`${WORLDS[jump.worldIdx].name} · ${jump.name}`, ox + 14, oy + 26);
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

    // Score
    ctx.textAlign = 'right';
    ctx.font = '12px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${p.totalScore} pts`, ox + vpW - 14, oy + 46);

    if (p.streak > 1) {
      ctx.font = '900 18px Outfit';
      ctx.fillStyle = '#f6c453';
      ctx.textAlign = 'right';
      ctx.fillText(`FLOW x${p.streak}`, ox + vpW - 14, oy + 69);
    }
  }

  _drawGauge(ctx, p, cx, bottomY, width) {
    const jump = this.track.jumps[Math.min(p.jumpIdx, this.track.jumps.length - 1)];
    const panelW = Math.max(280, width);
    const panelH = 72;
    const panelX = cx - panelW / 2;
    const panelY = bottomY - panelH;
    const barX = panelX + 15;
    const barY = panelY + 37;
    const barW = panelW - 30;
    const barH = 15;
    const speedFrac = clamp(p.speed / MAX_SPEED, 0, 1);
    const minFrac = clamp(jump.minSpeed / MAX_SPEED, 0, 1);
    const maxFrac = clamp(jump.maxSpeed / MAX_SPEED, 0, 1);
    const idealFrac = clamp(jump.idealMid / MAX_SPEED, 0, 1);
    const inWindow = p.speed >= jump.minSpeed && p.speed <= jump.maxSpeed;
    const tooHot = p.speed > jump.maxSpeed;

    ctx.fillStyle = 'rgba(6,13,14,0.84)';
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 7); ctx.fill();
    ctx.strokeStyle = inWindow ? 'rgba(65,218,169,0.8)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '700 11px "Share Tech Mono"';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillText('RAMP SPEED', barX, panelY + 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = inWindow ? '#63e0b7' : (tooHot ? '#ff755c' : '#f6c453');
    const status = p.phase === 'airborne'
      ? 'AIRBORNE'
      : (inWindow ? 'ON TARGET' : (tooHot ? 'COAST' : 'BOOST'));
    ctx.fillText(`${status}  ${Math.round(p.speed)}`, barX + barW, panelY + 19);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, 4); ctx.fill();

    const powerGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    powerGrad.addColorStop(0, '#46a6d8');
    powerGrad.addColorStop(0.55, '#f6c453');
    powerGrad.addColorStop(1, '#f25c35');
    ctx.fillStyle = powerGrad;
    if (speedFrac > 0) {
      ctx.beginPath(); ctx.roundRect(barX, barY, Math.max(4, barW * speedFrac), barH, 4); ctx.fill();
    }

    ctx.fillStyle = 'rgba(72,225,172,0.46)';
    ctx.fillRect(barX + barW * minFrac, barY - 4, Math.max(4, barW * (maxFrac - minFrac)), barH + 8);
    ctx.strokeStyle = '#76f0c4';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX + barW * minFrac, barY - 4, Math.max(4, barW * (maxFrac - minFrac)), barH + 8);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX + barW * idealFrac, barY - 7);
    ctx.lineTo(barX + barW * idealFrac, barY + barH + 7);
    ctx.stroke();

    const needleX = barX + barW * speedFrac;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(needleX, barY - 7);
    ctx.lineTo(needleX - 5, barY - 13);
    ctx.lineTo(needleX + 5, barY - 13);
    ctx.closePath();
    ctx.fill();
  }

  _drawCountdown(ctx, ox, oy, vpW, vpH) {
    const text  = this._cdCount > 0 ? String(this._cdCount) : 'GO!';
    const scale = 1 + (1 - this._cdTimer/0.72) * 0.28;
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
