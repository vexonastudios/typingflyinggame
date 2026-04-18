'use strict';
// ═══════════════════════════════════════════════════════════════
//  CASTLE DUEL — Head-to-Head Math & Physics Siege
// ═══════════════════════════════════════════════════════════════

// ── Globals & Tuning ─────────────────────────────────────────────
const WORLD_W = 2800;
const FLOOR_Y = 850;
const GRAVITY = 1100;
const P1_COLOR = '#ff4466';
const P2_COLOR = '#00ccff';

// Physics objects
const CASTLES = [
  { id: 0, x: 250,  w: 120, h: 220, dir: 1,  color: P1_COLOR, name: 'Player 1' },
  { id: 1, x: 2550, w: 120, h: 220, dir: -1, color: P2_COLOR, name: 'Player 2' },
];

const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── SFX Engine ────────────────────────────────────────────────────
const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },
  _t(f, type, dur, vol = 0.08, slide = null) {
    try {
      this._r();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, _ac.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, _ac.currentTime + dur);
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      o.connect(g); g.connect(_ac.destination);
      o.start(); o.stop(_ac.currentTime + dur);
    } catch (e) {}
  },
  ding()  { this._t(880, 'sine', 0.1, 0.06); this._t(1100, 'sine', 0.2, 0.06); },
  buzz()  { this._t(150, 'sawtooth', 0.3, 0.1); },
  fire()  { this._t(120, 'square', 0.4, 0.08, 40); },
  hit()   { [100,80,60].forEach((f,i) => setTimeout(() => this._t(f,'sawtooth',0.3,0.15), i*80)); },
  miss()  { this._t(80, 'triangle', 0.2, 0.1); },
  win()   { [523,659,784,1047,1318].forEach((f,i) => setTimeout(() => this._t(f,'sine',0.30,0.15), i*110)); }
};

// ── Math Generator ───────────────────────────────────────────────
class MathGenerator {
  static getProblem(diff) {
    let q = '', a1, a2, a3, ans;
    const rInt = (mn, mx) => Math.floor(Math.random() * (mx - mn + 1) + mn);
    
    // Pick operation space loosely based on diff
    // easy -> + or -
    // med  -> *, +, -
    // hard -> *, /, +, -
    let ops = ['+','-'];
    if (diff === 'medium') ops = ['*','+','-'];
    if (diff === 'hard') ops = ['*','/','+','-','*'];

    const op = ops[Math.floor(Math.random() * ops.length)];

    if (op === '+') {
      const a = rInt(5, diff==='easy'?15:40), b = rInt(5, diff==='easy'?15:40);
      q = `${a} + ${b}`; ans = a + b;
    } else if (op === '-') {
      const a = rInt(10, diff==='easy'?20:50), b = rInt(3, a-1);
      q = `${a} - ${b}`; ans = a - b;
    } else if (op === '*') {
      const mxA = diff==='medium'?9:12;
      const a = rInt(3, mxA), b = rInt(3, mxA);
      q = `${a} × ${b}`; ans = a * b;
    } else if (op === '/') {
      const b = rInt(3, 10);
      const a = b * rInt(3, 10);
      q = `${a} ÷ ${b}`; ans = a / b;
    }

    // Generate foils
    let foils = [ans, ans + rInt(1,4)* (Math.random()<.5?1:-1), ans + rInt(5,9)* (Math.random()<.5?1:-1)];
    if (foils[1] === ans) foils[1] += 2;
    if (foils[2] === ans) foils[2] += 3;
    if (foils[2] === foils[1]) foils[2] += 1;

    // Shuffle
    foils.sort(() => Math.random() - 0.5);
    const correctIdx = foils.indexOf(ans);

    return { text: q, options: foils, correct: correctIdx };
  }
}

// ── Player & Economy ───────────────────────────────────────────────
class Player {
  constructor(id, keys, color, diff, viewW, viewH) {
    this.id = id;
    this.keys = keys;  // e.g. { math: ['KeyF','KeyG','KeyH'], up: 'KeyW', down: 'KeyS', pwrUp: 'KeyD', pwrDn: 'KeyA', fire: 'Space' }
    this.color = color;
    this.diff = diff;
    
    this.hp = 100;
    this.ammo = 3;     // start with some ammo
    this.stunTimer = 0;
    this.flash = 0;
    this.flashColor = '#fff';

    // Catapult state
    this.angle = 45;   // degrees
    this.power = 50;   // 0-100 percentage
    this.castle = CASTLES[id];

    // Math state
    this.problem = null;
    this._nextProblem();

    // Camera state
    this.camX = this.castle.x; 
    this.targetCamX = this.castle.x;
    this.trackingProj = null; // follows this rock if fired
    
    // Key debounce
    this._prevKeys = {};
  }

  _nextProblem() {
    this.problem = MathGenerator.getProblem(this.diff);
  }

  damage(amt) {
    this.hp = Math.max(0, this.hp - amt);
    this.flash = 0.4;
    this.flashColor = '#ff2222';
  }

  update(dt, inputObj, game) {
    if (this.hp <= 0) return;

    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.flash = Math.max(0, this.flash - dt);

    const PRESSED = (code) => inputObj[code] && !this._prevKeys[code];

    // ── Math Interaction ──
    if (this.stunTimer <= 0) {
      for (let i = 0; i < 3; i++) {
        if (PRESSED(this.keys.math[i])) {
          if (this.problem.correct === i) {
            // Correct
            this.ammo++;
            this.flash = 0.2; this.flashColor = '#88ff88';
            Sfx.ding();
            this._nextProblem();
          } else {
            // Wrong
            this.stunTimer = 2.0;
            this.flash = 0.3; this.flashColor = '#ff4444';
            Sfx.buzz();
          }
        }
      }
    }

    // ── Catapult interaction (smooth) ──
    const dAngle = 35 * dt;
    const dPower = 40 * dt;
    if (inputObj[this.keys.up]) this.angle += dAngle;
    if (inputObj[this.keys.down]) this.angle -= dAngle;
    if (inputObj[this.keys.pwrUp]) this.power += dPower;
    if (inputObj[this.keys.pwrDn]) this.power -= dPower;
    
    this.angle = clamp(this.angle, 15, 80);
    this.power = clamp(this.power, 15, 100);

    // ── Fire ──
    if (PRESSED(this.keys.fire) && this.ammo > 0 && !this.trackingProj) {
      this.ammo--;
      Sfx.fire();
      
      const v = lerp(600, 1600, this.power / 100);
      const rad = this.angle * (Math.PI / 180);
      const dir = this.castle.dir;
      
      const px = this.castle.x + dir * (this.castle.w/2 + 20);
      const py = FLOOR_Y - this.castle.h + 50;

      const proj = new Projectile(this.id, px, py, Math.cos(rad) * v * dir, -Math.sin(rad) * v);
      game.projectiles.push(proj);
      
      // Hook camera
      this.trackingProj = proj;
    }

    // ── Camera tracking ──
    if (this.trackingProj) {
      this.targetCamX = this.trackingProj.x;
      if (this.trackingProj.deadTimer > 1.2) {
        this.trackingProj = null; // let go after impact
      }
    } else {
      this.targetCamX = this.castle.x;
    }

    this.camX = lerp(this.camX, this.targetCamX, 5 * dt);

    // Save previous keys loop
    Object.keys(inputObj).forEach(k => this._prevKeys[k] = inputObj[k]);
  }
}

// ── Projectile Physics ─────────────────────────────────────────────
class Projectile {
  constructor(ownerId, x, y, vx, vy) {
    this.ownerId = ownerId;
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.dead = false;
    this.deadTimer = 0;
    this.trail = [];
  }
  
  update(dt, game) {
    if (this.dead) {
      this.deadTimer += dt;
      return;
    }

    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.trail.push({x: this.x, y: this.y});
    if (this.trail.length > 20) this.trail.shift();

    // Hit map bounds
    if (this.y > FLOOR_Y) {
      this.y = FLOOR_Y;
      this._explode(game, false);
      return;
    }

    // Hit enemy castle
    const enemy = CASTLES[1 - this.ownerId];
    if (this.x > enemy.x - enemy.w/2 && this.x < enemy.x + enemy.w/2) {
      if (this.y > FLOOR_Y - enemy.h) {
        // Hit!
        let dmg = 20;
        // Bullseye check (hit top 20% of castle)
        if (this.y < FLOOR_Y - enemy.h + (enemy.h * 0.2)) dmg = 40;
        
        game.players[1 - this.ownerId].damage(dmg);
        this._explode(game, true);
      }
    }
  }

  _explode(game, hitTarget) {
    this.dead = true;
    this.vx = 0; this.vy = 0;
    if (hitTarget) {
      Sfx.hit();
      // create big sparks
      for(let i=0;i<25;i++) game.particles.push(new Particle(this.x, this.y, '#ffea77'));
    } else {
      Sfx.miss();
      // dirt clod
      for(let i=0;i<15;i++) game.particles.push(new Particle(this.x, this.y, '#554433'));
    }
  }
}

class Particle {
  constructor(x, y, c) {
    this.x=x; this.y=y; this.c=c;
    const a = Math.random() * Math.PI*2;
    const v = Math.random() * 200 + 50;
    this.vx = Math.cos(a)*v; this.vy = Math.sin(a)*v - 100;
    this.life = Math.random() * 0.5 + 0.3;
    this.maxLife = this.life;
  }
  update(dt) {
    this.vy += GRAVITY*dt;
    this.x+=this.vx*dt; this.y+=this.vy*dt;
    this.life-=dt;
  }
}

// ── Core Engine ──────────────────────────────────────────────────
class CastleDuel {
  constructor() {
    this.canvas = document.getElementById('castleCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.input = {};

    window.addEventListener('resize', () => this._resize());
    window.addEventListener('keydown', e => {
      this.input[e.code] = true;
      if (['Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.input[e.code] = false; });

    this._bindUI();
    this._resize();
    this.state = 'setup';
    
    this._lt = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  _bindUI() {
    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        el.querySelector('input').checked = true;
      });
    });

    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
    document.getElementById('menuBtn').addEventListener('click', () => {
      document.getElementById('resultsOverlay').style.display = 'none';
      document.getElementById('setupOverlay').style.display = 'flex';
      this.state = 'setup';
    });
  }

  startGame() {
    Sfx._r();
    document.getElementById('setupOverlay').style.display = 'none';
    document.getElementById('resultsOverlay').style.display = 'none';

    const diff = document.querySelector('input[name="diff"]:checked').value;

    const k1 = { math: ['KeyF','KeyG','KeyH'], up: 'KeyW', down: 'KeyS', pwrUp: 'KeyD', pwrDn: 'KeyA', fire: 'Space' };
    const k2 = { math: ['KeyJ','KeyK','KeyL'], up: 'ArrowUp', down: 'ArrowDown', pwrUp: 'ArrowRight', pwrDn: 'ArrowLeft', fire: 'Enter' };

    this.players = [
      new Player(0, k1, P1_COLOR, diff),
      new Player(1, k2, P2_COLOR, diff)
    ];

    this.projectiles = [];
    this.particles = [];
    this.state = 'playing';
  }

  _loop(ts) {
    const dt = clamp((ts - (this._lt || ts))/1000, 0, 0.05);
    this._lt = ts;

    this.update(dt);
    this.draw();

    requestAnimationFrame(t => this._loop(t));
  }

  update(dt) {
    if (this.state !== 'playing') return;

    this.players.forEach(p => p.update(dt, this.input, this));
    
    this.projectiles.forEach(p => p.update(dt, this));
    this.projectiles = this.projectiles.filter(p => !p.dead || p.deadTimer < 2);

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => p.life > 0);

    // Check Win/Loss
    if (this.players[0].hp <= 0 || this.players[1].hp <= 0) {
      this.state = 'results';
      setTimeout(() => this._endGame(), 1500);
    }
  }

  _endGame() {
    document.getElementById('resultsOverlay').style.display = 'flex';
    const p1dead = this.players[0].hp <= 0;
    const p2dead = this.players[1].hp <= 0;

    const h = document.getElementById('resultsHeadline');
    if (p1dead && p2dead) { h.textContent = "It's a Draw!"; document.getElementById('resultsEmoji').textContent='⚔️'; }
    else if (p1dead) { h.textContent = "Player 2 Wins!"; document.getElementById('resultsEmoji').textContent='👑'; Sfx.win(); }
    else { h.textContent = "Player 1 Wins!"; document.getElementById('resultsEmoji').textContent='👑'; Sfx.win(); }
  }

  // ── DRAWING ────────────────────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0,0,this.W,this.H);

    if (this.state !== 'playing') {
      this._drawMenuDecor(ctx);
      return;
    }

    const vpW = this.W / 2;
    
    // Draw Viewport 1 (Left Split)
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vpW, this.H); ctx.clip();
    this._drawWorld(ctx, this.players[0], vpW);
    this._drawHUD(ctx, this.players[0], 0, vpW);
    ctx.restore();

    // Draw Viewport 2 (Right Split)
    ctx.save();
    ctx.translate(vpW, 0);
    ctx.beginPath(); ctx.rect(0, 0, vpW, this.H); ctx.clip();
    this._drawWorld(ctx, this.players[1], vpW);
    this._drawHUD(ctx, this.players[1], vpW, vpW);
    ctx.restore();
  }

  _drawWorld(ctx, viewer, vpW) {
    ctx.save();
    // Determine camera pan (keep target centered, clamp to world bounds)
    const panX = clamp(viewer.camX - vpW/2, 0, WORLD_W - vpW);
    
    ctx.translate(-panX, 0);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    sky.addColorStop(0, '#0a101b'); sky.addColorStop(1, '#1b2a38');
    ctx.fillStyle = sky;
    ctx.fillRect(panX, 0, vpW, FLOOR_Y); // only draw visible sky

    // Ground
    ctx.fillStyle = '#1c221a';
    ctx.fillRect(panX, FLOOR_Y, vpW, this.H - FLOOR_Y);
    ctx.strokeStyle = '#2d3b29'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(panX, FLOOR_Y); ctx.lineTo(panX+vpW, FLOOR_Y); ctx.stroke();

    // Distant background
    this._drawMountains(ctx, panX, vpW);

    // Castles
    CASTLES.forEach((c, idx) => {
      const p = this.players[idx];
      const r = p.hp / 100;
      
      // Castle base
      ctx.fillStyle = '#222';
      ctx.fillRect(c.x - c.w/2, FLOOR_Y - c.h, c.w, c.h);
      ctx.fillStyle = '#444';
      ctx.fillRect(c.x - c.w/2 + 10, FLOOR_Y - c.h + 20, c.w - 20, c.h - 20);

      // Flag
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x - c.w/2, FLOOR_Y - c.h - 40, 4, 40);
      ctx.beginPath(); ctx.moveTo(c.x - c.w/2 + 4, FLOOR_Y - c.h - 40);
      ctx.lineTo(c.x - c.w/2 + 40, FLOOR_Y - c.h - 30);
      ctx.lineTo(c.x - c.w/2 + 4, FLOOR_Y - c.h - 20); ctx.fill();

      // Mini Health Bar above castle
      ctx.fillStyle = '#111'; ctx.fillRect(c.x - 40, FLOOR_Y - c.h - 60, 80, 8);
      ctx.fillStyle = c.color; ctx.fillRect(c.x - 40, FLOOR_Y - c.h - 60, 80 * r, 8);

      // Trajectory (only draw for yourself if alive)
      if (viewer === p && p.hp > 0 && !p.trackingProj && p.ammo > 0) {
        ctx.strokeStyle = p.color + '66';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        const v = lerp(600, 1600, p.power / 100);
        const rad = p.angle * (Math.PI / 180);
        const px = c.x + c.dir*(c.w/2 + 20);
        let py = FLOOR_Y - c.h + 50;
        let lx = px, ly = py;
        let tvx = Math.cos(rad) * v * c.dir;
        let tvy = -Math.sin(rad) * v;
        ctx.moveTo(lx, ly);
        for(let t=0; t<1.5; t+=0.05) {
          lx = px + tvx * t;
          ly = py + tvy * t + 0.5 * GRAVITY * t * t;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke(); ctx.setLineDash([]);
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Outfit'; ctx.textAlign='center';
        ctx.fillText(`A:${Math.round(p.angle)}° / P:${Math.round(p.power)}%`, px + c.dir*40, py - 20);
      }
    });

    // Projectiles
    this.projectiles.forEach(proj => {
      // Trail
      if (proj.trail.length > 0) {
        ctx.beginPath();
        ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
        proj.trail.forEach(pt => ctx.lineTo(pt.x, pt.y));
        ctx.strokeStyle = CASTLES[proj.ownerId].color + 'aa';
        ctx.lineWidth = 4; ctx.stroke();
      }
      
      if (!proj.dead) {
        ctx.fillStyle = '#999';
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 8, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth=2; ctx.stroke();
      }
    });

    // Particles
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _drawMountains(ctx, panX, vpW) {
    ctx.fillStyle = '#101622';
    // Parallax mountains
    for(let i=0; i<8; i++) {
      const mx = (i * 400) - (panX * 0.2) % 400;
      if (mx > vpW || mx+300 < 0) continue;
      ctx.beginPath();
      ctx.moveTo(mx, FLOOR_Y);
      ctx.lineTo(mx + 150, FLOOR_Y - 200 - (i%2)*100);
      ctx.lineTo(mx + 300, FLOOR_Y);
      ctx.fill();
    }
  }

  _drawHUD(ctx, player, absX, vpW) {
    // We are drawn in un-translated viewport space [0, vpW]
    const hpRatio = player.hp / 100;

    // Flash overlay
    if (player.flash > 0) {
      ctx.fillStyle = player.flashColor;
      ctx.globalAlpha = player.flash * 0.4;
      ctx.fillRect(0,0,vpW,this.H);
      ctx.globalAlpha = 1;
    }

    // Top Bar (HP & Ammo)
    ctx.fillStyle = 'rgba(10,15,25,0.8)';
    ctx.fillRect(0, 0, vpW, 60);

    ctx.fillStyle = '#333';
    ctx.fillRect(20, 20, vpW - 120, 20);
    ctx.fillStyle = player.color;
    ctx.fillRect(20, 20, (vpW - 120) * hpRatio, 20);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, vpW - 120, 20);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Outfit';
    ctx.textAlign = 'right'; ctx.textBaseline='middle';
    ctx.fillText(`🪨 ${player.ammo}`, vpW - 20, 30);

    // Controls Reminder
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px Outfit';
    ctx.textAlign = 'left';
    const aimText = player.id === 0 ? '[W/S] Aim  [A/D] Power  [SPACE] Fire' : '[↑/↓] Aim  [←/→] Power  [ENTER] Fire';
    ctx.fillText(aimText, 20, 50);

    // Stun / Death overlay
    if (player.hp <= 0) {
      ctx.fillStyle = 'rgba(255,0,0,0.3)';
      ctx.fillRect(0,0,vpW,this.H);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 48px Outfit'; ctx.textAlign='center';
      ctx.fillText('DESTROYED', vpW/2, this.H/2);
      return;
    }

    if (player.stunTimer > 0) {
      ctx.fillStyle = '#ff2222'; ctx.font = 'bold 24px Outfit'; ctx.textAlign='center';
      ctx.fillText(`RELOADING (${player.stunTimer.toFixed(1)}s)`, vpW/2, this.H - 120);
      return; 
    }

    // MATH HUD
    if (player.problem && !player.trackingProj) {
      const mh = 110;
      const my = this.H - mh - 20;
      
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.beginPath(); ctx.roundRect(vpW/2 - 200, my, 400, mh, 12); ctx.fill();
      ctx.strokeStyle = player.color + 'aa'; ctx.lineWidth=2; ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 36px Outfit'; ctx.textAlign = 'center';
      ctx.fillText(player.problem.text, vpW/2, my + 45);

      // Buttons
      const opts = player.problem.options;
      const keys = [''+player.keys.math[0].slice(-1), ''+player.keys.math[1].slice(-1), ''+player.keys.math[2].slice(-1)];
      
      for(let i=0; i<3; i++) {
        const bx = vpW/2 - 130 + (i*130);
        const by = my + 80;
        
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.roundRect(bx - 55, by - 20, 110, 40, 6); ctx.fill();
        
        ctx.fillStyle = '#aaa';
        ctx.font = '12px Outfit';
        ctx.fillText(`[${keys[i]}]`, bx - 35, by);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Outfit';
        ctx.fillText(opts[i], bx + 10, by);
      }
    }
  }

  _drawMenuDecor(ctx) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    for(let i=0; i<this.W; i+=60) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,this.H); ctx.stroke(); }
    for(let i=0; i<this.H; i+=60) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(this.W,i); ctx.stroke(); }
  }
}

window.addEventListener('DOMContentLoaded', () => { new CastleDuel(); });
