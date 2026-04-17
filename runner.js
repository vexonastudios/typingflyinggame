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
const PROMPTS = {
  Easy: [
    { q: "Solve: 5 + 4", a: "9", w: ["8", "10"] },
    { q: "Solve: 10 - 3", a: "7", w: ["6", "8"] },
    { q: "Solve: 8 + 8", a: "16", w: ["15", "14"] },
    { q: "Solve: 12 - 5", a: "7", w: ["6", "8"] },
    { q: "Solve: 20 + 5", a: "25", w: ["15", "30"] },
    { q: "Plural of 'cat'", a: "cats", w: ["cates", "cat"] },
    { q: "Plural of 'box'", a: "boxes", w: ["boxs", "boox"] },
    { q: "Rhymes with 'bat'", a: "cat", w: ["dog", "bird"] },
    { q: "Rhymes with 'hop'", a: "pop", w: ["step", "jump"] },
    { q: "Rhymes with 'run'", a: "sun", w: ["rain", "walk"] }
  ],
  Medium: [
    { q: "Solve: 6 x 4", a: "24", w: ["20", "28"] },
    { q: "Solve: 8 x 7", a: "56", w: ["54", "64"] },
    { q: "Solve: 36 / 6", a: "6", w: ["4", "8"] },
    { q: "Solve: 9 x 9", a: "81", w: ["72", "90"] },
    { q: "Synonym for 'huge'", a: "giant", w: ["tiny", "flat"] },
    { q: "Synonym for 'rapid'", a: "fast", w: ["slow", "heavy"] },
    { q: "Antonym for 'always'", a: "never", w: ["often", "rarely"] },
    { q: "Antonym for 'create'", a: "destroy", w: ["build", "make"] },
    { q: "Past tense of 'run'", a: "ran", w: ["runned", "running"] },
    { q: "Past tense of 'eat'", a: "ate", w: ["eated", "eaten"] }
  ],
  Hard: [
    { q: "Solve: 4x = 32", a: "8", w: ["6", "7"] },
    { q: "Solve: 3x + 2 = 17", a: "5", w: ["4", "6"] },
    { q: "Solve: 100 / 4", a: "25", w: ["20", "30"] },
    { q: "Solve: 5(2 + 3)", a: "25", w: ["10", "15"] },
    { q: "Prefix meaning 'against'", a: "anti-", w: ["pro-", "co-"] },
    { q: "Prefix meaning 'before'", a: "pre-", w: ["post-", "re-"] },
    { q: "Which is a noun?", a: "courage", w: ["brave", "quickly"] },
    { q: "Which is a verb?", a: "sprint", w: ["fast", "runner"] },
    { q: "Which is an adjective?", a: "shiny", w: ["shine", "glowing"] },
    { q: "Plural of 'mouse'", a: "mice", w: ["mouses", "meece"] }
  ]
};

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
      this.currentDifficulty = document.getElementById('diffSelect').value;
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
    this.projectiles = [];
    this.hearts = [];
    this.spikes = [];
    this.powerups = [];
    this.levelTime = 0;
    this.bossPhase = false;
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
    this.projectiles = [];
    this.hearts = [];
    this.spikes = [];
    this.powerups = [];
    this.levelTime = 0;
    this.bossPhase = false;
    this.cameraX = 0;

    // Players
    this.players = [
      { id: 1, lives: 3, coinsCollected: 0, x: 50,  y: 300, w: 32, h: 48, vx: 0, vy: 0, color: '#3b9eff', grounded: false, up:'w', left:'a', right:'d', dead: false, jumpCount: 0, invincibleTimer: 0, bootTimer: 0, animTime: 0, squash: 1 },
      { id: 2, lives: 3, coinsCollected: 0, x: 100, y: 300, w: 32, h: 48, vx: 0, vy: 0, color: '#ff4d4d', grounded: false, up:'ArrowUp', left:'ArrowLeft', right:'ArrowRight', dead: false, jumpCount: 0, invincibleTimer: 0, bootTimer: 0, animTime: 0, squash: 1 }
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
    const levelPrompts = [...PROMPTS[this.currentDifficulty || 'Medium']].sort(() => Math.random() - 0.5);

    for (let i = 0; i < gateCount; i++) {
       // 1. Jump Section (Rebalanced + Island)
       let gap = 160 + Math.random() * 40 + (diff * 15); // Reverted to engaging playable distance
       let platW = Math.max(300, 700 - (diff * 150));
       
       // Inject small vertical moving island precisely in the middle of gap
       let islandSpeed = 80 + (diff * 20);
       let island = { 
           x: px + (gap/2) - 40, 
           y: 450, 
           w: 80, 
           h: 30, 
           active: true, 
           moveY: true, 
           speed: islandSpeed, 
           startY: 450, 
           endY: 300, 
           startX: px + (gap/2) - 40, 
           endX: px + (gap/2) - 40, 
           vx: 0, 
           vy: -islandSpeed 
       };
       this.platforms.push(island);

       // Main landing platform
       this.platforms.push({ x: px + gap, y: 500, w: platW, h: 100, active: true });
       for(let j=0; j<3; j++) this.coins.push({ x: px + gap + (platW/2) - 60 + j*60, y: 380, w:20, h:20, collected: false });
       if (Math.random() < 0.3) {
           this.hearts.push({ x: px + gap + (platW/2), y: 320, w: 20, h: 20, collected: false });
       }
       if (Math.random() < 0.15) {
           let type = Math.random() < 0.5 ? 'star' : 'boots';
           this.powerups.push({ type: type, x: px + gap + (platW/2) + 30, y: 320, w: 24, h: 24, active: true });
       }
       
       // More enemies on higher levels
       for(let j=0; j<=diff; j++) {
           let r = Math.random();
           if (this.currentLevel > 1 && r < 0.2) {
               this.enemies.push({ type: 'shooter', x: px + gap + platW - 100 - j*40, y: 450, w: 36, h: 50, shootTimer: Math.random(), dead: false });
           } else if (this.currentLevel > 1 && r < 0.4) {
               this.enemies.push({ type: 'flyer', x: px + gap + 100, y: 300, w: 36, h: 30, vx: -100, startX: px+gap+50, endX: px+gap+platW-50, startY: 300, flyOffset: Math.random()*10, dead: false });
           } else if (this.currentLevel > 1 && r < 0.6) {
               this.enemies.push({ type: 'chaser', x: px + gap + platW/2 + j*70, y: 460, w: 36, h: 40, vx: 0, dead: false });
           } else if (this.currentLevel > 1 && r < 0.8) {
               let py = 150 + Math.random()*100;
               this.enemies.push({ type: 'pacer', x: px + gap + 100 + j*100, y: py, w: 40, h: 40, vy: 120, startY: py, endY: py + 250, dead: false });
           } else {
               this.enemies.push({ type: 'walker', x: px + gap + platW/2 + j*80, y: 460, w: 36, h: 40, vx: -50 - (diff*20), startX: px+gap+50, endX: px+gap+platW-50, dead: false });
           }
       }
       px += gap + platW;

       // 2. Stairs / Platforms (Make gaps easier, add enemies here)
       gap = 100 + (diff * 15);
       let stepW = Math.max(70, 130 - (diff * 20));
       this.platforms.push({ x: px + gap, y: 400, w: stepW, h: 200, active: true });
       // Add spike on top of first step natively
       if (this.currentLevel >= 2 && Math.random() < 0.5) {
           this.spikes.push({ x: px + gap + 10, y: 385, w: stepW - 20, h: 15 }); // Top anchored
       }
       
       let p2x = px + gap + stepW + 80 + (diff*20);
       this.platforms.push({ x: p2x, y: 300, w: stepW, h: 300, active: true });
       for(let j=0; j<2; j++) this.coins.push({ x: px + gap + (stepW) + j*50, y: 200, w:20, h:20, collected: false });
       
       // Add a shooter on top of the high step
       if (this.currentLevel >= 2 && Math.random() < 0.6) {
           this.enemies.push({ type: 'shooter', x: p2x + stepW/2 - 18, y: 250, w: 36, h: 50, shootTimer: 0, dead: false });
       }
       
       px += gap + (stepW*2) + 80 + (diff*20);

       // 3. Gap to Gate Approach (Fragmented Moving Islands for Intensity)
       gap = 120 + (diff * 15); // Reverted to standard intensity
       
       let numIslands = 1;
       if (this.currentLevel === 2) numIslands = 2;
       if (this.currentLevel === 3) numIslands = 3;
       
       islandSpeed = 90 + (diff * 25);
       let blockSpacing = 160 + (diff * 10); // Safe static distance
       
       for(let k=0; k < numIslands; k++) {
           // Restrict to vertical movement only to stop impossible horizontal drift gaps!
           let island = { x: px + gap + (k * blockSpacing), y: 420 - (k*30), w: 120, h: 50, active: true };
           
           island.moveY = true;
           island.speed = islandSpeed;
           island.startY = island.y; island.endY = island.y - 200;
           island.startX = island.x; 
           island.endX = island.x; 
           island.vx = 0;
           island.vy = -islandSpeed;
           this.platforms.push(island);
           
           // Put a coin or chaser on the island
           if (Math.random() < 0.4 && k === numIslands-1) {
              this.enemies.push({ type: 'chaser', x: island.x + 40, y: island.y - 40, w: 36, h: 40, vx: 0, dead: false });
           } else {
              this.coins.push({ x: island.x + 50, y: island.y - 40, w:20, h:20, collected: false });
              // add a 2nd coin for better economy scaling
              this.coins.push({ x: island.x + 75, y: island.y - 40, w:20, h:20, collected: false });
           }
       }
       
       // Fixed safety landing right before gate
       let safetyX = px + gap + (numIslands * blockSpacing);
       let safetyY = 450;
       
       // 4. GATE
       let prompt = levelPrompts[i % levelPrompts.length];
       let answers = [prompt.a, prompt.w[0], prompt.w[1]];
       answers.sort(() => Math.random() - 0.5);

       // Gate wall
       let gateWall = { x: safetyX + 600, y: 0, w: 40, h: 450, active: true, isGate: true };
       this.platforms.push(gateWall);

       // Safety pad now perfectly spans underneath all blocks AND the gate wall so no one falls to their death
       this.platforms.push({ x: safetyX, y: safetyY, w: 800, h: 150, active: true });

       this.gates.push({
         prompt: prompt.q,
         blocks: [
           { x: safetyX + 150, y: 300, w: 80, h: 50, text: answers[0], isCorrect: answers[0]===prompt.a, hit: false },
           { x: safetyX + 300, y: 300, w: 80, h: 50, text: answers[1], isCorrect: answers[1]===prompt.a, hit: false },
           { x: safetyX + 450, y: 300, w: 80, h: 50, text: answers[2], isCorrect: answers[2]===prompt.a, hit: false }
         ],
         wall: gateWall,
         cleared: false
       });

       px = safetyX + 800;
    }

    // 5. Goal / Boss Phase Check
    let gap = 150;
    this.platforms.push({ x: px + gap, y: 500, w: 1200, h: 100, active: true });
    
    if (this.currentLevel >= 3) {
       this.bossPhase = true;
       this.bossHealth = 3;
       
       this.bossEntity = { x: px + gap + 1000, y: 250, w: 150, h: 150, active: true, shootTimer: 0 };
       
       let prompt = levelPrompts[0];
       let answers = [prompt.a, prompt.w[0], prompt.w[1]].sort(() => Math.random() - 0.5);
       
       this.bossGate = {
         prompt: prompt.q,
         blocks: [
           { x: px + gap + 300, y: 300, w: 100, h: 50, text: answers[0], isCorrect: answers[0]===prompt.a, hit: false },
           { x: px + gap + 500, y: 300, w: 100, h: 50, text: answers[1], isCorrect: answers[1]===prompt.a, hit: false },
           { x: px + gap + 700, y: 300, w: 100, h: 50, text: answers[2], isCorrect: answers[2]===prompt.a, hit: false }
         ]
       };
       this.goalFlag = null; // No flag until boss dies
    } else {
       this.goalFlag = { x: px + gap + 600, y: 150, w: 20, h: 350 };
    }
  }

  _hitBlock(gate, block, player) {
    if (block.hit) return;
    block.hit = true;
    if (block.isCorrect) {
       Sfx.correct();
       gate.cleared = true;
       gate.wall.active = false;
       this.score += 100 * this.currentLevel;
       
       // REVIVE Dead Teammates
       let revived = false;
       for(let p of this.players) {
           if (p.dead) {
               p.dead = false;
               p.lives = 1;
               p.x = this.cameraX + 150;
               p.y = -50;
               p.vx = 0; p.vy = 0;
               revived = true;
           }
       }
       if (revived) Sfx.win(); // special sound for revive
       
       // Spawn confetti
       for(let i=0; i<15; i++) {
         this.sparks.push({
           x: block.x + block.w/2, y: block.y,
           vx: (Math.random()-0.5)*200, vy: -100 - Math.random()*200,
           col: '#2ec97a', life: 1.0 + Math.random()
         });
       }
    } else {
       // Wrong guess penalty
       Sfx.wrong();
       this._killPlayer(player);
       
       // Spawn red sparks
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

  _hitBossBlock(block, player) {
    if (block.hit) return;
    block.hit = true;
    if (block.isCorrect) {
       Sfx.correct();
       this.bossHealth--;
       this.score += 500;
       this._updateScore();

       // Sparks
       for(let i=0; i<15; i++) {
         this.sparks.push({ x: block.x + block.w/2, y: block.y, vx: (Math.random()-0.5)*200, vy: -100 - Math.random()*200, col: '#facc15', life: 1.0 + Math.random() });
       }
       
       if (this.bossHealth <= 0) {
          // Boss dead, spawn goal!
          this.bossEntity.active = false;
          Sfx.win();
          this.goalFlag = { x: this.bossEntity.x, y: 150, w: 20, h: 350 };
       } else {
          // Load next question
          const levelPrompts = [...PROMPTS[this.currentDifficulty || 'Medium']].sort(() => Math.random() - 0.5);
          let prompt = levelPrompts[0];
          let answers = [prompt.a, prompt.w[0], prompt.w[1]].sort(() => Math.random() - 0.5);
          this.bossGate.prompt = prompt.q;
          for(let i=0; i<3; i++) {
             this.bossGate.blocks[i].text = answers[i];
             this.bossGate.blocks[i].isCorrect = answers[i]===prompt.a;
             this.bossGate.blocks[i].hit = false;
          }
       }
    } else {
       Sfx.wrong();
       this._killPlayer(player);
    }
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
       // Respawn safely on the first active stable platform ahead of the camera
       let safePlat = this.platforms.find(plat => plat.active && !plat.moveY && !plat.isGate && plat.x + plat.w > this.cameraX + 50);
       if (safePlat) {
           p.x = Math.max(this.cameraX + 50, safePlat.x + 50);
       } else {
           p.x = this.cameraX + 150;
       }
       p.y = -100;
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

    this.levelTime += dt;

    // Sparks
    this.sparks = this.sparks.filter(s => {
       s.x += s.vx * dt;
       s.y += s.vy * dt;
       s.vy += 600 * dt; // gravity
       s.life -= dt;
       return s.life > 0;
    });

    // Camera (Tracks players but never goes backwards)
    let avgX = 0, aliveCount = 0;
    for(let p of this.players) { if(!p.dead){ avgX += p.x; aliveCount++; } }
    if(aliveCount > 0) avgX /= aliveCount;
    this.cameraX = Math.max(this.cameraX, avgX - 400);

    // Platform Movement
    for(let plat of this.platforms) {
       if (!plat.active || (!plat.vx && !plat.vy)) continue;
       let px_prev = plat.x; let py_prev = plat.y;
       
       if (plat.moveY) {
           plat.y += plat.vy * dt;
           if (plat.y < plat.endY || plat.y > plat.startY) plat.vy *= -1;
       } else {
           plat.x += plat.vx * dt;
           if (plat.x > plat.endX || plat.x < plat.startX) plat.vx *= -1;
       }
       
       let dx = plat.x - px_prev;
       let dy = plat.y - py_prev;
       
       // Drag riding players
       for(let p of this.players) {
           if (!p.dead && Math.abs((p.y + p.h) - py_prev) < 2 && p.x + p.w > plat.x && p.x < plat.x + plat.w) {
               p.x += dx;
               p.y += dy;
           }
       }
    }

    // Projectiles
    this.projectiles = this.projectiles.filter(proj => {
        proj.x += proj.vx * dt;
        for(let p of this.players) {
            if (!p.dead && intersect(p, proj)) {
                this._killPlayer(p);
                return false; 
            }
        }
        return proj.x > this.cameraX - 100; // GC offscreen
    });

    // Players
    for(let p of this.players) {
       if (p.dead) continue;
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
       
       // Anim Update
       p.animTime += Math.abs(p.vx) > 10 ? dt : 0;
       if (!p.grounded) {
          p.squash = 0.8;
       } else {
          p.squash += (1.0 - p.squash) * (dt * 10);
       }

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
       if (p.grounded) {
          p.jumpCount = 0;
       }
       if (this.keys[p.up]) {
          if (p.jumpReleased) {
             if (p.grounded) {
                p.vy = -750;
                p.grounded = false;
                p.jumpCount = 1;
                Sfx.jump();
             } else if (p.bootTimer > 0 && p.jumpCount === 1) {
                p.vy = -700;
                p.jumpCount = 2;
                Sfx.jump();
                // sparks
                for(let i=0; i<6; i++) {
                   this.sparks.push({ x: p.x+p.w/2, y: p.y+p.h, vx: (Math.random()-0.5)*100, vy: Math.random()*50, col: '#8a2be2', life: 0.5 });
                }
             }
             p.jumpReleased = false;
          }
       } else {
          p.jumpReleased = true;
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
                 this._hitBlock(gate, b, p);
               } else {
                 // Push horizontally
                 if (p.vx > 0) p.x = b.x - p.w;
                 else p.x = b.x + b.w;
                 p.vx = 0;
               }
            }
         }
       }
       
       // Boss Gate Collision
       if (this.bossPhase && this.bossHealth > 0) {
          for (let b of this.bossGate.blocks) {
             if (intersect(p, b)) {
                if (p.vy > 0 && p.y + p.h - p.vy*dt <= b.y) {
                  p.y = b.y - p.h; p.vy = 0; p.grounded = true;
                } else if (p.vy < 0 && p.y - p.vy*dt >= b.y + b.h) {
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
       if (p.y > CH + 100) {
          this._killPlayer(p);
       }
       
       // Spikes
       for(let s of this.spikes) {
          if (intersect(p, s)) {
             this._killPlayer(p);
          }
       }

       // Coins
       for(let c of this.coins) {
          if(!c.collected && intersect(p, c)) {
             c.collected = true;
             this.score += 10;
             p.coinsCollected++;
             
             if (p.coinsCollected >= 20) {
                 p.coinsCollected -= 20;
                 p.lives++;
                 Sfx.win(); // 1-UP sound
                 for(let i=0; i<10; i++) {
                   this.sparks.push({ x: p.x+p.w/2, y: p.y, vx: (Math.random()-0.5)*150, vy: -150 - Math.random()*50, col: '#ffd060', life: 0.8 });
                 }
             } else {
                 Sfx.coin();
             }
             this._updateScore();
          }
       }

       // Hearts
       for(let h of this.hearts) {
          if(!h.collected && intersect(p, h)) {
             h.collected = true;
             p.lives++;
             this._updateScore();
             // Play win sound for heart pickup
             Sfx.win(); 
          }
       }

       // Goal
       if (!p.dead && this.goalFlag && Math.abs(p.x - this.goalFlag.x) < 30) {
          this.state = 'end';
          Sfx.win();
          this.gameIsOver = false;
          
          let timeBonus = Math.max(0, 5000 - Math.floor(this.levelTime * 100));
          this.score += timeBonus;
          this._updateScore();

          if (this.currentLevel < 3) {
             document.getElementById('endTitle').textContent = `Level ${this.currentLevel} Complete!`;
             document.getElementById('endTitle').style.color = "#2ec97a";
             document.getElementById('playAgainBtn').textContent = `Start Level ${this.currentLevel + 1}`;
          } else {
             document.getElementById('endTitle').textContent = "You Beat the Game!";
             document.getElementById('endTitle').style.color = "#ffd060";
             document.getElementById('playAgainBtn').textContent = "Play Again";
          }
          document.getElementById('endMessage').textContent = `Time Bonus: +${timeBonus}! Final Score: ${this.score}`;
          document.getElementById('gameEnd').style.display = 'flex';
       }

       // Decrement powerup timers
       p.invincibleTimer = Math.max(0, p.invincibleTimer - dt);
       p.bootTimer = Math.max(0, p.bootTimer - dt);

       // Powerup Collisions
       for(let pu of this.powerups) {
           if (pu.active && intersect(p, pu)) {
               pu.active = false;
               if (pu.type === 'star') { p.invincibleTimer = 10; Sfx.win(); }
               if (pu.type === 'boots') { p.bootTimer = 15; Sfx.win(); }
           }
       }
    }

    // Enemies
    for(let e of this.enemies) {
       if (e.dead) continue;
       
       if (e.type === 'shooter') {
           e.shootTimer += dt;
           // Only shoot if on screen
           if (e.shootTimer > 2.5 - (this.currentLevel * 0.4) && e.x < this.cameraX + CW) {
               e.shootTimer = 0;
               this.projectiles.push({ x: e.x - 10, y: e.y + 10, w: 12, h: 12, vx: -250, dead: false });
           }
       } else if (e.type === 'flyer') {
           e.flyOffset += dt * 4;
           e.y = e.startY + Math.sin(e.flyOffset) * 60;
           e.x += e.vx * dt;
           if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
       } else if (e.type === 'pacer') {
           e.y += e.vy * dt;
           if (e.y < e.startY || e.y > e.endY) e.vy *= -1;
       } else if (e.type === 'chaser') {
           let closest = null; let minDist = 9999;
           for(let p of this.players) {
               if(p.dead) continue;
               let d = Math.abs(p.x - e.x);
               if (d < minDist) { minDist = d; closest = p; }
           }
           if (closest && minDist < 350) {
               e.vx = closest.x < e.x ? -110 : 110;
           } else {
               e.vx *= 0.5;
           }
           e.x += e.vx * dt;
       } else {
           e.x += e.vx * dt;
           if (e.x < e.startX || e.x > e.endX) e.vx *= -1;
       }

       for(let p of this.players) {
          if (p.dead) continue;
          if (intersect(p, e)) {
             if (p.invincibleTimer > 0) {
                 e.dead = true;
                 this.score += 50;
                 this._updateScore();
                 Sfx.stomp();
                 for(let i=0; i<5; i++) {
                   this.sparks.push({ x: e.x + e.w/2, y: e.y + e.h/2, vx: (Math.random()-0.5)*150, vy: (Math.random()-0.5)*150, col: '#facc15', life: 0.5 });
                 }
             } else if (p.vy > 0 && p.y + p.h - p.vy*dt <= e.y + 15) {
                e.dead = true;
                p.vy = -600; // bounce off enemies
                this.score += 50;
                this._updateScore();
                Sfx.stomp();
             } else {
                this._killPlayer(p);
             }
          }
       }
    }

    // Boss Actions
    if (this.bossPhase && this.bossHealth > 0) {
       this.bossEntity.shootTimer += dt;
       if (this.bossEntity.shootTimer > 2.0 && this.bossEntity.x < this.cameraX + CW + 200) {
          this.bossEntity.shootTimer = 0;
          this.projectiles.push({ x: this.bossEntity.x - 20, y: this.bossEntity.y + 40, w: 20, h: 20, vx: -300 - Math.random()*200, dead: false });
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
         // Dynamic color for moving platforms
         if (p.vx || p.vy) this.ctx.fillStyle = '#f5a623'; 
         this.ctx.fillRect(p.x, p.y, p.w, p.h);
         
         this.ctx.fillStyle = '#475569';
         if (p.vx || p.vy) this.ctx.fillStyle = '#cc8512';
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

    // Boss
    if (this.bossPhase && this.bossHealth > 0) {
       this.ctx.fillStyle = '#ff4db8';
       this.ctx.fillRect(this.bossEntity.x, this.bossEntity.y, this.bossEntity.w, this.bossEntity.h);
       
       // Face
       this.ctx.fillStyle = '#0f1522';
       this.ctx.fillRect(this.bossEntity.x + 30, this.bossEntity.y + 40, 20, 30);
       this.ctx.fillRect(this.bossEntity.x + 100, this.bossEntity.y + 40, 20, 30);
       this.ctx.fillStyle = '#e84040';
       this.ctx.fillRect(this.bossEntity.x + 35, this.bossEntity.y + 45, 10, 10);
       this.ctx.fillRect(this.bossEntity.x + 105, this.bossEntity.y + 45, 10, 10);

       // Teeth
       for(let tx=this.bossEntity.x+20; tx<this.bossEntity.x+130; tx+=20) {
          this.ctx.beginPath();
          this.ctx.moveTo(tx, this.bossEntity.y + 110);
          this.ctx.lineTo(tx + 10, this.bossEntity.y + 130);
          this.ctx.lineTo(tx + 20, this.bossEntity.y + 110);
          this.ctx.fillStyle = '#fff';
          this.ctx.fill();
       }

       // Health bar
       this.ctx.fillStyle = '#e84040';
       this.ctx.fillRect(this.bossEntity.x, this.bossEntity.y - 30, this.bossEntity.w, 15);
       this.ctx.fillStyle = '#2ec97a';
       this.ctx.fillRect(this.bossEntity.x, this.bossEntity.y - 30, this.bossEntity.w * (this.bossHealth/3), 15);

       // Boss Gate
       let cx = this.bossGate.blocks[1].x + this.bossGate.blocks[1].w/2;
       this.ctx.fillStyle = '#1a2235';
       this.ctx.beginPath(); this.ctx.roundRect(cx - 200, 150, 400, 60, 10); this.ctx.fill();
       this.ctx.fillStyle = '#ff4db8';
       this.ctx.font = '700 24px Outfit';
       this.ctx.textAlign = 'center';
       this.ctx.fillText(this.bossGate.prompt, cx, 188);

       this.ctx.font = '800 20px monospace';
       for(let b of this.bossGate.blocks) {
          if (b.hit && !b.isCorrect) continue;
          this.ctx.fillStyle = b.hit ? '#2ec97a' : '#ffd060';
          this.ctx.fillRect(b.x, b.y, b.w, b.h);
          this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
          this.ctx.fillRect(b.x, b.y+b.h-8, b.w, 8);
          this.ctx.fillStyle = '#111';
          this.ctx.fillText(b.text, b.x + b.w/2, b.y + 32);
       }
    }

    // Powerups
    for(let pu of this.powerups) {
        if (!pu.active) continue;
        if (pu.type === 'star') {
            this.ctx.fillStyle = '#facc15';
            this.ctx.beginPath();
            let rot = Date.now() / 200;
            for(let i=0; i<5; i++) {
                this.ctx.lineTo(pu.x+pu.w/2 + Math.cos(rot + i*Math.PI*0.4)*12, pu.y+pu.h/2 + Math.sin(rot + i*Math.PI*0.4)*12);
                this.ctx.lineTo(pu.x+pu.w/2 + Math.cos(rot + i*Math.PI*0.4 + 0.6)*5, pu.y+pu.h/2 + Math.sin(rot + i*Math.PI*0.4 + 0.6)*5);
            }
            this.ctx.fill();
        } else if (pu.type === 'boots') {
            this.ctx.fillStyle = '#8a2be2';
            this.ctx.beginPath(); this.ctx.roundRect(pu.x+4, pu.y+8, 16, 16, 4); this.ctx.fill();
            this.ctx.fillStyle = '#facc15';
            this.ctx.fillRect(pu.x+16, pu.y+18, 8, 6);
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

    // Projectiles
    this.ctx.fillStyle = '#ffd060';
    for(let proj of this.projectiles) {
       this.ctx.beginPath();
       this.ctx.arc(proj.x + proj.w/2, proj.y + proj.h/2, proj.w/2, 0, Math.PI*2);
       this.ctx.fill();
    }

    // Spikes
    this.ctx.fillStyle = '#b91c1c';
    for(let s of this.spikes) {
       for(let x = s.x; x < s.x + s.w; x += 15) {
           this.ctx.beginPath();
           this.ctx.moveTo(x, s.y + s.h);
           this.ctx.lineTo(x + 7.5, s.y);
           this.ctx.lineTo(Math.min(x + 15, s.x+s.w), s.y + s.h);
           this.ctx.fill();
       }
    }

    // Enemies
    for(let e of this.enemies) {
       if (e.dead) continue;
       
       if (e.type === 'shooter') this.ctx.fillStyle = '#8a2be2';
       else if (e.type === 'flyer') this.ctx.fillStyle = '#f97316';
       else if (e.type === 'chaser') this.ctx.fillStyle = '#65a30d';
       else if (e.type === 'pacer') this.ctx.fillStyle = '#14b8a6';
       else this.ctx.fillStyle = '#e84040';

       this.ctx.beginPath();
       this.ctx.roundRect(e.x, e.y, e.w, e.h, 6);
       this.ctx.fill();
       
       // Eyes
       this.ctx.fillStyle = '#fff';
       let dirX = (e.vx > 0 || e.type==='shooter') ? 5 : -5;
       
       if (e.type === 'shooter') {
           // single cannon eye
           this.ctx.fillRect(e.x + e.w/2 - 8, e.y + e.h/2 - 8, 16, 16);
           this.ctx.fillStyle = '#000';
           this.ctx.fillRect(e.x + e.w/2 - 4 - (Math.sin(e.shootTimer * 6)*4), e.y + e.h/2 - 4, 8, 8);
       } else if (e.type === 'flyer') {
           this.ctx.fillRect(e.x + 4, e.y + e.h/2 - 4, 8, 8);
           this.ctx.fillRect(e.x + e.w - 12, e.y + e.h/2 - 4, 8, 8);
       } else {
           this.ctx.fillRect(e.x + e.w/2 - 8 + dirX, e.y + 10, 6, 6);
           this.ctx.fillRect(e.x + e.w/2 + 2 + dirX, e.y + 10, 6, 6);
       }
    }

    // Hearts
    this.ctx.fillStyle = '#ff4d4d';
    for(let h of this.hearts) {
       if (h.collected) continue;
       this.ctx.beginPath();
       this.ctx.arc(h.x + h.w/4, h.y + h.w/4, h.w/4, Math.PI, 0);
       this.ctx.arc(h.x + h.w*0.75, h.y + h.w/4, h.w/4, Math.PI, 0);
       this.ctx.lineTo(h.x + h.w/2, h.y + h.h);
       this.ctx.fill();
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
       if (p.dead) continue;
       
       // Star Effect
       if (p.invincibleTimer > 0) {
           this.ctx.shadowBlur = 20;
           this.ctx.shadowColor = '#facc15';
           if (Math.random() < 0.3) this.sparks.push({ x: p.x+Math.random()*p.w, y: p.y+Math.random()*p.h, vx: 0, vy: -50, col: '#facc15', life: 0.3 });
       }
       
       this.ctx.save();
       // Animation squash & stretch & rotation
       let rot = p.vx * 0.0005; 
       this.ctx.translate(p.x + p.w/2, p.y + p.h);
       this.ctx.scale(1/p.squash, p.squash);
       this.ctx.rotate(rot);

       // Legs (Walking animation)
       this.ctx.fillStyle = p.color;
       let legSwing = Math.sin(p.animTime * 15) * 8;
       if (Math.abs(p.squash - 1.0) > 0.1 || !p.grounded) legSwing = 0; // Don't swing legs much in air
       
       // Boots powerup visuals
       let shoeColor = p.bootTimer > 0 ? '#8a2be2' : '#111';
       
       // Left leg
       this.ctx.fillRect(-10 + (Math.abs(p.vx)>10 ? legSwing : 0), -12, 8, 12);
       this.ctx.fillStyle = shoeColor;
       this.ctx.fillRect(-12 + (Math.abs(p.vx)>10 ? legSwing : 0), -4, 12, 6);
       
       // Right leg
       this.ctx.fillStyle = p.color;
       this.ctx.fillRect(2 - (Math.abs(p.vx)>10 ? legSwing : 0), -12, 8, 12);
       this.ctx.fillStyle = shoeColor;
       this.ctx.fillRect(0 - (Math.abs(p.vx)>10 ? legSwing : 0), -4, 12, 6);

       // Body
       this.ctx.fillStyle = p.color;
       this.ctx.beginPath();
       this.ctx.roundRect(-p.w/2, -p.h, p.w, p.h - 10, 8);
       this.ctx.fill();

       // Visor / eyes
       this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
       let lookX = p.vx > 10 ? 4 : (p.vx < -10 ? -4 : 0);
       this.ctx.fillRect(-p.w/2 + 8 + lookX, -p.h + 12, 16, 8);
       
       this.ctx.restore();
       this.ctx.shadowBlur = 0; // reset
    }

    this.ctx.restore();
    
    // UI Overlay (Timer)
    if (this.state === 'playing') {
       this.ctx.font = '800 28px Outfit';
       this.ctx.fillStyle = '#fff';
       this.ctx.textAlign = 'center';
       // Draw text stroke
       this.ctx.lineWidth = 4;
       this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
       this.ctx.strokeText(`⏰ ${this.levelTime.toFixed(1)}s`, CW/2, 40);
       this.ctx.fillText(`⏰ ${this.levelTime.toFixed(1)}s`, CW/2, 40);
       
       // Hearts HUD
       let heartW = 20;
       for(let idx=0; idx < this.players.length; idx++) {
           let p = this.players[idx];
           let startY = 20 + (idx * 28);
           this.ctx.fillStyle = p.color;
           // Name/P1
           this.ctx.font = '700 16px Outfit';
           this.ctx.textAlign = 'left';
           let nameOffset = 20;
           this.ctx.lineWidth = 3;
           this.ctx.strokeText(`P${p.id}`, nameOffset, startY + 12);
           this.ctx.fillText(`P${p.id}`, nameOffset, startY + 12);
           
           for(let i=0; i < Math.min(6, p.lives); i++) {
               let px = nameOffset + 35 + (i * 24);
               this.ctx.beginPath();
               this.ctx.arc(px + heartW/4, startY + heartW/4, heartW/4, Math.PI, 0);
               this.ctx.arc(px + heartW*0.75, startY + heartW/4, heartW/4, Math.PI, 0);
               this.ctx.lineTo(px + heartW/2, startY + heartW*0.9);
               this.ctx.fill();
           }
           
           // Coin HUD
           this.ctx.fillStyle = '#facc15';
           let coinX = nameOffset + 40 + (Math.min(6, p.lives) * 24);
           this.ctx.strokeText(`🪙 ${p.coinsCollected} / 20`, coinX, startY + 12);
           this.ctx.fillText(`🪙 ${p.coinsCollected} / 20`, coinX, startY + 12);
       }
    }
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
