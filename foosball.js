(function () {
  'use strict';

  const W = 960;
  const H = 540;
  const PAD = 32;
  const GOAL_H = 174;
  const BALL_R = 10;
  const FIG_W = 22;
  const FIG_H = 40;
  const FIXED_STEP = 1 / 120;
  const ROD_SPEED = 350;
  const BALL_MAX_SPEED = 850;
  const KICK_POWER = 650;
  const COLORS = {
    red: '#f05245',
    redDark: '#922921',
    blue: '#36a9d6',
    blueDark: '#155b7a',
    gold: '#f2bd4e',
    felt: '#167663',
    feltDark: '#0c4b41',
    cream: '#f5efe1'
  };

  const dom = {
    setup: document.getElementById('setupOverlay'),
    setupCanvas: document.getElementById('setupCanvas'),
    gameArea: document.getElementById('gameArea'),
    canvas: document.getElementById('gameCanvas'),
    gameTools: document.getElementById('gameTools'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    pauseOverlay: document.getElementById('pauseOverlay'),
    resultsOverlay: document.getElementById('resultsOverlay'),
    resumeBtn: document.getElementById('resumeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    menuBtn: document.getElementById('menuBtn'),
    rematchBtn: document.getElementById('rematchBtn'),
    backMenuBtn: document.getElementById('backMenuBtn'),
    difficultyGroup: document.getElementById('difficultyGroup'),
    blueControls: document.getElementById('blueControls'),
    scoreRed: document.getElementById('scoreRed'),
    scoreBlue: document.getElementById('scoreBlue'),
    redName: document.getElementById('redName'),
    blueName: document.getElementById('blueName'),
    scoreTarget: document.getElementById('scoreTarget'),
    rallyText: document.getElementById('rallyText'),
    footerBlue: document.getElementById('footerBlue'),
    matchBanner: document.getElementById('matchBanner'),
    bannerKicker: document.getElementById('bannerKicker'),
    bannerText: document.getElementById('bannerText'),
    goalFlash: document.getElementById('goalFlash'),
    goalTeam: document.getElementById('goalTeam'),
    callout: document.getElementById('callout'),
    shotSpeed: document.getElementById('shotSpeed'),
    resultKicker: document.getElementById('resultsKicker'),
    resultHeadline: document.getElementById('resultsHeadline'),
    resultSub: document.getElementById('resultsSub'),
    resultRally: document.getElementById('resultRally'),
    resultSpeed: document.getElementById('resultSpeed')
  };

  const ctx = dom.canvas.getContext('2d');
  const setupCtx = dom.setupCanvas.getContext('2d');
  const goalTop = (H - GOAL_H) / 2;
  const goalBottom = goalTop + GOAL_H;
  const keys = Object.create(null);
  const touch = { up: false, down: false };
  const particles = [];
  const trail = [];

  let mode = 'solo';
  let difficulty = 'skilled';
  let maxScore = 5;
  let phase = 'setup';
  let scoreRed = 0;
  let scoreBlue = 0;
  let rally = 0;
  let longestRally = 0;
  let fastestShot = 0;
  let currentShot = 0;
  let shotAge = 99;
  let lastTouch = 0;
  let accumulator = 0;
  let lastTime = performance.now();
  let sequenceToken = 0;
  let calloutTimer = 0;
  let shake = 0;
  let setupBallTime = 0;
  let audioContext = null;

  const ball = {
    x: W / 2,
    y: H / 2,
    vx: 0,
    vy: 0,
    rotation: 0,
    contactCooldown: 0,
    stuckTime: 0
  };

  const kick = {
    1: { timer: 0, cooldown: 0, dir: 1 },
    2: { timer: 0, cooldown: 0, dir: -1 }
  };

  const rodSpec = [
    { player: 1, x: 90, count: 1 },
    { player: 2, x: 192, count: 3 },
    { player: 1, x: 300, count: 2 },
    { player: 2, x: 410, count: 5 },
    { player: 1, x: 550, count: 5 },
    { player: 2, x: 660, count: 2 },
    { player: 1, x: 768, count: 3 },
    { player: 2, x: 870, count: 1 }
  ];

  const rods = rodSpec.map((spec) => ({
    ...spec,
    offset: 0,
    velocity: 0,
    maxOffset: getRodMaxOffset(spec.count)
  }));

  const ai = {
    target: 0,
    thinkTimer: 0,
    offset: 0,
    velocity: 0
  };

  const AI_LEVELS = {
    rookie: { reaction: 0.22, speed: 235, error: 46, kickChance: 0.58 },
    skilled: { reaction: 0.12, speed: 315, error: 21, kickChance: 0.82 },
    champion: { reaction: 0.07, speed: 385, error: 9, kickChance: 0.96 }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function getRodMaxOffset(count) {
    const spacing = (H - PAD * 2) / (count + 1);
    return Math.max(38, spacing * 0.55);
  }

  function figureBaseY(rod, index) {
    return PAD + ((index + 1) * (H - PAD * 2)) / (rod.count + 1);
  }

  function figureY(rod, index) {
    return figureBaseY(rod, index) + rod.offset;
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function ensureAudio() {
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
  }

  function tone(frequency, duration, type, volume, endFrequency) {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(volume || 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  const sfx = {
    kick(perfect) {
      tone(perfect ? 170 : 130, 0.075, 'square', perfect ? 0.1 : 0.065, perfect ? 520 : 260);
    },
    rail() {
      tone(185, 0.04, 'triangle', 0.035, 120);
    },
    whistle() {
      tone(850, 0.1, 'sine', 0.045, 1120);
      window.setTimeout(() => tone(1050, 0.13, 'sine', 0.04, 800), 100);
    },
    goal() {
      tone(180, 0.18, 'sawtooth', 0.08, 350);
      window.setTimeout(() => tone(360, 0.22, 'square', 0.065, 620), 120);
    },
    countdown(value) {
      tone(value === 'PLAY' ? 720 : 420, value === 'PLAY' ? 0.18 : 0.08, 'sine', 0.05, value === 'PLAY' ? 980 : 460);
    }
  };

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function selectedValue(name) {
    const selected = document.querySelector(`input[name="${name}"]:checked`);
    return selected ? selected.value : '';
  }

  function updateSetupSelection() {
    mode = selectedValue('gameMode') || 'solo';
    difficulty = selectedValue('difficulty') || 'skilled';

    document.querySelectorAll('.select-option').forEach((option) => {
      option.classList.toggle('selected', option.querySelector('input').checked);
    });

    dom.difficultyGroup.classList.toggle('hidden', mode === 'duel');
    if (mode === 'duel') {
      dom.blueControls.innerHTML = '<span class="crew-name"><i data-lucide="circle"></i> Blue</span><span><kbd>↑</kbd><kbd>↓</kbd> Slide</span><span><kbd>←</kbd><kbd>→</kbd> Strike</span>';
    } else {
      dom.blueControls.innerHTML = '<span class="crew-name"><i data-lucide="bot"></i> Table Bot</span><span>Blue side is automated</span>';
    }
    refreshIcons();
  }

  function resetRods() {
    rods.forEach((rod) => {
      rod.offset = 0;
      rod.velocity = 0;
    });
    ai.target = 0;
    ai.offset = 0;
    ai.velocity = 0;
    ai.thinkTimer = 0;
    kick[1].timer = 0;
    kick[1].cooldown = 0;
    kick[2].timer = 0;
    kick[2].cooldown = 0;
  }

  function resetBall(direction) {
    ball.x = W / 2;
    ball.y = H / 2 + (Math.random() - 0.5) * 62;
    ball.vx = (direction || (Math.random() < 0.5 ? -1 : 1)) * 275;
    ball.vy = (Math.random() - 0.5) * 150;
    ball.rotation = 0;
    ball.contactCooldown = 0;
    ball.stuckTime = 0;
    trail.length = 0;
    currentShot = 0;
    shotAge = 99;
    dom.shotSpeed.textContent = '0';
  }

  function resetMatch() {
    sequenceToken += 1;
    scoreRed = 0;
    scoreBlue = 0;
    rally = 0;
    longestRally = 0;
    fastestShot = 0;
    currentShot = 0;
    lastTouch = 0;
    calloutTimer = 0;
    particles.length = 0;
    resetRods();
    updateHud();
    resetBall(Math.random() < 0.5 ? -1 : 1);
  }

  function updateHud() {
    dom.scoreRed.textContent = scoreRed;
    dom.scoreBlue.textContent = scoreBlue;
    dom.scoreTarget.textContent = `First to ${maxScore}`;
    dom.rallyText.textContent = rally > 0 ? `Rally ${rally}` : (phase === 'playing' ? 'Open play' : 'Kickoff');
  }

  function startMatch() {
    ensureAudio();
    mode = selectedValue('gameMode') || 'solo';
    difficulty = selectedValue('difficulty') || 'skilled';
    maxScore = Number(selectedValue('maxScore')) || 5;
    document.body.classList.toggle('solo-mode', mode === 'solo');
    dom.setup.classList.add('hidden');
    dom.gameArea.classList.remove('hidden');
    dom.gameTools.classList.remove('hidden');
    dom.pauseOverlay.classList.add('hidden');
    dom.resultsOverlay.classList.add('hidden');
    dom.redName.textContent = 'Red';
    dom.blueName.textContent = mode === 'solo' ? 'Table Bot' : 'Blue';
    dom.footerBlue.textContent = mode === 'solo'
      ? `${difficulty[0].toUpperCase()}${difficulty.slice(1)} table bot`
      : 'Arrow keys slide and strike';
    resetMatch();
    startCountdown('Kickoff');
  }

  function startCountdown(kicker) {
    const token = ++sequenceToken;
    phase = 'countdown';
    clearMovement();
    dom.goalFlash.classList.add('hidden');
    dom.matchBanner.classList.remove('hidden');
    dom.bannerKicker.textContent = kicker || 'Kickoff';
    const steps = ['3', '2', '1', 'PLAY'];
    let index = 0;

    function showStep() {
      if (token !== sequenceToken || phase !== 'countdown') return;
      const value = steps[index];
      dom.bannerText.textContent = value;
      sfx.countdown(value);
      index += 1;
      if (index < steps.length) {
        window.setTimeout(showStep, value === '3' ? 620 : 560);
      } else {
        window.setTimeout(() => {
          if (token !== sequenceToken || phase !== 'countdown') return;
          dom.matchBanner.classList.add('hidden');
          phase = 'playing';
          updateHud();
        }, 470);
      }
    }
    showStep();
  }

  function clearMovement() {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    touch.up = false;
    touch.down = false;
  }

  function triggerKick(player, direction) {
    if (phase !== 'playing') return;
    const state = kick[player];
    if (state.cooldown > 0) return;
    state.dir = direction;
    state.timer = 0.14;
    state.cooldown = 0.27;
  }

  function playerInput(player) {
    if (player === 1) {
      return (keys.w || touch.up ? -1 : 0) + (keys.s || touch.down ? 1 : 0);
    }
    return (keys.arrowup ? -1 : 0) + (keys.arrowdown ? 1 : 0);
  }

  function updateHumanRods(player, dt) {
    const input = playerInput(player);
    const targetVelocity = input * ROD_SPEED;
    rods.forEach((rod) => {
      if (rod.player !== player) return;
      rod.velocity = lerp(rod.velocity, targetVelocity, Math.min(1, dt * 20));
      if (!input) rod.velocity *= Math.pow(0.001, dt);
      const previous = rod.offset;
      rod.offset = clamp(rod.offset + rod.velocity * dt, -rod.maxOffset, rod.maxOffset);
      if (rod.offset === -rod.maxOffset || rod.offset === rod.maxOffset) {
        if (Math.abs(rod.offset - previous) < 0.01) rod.velocity = 0;
      }
    });
  }

  function nearestFigureBase(rod, targetY) {
    let best = figureBaseY(rod, 0);
    let distance = Infinity;
    for (let i = 0; i < rod.count; i += 1) {
      const base = figureBaseY(rod, i);
      if (Math.abs(base - targetY) < distance) {
        distance = Math.abs(base - targetY);
        best = base;
      }
    }
    return best;
  }

  function predictBallY(targetX) {
    if (Math.abs(ball.vx) < 12) return ball.y;
    const seconds = (targetX - ball.x) / ball.vx;
    if (seconds <= 0 || seconds > 1.3) return ball.y;
    let predicted = ball.y + ball.vy * seconds;
    const top = PAD + BALL_R;
    const bottom = H - PAD - BALL_R;
    const range = bottom - top;
    let relative = (predicted - top) % (range * 2);
    if (relative < 0) relative += range * 2;
    if (relative > range) relative = range * 2 - relative;
    predicted = top + relative;
    return predicted;
  }

  function updateAi(dt) {
    const settings = AI_LEVELS[difficulty];
    ai.thinkTimer -= dt;

    if (ai.thinkTimer <= 0) {
      ai.thinkTimer = settings.reaction;
      const blueRods = rods.filter((rod) => rod.player === 2);
      let chosen = blueRods[0];
      let bestDistance = Infinity;
      blueRods.forEach((rod) => {
        const distance = Math.abs(rod.x - ball.x);
        if (distance < bestDistance) {
          bestDistance = distance;
          chosen = rod;
        }
      });

      const predictedY = predictBallY(chosen.x);
      const error = (Math.random() - 0.5) * settings.error * 2;
      ai.target = clamp(predictedY - nearestFigureBase(chosen, predictedY) + error, -chosen.maxOffset, chosen.maxOffset);

      if (kick[2].cooldown <= 0 && Math.abs(ball.x - chosen.x) < 42) {
        let closeToFigure = false;
        for (let i = 0; i < chosen.count; i += 1) {
          if (Math.abs(ball.y - figureY(chosen, i)) < FIG_H * 0.78) closeToFigure = true;
        }
        if (closeToFigure && Math.random() < settings.kickChance) triggerKick(2, -1);
      }
    }

    const difference = ai.target - ai.offset;
    const targetVelocity = clamp(difference * 8, -settings.speed, settings.speed);
    ai.velocity = lerp(ai.velocity, targetVelocity, Math.min(1, dt * 10));
    ai.offset += ai.velocity * dt;

    rods.forEach((rod) => {
      if (rod.player !== 2) return;
      const next = clamp(ai.offset, -rod.maxOffset, rod.maxOffset);
      rod.velocity = (next - rod.offset) / dt;
      rod.offset = next;
    });
  }

  function recordContact(player, perfect, speed) {
    if (lastTouch !== player) {
      rally += 1;
      lastTouch = player;
      longestRally = Math.max(longestRally, rally);
      updateHud();
    }

    currentShot = Math.round(speed * 0.145);
    fastestShot = Math.max(fastestShot, currentShot);
    shotAge = 0;
    dom.shotSpeed.textContent = currentShot;
    if (perfect) showCallout('Perfect strike');
  }

  function showCallout(message) {
    calloutTimer += 1;
    const token = calloutTimer;
    dom.callout.textContent = message;
    dom.callout.classList.remove('hidden');
    window.setTimeout(() => {
      if (calloutTimer === token) dom.callout.classList.add('hidden');
    }, 900);
  }

  function emitImpact(x, y, color, amount, force) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.35 + Math.random() * 0.65) * force;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.34,
        maxLife: 0.62,
        size: 2 + Math.random() * 3,
        color
      });
    }
  }

  function collideFigures() {
    if (ball.contactCooldown > 0) return;
    const halfW = FIG_W / 2 + BALL_R;
    const halfH = FIG_H / 2 + BALL_R;

    for (let r = 0; r < rods.length; r += 1) {
      const rod = rods[r];
      if (Math.abs(ball.x - rod.x) > halfW + 5) continue;
      for (let i = 0; i < rod.count; i += 1) {
        const fy = figureY(rod, i);
        if (Math.abs(ball.y - fy) > halfH + 4) continue;

        const closestX = clamp(ball.x, rod.x - FIG_W / 2, rod.x + FIG_W / 2);
        const closestY = clamp(ball.y, fy - FIG_H / 2, fy + FIG_H / 2);
        let dx = ball.x - closestX;
        let dy = ball.y - closestY;
        let distance = Math.hypot(dx, dy);
        if (distance >= BALL_R) continue;
        if (distance < 0.001) {
          dx = ball.x < rod.x ? -1 : 1;
          dy = 0;
          distance = 1;
        }
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = BALL_R - distance + 0.5;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const state = kick[rod.player];
        if (state.timer > 0) {
          const sweet = 1 - Math.min(1, Math.abs(ball.y - fy) / (FIG_H * 0.78));
          const attackDir = rod.player === 1 ? 1 : -1;
          const perfect = sweet > 0.72 && state.dir === attackDir;
          const power = KICK_POWER * (0.88 + sweet * 0.22 + (perfect ? 0.12 : 0));
          ball.vx = state.dir * power;
          ball.vy = clamp((ball.y - fy) * 8.5 + rod.velocity * 0.24, -430, 430);
          state.timer = 0;
          recordContact(rod.player, perfect, Math.hypot(ball.vx, ball.vy));
          emitImpact(ball.x, ball.y, perfect ? COLORS.gold : (rod.player === 1 ? COLORS.red : COLORS.blue), perfect ? 12 : 7, perfect ? 160 : 110);
          sfx.kick(perfect);
          shake = perfect ? 7 : 3;
        } else {
          const relative = ball.vx * nx + (ball.vy - rod.velocity * 0.16) * ny;
          if (relative < 0) {
            ball.vx -= 1.82 * relative * nx;
            ball.vy -= 1.82 * relative * ny;
          } else {
            ball.vx += nx * 55;
            ball.vy += ny * 55;
          }
          ball.vy += rod.velocity * 0.18;
          ball.vx += rod.player === 1 ? 18 : -18;
          recordContact(rod.player, false, Math.hypot(ball.vx, ball.vy));
          sfx.kick(false);
        }
        ball.contactCooldown = 0.045;
        return;
      }
    }
  }

  function updateBall(dt) {
    ball.contactCooldown = Math.max(0, ball.contactCooldown - dt);
    const damping = Math.pow(0.9965, dt * 60);
    ball.vx *= damping;
    ball.vy *= damping;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += (ball.vx * 0.012 + ball.vy * 0.004) * dt;

    if (ball.y - BALL_R < PAD) {
      ball.y = PAD + BALL_R;
      ball.vy = Math.abs(ball.vy) * 0.92;
      sfx.rail();
    } else if (ball.y + BALL_R > H - PAD) {
      ball.y = H - PAD - BALL_R;
      ball.vy = -Math.abs(ball.vy) * 0.92;
      sfx.rail();
    }

    const inGoal = ball.y > goalTop + BALL_R * 0.15 && ball.y < goalBottom - BALL_R * 0.15;
    if (!inGoal) {
      if (ball.x - BALL_R < PAD) {
        ball.x = PAD + BALL_R;
        ball.vx = Math.abs(ball.vx) * 0.92;
        sfx.rail();
      } else if (ball.x + BALL_R > W - PAD) {
        ball.x = W - PAD - BALL_R;
        ball.vx = -Math.abs(ball.vx) * 0.92;
        sfx.rail();
      }
    } else if (ball.x < -BALL_R * 1.5) {
      scoreGoal(2);
      return;
    } else if (ball.x > W + BALL_R * 1.5) {
      scoreGoal(1);
      return;
    }

    collideFigures();

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }

    if (speed < 100) {
      ball.stuckTime += dt;
      if (ball.stuckTime > 0.9) {
        const direction = ball.x < W / 2 ? 1 : -1;
        ball.vx += direction * 250;
        ball.vy += (Math.random() - 0.5) * 170;
        ball.stuckTime = 0;
        showCallout('Ball released');
      }
    } else {
      ball.stuckTime = 0;
    }

    trail.unshift({ x: ball.x, y: ball.y, life: 1 });
    if (trail.length > 12) trail.pop();
  }

  function scoreGoal(player) {
    if (phase !== 'playing') return;
    phase = 'goal';
    sequenceToken += 1;
    clearMovement();
    longestRally = Math.max(longestRally, rally);
    if (player === 1) scoreRed += 1;
    else scoreBlue += 1;
    updateHud();
    dom.goalTeam.textContent = player === 1 ? 'Red' : (mode === 'solo' ? 'Table Bot' : 'Blue');
    dom.goalTeam.style.color = player === 1 ? COLORS.red : COLORS.blue;
    dom.goalFlash.classList.remove('hidden');
    emitImpact(player === 1 ? W - 55 : 55, H / 2, player === 1 ? COLORS.red : COLORS.blue, 32, 250);
    shake = 13;
    sfx.goal();

    const matchWon = scoreRed >= maxScore || scoreBlue >= maxScore;
    window.setTimeout(() => {
      if (phase !== 'goal') return;
      dom.goalFlash.classList.add('hidden');
      if (matchWon) {
        finishMatch();
      } else {
        rally = 0;
        lastTouch = 0;
        resetBall(player === 1 ? -1 : 1);
        startCountdown('Next ball');
      }
    }, 1450);
  }

  function finishMatch() {
    phase = 'results';
    const redWon = scoreRed > scoreBlue;
    dom.resultKicker.textContent = mode === 'solo' && redWon ? 'Cup claimed' : 'Match complete';
    dom.resultHeadline.textContent = redWon ? 'Red Wins' : (mode === 'solo' ? 'Table Bot Wins' : 'Blue Wins');
    dom.resultHeadline.style.color = redWon ? COLORS.red : COLORS.blue;
    dom.resultSub.innerHTML = `${scoreRed} <span>–</span> ${scoreBlue}`;
    dom.resultRally.textContent = longestRally;
    dom.resultSpeed.textContent = `${fastestShot} km/h`;
    dom.resultsOverlay.classList.remove('hidden');
  }

  function updateEffects(dt) {
    shake = Math.max(0, shake - dt * 26);
    shotAge += dt;
    if (shotAge > 2.2 && currentShot !== 0) {
      currentShot = 0;
      dom.shotSpeed.textContent = '0';
    }
    trail.forEach((point) => { point.life -= dt * 3.2; });
    while (trail.length && trail[trail.length - 1].life <= 0) trail.pop();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.07, dt);
      particle.vy *= Math.pow(0.07, dt);
      if (particle.life <= 0) particles.splice(i, 1);
    }
  }

  function updateGame(dt) {
    kick[1].timer = Math.max(0, kick[1].timer - dt);
    kick[1].cooldown = Math.max(0, kick[1].cooldown - dt);
    kick[2].timer = Math.max(0, kick[2].timer - dt);
    kick[2].cooldown = Math.max(0, kick[2].cooldown - dt);
    updateHumanRods(1, dt);
    if (mode === 'solo') updateAi(dt);
    else updateHumanRods(2, dt);
    updateBall(dt);
  }

  function drawTable() {
    const felt = ctx.createLinearGradient(0, PAD, 0, H - PAD);
    felt.addColorStop(0, '#1d846e');
    felt.addColorStop(0.5, COLORS.felt);
    felt.addColorStop(1, COLORS.feltDark);
    ctx.fillStyle = '#3b2016';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = felt;
    ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    ctx.clip();
    for (let x = PAD; x < W - PAD; x += 90) {
      ctx.fillStyle = x / 90 % 2 < 1 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)';
      ctx.fillRect(x, PAD, 90, H - PAD * 2);
    }

    ctx.strokeStyle = 'rgba(245, 239, 225, 0.66)';
    ctx.lineWidth = 3;
    ctx.strokeRect(PAD + 5, PAD + 5, W - (PAD + 5) * 2, H - (PAD + 5) * 2);
    ctx.beginPath();
    ctx.moveTo(W / 2, PAD + 5);
    ctx.lineTo(W / 2, H - PAD - 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(245, 239, 225, 0.72)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(245, 239, 225, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD + 5, H / 2 - 110, 112, 220);
    ctx.strokeRect(W - PAD - 117, H / 2 - 110, 112, 220);
    ctx.restore();

    const woodTop = ctx.createLinearGradient(0, 0, 0, PAD);
    woodTop.addColorStop(0, '#4a281b');
    woodTop.addColorStop(0.42, '#a76235');
    woodTop.addColorStop(1, '#6e3823');
    ctx.fillStyle = woodTop;
    ctx.fillRect(0, 0, W, PAD);
    ctx.save();
    ctx.translate(0, H);
    ctx.scale(1, -1);
    ctx.fillStyle = woodTop;
    ctx.fillRect(0, 0, W, PAD);
    ctx.restore();

    const woodSide = ctx.createLinearGradient(0, 0, PAD, 0);
    woodSide.addColorStop(0, '#4b281b');
    woodSide.addColorStop(0.45, '#985a34');
    woodSide.addColorStop(1, '#6d3824');
    ctx.fillStyle = woodSide;
    ctx.fillRect(0, PAD, PAD, goalTop - PAD);
    ctx.fillRect(0, goalBottom, PAD, H - goalBottom - PAD);
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.fillStyle = woodSide;
    ctx.fillRect(0, PAD, PAD, goalTop - PAD);
    ctx.fillRect(0, goalBottom, PAD, H - goalBottom - PAD);
    ctx.restore();

    drawGoal(0, false);
    drawGoal(W, true);

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, PAD);
    ctx.lineTo(W, PAD);
    ctx.moveTo(0, H - PAD);
    ctx.lineTo(W, H - PAD);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 56; x < W; x += 112) {
      ctx.fillRect(x, 10, 50, 3);
      ctx.fillRect(x, H - 13, 50, 3);
    }
  }

  function drawGoal(edge, right) {
    ctx.save();
    const direction = right ? 1 : -1;
    ctx.translate(edge, goalTop);
    ctx.fillStyle = '#0b1719';
    ctx.fillRect(right ? 0 : -34, 0, 34, GOAL_H);
    ctx.strokeStyle = 'rgba(225, 233, 225, 0.35)';
    ctx.lineWidth = 1;
    for (let y = 10; y < GOAL_H; y += 13) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(direction * 32, y);
      ctx.stroke();
    }
    for (let x = 7; x < 34; x += 8) {
      ctx.beginPath();
      ctx.moveTo(direction * x, 0);
      ctx.lineTo(direction * x, GOAL_H);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d8d5c8';
    ctx.lineWidth = 5;
    ctx.strokeRect(right ? -2 : -32, 0, 34, GOAL_H);
    ctx.restore();
  }

  function drawRods() {
    rods.forEach((rod) => {
      const isRed = rod.player === 1;
      const color = isRed ? COLORS.red : COLORS.blue;
      const dark = isRed ? COLORS.redDark : COLORS.blueDark;
      const kickState = kick[rod.player];
      const kickProgress = kickState.timer > 0 ? kickState.timer / 0.14 : 0;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.33)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 2;
      ctx.strokeStyle = '#172126';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(rod.x, -8);
      ctx.lineTo(rod.x, H + 8);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      const metal = ctx.createLinearGradient(rod.x - 3, 0, rod.x + 3, 0);
      metal.addColorStop(0, '#65777c');
      metal.addColorStop(0.48, '#e0e7e5');
      metal.addColorStop(1, '#53666b');
      ctx.strokeStyle = metal;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rod.x, -8);
      ctx.lineTo(rod.x, H + 8);
      ctx.stroke();

      const handleY = isRed ? H - 19 : 19;
      ctx.fillStyle = dark;
      roundedRect(ctx, rod.x - 11, handleY - 16, 22, 32, 5);
      ctx.fill();
      ctx.fillStyle = color;
      roundedRect(ctx, rod.x - 8, handleY - 13, 16, 26, 4);
      ctx.fill();

      for (let i = 0; i < rod.count; i += 1) {
        drawFigure(rod.x, figureY(rod, i), color, dark, rod.player, kickState.dir, kickProgress);
      }
      ctx.restore();
    });
  }

  function drawFigure(x, y, color, dark, player, kickDirection, kickProgress) {
    const lean = kickProgress > 0 ? Math.sin(kickProgress * Math.PI) * kickDirection * 7 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(0,0,0,0.38)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = '#d9b184';
    ctx.beginPath();
    ctx.arc(lean * 0.35, -16, 6.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = dark;
    roundedRect(ctx, -10 + lean * 0.35, -11, 20, 25, 5);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(ctx, -8 + lean * 0.35, -10, 16, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(-5 + lean * 0.35, -6, 10, 3);

    ctx.strokeStyle = dark;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5 + lean * 0.25, 10);
    ctx.lineTo(-7 - lean, 19);
    ctx.moveTo(5 + lean * 0.25, 10);
    ctx.lineTo(7 + lean, 19);
    ctx.stroke();
    ctx.fillStyle = '#192126';
    roundedRect(ctx, -13 - lean, 16, 11, 5, 2);
    ctx.fill();
    roundedRect(ctx, 2 + lean, 16, 11, 5, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    trail.forEach((point, index) => {
      if (index === 0 || point.life <= 0) return;
      ctx.fillStyle = `rgba(242, 189, 78, ${point.life * 0.18})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, BALL_R * point.life * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 5;
    const gradient = ctx.createRadialGradient(-3, -4, 1, 0, 0, BALL_R);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.7, '#f4eee0');
    gradient.addColorStop(1, '#b8b3a7');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#222b2e';
    ctx.beginPath();
    ctx.arc(0, 0, 3.1, 0, Math.PI * 2);
    ctx.arc(-5, -5, 2.2, 0, Math.PI * 2);
    ctx.arc(5, 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach((particle) => {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.67);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function renderGame() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.clearRect(-20, -20, W + 40, H + 40);
    drawTable();
    drawRods();
    drawBall();
    drawParticles();
    drawVignette();
    ctx.restore();
  }

  function resizeSetupCanvas() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    dom.setupCanvas.width = Math.floor(window.innerWidth * ratio);
    dom.setupCanvas.height = Math.floor(window.innerHeight * ratio);
    dom.setupCanvas.style.width = `${window.innerWidth}px`;
    dom.setupCanvas.style.height = `${window.innerHeight}px`;
    setupCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function drawSetupScene(dt) {
    if (dom.setup.classList.contains('hidden')) return;
    setupBallTime += dt;
    const width = window.innerWidth;
    const height = window.innerHeight;
    setupCtx.clearRect(0, 0, width, height);

    const bg = setupCtx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0c171b');
    bg.addColorStop(0.56, '#173039');
    bg.addColorStop(1, '#10181b');
    setupCtx.fillStyle = bg;
    setupCtx.fillRect(0, 0, width, height);

    const tableW = Math.max(600, width * 0.62);
    const tableH = Math.max(340, height * 0.62);
    const centerX = width * 0.76;
    const centerY = height * 0.52;
    setupCtx.save();
    setupCtx.translate(centerX, centerY);
    setupCtx.rotate(-0.12);
    setupCtx.transform(1, -0.02, -0.28, 0.72, 0, 0);
    setupCtx.shadowColor = 'rgba(0,0,0,0.55)';
    setupCtx.shadowBlur = 55;
    setupCtx.fillStyle = '#6c3824';
    roundedRect(setupCtx, -tableW / 2 - 22, -tableH / 2 - 22, tableW + 44, tableH + 44, 10);
    setupCtx.fill();
    setupCtx.shadowColor = 'transparent';
    const felt = setupCtx.createLinearGradient(0, -tableH / 2, 0, tableH / 2);
    felt.addColorStop(0, '#25826f');
    felt.addColorStop(1, '#0b5547');
    setupCtx.fillStyle = felt;
    setupCtx.fillRect(-tableW / 2, -tableH / 2, tableW, tableH);
    setupCtx.strokeStyle = 'rgba(255,255,255,0.54)';
    setupCtx.lineWidth = 3;
    setupCtx.strokeRect(-tableW / 2 + 12, -tableH / 2 + 12, tableW - 24, tableH - 24);
    setupCtx.beginPath();
    setupCtx.moveTo(0, -tableH / 2 + 12);
    setupCtx.lineTo(0, tableH / 2 - 12);
    setupCtx.stroke();
    setupCtx.beginPath();
    setupCtx.arc(0, 0, tableH * 0.16, 0, Math.PI * 2);
    setupCtx.stroke();

    const rodXs = [-tableW * 0.4, -tableW * 0.28, -tableW * 0.14, 0, tableW * 0.14, tableW * 0.28, tableW * 0.4];
    rodXs.forEach((x, index) => {
      setupCtx.strokeStyle = 'rgba(220,230,231,0.75)';
      setupCtx.lineWidth = 5;
      setupCtx.beginPath();
      setupCtx.moveTo(x, -tableH / 2 - 36);
      setupCtx.lineTo(x, tableH / 2 + 36);
      setupCtx.stroke();
      const color = index % 2 ? COLORS.red : COLORS.blue;
      const count = index === 3 ? 5 : (index % 3 === 0 ? 1 : 3);
      for (let i = 0; i < count; i += 1) {
        const y = -tableH * 0.34 + (i + 1) * (tableH * 0.68) / (count + 1);
        setupCtx.fillStyle = color;
        roundedRect(setupCtx, x - 13, y - 24, 26, 48, 6);
        setupCtx.fill();
        setupCtx.fillStyle = '#d6af84';
        setupCtx.beginPath();
        setupCtx.arc(x, y - 29, 8, 0, Math.PI * 2);
        setupCtx.fill();
      }
    });

    const travel = (Math.sin(setupBallTime * 1.25) * 0.5 + 0.5) * tableW * 0.64 - tableW * 0.32;
    const ballY = Math.sin(setupBallTime * 2.1) * tableH * 0.2;
    setupCtx.fillStyle = '#fff9ec';
    setupCtx.shadowColor = COLORS.gold;
    setupCtx.shadowBlur = 16;
    setupCtx.beginPath();
    setupCtx.arc(travel, ballY, 13, 0, Math.PI * 2);
    setupCtx.fill();
    setupCtx.restore();

    setupCtx.fillStyle = 'rgba(242,189,78,0.08)';
    setupCtx.fillRect(width * 0.54, 0, 2, height);
  }

  function pauseGame() {
    if (phase !== 'playing') return;
    phase = 'paused';
    sequenceToken += 1;
    clearMovement();
    dom.pauseOverlay.classList.remove('hidden');
  }

  function resumeGame() {
    if (phase !== 'paused') return;
    dom.pauseOverlay.classList.add('hidden');
    startCountdown('Ready');
  }

  function restartMatch() {
    dom.pauseOverlay.classList.add('hidden');
    dom.resultsOverlay.classList.add('hidden');
    resetMatch();
    startCountdown('Rematch');
  }

  function returnToSetup() {
    sequenceToken += 1;
    phase = 'setup';
    clearMovement();
    dom.pauseOverlay.classList.add('hidden');
    dom.resultsOverlay.classList.add('hidden');
    dom.matchBanner.classList.add('hidden');
    dom.goalFlash.classList.add('hidden');
    dom.gameArea.classList.add('hidden');
    dom.gameTools.classList.add('hidden');
    dom.setup.classList.remove('hidden');
    document.body.classList.remove('solo-mode');
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (error) {
      console.warn('Fullscreen is unavailable:', error);
    }
  }

  function updateFullscreenIcon() {
    const active = Boolean(document.fullscreenElement);
    dom.fullscreenBtn.innerHTML = `<i data-lucide="${active ? 'minimize' : 'maximize'}"></i>`;
    dom.fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
    dom.fullscreenBtn.title = active ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
    refreshIcons();
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    const gameKey = ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'f'].includes(key);
    if (gameKey && phase !== 'setup') event.preventDefault();
    keys[key] = true;
    if (event.repeat) return;
    ensureAudio();
    if (key === 'a') triggerKick(1, -1);
    else if (key === 'd') triggerKick(1, 1);
    else if (mode === 'duel' && key === 'arrowleft') triggerKick(2, -1);
    else if (mode === 'duel' && key === 'arrowright') triggerKick(2, 1);
    else if (key === 'escape') {
      if (phase === 'playing') pauseGame();
      else if (phase === 'paused') resumeGame();
    } else if (key === 'f') toggleFullscreen();
  }

  function onKeyUp(event) {
    keys[event.key.toLowerCase()] = false;
  }

  function bindTouchControls() {
    document.querySelectorAll('[data-touch]').forEach((button) => {
      const direction = button.dataset.touch;
      const setValue = (value) => {
        touch[direction] = value;
        if (value) ensureAudio();
      };
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        setValue(true);
      });
      button.addEventListener('pointerup', () => setValue(false));
      button.addEventListener('pointercancel', () => setValue(false));
      button.addEventListener('lostpointercapture', () => setValue(false));
    });

    document.querySelectorAll('[data-kick]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        ensureAudio();
        triggerKick(1, Number(button.dataset.kick));
      });
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    drawSetupScene(dt);
    updateEffects(dt);

    if (phase === 'playing') {
      accumulator = Math.min(accumulator + dt, 0.08);
      while (accumulator >= FIXED_STEP) {
        updateGame(FIXED_STEP);
        accumulator -= FIXED_STEP;
        if (phase !== 'playing') {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }

    if (phase !== 'setup') renderGame();
    requestAnimationFrame(frame);
  }

  document.querySelectorAll('input[name="gameMode"]').forEach((input) => input.addEventListener('change', updateSetupSelection));
  dom.startBtn.addEventListener('click', startMatch);
  dom.pauseBtn.addEventListener('click', pauseGame);
  dom.fullscreenBtn.addEventListener('click', toggleFullscreen);
  dom.resumeBtn.addEventListener('click', resumeGame);
  dom.restartBtn.addEventListener('click', restartMatch);
  dom.menuBtn.addEventListener('click', returnToSetup);
  dom.rematchBtn.addEventListener('click', restartMatch);
  dom.backMenuBtn.addEventListener('click', returnToSetup);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  window.addEventListener('blur', () => {
    clearMovement();
    if (phase === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && phase === 'playing') pauseGame();
  });
  window.addEventListener('resize', resizeSetupCanvas);

  bindTouchControls();
  resizeSetupCanvas();
  updateSetupSelection();
  updateFullscreenIcon();
  refreshIcons();
  requestAnimationFrame(frame);
})();
