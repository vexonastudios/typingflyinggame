/* ============================================================
   FOOSBALL FRENZY — foosball.js
   Two-player digital foosball with canvas physics
   ============================================================ */

(function () {
  'use strict';

  // ======== CONSTANTS ========
  const W = 900;       // Canvas width
  const H = 500;       // Canvas height
  const PAD = 20;      // Table padding (bumper width)
  const GOAL_H = 130;  // Goal opening height
  const GOAL_D = 30;   // Goal depth
  const BALL_R = 8;    // Ball radius
  const FIG_W = 18;    // Figure width
  const FIG_H = 32;    // Figure height
  const ROD_SPEED = 6; // Rod slide speed per frame
  const KICK_POWER = 10;
  const KICK_COOLDOWN = 300; // ms
  const BALL_MAX_SPEED = 14;
  const FRICTION = 0.997;
  const BALL_FRICTION_SLOW = 0.99; // Extra friction when ball is slow

  // Colors
  const C = {
    felt: '#2d8c3a',
    feltLine: 'rgba(255,255,255,0.07)',
    bumper: '#5a3825',
    bumperLight: '#7a5540',
    goal: '#1a1a1a',
    goalNet: 'rgba(255,255,255,0.04)',
    rod: '#888',
    rodShine: 'rgba(255,255,255,0.15)',
    ball: '#fff',
    ballShadow: 'rgba(0,0,0,0.3)',
    p1: '#e74c3c',
    p1Dark: '#c0392b',
    p1Light: '#ff6b6b',
    p2: '#3498db',
    p2Dark: '#2980b9',
    p2Light: '#69b4f5',
    white: '#fff',
  };

  // Rod configuration: [player, numFigures, xPosition]
  // Standard foosball: rods alternate between players
  const ROD_CONFIG = [
    { player: 1, count: 1, x: 70  },   // P1 Goalie
    { player: 2, count: 3, x: 175 },   // P2 Attack (near P1 goal)
    { player: 1, count: 2, x: 280 },   // P1 Defense
    { player: 2, count: 5, x: 390 },   // P2 Midfield
    { player: 1, count: 5, x: 510 },   // P1 Midfield
    { player: 2, count: 2, x: 620 },   // P2 Defense
    { player: 1, count: 3, x: 725 },   // P1 Attack (near P2 goal)
    { player: 2, count: 1, x: 830 },   // P2 Goalie
  ];

  // ======== AUDIO ENGINE ========
  const SFX = {
    ctx: null,
    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    _noise(dur) {
      const c = this.ctx, len = c.sampleRate * dur;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource();
      s.buffer = buf;
      return s;
    },
    play(type) {
      if (!this.ctx) return;
      const c = this.ctx, now = c.currentTime, d = c.destination;
      switch (type) {
        case 'kick': {
          const n = this._noise(0.08);
          const bp = c.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 1.5;
          const g = c.createGain();
          g.gain.setValueAtTime(0.5, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          n.connect(bp).connect(g).connect(d);
          n.start(now); n.stop(now + 0.08);
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(400, now);
          o.frequency.exponentialRampToValueAtTime(150, now + 0.05);
          const g2 = c.createGain();
          g2.gain.setValueAtTime(0.3, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          o.connect(g2).connect(d);
          o.start(now); o.stop(now + 0.07);
          break;
        }
        case 'hit': {
          const n = this._noise(0.06);
          const bp = c.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 2;
          const g = c.createGain();
          g.gain.setValueAtTime(0.3, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          n.connect(bp).connect(g).connect(d);
          n.start(now); n.stop(now + 0.06);
          break;
        }
        case 'wall': {
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(300, now);
          o.frequency.exponentialRampToValueAtTime(100, now + 0.04);
          const g = c.createGain();
          g.gain.setValueAtTime(0.15, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          o.connect(g).connect(d);
          o.start(now); o.stop(now + 0.06);
          break;
        }
        case 'goal': {
          // Crowd roar noise
          const n = this._noise(0.8);
          const bp = c.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.3;
          const g = c.createGain();
          g.gain.setValueAtTime(0.0, now);
          g.gain.linearRampToValueAtTime(0.35, now + 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
          n.connect(bp).connect(g).connect(d);
          n.start(now); n.stop(now + 0.8);
          // Victory chord
          [523, 659, 784].forEach((f, i) => {
            const t = now + 0.05 + i * 0.06;
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(f, t);
            const gg = c.createGain();
            gg.gain.setValueAtTime(0.2, t);
            gg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            o.connect(gg).connect(d);
            o.start(t); o.stop(t + 0.45);
          });
          break;
        }
        case 'countdown': {
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(880, now);
          const g = c.createGain();
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          o.connect(g).connect(d);
          o.start(now); o.stop(now + 0.15);
          break;
        }
        case 'go': {
          [523, 659, 784, 1047].forEach((f, i) => {
            const t = now + i * 0.06;
            const o = c.createOscillator();
            o.type = 'triangle';
            o.frequency.setValueAtTime(f, t);
            const g = c.createGain();
            g.gain.setValueAtTime(0.22, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            o.connect(g).connect(d);
            o.start(t); o.stop(t + 0.18);
          });
          break;
        }
        case 'win': {
          const notes = [523, 659, 784, 1047, 784, 1047];
          notes.forEach((f, i) => {
            const t = now + i * 0.12;
            const o = c.createOscillator();
            o.type = 'sine';
            o.frequency.setValueAtTime(f, t);
            const g = c.createGain();
            g.gain.setValueAtTime(0.22, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            o.connect(g).connect(d);
            o.start(t); o.stop(t + 0.28);
            // Harmonic
            const h = c.createOscillator();
            h.type = 'sine';
            h.frequency.setValueAtTime(f * 2, t);
            const gh = c.createGain();
            gh.gain.setValueAtTime(0.06, t);
            gh.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            h.connect(gh).connect(d);
            h.start(t); h.stop(t + 0.22);
          });
          break;
        }
      }
    }
  };

  // ======== GAME STATE ========
  const $ = id => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let maxScore = 10;
  let scoreP1 = 0;
  let scoreP2 = 0;
  let gameRunning = false;
  let gamePaused = false;
  let animFrame = null;

  // Ball
  let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };

  // Rods
  let rods = [];

  // Input
  const keys = {};
  let p1LastKick = 0;
  let p2LastKick = 0;
  let p1Kicking = false;
  let p2Kicking = false;
  let p1KickDir = 1;   // -1 = left, +1 = right
  let p2KickDir = -1;
  let p1KickAnim = 0;
  let p2KickAnim = 0;

  // Anti-stuck
  let stuckFrames = 0;

  // Goal area bounds
  const goalTop = (H - GOAL_H) / 2;
  const goalBot = (H + GOAL_H) / 2;

  // ======== INIT RODS ========
  function initRods() {
    rods = ROD_CONFIG.map(cfg => {
      const playableH = H - PAD * 2;
      const figures = [];
      const spacing = playableH / (cfg.count + 1);
      for (let i = 0; i < cfg.count; i++) {
        figures.push({
          baseY: PAD + spacing * (i + 1),
        });
      }
      return {
        player: cfg.player,
        count: cfg.count,
        x: cfg.x,
        offset: 0,
        maxOffset: spacing * 0.6,
        figures,
      };
    });
  }

  // Ball trail for motion blur effect
  let ballTrail = [];
  const TRAIL_LENGTH = 6;

  function resetBall(dir) {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = dir * (5 + Math.random() * 2);
    ball.vy = (Math.random() - 0.5) * 4;
    stuckFrames = 0;
    ballTrail = [];
  }

  // ======== PHYSICS ========
  function updateBall() {
    // Apply friction
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed < 2) {
      ball.vx *= BALL_FRICTION_SLOW;
      ball.vy *= BALL_FRICTION_SLOW;
    } else {
      ball.vx *= FRICTION;
      ball.vy *= FRICTION;
    }

    // Anti-stuck: if ball barely moving for too long, nudge it
    if (speed < 0.5) {
      stuckFrames++;
      if (stuckFrames > 120) { // ~2 seconds at 60fps
        const angle = Math.random() * Math.PI * 2;
        ball.vx = Math.cos(angle) * 4;
        ball.vy = Math.sin(angle) * 4;
        stuckFrames = 0;
      }
    } else {
      stuckFrames = 0;
    }

    // Clamp speed
    if (speed > BALL_MAX_SPEED) {
      const ratio = BALL_MAX_SPEED / speed;
      ball.vx *= ratio;
      ball.vy *= ratio;
    }

    // Record trail position before moving
    ballTrail.push({ x: ball.x, y: ball.y });
    if (ballTrail.length > TRAIL_LENGTH) ballTrail.shift();

    // Move
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Top/bottom wall bounce
    if (ball.y - BALL_R < PAD) {
      ball.y = PAD + BALL_R;
      ball.vy = Math.abs(ball.vy) * 0.85;
      if (Math.abs(ball.vy) < 0.5) ball.vy = 1.5;
      SFX.play('wall');
    }
    if (ball.y + BALL_R > H - PAD) {
      ball.y = H - PAD - BALL_R;
      ball.vy = -Math.abs(ball.vy) * 0.85;
      if (Math.abs(ball.vy) < 0.5) ball.vy = -1.5;
      SFX.play('wall');
    }

    // Left wall / goal check
    if (ball.x - BALL_R < PAD) {
      if (ball.y > goalTop && ball.y < goalBot) {
        // Ball is in goal zone — score as soon as ball center passes the goal line
        if (ball.x < PAD) {
          goalScored(2);
          return;
        }
      } else {
        ball.x = PAD + BALL_R;
        ball.vx = Math.abs(ball.vx) * 0.8;
        if (Math.abs(ball.vx) < 1) ball.vx = 2;
        SFX.play('wall');
      }
    }

    // Right wall / goal check
    if (ball.x + BALL_R > W - PAD) {
      if (ball.y > goalTop && ball.y < goalBot) {
        // Ball is in goal zone — score as soon as ball center passes the goal line
        if (ball.x > W - PAD) {
          goalScored(1);
          return;
        }
      } else {
        ball.x = W - PAD - BALL_R;
        ball.vx = -Math.abs(ball.vx) * 0.8;
        if (Math.abs(ball.vx) < 1) ball.vx = -2;
        SFX.play('wall');
      }
    }

    // Figure collisions — only resolve closest collision per frame
    let hitSomething = false;
    rods.forEach(rod => {
      if (hitSomething) return; // One collision per frame to prevent trapping
      rod.figures.forEach(fig => {
        if (hitSomething) return;
        const fy = fig.baseY + rod.offset;
        const fx = rod.x;

        // Expanded hitbox for kick detection
        const isKicking = rod.player === 1 ? p1Kicking : p2Kicking;
        const kickExpand = isKicking ? 12 : 0;
        const hw = FIG_W / 2 + kickExpand;
        const hh = FIG_H / 2 + kickExpand;

        // Rectangle vs circle collision
        const closestX = Math.max(fx - hw, Math.min(ball.x, fx + hw));
        const closestY = Math.max(fy - hh, Math.min(ball.y, fy + hh));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < BALL_R) {
          hitSomething = true;

          // Calculate normal direction (ball center to closest point)
          let nx, ny;
          if (dist === 0) {
            // Ball is dead center inside figure — push away from figure center
            nx = ball.x - fx;
            ny = ball.y - fy;
            const nLen = Math.sqrt(nx * nx + ny * ny);
            if (nLen < 0.1) {
              // Completely overlapping — push in a random direction
              const a = Math.random() * Math.PI * 2;
              nx = Math.cos(a);
              ny = Math.sin(a);
            } else {
              nx /= nLen;
              ny /= nLen;
            }
          } else {
            nx = dx / dist;
            ny = dy / dist;
          }

          // Push ball out of figure
          const overlap = BALL_R - dist + 2; // +2 extra to prevent re-entry
          ball.x += nx * overlap;
          ball.y += ny * overlap;

          if (isKicking) {
            // KICK: Direction based on which kick key player pressed
            const dir = rod.player === 1 ? p1KickDir : p2KickDir;
            // Strong horizontal kick in chosen direction + vertical angle based on ball-figure offset
            const vertAngle = (ball.y - fy) * 0.15;
            ball.vx = dir * KICK_POWER * (0.9 + Math.random() * 0.3);
            ball.vy = vertAngle + (Math.random() - 0.5) * 3;
            SFX.play('kick');
          } else {
            // Normal bounce: reflect velocity along collision normal
            const dotProduct = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dotProduct * nx) * 0.65;
            ball.vy = (ball.vy - 2 * dotProduct * ny) * 0.65;

            // Add rod slide momentum to ball
            const rodPlayer = rod.player;
            let rodMomentum = 0;
            if (rodPlayer === 1) {
              if (keys['w']) rodMomentum = -2.5;
              if (keys['s']) rodMomentum = 2.5;
            } else {
              if (keys['arrowup']) rodMomentum = -2.5;
              if (keys['arrowdown']) rodMomentum = 2.5;
            }
            ball.vy += rodMomentum;

            // Ensure ball has minimum velocity after bounce (prevent dead stops)
            const postSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (postSpeed < 2) {
              ball.vx += nx * 3;
              ball.vy += ny * 2;
            }

            SFX.play('hit');
          }
        }
      });
    });

    // Final safety: keep ball in bounds
    ball.x = Math.max(PAD - GOAL_D + BALL_R, Math.min(W - PAD + GOAL_D - BALL_R, ball.x));
    ball.y = Math.max(PAD + BALL_R, Math.min(H - PAD - BALL_R, ball.y));
  }

  function updateRods() {
    const dt = 1;

    // P1 movement
    let p1Dir = 0;
    if (keys['w']) p1Dir = -1;
    if (keys['s']) p1Dir = 1;

    // P2 movement
    let p2Dir = 0;
    if (keys['arrowup']) p2Dir = -1;
    if (keys['arrowdown']) p2Dir = 1;

    rods.forEach(rod => {
      const dir = rod.player === 1 ? p1Dir : p2Dir;
      rod.offset += dir * ROD_SPEED * dt;
      rod.offset = Math.max(-rod.maxOffset, Math.min(rod.maxOffset, rod.offset));
    });

    // Kick handling — two keys per player for directional kicks
    const now = performance.now();
    // P1: A = kick left, D = kick right
    const p1KickL = keys['a'];
    const p1KickR = keys['d'];
    if ((p1KickL || p1KickR) && now - p1LastKick > KICK_COOLDOWN) {
      p1Kicking = true;
      p1KickDir = p1KickR ? 1 : -1;
      p1KickAnim = 8;
      p1LastKick = now;
    } else {
      p1Kicking = false;
    }

    // P2: Left arrow = kick left, Right arrow = kick right
    const p2KickL = keys['arrowleft'];
    const p2KickR = keys['arrowright'];
    if ((p2KickL || p2KickR) && now - p2LastKick > KICK_COOLDOWN) {
      p2Kicking = true;
      p2KickDir = p2KickR ? 1 : -1;
      p2KickAnim = 8;
      p2LastKick = now;
    } else {
      p2Kicking = false;
    }

    if (p1KickAnim > 0) p1KickAnim--;
    if (p2KickAnim > 0) p2KickAnim--;
  }

  // ======== GOAL ========
  function goalScored(scoringPlayer) {
    gamePaused = true;
    if (scoringPlayer === 1) scoreP1++;
    else scoreP2++;

    updateScoreboard();
    SFX.play('goal');
    showGoalFlash(scoringPlayer);

    // Animate the score number
    const scoreEl = scoringPlayer === 1 ? $('scoreRed') : $('scoreBlue');
    scoreEl.style.transform = 'scale(1.6)';
    scoreEl.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
    setTimeout(() => { scoreEl.style.transform = 'scale(1)'; }, 400);

    setTimeout(() => {
      if (scoreP1 >= maxScore || scoreP2 >= maxScore) {
        endGame();
      } else {
        // Ball goes toward the player who was scored on
        startCountdown(() => {
          resetBall(scoringPlayer === 1 ? -1 : 1);
          gamePaused = false;
        });
      }
    }, 1200);
  }

  function showGoalFlash(player) {
    const el = $('goalFlash');
    const txt = $('goalFlash').querySelector('.goal-text');
    if (player === 1) {
      txt.textContent = '🔴 RED SCORES!';
      txt.style.textShadow = '0 0 40px rgba(231,76,60,0.8), 0 0 80px rgba(231,76,60,0.4)';
    } else {
      txt.textContent = '🔵 BLUE SCORES!';
      txt.style.textShadow = '0 0 40px rgba(52,152,219,0.8), 0 0 80px rgba(52,152,219,0.4)';
    }
    el.style.display = 'flex';
    setTimeout(() => {
      el.style.display = 'none';
      txt.style.textShadow = '';
    }, 1000);
  }

  // ======== COUNTDOWN ========
  function startCountdown(cb) {
    const overlay = $('countdownOverlay');
    const numEl = $('countdownNum');
    let count = 3;

    overlay.style.display = 'flex';
    numEl.textContent = count;
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = 'countPop 0.6s cubic-bezier(0.34,1.56,0.64,1)';
    SFX.play('countdown');

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        numEl.textContent = count;
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = 'countPop 0.6s cubic-bezier(0.34,1.56,0.64,1)';
        SFX.play('countdown');
      } else {
        numEl.textContent = 'GO!';
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = 'countPop 0.6s cubic-bezier(0.34,1.56,0.64,1)';
        SFX.play('go');
        clearInterval(timer);
        setTimeout(() => {
          overlay.style.display = 'none';
          cb();
        }, 500);
      }
    }, 800);
  }

  // ======== RENDERING ========
  function drawTable() {
    // Felt background
    ctx.fillStyle = C.felt;
    ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

    // Center circle
    ctx.strokeStyle = C.feltLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 50, 0, Math.PI * 2);
    ctx.stroke();

    // Center line
    ctx.beginPath();
    ctx.moveTo(W / 2, PAD);
    ctx.lineTo(W / 2, H - PAD);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    ctx.strokeStyle = C.feltLine;
    ctx.lineWidth = 1.5;
    // Left
    ctx.strokeRect(PAD, goalTop - 30, 100, GOAL_H + 60);
    // Right
    ctx.strokeRect(W - PAD - 100, goalTop - 30, 100, GOAL_H + 60);

    // Goals
    // Left goal
    ctx.fillStyle = C.goal;
    ctx.fillRect(PAD - GOAL_D, goalTop, GOAL_D + 2, GOAL_H);
    // Goal net lines
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const y = goalTop + (GOAL_H / 6) * i;
      ctx.beginPath();
      ctx.moveTo(PAD - GOAL_D, y);
      ctx.lineTo(PAD, y);
      ctx.stroke();
    }
    // Vertical net lines
    for (let i = 0; i <= 3; i++) {
      const x = PAD - GOAL_D + (GOAL_D / 3) * i;
      ctx.beginPath();
      ctx.moveTo(x, goalTop);
      ctx.lineTo(x, goalBot);
      ctx.stroke();
    }

    // Right goal
    ctx.fillStyle = C.goal;
    ctx.fillRect(W - PAD - 2, goalTop, GOAL_D + 2, GOAL_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i <= 6; i++) {
      const y = goalTop + (GOAL_H / 6) * i;
      ctx.beginPath();
      ctx.moveTo(W - PAD, y);
      ctx.lineTo(W - PAD + GOAL_D, y);
      ctx.stroke();
    }
    // Vertical net lines
    for (let i = 0; i <= 3; i++) {
      const x = W - PAD + (GOAL_D / 3) * i;
      ctx.beginPath();
      ctx.moveTo(x, goalTop);
      ctx.lineTo(x, goalBot);
      ctx.stroke();
    }

    // Bumpers (borders)
    ctx.fillStyle = C.bumper;
    // Top
    ctx.fillRect(0, 0, W, PAD);
    // Bottom
    ctx.fillRect(0, H - PAD, W, PAD);
    // Left (excluding goal)
    ctx.fillRect(0, PAD, PAD, goalTop - PAD);
    ctx.fillRect(0, goalBot, PAD, H - PAD - goalBot);
    // Right (excluding goal)
    ctx.fillRect(W - PAD, PAD, PAD, goalTop - PAD);
    ctx.fillRect(W - PAD, goalBot, PAD, H - PAD - goalBot);

    // Goal posts (rounded)
    ctx.fillStyle = C.bumperLight;
    // Left goal posts
    ctx.beginPath();
    ctx.arc(PAD, goalTop, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(PAD, goalBot, 5, 0, Math.PI * 2);
    ctx.fill();
    // Right goal posts
    ctx.beginPath();
    ctx.arc(W - PAD, goalTop, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W - PAD, goalBot, 5, 0, Math.PI * 2);
    ctx.fill();

    // Bumper edge highlight
    ctx.fillStyle = C.bumperLight;
    ctx.fillRect(0, PAD - 2, W, 2);
    ctx.fillRect(0, H - PAD, W, 2);
  }

  function drawRods() {
    rods.forEach(rod => {
      const isP1 = rod.player === 1;
      const kickAnim = isP1 ? p1KickAnim : p2KickAnim;
      const figColor = isP1 ? C.p1 : C.p2;
      const figDark = isP1 ? C.p1Dark : C.p2Dark;
      const figLight = isP1 ? C.p1Light : C.p2Light;

      // Rod line
      ctx.strokeStyle = C.rod;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rod.x, PAD);
      ctx.lineTo(rod.x, H - PAD);
      ctx.stroke();

      // Rod shine
      ctx.strokeStyle = C.rodShine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rod.x - 1, PAD);
      ctx.lineTo(rod.x - 1, H - PAD);
      ctx.stroke();

      // Rod end caps (handles)
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(rod.x, PAD - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rod.x, H - PAD + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(rod.x, PAD - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rod.x, H - PAD + 4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Figures
      rod.figures.forEach(fig => {
        const fy = fig.baseY + rod.offset;
        const fx = rod.x;

        // Kick rotation offset — use actual kick direction
        const kDir = isP1 ? p1KickDir : p2KickDir;
        const kickOff = kickAnim > 0 ? kDir * kickAnim * 1.2 : 0;

        ctx.save();
        ctx.translate(fx + kickOff * 0.5, fy);

        // Body (rounded rect)
        const hw = FIG_W / 2;
        const hh = FIG_H / 2;
        ctx.beginPath();
        ctx.roundRect(-hw, -hh, FIG_W, FIG_H, 4);
        ctx.fillStyle = figColor;
        ctx.fill();
        ctx.strokeStyle = figDark;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Face area
        ctx.fillStyle = figLight;
        ctx.beginPath();
        ctx.arc(0, -hh + 10, 6, 0, Math.PI * 2);
        ctx.fill();

        // Stripe
        ctx.fillStyle = C.white;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(-hw + 2, -2, FIG_W - 4, 4);
        ctx.globalAlpha = 1;

        // Foot (kicking indicator) — extends in kick direction
        if (kickAnim > 0) {
          ctx.fillStyle = figLight;
          const footX = kDir > 0 ? hw + 4 : -hw - 8;
          ctx.fillRect(footX, 4, 8, 6);
        }

        ctx.restore();
      });
    });
  }

  function drawBall() {
    // Motion trail
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 3 && ballTrail.length > 1) {
      for (let i = 0; i < ballTrail.length; i++) {
        const t = ballTrail[i];
        const alpha = (i / ballTrail.length) * 0.2;
        const r = BALL_R * (i / ballTrail.length) * 0.6;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Shadow
    ctx.fillStyle = C.ballShadow;
    ctx.beginPath();
    ctx.ellipse(ball.x + 2, ball.y + 2, BALL_R, BALL_R * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.7, '#e0e0e0');
    grad.addColorStop(1, '#b0b0b0');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(ball.x - 2, ball.y - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawTable();
    drawRods();
    drawBall();
  }

  // ======== GAME LOOP ========
  function gameLoop() {
    if (!gameRunning) return;

    if (!gamePaused && !isPaused) {
      updateRods();
      updateBall();
    }

    render();
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ======== SCOREBOARD ========
  function updateScoreboard() {
    $('scoreRed').textContent = scoreP1;
    $('scoreBlue').textContent = scoreP2;
  }

  // ======== END GAME ========
  function endGame() {
    gameRunning = false;
    gamePaused = true;
    if (animFrame) cancelAnimationFrame(animFrame);

    SFX.play('win');

    const winner = scoreP1 >= maxScore ? 1 : 2;
    $('resultsEmoji').textContent = winner === 1 ? '🔴' : '🔵';
    $('resultsHeadline').textContent = winner === 1 ? 'Red Wins!' : 'Blue Wins!';
    $('resultsHeadline').className = 'results-headline ' + (winner === 1 ? 'red-win' : 'blue-win');
    $('resultsSub').textContent = `${scoreP1} – ${scoreP2}`;

    setTimeout(() => {
      $('resultsOverlay').style.display = 'flex';
    }, 800);
  }

  // ======== PAUSE ========
  let isPaused = false;

  function togglePause() {
    if (!gameRunning || gamePaused) return; // Don't pause during countdown
    isPaused = !isPaused;
    const overlay = $('countdownOverlay');
    const numEl = $('countdownNum');
    if (isPaused) {
      numEl.textContent = '⏸';
      numEl.style.animation = 'none';
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  // ======== START GAME ========
  function startGame() {
    // Cancel any stale animation frame
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    isPaused = false;

    scoreP1 = 0;
    scoreP2 = 0;
    updateScoreboard();
    initRods();
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    ballTrail = [];
    p1KickAnim = 0;
    p2KickAnim = 0;
    gameRunning = true;
    gamePaused = true;

    render(); // Draw initial state

    startCountdown(() => {
      resetBall(Math.random() < 0.5 ? 1 : -1);
      gamePaused = false;
      gameLoop();
    });
  }

  // ======== INPUT ========
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    // Prevent scrolling with arrow keys
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
    // Escape to pause
    if (e.key === 'Escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
  });

  // ======== UI EVENTS ========

  // Score option selection
  document.querySelectorAll('.score-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.score-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Start
  $('startBtn').addEventListener('click', () => {
    SFX.init();
    const sel = document.querySelector('input[name="maxScore"]:checked');
    maxScore = parseInt(sel.value) || 10;
    $('scoreTarget').textContent = `First to ${maxScore}`;

    $('setupOverlay').style.display = 'none';
    $('gameArea').style.display = 'flex';
    startGame();
  });

  // Menu
  $('menuBtn').addEventListener('click', () => {
    gameRunning = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    $('gameArea').style.display = 'none';
    $('resultsOverlay').style.display = 'none';
    $('setupOverlay').style.display = 'flex';
  });

  // Rematch
  $('rematchBtn').addEventListener('click', () => {
    $('resultsOverlay').style.display = 'none';
    startGame();
  });

  // Back to menu from results
  $('backMenuBtn').addEventListener('click', () => {
    $('resultsOverlay').style.display = 'none';
    $('gameArea').style.display = 'none';
    $('setupOverlay').style.display = 'flex';
  });

})();
