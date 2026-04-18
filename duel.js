'use strict';
// ═══════════════════════════════════════════════════════════════
//  DUCK HUNT DUEL — Arcade Shooter Engine
//  Keyboard Aiming & Bullet Physics
//  P1: A/D to rotate barrel, W to shoot
//  P2: Left/Right to rotate barrel, Up to shoot
// ═══════════════════════════════════════════════════════════════

// ── Math helpers ─────────────────────────────────────────────
const rnd  = (a,b) => a + Math.random()*(b-a);
const rndI = (a,b) => Math.floor(rnd(a,b+1));
const lerp = (a,b,t) => a+(b-a)*t;
const dist = (ax,ay,bx,by) => Math.hypot(ax-bx,ay-by);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

// ── Audio Engine ─────────────────────────────────────────────
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
    } catch(e) { console.warn("Failed to load SFX", e); }
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

// ── Constants ─────────────────────────────────────────────────
const MAX_HEAT    = 100;
const HEAT_PER_SHOT = 22;
const COOL_RATE    = 42; // heat per second
const RELOAD_MS    = 2000; // Overheat penalty time
const BULLET_SPEED = 1400; 
const HIT_RADIUS = { duck:38, clay:30, golden:26, crow:44, squid:30 };
const PTS        = { duck:100, clay:150, golden:500, crow:-200, squid: 250 };
const COLORS     = { p1:'#ff4455', p2:'#00ccff', gold:'#fbbf24', bad:'#ff6600', ink: '#111' };

// ── Particle system ────────────────────────────────────────────
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

// ── Bullet ────────────────────────────────────────────────────
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

// ── Target ────────────────────────────────────────────────────
class Target {
  constructor(type, canvas) {
    this.type = type;
    this.dead = false;
    this.deadTimer = 0;
    this.claimedBy = null; 
    this.claimFlash = 0;
    this.id = Math.random();

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

    const speeds = { duck: rnd(140,240), clay: rnd(200,340), golden: rnd(300,480), crow: rnd(80,160), squid: rnd(180,300) };
    const spd = speeds[type];

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

// ── Player State ──────────────────────────────────────────────
function makePlayer(id) {
  return {
    id, score: 0,
    heat: 0, 
    reloading: false, reloadTimer: 0,
    combo: 0, hits: 0, misses: 0, steals: 0,
    x: 0, y: 0, 
    angle: -Math.PI / 2, 
    recoil: 0,
    inkTimer: 0, // Blinds the player when inked!
  };
}

// ── Main Game ─────────────────────────────────────────────────
class DuckHuntDuel {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    this.mode   = 'solo';
    this.state  = 'title';
    this.maxWaves = 10;
    this.difficulty = 'normal';

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
    if (this.p1) { this.p1.x = this.canvas.width * (this.mode==='solo'?0.5:0.3); this.p1.y = this.canvas.height; }
    if (this.p2) { this.p2.x = this.canvas.width * 0.7; this.p2.y = this.canvas.height; }
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      if (['Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  _bindUI() {
    document.getElementById('btnSolo').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this.mode = 'solo'; this._startGame(); });
    document.getElementById('btnVersus').addEventListener('click', () => { if (AC.state==='suspended') AC.resume(); this.mode = 'versus'; this._startGame(); });
    document.getElementById('btnPlayAgain').addEventListener('click', () => this._startGame());
    document.getElementById('btnMenu').addEventListener('click', () => {
      document.getElementById('resultsScreen').classList.remove('active');
      document.getElementById('gameScreen').classList.remove('active');
      document.getElementById('titleScreen').classList.add('active');
      this.state = 'title';
    });
  }

  _showScreen(id) {
    ['titleScreen','gameScreen','resultsScreen'].forEach(s => document.getElementById(s).classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  _startGame() {
    this.maxWaves   = parseInt(document.getElementById('waveSelect').value) || 10;
    this.difficulty = document.getElementById('diffSelect').value || 'normal';
    this.wave = 0; this.targets = []; this.bullets = []; this.particles = [];
    this._floatTexts = [];
    this.p1 = makePlayer('p1'); this.p2 = makePlayer('p2');
    this.wind = 0; this.windTarget = 0;
    this._resize();
    document.getElementById('hudP2').style.display = this.mode === 'solo' ? 'none' : 'flex';
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
  }

  _spawnTarget() {
    const c = this.waveConf; const r = Math.random();
    let type;
    if (r < c.squidChance) type = 'squid';
    else if (r < c.squidChance+c.crowChance) type = 'crow';
    else if (r < c.squidChance+c.crowChance+c.goldChance) type = 'golden';
    else if (r < c.squidChance+c.crowChance+c.goldChance+c.clayChance) type = 'clay';
    else type = 'duck';
    this.targets.push(new Target(type, this.canvas));
    this.targetsLeft--;
    if (type !== 'crow') Sfx._tone(rnd(300,500),'triangle',0.06,0.03);
  }

  _endWave() {
    this.state = 'waveclear';
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
    this._showScreen('resultsScreen');

    const p1 = this.p1, p2 = this.p2;
    const emoji = document.getElementById('resultsEmoji');
    const title = document.getElementById('resultsTitle');

    if (this.mode === 'solo') {
      emoji.textContent = '🎯';
      title.textContent = `Score: ${p1.score}`;
      Sfx.win();
    } else {
      if (p1.score > p2.score)       { emoji.textContent='🏆'; title.textContent='Player 1 Wins!'; Sfx.win(); }
      else if (p2.score > p1.score)  { emoji.textContent='🏆'; title.textContent='Player 2 Wins!'; Sfx.win(); }
      else                            { emoji.textContent='🤝'; title.textContent="It's a Draw!"; Sfx.draw(); }
    }

    const p1Acc = p1.hits + p1.misses > 0 ? Math.round(100*p1.hits/(p1.hits+p1.misses)) : 0;
    const p2Acc = p2.hits + p2.misses > 0 ? Math.round(100*p2.hits/(p2.hits+p2.misses)) : 0;

    const statsEl = document.getElementById('resultsStats');
    if (this.mode === 'solo') {
      statsEl.innerHTML = `
        <div class="stat-block" style="grid-column:1/-1">
          <h3>🔴 Your Stats</h3>
          <div class="stat-line"><span>Score</span><span class="stat-val">${p1.score}</span></div>
          <div class="stat-line"><span>Hits</span><span class="stat-val">${p1.hits}</span></div>
          <div class="stat-line"><span>Misses</span><span class="stat-val">${p1.misses}</span></div>
          <div class="stat-line"><span>Accuracy</span><span class="stat-val">${p1Acc}%</span></div>
        </div>`;
    } else {
      statsEl.innerHTML = `
        <div class="stat-block p1-block">
          <h3>🔴 Player 1</h3>
          <div class="stat-line"><span>Score</span><span class="stat-val">${p1.score}</span></div>
          <div class="stat-line"><span>Hits</span><span class="stat-val">${p1.hits}</span></div>
          <div class="stat-line"><span>Misses</span><span class="stat-val">${p1.misses}</span></div>
          <div class="stat-line"><span>Steals</span><span class="stat-val">${p1.steals}</span></div>
          <div class="stat-line"><span>Accuracy</span><span class="stat-val">${p1Acc}%</span></div>
        </div>
        <div class="stat-block p2-block">
          <h3>🔵 Player 2</h3>
          <div class="stat-line"><span>Score</span><span class="stat-val">${p2.score}</span></div>
          <div class="stat-line"><span>Hits</span><span class="stat-val">${p2.hits}</span></div>
          <div class="stat-line"><span>Misses</span><span class="stat-val">${p2.misses}</span></div>
          <div class="stat-line"><span>Steals</span><span class="stat-val">${p2.steals}</span></div>
          <div class="stat-line"><span>Accuracy</span><span class="stat-val">${p2Acc}%</span></div>
        </div>`;
    }
  }

  _shoot(who) {
    const p = who === 'p1' ? this.p1 : this.p2;
    if (p.reloading || p.heat >= MAX_HEAT) { Sfx.miss(); return; }

    p.heat += HEAT_PER_SHOT;
    p.recoil = 24;
    Sfx.shoot();

    if (p.heat >= MAX_HEAT) {
      p.reloading = true; p.reloadTimer = RELOAD_MS / 1000;
      document.getElementById(p.id==='p1'?'reloadP1':'reloadP2').style.display = 'block';
      Sfx.reload();
    }

    const vx = Math.cos(p.angle) * BULLET_SPEED;
    const vy = Math.sin(p.angle) * BULLET_SPEED;
    const bx = p.x + Math.cos(p.angle) * 50;
    const by = p.y - 12 + Math.sin(p.angle) * 50;
    this.bullets.push(new Bullet(bx, by, vx, vy, who, COLORS[who]));
    spawnBurst(this.particles, bx, by, '#fff', 3, 100);
  }

  _claimTarget(target, who) {
    const p = who === 'p1' ? this.p1 : this.p2;
    if (target.dead) return;

    if (target.type === 'crow') {
      p.score = Math.max(0, p.score + PTS.crow);
      p.hits++; p.combo = 0; target.dead = true; target.claimedBy = who;
      Sfx.crow(); this.shake = 15;
      spawnBurst(this.particles, target.px, target.py, COLORS.bad, 14, 200);
      this._floatText(`${PTS.crow}`, target.px, target.py, COLORS.bad);
      return;
    }

    // Sabotage Squids ink the opponent!
    if (target.type === 'squid' && this.mode === 'versus') {
      const other = who === 'p1' ? this.p2 : this.p1;
      other.inkTimer = 4.0; // Blind them for 4 seconds
      Sfx.squid();
    }

    let isSteal = false;
    if (this.mode === 'versus') {
      const otherWho = who === 'p1' ? 'p2' : 'p1';
      for (const b of this.bullets) if (b.owner === otherWho && !b.dead && dist(b.x, b.y, target.px, target.py) < 160) { isSteal = true; break; }
    }

    if (isSteal) { p.steals++; Sfx.steal(); }
    const pts = PTS[target.type]; p.combo++;
    const comboMult = Math.min(p.combo, 8);
    const bonus = pts * (comboMult > 1 ? comboMult : 1);
    p.score += bonus; p.hits++; target.dead = true; target.claimedBy = who;
    const col = who === 'p1' ? COLORS.p1 : COLORS.p2;
    
    if (target.type === 'golden') { Sfx.hitBig(); this.shake = 20; } 
    else if (target.type === 'squid') { Sfx.hitBig(); }
    else { Sfx.hit(); }
    
    spawnBurst(this.particles, target.px, target.py, col, 14, target.type==='golden'?360:(target.type==='squid'?300:240));
    if (target.type === 'squid') spawnBurst(this.particles, target.px, target.py, COLORS.ink, 30, 400); // Black ink splash

    let label = comboMult > 1 ? `×${comboMult} ${bonus}!` : `+${pts}`;
    if (isSteal) label = `STEAL! +${bonus}`;
    if (target.type === 'squid' && this.mode === 'versus') label = "INK ATTACK!";
    this._floatText(label, target.px, target.py - 20, col);
  }

  _update(dt) {
    if (this.state === 'playing') {
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

      if (this.mode === 'versus') {
        if (this.keys['ArrowLeft']) this.p2.angle -= turnSpd;
        if (this.keys['ArrowRight']) this.p2.angle += turnSpd;
        this.p2.angle = clamp(this.p2.angle, -Math.PI + 0.15, -0.15);
        if (this.keys['ArrowUp'] && !this._prevKeys['ArrowUp']) this._shoot('p2');
      }

      this.waveTimer -= dt;

      if (this.targetsLeft > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this._spawnTarget(); this.spawnTimer = this.waveConf.spawnInterval; }
      }

      for (const t of this.targets) {
         t.update(dt, this.canvas.width, this.canvas.height);
         // Targets get blown safely off screen by wind too slightly
         t.px += this.wind * dt * 0.15;
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
      if (this.mode === 'versus') {
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

      for (const b of this.bullets) if (b.dead && !b.hitSomething) { const ownerP = b.owner === 'p1' ? this.p1 : this.p2; ownerP.misses++; ownerP.combo = 0; }
      this.bullets = this.bullets.filter(b => !b.dead);

      if ((this.targetsLeft <= 0 && this.targets.every(t => t.dead)) || this.waveTimer <= 0) this._endWave();

      [this.p1, this.p2].forEach(p => {
        if (p.reloading) { p.reloadTimer -= dt; if (p.reloadTimer <= 0) { p.reloading = false; p.heat = 0; document.getElementById(p.id==='p1'?'reloadP1':'reloadP2').style.display='none'; } }
        else { p.heat = Math.max(0, p.heat - COOL_RATE * dt); }
        if (p.recoil > 0) p.recoil -= dt * 90; else p.recoil = 0;
        if (p.inkTimer > 0) p.inkTimer -= dt;
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

  _floatText(text, x, y, col) {
    this._floatTexts.push({ text, x, y, col, life: 1.2, vy: -90, alpha: 1 });
  }

  _updateHUD() {
    const timerEl = document.getElementById('waveTimer');
    if (timerEl) {
        timerEl.textContent = Math.max(0, Math.ceil(this.waveTimer));
        timerEl.classList.toggle('urgent', this.waveTimer <= 5);
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

    ['p1', 'p2'].forEach(id => {
      const p = id === 'p1' ? this.p1 : this.p2;
      const scoreEl = document.getElementById(`score${id==='p1'?'P1':'P2'}`);
      if (scoreEl) scoreEl.textContent = p.score;
      const comboEl = document.getElementById(`combo${id==='p1'?'P1':'P2'}`);
      if (comboEl) comboEl.textContent = p.combo > 1 ? `×${Math.min(p.combo,8)} COMBO` : '';
      
      const ammoEl = id === 'p1' ? 'ammoP1' : 'ammoP2';
      const el = document.getElementById(ammoEl);
      if (this.mode === 'solo' && id === 'p2') return;
      
      if (el) {
        const perc = (p.heat / MAX_HEAT) * 100;
        let statusClass = '';
        if (p.reloading) statusClass = 'overheated';
        else if (p.heat > 70) statusClass = 'hot';
        
        el.innerHTML = `<div class="heat-fill ${statusClass}" style="width: ${perc}%"></div>`;
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
    ctx.fillStyle = '#0d2a10';
    for (let x = 0; x < W + 100; x += 70) {
      const h = 80 + ((x * 37) % 50); ctx.beginPath();
      ctx.moveTo(x - 30, H*0.82); ctx.lineTo(x, H*0.82 - h); ctx.lineTo(x + 30, H*0.82); ctx.fill();
    }

    for (const pt of this.particles) { ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1); ctx.fillStyle = pt.col; ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
    
    for (const tgt of this.targets) { if (tgt.deadTimer < 0.35) { ctx.globalAlpha = tgt.dead ? Math.max(0, 1 - tgt.deadTimer * 4) : 1; this._drawTarget(ctx, tgt, perfT); } }
    ctx.globalAlpha = 1;

    for (const b of this.bullets) this._drawBullet(ctx, b);
    ctx.save(); ctx.textAlign = 'center';
    for (const ft of this._floatTexts) { ctx.globalAlpha = clamp(ft.life * 1.5, 0, 1); ctx.fillStyle = ft.col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 4; ctx.font = '900 20px Outfit'; ctx.strokeText(ft.text, ft.x, ft.y); ctx.fillText(ft.text, ft.x, ft.y); }
    ctx.restore();

    if (this.state === 'playing' || this.state === 'waveclear') { 
        this._drawShotgun(ctx, this.p1, COLORS.p1); 
        this._drawInk(ctx, this.p1, W, H);
        if (this.mode === 'versus') {
            this._drawShotgun(ctx, this.p2, COLORS.p2); 
            this._drawInk(ctx, this.p2, W, H);
        }
    }
    ctx.restore();
  }

  _drawInk(ctx, p, W, H) {
      if (p.inkTimer <= 0) return;
      ctx.save();
      // Render splatters on this player's half of the screen
      const halfW = W / 2;
      const xOffset = p.id === 'p1' ? 0 : halfW; 
      const splatW = this.mode === 'versus' ? halfW : W;

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

  _drawTarget(ctx, tgt, t) {
    const x = tgt.px, y = tgt.py; ctx.save(); ctx.translate(x, y); if (tgt.vx < 0) ctx.scale(-1,1);
    const bob = Math.sin(tgt.anim * 5) * 3; const flap = Math.sin(tgt.anim * 9) * 12;
    if (tgt.type === 'duck') {
      ctx.fillStyle = tgt.claimedBy === 'p1' ? '#ff4455' : tgt.claimedBy === 'p2' ? '#00ccff' : '#4ade80';
      ctx.beginPath(); ctx.ellipse(0, bob, 22, 14, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.ellipse(18, bob-8, 10, 9, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.rotate(flap * Math.PI/180); ctx.fillStyle = '#166534'; ctx.beginPath(); ctx.ellipse(-4, bob-4, 20, 8, 0.3, 0, Math.PI*2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.moveTo(26, bob-8); ctx.lineTo(34, bob-6); ctx.lineTo(26, bob-4); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(20, bob-11, 2.5, 0, Math.PI*2); ctx.fill();
    } else if (tgt.type === 'clay') {
      const col = tgt.claimedBy ? (tgt.claimedBy==='p1'?'#ff4455':'#00ccff') : '#f97316';
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, bob, 20, 9, 0.2, 0, Math.PI*2); ctx.fill();
    } else if (tgt.type === 'golden') {
      ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(0, bob, 18, 11, 0, 0, Math.PI*2); ctx.fill();
    } else if (tgt.type === 'squid') {
      // Ink Squid - distinct purple/black body with tentacles
      ctx.fillStyle = '#3b0764'; ctx.beginPath(); ctx.ellipse(0, bob, 16, 20, 0, 0, Math.PI*2); ctx.fill(); // mantle
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(6, bob-4, 4, 0, Math.PI*2); ctx.fill(); // eye
      // tentacles
      ctx.strokeStyle = '#581c87'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      [-10, 0, 10].forEach(tx => {
        ctx.beginPath(); ctx.moveTo(tx, bob+15);
        ctx.quadraticCurveTo(tx + flap * 0.5, bob + 30, tx + (flap<0?-15:15), bob + 40); ctx.stroke();
      });
    } else if (tgt.type === 'crow') {
      ctx.fillStyle = '#1e1e2e'; ctx.beginPath(); ctx.ellipse(0, bob, 20, 12, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(19, bob-10, 3, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,0,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, bob, 36, 0, Math.PI*2); ctx.stroke();
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

  _drawShotgun(ctx, p, col) {
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI*2); ctx.fill();
    
    ctx.save(); 
    ctx.translate(0, -10); ctx.rotate(p.angle); ctx.translate(-p.recoil * 1.5, 0);

    // Double barrels
    ctx.fillStyle = '#444'; 
    ctx.fillRect(10, -8, 70, 6); 
    ctx.fillRect(10, -1, 70, 6); 
    
    // Pump
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(30, -3, 25, 10);
    ctx.fillStyle = '#3a200a'; for(let i=32; i<52; i+=4) ctx.fillRect(i, -3, 2, 10);

    // Receiver
    ctx.fillStyle = col; ctx.fillRect(-15, -10, 30, 20);
    ctx.fillStyle = '#222'; ctx.fillRect(0, -10, 15, 8);

    // Stock
    ctx.fillStyle = '#5c3a21';
    ctx.beginPath(); ctx.moveTo(-15, -10); ctx.lineTo(-40, -5); ctx.lineTo(-40, 15); ctx.lineTo(-15, 10); ctx.fill();
    
    ctx.restore();
    
    // Player shoulder / mount base
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -5, 18, Math.PI, 0); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(-15, -5, 30, 10);
    ctx.restore();
  }
}

function waveConfig(waveNum, difficulty) {
  const d = { easy:0.7, normal:1, hard:1.4 }[difficulty] || 1;
  const base = Math.min(waveNum, 10);
  return {
    targetCount : Math.round((4 + base * 1.2) * d), spawnInterval: Math.max(0.5, (2.5 - base*0.15) / d), timer: Math.round(20 + base * 2),
    goldChance: Math.min(0.08 + base*0.015, 0.2), clayChance: Math.min(0.15 + base*0.02, 0.35), crowChance: Math.min(base*0.015, 0.12),
    squidChance: 0.05, // 5% chance of sabotage squad
  };
}

window.addEventListener('DOMContentLoaded', () => { 
  Sfx.loadFiles();
  new DuckHuntDuel(); 
});
