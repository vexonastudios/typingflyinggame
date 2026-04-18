'use strict';
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DUCK HUNT DUEL â€” Arcade Shooter Engine
//  Keyboard Aiming & Bullet Physics
//  P1: A/D to rotate barrel, W to shoot
//  P2: Left/Right to rotate barrel, Up to shoot
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Math helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndI = (a,b) => Math.floor(rnd(a,b+1));
const lerp = (a,b,t) => a+(b-a)*t;
const dist = (ax,ay,bx,by) => Math.hypot(ax-bx,ay-by);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

// â”€â”€ Audio Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AC = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _tone(freq, type, dur, vol=0.1, slope=null) {
    try {
      if (AC.state==='suspended') AC.resume();
      const o=AC.createOscillator(), g=AC.createGain();
      o.type=type; o.frequency.value=freq;
      if (slope) o.frequency.exponentialRampToValueAtTime(slope, AC.currentTime+dur);
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+dur);
      o.connect(g); g.connect(AC.destination);
      o.start(); o.stop(AC.currentTime+dur);
    } catch(e){}
  },
  _noise(dur, vol=0.08) {
    try {
      if (AC.state==='suspended') AC.resume();
      const buf=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
      const src=AC.createBufferSource(), g=AC.createGain();
      src.buffer=buf; g.gain.setValueAtTime(vol,AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+dur);
      src.connect(g); g.connect(AC.destination); src.start();
    } catch(e){}
  },
  buffers: {},
  async loadFiles() {
    try {
      const p = { shoot: 'sounds/shotgun-fire.mp3', reload: 'sounds/shotgun-reload.mp3' };
      for (const [k, url] of Object.entries(p)) {
        const res = await fetch(url);
        const buf = await AC.decodeAudioData(await res.arrayBuffer());
        this.buffers[k] = buf;
      }
    } catch(e) { console.warn("Failed to load Assets", e); }
  },
  _playBuf(key, vol=0.6) {
    if (!this.buffers[key]) return false;
    try {
      if (AC.state==='suspended') AC.resume();
      const s = AC.createBufferSource(), g = AC.createGain();
      s.buffer = this.buffers[key];
      g.gain.value = vol;
      s.connect(g); g.connect(AC.destination);
      s.start();
      return true;
    } catch(e) { return false; }
  },
  shoot()  { if (!this._playBuf('shoot', 0.8)) { this._noise(0.08,0.14); this._tone(200,'square',0.06,0.05,80); } },
  hit()    { this._tone(660,'sine',0.12,0.12,880); this._noise(0.05,0.06); },
  hitBig() { [660,880,1100].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.18,0.14),i*50)); },
  miss()   { this._tone(180,'sawtooth',0.15,0.06,120); },
  steal()  { this._tone(440,'sine',0.08,0.1,330); },
  reload() { if (!this._playBuf('reload', 1.0)) { [180,200,220].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.08,0.06),i*60)); } },
  crow()   { this._tone(120,'sawtooth',0.25,0.1); },
  squid()  { this._noise(0.2, 0.2); this._tone(150, 'triangle', 0.2, 0.2, 50); }, // Ink splatter sound
  clash()  { this._tone(800, 'square', 0.1, 0.1, 100); this._noise(0.1, 0.15); }, // Bullets colliding
  wave()   { [523,659,784].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.1),i*100)); },
  win()    { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.25,0.12),i*120)); },
  draw()   { [440,440,440].forEach((f,i)=>setTimeout(()=>this._tone(f,'triangle',0.2,0.08),i*120)); },
};

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MAX_HEAT    = 100;
const HEAT_PER_SHOT = 22;
const COOL_RATE    = 42; // heat per second
const RELOAD_MS    = 2000; // Overheat penalty time
const BULLET_SPEED = 1400; 
const HIT_RADIUS = { duck:52, clay:38, golden:40, crow:48, squid:38, goose:62, balloon:50, crate:40 };
const PTS        = { duck:100, clay:150, golden:500, crow:-200, squid:250, goose:300 };
const COLORS     = { p1:'#ff4455', p2:'#00ccff', p3:'#a855f7', gold:'#fbbf24', bad:'#ff6600', ink: '#111' };

// â”€â”€ Hunter Voice Lines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HUNTER_VOICES = {
  p1: 'ruirxsoakN0GWmGNIo04',
  p2: 'aOcS60CY8CoaVaZfqqb5',
  p3: 'sIiRahyxBt2egNH9gWXf',
};

// Per-voice volume gain (1.0 = normal; >1.0 boosts via Web Audio GainNode)
const HUNTER_VOICE_GAIN = {
  [HUNTER_VOICES.p1]: 1.0,
  [HUNTER_VOICES.p2]: 1.0,
  [HUNTER_VOICES.p3]: 1.65,  // girl voice is naturally quieter — boost it
};

const hunterVoiceLines = {
  hit: [
    "Now that was a clean one!", "Nice shot, partner!", "You clipped that one like a pro.",
    "Well, look at you!", "That duck never saw it coming.", "You're heating up now.",
    "That was smoother than gravy.", "You're on target today.", "Bullseye with feathers.",
    "That's how it's done."
  ],
  nearMiss: [
    "Ooh, that was close!", "Just a feather off.", "You almost had him.",
    "That one was right there!", "Next shot's yours.", "You're dialed in now.",
    "That duck got lucky.", "Just needed a pinch more lead.", "Almost sent him tumbling.",
    "You're warming up."
  ],
  miss: [
    "That duck's still laughing.", "You were aiming at the clouds.", "I think you scared the breeze.",
    "That shot needed a map.", "You missed him by a Sunday nap.", "That one was more hope than aim.",
    "You sure you saw the same duck I saw?", "That duck owes you a thank-you note.",
    "You're being generous with your ammo.", "That was a warning shot."
  ],
  streak: [
    "Somebody's in the zone.", "Save a few for the rest of us!", "You brought your sharp eyes today.",
    "You're stacking them up now.", "He can't miss!", "That shotgun's singing for you.",
    "You're making this look easy.", "Somebody practiced.", "You're on a roll now.", "I better catch up quick."
  ],
  comeback: [
    "Don't worry, the next flock's yours.", "Plenty of sky left.",
    "You're one good shot away from a comeback.", "You've still got game.", "The tide can turn fast.",
    "One hot streak changes everything.", "You're due for a big one.", "There's time yet, partner.",
    "Your moment's coming.", "I've seen slower starts win matches."
  ],
  rivalry: [
    "Try to keep up now.", "You chasing ducks or daydreams?", "I might need to lend you my lucky hat.",
    "You watching me shoot for lessons?", "Careful, I'm pulling ahead.",
    "You better start swinging that barrel.", "This scoreboard's getting lopsided.",
    "I'm putting on a clinic out here.", "Don't blink, you'll miss my next one too.",
    "I hope you packed some comeback."
  ],
  partnerBanter: [
    "You watch the left, I'll watch the winners.", "I'll handle the ducks, you handle the cheering.",
    "Good thing one of us came ready.", "You bring the shells, I'll bring the aim.",
    "We make a pretty fine team.", "Between your jokes and my shooting, we're set.",
    "Let's keep those ducks guessing.", "You spot 'em, I'll drop 'em.",
    "I'll admit it, that was a nice shot.", "All right, that one even impressed me."
  ],
  bothMiss: [
    "Well... we sure let that one fly.", "That duck just got a free pass.",
    "Good thing we're better company than marksmen.", "We hit everything except the duck.",
    "That was a team miss.", "Two shots, zero feathers.", "We gave him a real scare, at least.",
    "That one slipped through both of us.", "We'll call that a practice round.",
    "Nobody talk about that one."
  ],
  roundWin: [
    "That may seal it!", "You picked the perfect time for that one.", "That's the shot of the round!",
    "What a finish!", "Now that's how you close it out.", "That one put you on top!",
    "Big shot at the right time.", "That'll be hard to beat.", "You ended strong there.",
    "That's one for the highlight reel."
  ],
  roundStart: [
    "All right, let's see who's sharp today.", "Eyes up, here they come.",
    "Let's make this a good round.", "Ready up, partner.", "Time to fill the sky with feathers.",
    "Let's see who strikes first.", "Stay quick and stay steady.", "This ought to be fun.",
    "Here comes the first flock.", "Let's get after it."
  ],
  idleChatter: [
    "Quiet now, I hear wings.", "Keep your eyes moving.", "Sky's too calm... won't stay that way.",
    "This next one's ours.", "Stay loose, don't rush it.", "You take high, I'll take low.",
    "Looks like more are coming.", "We're due for a busy stretch.",
    "Don't let the easy ones fool you.", "Something's about to break across the sky."
  ],
  shortCalls: [
    "Got him!", "Nice!", "There he goes!", "Close one!", "Good eye!",
    "Clean shot!", "Too high!", "Too slow!", "Right there!", "What a hit!"
  ],
  // Lines specifically voiced by / about the female hunter (P3)
  girlBanter: [
    "Don't let her fool you, she can shoot.",
    "I didn't come out here just to watch.",
    "You boys better keep up.",
    "That one had my name on it.",
    "I've been watching both of you.",
    "Eyes up, fellas.",
    "Don't blink.",
    "I'm just getting warmed up.",
    "You should've seen that coming.",
    "My aim is just fine, thank you.",
    "I came here to hunt, not watch.",
    "Next one's mine, just you wait.",
    "I see it. Don't worry.",
    "Don't underestimate the quiet one.",
    "You're going to have to do better than that."
  ]
};

// â”€â”€ Hunter TTS Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HunterVoice = (() => {
  // Per-voice IndexedDB cache (keyed "voiceId:text")
  const DB_NAME = 'DuckHuntVoiceDB';
  const STORE   = 'voiceAudio';
  let _db = null;

  async function _getDB() {
    if (_db) return _db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e);
    });
  }

  async function _cacheGet(key) {
    try {
      const db = await _getDB();
      return new Promise(resolve => {
        const tx = db.transaction([STORE], 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      });
    } catch(e) { return null; }
  }

  async function _cachePut(key, blob) {
    try {
      const db = await _getDB();
      const tx = db.transaction([STORE], 'readwrite');
      tx.objectStore(STORE).put(blob, key);
    } catch(e) {}
  }

  let _current = null;
  let _busy = false;

  async function speak(text, voiceId, gain = 1.0) {
    if (_busy) return;
    _busy = true;
    try {
      const cacheKey = `${voiceId}:${text}`;
      let blob = await _cacheGet(cacheKey);

      if (!blob) {
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voiceId=${voiceId}`);
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        blob = await res.blob();
        _cachePut(cacheKey, blob);
      }

      if (_current) { _current.pause(); _current = null; }

      const url = URL.createObjectURL(blob);

      if (gain > 1.0) {
        // Route through Web Audio GainNode to exceed the normal 1.0 ceiling
        const audioCtx = typeof AC !== 'undefined' ? AC : new AudioContext();
        const audioEl  = new Audio(url);
        audioEl.crossOrigin = 'anonymous';
        const src  = audioCtx.createMediaElementSource(audioEl);
        const node = audioCtx.createGain();
        node.gain.value = gain;
        src.connect(node);
        node.connect(audioCtx.destination);
        _current = audioEl;
        await audioEl.play().catch(() => {});
        await new Promise(resolve => {
          audioEl.onended = resolve;
          audioEl.onerror = resolve;
          setTimeout(resolve, 8000);
        });
      } else {
        _current = new Audio(url);
        _current.volume = 0.85 * gain;
        await _current.play().catch(() => {});
        await new Promise(resolve => {
          _current.onended = resolve;
          _current.onerror = resolve;
          setTimeout(resolve, 8000);
        });
      }
    } catch(e) {
      console.warn('[HunterVoice] TTS failed:', e.message);
    } finally {
      _busy = false;
    }
  }

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Public: fire-and-forget a voice line for a given category + voiceId
  function maybeSpeak(category, voiceId, chance = 0.5) {
    if (Math.random() > chance) return;
    const lines = hunterVoiceLines[category];
    if (!lines || !lines.length) return;
    const gain = HUNTER_VOICE_GAIN[voiceId] || 1.0;
    speak(_pick(lines), voiceId, gain);
  }

  return { speak, maybeSpeak };
})();

// Gated wrapper — respects the user's voice toggle preference
function _voiceMaybe(category, voiceId, chance = 0.5) {
  const toggle = document.getElementById('voiceToggle');
  if (toggle && !toggle.checked) return;
  HunterVoice.maybeSpeak(category, voiceId, chance);
}

// Pick a random voice from a match that doesn't belong to `excludeWho`
// Works for both versus (2 players) and trio (3 players)
function _otherVoice(excludeWho, activePlayers) {
  const others = activePlayers.filter(id => id !== excludeWho && id in HUNTER_VOICES);
  if (!others.length) return null;
  return HUNTER_VOICES[others[Math.floor(Math.random() * others.length)]];
}

// ── Particle system ──────────────────────────────────────────────────────────
class Particle {
  constructor(x,y,col,vx,vy,life,r) {
    this.x=x; this.y=y; this.col=col;
    this.vx=vx; this.vy=vy; this.life=life; this.maxLife=life; this.r=r;
  }
  update(dt) { this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=180*dt; this.life-=dt; }
}

function spawnBurst(particles, x, y, col, n=12, speed=280) {
  for(let i=0;i<n;i++) {
    const a=rnd(0,Math.PI*2), v=rnd(speed*0.3,speed);
    particles.push(new Particle(x,y,col,Math.cos(a)*v,Math.sin(a)*v,rnd(0.3,0.8),rnd(2,5)));
  }
}

// ── Bullet ──────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, vx, vy, owner, col) {
    this.x = x; this.y = y; 
    this.vx = vx; this.vy = vy; 
    this.owner = owner; 
    this.col = col;
    this.dead = false;
    this.hitSomething = false;
    this.r = 6;
    this.trail = [];
  }
  update(dt, W, H, wind) {
    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 8) this.trail.shift();

    // Apply wind effectively curving bullets left or right
    this.vx += wind * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    if (this.y < -50 || this.x < -100 || this.x > W + 100) {
      this.dead = true;
    }
  }
}

// ── Target ──────────────────────────────────────────────────────────────────
class Target {
  constructor(type, canvas) {
    this.type = type;
    this.dead = false;
    this.deadTimer = 0;
    this.claimedBy = null; 
    this.claimFlash = 0;
    this.id = Math.random();
    this.fleeing = false;

    const W = canvas.width, H = canvas.height - 72;
    const hitR = HIT_RADIUS[type];

    const pattern = this._pickPattern(type, W, H);
    this.px = pattern.px;
    this.py = pattern.py;
    this.vx = pattern.vx;
    this.vy = pattern.vy;
    this.ax = pattern.ax || 0;
    this.ay = pattern.ay || 0;
    this.sine = pattern.sine;
    this.sineAmp = pattern.sineAmp;
    this.sineFreq = pattern.sineFreq;

    this.r = hitR;
    this.wobble = 0;
    this.anim = rnd(0, Math.PI*2);
  }

  _pickPattern(type, W, H) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const sx = side === 'left' ? -60 : W + 60;
    const tx_dir = side === 'left' ? 1 : -1;

    const speeds = { duck: rnd(140,240), clay: rnd(200,340), golden: rnd(300,480), crow: rnd(80,160), squid: rnd(180,300), goose: rnd(100,180) };
    
    if (type === 'balloon') {
       return { px: W * rnd(0.2, 0.8), py: H + 80, vx: rnd(-20, 20), vy: -rnd(30, 60), ax:0, ay:0, sine:true, sineAmp:20, sineFreq:1.5 };
    }
    if (type === 'crate') {
       // crate falls down from the spawner
       return { px: 0, py: 0, vx: 0, vy: 180, ax:0, ay:0 };
    }

    const spd = speeds[type] || 200;

    const style = (type === 'squid') ? 2 : rndI(0,2); // squids always sine wave
    if (style === 0) {
      return { px: sx, py: rnd(H*0.15, H*0.65), vx: tx_dir*spd, vy: rnd(-40,40), ax:0, ay:0 };
    } else if (style === 1) {
      const gy = type==='clay' ? rnd(60,120) : rnd(20,60);
      return { px: sx, py: rnd(H*0.5, H*0.7), vx: tx_dir*spd, vy: rnd(-200,-80), ax:0, ay:gy };
    } else {
      return { px: sx, py: rnd(H*0.2, H*0.6), vx: tx_dir*spd, vy: 0, ax:0, ay:0, sine: true, sineAmp: rnd(40,120), sineFreq: rnd(1.2,3.5) };
    }
  }

  update(dt, W, H) {
    if (this.dead) { this.deadTimer += dt; return; }

    this.anim += dt;
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;

    if (this.sine) {
      if (!this._baseSet) { this._baseY = this.py; this._baseSet = true; }
      this.py = this._baseY + Math.sin(this.anim * this.sineFreq) * this.sineAmp;
    }

    this.px += this.vx * dt;
    this.py += this.vy * dt;

    this.wobble = Math.sin(this.anim * 6) * 5;

    if (this.type === 'crow' && !this.sine) {
      if (this.py < 30 || this.py > H - 30) { this.vy *= -1; }
    }

    if (this.px < -120 || this.px > W + 120 || this.py > H + 100) {
      this.dead = true;
      this.deadTimer = 99; 
    }
  }

  isExpired() { return this.dead && this.deadTimer > (this.claimedBy ? 0.7 : 0.1); }
}

// ── Player State ─────────────────────────────────────────────────────────────
function makePlayer(id, name) {
  return {
    id, name, score: 0,
    heat: 0, 
    reloading: false, reloadTimer: 0,
    combo: 0, hits: 0, misses: 0, steals: 0,
    x: 0, y: 0, 
    angle: -Math.PI / 2, 
    recoil: 0,
    inkTimer: 0, // Blinds the player when inked!
    buff: null, buffTimer: 0,
  };
}

// ── Main Game ────────────────────────────────────────────────────────────────
class DuckHuntDuel {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this.mode   = 'solo';
    this.state  = 'title';
    this.maxWaves = 10;
    this.difficulty = 'normal';

    // Tournament state
    this.tourn = this._makeTournState();

    this.wave = 0;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.targetsLeft = 0;
    this.waveConf = null;

    // Environmental Wind
    this.wind = 0;
    this.windTarget = 0;
    this.windChangeTimer = 0;

    this.targets   = [];
    this.bullets   = [];
    this.particles = [];
    this.p1 = makePlayer('p1');
    this.p2 = makePlayer('p2');

    this.keys  = {};
    this._prevKeys = {};
    this.shake = 0;
    this._floatTexts = [];

    this._bindEvents();
    this._bindUI();
    window.addEventListener('resize', ()=>this._resize());
    this._resize();

    this._lastTs = 0;
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight - 72;
    if (this.p1) { this.p1.x = this.canvas.width * (this.mode==='solo'?0.5:(this.mode==='trio'?0.2:0.3)); this.p1.y = this.canvas.height; }
    if (this.p2) { this.p2.x = this.canvas.width * (this.mode==='trio'?0.5:0.7); this.p2.y = this.canvas.height; }
    if (this.p3) { this.p3.x = this.canvas.width * 0.8; this.p3.y = this.canvas.height; }
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (['Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyH','KeyK','KeyU'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  _bindUI() {
    document.getElementById('btnSolo').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this.mode = 'solo'; this._startGame(); });
    document.getElementById('btnVersus').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this.mode = 'versus'; this._startGame(); });
    document.getElementById('btnTrio').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this.mode = 'trio'; this._startGame(); });
    document.getElementById('btnTournament').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this._showTournamentSetup(); });
    document.getElementById('btnAddHunter').addEventListener('click', () => this._addHunterEntry());
    document.getElementById('btnStartTournament').addEventListener('click', () => this._startTournament());
    document.getElementById('btnTournBack').addEventListener('click', () => this._showScreen('titleScreen'));
    document.getElementById('btnBrackStart').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this._launchTournamentMatch(); });
    document.getElementById('btnBrackChamp').addEventListener('click', () => this._showChampionScreen());
    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      if (this.tourn && this.tourn.active) { this._showBracketScreen(); return; }
      this._startGame();
    });
    document.getElementById('btnMenu').addEventListener('click', () => {
      this.tourn = this._makeTournState(); // reset tournament
      ['resultsScreen','gameScreen'].forEach(s => document.getElementById(s).classList.remove('active'));
      document.getElementById('titleScreen').classList.add('active');
      this.state = 'title';
    });
  }

  _showScreen(id) {
    ['titleScreen','gameScreen','resultsScreen','tournamentScreen','bracketScreen']
      .forEach(s => document.getElementById(s).classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  _startGame() {
    this.maxWaves = this.tourn.active ? 999 : (parseInt(document.getElementById('waveSelect').value) || 10);
    this.difficulty = document.getElementById('diffSelect').value || 'normal';
    this.wave = 0; this.targets = []; this.bullets = []; this.particles = [];
    this._floatTexts = [];
    
    // Custom names
    const n1 = document.getElementById('p1Name').value.trim() || 'Player 1';
    const n2 = document.getElementById('p2Name').value.trim() || 'Player 2';
    const n3 = document.getElementById('p3Name').value.trim() || 'Player 3';
    this.p1 = makePlayer('p1', n1); 
    this.p2 = makePlayer('p2', n2);
    if (this.mode === 'trio') this.p3 = makePlayer('p3', n3);
    else this.p3 = null;

    // Persist names to localStorage for quick-fill next time
    [n1, n2, ...(this.mode === 'trio' ? [n3] : [])].forEach(_addSavedName);
    _refreshDatalist();
    
    document.getElementById('nameLabelP1').textContent = `🔴 ${this.p1.name}`;
    document.getElementById('nameLabelP2').textContent = `🔵 ${this.p2.name}`;
    if (this.p3) document.getElementById('nameLabelP3').textContent = `🟣 ${this.p3.name}`;

    this.wind = 0; this.windTarget = 0;
    this._resize();
    document.getElementById('hudP2').style.display = this.mode === 'solo' ? 'none' : 'flex';
    document.getElementById('hudP3').style.display = this.mode === 'trio' ? 'flex' : 'none';
    this._showScreen('gameScreen');
    this._startWave();
  }

  _startWave() {
    this.wave++;
    this.waveConf    = waveConfig(this.wave, this.difficulty);
    this.waveTimer   = this.waveConf.timer;
    this.spawnTimer  = 0;
    this.targetsLeft = this.waveConf.targetCount;
    this.targets = []; this.bullets = []; this.state = 'countdown';
    
    // Initial wind target for the wave
    this.windTarget = (Math.random() * 800) - 400; 

    document.getElementById('waveDisplay').textContent = `Wave ${this.wave}/${this.maxWaves}`;
    const overlay = document.getElementById('countdownOverlay');
    const num     = document.getElementById('countdownNum');
    overlay.classList.remove('hidden');
    let n = 3; num.textContent = n;
    Sfx._tone(440,'square',0.1,0.05);
    const cd = setInterval(() => {
      n--;
      if (n > 0) { num.textContent = n; Sfx._tone(440,'square',0.1,0.05); } 
      else { clearInterval(cd); overlay.classList.add('hidden'); this.state = 'playing'; }
    }, 900);
    // Voice: round start banter (Wave 1 or random subsequent waves)
    if (this.mode === 'versus' || this.mode === 'trio') {
      const voicePool = Object.keys(HUNTER_VOICES).filter(id => {
        if (this.mode === 'versus') return id !== 'p3';
        return true; // trio: all three
      });
      const starterVoice = HUNTER_VOICES[voicePool[Math.floor(Math.random() * voicePool.length)]];
      _voiceMaybe('roundStart', starterVoice, this.wave === 1 ? 0.8 : 0.25);

      // Idle chatter — random player speaks every 18-30s
      if (this._idleInterval) clearInterval(this._idleInterval);
      this._idleInterval = setInterval(() => {
        if (this.state !== 'playing') return;
        const v = HUNTER_VOICES[voicePool[Math.floor(Math.random() * voicePool.length)]];
        // P3 gets girl-banter flavour occasionally
        const cat = (v === HUNTER_VOICES.p3 && Math.random() < 0.4) ? 'girlBanter' : 'idleChatter';
        _voiceMaybe(cat, v, 0.5);
      }, rnd(18, 30) * 1000);
    }
  }

  _spawnTarget() {
    const c = this.waveConf; const r = Math.random();
    let type;
    if (r < c.squidChance) type = 'squid';
    else if (r < c.squidChance+c.crowChance) type = 'crow';
    else if (r < c.squidChance+c.crowChance+c.goldChance) type = 'golden';
    else if (r < c.squidChance+c.crowChance+c.goldChance+c.clayChance) type = 'clay';
    else if (r < c.squidChance+c.crowChance+c.goldChance+c.clayChance+(c.gooseChance||0)) type = 'goose';
    else type = 'duck';
    this.targets.push(new Target(type, this.canvas));
    this.targetsLeft--;
    if (type !== 'crow') Sfx._tone(rnd(300,500),'triangle',0.06,0.03);
  }

  _endWave() {
    this.state = 'waveclear';
    if (this._idleInterval) { clearInterval(this._idleInterval); this._idleInterval = null; }

    // Tournament match-end: if tournament active, go straight to results regardless of wave count
    if (this.tourn && this.tourn.active) {
      this.tourn.timerActive = false;
      // Brief "Match Over!" flash then show results
      const banner = document.getElementById('waveBanner');
      const text   = document.getElementById('waveBannerText');
      text.textContent = '⏱ Match Over!';
      banner.classList.remove('hidden');
      Sfx.wave();
      setTimeout(() => {
        banner.classList.add('hidden');
        this._showResults();
      }, 1400);
      return;
    }

    const banner = document.getElementById('waveBanner');
    const text   = document.getElementById('waveBannerText');
    Sfx.wave();

    if (this.wave >= this.maxWaves) {
      text.textContent = '🎯 Final Wave Done!';
    } else {
      text.textContent = `Wave ${this.wave} Clear! `;
    }
    banner.classList.remove('hidden');

    setTimeout(() => {
      banner.classList.add('hidden');
      if (this.wave >= this.maxWaves) {
        this._showResults();
      } else {
        this._startWave();
      }
    }, 2200);
  }

  _showResults() {
    this.state = 'results';
    // Tournament intercept — record score and go to bracket screen instead
    if (this.tourn && this.tourn.active) {
      this._recordTournamentResult(this.p1.score, this.p2.score);
      return;
    }
    this._showScreen('resultsScreen');

    const players = [this.p1, this.p2, this.p3].filter(p => p);
    const emoji = document.getElementById('resultsEmoji');
    const title = document.getElementById('resultsTitle');

    if (this.mode === 'solo') {
      emoji.textContent = '🎯';
      title.textContent = `Score: ${this.p1.score}`;
      Sfx.win();
    } else {
      const highest = Math.max(...players.map(p => p.score));
      const winners = players.filter(p => p.score === highest);
      if (winners.length > 1) {
         emoji.textContent = '🤝'; title.textContent = "It's a Draw!"; Sfx.draw();
      } else {
         emoji.textContent = '🏆'; title.textContent = `${winners[0].name} Wins!`; Sfx.win();
      }
    }

    const statsEl = document.getElementById('resultsStats');
    statsEl.style.gridTemplateColumns = players.length === 1 ? '1fr' : (players.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr');

    statsEl.innerHTML = players.map(p => {
      const acc = p.hits + p.misses > 0 ? Math.round(100*p.hits/(p.hits+p.misses)) : 0;
      const emojiName = p.id === 'p1' ? '🔴' : (p.id === 'p2' ? '🔵' : '🟣');
      if (this.mode === 'solo') {
        return `
          <div class="stat-block" style="grid-column:1/-1">
            <h3>${emojiName} ${p.name}'s Stats</h3>
            <div class="stat-line"><span>Score</span><span class="stat-val">${p.score}</span></div>
            <div class="stat-line"><span>Hits</span><span class="stat-val">${p.hits}</span></div>
            <div class="stat-line"><span>Misses</span><span class="stat-val">${p.misses}</span></div>
            <div class="stat-line"><span>Accuracy</span><span class="stat-val">${acc}%</span></div>
          </div>`;
      } else {
        return `
          <div class="stat-block ${p.id}-block">
            <h3>${emojiName} ${p.name}</h3>
            <div class="stat-line"><span>Score</span><span class="stat-val">${p.score}</span></div>
            <div class="stat-line"><span>Hits</span><span class="stat-val">${p.hits}</span></div>
            <div class="stat-line"><span>Misses</span><span class="stat-val">${p.misses}</span></div>
            <div class="stat-line"><span>Steals</span><span class="stat-val">${p.steals}</span></div>
            <div class="stat-line"><span>Accuracy</span><span class="stat-val">${acc}%</span></div>
          </div>`;
      }
    }).join('');
  }

  _shoot(who) {
    const p = who === 'p1' ? this.p1 : (who === 'p2' ? this.p2 : this.p3);
    if (p.reloading || p.heat >= MAX_HEAT) {
      Sfx.miss();
      // Taunt the reloading player from one of the opponents
      if ((this.mode === 'versus' || this.mode === 'trio') && who in HUNTER_VOICES) {
        const activePlayers = this.mode === 'trio' ? ['p1','p2','p3'] : ['p1','p2'];
        const ov = _otherVoice(who, activePlayers);
        if (ov) _voiceMaybe('rivalry', ov, 0.4);
      }
      return;
    }

    p.heat += HEAT_PER_SHOT;
    p.recoil = 24;
    Sfx.shoot();

    if (p.heat >= MAX_HEAT) {
      p.reloading = true; p.reloadTimer = RELOAD_MS / 1000;
      document.getElementById('reload'+p.id.toUpperCase()).style.display = 'block';
      Sfx.reload();
    }

    const bx = p.x + Math.cos(p.angle) * 50;
    const by = p.y - 12 + Math.sin(p.angle) * 50;
    
    let angles = [p.angle];
    if (p.buff === 'spread') {
      angles = [p.angle - 0.15, p.angle, p.angle + 0.15];
    }
    
    for (let ang of angles) {
      const vx = Math.cos(ang) * BULLET_SPEED;
      const vy = Math.sin(ang) * BULLET_SPEED;
      this.bullets.push(new Bullet(bx, by, vx, vy, who, COLORS[who]));
    }
    
    spawnBurst(this.particles, bx, by, '#fff', p.buff === 'spread' ? 10 : 3, 100);
  }

  _claimTarget(target, who) {
    const p = who === 'p1' ? this.p1 : (who === 'p2' ? this.p2 : this.p3);
    if (target.dead) return;

    if (target.type === 'crow') {
      p.score = Math.max(0, p.score + PTS.crow);
      p.hits++; p.combo = 0; target.dead = true; target.claimedBy = who;
      Sfx.crow(); this.shake = 15;
      spawnBurst(this.particles, target.px, target.py, COLORS.bad, 14, 200);
      this._floatText(`${PTS.crow}`, target.px, target.py, COLORS.bad);
      // Crow is a penalty — one of the OTHER players trash-talks (rival voice)
      if (this.mode === 'versus' || this.mode === 'trio') {
        const activePlayers = this.mode === 'trio' ? ['p1','p2','p3'] : ['p1','p2'];
        const ov = _otherVoice(who, activePlayers);
        if (ov) _voiceMaybe('rivalry', ov, 0.55);
      }
      return;
    }

    // Balloon Drops Crate
    if (target.type === 'balloon') {
      target.dead = true; target.claimedBy = who;
      Sfx._tone(400, 'sine', 0.2, 0.4);
      spawnBurst(this.particles, target.px, target.py, '#fff', 15, 100);
      const crate = new Target('crate', this.canvas);
      crate.px = target.px; crate.py = target.py;
      this.targets.push(crate);
      return;
    }

    // Crate Buffs
    if (target.type === 'crate') {
      target.dead = true; target.claimedBy = who;
      Sfx._tone(800, 'square', 0.15, 0.2);
      spawnBurst(this.particles, target.px, target.py, '#0f0', 20, 250);
      const buffTypes = ['spread', 'laser', 'slowmo'];
      const buffIcons = { spread: '💥', laser: '🔴', slowmo: '⏳' };
      p.buff = buffTypes[Math.floor(Math.random() * buffTypes.length)];
      p.buffTimer = 6; // Buff lasts 6 seconds
      this._floatText(`${buffIcons[p.buff]} POWER UP!`, target.px, target.py, COLORS[who]);
      return;
    }

    // Sabotage Squids ink the opponents!
    if (target.type === 'squid' && (this.mode === 'versus' || this.mode === 'trio')) {
      [this.p1, this.p2, this.p3].filter(other => other && other.id !== who).forEach(other => other.inkTimer = 4.0);
      Sfx.squid();
    }

    let isSteal = false;
    if (this.mode === 'versus' || this.mode === 'trio') {
      for (const b of this.bullets) if (b.owner !== who && !b.dead && dist(b.x, b.y, target.px, target.py) < 160) { isSteal = true; break; }
    }

    if (isSteal) { p.steals++; Sfx.steal(); }
    const pts = PTS[target.type]; p.combo++;
    const comboMult = Math.min(p.combo, 8);
    const bonus = pts * (comboMult > 1 ? comboMult : 1);
    p.score += bonus; p.hits++; target.dead = true; target.claimedBy = who;
    const col = who === 'p1' ? COLORS.p1 : COLORS.p2;
    
    if (target.type === 'golden') { Sfx.hitBig(); this.shake = 20; this.hitStopTimer = 0.12; } 
    else if (target.type === 'squid') { Sfx.hitBig(); }
    else { Sfx.hit(); }
    
    // Combo milestones hit stop
    if (p.combo > 0 && p.combo % 5 === 0) {
       this.hitStopTimer = 0.12;
       const ce = document.getElementById('comboP' + who.slice(1));
       if (ce) { ce.classList.remove('combo-pop'); void ce.offsetWidth; ce.classList.add('combo-pop'); }
    }

    spawnBurst(this.particles, target.px, target.py, col, 14, target.type==='golden'?360:(target.type==='squid'?300:240));
    if (target.type === 'squid') spawnBurst(this.particles, target.px, target.py, COLORS.ink, 30, 400); // Black ink splash

    let label = comboMult > 1 ? `x${comboMult} ${bonus}!` : `+${pts}`;
    if (isSteal) label = `STEAL! +${bonus}`;
    if (target.type === 'squid' && this.mode === 'versus') label = "INK ATTACK!";
    this._floatText(label, target.px, target.py - 20, col);

    // -- Hunter voice on hit (versus and trio) --
    if ((this.mode === 'versus' || this.mode === 'trio') && who in HUNTER_VOICES) {
      const activePlayers = this.mode === 'trio' ? ['p1','p2','p3'] : ['p1','p2'];
      const voice = HUNTER_VOICES[who];
      const ov = _otherVoice(who, activePlayers);
      if (isSteal) {
        _voiceMaybe('rivalry', voice, 0.7);
      } else if (p.combo >= 4) {
        _voiceMaybe('streak', voice, 0.65);
      } else if (target.type === 'golden') {
        if (ov) _voiceMaybe('roundWin', ov, 0.75);
      } else {
        const isGirl = (who === 'p3');
        const cat = isGirl && Math.random() < 0.4 ? 'girlBanter' : (Math.random() < 0.5 ? 'hit' : 'shortCalls');
        _voiceMaybe(cat, voice, 0.35);
      }
    }
  }

  _bullet_miss_voice(who) {
    // Works in both versus and trio
    const isMulti = this.mode === 'versus' || this.mode === 'trio';
    if (!isMulti || !(who in HUNTER_VOICES)) return;
    const activePlayers = this.mode === 'trio' ? ['p1','p2','p3'] : ['p1','p2'];
    const ov = _otherVoice(who, activePlayers);
    if (!ov) return;
    const p     = this[who];
    const other = activePlayers.filter(id => id !== who).map(id => this[id]).filter(Boolean);
    const maxOtherScore = Math.max(...other.map(o => o.score));
    if (maxOtherScore - p.score > 400) {
      _voiceMaybe('comeback', ov, 0.35);
    } else {
      _voiceMaybe('miss', ov, 0.25);
    }
  }

  _update(dt) {
    if (this.state === 'playing') {
      
      // Hit Stop (Freeze everything but particles and float text for a visceral punch)
      if (this.hitStopTimer && this.hitStopTimer > 0) {
          this.hitStopTimer -= dt;
          for (const pt of this.particles) pt.update(dt);
          this.particles = this.particles.filter(pt => pt.life > 0);
          for (const ft of this._floatTexts) { ft.y += ft.vy*dt; ft.life -= dt; }
          this._floatTexts = this._floatTexts.filter(ft => ft.life > 0);
          this._prevKeys = Object.assign({}, this.keys);
          this._updateHUD();
          return;
      }

      // Tournament 120-second match clock
      if (this.tourn && this.tourn.timerActive) {
        this.tourn.matchTimeLeft -= dt;
        if (this.tourn.matchTimeLeft <= 0) {
          this.tourn.matchTimeLeft = 0;
          this.tourn.timerActive = false;
          // Stop idle chatter
          if (this._idleInterval) { clearInterval(this._idleInterval); this._idleInterval = null; }
          // Call _showResults() directly — NOT _endWave(), which would restart
          // waves because maxWaves=999 is never reached in tournament mode.
          this._showResults();
        }
      }

      // Wind dynamics
      this.windChangeTimer -= dt;
      if (this.windChangeTimer <= 0) {
        this.windTarget = (Math.random() * 1000) - 500; // -500 to +500 px/s wind force
        this.windChangeTimer = rnd(4, 8);
      }
      this.wind = lerp(this.wind, this.windTarget, dt * 1.5);

      const turnSpd = 3.8 * dt;
      if (this.keys['KeyA']) this.p1.angle -= turnSpd;
      if (this.keys['KeyD']) this.p1.angle += turnSpd;
      this.p1.angle = clamp(this.p1.angle, -Math.PI + 0.15, -0.15);
      if (this.keys['KeyW'] && !this._prevKeys['KeyW']) this._shoot('p1');

      if (this.mode === 'versus' || this.mode === 'trio') {
        if (this.keys['ArrowLeft']) this.p2.angle -= turnSpd;
        if (this.keys['ArrowRight']) this.p2.angle += turnSpd;
        this.p2.angle = clamp(this.p2.angle, -Math.PI + 0.15, -0.15);
        if (this.keys['ArrowUp'] && !this._prevKeys['ArrowUp']) this._shoot('p2');
      }

      if (this.mode === 'trio' && this.p3) {
        if (this.keys['KeyH']) this.p3.angle -= turnSpd;
        if (this.keys['KeyK']) this.p3.angle += turnSpd;
        this.p3.angle = clamp(this.p3.angle, -Math.PI + 0.15, -0.15);
        if (this.keys['KeyU'] && !this._prevKeys['KeyU']) this._shoot('p3');
      }

      this.waveTimer -= dt;

      if (this.targetsLeft > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this._spawnTarget(); this.spawnTimer = this.waveConf.spawnInterval; }
      }

      // Global Slowmo / Time Dilation buff check
      let targetDtMulti = 1.0;
      if ([this.p1, this.p2, this.p3].some(p => p && p.buff === 'slowmo')) {
          targetDtMulti = 0.4;
      }

      for (const t of this.targets) {
         t.update(dt * targetDtMulti, this.canvas.width, this.canvas.height);
         // Targets get blown safely off screen by wind too slightly
         t.px += this.wind * (dt * targetDtMulti) * 0.15;
      }
      this.targets = this.targets.filter(t => !t.isExpired());

      // Bullet logic
      for (const b of this.bullets) {
        b.update(dt, this.canvas.width, this.canvas.height, this.wind);
        if (b.dead) continue;
        for (const t of this.targets) {
          if (!t.dead && dist(b.x, b.y, t.px, t.py) <= t.r + b.r) { b.dead = true; b.hitSomething = true; this._claimTarget(t, b.owner); break; }
        }
      }

      // Bullet clashing (bullets hitting bullets!)
      if (this.mode === 'versus' || this.mode === 'trio') {
        for (let i = 0; i < this.bullets.length; i++) {
          for (let j = i + 1; j < this.bullets.length; j++) {
            const b1 = this.bullets[i];
            const b2 = this.bullets[j];
            if (!b1.dead && !b2.dead && b1.owner !== b2.owner) {
              if (dist(b1.x, b1.y, b2.x, b2.y) < b1.r + b2.r + 10) { // Slight generous hitbox for clash
                b1.dead = true; b1.hitSomething = true;
                b2.dead = true; b2.hitSomething = true;
                Sfx.clash();
                spawnBurst(this.particles, (b1.x+b2.x)/2, (b1.y+b2.y)/2, '#fbbf24', 20, 400);
                this.shake = 8;
              }
            }
          }
        }
      }

      for (const b of this.bullets) if (b.dead && !b.hitSomething) {
        const ownerP = b.owner === 'p1' ? this.p1 : (b.owner === 'p2' ? this.p2 : this.p3);
        ownerP.misses++; ownerP.combo = 0;
        this._bullet_miss_voice(b.owner);
        // Startle nearby targets
        for (const t of this.targets) {
           if (!t.dead && !t.fleeing && t.type !== 'kite' && dist(b.x, b.y, t.px, t.py) < 180) {
               t.fleeing = true;
               t.vx *= 1.6;
               t.vy += (Math.random() > 0.5 ? 80 : -80);
           }
        }
      }
      this.bullets = this.bullets.filter(b => !b.dead);

      if ((this.targetsLeft <= 0 && this.targets.every(t => t.dead)) || this.waveTimer <= 0) this._endWave();

      [this.p1, this.p2, this.p3].filter(p=>p).forEach(p => {
        if (p.reloading) { p.reloadTimer -= dt; if (p.reloadTimer <= 0) { p.reloading = false; p.heat = 0; document.getElementById('reload'+p.id.toUpperCase()).style.display='none'; } }
        else { p.heat = Math.max(0, p.heat - COOL_RATE * dt); }
        if (p.recoil > 0) p.recoil -= dt * 90; else p.recoil = 0;
        if (p.inkTimer > 0) p.inkTimer -= dt;
        if (p.buffTimer > 0) {
            p.buffTimer -= dt;
            if (p.buffTimer <= 0) { p.buff = null; p.buffTimer = 0; }
        }
      });

      for (const pt of this.particles) pt.update(dt);
      this.particles = this.particles.filter(pt => pt.life > 0);
      for (const ft of this._floatTexts) { ft.y += ft.vy*dt; ft.life -= dt; }
      this._floatTexts = this._floatTexts.filter(ft => ft.life > 0);
      if (this.shake > 0) this.shake -= dt * 60; else this.shake = 0;
    }
    this._prevKeys = Object.assign({}, this.keys);
    this._updateHUD();
  }

  // ── Tournament Engine ─────────────────────────────────

  _makeTournState() {
    return {
      active: false, phase: 'idle',
      hunters: [],   // [{name, wins, losses, totalScore, matches}]
      schedule: [],  // [{h1Idx, h2Idx, p1Score, p2Score, done, winner}]
      matchIdx: 0,
      elimBracket: [], // 3 matches: SF1, SF2, Final
      elimSeeds: [],
      matchTimeLeft: 0, timerActive: false,
      matchDuration: 120,
      lastMatchResult: null,
    };
  }

  _showTournamentSetup() {
    document.getElementById('tournHunterList').innerHTML = '';
    for (let i = 0; i < 3; i++) this._addHunterEntry();
    // Pre-fill from saved names
    const saved = _savedNames();
    document.querySelectorAll('#tournHunterList .tourn-hunter-entry input')
      .forEach((inp, i) => { if (saved[i]) inp.value = saved[i]; });
    this._showScreen('tournamentScreen');
  }

  _addHunterEntry(defaultName = '') {
    const list = document.getElementById('tournHunterList');
    if (!list || list.children.length >= 8) return;
    const n = list.children.length + 1;
    const div = document.createElement('div');
    div.className = 'tourn-hunter-entry';
    div.innerHTML = `
      <span class="hunter-num">${n}.</span>
      <input type="text" placeholder="Hunter ${n}" maxlength="20" autocomplete="off"
             list="savedNames" value="${defaultName.replace(/"/g,'&quot;')}">
      <button class="btn-remove-hunter" title="Remove">✕</button>`;
    div.querySelector('.btn-remove-hunter').addEventListener('click', () => {
      if (list.children.length <= 3) return; // keep minimum 3
      div.remove();
      list.querySelectorAll('.hunter-num').forEach((el, i) => el.textContent = `${i+1}.`);
    });
    list.appendChild(div);
  }

  _startTournament() {
    const inputs = document.querySelectorAll('#tournHunterList .tourn-hunter-entry input');
    const names = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (names.length < 3) {
      inputs[0].focus();
      return;
    }
    names.forEach(_addSavedName);
    _refreshDatalist();
    const t = this.tourn = this._makeTournState();
    t.hunters = names.map(name => ({ name, wins: 0, losses: 0, totalScore: 0, matches: 0 }));
    t.schedule = this._generateRRSchedule(t.hunters.length);
    t.matchIdx = 0;
    t.phase = 'roundRobin';
    t.active = true;
    this._showBracketScreen();
  }

  _generateRRSchedule(n) {
    const pairs = [];
    for (let i = 0; i < n; i++)
      for (let j = i+1; j < n; j++)
        pairs.push({ h1Idx: i, h2Idx: j, p1Score: null, p2Score: null, done: false, winner: -1 });
    // Greedy sort: no hunter plays in consecutive matches
    const sorted = [], remaining = [...pairs];
    let last = new Set();
    while (remaining.length) {
      const idx = remaining.findIndex(p => !last.has(p.h1Idx) && !last.has(p.h2Idx));
      const m = idx === -1 ? remaining.shift() : remaining.splice(idx, 1)[0];
      sorted.push(m);
      last = idx === -1 ? new Set() : new Set([m.h1Idx, m.h2Idx]);
    }
    return sorted;
  }

  _showBracketScreen() {
    const t = this.tourn;
    const isRR = t.phase === 'roundRobin';
    const schedule = isRR ? t.schedule : t.elimBracket;
    const total = schedule.length;
    const isDone = t.phase === 'done';

    // Phase badge
    const phaseLabels = { roundRobin: 'Round Robin', elimination: t.matchIdx < 2 ? 'Semi Finals' : 'The Final', done: 'Tournament Over' };
    document.getElementById('brackPhaseBadge').textContent = phaseLabels[t.phase] || 'Round Robin';
    document.getElementById('brackMatchCounter').textContent = isDone
      ? '🏆 Tournament Complete!'
      : `Match ${Math.min(t.matchIdx + 1, total)} of ${total}`;

    // Last result banner
    const lastRes = document.getElementById('brackLastResult');
    const lastLine = document.getElementById('brackResultLine');
    if (t.lastMatchResult) {
      const lr = t.lastMatchResult;
      const winner = t.hunters[lr.winner];
      const loser  = t.hunters[lr.loser];
      lastLine.innerHTML = `⭐ <strong>${winner.name}</strong> defeated ${loser.name} &nbsp;<span style="color:rgba(255,255,255,.35)">${lr.winScore} – ${lr.loseScore}</span>`;
      lastRes.classList.remove('hidden');
    } else {
      lastRes.classList.add('hidden');
    }

    const startBtn = document.getElementById('btnBrackStart');
    const champBtn = document.getElementById('btnBrackChamp');
    const standingsWrap = document.getElementById('brackStandingsWrap');
    const elimTree = document.getElementById('brackElimTree');
    const nextMatch = document.getElementById('brackNextMatch');

    if (isDone) {
      nextMatch.style.display = 'none';
      startBtn.style.display = 'none';
      champBtn.style.display = '';
      standingsWrap.style.display = 'none';
      elimTree.style.display = '';
      this._renderElimTree();
    } else {
      nextMatch.style.display = 'flex';
      startBtn.style.display = '';
      champBtn.style.display = 'none';
      const match = schedule[t.matchIdx];
      const h1 = t.hunters[match.h1Idx];
      const h2 = t.hunters[match.h2Idx];
      document.getElementById('brackH1Name').textContent = h1.name;
      document.getElementById('brackH1Record').textContent = `${h1.wins}W · ${h1.losses}L`;
      document.getElementById('brackH1Pts').textContent = `${h1.totalScore} pts`;
      document.getElementById('brackH2Name').textContent = h2.name;
      document.getElementById('brackH2Record').textContent = `${h2.wins}W · ${h2.losses}L`;
      document.getElementById('brackH2Pts').textContent = `${h2.totalScore} pts`;
      if (isRR) {
        standingsWrap.style.display = '';
        elimTree.style.display = 'none';
        this._renderStandings();
      } else {
        standingsWrap.style.display = 'none';
        elimTree.style.display = '';
        this._renderElimTree();
      }
    }
    this._showScreen('bracketScreen');
  }

  _renderStandings() {
    const t = this.tourn;
    const sorted = [...t.hunters].map((h,i) => ({...h,_i:i})).sort((a,b) => (b.wins-a.wins)||(b.totalScore-a.totalScore));
    const rrDone = t.phase !== 'roundRobin';
    document.getElementById('brackStandingsBody').innerHTML = sorted.map((h, rank) => {
      let cls = '';
      if (rrDone) cls = rank < 4 ? 'is-advancing' : 'is-eliminated';
      else if (h.matches > 0 && rank === 0) cls = 'is-leader';
      const medals = ['🥇','🥈','🥉','4️⃣'];
      return `<tr class="${cls}"><td>${medals[rank]||rank+1}</td><td>${h.name}</td><td>${h.wins}</td><td>${h.losses}</td><td>${h.totalScore}</td></tr>`;
    }).join('');
  }

  _renderElimTree() {
    const t = this.tourn;
    if (!t.elimBracket || !t.elimBracket.length) return;
    const el = document.getElementById('brackElimTree');
    const sfMatches  = t.elimBracket.slice(0, 2);
    const finalMatch = t.elimBracket[2];
    const slot = (hIdx, score, winner) => {
      if (hIdx < 0) return `<div class="elim-slot is-tbd"><span class="elim-seed">—</span><span>TBD</span></div>`;
      const h = t.hunters[hIdx];
      const seed = (t.elimSeeds || []).indexOf(hIdx);
      const isW = winner === hIdx && winner >= 0;
      return `<div class="elim-slot ${isW ? 'is-winner' : ''}"><span class="elim-seed">S${seed+1}</span><span>${h.name}</span>${score!==null?`<span class="elim-score">${score}</span>`:''}</div>`;
    };
    const matchBox = (m, isCurrent) => `<div class="elim-match ${isCurrent?'is-current':''}">${ slot(m.h1Idx, m.p1Score, m.winner) }${ slot(m.h2Idx, m.p2Score, m.winner) }</div>`;
    const curIdx = t.matchIdx;
    el.innerHTML = `
      <div class="elim-round">
        <div class="elim-round-label">Semi Finals</div>
        ${matchBox(sfMatches[0], curIdx===0)}
        <div style="height:12px"></div>
        ${matchBox(sfMatches[1], curIdx===1)}
      </div>
      <div class="elim-connector">→</div>
      <div class="elim-round">
        <div class="elim-round-label">Final</div>
        ${matchBox(finalMatch, curIdx===2)}
      </div>`;
  }

  _launchTournamentMatch() {
    const t = this.tourn;
    const schedule = t.phase === 'roundRobin' ? t.schedule : t.elimBracket;
    const match = schedule[t.matchIdx];
    const h1 = t.hunters[match.h1Idx];
    const h2 = t.hunters[match.h2Idx];
    // Wire names into the existing inputs
    document.getElementById('p1Name').value = h1.name;
    document.getElementById('p2Name').value = h2.name;
    this.mode = 'versus';
    t.matchTimeLeft = t.matchDuration;
    t.timerActive = true;
    this._startGame();
  }

  _recordTournamentResult(p1Score, p2Score) {
    const t = this.tourn;
    const schedule = t.phase === 'roundRobin' ? t.schedule : t.elimBracket;
    const match = schedule[t.matchIdx];
    match.p1Score = p1Score; match.p2Score = p2Score; match.done = true;
    const t1Wins = p1Score >= p2Score;
    match.winner = t1Wins ? match.h1Idx : match.h2Idx;
    const wIdx = match.winner, lIdx = t1Wins ? match.h2Idx : match.h1Idx;
    const wScore = Math.max(p1Score,p2Score), lScore = Math.min(p1Score,p2Score);
    const winner = t.hunters[wIdx], loser  = t.hunters[lIdx];
    winner.wins++; loser.losses++;
    winner.totalScore += wScore; loser.totalScore += lScore;
    winner.matches++;  loser.matches++;
    t.lastMatchResult = { winner: wIdx, loser: lIdx, winScore: wScore, loseScore: lScore };
    t.matchIdx++;
    // Advance phase
    if (t.phase === 'roundRobin' && t.matchIdx >= t.schedule.length) {
      this._buildElimBracket();
    } else if (t.phase === 'elimination') {
      if (t.matchIdx === 2) {
        // Both SFs done — wire up the Final
        t.elimBracket[2].h1Idx = t.elimBracket[0].winner;
        t.elimBracket[2].h2Idx = t.elimBracket[1].winner;
      } else if (t.matchIdx > 2) {
        t.phase = 'done';
      }
    }
    Sfx.wave();
    this._showBracketScreen();
  }

  _buildElimBracket() {
    const t = this.tourn;
    const ranked = [...t.hunters].map((h,i) => ({...h,_i:i}))
      .sort((a,b) => (b.wins-a.wins)||(b.totalScore-a.totalScore));
    const top4 = ranked.slice(0, 4);
    while (top4.length < 4) top4.push({_i:-1}); // bye
    t.elimSeeds = top4.map(h => h._i);
    t.elimBracket = [
      { h1Idx: top4[0]._i, h2Idx: top4[3]._i, p1Score: null, p2Score: null, done: false, winner: -1 },
      { h1Idx: top4[1]._i, h2Idx: top4[2]._i, p1Score: null, p2Score: null, done: false, winner: -1 },
      { h1Idx: -1, h2Idx: -1, p1Score: null, p2Score: null, done: false, winner: -1 },
    ];
    t.matchIdx = 0;
    t.phase = 'elimination';
  }

  _showChampionScreen() {
    const t = this.tourn;
    const sorted = [...t.hunters].sort((a,b) => (b.wins-a.wins)||(b.totalScore-a.totalScore));
    const champ = sorted[0];
    document.getElementById('resultsEmoji').textContent = '🏆';
    document.getElementById('resultsTitle').textContent = `${champ.name} is Champion!`;
    const medals = ['🥇','🥈','🥉','4️⃣'];
    document.getElementById('resultsStats').style.gridTemplateColumns = sorted.length <= 2 ? '1fr 1fr' : 'repeat(auto-fit,minmax(130px,1fr))';
    document.getElementById('resultsStats').innerHTML = sorted.map((h,i) => `
      <div class="stat-block ${i===0?'p1-block':''}">
        <h3>${medals[i]||`${i+1}th`} ${h.name}</h3>
        <div class="stat-line"><span>Wins</span><span class="stat-val">${h.wins}</span></div>
        <div class="stat-line"><span>Total Score</span><span class="stat-val">${h.totalScore}</span></div>
        <div class="stat-line"><span>Matches</span><span class="stat-val">${h.matches}</span></div>
      </div>`).join('');
    document.getElementById('btnPlayAgain').textContent = 'Play Again';
    document.getElementById('btnMenu').textContent = '← Main Menu';
    Sfx.win();
    this._showScreen('resultsScreen');
    // Reset tournament when they leave
    t.active = false; t.phase = 'done';
  }

  _floatText(text, x, y, col) {
    this._floatTexts.push({ text, x, y, col, life: 1.2, vy: -90, alpha: 1 });
  }

  _updateHUD() {
    const timerEl = document.getElementById('waveTimer');
    if (timerEl) {
        timerEl.textContent = Math.max(0, Math.ceil(this.waveTimer));
        timerEl.classList.toggle('urgent', this.waveTimer <= 5);
    }
    // Tournament match clock
    const tmtEl = document.getElementById('tournMatchTimer');
    if (tmtEl) {
      const t = this.tourn;
      if (t && t.active) {
        const secs = Math.ceil(t.matchTimeLeft);
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        tmtEl.textContent = `⏱ ${m}:${s.toString().padStart(2,'0')}`;
        tmtEl.className = secs <= 20 ? 'urgent' : '';
        tmtEl.style.display = '';
      } else {
        tmtEl.style.display = 'none';
      }
    }
    
    // Wind indicator
    const windEl = document.getElementById('windIndicator');
    if (windEl) {
      let wStr = 'Wind: ';
      const arrows = ">>>";
      const count = Math.abs(Math.round(this.wind / 125));
      if (count === 0) wStr += 'None';
      else if (this.wind > 0) wStr += arrows.slice(0, count) + " (Right)";
      else wStr += "<<<".slice(0, count) + " (Left)";
      windEl.textContent = wStr;
    }

    ['p1', 'p2', 'p3'].forEach(id => {
      const p = this[id];
      if (!p) return;
      
      const uID = id.toUpperCase();
      const scoreEl = document.getElementById(`score${uID}`);
      if (scoreEl) scoreEl.textContent = p.score;
      const comboEl = document.getElementById(`combo${uID}`);
      if (comboEl) comboEl.textContent = p.combo > 1 ? `x${Math.min(p.combo,8)} COMBO` : '';
      
      const el = document.getElementById(`ammo${uID}`);
      if (this.mode === 'solo' && id !== 'p1') return;
      if (this.mode === 'versus' && id === 'p3') return;
      
      if (el) {
        const perc = (p.heat / MAX_HEAT) * 100;
        let statusClass = '';
        if (p.reloading) statusClass = 'overheated';
        else if (p.heat > 70) statusClass = 'hot';
        
        el.innerHTML = `<div class="heat-fill ${statusClass}" style="width: ${perc}%"></div>`;
      }

      const buffEl = document.getElementById(`buff${uID}`);
      if (buffEl) {
          if (p.buff) {
              const buffIcons = { spread: '💥', laser: '🔴', slowmo: '⏳' };
              buffEl.textContent = `${buffIcons[p.buff]} ${Math.ceil(p.buffTimer)}s`;
              if (!buffEl.classList.contains('active')) buffEl.classList.add('active');
          } else {
              buffEl.classList.remove('active');
          }
      }
    });
  }

  _loop(ts) {
    const dt = clamp((ts - (this._lastTs||ts)) / 1000, 0, 0.05);
    this._lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  }

  _draw() {
    if (this.state === 'title' || this.state === 'results') return;
    const ctx = this.ctx; const W = this.canvas.width; const H = this.canvas.height;
    
    ctx.save();
    if (this.shake > 0) ctx.translate(rnd(-this.shake, this.shake), rnd(-this.shake, this.shake));

    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#0a1e0a'); sky.addColorStop(0.6,'#143d14'); sky.addColorStop(1,'#1a5520');
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);
    
    // Wind particles softly drifting
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    const perfT = performance.now() / 1000;
    for(let i=0; i<30; i++) {
        let x = (W / 30) * i + ((perfT * this.wind * 0.3) % W);
        if (x < 0) x += W;
        if (x > W) x -= W;
        let y = ((i * 37) % H) + Math.sin(perfT + i) * 10;
        ctx.fillRect(x, y, Math.abs(this.wind) / 30 + 2, 2);
    }

    ctx.fillStyle = '#0e2a0e'; ctx.fillRect(0, H*0.82, W, H*0.18);
    ctx.fillStyle = '#1a4020'; ctx.fillRect(0, H*0.82, W, 8);
    for (let x = -20; x < W + 100; x += 70) {
      const scale = 0.6 + ((x * 37) % 50)/100;
      this._drawTree(ctx, x, H * 0.82, scale, this.wind);
    }

    for (const pt of this.particles) { ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1); ctx.fillStyle = pt.col; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
    
    for (const tgt of this.targets) { if (tgt.deadTimer < 0.35) { ctx.globalAlpha = tgt.dead ? Math.max(0, 1 - tgt.deadTimer * 4) : 1; this._drawTarget(ctx, tgt, perfT); } }
    ctx.globalAlpha = 1;

    for (const b of this.bullets) this._drawBullet(ctx, b);
    ctx.save(); ctx.textAlign = 'center';
    for (const ft of this._floatTexts) { ctx.globalAlpha = clamp(ft.life * 1.5, 0, 1); ctx.fillStyle = ft.col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4; ctx.font = '900 20px "Outfit", sans-serif'; ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y); }
    ctx.restore();

    if (this.state === 'playing' || this.state === 'waveclear') { 
      [this.p1, this.p2, this.p3].forEach(p => {
        if (!p || (this.mode === 'solo' && p.id !== 'p1') || (this.mode === 'versus' && p.id === 'p3')) return;
        this._drawShotgun(ctx, p, COLORS[p.id], p.id === 'p3' ? 'female' : 'male');
        
        // Laser Sight logic
        if (p.buff === 'laser' && !p.reloading) {
            ctx.beginPath();
            let lx = p.x + Math.cos(p.angle) * 50;
            let ly = p.y - 12 + Math.sin(p.angle) * 50;
            ctx.moveTo(lx, ly);
            let velX = Math.cos(p.angle) * BULLET_SPEED;
            let velY = Math.sin(p.angle) * BULLET_SPEED;
            for(let i=0; i<30; i++) {
                velX += this.wind * 0.016;
                lx += velX * 0.016;
                ly += velY * 0.016;
                ctx.lineTo(lx, ly);
            }
            ctx.strokeStyle = `rgba(${p.id==='p1'?'255,50,50':(p.id==='p2'?'50,200,255':'200,50,255')}, 0.5)`;
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 15]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        this._drawInk(ctx, p, W, H);
      });
    }
    ctx.restore();
  }

  _drawInk(ctx, p, W, H) {
      if (p.inkTimer <= 0) return;
      ctx.save();
      // Render splatters on this player's fraction of the screen
      let xOffset = 0, splatW = W;
      if (this.mode === 'versus') { splatW = W/2; xOffset = p.id === 'p1' ? 0 : splatW; }
      else if (this.mode === 'trio') { splatW = W/3; xOffset = p.id === 'p1' ? 0 : (p.id === 'p2' ? splatW : splatW * 2); }

      ctx.globalAlpha = Math.min(1.0, p.inkTimer); // Fades out in last second
      ctx.fillStyle = '#050505';
      
      // We use a pseudo-random looking pattern tied to their ID so it covers effectively
      const points = [
          {x: xOffset + splatW * 0.5, y: H * 0.5, r: 150},
          {x: xOffset + splatW * 0.3, y: H * 0.3, r: 100},
          {x: xOffset + splatW * 0.7, y: H * 0.6, r: 120},
          {x: xOffset + splatW * 0.4, y: H * 0.8, r: 90},
      ];

      for (const pt of points) {
          ctx.beginPath();
          // Draw blobby splatters
          for(let i=0; i<6; i++) {
              ctx.arc(pt.x + rndI(-20,20), pt.y + rndI(-20,20), pt.r * rnd(0.7, 1.2), 0, Math.PI*2);
          }
          ctx.fill();
      }

      ctx.restore();
  }

  _drawCanvasGoose(ctx, bob, flap, claimedBy) {
    // Canada Goose â€” larger, black head/neck, white chin strap, brown body
    let headC = '#111', bodyC = '#8b6914', chestC = '#c8a84b', wingC = '#6b5010', beakC = '#333', chinC = '#fff';
    if (claimedBy) {
      headC = claimedBy==='p1'?'#ff4455':'#00ccff';
      bodyC = headC; chestC = headC; wingC = headC; beakC = '#fff'; chinC = headC;
    }
    ctx.translate(0, bob);
    ctx.scale(1.35, 1.35); // Goose is bigger than a duck!

    // Rear tail feathers
    ctx.fillStyle = wingC;
    ctx.beginPath(); ctx.moveTo(-30,0); ctx.lineTo(-52,-6); ctx.lineTo(-45,8); ctx.fill();

    // Main body
    ctx.fillStyle = bodyC;
    ctx.beginPath(); ctx.ellipse(0, 4, 32, 17, 0, 0, Math.PI*2); ctx.fill();

    // Lower chest / belly (lighter)
    ctx.fillStyle = chestC;
    ctx.beginPath(); ctx.ellipse(14, 10, 16, 11, -0.3, 0, Math.PI*2); ctx.fill();

    // Back wing (animating)
    ctx.save(); ctx.translate(-6, 0); ctx.rotate(flap * Math.PI/180);
    ctx.fillStyle = wingC;
    ctx.beginPath(); ctx.ellipse(0, -14, 12, 28, -0.15, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Front wing flash (lighter brown tip)
    ctx.fillStyle = '#4a3808';
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-44, -10); ctx.lineTo(-34, 10); ctx.fill();

    // Long neck (black)
    ctx.fillStyle = headC;
    ctx.beginPath();
    ctx.moveTo(14, -4); ctx.quadraticCurveTo(28, -28, 30, -36);
    ctx.quadraticCurveTo(32, -44, 28, -44);
    ctx.quadraticCurveTo(16, -44, 14, -28);
    ctx.quadraticCurveTo(10, -14, 10, -4);
    ctx.fill();

    // Head (oval, black)
    ctx.fillStyle = headC;
    ctx.beginPath(); ctx.ellipse(28, -50, 11, 9, 0.2, 0, Math.PI*2); ctx.fill();

    // White chin strap
    ctx.fillStyle = chinC;
    ctx.beginPath(); ctx.ellipse(27, -46, 6, 3.5, 0.2, 0, Math.PI*2); ctx.fill();

    // Beak (dark, flat)
    ctx.fillStyle = beakC;
    ctx.beginPath(); ctx.moveTo(38, -52); ctx.lineTo(50, -50); ctx.lineTo(38, -48); ctx.fill();

    // Eye
    ctx.fillStyle = claimedBy ? '#fff' : '#e8d44d';
    ctx.beginPath(); ctx.arc(33, -52, 2.2, 0, Math.PI*2); ctx.fill();
    if (!claimedBy) { ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(33.5,-52,1.2,0,Math.PI*2); ctx.fill(); }
  }

  _drawCanvasDuck(ctx, bob, flap, variant, claimedBy) {
    let headC = '#064e3b', bodyC = '#a8a29e', chestC = '#78350f', wingC = '#44403c', beakC = '#fbbf24';
    if (variant === 'white') {
      headC = '#ffffff'; bodyC = '#f5f5f5'; chestC = '#e5e5e5'; wingC = '#d4d4d8'; beakC = '#f97316';
    } else if (variant === 'golden') {
      headC = '#fbbf24'; bodyC = '#fcd34d'; chestC = '#f59e0b'; wingC = '#d97706'; beakC = '#fef3c7';
    }
    if (claimedBy) { 
        headC = claimedBy==='p1'?'#ff4455':'#00ccff'; 
        bodyC = headC; chestC = headC; wingC = headC; beakC = '#fff';
    }

    ctx.translate(0, bob);
    ctx.scale(1.1, 1.1); 

    ctx.save(); ctx.translate(-4, -6); ctx.rotate(-flap * 0.6 * Math.PI/180);
    ctx.fillStyle = chestC; ctx.beginPath(); ctx.ellipse(0, -10, 8, 20, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.fillStyle = wingC; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-40, -8); ctx.lineTo(-30, 8); ctx.fill();
    ctx.fillStyle = bodyC; ctx.beginPath(); ctx.ellipse(0, 4, 26, 14, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = chestC; ctx.beginPath(); ctx.ellipse(15, 6, 12, 10, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = headC; ctx.beginPath(); ctx.ellipse(20, -6, 8, 12, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -18, 12, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = beakC; ctx.beginPath(); ctx.ellipse(38, -16, 10, 4, -0.1, 0, Math.PI*2); ctx.fill();
    
    ctx.fillStyle = claimedBy ? '#fff' : '#000';
    if (claimedBy) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth=2; 
      ctx.beginPath(); ctx.moveTo(27,-22); ctx.lineTo(31,-18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(31,-22); ctx.lineTo(27,-18); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(29, -20, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(30, -21, 0.8, 0, Math.PI*2); ctx.fill();
    }

    ctx.save(); ctx.translate(0, 2); ctx.rotate(flap * Math.PI/180);
    ctx.fillStyle = wingC; ctx.beginPath(); ctx.ellipse(0, -12, 10, 24, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = headC; ctx.beginPath(); ctx.ellipse(0, -16, 4, 12, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    if (variant === 'golden' && !claimedBy) {
      ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 20;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 4, 26, 14, 0, 0, Math.PI*2); ctx.stroke();
    }
  }

  _drawCanvasCrow(ctx, bob, flap, claimedBy) {
    let headC = '#111', bodyC = '#1c1c24', wingC = '#0a0a0f', beakC = '#444';
    if (claimedBy) {
      headC = claimedBy==='p1'?'#ff4455':'#00ccff';
      bodyC = headC; wingC = headC; beakC = '#fff';
    }
    
    ctx.translate(0, bob);
    ctx.scale(0.9, 0.9); // Crows are slightly smaller

    // Tail Feathers (jagged)
    ctx.fillStyle = wingC;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-35, -12); ctx.lineTo(-40, 2); ctx.lineTo(-25, 8); ctx.fill();

    // Body Mass (slimmer)
    ctx.fillStyle = bodyC;
    ctx.beginPath(); ctx.ellipse(0, 4, 22, 10, 0, 0, Math.PI*2); ctx.fill();

    // Back Wing
    ctx.save(); ctx.translate(-4, -4); ctx.rotate(-flap * 0.7 * Math.PI/180);
    ctx.fillStyle = wingC; ctx.beginPath(); ctx.ellipse(0, -8, 8, 22, 0.4, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // Head and Neck (hunched)
    ctx.fillStyle = headC;
    ctx.beginPath(); ctx.ellipse(14, -4, 8, 6, 0.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, -10, 9, 7, 0, 0, Math.PI*2); ctx.fill();

    // Beak (sharp, raven-like)
    ctx.fillStyle = beakC;
    ctx.beginPath(); ctx.moveTo(28, -12); ctx.lineTo(40, -10); ctx.lineTo(28, -8); ctx.fill();

    // Eye (menacing red)
    ctx.fillStyle = claimedBy ? '#fff' : '#ef4444';
    ctx.beginPath(); ctx.arc(22, -12, 2, 0, Math.PI*2); ctx.fill();
    if (claimedBy) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth=1.5; 
      ctx.beginPath(); ctx.moveTo(20,-14); ctx.lineTo(24,-10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(24,-14); ctx.lineTo(20,-10); ctx.stroke();
    }

    // Front Wing (sharp)
    ctx.save(); ctx.translate(0, 0); ctx.rotate(flap * 1.2 * Math.PI/180);
    ctx.fillStyle = wingC;
    ctx.beginPath(); ctx.ellipse(0, -10, 8, 24, -0.3, 0, Math.PI*2); ctx.fill();
    // Inner wing definition
    ctx.fillStyle = bodyC; 
    ctx.beginPath(); ctx.ellipse(0, -14, 3, 15, -0.3, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  _drawTree(ctx, x, y, scale, wind) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const sway = Math.sin(performance.now()/(800 + x)) * (wind*0.005);
    ctx.transform(1, 0, Math.max(-0.2, Math.min(0.2, sway)), 1, 0, 0); 
    ctx.fillStyle = '#061a08'; ctx.fillRect(-4, 0, 8, 15);
    for(let i=0; i<4; i++) {
        ctx.fillStyle = (i%2===0) ? '#0d2a10' : '#143d14';
        ctx.beginPath();
        ctx.moveTo(-25 + i*4, -15 - i*20);
        ctx.lineTo(0, -50 - i*25);
        ctx.lineTo(25 - i*4, -15 - i*20);
        ctx.fill();
    }
    ctx.restore();
  }

  _drawTarget(ctx, tgt, t) {
    const x = tgt.px, y = tgt.py; ctx.save(); ctx.translate(x, y); if (tgt.vx < 0) ctx.scale(-1,1);
    const bob = Math.sin(tgt.anim * 5) * 4; 
    const flap = Math.sin(tgt.anim * 18) * 45; // Intense wing flapping!

    if (tgt.type === 'duck' || tgt.type === 'clay' || tgt.type === 'golden') {
        const variant = tgt.type === 'duck' ? 'mallard' : (tgt.type === 'clay' ? 'white' : 'golden');
        this._drawCanvasDuck(ctx, bob, flap, variant, tgt.claimedBy);
    } 
    else if (tgt.type === 'goose') {
        this._drawCanvasGoose(ctx, bob, flap, tgt.claimedBy);
    }
    else if (tgt.type === 'balloon') {
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, bob-10, 24, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-6, bob+12); ctx.lineTo(6, bob+12); ctx.lineTo(0, bob-10); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, bob+12); ctx.lineTo(0, bob+30); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '20px serif'; ctx.fillText('🎁', 0, bob-4);
    }
    else if (tgt.type === 'crate') {
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-20, -20+bob, 40, 40);
        ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 2; ctx.strokeRect(-20, -20+bob, 40, 40);
        ctx.beginPath(); ctx.moveTo(-20, -20+bob); ctx.lineTo(20, 20+bob); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, -20+bob); ctx.lineTo(-20, 20+bob); ctx.stroke();
    }
    else if (tgt.type === 'squid') {
      // Orient squid correctly: body forward, tentacles trail behind
      const squish = Math.sin(tgt.anim * 8) * 3;
      ctx.fillStyle = tgt.claimedBy==='p1'?'#ff4455':tgt.claimedBy==='p2'?'#00ccff':'#4c1d95';
      // Main mantle (points forward)
      ctx.beginPath(); ctx.ellipse(8, bob, 20+squish, 13-squish*0.5, 0, 0, Math.PI*2); ctx.fill();
      // Pointed head cone
      ctx.beginPath(); ctx.moveTo(28+squish, bob); ctx.lineTo(18, bob-7); ctx.lineTo(18, bob+7); ctx.fill();
      // Fin flaps (back sides)
      ctx.fillStyle = tgt.claimedBy?'rgba(255,255,255,0.3)':'#6d28d9';
      ctx.beginPath(); ctx.ellipse(0, bob-10, 10, 5, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, bob+10, 10, 5, -0.4, 0, Math.PI*2); ctx.fill();
      // Eye
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(20, bob-4, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ff0044'; ctx.beginPath(); ctx.arc(21, bob-4, 2.2, 0, Math.PI*2); ctx.fill();
      // Tentacles trail BEHIND (to the left, since target moves right)
      ctx.strokeStyle = '#3b0764'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      for(let i=0; i<6; i++) {
        const ty = bob - 10 + i * 4;
        const wave = Math.sin(tgt.anim * 6 + i) * (4 + squish);
        ctx.beginPath();
        ctx.moveTo(-8, ty);
        ctx.quadraticCurveTo(-28, ty + wave, -44 - i*4, ty + wave * 1.5);
        ctx.stroke();
      }
    } 
    else { // crow
      this._drawCanvasCrow(ctx, bob, flap, tgt.claimedBy);
    }
    ctx.restore();
  }

  _drawBullet(ctx, b) {
    ctx.save();
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < b.trail.length - 1; i++) {
      ctx.globalAlpha = i / b.trail.length; ctx.strokeStyle = b.col;
      ctx.beginPath(); ctx.moveTo(b.trail[i].x, b.trail[i].y); ctx.lineTo(b.trail[i+1].x, b.trail[i+1].y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.fillStyle = b.col; ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(4, 0, 4, 1.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  _drawShotgun(ctx, p, col, variant = 'male') {
    ctx.save(); ctx.translate(p.x, p.y);

    // â”€â”€ Shadow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 6, 22, 7, 0, 0, Math.PI*2); ctx.fill();

    // â”€â”€ Boots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.fillStyle = '#2d1a0e';
    ctx.beginPath(); ctx.roundRect(-14, -4, 12, 10, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2, -4, 12, 10, 3); ctx.fill();

    // â”€â”€ Legs (camo trousers) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.fillStyle = '#4a5240';
    ctx.fillRect(-12, -22, 10, 20);
    ctx.fillRect(2, -22, 10, 20);
    // camo patches
    ctx.fillStyle = '#3a4030';
    ctx.fillRect(-11, -18, 4, 5); ctx.fillRect(3, -15, 5, 4);

    // â”€â”€ Jacket body (dark olive camo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.fillStyle = '#4b5320';
    if (variant === 'female') {
      ctx.beginPath(); ctx.roundRect(-12, -46, 24, 26, 4); ctx.fill(); // narrower shoulders
      ctx.fillStyle = '#3b4118'; ctx.fillRect(-10,-42,8,6); ctx.fillRect(0,-38,8,5); ctx.fillRect(-6,-32,6,5);
      ctx.fillStyle = '#5a6428'; ctx.fillRect(-2,-44,6,4); ctx.fillRect(4,-34,5,4);
      ctx.fillStyle = col; ctx.fillRect(-4, -46, 8, 5); // collar accent
    } else {
      ctx.beginPath(); ctx.roundRect(-16, -46, 32, 26, 4); ctx.fill();
      ctx.fillStyle = '#3b4118'; ctx.fillRect(-14,-42,8,6); ctx.fillRect(2,-38,10,5); ctx.fillRect(-10,-32,6,5);
      ctx.fillStyle = '#5a6428'; ctx.fillRect(-4,-44,6,4); ctx.fillRect(6,-34,7,4);
      ctx.fillStyle = col; ctx.fillRect(-6, -46, 12, 5);
    }

    // â”€â”€ Arm holding gun â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.save();
    ctx.translate(6, -38);
    ctx.rotate(p.angle + 0.1);
    ctx.translate(-p.recoil * 0.8, 0);
    // upper arm sleeve
    ctx.fillStyle = '#4b5320'; ctx.beginPath(); ctx.roundRect(0, -5, 28, 10, 4); ctx.fill();
    // gloved hand
    ctx.fillStyle = '#2d1a0e'; ctx.beginPath(); ctx.ellipse(32, 0, 8, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // â”€â”€ Gun (aiming from shoulder) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    ctx.save();
    ctx.translate(4, -42);
    ctx.rotate(p.angle);
    ctx.translate(-p.recoil * 1.5, 0);
    // Double barrels
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(8, -7, 72, 5);
    ctx.fillRect(8, -1, 72, 5);
    // barrel highlight
    ctx.fillStyle = '#555';
    ctx.fillRect(8, -7, 72, 1);
    // Pump grip (wood)
    ctx.fillStyle = '#7c4a1e'; ctx.fillRect(28, -3, 26, 10);
    ctx.fillStyle = '#5a3210'; for(let i=30; i<52; i+=5) ctx.fillRect(i,-3,2,10);
    // Receiver (player color accent)
    ctx.fillStyle = '#333'; ctx.fillRect(-14, -9, 24, 18);
    ctx.fillStyle = col; ctx.fillRect(-14, -9, 6, 18); // colored stripe on receiver
    // Stock (wood)
    ctx.fillStyle = '#7c4a1e';
    ctx.beginPath(); ctx.moveTo(-14,-9); ctx.lineTo(-40,-5); ctx.lineTo(-40, 13); ctx.lineTo(-14, 9); ctx.fill();
    ctx.restore();

    // â”€â”€ Head (hunter face) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Neck
    ctx.fillStyle = '#c8845a';
    ctx.fillRect(-5, -58, 10, 14);

    // Face skin
    ctx.fillStyle = '#d4956a';
    if (variant === 'female') {
      ctx.beginPath(); ctx.ellipse(0, -64, 11, 14, 0, 0, Math.PI*2); ctx.fill(); // Softer face
      // Blush
      ctx.fillStyle = 'rgba(255,100,100,0.15)';
      ctx.beginPath(); ctx.ellipse(-6, -60, 2.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -60, 2.5, 1.5, 0, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(0, -64, 13, 15, 0, 0, Math.PI*2); ctx.fill();
      // Stubble / jaw shadow
      ctx.fillStyle = 'rgba(80,40,20,0.35)';
      ctx.beginPath(); ctx.ellipse(0, -58, 10, 6, 0, 0, Math.PI*2); ctx.fill();
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -65, 3.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -65, 3.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3a2000';
    ctx.beginPath(); ctx.arc(-5, -65, 1.8, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -65, 1.8, 0, Math.PI*2); ctx.fill();
    // eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4.2, -65.6, 0.7, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(5.8, -65.6, 0.7, 0, Math.PI*2); ctx.fill();

    // Nose
    ctx.fillStyle = '#b06040';
    ctx.beginPath(); ctx.ellipse(0, -62, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();

    // Hunter cap (flat-brim / blaze style â€” player color tinted)
    if (variant === 'female') {
      // Ponytail out the back
      ctx.fillStyle = '#2d1a0e';
      ctx.beginPath(); ctx.ellipse(-14, -68, 6, 8, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-16, -64); ctx.lineTo(-24, -50); ctx.lineTo(-12, -56); ctx.fill();
    }
    
    // Cap body
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -76, 14, 8, 0, 0, Math.PI*2); ctx.fill();
    // darker cap crown stripe
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, -76, 14, 8, 0, 0, Math.PI*2); ctx.fill();
    // solid front panel in player color
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(0, -75, 12, 6, 0, 0, Math.PI*2); ctx.fill();
    // brim
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(4, -69, 16, 4, 0.15, 0, Math.PI); ctx.fill();

    ctx.restore();
  }
}

function waveConfig(waveNum, difficulty) {
  const d = { easy:0.7, normal:1, hard:1.4 }[difficulty] || 1;
  const base = Math.min(waveNum, 10);
  return {
    targetCount : Math.round((4 + base * 1.2) * d), spawnInterval: Math.max(0.5, (2.5 - base*0.15) / d), timer: Math.round(20 + base * 2),
    goldChance: Math.min(0.08 + base*0.015, 0.2), clayChance: Math.min(0.15 + base*0.02, 0.35), crowChance: Math.min(base*0.015, 0.12),
    squidChance: 0.05,
    gooseChance: waveNum >= 5 ? Math.min((waveNum - 4) * 0.04, 0.25) : 0, // Geese start wave 5, ramp up
  };
}

// â”€â”€ Persistent Settings & Name Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LS_NAMES_KEY  = 'duckHunt_savedNames';   // JSON array of unique name strings
const LS_VOICE_KEY  = 'duckHunt_voiceEnabled'; // '0' or '1'

function _savedNames() {
  try { return JSON.parse(localStorage.getItem(LS_NAMES_KEY) || '[]'); } catch(e) { return []; }
}

function _addSavedName(name) {
  if (!name) return;
  const list = _savedNames().filter(n => n !== name); // dedupe
  list.unshift(name); // most-recent first
  const capped = list.slice(0, 20); // keep max 20
  localStorage.setItem(LS_NAMES_KEY, JSON.stringify(capped));
}

function _refreshDatalist() {
  const dl = document.getElementById('savedNames');
  if (!dl) return;
  dl.innerHTML = _savedNames().map(n => `<option value="${n.replace(/"/g,'&quot;')}"></option>`).join('');
}

window.addEventListener('DOMContentLoaded', () => {
  Sfx.loadFiles();

  // â”€â”€ Restore saved names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saved = _savedNames();
  // Pre-fill inputs with the three most recent names
  ['p1Name','p2Name','p3Name'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && saved[i]) el.value = saved[i];
  });
  _refreshDatalist();

  // â”€â”€ Restore voice toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const voiceToggle = document.getElementById('voiceToggle');
  if (voiceToggle) {
    const stored = localStorage.getItem(LS_VOICE_KEY);
    // Default is ON (checked). Only turn off if explicitly saved as '0'.
    voiceToggle.checked = stored !== '0';
    voiceToggle.addEventListener('change', () => {
      localStorage.setItem(LS_VOICE_KEY, voiceToggle.checked ? '1' : '0');
    });
  }

  new DuckHuntDuel();
});

