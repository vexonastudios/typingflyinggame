'use strict';

// ─────────────────────────────────────────────────────────────
// Audio Engine
// ─────────────────────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  resume: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
  playTone: (freq, type, dur, vol = 0.1, detune = 0) => {
    try {
      Sfx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (detune) osc.detune.setValueAtTime(detune, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  },
  jump:    () => { Sfx.playTone(320, 'square', 0.12, 0.06); Sfx.playTone(480, 'square', 0.08, 0.04); },
  land:    () => Sfx.playTone(120, 'triangle', 0.08, 0.08),
  coin:    () => { Sfx.playTone(880, 'sine', 0.08, 0.08); setTimeout(() => Sfx.playTone(1320, 'sine', 0.12, 0.08), 60); },
  stomp:   () => { Sfx.playTone(160, 'triangle', 0.18, 0.12); Sfx.playTone(80, 'sawtooth', 0.1, 0.08); },
  correct: () => { [600, 750, 950].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.18, 0.1), i * 90)); },
  wrong:   () => { Sfx.playTone(200, 'sawtooth', 0.3, 0.12); Sfx.playTone(150, 'sawtooth', 0.3, 0.08); },
  hurt:    () => { Sfx.playTone(180, 'sawtooth', 0.25, 0.1); setTimeout(() => Sfx.playTone(140, 'sawtooth', 0.2, 0.08), 80); },
  win:     () => { [400, 500, 600, 800].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.25, 0.1), i * 120)); },
  powerup: () => { [600, 700, 800, 1000].forEach((f, i) => setTimeout(() => Sfx.playTone(f, 'sine', 0.15, 0.1), i * 60)); },
  hit:     () => { Sfx.playTone(300, 'square', 0.1, 0.07); }
};

// ─────────────────────────────────────────────────────────────
// Question Bank
// ─────────────────────────────────────────────────────────────
const PROMPTS = {
  Easy: [
    { q: "5 + 4 = ?",           a: "9",      w: ["8", "10"] },
    { q: "10 − 3 = ?",          a: "7",      w: ["6", "8"] },
    { q: "8 + 8 = ?",           a: "16",     w: ["15", "14"] },
    { q: "12 − 5 = ?",          a: "7",      w: ["6", "8"] },
    { q: "20 + 5 = ?",          a: "25",     w: ["15", "30"] },
    { q: "3 + 7 = ?",           a: "10",     w: ["9", "11"] },
    { q: "15 − 8 = ?",          a: "7",      w: ["6", "5"] },
    { q: "6 + 9 = ?",           a: "15",     w: ["14", "16"] },
    { q: "Plural of 'cat'",     a: "cats",   w: ["cates", "cat"] },
    { q: "Plural of 'box'",     a: "boxes",  w: ["boxs", "booxes"] },
    { q: "Rhymes with 'bat'",   a: "cat",    w: ["dog", "bird"] },
    { q: "Rhymes with 'hop'",   a: "pop",    w: ["step", "jump"] },
    { q: "Rhymes with 'run'",   a: "sun",    w: ["rain", "walk"] },
    { q: "Rhymes with 'day'",   a: "play",   w: ["night", "sing"] },
    { q: "Opposite of 'hot'",   a: "cold",   w: ["warm", "cool"] },
    { q: "Opposite of 'big'",   a: "small",  w: ["tall", "wide"] },
    { q: "4 × 2 = ?",           a: "8",      w: ["6", "10"] },
    { q: "3 × 3 = ?",           a: "9",      w: ["6", "12"] },
    { q: "10 ÷ 2 = ?",          a: "5",      w: ["4", "6"] },
    { q: "Plural of 'bus'",     a: "buses",  w: ["buss", "busi"] },
    { q: "Plural of 'child'",   a: "children", w: ["childs", "childen"] },
    { q: "Past tense: 'jump'",  a: "jumped", w: ["jumpt", "jumping"] },
    { q: "Past tense: 'walk'",  a: "walked", w: ["walkt", "walking"] },
    { q: "2 × 5 = ?",           a: "10",     w: ["8", "12"] },
    { q: "14 − 6 = ?",          a: "8",      w: ["7", "9"] }
  ],
  Medium: [
    { q: "6 × 4 = ?",                    a: "24",      w: ["20", "28"] },
    { q: "8 × 7 = ?",                    a: "56",      w: ["54", "64"] },
    { q: "36 ÷ 6 = ?",                   a: "6",       w: ["4", "8"] },
    { q: "9 × 9 = ?",                    a: "81",      w: ["72", "90"] },
    { q: "7 × 8 = ?",                    a: "56",      w: ["48", "63"] },
    { q: "48 ÷ 8 = ?",                   a: "6",       w: ["5", "7"] },
    { q: "12 × 4 = ?",                   a: "48",      w: ["42", "56"] },
    { q: "63 ÷ 7 = ?",                   a: "9",       w: ["7", "8"] },
    { q: "Synonym for 'huge'",           a: "giant",   w: ["tiny", "flat"] },
    { q: "Synonym for 'rapid'",          a: "fast",    w: ["slow", "heavy"] },
    { q: "Antonym for 'always'",         a: "never",   w: ["often", "rarely"] },
    { q: "Antonym for 'create'",         a: "destroy", w: ["build", "make"] },
    { q: "Past tense of 'run'",          a: "ran",     w: ["runned", "running"] },
    { q: "Past tense of 'eat'",          a: "ate",     w: ["eated", "eaten"] },
    { q: "Past tense of 'swim'",         a: "swam",    w: ["swimmed", "swum"] },
    { q: "Synonym for 'angry'",          a: "furious", w: ["happy", "afraid"] },
    { q: "11 × 11 = ?",                  a: "121",     w: ["111", "131"] },
    { q: "144 ÷ 12 = ?",                 a: "12",      w: ["11", "13"] },
    { q: "Antonym for 'ancient'",        a: "modern",  w: ["old", "broken"] },
    { q: "Synonym for 'begin'",          a: "start",   w: ["end", "pause"] },
    { q: "Plural of 'leaf'",             a: "leaves",  w: ["leafs", "leavies"] },
    { q: "Plural of 'tooth'",            a: "teeth",   w: ["tooths", "toothes"] },
    { q: "'Their' means…",               a: "belongs to them", w: ["a place", "they are"] },
    { q: "Synonym for 'smart'",          a: "clever",  w: ["loud", "strong"] },
    { q: "5² = ?",                        a: "25",      w: ["10", "50"] }
  ],
  Hard: [
    { q: "4x = 32, x = ?",              a: "8",        w: ["6", "7"] },
    { q: "3x + 2 = 17, x = ?",          a: "5",        w: ["4", "6"] },
    { q: "5(2 + 3) = ?",               a: "25",       w: ["10", "15"] },
    { q: "2x − 4 = 10, x = ?",          a: "7",        w: ["6", "8"] },
    { q: "x² = 64, x = ?",             a: "8",        w: ["6", "9"] },
    { q: "Prefix 'anti-' means…",       a: "against",  w: ["before", "with"] },
    { q: "Prefix 'pre-' means…",        a: "before",   w: ["after", "against"] },
    { q: "Which is a noun?",            a: "courage",  w: ["brave", "quickly"] },
    { q: "Which is a verb?",            a: "sprint",   w: ["fast", "runner"] },
    { q: "Which is an adjective?",      a: "shiny",    w: ["shine", "glowing"] },
    { q: "Plural of 'mouse'",           a: "mice",     w: ["mouses", "meece"] },
    { q: "Suffix '-tion' makes a…",     a: "noun",     w: ["verb", "adjective"] },
    { q: "Homophone of 'their'",        a: "there",    w: ["they're", "here"] },
    { q: "Homophone of 'bare'",         a: "bear",     w: ["pear", "beer"] },
    { q: "Meaning of 'benevolent'",     a: "kind",     w: ["evil", "careless"] },
    { q: "Antonym for 'verbose'",       a: "brief",    w: ["wordy", "loud"] },
    { q: "LCD of 3 and 4?",             a: "12",       w: ["6", "7"] },
    { q: "√144 = ?",                    a: "12",       w: ["11", "14"] },
    { q: "Meaning of 'tenacious'",      a: "persistent", w: ["lazy", "gentle"] },
    { q: "12x = 144, x = ?",            a: "12",       w: ["11", "13"] },
    { q: "Prefix 'mis-' means…",        a: "wrongly",  w: ["again", "not"] },
    { q: "Synonym for 'ephemeral'",     a: "fleeting", w: ["eternal", "heavy"] },
    { q: "3x² = 75, x = ?",             a: "5",        w: ["3", "7"] },
    { q: "Root word of 'transportation'", a: "port",   w: ["trans", "tion"] },
    { q: "Suffix '-ology' means…",      a: "study of", w: ["fear of", "love of"] }
  ]
};

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────
function intersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function lerpColor(c1, c2, t) {
  // c1/c2 as [r,g,b], t 0..1
  return `rgb(${Math.round(c1[0]+(c2[0]-c1[0])*t)},${Math.round(c1[1]+(c2[1]-c1[1])*t)},${Math.round(c1[2]+(c2[2]-c1[2])*t)})`;
}

function rr(ctx, x, y, w, h, r) {
  // Polyfill for roundRect
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CW = 1200;
const CH = 600;
const GRAVITY = 1600;
const JUMP_FORCE = -780;
const DOUBLE_JUMP_FORCE = -700;
const MAX_SPEED = 360;

// ─────────────────────────────────────────────────────────────
// Main Game Class
// ─────────────────────────────────────────────────────────────
class WordRunner {
  constructor() {
    this.canvas = document.getElementById('runnerCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.keys = {};
    this._prevKeys = {};
    window.addEventListener('keydown', e => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      this.keys[e.key] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key] = false;
    });

    // Radio button UI handling
    document.querySelectorAll('.diff-opt input').forEach(inp => {
      inp.addEventListener('change', () => {
        const group = inp.closest('.diff-options');
        group.querySelectorAll('.diff-opt').forEach(el => el.classList.remove('selected'));
        inp.closest('.diff-opt').classList.add('selected');
      });
    });

    document.getElementById('startMissionBtn').addEventListener('click', () => {
      const diffEl = document.querySelector('input[name="diff"]:checked');
      const modeEl = document.querySelector('input[name="mode"]:checked');
      this.currentDifficulty = diffEl ? diffEl.value : 'Medium';
      this.playerCount = modeEl ? parseInt(modeEl.value) : 1;
      document.getElementById('gameSetup').style.display = 'none';
      Sfx.resume();
      this.startGame(1);
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      this.startGame(this.gameIsOver ? 1 : Math.min(this.currentLevel + 1, 5));
    });

    document.getElementById('retryBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      this.startGame(this.currentLevel);
    });

    this.state = 'setup';
    this.currentLevel = 1;
    this.gameIsOver = false;
    this.currentDifficulty = 'Medium';
    this.playerCount = 1;
    this.score = 0;
    this.combo = 0;
    this.shakeTimer = 0;
    this.shakeAmt = 0;
    this.flashTimer = 0;
    this.flashColor = '#fff';
    this.bgStars = this._genStars(80);
    this.bgClouds = this._genClouds(12);

    // Init empty arrays
    this._clearWorld();

    requestAnimationFrame((ts) => this._loop(ts));
  }

  // ─── World State ───
  _clearWorld() {
    this.platforms   = [];
    this.coins       = [];
    this.enemies     = [];
    this.gates       = [];
    this.sparks      = [];
    this.players     = [];
    this.projectiles = [];
    this.hearts      = [];
    this.spikes      = [];
    this.powerups    = [];
    this.floatTexts  = [];
    this.levelTime   = 0;
    this.bossPhase   = false;
    this.cameraX     = 0;
    this.cameraY     = 0;
    this.bossEntity  = null;
    this.bossGate    = null;
    this.bossHealth  = 0;
    this.goalFlag    = null;
    this.levelEndTimer = -1;
  }

  // ─── Background Generation ───
  _genStars(n) {
    const stars = [];
    for (let i = 0; i < n; i++) {
      stars.push({ x: Math.random() * 9999, y: Math.random() * CH * 0.85, r: Math.random() * 1.5 + 0.3, blink: Math.random() * Math.PI * 2 });
    }
    return stars;
  }

  _genClouds(n) {
    const clouds = [];
    for (let i = 0; i < n; i++) {
      clouds.push({ x: Math.random() * 8000, y: 40 + Math.random() * 200, s: 0.5 + Math.random() * 1.2, speed: 8 + Math.random() * 10 });
    }
    return clouds;
  }

  // ─── Start / Level ───
  startGame(level = 1) {
    this.currentLevel = level;
    this.state = 'playing';
    this.gameIsOver = false;
    if (level === 1) this.score = 0;
    this.combo = 0;
    this.shakeTimer = 0;
    this.flashTimer = 0;

    this._clearWorld();
    document.getElementById('levelBadge').textContent = `LVL ${level}/5`;

    this.players = [];
    const configs = [
      { id: 1, color: '#38bdf8', glow: 'rgba(56,189,248,0.4)', up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', x: 60 },
      { id: 2, color: '#fb7185', glow: 'rgba(251,113,133,0.4)', up: 'w', left: 'a', right: 'd', x: 100 }
    ];
    for (let i = 0; i < this.playerCount; i++) {
      const c = configs[i];
      this.players.push({
        id: c.id, lives: 3, coinsCollected: 0,
        x: c.x, y: 300, w: 32, h: 48,
        vx: 0, vy: 0,
        color: c.color, glow: c.glow,
        grounded: false, up: c.up, left: c.left, right: c.right,
        dead: false, jumpCount: 0,
        invincibleTimer: 0, bootTimer: 0,
        animTime: 0, squash: 1, squashVel: 0,
        jumpReleased: true, wasGrounded: false,
        facingRight: true,
        trailFrames: []
      });
    }

    this._updateHUD();
    this._generateLevel();
  }

  // ─── Level Generation ───
  _generateLevel() {
    const diff = this.currentLevel - 1; // 0,1,2
    const gateCount = 4 + diff * 2;
    let px = 0;

    // Starting platform
    this.platforms.push({ x: -300, y: 500, w: 700, h: 120, active: true, type: 'grass' });
    px += 400;

    const allPrompts = [...PROMPTS[this.currentDifficulty]].sort(() => Math.random() - 0.5);

    for (let i = 0; i < gateCount; i++) {
      // ── 1. Navigation gap ──
      const gap = 150 + Math.random() * 40 + diff * 10;
      const platW = Math.max(280, 650 - diff * 120);

      // Moving island in gap
      const islandSpeed = 70 + diff * 25;
      this.platforms.push({
        x: px + gap / 2 - 40, y: 460, w: 90, h: 26,
        active: true, type: 'moving',
        moveY: true, speed: islandSpeed,
        startY: 460, endY: 290,
        startX: px + gap / 2 - 40, endX: px + gap / 2 - 40,
        vx: 0, vy: -islandSpeed
      });

      // Main landing platform
      const landX = px + gap;
      this.platforms.push({ x: landX, y: 500, w: platW, h: 120, active: true, type: 'grass' });

      // Coins cluster
      for (let j = 0; j < 3; j++) {
        this.coins.push({ x: landX + platW * 0.3 + j * 50, y: 380, w: 18, h: 18, collected: false });
      }
      // Heart pickup (random)
      if (Math.random() < 0.28) {
        this.hearts.push({ x: landX + platW * 0.6, y: 340, w: 22, h: 22, collected: false });
      }
      // Powerup
      if (Math.random() < 0.18) {
        const type = Math.random() < 0.5 ? 'star' : 'boots';
        this.powerups.push({ type, x: landX + platW * 0.7, y: 340, w: 26, h: 26, active: true, bob: 0 });
      }

      // Enemies (scaled by level)
      const eCap = 1 + diff;
      for (let j = 0; j < eCap; j++) {
        const r = Math.random();
        const ex = landX + 80 + j * 110;
        if (diff >= 1 && r < 0.18) {
          this.enemies.push({ type: 'shooter', x: landX + platW - 120 - j * 50, y: 450, w: 38, h: 50, shootTimer: Math.random() * 2, dead: false, anim: 0 });
        } else if (diff >= 1 && r < 0.35) {
          this.enemies.push({ type: 'flyer', x: ex, y: 300, w: 38, h: 30, vx: -90, startX: landX + 50, endX: landX + platW - 50, startY: 300, flyOffset: Math.random() * 10, dead: false, anim: 0 });
        } else if (diff >= 1 && r < 0.52) {
          this.enemies.push({ type: 'chaser', x: landX + platW / 2 + j * 80, y: 460, w: 38, h: 40, vx: 0, dead: false, anim: 0 });
        } else if (diff >= 2 && r < 0.70) {
          this.enemies.push({ type: 'pacer', x: ex, y: 160, w: 38, h: 38, vy: 110, startY: 160, endY: 420, dead: false, anim: 0 });
        } else {
          this.enemies.push({ type: 'walker', x: landX + platW / 2 + j * 90, y: 460, w: 38, h: 40, vx: -50 - diff * 20, startX: landX + 40, endX: landX + platW - 40, dead: false, anim: 0 });
        }
      }

      px = landX + platW;

      // ── 2. Step section ──
      const stepGap = 90 + diff * 12;
      const stepW   = Math.max(80, 130 - diff * 18);
      this.platforms.push({ x: px + stepGap, y: 410, w: stepW, h: 210, active: true, type: 'stone' });
      if (diff >= 1 && Math.random() < 0.5) {
        // Only cover the right half of the step to leave a safe landing zone
        const spikeW = stepW / 2;
        this.spikes.push({ x: px + stepGap + (stepW - spikeW), y: 395, w: spikeW, h: 15 });
      }
      const step2x = px + stepGap + stepW + 70 + diff * 18;
      this.platforms.push({ x: step2x, y: 310, w: stepW, h: 310, active: true, type: 'stone' });
      for (let j = 0; j < 2; j++) {
        this.coins.push({ x: px + stepGap + stepW + j * 45, y: 210, w: 18, h: 18, collected: false });
      }
      if (diff >= 1 && Math.random() < 0.5) {
        this.enemies.push({ type: 'shooter', x: step2x + stepW / 2 - 19, y: 260, w: 38, h: 50, shootTimer: 0, dead: false, anim: 0 });
      }
      px += stepGap + stepW * 2 + 70 + diff * 18;

      // ── 3. Approach islands ──
      const numIslands = 1 + diff;
      const iSpeed = 85 + diff * 28;
      const iSpacing = 155 + diff * 8;
      for (let k = 0; k < numIslands; k++) {
        const iX = px + 100 + k * iSpacing;
        const iY = 430 - k * 25;
        this.platforms.push({
          x: iX, y: iY, w: 110, h: 28,
          active: true, type: 'moving',
          moveY: true, speed: iSpeed,
          startY: iY, endY: iY - 190,
          startX: iX, endX: iX,
          vx: 0, vy: -iSpeed
        });
        if (Math.random() < 0.4) {
          this.coins.push({ x: iX + 40, y: iY - 30, w: 18, h: 18, collected: false });
          this.coins.push({ x: iX + 65, y: iY - 30, w: 18, h: 18, collected: false });
        } else if (diff >= 1 && Math.random() < 0.5) {
          this.enemies.push({ type: 'chaser', x: iX + 35, y: iY - 40, w: 38, h: 40, vx: 0, dead: false, anim: 0 });
        }
      }

      // Safety pad + gate
      const safeX = px + 80 + numIslands * iSpacing;
      const safeY = 460;
      const prompt = allPrompts[i % allPrompts.length];
      const answers = [prompt.a, prompt.w[0], prompt.w[1]].sort(() => Math.random() - 0.5);
      const gateWallX = safeX + 570;

      const gateWall = { x: gateWallX, y: 0, w: 36, h: 470, active: true, isGate: true };
      this.platforms.push(gateWall);
      this.platforms.push({ x: safeX, y: safeY, w: 750, h: 160, active: true, type: 'grass' });

      this.gates.push({
        prompt: prompt.q,
        blocks: [
          { x: safeX + 120, y: 300, w: 100, h: 54, text: answers[0], isCorrect: answers[0] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 },
          { x: safeX + 290, y: 300, w: 100, h: 54, text: answers[1], isCorrect: answers[1] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 + 1 },
          { x: safeX + 460, y: 300, w: 100, h: 54, text: answers[2], isCorrect: answers[2] === prompt.a, hit: false, bob: Math.random() * Math.PI * 2 + 2 }
        ],
        wall: gateWall,
        cleared: false
      });

      px = safeX + 750;
    }

    // ── 4. End zone / Boss ──
    const landPad = px + 160;
    this.platforms.push({ x: landPad, y: 500, w: 1400, h: 120, active: true, type: 'grass' });

    if (this.currentLevel >= 5) {
      this.bossPhase = true;
      this.bossHealth = 4;
      this.bossMaxHealth = 4;
      this.bossEntity = {
        x: landPad + 1100, y: 240, w: 160, h: 160,
        active: true, shootTimer: 0,
        walkX: landPad + 900, walkDir: -1, walkSpeed: 60,
        anim: 0
      };
      const bPrompts = [...PROMPTS[this.currentDifficulty]].sort(() => Math.random() - 0.5);
      const bp = bPrompts[0];
      const ba = [bp.a, bp.w[0], bp.w[1]].sort(() => Math.random() - 0.5);
      this.bossGate = {
        prompt: bp.q,
        blocks: [
          { x: landPad + 300, y: 290, w: 110, h: 60, text: ba[0], isCorrect: ba[0] === bp.a, hit: false, bob: 0 },
          { x: landPad + 490, y: 290, w: 110, h: 60, text: ba[1], isCorrect: ba[1] === bp.a, hit: false, bob: 1 },
          { x: landPad + 680, y: 290, w: 110, h: 60, text: ba[2], isCorrect: ba[2] === bp.a, hit: false, bob: 2 }
        ]
      };
      this.goalFlag = null;
    } else {
      this.goalFlag = { x: landPad + 700, y: 130, w: 18, h: 380, wave: 0 };
    }
  }

  // ─── Events ───
  _hitBlock(gate, block, player) {
    if (block.hit) return;
    block.hit = true;
    if (block.isCorrect) {
      Sfx.correct();
      gate.cleared = true;
      gate.wall.active = false;
      this.combo++;
      const bonus = 100 * this.currentLevel * Math.min(this.combo, 5);
      this.score += bonus;
      this._floatText(`+${bonus}`, block.x + block.w / 2, block.y - 10, '#34d399');
      if (this.combo > 1) this._floatText(`×${Math.min(this.combo,5)} COMBO!`, block.x + block.w / 2, block.y - 40, '#fbbf24');
      this._spawnBurst(block.x + block.w / 2, block.y + block.h / 2, '#34d399', 20);
      this._flashScreen('rgba(52,211,153,0.12)');
      // Revive dead teammates
      for (const p of this.players) {
        if (p.dead) {
          p.dead = false; p.lives = 1;
          p.x = this.cameraX + 200; p.y = -60;
          p.vx = 0; p.vy = 0;
          this._floatText('REVIVED!', p.x, p.y, '#38bdf8');
          Sfx.powerup();
        }
      }
    } else {
      Sfx.wrong();
      this.combo = 0;
      this._killPlayer(player);
      this._spawnBurst(block.x + block.w / 2, block.y + block.h / 2, '#f87171', 10);
      this._shakeScreen(8, 0.5);
    }
    this._updateHUD();
  }

  _hitBossBlock(block, player) {
    if (block.hit) return;
    block.hit = true;
    if (block.isCorrect) {
      Sfx.correct();
      this.bossHealth--;
      this.score += 600;
      this._updateHUD();
      this._spawnBurst(this.bossEntity.x + 80, this.bossEntity.y + 80, '#fbbf24', 25);
      this._floatText(`-1 HP!`, this.bossEntity.x + 80, this.bossEntity.y - 10, '#fbbf24');
      this._shakeScreen(12, 0.4);
      if (this.bossHealth <= 0) {
        this.bossEntity.active = false;
        Sfx.win();
        this._floatText('BOSS DEFEATED!', CW / 2 + this.cameraX, 200, '#fbbf24');
        this._spawnBurst(this.bossEntity.x + 80, this.bossEntity.y + 80, '#fbbf24', 50);
        this.goalFlag = { x: this.bossEntity.x + 60, y: 130, w: 18, h: 380, wave: 0 };
      } else {
        // New question
        const prompts = [...PROMPTS[this.currentDifficulty]].sort(() => Math.random() - 0.5);
        const bp = prompts[0];
        const ba = [bp.a, bp.w[0], bp.w[1]].sort(() => Math.random() - 0.5);
        this.bossGate.prompt = bp.q;
        for (let i = 0; i < 3; i++) {
          this.bossGate.blocks[i].text = ba[i];
          this.bossGate.blocks[i].isCorrect = ba[i] === bp.a;
          this.bossGate.blocks[i].hit = false;
        }
      }
    } else {
      Sfx.wrong();
      this.combo = 0;
      this._killPlayer(player);
      this._shakeScreen(8, 0.5);
    }
  }

  _killPlayer(p) {
    if (p.dead) return;
    if (p.invincibleTimer > 0) return; // invincible
    p.invincibleTimer = 1.8; // brief iframes
    p.lives--;
    Sfx.hurt();
    this.score = Math.max(0, this.score - 30);
    this._updateHUD();
    this._floatText('-30', p.x + p.w / 2, p.y, '#f87171');

    if (p.lives <= 0) {
      p.dead = true;
      if (this.players.every(pl => pl.dead)) {
        this._endGame(false);
      }
    } else {
      // Safe respawn
      const safePlat = this.platforms.find(pl =>
        pl.active && !pl.moveY && !pl.isGate && pl.type !== 'gate' &&
        pl.x + pl.w > this.cameraX + 60 && pl.w > 100
      );
      p.x = safePlat ? Math.max(this.cameraX + 60, safePlat.x + 60) : this.cameraX + 200;
      p.y = -100;
      p.vx = 0; p.vy = 0;
    }
  }

  _endGame(won) {
    this.state = 'end';
    this.gameIsOver = !won;
    const timeBonus = won ? Math.max(0, 6000 - Math.floor(this.levelTime * 80)) : 0;
    if (won) this.score += timeBonus;
    this._updateHUD();

    const icon = document.getElementById('endIcon');
    const title = document.getElementById('endTitle');
    const msg = document.getElementById('endMessage');
    const stats = document.getElementById('endStats');
    const nextBtn = document.getElementById('playAgainBtn');

    if (won) {
      Sfx.win();
      if (this.currentLevel >= 3) {
        icon.textContent = '🏆';
        title.textContent = 'Game Clear!';
        nextBtn.textContent = '▶ Play Again';
      } else {
        icon.textContent = '🎉';
        title.textContent = `Level ${this.currentLevel} Clear!`;
        nextBtn.textContent = `▶ Start Level ${this.currentLevel + 1}`;
      }
      msg.textContent = 'You answered all the word gates!';
      stats.innerHTML = `
        <div class="stat-line"><span>Score</span><span class="stat-val">${this.score}</span></div>
        <div class="stat-line"><span>Time Bonus</span><span class="stat-val">+${timeBonus}</span></div>
        <div class="stat-line"><span>Time</span><span class="stat-val">${this.levelTime.toFixed(1)}s</span></div>
      `;
    } else {
      Sfx.wrong();
      icon.textContent = '💀';
      title.textContent = 'Game Over';
      msg.textContent = 'All players have fallen. Better luck next time!';
      stats.innerHTML = `<div class="stat-line"><span>Final Score</span><span class="stat-val">${this.score}</span></div>`;
      nextBtn.textContent = '▶ Restart Game';
    }
    document.getElementById('gameEnd').style.display = 'flex';
  }

  // ─── HUD ───
  _updateHUD() {
    document.getElementById('scoreDisplay').textContent = this.score.toString().padStart(5, '0');
    const p1 = this.players[0];
    const p2 = this.players[1];
    document.getElementById('p1HeartsHud').textContent = p1 ? (p1.dead ? '💀' : '♥'.repeat(Math.max(0, p1.lives))) : '—';
    document.getElementById('p2HeartsHud').textContent = p2 ? (p2.dead ? '💀' : '♥'.repeat(Math.max(0, p2.lives))) : '—';
  }

  // ─── Feedback Helpers ───
  _shakeScreen(amt, dur) { this.shakeAmt = amt; this.shakeTimer = dur; }
  _flashScreen(col) { this.flashTimer = 0.18; this.flashColor = col; }

  _floatText(text, x, y, color) {
    this.floatTexts.push({ text, x, y, color, life: 1.2, vy: -90 });
  }

  _spawnBurst(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 / n) * i + Math.random() * 0.4;
      const speed = 80 + Math.random() * 180;
      this.sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 60, col, life: 0.8 + Math.random() * 0.5, r: 2 + Math.random() * 3 });
    }
  }

  // ─── Update ───
  _update(dt) {
    if (this.state !== 'playing') return;

    this.levelTime += dt;

    // Screen effects
    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.flashTimer > 0) this.flashTimer = Math.max(0, this.flashTimer - dt);

    // Platform bobbing for boss blocks
    const t = performance.now() / 1000;

    // Sparks
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 500 * dt;
      s.life -= dt;
      return s.life > 0;
    });

    // Float texts
    this.floatTexts = this.floatTexts.filter(ft => {
      ft.y += ft.vy * dt;
      ft.life -= dt;
      return ft.life > 0;
    });

    // Camera — smoothly track furthest alive player
    let targetX = this.cameraX;
    let aliveCount = 0;
    for (const p of this.players) {
      if (!p.dead) { targetX = Math.max(targetX, p.x - 380); aliveCount++; }
    }
    if (aliveCount > 0) this.cameraX += (targetX - this.cameraX) * Math.min(1, dt * 8);

    // Moving platforms
    for (const plat of this.platforms) {
      if (!plat.active || (!plat.vx && !plat.vy)) continue;
      const pxPrev = plat.x, pyPrev = plat.y;
      if (plat.moveY) {
        plat.y += plat.vy * dt;
        if (plat.y < plat.endY || plat.y > plat.startY) plat.vy *= -1;
      } else {
        plat.x += plat.vx * dt;
        if (plat.x > plat.endX || plat.x < plat.startX) plat.vx *= -1;
      }
      const dx = plat.x - pxPrev, dy = plat.y - pyPrev;
      for (const p of this.players) {
        if (!p.dead && Math.abs((p.y + p.h) - pyPrev) < 3 &&
            p.x + p.w > plat.x && p.x < plat.x + plat.w) {
          p.x += dx; p.y += dy;
        }
      }
    }

    // Projectiles
    this.projectiles = this.projectiles.filter(proj => {
      proj.x += proj.vx * dt;
      proj.y += (proj.vy || 0) * dt;
      for (const p of this.players) {
        if (!p.dead && p.invincibleTimer <= 0 && intersect(p, proj)) {
          this._killPlayer(p);
          return false;
        }
      }
      return proj.x > this.cameraX - 200 && proj.x < this.cameraX + CW + 200;
    });

    // Powerup bobbing
    for (const pu of this.powerups) { if (pu.active) pu.bob = (pu.bob || 0) + dt; }

    // Players
    for (const p of this.players) {
      if (p.dead) continue;
      p.wasGrounded = p.grounded;

      // Input
      const accel = 1300;
      const friction = 0.80;
      if (this.keys[p.left])  p.vx -= accel * dt;
      if (this.keys[p.right]) p.vx += accel * dt;
      if (!this.keys[p.left] && !this.keys[p.right]) p.vx *= friction;
      p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
      if (Math.abs(p.vx) > 5) p.facingRight = p.vx > 0;

      // Trail
      if (p.invincibleTimer > 0) {
        p.trailFrames.push({ x: p.x, y: p.y, alpha: 0.4 });
        if (p.trailFrames.length > 8) p.trailFrames.shift();
      } else {
        p.trailFrames = [];
      }

      // X move
      p.x += p.vx * dt;
      p.animTime += Math.abs(p.vx) > 15 ? dt : 0;

      // Squash & stretch
      if (!p.grounded) {
        p.squash += (0.75 - p.squash) * dt * 8;
      } else {
        p.squash += (1.0 - p.squash) * dt * 14;
      }

      // Camera bound
      if (p.x < this.cameraX) { p.x = this.cameraX; p.vx = 0; }

      // X collision with platforms
      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (intersect(p, plat)) {
          if (p.vx > 0) p.x = plat.x - p.w;
          else           p.x = plat.x + plat.w;
          p.vx = 0;
        }
      }

      // Y (gravity + collision)
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      p.grounded = false;

      for (const plat of this.platforms) {
        if (!plat.active) continue;
        if (intersect(p, plat)) {
          if (p.vy > 0) {
            p.y = plat.y - p.h;
            if (!p.wasGrounded) Sfx.land();
            p.vy = 0;
            p.grounded = true;
          } else {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      }

      // Jump
      if (p.grounded) p.jumpCount = 0;
      if (this.keys[p.up]) {
        if (p.jumpReleased) {
          if (p.grounded) {
            p.vy = JUMP_FORCE;
            p.grounded = false;
            p.jumpCount = 1;
            p.squash = 0.65;
            Sfx.jump();
          } else if (p.bootTimer > 0 && p.jumpCount === 1) {
            p.vy = DOUBLE_JUMP_FORCE;
            p.jumpCount = 2;
            Sfx.jump();
            this._spawnBurst(p.x + p.w / 2, p.y + p.h, '#a78bfa', 8);
          }
          p.jumpReleased = false;
        }
      } else {
        p.jumpReleased = true;
      }

      // Gate block collisions
      for (const gate of this.gates) {
        if (gate.cleared) continue;
        for (const b of gate.blocks) {
          if (intersect(p, b)) {
            if (p.vy > 0 && p.y + p.h - p.vy * dt <= b.y + 8) {
              p.y = b.y - p.h; p.vy = 0; p.grounded = true;
            } else if (p.vy < 0 && p.y - p.vy * dt >= b.y + b.h - 8) {
              p.y = b.y + b.h; p.vy = 0;
              this._hitBlock(gate, b, p);
            } else {
              if (p.vx > 0) p.x = b.x - p.w; else p.x = b.x + b.w;
              p.vx = 0;
            }
          }
        }
      }

      // Boss gate
      if (this.bossPhase && this.bossHealth > 0) {
        for (const b of this.bossGate.blocks) {
          if (intersect(p, b)) {
            if (p.vy > 0 && p.y + p.h - p.vy * dt <= b.y + 8) {
              p.y = b.y - p.h; p.vy = 0; p.grounded = true;
            } else if (p.vy < 0 && p.y - p.vy * dt >= b.y + b.h - 8) {
              p.y = b.y + b.h; p.vy = 0;
              this._hitBossBlock(b, p);
            } else {
              if (p.vx > 0) p.x = b.x - p.w; else p.x = b.x + b.w;
              p.vx = 0;
            }
          }
        }
      }

      // Death plane
      if (p.y > CH + 150) this._killPlayer(p);

      // Spikes
      for (const s of this.spikes) {
        if (p.invincibleTimer <= 0 && intersect(p, s)) this._killPlayer(p);
      }

      // Coins
      for (const c of this.coins) {
        if (!c.collected && intersect(p, c)) {
          c.collected = true;
          this.score += 10;
          p.coinsCollected++;
          this._updateHUD();
          if (p.coinsCollected >= 20) {
            p.coinsCollected -= 20;
            p.lives++;
            Sfx.powerup();
            this._floatText('1-UP!', p.x + p.w / 2, p.y - 20, '#fbbf24');
          } else {
            Sfx.coin();
          }
        }
      }

      // Hearts
      for (const h of this.hearts) {
        if (!h.collected && intersect(p, h)) {
          h.collected = true;
          p.lives = Math.min(p.lives + 1, 9);
          Sfx.powerup();
          this._floatText('+1 ♥', p.x + p.w / 2, p.y - 20, '#fb7185');
          this._updateHUD();
        }
      }

      // Goal
      if (!p.dead && this.goalFlag && Math.abs(p.x - this.goalFlag.x) < 40) {
        if (this.state === 'playing') this._endGame(true);
      }

      // Powerup timers
      if (p.invincibleTimer > 0) p.invincibleTimer = Math.max(0, p.invincibleTimer - dt);
      if (p.bootTimer > 0) p.bootTimer = Math.max(0, p.bootTimer - dt);

      // Powerup pickup
      for (const pu of this.powerups) {
        if (pu.active && intersect(p, pu)) {
          pu.active = false;
          if (pu.type === 'star') {
            p.invincibleTimer = 8;
            Sfx.powerup();
            this._floatText('STAR POWER!', p.x + p.w / 2, p.y - 20, '#fbbf24');
          }
          if (pu.type === 'boots') {
            p.bootTimer = 12;
            Sfx.powerup();
            this._floatText('DOUBLE JUMP!', p.x + p.w / 2, p.y - 20, '#a78bfa');
          }
        }
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim = (e.anim || 0) + dt;

      if (e.type === 'shooter') {
        e.shootTimer += dt;
        const rate = 2.8 - this.currentLevel * 0.4;
        if (e.shootTimer > rate && e.x < this.cameraX + CW + 100) {
          e.shootTimer = 0;
          this.projectiles.push({ x: e.x - 8, y: e.y + e.h / 2 - 6, w: 14, h: 14, vx: -260, vy: 0 });
        }
      } else if (e.type === 'flyer') {
        e.flyOffset += dt * 3.5;
        e.y = e.startY + Math.sin(e.flyOffset) * 55;
        e.x += e.vx * dt;
        if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
      } else if (e.type === 'pacer') {
        e.y += e.vy * dt;
        if (e.y < e.startY || e.y > e.endY) e.vy *= -1;
      } else if (e.type === 'chaser') {
        let closest = null, minDist = 400;
        for (const p of this.players) {
          if (p.dead) continue;
          const d = Math.abs(p.x - e.x);
          if (d < minDist) { minDist = d; closest = p; }
        }
        e.vx = closest ? (closest.x < e.x ? -120 : 120) : e.vx * 0.5;
        e.x += e.vx * dt;
      } else { // walker
        e.x += e.vx * dt;
        if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
      }

      // Enemy vs player
      for (const p of this.players) {
        if (p.dead) continue;
        if (!intersect(p, e)) continue;
        if (p.invincibleTimer > 0) {
          e.dead = true;
          this.score += 60;
          this._updateHUD();
          Sfx.stomp();
          this._spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#fbbf24', 12);
          this._floatText('+60', e.x + e.w / 2, e.y, '#fbbf24');
        } else if (p.vy > 0 && p.y + p.h - p.vy * dt <= e.y + 14) {
          e.dead = true;
          p.vy = -600;
          this.score += 50;
          this._updateHUD();
          Sfx.stomp();
          this._spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#fbbf24', 10);
          this._floatText('+50', e.x + e.w / 2, e.y - 10, '#fbbf24');
          p.squash = 0.6;
        } else {
          this._killPlayer(p);
        }
      }
    }

    // Boss actions
    if (this.bossPhase && this.bossEntity && this.bossEntity.active && this.bossHealth > 0) {
      const be = this.bossEntity;
      be.anim = (be.anim || 0) + dt;
      be.shootTimer += dt;
      be.x += be.walkDir * be.walkSpeed * dt;
      if (be.x < be.walkX - 150 || be.x > be.walkX + 50) be.walkDir *= -1;

      if (be.shootTimer > 1.8 && be.x < this.cameraX + CW + 200) {
        be.shootTimer = 0;
        const speed = 280 + Math.random() * 120;
        this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed, vy: (Math.random() - 0.5) * 120 });
        if (this.bossHealth <= 2) {
          // Enraged: shoot 3
          setTimeout(() => {
            this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed * 0.8, vy: 80 });
            this.projectiles.push({ x: be.x, y: be.y + 80, w: 18, h: 18, vx: -speed * 0.8, vy: -80 });
          }, 200);
        }
      }
    }
  }

  // ─── Draw ───
  _draw() {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    ctx.save();

    // Screen shake
    let sx = 0, sy = 0;
    if (this.shakeTimer > 0) {
      const intensity = this.shakeAmt * (this.shakeTimer / 0.5);
      sx = (Math.random() - 0.5) * intensity;
      sy = (Math.random() - 0.5) * intensity;
      ctx.translate(sx, sy);
    }

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CH);
    if (this.currentLevel === 1) { // 1: Grasslands
      skyGrad.addColorStop(0, '#0f1f4a');
      skyGrad.addColorStop(0.6, '#1a3a6e');
      skyGrad.addColorStop(1, '#0d1b38');
    } else if (this.currentLevel === 2) { // 2: Underground
      skyGrad.addColorStop(0, '#1a0a2e');
      skyGrad.addColorStop(0.5, '#2d1059');
      skyGrad.addColorStop(1, '#0e0520');
    } else if (this.currentLevel === 3) { // 3: Jungle
      skyGrad.addColorStop(0, '#051b0f');
      skyGrad.addColorStop(0.5, '#0a3a20');
      skyGrad.addColorStop(1, '#031008');
    } else if (this.currentLevel === 4) { // 4: Clouds
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.5, '#7dd3fc');
      skyGrad.addColorStop(1, '#e0f2fe');
    } else { // 5: Volcano Boss
      skyGrad.addColorStop(0, '#200010');
      skyGrad.addColorStop(0.5, '#430018');
      skyGrad.addColorStop(1, '#0a0005');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CW, CH);

    // Flash overlay
    if (this.flashTimer > 0) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashTimer / 0.18;
      ctx.fillRect(0, 0, CW, CH);
      ctx.globalAlpha = 1;
    }

    // ── Stars ──
    if (this.currentLevel !== 4) { // Hide stars in daytime cloud level
      ctx.save();
      for (const star of this.bgStars) {
        const blink = 0.6 + 0.4 * Math.sin(t * 1.5 + star.blink);
        ctx.globalAlpha = blink * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        const sx2 = ((star.x - this.cameraX * 0.05) % (CW + 200) + CW + 200) % (CW + 200) - 100;
        ctx.arc(sx2, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Camera translate for world
    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // ── Parallax clouds ──
    ctx.save();
    for (const cloud of this.bgClouds) {
      const cx = ((cloud.x - this.cameraX * 0.25) % (CW * 4 + 800) + CW * 4 + 800) % (CW * 4 + 800);
      this._drawCloud(ctx, cx, cloud.y, cloud.s);
    }
    ctx.restore();

    // ── Goal flag ──
    if (this.goalFlag) {
      this.goalFlag.wave = (this.goalFlag.wave || 0) + 0.05;
      const gf = this.goalFlag;
      // Pole
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(gf.x, gf.y, gf.w, gf.h);
      // Waving flag cloth
      ctx.beginPath();
      ctx.moveTo(gf.x + gf.w, gf.y + 5);
      for (let i = 0; i <= 10; i++) {
        const fx = gf.x + gf.w + (i / 10) * 70;
        const fy = gf.y + 5 + Math.sin(t * 4 + i * 0.8) * 8 + i * 4;
        ctx.lineTo(fx, fy);
      }
      ctx.lineTo(gf.x + gf.w + 70, gf.y + 60);
      for (let i = 10; i >= 0; i--) {
        const fx = gf.x + gf.w + (i / 10) * 70;
        const fy = gf.y + 60 + Math.sin(t * 4 + i * 0.8) * 8;
        ctx.lineTo(fx, fy);
      }
      ctx.closePath();
      ctx.fillStyle = '#34d399';
      ctx.fill();
      // Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#34d399';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Platforms ──
    for (const plat of this.platforms) {
      if (!plat.active) continue;
      if (plat.isGate) {
        // Gate wall
        const gGrad = ctx.createLinearGradient(plat.x, 0, plat.x + plat.w, 0);
        gGrad.addColorStop(0, '#7c3aed');
        gGrad.addColorStop(1, '#c084fc');
        ctx.fillStyle = gGrad;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Bars
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = plat.y; y < plat.y + plat.h; y += 24) {
          ctx.fillRect(plat.x, y, plat.w, 10);
        }
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#c084fc';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.shadowBlur = 0;
      } else if (plat.moveY || plat.vx) {
        // Moving platform — glowing orange
        ctx.fillStyle = '#78350f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        const mpGrad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
        mpGrad.addColorStop(0, '#f59e0b');
        mpGrad.addColorStop(0.3, '#d97706');
        mpGrad.addColorStop(1, '#92400e');
        ctx.fillStyle = mpGrad;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h - 4);
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#f59e0b';
        ctx.fillStyle = '#fdba74';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        ctx.shadowBlur = 0;
      } else if (plat.type === 'stone') {
        // Stone step
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h - 4);
        // Brick lines
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        for (let y = plat.y; y < plat.y + plat.h; y += 22) ctx.strokeRect(plat.x, y, plat.w, 22);
        ctx.fillStyle = '#475569';
        ctx.fillRect(plat.x, plat.y, plat.w, 6);
      } else if (this.currentLevel === 4) {
        // Cloud platform
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        rr(ctx, plat.x, plat.y, plat.w, plat.h, 20); // very rounded
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        rr(ctx, plat.x, plat.y, plat.w, Math.min(plat.h, 20), 20);
        ctx.fill();
      } else if (this.currentLevel === 5) {
        // Volcano platform
        ctx.fillStyle = '#3a0c0c';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#1a0000';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        ctx.fillStyle = '#ef4444'; // lava top
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        ctx.fillStyle = 'rgba(239,68,68,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 4);
      } else if (this.currentLevel === 3) {
        // Jungle platform
        ctx.fillStyle = '#3f260f';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#271404';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        ctx.fillStyle = '#16a34a'; // jungle rich green top
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        ctx.fillStyle = 'rgba(134,239,172,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        // Vines hanging down
        ctx.fillStyle = '#15803d';
        for (let bx = plat.x + 10; bx < plat.x + plat.w - 10; bx += 30) {
          ctx.fillRect(bx, plat.y + 16, 4, 15 + ((bx % 7) * 2));
        }
      } else {
        // Normal Grass platform (Level 1 & 2)
        ctx.fillStyle = '#1e3a2e';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = '#2d4a3e';
        ctx.fillRect(plat.x, plat.y + 16, plat.w, plat.h - 16);
        // Grass top
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(plat.x, plat.y, plat.w, 16);
        // Highlight
        ctx.fillStyle = 'rgba(134,239,172,0.3)';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        // Grass blades
        ctx.fillStyle = '#4ade80';
        for (let bx = plat.x + 10; bx < plat.x + plat.w - 5; bx += 22) {
          ctx.fillRect(bx, plat.y - 6, 3, 8);
          ctx.fillRect(bx + 8, plat.y - 4, 2, 6);
        }
      }
    }

    // ── Spikes ──
    ctx.fillStyle = '#dc2626';
    for (const s of this.spikes) {
      for (let sx2 = s.x; sx2 < s.x + s.w; sx2 += 14) {
        ctx.beginPath();
        ctx.moveTo(sx2, s.y + s.h);
        ctx.lineTo(sx2 + 7, s.y);
        ctx.lineTo(Math.min(sx2 + 14, s.x + s.w), s.y + s.h);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,100,100,0.4)';
        ctx.fill();
        ctx.fillStyle = '#dc2626';
      }
    }

    // ── Coins ──
    for (const c of this.coins) {
      if (c.collected) continue;
      const cy2 = c.y + c.h / 2 + Math.sin(t * 4 + c.x * 0.01) * 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, cy2, c.w / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fbbf24';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(c.x + c.w / 2, cy2, c.w / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Hearts ──
    for (const h of this.hearts) {
      if (h.collected) continue;
      const hy2 = h.y + Math.sin(t * 3 + h.x * 0.01) * 5;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fb7185';
      this._drawHeart(ctx, h.x + h.w / 2, hy2 + h.h / 2, h.w / 2, '#fb7185');
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Powerups ──
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const puy = pu.y + Math.sin((pu.bob || 0) * 3) * 6;
      ctx.save();
      if (pu.type === 'star') {
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#fbbf24';
        this._drawStar(ctx, pu.x + pu.w / 2, puy + pu.h / 2, pu.w / 2, t);
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#a78bfa';
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath();
        rr(ctx, pu.x, puy, pu.w, pu.h, 6);
        ctx.fill();
        ctx.fillStyle = '#e9d5ff';
        ctx.font = '700 14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('2×', pu.x + pu.w / 2, puy + pu.h - 6);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // ── Projectiles ──
    for (const proj of this.projectiles) {
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fbbf24';
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.arc(proj.x + proj.w / 2, proj.y + proj.h / 2, proj.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Gate blocks / prompts ──
    ctx.textAlign = 'center';
    for (const gate of this.gates) {
      if (gate.cleared) continue;
      // Prompt bubble
      const bx = gate.blocks[1].x + gate.blocks[1].w / 2;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(192,132,252,0.5)';
      ctx.fillStyle = '#1a1035';
      ctx.beginPath();
      rr(ctx, bx - 175, 145, 350, 64, 12);
      ctx.fill();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '700 22px Outfit';
      ctx.fillText(gate.prompt, bx, 183);
      ctx.restore();

      // Answer blocks
      for (const b of gate.blocks) {
        if (b.hit && !b.isCorrect) continue;
        const bobY = b.y + Math.sin(t * 2.5 + (b.bob || 0)) * 5;
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = b.hit ? '#34d399' : '#fbbf24';
        // Block body
        const bGrad = ctx.createLinearGradient(b.x, bobY, b.x, bobY + b.h);
        if (b.hit) {
          bGrad.addColorStop(0, '#34d399'); bGrad.addColorStop(1, '#059669');
        } else {
          bGrad.addColorStop(0, '#fde68a'); bGrad.addColorStop(1, '#f59e0b');
        }
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        rr(ctx, b.x, bobY, b.w, b.h, 10);
        ctx.fill();
        // Bump on top
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(b.x + 6, bobY + 4, b.w - 12, 6);
        // Bottom shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + 2, bobY + b.h - 8, b.w - 4, 8);
        ctx.shadowBlur = 0;
        // Text
        ctx.fillStyle = '#1a0f00';
        ctx.font = '800 17px Outfit';
        ctx.fillText(b.text, b.x + b.w / 2, bobY + b.h / 2 + 7);
        ctx.restore();
      }
    }

    // ── Boss ──
    if (this.bossPhase && this.bossEntity && this.bossEntity.active && this.bossHealth > 0) {
      const be = this.bossEntity;
      const bAnim = t * 3;
      ctx.save();
      // Body shadow
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#dc2626';
      // Pulsing outline
      const pulse = 1 + Math.sin(bAnim) * 0.03;
      const bW = be.w * pulse, bH = be.h * pulse;
      const bX = be.x - (bW - be.w) / 2, bY = be.y - (bH - be.h) / 2;
      // Body
      const bosGrad = ctx.createRadialGradient(bX + bW / 2, bY + bH / 2, 10, bX + bW / 2, bY + bH / 2, bW / 2);
      bosGrad.addColorStop(0, '#ef4444');
      bosGrad.addColorStop(0.6, '#991b1b');
      bosGrad.addColorStop(1, '#450a0a');
      ctx.fillStyle = bosGrad;
      ctx.beginPath();
      rr(ctx, bX, bY, bW, bH, 20);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Eyes
      const eyeX = bX + bW * 0.28, eyeX2 = bX + bW * 0.68;
      const eyeY = bY + bH * 0.3;
      const eyeR = 14;
      [eyeX, eyeX2].forEach(ex => {
        ctx.fillStyle = '#fff1f2';
        ctx.beginPath();
        ctx.arc(ex, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.arc(ex + Math.sin(bAnim * 0.5) * 4, eyeY + 2, eyeR * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
      // Teeth
      ctx.fillStyle = '#fff';
      const mouthY = bY + bH * 0.65;
      for (let tx = bX + 20; tx < bX + bW - 10; tx += 22) {
        ctx.beginPath();
        ctx.moveTo(tx, mouthY);
        ctx.lineTo(tx + 11, mouthY + 20);
        ctx.lineTo(Math.min(tx + 22, bX + bW - 10), mouthY);
        ctx.fill();
      }
      // Health bar
      const barW = bW + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); rr(ctx, bX - 10, bY - 28, barW, 16, 4); ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); rr(ctx, bX - 10, bY - 28, barW * (this.bossHealth / this.bossMaxHealth), 16, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bX - 10, bY - 28, barW, 7);
      ctx.restore();

      // Boss gate blocks
      ctx.save();
      const bcx = this.bossGate.blocks[1].x + this.bossGate.blocks[1].w / 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(239,68,68,0.6)';
      ctx.fillStyle = '#1a0505';
      ctx.beginPath();
      rr(ctx, bcx - 200, 145, 400, 64, 12);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fecaca';
      ctx.font = '700 22px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(this.bossGate.prompt, bcx, 183);
      ctx.restore();

      for (const b of this.bossGate.blocks) {
        if (b.hit && !b.isCorrect) continue;
        const bobY = b.y + Math.sin(t * 2.5 + (b.bob || 0)) * 5;
        ctx.save();
        ctx.shadowBlur = 16;
        ctx.shadowColor = b.hit ? '#34d399' : '#ef4444';
        const bGrad = ctx.createLinearGradient(b.x, bobY, b.x, bobY + b.h);
        if (b.hit) {
          bGrad.addColorStop(0, '#34d399'); bGrad.addColorStop(1, '#059669');
        } else {
          bGrad.addColorStop(0, '#fca5a5'); bGrad.addColorStop(1, '#dc2626');
        }
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        rr(ctx, b.x, bobY, b.w, b.h, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = b.hit ? '#052e16' : '#fff1f2';
        ctx.font = '800 18px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(b.text, b.x + b.w / 2, bobY + b.h / 2 + 8);
        ctx.restore();
      }
    }

    // ── Enemies ──
    for (const e of this.enemies) {
      if (e.dead) continue;
      ctx.save();
      let col = '#ef4444';
      if (e.type === 'shooter') col = '#7c3aed';
      else if (e.type === 'flyer') col = '#ea580c';
      else if (e.type === 'chaser') col = '#65a30d';
      else if (e.type === 'pacer') col = '#0d9488';

      ctx.shadowBlur = 8;
      ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.beginPath();
      rr(ctx, e.x, e.y, e.w, e.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      rr(ctx, e.x + 2, e.y + 2, e.w - 4, 10, 6);
      ctx.fill();

      // Eyes
      const fl = e.vx === undefined ? true : e.vx >= 0;
      const ex1 = fl ? e.x + e.w * 0.55 : e.x + e.w * 0.3;
      const ex2 = fl ? e.x + e.w * 0.75 : e.x + e.w * 0.5;
      const ey = e.y + e.h * 0.3;
      if (e.type === 'flyer') {
        [e.x + 6, e.x + e.w - 14].forEach(ex => {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + 1, ey + 1, 2, 0, Math.PI * 2); ctx.fill();
        });
      } else if (e.type === 'shooter') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2, e.y + e.h * 0.35, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.arc(e.x + e.w / 2 - 3, e.y + e.h * 0.35, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        [ex1, ex2].forEach(ex => {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(ex + (fl ? 1 : -1), ey + 1, 2, 0, Math.PI * 2); ctx.fill();
        });
      }
      ctx.restore();
    }

    // ── Sparks ──
    for (const s of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life * 1.5);
      ctx.fillStyle = s.col;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r || 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Players ──
    for (const p of this.players) {
      if (p.dead) continue;

      // Invincible trail
      for (let i = 0; i < p.trailFrames.length; i++) {
        const tf = p.trailFrames[i];
        const alpha = (i / p.trailFrames.length) * 0.35;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(tf.x, tf.y, p.w, p.h);
        ctx.restore();
      }

      ctx.save();

      // Blinking when recently hit
      if (p.invincibleTimer > 0 && p.invincibleTimer < 1.5) {
        // Blink logic: hide every other 0.1s
        if (Math.floor(p.invincibleTimer * 10) % 2 === 0) { ctx.restore(); continue; }
      }

      // Glow (star power)
      if (p.invincibleTimer > 1.5) {
        ctx.shadowBlur = 24;
        ctx.shadowColor = p.glow;
      }

      // Squash/stretch around foot pivot
      ctx.translate(p.x + p.w / 2, p.y + p.h);
      const scaleX = p.squash < 1 ? 1 / p.squash : p.squash;
      const scaleY = p.squash;
      ctx.scale(scaleX, scaleY);

      // Tilt
      const tilt = Math.max(-0.12, Math.min(0.12, p.vx * 0.00035));
      ctx.rotate(tilt);

      const hw = p.w / 2;
      const hh = p.h;

      // Legs
      const legSwing = p.grounded && Math.abs(p.vx) > 20 ? Math.sin(p.animTime * 14) * 9 : 0;
      // Boot color
      const shoeCol = p.bootTimer > 0 ? '#7c3aed' : '#1e293b';
      // Left leg
      ctx.fillStyle = p.color;
      ctx.fillRect(-hw + 2 + legSwing, -14, 9, 14);
      ctx.fillStyle = shoeCol;
      ctx.fillRect(-hw - 1 + legSwing, -5, 13, 7);
      // Right leg
      ctx.fillStyle = p.color;
      ctx.fillRect(hw - 11 - legSwing, -14, 9, 14);
      ctx.fillStyle = shoeCol;
      ctx.fillRect(hw - 12 - legSwing, -5, 13, 7);

      // Body
      const bodyGrad = ctx.createLinearGradient(-hw, -hh, hw, -hh * 0.2);
      bodyGrad.addColorStop(0, p.color);
      bodyGrad.addColorStop(1, p.color + '99');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      rr(ctx, -hw, -hh, p.w, p.h - 10, 9);
      ctx.fill();

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      rr(ctx, -hw + 3, -hh + 4, hw - 2, 10, 4);
      ctx.fill();

      // Visor eyes
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const lookX = p.facingRight ? 4 : -4;
      ctx.fillRect(-hw + 6 + lookX, -hh + 12, 18, 9);
      // Pupil
      ctx.fillStyle = 'rgba(0,0,50,0.8)';
      ctx.fillRect(-hw + 14 + lookX, -hh + 14, 6, 5);

      // Player ID badge
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = '700 8px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id}`, 0, -hh + 24);

      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // ── Float texts ──
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this.floatTexts) {
      const alpha = Math.min(1, ft.life * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = '900 20px Outfit';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.restore(); // end camera translate

    // ── HUD overlays (fixed to canvas) ──
    if (this.state === 'playing') {
      // Timer
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '700 22px Outfit';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(CW / 2 - 60, 10, 120, 32);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`⏱ ${this.levelTime.toFixed(1)}s`, CW / 2, 32);
      ctx.restore();

      // Combo indicator
      if (this.combo > 1) {
        ctx.save();
        ctx.textAlign = 'right';
        ctx.font = `900 ${18 + this.combo * 3}px Outfit`;
        ctx.fillStyle = `hsl(${40 + this.combo * 15}, 95%, 60%)`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fbbf24';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(`×${this.combo} COMBO`, CW - 20, 50);
        ctx.fillText(`×${this.combo} COMBO`, CW - 20, 50);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // In-canvas lives HUD (compact)
      ctx.save();
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        const startX = 16;
        const startY = 16 + i * 52;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        rr(ctx, startX, startY, 130, 44, 8);
        ctx.fill();
        
        ctx.fillStyle = p.color;
        ctx.font = '800 14px Outfit';
        ctx.textAlign = 'left';
        ctx.fillText(`P${p.id}`, startX + 10, startY + 18);
        
        // Coin icon directly drawn
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.arc(startX + 46, startY + 13, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(startX + 46, startY + 13, 2.5, 0, Math.PI * 2); ctx.fill();
        
        // Coin text
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${p.coinsCollected}/20`, startX + 54, startY + 18);
        
        // Lives
        for (let j = 0; j < Math.min(5, p.lives); j++) {
            this._drawHeart(ctx, startX + 16 + j * 16, startY + 32, 6, '#fb7185');
        }
        if (p.lives > 5) {
            ctx.fillStyle = '#fb7185';
            ctx.font = '700 12px Outfit';
            ctx.fillText(`+${p.lives - 5}`, startX + 16 + 5 * 16, startY + 36);
        }

        // Boots / star icon
        if (p.bootTimer > 0) { ctx.fillStyle = '#a78bfa'; ctx.font = '700 12px Outfit'; ctx.fillText('2×↑', startX + 90, startY + 36); }
        if (p.invincibleTimer > 1.5) { ctx.fillStyle = '#fbbf24'; ctx.font = '700 14px Outfit'; ctx.fillText('★', startX + 115, startY + 36); }
      }
      ctx.restore();
    }
  }

  // ─── Draw Helpers ───
  _drawHeart(ctx, cx, cy, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx - r * 0.45, cy - r * 0.2, r * 0.45, Math.PI, 0);
    ctx.arc(cx + r * 0.45, cy - r * 0.2, r * 0.45, Math.PI, 0);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.fill();
  }

  _drawStar(ctx, cx, cy, r, t) {
    const rot = t * 1.2;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = rot + (i * Math.PI) / 5;
      const rr2 = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) ctx.moveTo(cx + Math.cos(angle) * rr2, cy + Math.sin(angle) * rr2);
      else ctx.lineTo(cx + Math.cos(angle) * rr2, cy + Math.sin(angle) * rr2);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawCloud(ctx, x, y, s) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#e2e8f0';
    const puffs = [[0, 0, 38], [-30, 12, 28], [30, 10, 32], [60, 16, 22], [-55, 16, 20]];
    for (const [px, py, pr] of puffs) {
      ctx.beginPath();
      ctx.arc(x + px * s, y + py * s, pr * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Loop ───
  _loop(ts) {
    const dt = Math.min((ts - (this.lastTs || ts)) / 1000, 0.05);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame((ts) => this._loop(ts));
  }
}

window.addEventListener('DOMContentLoaded', () => { new WordRunner(); });
