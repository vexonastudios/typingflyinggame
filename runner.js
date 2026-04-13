'use strict';

// ─────────────────────────────────────────────
// Audio Engine
// ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  resume: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
  playTone: (freq, type, dur, vol=0.1) => {
    try {
      Sfx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch(e) {}
  },
  jump: ()    => Sfx.playTone(300, 'square', 0.15, 0.05),
  coin: ()    => { Sfx.playTone(800, 'sine', 0.1, 0.1); setTimeout(()=>Sfx.playTone(1200, 'sine', 0.15, 0.1), 50); },
  stomp: ()   => Sfx.playTone(150, 'triangle', 0.15, 0.1),
  correct: () => { Sfx.playTone(600, 'sine', 0.1, 0.1); setTimeout(()=>Sfx.playTone(800, 'sine', 0.15, 0.1), 100); },
  wrong: ()   => Sfx.playTone(200, 'sawtooth', 0.3, 0.1),
  win: ()     => {
    Sfx.playTone(400, 'sine', 0.15, 0.1);
    setTimeout(() => Sfx.playTone(500, 'sine', 0.15, 0.1), 150);
    setTimeout(() => Sfx.playTone(600, 'sine', 0.4,  0.1), 300);
  }
};

// ─────────────────────────────────────────────
// Vocabulary Prompts
// ─────────────────────────────────────────────
const PROMPTS = [
  { q: "Means 'again'", a: "re-", w: ["un-", "pre-"] },
  { q: "Meaning 'large'", a: "huge", w: ["tiny", "soft"] },
  { q: "Opposite of 'always'", a: "never", w: ["often", "rare"] },
  { q: "Very happy", a: "joyful", w: ["angry", "sad"] },
  { q: "Means 'before'", a: "pre-", w: ["post-", "re-"] },
  { q: "To mix together", a: "blend", w: ["break", "cut"] },
  { q: "Extremely hot", a: "boiling", w: ["chilly", "mild"] },
  { q: "A deep hole", a: "pit", w: ["hill", "cloud"] },
  { q: "To move quickly", a: "dash", w: ["crawl", "rest"] },
  { q: "Without fear", a: "brave", w: ["weak", "scared"] }
];

function intersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ─────────────────────────────────────────────
// World Runner Engine
// ─────────────────────────────────────────────
const CW = 1200;
const CH = 600;

class WordRunner {
  constructor() {
    this.canvas = document.getElementById('runnerCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.keys = {};
    window.addEventListener('keydown', e => this.keys[e.key] = true);
    window.addEventListener('keyup',   e => this.keys[e.key] = false);

    document.getElementById('startMissionBtn').addEventListener('click', () => {
      document.getElementById('gameSetup').style.display = 'none';
      Sfx.resume();
      this.startGame();
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      if (this.gameIsOver || this.currentLevel >= 3) {
         this.startGame(1);
      } else {
         this.startGame(this.currentLevel + 1);
      }
    });

    this.state = 'setup'; // setup, playing, end
    this.currentLevel = 1;
    this.gameIsOver = false;

    this.platforms = [];
    this.coins = [];
    this.enemies = [];
    this.gates = [];
    this.sparks = [];
    this.players = [];
    this.cameraX = 0;

    requestAnimationFrame((ts) => this._loop(ts));
  }

  startGame(level = 1) {
    this.currentLevel = level;
    this.state = 'playing';
    this.gameIsOver = false;
    if (level === 1) this.score = 0;

    document.getElementById('startMissionBtn').textContent = `Start Level ${level}`;

    this.platforms = [];
    this.coins = [];
    this.enemies = [];
    this.gates = [];
    this.sparks = [];
    this.cameraX = 0;

    // Players
    this.players = [
      { id: 1, lives: 3, x: 50,  y: 300, w: 32, h: 48, vx: 0, vy: 0, color: '#3b9eff', grounded: false, up:'w', left:'a', right:'d', dead: false },
      { id: 2, lives: 3, x: 100, y: 300, w: 32, h: 48, vx: 0, vy: 0, color: '#ff4d4d', grounded: false, up:'ArrowUp', left:'ArrowLeft', right:'ArrowRight', dead: false }
    ];

    this._updateScore();
    this._generateLevel();
  }

  _generateLevel() {
    let px = 0;
    let diff = this.currentLevel - 1; // 0, 1, 2
    let gateCount = 5 + (diff * 2); 
    
    // Start pad
    this.platforms.push({ x: -200, y: 500, w: 600, h: 100, active: true });
    px += 400;

    // Shuffle prompts for variety
    const levelPrompts = [...PROMPTS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < gateCount; i++) {
       // 1. Jump Section
       let gap = 150 + Math.random() * 50 + (diff * 35);
       let platW = Math.max(300, 700 - (diff * 150));
       this.platforms.push({ x: px + gap, y: 500, w: platW, h: 100, active: true });
       for(let j=0; j<3; j++) this.coins.push({ x: px + gap + (platW/2) - 60 + j*60, y: 380, w:20, h:20, collected: false });
       
       // More enemies on higher levels
       for(let j=0; j<=diff; j++) {
           this.enemies.push({ x: px + gap + platW/2 + j*80, y: 460, w: 36, h: 40, vx: -50 - (diff*20), startX: px+gap+50, endX: px+gap+platW-50, dead: false });
       }
       px += gap + platW;

       // 2. Stairs / Platforms (Make gaps harder)
       gap = 100 + (diff * 30);
       let stepW = Math.max(80, 150 - (diff * 25));
       this.platforms.push({ x: px + gap, y: 400, w: stepW, h: 200, active: true });
       this.platforms.push({ x: px + gap + stepW + (diff*20), y: 300, w: stepW, h: 300, active: true });
       for(let j=0; j<2; j++) this.coins.push({ x: px + gap + (stepW) + j*50, y: 200, w:20, h:20, collected: false });
       px += gap + (stepW*2) + (diff*20);

       // 3. Gap to Gate Approach
       gap = 180 + (diff * 40);
       this.platforms.push({ x: px + gap, y: 450, w: 900, h: 150, active: true });
       px += gap;

       // 4. GATE
       let prompt = levelPrompts[i % levelPrompts.length];
       let answers = [prompt.a, prompt.w[0], prompt.w[1]];
       answers.sort(() => Math.random() - 0.5);

       let gateWall = { x: px + 700, y: 0, w: 40, h: 450, active: true, isGate: true };
       this.platforms.push(gateWall);

       this.gates.push({
         prompt: prompt.q,
         blocks: [
           { x: px + 200, y: 300, w: 80, h: 50, text: answers[0], isCorrect: answers[0]===prompt.a, hit: false },
           { x: px + 350, y: 300, w: 80, h: 50, text: answers[1], isCorrect: answers[1]===prompt.a, hit: false },
           { x: px + 500, y: 300, w: 80, h: 50, text: answers[2], isCorrect: answers[2]===prompt.a, hit: false }
         ],
         wall: gateWall,
         cleared: false
       });

       px += 900;
    }

    // 5. Goal
    let gap = 150;
    this.platforms.push({ x: px + gap, y: 500, w: 800, h: 100, active: true });
    this.goalFlag = { x: px + gap + 400, y: 150, w: 20, h: 350 };
  }

  _hitBlock(gate, block) {
    if (block.hit) return;
    block.hit = true;
    if (block.isCorrect) {
       Sfx.correct();
       gate.cleared = true;
       gate.wall.active = false;
       this.score += 100 * this.currentLevel;
       // Spawn confetti
       for(let i=0; i<15; i++) {
         this.sparks.push({
           x: block.x + block.w/2, y: block.y,
           vx: (Math.random()-0.5)*200, vy: -100 - Math.random()*200,
           col: '#2ec97a', life: 1.0 + Math.random()
         });
       }
    } else {
       Sfx.wrong();
       this.score = Math.max(0, this.score - 20);
       // Spaen red sparks
       for(let i=0; i<5; i++) {
         this.sparks.push({
           x: block.x + block.w/2, y: block.y + block.h,
           vx: (Math.random()-0.5)*100, vy: Math.random()*100,
           col: '#e84040', life: 0.5
         });
       }
    }
    this._updateScore();
  }

  _killPlayer(p) {
    if (p.dead) return;
    p.lives--;
    Sfx.wrong();
    this.score = Math.max(0, this.score - 50);
    this._updateScore();

    if (p.lives <= 0) {
       p.dead = true;
       // check if both dead
       if (this.players.every(pl => pl.dead)) {
          this.gameIsOver = true;
          this.state = 'end';
          document.getElementById('endTitle').textContent = "Game Over!";
          document.getElementById('endTitle').style.color = "#e84040";
          document.getElementById('endMessage').textContent = "Both players ran out of lives.";
          document.getElementById('playAgainBtn').textContent = "Restart Game";
          document.getElementById('gameEnd').style.display = 'flex';
       }
    } else {
       // Respawn safely near camera edge but on highest active ground
       p.x = this.cameraX + 150;
       p.y = -50;
       p.vx = 0; p.vy = 0;
    }
  }

  _updateScore() {
    document.getElementById('scoreDisplay').textContent = this.score;
    if (this.players && this.players.length > 1) {
       document.getElementById('p1Lives').textContent = this.players[0].lives;
       document.getElementById('p2Lives').textContent = this.players[1].lives;
    }
  }

  _update(dt) {
    if (this.state !== 'playing') return;

    // Sparks
    this.sparks = this.sparks.filter(s => {
       s.x += s.vx * dt;
       s.y += s.vy * dt;
       s.vy += 600 * dt; // gravity
       s.life -= dt;
       return s.life > 0;
    });

    // Camera (Tracks players but never goes backwards)
    let avgX = (this.players[0].x + this.players[1].x) / 2;
    this.cameraX = Math.max(this.cameraX, avgX - 400);

    // Players
    for(let p of this.players) {
       // Input
       let accel = 1200;
       let friction = 0.82;
       let maxV = 350;

       if (this.keys[p.left])  p.vx -= accel * dt;
       if (this.keys[p.right]) p.vx += accel * dt;
       if (!this.keys[p.left] && !this.keys[p.right]) p.vx *= friction;

       p.vx = Math.max(-maxV, Math.min(maxV, p.vx));

       // X step
       p.x += p.vx * dt;
       
       // Keep player bound to camera left edge
       if (p.x < this.cameraX) { p.x = this.cameraX; p.vx = 0; }

       // X Collision
       for(let plat of this.platforms) {
          if (!plat.active) continue;
          if (intersect(p, plat)) {
             if (p.vx > 0) p.x = plat.x - p.w;
             else p.x = plat.x + plat.w;
             p.vx = 0;
          }
       }

       // Y Step
       p.vy += 1500 * dt; // gravity
       p.y += p.vy * dt;
       p.grounded = false;

       // Y Collision
       for(let plat of this.platforms) {
          if (!plat.active) continue;
          if (intersect(p, plat)) {
             if (p.vy > 0) { // falling
                p.y = plat.y - p.h;
                p.vy = 0;
                p.grounded = true;
             } else { // hit ceiling
                p.y = plat.y + plat.h;
                p.vy = 0;
             }
          }
       }

       // Jump
       if (this.keys[p.up] && p.grounded) {
          p.vy = -750;
          p.grounded = false;
          Sfx.jump();
       }

       // Block Collision
       for(let gate of this.gates) {
         if (gate.cleared) continue;
         for(let b of gate.blocks) {
            if (intersect(p, b)) {
               if (p.vy > 0 && p.y + p.h - p.vy*dt <= b.y) {
                 // Stand on top
                 p.y = b.y - p.h; p.vy = 0; p.grounded = true;
               } else if (p.vy < 0 && p.y - p.vy*dt >= b.y + b.h) {
                 // Hit from below
                 p.y = b.y + b.h; p.vy = 0;
                 this._hitBlock(gate, b);
               } else {
                 // Push horizontally
                 if (p.vx > 0) p.x = b.x - p.w;
                 else p.x = b.x + b.w;
                 p.vx = 0;
               }
            }
         }
       }

       // Death plane
       if (p.y > CH + 100) {
          this._killPlayer(p);
       }

       // Coins
       for(let c of this.coins) {
          if(!c.collected && intersect(p, c)) {
             c.collected = true;
             this.score += 10;
             this._updateScore();
             Sfx.coin();
          }
       }

       // Goal
       if (!p.dead && Math.abs(p.x - this.goalFlag.x) < 30) {
          this.state = 'end';
          Sfx.win();
          this.gameIsOver = false;
          if (this.currentLevel < 3) {
             document.getElementById('endTitle').textContent = `Level ${this.currentLevel} Complete!`;
             document.getElementById('endTitle').style.color = "#2ec97a";
             document.getElementById('playAgainBtn').textContent = `Start Level ${this.currentLevel + 1}`;
          } else {
             document.getElementById('endTitle').textContent = "You Beat the Game!";
             document.getElementById('endTitle').style.color = "#ffd060";
             document.getElementById('playAgainBtn').textContent = "Play Again";
          }
          document.getElementById('endMessage').textContent = `Fantastic run! Score so far: ${this.score}`;
          document.getElementById('gameEnd').style.display = 'flex';
       }
    }

    // Enemies
    for(let e of this.enemies) {
       if (e.dead) continue;
       e.x += e.vx * dt;
       if (e.x < e.startX || e.x > e.endX) e.vx *= -1;

       for(let p of this.players) {
          if (intersect(p, e)) {
             // Stomped?
             if (p.vy > 0 && p.y + p.h - p.vy*dt <= e.y + 15) {
                e.dead = true;
                p.vy = -500; // bounce off enemies
                this.score += 50;
                this._updateScore();
                Sfx.stomp();
             } else {
                this._killPlayer(p);
             }
          }
       }
    }
  }

  _draw() {
    this.ctx.clearRect(0,0,CW,CH);
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);

    // Parallax background elements
    this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for(let i=0; i<20; i++) {
       let cx = ((i * 800) - (this.cameraX * 0.3)) % (CW*3) - 200;
       this.ctx.beginPath(); this.ctx.arc(cx, 150 + Math.sin(i)*50, 60+Math.sin(i)*20, 0, Math.PI*2); this.ctx.fill();
    }

    // Goal Flag
    if (this.goalFlag) {
      this.ctx.fillStyle = '#cbd5e1';
      this.ctx.fillRect(this.goalFlag.x, this.goalFlag.y, this.goalFlag.w, this.goalFlag.h);
      this.ctx.fillStyle = '#2ec97a';
      this.ctx.beginPath();
      this.ctx.moveTo(this.goalFlag.x + this.goalFlag.w, this.goalFlag.y);
      this.ctx.lineTo(this.goalFlag.x + this.goalFlag.w + 60, this.goalFlag.y + 30);
      this.ctx.lineTo(this.goalFlag.x + this.goalFlag.w, this.goalFlag.y + 60);
      this.ctx.fill();
    }

    // Platforms
    for(let p of this.platforms) {
       if (!p.active) continue;
       
       if (p.isGate) {
         this.ctx.fillStyle = '#ff4db8';
         this.ctx.fillRect(p.x, p.y, p.w, p.h);
         // Gate bars
         this.ctx.fillStyle = '#000';
         this.ctx.globalAlpha = 0.2;
         for(let y=p.y; y<p.y+p.h; y+=20) this.ctx.fillRect(p.x, y, p.w, 8);
         this.ctx.globalAlpha = 1.0;
       } else {
         this.ctx.fillStyle = '#64748b'; // stone body
         this.ctx.fillRect(p.x, p.y, p.w, p.h);
         this.ctx.fillStyle = '#475569';
         this.ctx.fillRect(p.x, p.y+15, p.w, p.h-15);
         this.ctx.fillStyle = '#2ec97a'; // grass top
         this.ctx.fillRect(p.x, p.y, p.w, 15);
       }
    }

    // Gates
    this.ctx.textAlign = 'center';
    for(let gate of this.gates) {
       if (gate.cleared) continue;

       // Prompt
       let cx = gate.blocks[1].x + gate.blocks[1].w/2;
       this.ctx.fillStyle = '#1a2235';
       this.ctx.beginPath(); this.ctx.roundRect(cx - 150, 150, 300, 60, 10); this.ctx.fill();
       this.ctx.fillStyle = '#ff4db8';
       this.ctx.font = '700 24px Outfit';
       this.ctx.fillText(gate.prompt, cx, 188);

       // Blocks
       this.ctx.font = '800 20px monospace';
       for(let b of gate.blocks) {
          if (b.hit && !b.isCorrect) continue; // broken
          this.ctx.fillStyle = b.hit ? '#2ec97a' : '#ffd060';
          this.ctx.fillRect(b.x, b.y, b.w, b.h);
          
          this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
          this.ctx.fillRect(b.x, b.y+b.h-8, b.w, 8); // block shadow
          
          this.ctx.fillStyle = '#111';
          this.ctx.fillText(b.text, b.x + b.w/2, b.y + 32);
       }
    }

    // Coins
    this.ctx.fillStyle = '#ffd060';
    for(let c of this.coins) {
       if (c.collected) continue;
       this.ctx.beginPath();
       this.ctx.arc(c.x + c.w/2, c.y + c.h/2, c.w/2, 0, Math.PI*2);
       this.ctx.fill();
       this.ctx.fillStyle = '#cca340';
       this.ctx.beginPath();
       this.ctx.arc(c.x + c.w/2, c.y + c.h/2, c.w/4, 0, Math.PI*2);
       this.ctx.fill();
       this.ctx.fillStyle = '#ffd060';
    }

    // Enemies
    this.ctx.fillStyle = '#e84040';
    for(let e of this.enemies) {
       if (e.dead) continue;
       this.ctx.beginPath();
       this.ctx.roundRect(e.x, e.y, e.w, e.h, 6);
       this.ctx.fill();
       // Eyes
       this.ctx.fillStyle = '#fff';
       let dirX = e.vx > 0 ? 5 : -5;
       this.ctx.fillRect(e.x + e.w/2 - 8 + dirX, e.y + 10, 6, 6);
       this.ctx.fillRect(e.x + e.w/2 + 2 + dirX, e.y + 10, 6, 6);
       this.ctx.fillStyle = '#e84040';
    }

    // Sparks
    for(let s of this.sparks) {
       this.ctx.fillStyle = s.col;
       this.ctx.globalAlpha = Math.min(1.0, s.life);
       this.ctx.beginPath();
       this.ctx.arc(s.x, s.y, 4, 0, Math.PI*2);
       this.ctx.fill();
       this.ctx.globalAlpha = 1.0;
    }

    // Players
    for(let p of this.players) {
       // Body
       this.ctx.fillStyle = p.color;
       this.ctx.beginPath();
       this.ctx.roundRect(p.x, p.y, p.w, p.h, 8);
       this.ctx.fill();

       // Visor / eyes
       this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
       let lookX = p.vx > 10 ? 8 : (p.vx < -10 ? -8 : 0);
       this.ctx.fillRect(p.x + 8 + lookX, p.y + 12, 16, 8);
       
       // Player indicator
       this.ctx.fillStyle = '#fff';
       this.ctx.font = '600 14px Outfit';
       this.ctx.fillText(`P${p.id}`, p.x + p.w/2, p.y - 10);
    }

    this.ctx.restore();
  }

  _loop(ts) {
    const dt = Math.min((ts - (this.lastTs || ts)) / 1000, 0.05);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame((ts) => this._loop(ts));
  }
}

window.addEventListener('DOMContentLoaded', () => { new WordRunner(); });
