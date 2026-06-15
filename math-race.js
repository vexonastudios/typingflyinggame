const $ = id => document.getElementById(id);

let state = {
  mode: 1, // 1=solo, 2=2p, 3=3p
  players: [],
  questionCount: 0,
  maxWins: 1, // e.g. best of X (requires x round wins)
  targetScore: 10, // Questions needed to win one round
  status: 'menu', // menu, countdown, active, transition, results
  currentAnswer: null,
  options: [],
  startTime: 0,
  soloTotalTime: 0
};

const P1_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];
const P2_KEYS = ['KeyH', 'KeyJ', 'KeyK', 'KeyL'];
const P3_KEYS = ['Numpad4', 'Numpad5', 'Numpad6', 'NumpadAdd'];

const PLAYER_COLORS = [
  { id: 'p1', name: 'Player 1', cls: 'p1', keys: 'A S D F' },
  { id: 'p2', name: 'Player 2', cls: 'p2', keys: 'H J K L' },
  { id: 'p3', name: 'Player 3', cls: 'p3', keys: 'NUM 4 5 6 +' }
];

// --- Audio ---
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
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'wrong') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'tick') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'won') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc.start(now);
    osc.stop(now + 0.6);
  }
}
// -------------

function startGame(mode) {
  state.mode = mode;
  state.questionCount = 0;
  state.maxWins = parseInt($('rounds-select') ? $('rounds-select').value : 1) || 1;
  // Solo mode scales target score directly
  
  state.soloTotalTime = 0;
  state.players = [];
  
  const customNames = [
    $('p1-name') && $('p1-name').value.trim() ? $('p1-name').value.trim() : PLAYER_COLORS[0].name,
    $('p2-name') && $('p2-name').value.trim() ? $('p2-name').value.trim() : PLAYER_COLORS[1].name,
    $('p3-name') && $('p3-name').value.trim() ? $('p3-name').value.trim() : PLAYER_COLORS[2].name
  ];
  
  for (let i = 0; i < (mode === 1 ? 1 : mode); i++) {
    state.players.push({
      id: i,
      name: customNames[i],
      cls: PLAYER_COLORS[i].cls,
      score: 0,
      matchWins: 0,
      locked: false
    });
  }

  $('menu-screen').classList.remove('active');
  $('results-screen').classList.remove('active');
  $('match-screen').classList.add('active');
  if (mode === 1) {
    $('match-screen').classList.add('solo-mode');
  } else {
    $('match-screen').classList.remove('solo-mode');
  }

  renderPlayerCards();
  startNextRound();
}

function renderPlayerCards() {
  const container = $('player-cards');
  container.innerHTML = '';
  state.players.forEach(p => {
    container.innerHTML += `
      <div id="card-p${p.id}" class="player-card ${p.cls}">
        <h3>${p.name} <span id="wins-p${p.id}" style="font-size:0.5em; opacity:0.8;">(${p.matchWins} W)</span></h3>
        <div class="player-score" id="score-p${p.id}">0</div>
        <div class="player-status" id="status-p${p.id}">Ready</div>
        <div class="player-hotkeys">${PLAYER_COLORS[p.id].keys}</div>
      </div>
    `;
  });
}

function startNextRound() {
  state.questionCount++;
  
  state.status = 'countdown';
  state.players.forEach(p => p.locked = false);
  updatePlayerUI();
  
  if (state.mode === 1) {
    $('round-display').innerText = `Questions: ${state.players[0].score}/${state.targetScore * state.maxWins}`;
  } else {
    // Show match series score
    const series = state.players.map(p => p.matchWins).join(' - ');
    $('round-display').innerText = `First to ${state.targetScore} (Series: ${series})`;
  }
  
  $('question-container').classList.add('hidden');
  $('round-feedback').classList.add('hidden');
  
  const cd = $('countdown-display');
  cd.classList.remove('hidden');
  
  let count = 3;
  cd.innerText = count;
  
  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      cd.innerText = count;
      playSound('tick');
    } else {
      clearInterval(tick);
      cd.classList.add('hidden');
      playSound('tick');
      generateQuestion();
    }
  }, 600);
}

function generateQuestion() {
  const diffStr = $('diff-select') ? $('diff-select').value : '1';
  const diff = parseInt(diffStr) || 1;
  let a, b, ans, symbol;

  if (diff === 1) {
    a = Math.floor(Math.random() * 10) + 1;
    b = Math.floor(Math.random() * 10) + 1;
    ans = a + b;
    symbol = '+';
  } else if (diff === 2) {
    if (Math.random() > 0.5) {
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
      ans = a + b;
      symbol = '+';
    } else {
      a = Math.floor(Math.random() * 15) + 6;
      b = Math.floor(Math.random() * a) + 1;
      ans = a - b;
      symbol = '-';
    }
  } else {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    ans = a * b;
    symbol = '×';
  }
  
  state.currentAnswer = ans;
  
  // Generate 3 wrong options
  let opts = new Set([ans]);
  while(opts.size < 4) {
    let wrong;
    if (diff === 1 || diff === 2) {
      wrong = ans + (Math.floor(Math.random() * 9) - 4);
    } else {
      wrong = ans + (Math.floor(Math.random() * 7) - 3) * (Math.random()>0.5?a:b);
      if (wrong === ans) wrong = ans + (Math.floor(Math.random() * 5) + 1);
    }
    if (wrong > 0 && wrong !== ans) opts.add(wrong);
  }
  
  state.options = Array.from(opts).sort(() => Math.random() - 0.5);
  
  $('math-problem').innerText = `${a} ${symbol} ${b} = ?`;
  for(let i=0; i<4; i++) {
    $(`opt-${i+1}`).innerText = state.options[i];
    $(`opt-${i+1}`).parentElement.className = 'option-slot'; // reset classes
  }
  
  $('question-container').classList.remove('hidden');
  state.status = 'active';
  state.startTime = performance.now();
  
  if (state.mode === 1) {
    startSoloTimer();
  }
}

let soloTimer;
function startSoloTimer() {
  clearInterval(soloTimer);
  const start = performance.now() - state.soloTotalTime;
  soloTimer = setInterval(() => {
    if (state.status !== 'active') { clearInterval(soloTimer); return; }
    const t = performance.now() - start;
    $('time-display').innerText = `Time: ${(t/1000).toFixed(1)}s`;
    state.soloTotalTime = t;
  }, 100);
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyX') {
    window.location.href = 'index.html';
  }

  if (state.status !== 'active') return;
  
  let pIdx = -1;
  let optIdx = -1;

  if (P1_KEYS.includes(e.code) && state.mode >= 1) { pIdx = 0; optIdx = P1_KEYS.indexOf(e.code); }
  else if (P2_KEYS.includes(e.code) && state.mode >= 2) { pIdx = 1; optIdx = P2_KEYS.indexOf(e.code); }
  else if (P3_KEYS.includes(e.code) && state.mode >= 3) { pIdx = 2; optIdx = P3_KEYS.indexOf(e.code); }
  
  if (pIdx > -1 && optIdx > -1) {
    handleAnswer(pIdx, optIdx);
  }
});

function handleAnswer(pIdx, optIdx) {
  const p = state.players[pIdx];
  if (p.locked) return;
  
  const chosen = state.options[optIdx];
  const isCorrect = (chosen === state.currentAnswer);
  const slot = $(`opt-${optIdx+1}`).parentElement;
  
  if (isCorrect) {
    playSound('correct');
    state.status = 'transition';
    p.score++;
    slot.classList.add('correct-flash');
    
    $(`card-p${p.id}`).classList.add('won');
    $(`status-p${p.id}`).innerText = 'WINNER';
    $(`score-p${p.id}`).innerText = p.score;
    
    if (state.mode === 1) {
      if (p.score >= state.targetScore * state.maxWins) {
        showFeedback(`Completed!`, 'rgba(46,201,122,0.9)');
        setTimeout(() => endGame(), 1500);
      } else {
        showFeedback(`${p.name} got it!`, 'rgba(46,201,122,0.9)');
        setTimeout(() => startNextRound(), 1000);
      }
    } else {
      if (p.score >= state.targetScore) {
        p.matchWins++;
        $(`wins-p${p.id}`).innerText = `(${p.matchWins} W)`;
        if (p.matchWins >= state.maxWins) {
            showFeedback(`${p.name} WINS THE MATCH!`, 'rgba(255,215,0,0.9)');
            setTimeout(() => endGame(), 2500);
        } else {
            showFeedback(`${p.name} wins the Round!`, 'rgba(46,201,122,0.9)');
            setTimeout(() => {
                state.players.forEach(pl => {
                    pl.score = 0;
                    $(`score-p${pl.id}`).innerText = pl.score;
                    $(`card-p${pl.id}`).classList.remove('won');
                });
                startNextRound();
            }, 2500);
        }
      } else {
        showFeedback(`${p.name} got it!`, 'rgba(46,201,122,0.9)');
        setTimeout(() => startNextRound(), 1000); // Usually transitioning to next question
      }
    }
  } else {
    playSound('wrong');
    if (state.mode !== 1) p.locked = true;
    p.score = Math.max(0, p.score - 1);
    slot.classList.add('wrong-flash');
    
    if (state.mode === 1) {
      // time penalty and score penalty
      state.soloTotalTime += 2000;
      $('time-display').innerText = `Time: ${(state.soloTotalTime/1000).toFixed(1)}s`;
      showFeedback('-2s & -1 Pt Penalty', 'rgba(255,77,77,0.8)');
      $(`score-p${p.id}`).innerText = p.score;
      $('round-display').innerText = `Questions: ${p.score}/${state.targetScore * state.maxWins}`;
      setTimeout(() => { if(state.status==='active') $('round-feedback').classList.add('hidden'); }, 800);
    } else {
      $(`score-p${p.id}`).innerText = p.score;
      updatePlayerUI();
      // check if all locked
      if (state.players.every(pl => pl.locked)) {
        state.status = 'transition';
        showFeedback('Nobody got it!', 'rgba(255,255,255,0.2)');
        setTimeout(() => startNextRound(), 2000);
      }
    }
  }
}

function updatePlayerUI() {
  state.players.forEach(p => {
    const c = $(`card-p${p.id}`);
    const s = $(`status-p${p.id}`);
    c.classList.remove('won');
    if (p.locked) {
      c.classList.add('locked');
      s.innerText = 'LOCKED';
    } else {
      c.classList.remove('locked');
      s.innerText = 'READY';
    }
  });
}

function showFeedback(text, bg) {
  const f = $('round-feedback');
  f.style.background = bg;
  $('feedback-text').innerText = text;
  f.classList.remove('hidden');
}

function endGame() {
  state.status = 'results';
  clearInterval(soloTimer);
  
  $('match-screen').classList.remove('active');
  $('results-screen').classList.add('active');
  
  
  const rc = $('results-content');
  if (state.mode === 1) {
    rc.innerHTML = `<div class="result-row rank-1"><span>Total Time</span><span>${(state.soloTotalTime/1000).toFixed(1)}s</span></div>`;
  } else {
    const sorted = [...state.players].sort((a,b) => (b.matchWins * 100 + b.score) - (a.matchWins * 100 + a.score));
    rc.innerHTML = sorted.map((p, i) => `
      <div class="result-row ${i===0?'rank-1':''}">
        <span>#${i+1} ${p.name}</span>
        <span>${p.matchWins} Round Wins (${p.score} pts)</span>
      </div>
    `).join('');
  }
  setTimeout(() => playSound('won'), 200);
}

$('btn-replay').addEventListener('click', () => {
  startGame(state.mode);
});

// Add click listeners to option slots for solo mode mouse control
document.querySelectorAll('.option-slot').forEach((slot, index) => {
  slot.addEventListener('click', () => {
    if (state.mode === 1 && state.status === 'active') {
      handleAnswer(0, index);
    }
  });
});

