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
  shoot()  { this._noise(0.08,0.14); this._tone(200,'square',0.06,0.05,80); },
  hit()    { this._tone(660,'sine',0.12,0.12,880); this._noise(0.05,0.06); },
  hitBig() { [660,880,1100].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.18,0.14),i*50)); },
  miss()   { this._tone(180,'sawtooth',0.15,0.06,120); },
  steal()  { this._tone(440,'sine',0.08,0.1,330); },
  reload() { [180,200,220].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.08,0.06),i*60)); },
  crow()   { this._tone(120,'sawtooth',0.25,0.1); },
  wave()   { [523,659,784].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.2,0.1),i*100)); },
  win()    { [523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>this._tone(f,'sine',0.25,0.12),i*120)); },
  draw()   { [440,440,440].forEach((f,i)=>setTimeout(()=>this._tone(f,'triangle',0.2,0.08),i*120)); },
};

// ── Constants ─────────────────────────────────────────────────
const MAX_AMMO   = 6;
const RELOAD_MS  = 1400;
const BULLET_SPEED = 1200; // px/s
const HIT_RADIUS = { duck:38, clay:30, golden:26, crow:44 };
const PTS        = { duck:100, clay:150, golden:500, crow:-200 };
const COLORS     = { p1:'#ff4455', p2:'#00ccff', gold:'#fbbf24', bad:'#ff6600' };

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
  }
  update(dt, W, H) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    
    // Die if offscreen
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
    this.claimedBy = null; // 'p1' | 'p2'
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

    this.r = hitR;
    this.wobble = 0;
    this.anim = rnd(0, Math.PI*2);
  }

  _pickPattern(type, W, H) {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const sx = side === 'left' ? -60 : W + 60;
    const tx_dir = side === 'left' ? 1 : -1;

    const speeds = { duck: rnd(140,240), clay: rnd(200,340), golden: rnd(300,480), crow: rnd(80,160) };
    const spd = speeds[type];

    const style = rndI(0,3);
    if (style === 0) {
      return { px: sx, py: rnd(H*0.15, H*0.65), vx: tx_dir*spd, vy: rnd(-40,40), ax:0, ay:0 };
    } else if (style === 1) {
      const gy = type==='clay' ? rnd(60,120) : rnd(20,60);
      return { px: sx, py: rnd(H*0.5, H*0.7), vx: tx_dir*spd, vy: rnd(-200,-80), ax:0, ay:gy };
    } else {
      return { px: sx, py: rnd(H*0.2, H*0.6), vx: tx_dir*spd, vy: 0, ax:0, ay:0, sine: true, sineAmp: rnd(40,90), sineFreq: rnd(1.2,2.5) };
    }
  }

  update(dt, W, H) {
    if (this.dead) { this.deadTimer += dt; return; }

    this.anim += dt;
    this.vx += this.ax * dt;
    this.vy += this.ay * dt;

    if (this.sine) {
      this.py = this._baseY + Math.sin(this.anim * this.sineFreq) * this.sineAmp;
      if (!this._baseSet) { this._baseY = this.py; this._baseSet = true; }
    }

    this.px += this.vx * dt;
    this.py += this.vy * dt;

    this.wobble = Math.sin(this.anim * 6) * 5;

    if (this.type === 'crow') {
      if (this.py < 30 || this.py > H - 30) { this.vy *= -1; }
    }

    if (this.px < -120 || this.px > W + 120 || this.py > H + 100) {
      this.dead = true;
      this.deadTimer = 99; // immediate cleanup
    }
  }

  isExpired() { return this.dead && this.deadTimer > (this.claimedBy ? 0.7 : 0.1); }
}

// ── Player State ──────────────────────────────────────────────
function makePlayer(id, ammo=MAX_AMMO) {
  return {
    id, score: 0, ammo,
    reloading: false, reloadTimer: 0,
    combo: 0, hits: 0, misses: 0, steals: 0,
    x: 0, y: 0, // Turret position
    angle: -Math.PI / 2, // Aim straight up
    recoil: 0, // Visual barrel kick
    justShot: false,
  };
}

// ── Wave Config ────────────────────────────────────────────────
function waveConfig(waveNum, difficulty) {
  const d = { easy:0.7, normal:1, hard:1.4 }[difficulty] || 1;
  const base = Math.min(waveNum, 10);
  return {
    targetCount : Math.round((4 + base * 1.2) * d),
    spawnInterval: Math.max(0.5, (2.5 - base*0.15) / d),
    timer: Math.round(20 + base * 2),
    goldChance: Math.min(0.08 + base*0.015, 0.2),
    clayChance: Math.min(0.15 + base*0.02, 0.35),
    crowChance: Math.min(base*0.015, 0.12),
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

    this.targets   = [];
    this.bullets   = [];
    this.particles = [];
    this.p1 = makePlayer('p1');
    this.p2 = makePlayer('p2');

    this.keys  = {};
    this._prevKeys = {};

    this._bindEvents();
    this._bindUI();
    window.addEventListener('resize', ()=>this._resize());
    this._resize();

    this._lastTs = 0;
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight - 72; // subtract HUD
    if (this.p1) {
      this.p1.x = this.canvas.width * 0.3;
      this.p1.y = this.canvas.height;
    }
    if (this.p2) {
      this.p2.x = this.canvas.width * 0.7;
      this.p2.y = this.canvas.height;
    }
    
    if (this.mode === 'solo' && this.p1) {
      this.p1.x = this.canvas.width * 0.5;
    }
  }

  _bindEvents() {
    window.addEventListener('keydown', e => {
      if (['Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }

  _bindUI() {
    document.getElementById('btnSolo').addEventListener('click', () => {
      if (AC.state==='suspended') AC.resume();
      this.mode = 'solo';
      this._startGame();
    });
    document.getElementById('btnVersus').addEventListener('click', () => {
      if (AC.state==='suspended') AC.resume();
      this.mode = 'versus';
      this._startGame();
    });
    document.getElementById('btnPlayAgain').addEventListener('click', () => this._startGame());
    document.getElementById('btnMenu').addEventListener('click', () => {
      document.getElementById('resultsScreen').classList.remove('active');
      document.getElementById('gameScreen').classList.remove('active');
      document.getElementById('titleScreen').classList.add('active');
      this.state = 'title';
    });
  }

  _showScreen(id) {
    ['titleScreen','gameScreen','resultsScreen'].forEach(s => {
      document.getElementById(s).classList.remove('active');
    });
    document.getElementById(id).classList.add('active');
  }

  _startGame() {
    this.maxWaves   = parseInt(document.getElementById('waveSelect').value) || 10;
    this.difficulty = document.getElementById('diffSelect').value || 'normal';

    this.wave     = 0;
    this.targets  = [];
    this.bullets  = [];
    this.particles= [];
    this.p1 = makePlayer('p1');
    this.p2 = makePlayer('p2');
    
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
    this.targets     = [];
    this.bullets     = [];
    this.state       = 'countdown';

    document.getElementById('waveDisplay').textContent = `Wave ${this.wave}/${this.maxWaves}`;

    const overlay = document.getElementById('countdownOverlay');
    const num     = document.getElementById('countdownNum');
    overlay.classList.remove('hidden');
    let n = 3;
    num.textContent = n;
    Sfx._tone(440,'square',0.1,0.05);
    const cd = setInterval(() => {
      n--;
      if (n > 0) {
        num.textContent = n;
        num.style.animation = 'none';
        void num.offsetWidth;
        num.style.animation = '';
        Sfx._tone(440,'square',0.1,0.05);
      } else {
        clearInterval(cd);
        overlay.classList.add('hidden');
        this.state = 'playing';
      }
    }, 900);
  }

  _spawnTarget() {
    const c = this.waveConf;
    const r = Math.random();
    let type;
    if      (r < c.crowChance)            type = 'crow';
    else if (r < c.crowChance+c.goldChance) type = 'golden';
    else if (r < c.crowChance+c.goldChance+c.clayChance) type = 'clay';
    else                                   type = 'duck';

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

  // ── Shooting ────────────────────────────────────────────────
  _shoot(who) {
    const p = who === 'p1' ? this.p1 : this.p2;
    if (p.reloading || p.ammo <= 0) { Sfx.miss(); return; }

    p.ammo--;
    p.recoil = 20; // Visual barrel kick
    Sfx.shoot();
    this._updateAmmoHUD();

    if (p.ammo <= 0) {
      p.reloading  = true;
      p.reloadTimer = RELOAD_MS / 1000;
      document.getElementById(`reload${who==='p1'?'P1':'P2'}`).style.display = 'block';
      Sfx.reload();
    }

    // Spawn physical bullet
    const vx = Math.cos(p.angle) * BULLET_SPEED;
    const vy = Math.sin(p.angle) * BULLET_SPEED;
    // Offset slightly ahead of the barrel
    const bx = p.x + Math.cos(p.angle) * 50;
    const by = p.y - 12 + Math.sin(p.angle) * 50;
    
    this.bullets.push(new Bullet(bx, by, vx, vy, who, COLORS[who]));
    
    // Muzzle flash particle
    spawnBurst(this.particles, bx, by, '#fff', 3, 100);
  }

  _claimTarget(target, who) {
    const p = who === 'p1' ? this.p1 : this.p2;
    if (target.dead) return;

    if (target.type === 'crow') {
      p.score = Math.max(0, p.score + PTS.crow);
      p.hits++; p.combo = 0;
      target.dead = true; target.claimedBy = who;
      Sfx.crow();
      spawnBurst(this.particles, target.px, target.py, COLORS.bad, 14, 200);
      this._floatText(`${PTS.crow}`, target.px, target.py, COLORS.bad);
      this._updateHUD(who);
      return;
    }

    // Steal detection (other player has a bullet very close to this target)
    let isSteal = false;
    if (this.mode === 'versus') {
      const otherWho = who === 'p1' ? 'p2' : 'p1';
      for (const b of this.bullets) {
        if (b.owner === otherWho && !b.dead && dist(b.x, b.y, target.px, target.py) < target.r + 150) {
          isSteal = true;
          break;
        }
      }
    }

    if (isSteal) { p.steals++; Sfx.steal(); }

    const pts = PTS[target.type];
    p.combo++;
    const comboMult = Math.min(p.combo, 8);
    const bonus = pts * (comboMult > 1 ? comboMult : 1);
    p.score  += bonus;
    p.hits++;
    target.dead = true; target.claimedBy = who;
    target.claimFlash = 0.5;

    const col = who === 'p1' ? COLORS.p1 : COLORS.p2;
    if (target.type === 'golden') Sfx.hitBig();
    else Sfx.hit();

    const n = target.type === 'golden' ? 28 : 14;
    spawnBurst(this.particles, target.px, target.py, col, n, target.type==='golden'?360:240);
    if (target.type === 'golden') spawnBurst(this.particles, target.px, target.py, COLORS.gold, 20, 300);

    let label = comboMult > 1 ? `×${comboMult} ${bonus}!` : `+${pts}`;
    if (isSteal) label = `STEAL! +${bonus}`;
    this._floatText(label, target.px, target.py - 20, col);

    this._updateHUD(who);
    this._updateComboHUD(who);
  }

  // ── HUD ─────────────────────────────────────────────────────
  _updateHUD(who) {
    document.getElementById(`score${who==='p1'?'P1':'P2'}`).textContent = (who==='p1'?this.p1:this.p2).score;
    this._updateAmmoHUD();
  }

  _updateAmmoHUD() {
    [this.p1, this.p2].forEach(p => {
      const id = p.id==='p1' ? 'ammoP1' : 'ammoP2';
      if (this.mode==='solo' && p.id==='p2') return;
      const el = document.getElementById(id);
      let html = '';
      for(let i=0;i<MAX_AMMO;i++) {
        const loaded = !p.reloading && i < p.ammo;
        html += `<div class="ammo-pip ${loaded ? `loaded-${p.id}` : ''}"></div>`;
      }
      el.innerHTML = html;
    });
  }

  _updateComboHUD(who) {
    const p  = who === 'p1' ? this.p1 : this.p2;
    const id = who === 'p1' ? 'comboP1' : 'comboP2';
    const el = document.getElementById(id);
    if (p.combo > 1) {
      el.textContent = `×${Math.min(p.combo,8)} COMBO`;
    } else {
      el.textContent = '';
    }
  }

  // ── Float texts ──────────────────────────────────────────────
  _floatTexts = [];
  _floatText(text, x, y, col) {
    this._floatTexts.push({ text, x, y, col, life: 1.2, vy: -90, alpha: 1 });
  }

  // ── Main Loop ────────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - (this._lastTs||ts)) / 1000, 0, 0.05);
    this._lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame(t => this._loop(t));
  }

  _update(dt) {
    if (this.state === 'playing') {
      
      const turnSpd = 3.5 * dt;

      // P1 Keyboard Controls (A/D to aim, W to shoot)
      if (this.keys['KeyA']) this.p1.angle -= turnSpd;
      if (this.keys['KeyD']) this.p1.angle += turnSpd;
      // Clamp between almost flat left and flat right
      this.p1.angle = clamp(this.p1.angle, -Math.PI + 0.15, -0.15);
      
      const p1Shoot = this.keys['KeyW'];
      if (p1Shoot && !this._prevKeys['KeyW']) this._shoot('p1');

      // P2 Keyboard Controls (Left/Right to aim, Up to shoot)
      if (this.mode === 'versus') {
        if (this.keys['ArrowLeft']) this.p2.angle -= turnSpd;
        if (this.keys['ArrowRight']) this.p2.angle += turnSpd;
        this.p2.angle = clamp(this.p2.angle, -Math.PI + 0.15, -0.15);

        const p2Shoot = this.keys['ArrowUp'];
        if (p2Shoot && !this._prevKeys['ArrowUp']) this._shoot('p2');
      }

      // Wave timer
      this.waveTimer -= dt;
      const timerEl = document.getElementById('waveTimer');
      timerEl.textContent = Math.max(0, Math.ceil(this.waveTimer));
      timerEl.classList.toggle('urgent', this.waveTimer <= 5);

      // Spawn targets
      if (this.targetsLeft > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this._spawnTarget();
          this.spawnTimer = this.waveConf.spawnInterval;
          if (Math.random() < 0.25 && this.targetsLeft > 0) {
            this._spawnTarget();
          }
        }
      }

      // Update targets
      for (const t of this.targets) t.update(dt, this.canvas.width, this.canvas.height);
      this.targets = this.targets.filter(t => !t.isExpired());

      // Update bullets
      for (const b of this.bullets) {
        b.update(dt, this.canvas.width, this.canvas.height);
        if (b.dead) continue;
        
        // target collision
        for (const t of this.targets) {
          if (t.dead) continue;
          if (dist(b.x, b.y, t.px, t.py) <= t.r + b.r) {
            b.dead = true;
            b.hitSomething = true;
            this._claimTarget(t, b.owner);
            break;
          }
        }
      }
      
      // Process dead bullets for misses
      for (const b of this.bullets) {
        if (b.dead && !b.hitSomething) {
           const ownerP = b.owner === 'p1' ? this.p1 : this.p2;
           ownerP.misses++;
           ownerP.combo = 0;
           this._updateComboHUD(b.owner);
        }
      }
      this.bullets = this.bullets.filter(b => !b.dead);

      // Wave end condition
      const allDone = this.targetsLeft <= 0 && this.targets.every(t => t.dead);
      if (allDone || this.waveTimer <= 0) {
        this._endWave();
      }

      // Reload & Recoil
      [this.p1, this.p2].forEach(p => {
        if (p.reloading) {
          p.reloadTimer -= dt;
          if (p.reloadTimer <= 0) {
            p.reloading = false;
            p.ammo = MAX_AMMO;
            this._updateAmmoHUD();
            document.getElementById(p.id==='p1'?'reloadP1':'reloadP2').style.display='none';
          }
        }
        if (p.recoil > 0) p.recoil -= dt * 60; // Spring back quickly
        else p.recoil = 0;
      });

      // Particles
      for (const pt of this.particles) pt.update(dt);
      this.particles = this.particles.filter(pt => pt.life > 0);

      // Float texts
      for (const ft of this._floatTexts) { ft.y += ft.vy*dt; ft.life -= dt; }
      this._floatTexts = this._floatTexts.filter(ft => ft.life > 0);
    }

    // Save prev keys
    this._prevKeys = Object.assign({}, this.keys);
  }

  // ── Drawing ─────────────────────────────────────────────────
  _draw() {
    if (this.state === 'title' || this.state === 'results') return;

    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // Background
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#0a1e0a'); sky.addColorStop(0.6,'#143d14'); sky.addColorStop(1,'#1a5520');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,W,H);

    // Ground 
    ctx.fillStyle = '#0e2a0e';
    ctx.fillRect(0, H*0.82, W, H*0.18);
    ctx.fillStyle = '#1a4020';
    ctx.fillRect(0, H*0.82, W, 8);

    ctx.fillStyle = '#0d2a10';
    for (let x = 0; x < W + 100; x += 70) {
      const h = 80 + ((x * 37) % 50);
      ctx.beginPath();
      ctx.moveTo(x - 30, H*0.82);
      ctx.lineTo(x, H*0.82 - h);
      ctx.lineTo(x + 30, H*0.82);
      ctx.fill();
    }

    // Particles
    for (const pt of this.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.col;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Targets
    const t = performance.now() / 1000;
    for (const tgt of this.targets) {
      if (tgt.deadTimer > 0.35) continue;
      const alpha = tgt.dead ? Math.max(0, 1 - tgt.deadTimer * 4) : 1;
      ctx.globalAlpha = alpha;
      this._drawTarget(ctx, tgt, t);
    }
    ctx.globalAlpha = 1;

    // Bullets
    for (const b of this.bullets) {
      this._drawBullet(ctx, b);
    }

    // Float texts
    ctx.save();
    ctx.textAlign = 'center';
    for (const ft of this._floatTexts) {
      const a = clamp(ft.life * 1.5, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = ft.col;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.font = '900 20px Outfit';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Turrets
    if (this.state === 'playing' || this.state === 'waveclear') {
      this._drawTurret(ctx, this.p1, COLORS.p1);
      if (this.mode === 'versus') {
        this._drawTurret(ctx, this.p2, COLORS.p2);
      }
    }
  }

  _drawTarget(ctx, tgt, t) {
    const x = tgt.px, y = tgt.py;

    ctx.save();
    ctx.translate(x, y);

    if (tgt.vx < 0) ctx.scale(-1,1);

    const bob = Math.sin(tgt.anim * 5) * 3;
    const flap = Math.sin(tgt.anim * 9) * 12;

    if (tgt.type === 'duck') {
      ctx.fillStyle = tgt.claimedBy === 'p1' ? '#ff4455' : tgt.claimedBy === 'p2' ? '#00ccff' : '#4ade80';
      ctx.beginPath(); ctx.ellipse(0, bob, 22, 14, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.ellipse(18, bob-8, 10, 9, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.rotate(flap * Math.PI/180);
      ctx.fillStyle = '#166534';
      ctx.beginPath(); ctx.ellipse(-4, bob-4, 20, 8, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.moveTo(26, bob-8); ctx.lineTo(34, bob-6); ctx.lineTo(26, bob-4); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(20, bob-11, 2.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(21, bob-12, 1, 0, Math.PI*2); ctx.fill();

    } else if (tgt.type === 'clay') {
      const col = tgt.claimedBy ? (tgt.claimedBy==='p1'?'#ff4455':'#00ccff') : '#f97316';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, bob, 20, 9, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.ellipse(-4, bob-2, 10, 4, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, bob, 20, 9, 0.2, 0, Math.PI*2); ctx.stroke();

    } else if (tgt.type === 'golden') {
      const glow = ctx.createRadialGradient(0, bob, 0, 0, bob, 30);
      glow.addColorStop(0,'rgba(251,191,36,0.4)'); glow.addColorStop(1,'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, bob, 30, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(0, bob, 18, 11, 0, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.rotate(flap * Math.PI/180);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.ellipse(-2, bob-5, 16, 7, 0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.ellipse(16, bob-7, 8, 7, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      [[-14,-14],[14,-18],[-5,-22]].forEach(([sx,sy]) => {
        ctx.save(); ctx.translate(sx,sy+bob); ctx.rotate(tgt.anim*2); ctx.beginPath();
        for(let i=0;i<4;i++){ ctx.rotate(Math.PI/2); ctx.moveTo(0,0); ctx.lineTo(5,0); }
        ctx.strokeStyle='rgba(255,255,200,0.7)'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.restore();
      });

    } else if (tgt.type === 'crow') {
      ctx.fillStyle = '#1e1e2e';
      ctx.beginPath(); ctx.ellipse(0, bob, 20, 12, 0, 0, Math.PI*2); ctx.fill();
      ctx.save(); ctx.rotate((flap*1.3) * Math.PI/180);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.ellipse(-2, bob-6, 18, 7, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#0f0f1a';
      ctx.beginPath(); ctx.ellipse(16, bob-8, 9, 8, 0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(19, bob-10, 3, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,0,0.25)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, bob, 36, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,60,60,0.7)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-32, bob-20); ctx.lineTo(-18, bob-8); ctx.moveTo(-18,bob-20); ctx.lineTo(-32,bob-8); ctx.stroke();
    }

    ctx.restore();
  }

  _drawBullet(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    
    // Simple glowing laser bullet
    ctx.fillStyle = b.col;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(4, 0, 4, 1.5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  _drawTurret(ctx, p, col) {
    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Reload UI overlay
    if (p.reloading) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 6;
      ctx.beginPath();
      const prog = 1 - (p.reloadTimer / (RELOAD_MS/1000));
      ctx.arc(0, -50, 20, -Math.PI/2, -Math.PI/2 + prog * Math.PI*2);
      ctx.stroke();
    }

    // Shadow below
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 12, 0, 0, Math.PI*2);
    ctx.fill();

    // The Barrel (rotates)
    ctx.save();
    // Move up slightly so it revolves around a higher pivot
    ctx.translate(0, -12);
    ctx.rotate(p.angle);
    // Recoil (kickback)
    ctx.translate(-p.recoil, 0);

    // Main tube
    ctx.fillStyle = col;
    ctx.fillRect(0, -10, 60, 20);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, -10, 60, 6);
    // Barrel grip/details
    ctx.fillStyle = '#222';
    ctx.fillRect(35, -11, 20, 22);
    // Muzzle tip
    ctx.fillStyle = '#111';
    ctx.fillRect(60, -12, 8, 24);

    ctx.restore();

    // The Base (static)
    // Dome top
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(0, -5, 30, Math.PI, 0); 
    ctx.fill();
    // Main block
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(-25, -18);
    ctx.lineTo(25, -18);
    ctx.lineTo(35, 0);
    ctx.fill();
    // Base detail
    ctx.fillStyle = '#000';
    ctx.fillRect(-28, -6, 56, 6);
    
    ctx.restore();
  }
}

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const game = new DuckHuntDuel();
  document.getElementById('hudP2').style.display = 'none';
  game._updateAmmoHUD();
});
