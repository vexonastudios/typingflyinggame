'use strict';

const $ = id => document.getElementById(id);

// ─────────────────────────────────────────────────────────────
// Audio Engine
// ─────────────────────────────────────────────────────────────
function playSound(type) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window.audioCtx) window.audioCtx = new AudioContext();
  if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
  
  const ctx = window.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  
  if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'wrong') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'win') {
    [400, 500, 600, 800].forEach((f, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, ctx.currentTime);
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.3);
      }, i * 150);
    });
  } else if (type === 'launch') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 1.5);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
    osc.start(now);
    osc.stop(now + 1.5);
  }
}

// ─────────────────────────────────────────────────────────────
// Setup UI 
// ─────────────────────────────────────────────────────────────
const tableGrid = $('table-grid');
for (let i = 1; i <= 12; i++) {
  const lbl = document.createElement('label');
  lbl.className = 'table-chip';
  lbl.innerHTML = `
    <input type="checkbox" value="${i}" ${i >= 2 && i <= 10 ? 'checked' : ''}>
    <div class="table-chip-label">${i}</div>
  `;
  tableGrid.appendChild(lbl);
}

$('btn-all').addEventListener('click', () => {
  document.querySelectorAll('.table-chip input').forEach(cb => cb.checked = true);
});
$('btn-hard').addEventListener('click', () => {
  document.querySelectorAll('.table-chip input').forEach(cb => {
    cb.checked = (cb.value >= 6 && cb.value <= 9);
  });
});
$('btn-clear').addEventListener('click', () => {
  document.querySelectorAll('.table-chip input').forEach(cb => cb.checked = false);
});

// ─────────────────────────────────────────────────────────────
// Game State
// ─────────────────────────────────────────────────────────────
let state = {
  queue: [],
  misses: {}, // { "7x8": { q: "7 × 8", a: 56, count: 2 } }
  currentObj: null,
  
  targetCount: 30, // 0 means endless
  completedCount: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  
  startTime: 0,
  totalAttempts: 0,
  
  isCorrectionMode: false
};

// ─────────────────────────────────────────────────────────────
// Game Loop & Logic
// ─────────────────────────────────────────────────────────────
$('btn-launch').addEventListener('click', startGame);
$('btn-replay').addEventListener('click', startGame);
$('btn-exit-game').addEventListener('click', () => {
  $('screen-game').classList.remove('active');
  $('screen-setup').classList.add('active');
});

function startGame() {
  const selectedTables = Array.from(document.querySelectorAll('.table-chip input:checked')).map(cb => parseInt(cb.value));
  if (selectedTables.length === 0) {
    alert("Please select at least one times table to practice.");
    return;
  }

  const range = parseInt($('sel-range').value);
  state.targetCount = parseInt($('sel-questions').value);
  
  // Build initial pool of possible facts
  const pool = [];
  selectedTables.forEach(t => {
    for (let i = 1; i <= range; i++) {
      pool.push({ a: t, b: i, ans: t * i });
    }
  });

  // Shuffle pool
  pool.sort(() => Math.random() - 0.5);

  // If we have a target count, just take that many (looping if the pool is smaller)
  state.queue = [];
  const limit = state.targetCount > 0 ? state.targetCount : 999; 
  for (let i = 0; i < limit; i++) {
    state.queue.push(pool[i % pool.length]);
  }
  
  // Scramble the cut for the final queue
  state.queue.sort(() => Math.random() - 0.5);

  state.completedCount = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.misses = {};
  state.totalAttempts = 0;
  state.isCorrectionMode = false;
  state.startTime = performance.now();

  // Reset UI
  $('screen-setup').classList.remove('active');
  $('screen-results').classList.remove('active');
  $('screen-game').classList.add('active');
  $('rocket-ship').style.bottom = '80px';
  updateHUD();

  playSound('launch');
  nextQuestion();
}

function updateHUD() {
  $('hud-score').innerText = state.score;
  $('hud-streak').innerText = '🔥 ' + state.streak;
  
  if (state.totalAttempts > 0) {
    const acc = Math.round((state.completedCount / state.totalAttempts) * 100);
    $('hud-accuracy').innerText = acc + '%';
  } else {
    $('hud-accuracy').innerText = '—';
  }

  if (state.targetCount > 0) {
    $('hud-progress-text').innerText = `${state.completedCount} / ${state.targetCount}`;
    const pct = Math.min(100, (state.completedCount / state.targetCount) * 100);
    $('hud-progress-fill').style.width = pct + '%';
    
    // Move rocket
    const maxH = window.innerHeight - 160; 
    $('rocket-ship').style.bottom = (80 + maxH * (pct / 100)) + 'px';
  } else {
    $('hud-progress-text').innerText = `${state.completedCount}`;
    $('hud-progress-fill').style.width = '100%'; 
    $('rocket-ship').style.bottom = '50%'; // hover in mid air for endless
  }
}

function nextQuestion() {
  if (state.targetCount > 0 && state.completedCount >= state.targetCount) {
    endGame();
    return;
  }
  if (state.queue.length === 0) {
    // Endless mode ran out, just refill and keep going
    endGame(); 
    return;
  }

  state.currentObj = state.queue.shift();
  // Randomize swap AxB vs BxA slightly for variety
  let str = '';
  if (Math.random() > 0.5) {
    str = `${state.currentObj.a} × ${state.currentObj.b}`;
  } else {
    str = `${state.currentObj.b} × ${state.currentObj.a}`;
  }
  
  $('problem-text').innerText = str + ' = ?';
  $('answer-input').value = '';
  $('answer-input').className = 'answer-input'; // reset classes
  $('answer-input').focus();
}

// ─────────────────────────────────────────────────────────────
// Input Handling
// ─────────────────────────────────────────────────────────────
$('answer-input').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val.length > 0 && parseInt(val) === state.currentObj.ans) {
    // Auto-advance if perfectly correct and length matches right away
    // Wait, small delay so they see it was right
    if (!state.isCorrectionMode && val.length === String(state.currentObj.ans).length) {
      submitAnswer();
    }
  }
});

$('answer-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    submitAnswer();
  }
});
$('btn-submit').addEventListener('click', submitAnswer);

function submitAnswer() {
  if (state.isCorrectionMode) return; // Ignore main input if in correction panel
  
  const val = $('answer-input').value.trim();
  if (val === '') return;

  state.totalAttempts++;
  const isCorrect = (parseInt(val) === state.currentObj.ans);
  const card = $('problem-card');

  if (isCorrect) {
    // CORRECT
    playSound('correct');
    state.completedCount++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    
    // Combo multiplier
    const multi = Math.min(5, 1 + Math.floor(state.streak / 5));
    const points = 10 * multi;
    state.score += points;

    // Visuals
    $('answer-input').classList.add('correct');
    card.classList.remove('flash-correct', 'shake');
    void card.offsetWidth; // force reflow
    card.classList.add('flash-correct');

    if (multi > 1) {
      const cb = $('combo-badge');
      cb.innerText = `${multi}x MULTIPLIER!`;
      cb.classList.remove('hidden');
      cb.style.animation = 'none';
      void cb.offsetWidth;
      cb.style.animation = 'combo-pop 0.4s cubic-bezier(0.2,0.8,0.2,1)';
    }

    spawnFloatText(`+${points}`, window.innerWidth/2, window.innerHeight/2, '#34d399');

    updateHUD();
    setTimeout(() => {
      $('combo-badge').classList.add('hidden');
      nextQuestion();
    }, 400);

  } else {
    // WRONG
    playSound('wrong');
    state.streak = 0;
    
    $('answer-input').classList.add('wrong');
    card.classList.remove('flash-correct', 'shake');
    void card.offsetWidth;
    card.classList.add('shake');
    
    // Record miss
    const key = `${state.currentObj.a}x${state.currentObj.b}`;
    let str = `${state.currentObj.a} × ${state.currentObj.b}`;
    if (!state.misses[key]) {
      state.misses[key] = { q: str, ans: state.currentObj.ans, count: 0 };
    }
    state.misses[key].count++;

    // Spaced repetition: put this question back in the queue soon
    if (state.targetCount > 0) {
      // Re-insert into queue at a random spot within the next 2-4 questions
      const insertIdx = Math.min(state.queue.length, Math.floor(Math.random() * 3) + 1);
      state.queue.splice(insertIdx, 0, state.currentObj);
      state.targetCount++; // increase target count so we still do all
    }

    updateHUD();

    // Show correction Mode
    state.isCorrectionMode = true;
    $('correction-answer').innerText = state.currentObj.ans;
    $('correction-panel').classList.remove('hidden');
    $('correction-input').value = '';
    
    setTimeout(() => {
      $('correction-input').focus();
    }, 50);
  }
}

// Correction input enforcement
$('correction-input').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (parseInt(val) === state.currentObj.ans) {
    // Passed correction
    $('correction-panel').classList.add('hidden');
    state.isCorrectionMode = false;
    $('answer-input').value = '';
    $('answer-input').classList.remove('wrong');
    $('answer-input').focus();
    nextQuestion();
  }
});

// ─────────────────────────────────────────────────────────────
// Visual Floats
// ─────────────────────────────────────────────────────────────
function spawnFloatText(text, x, y, color) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.innerText = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// ─────────────────────────────────────────────────────────────
// End Game & Results
// ─────────────────────────────────────────────────────────────
function endGame() {
  playSound('win');
  const duration = ((performance.now() - state.startTime) / 1000).toFixed(1);
  const acc = state.totalAttempts > 0 ? Math.round((state.completedCount / state.totalAttempts) * 100) : 0;
  
  $('stat-score').innerText = state.score;
  $('stat-accuracy').innerText = acc + '%';
  $('stat-time').innerText = duration + 's';
  $('stat-best-streak').innerText = state.bestStreak;

  // Process weaknesses
  const missesArr = Object.values(state.misses).sort((a, b) => b.count - a.count);
  const wl = $('weak-list');
  wl.innerHTML = '';
  
  if (missesArr.length === 0) {
    wl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--green); font-weight:700;">Flawless victory! No misses!</div>`;
  } else {
    // Show top 5
    const topMisses = missesArr.slice(0, 5);
    const maxMiss = topMisses[0].count;
    
    topMisses.forEach(m => {
      const pct = (m.count / maxMiss) * 100;
      wl.innerHTML += `
        <div class="weak-row">
          <div class="weak-fact">${m.q}</div>
          <div class="weak-bar-wrap">
            <div class="weak-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="weak-miss-count">${m.count} miss${m.count > 1 ? 'es' : ''}</div>
        </div>
      `;
    });
  }

  $('screen-game').classList.remove('active');
  $('screen-results').classList.add('active');
}

// Generator for stars in the rocket track bg
const sbg = $('stars-bg');
for (let i = 0; i < 40; i++) {
  const s = document.createElement('div');
  s.style.position = 'absolute';
  s.style.background = '#fff';
  s.style.width = Math.random() * 2 + 1 + 'px';
  s.style.height = s.style.width;
  s.style.borderRadius = '50%';
  s.style.left = Math.random() * 100 + '%';
  s.style.top = Math.random() * 100 + '%';
  s.style.opacity = Math.random();
  sbg.appendChild(s);
}
