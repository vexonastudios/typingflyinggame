/* ================================================================
   Bug Match — JavaScript
   A nature-themed memory game for kids
   ================================================================ */

'use strict';

// ── Bug definitions ──────────────────────────────────────────────
const BUGS = [
  { emoji: '🐞', name: 'Ladybug' },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐛', name: 'Caterpillar' },
  { emoji: '🐝', name: 'Bee' },
  { emoji: '🐜', name: 'Ant' },
  { emoji: '🦗', name: 'Cricket' },
  { emoji: '🕷️', name: 'Spider' },
  { emoji: '🦟', name: 'Mosquito' },
  { emoji: '🐛', name: 'Worm' },
  { emoji: '🦋', name: 'Moth' },
  { emoji: '🐞', name: 'Beetle' },
  { emoji: '🦂', name: 'Scorpion' },
  { emoji: '🪲', name: 'Beetle' },
  { emoji: '🪳', name: 'Cockroach' },
  { emoji: '🦠', name: 'Microbe' },
  { emoji: '🐝', name: 'Wasp' },
  { emoji: '🦎', name: 'Lizard' },
  { emoji: '🐸', name: 'Frog' },
];

const UNIQUE_BUGS = [
  { emoji: '🐞', name: 'Ladybug' },
  { emoji: '🦋', name: 'Butterfly' },
  { emoji: '🐛', name: 'Caterpillar' },
  { emoji: '🐝', name: 'Bee' },
  { emoji: '🐜', name: 'Ant' },
  { emoji: '🦗', name: 'Cricket' },
  { emoji: '🕷️', name: 'Spider' },
  { emoji: '🦟', name: 'Mosquito' },
  { emoji: '🪲', name: 'Beetle' },
  { emoji: '🪳', name: 'Cockroach' },
  { emoji: '🦂', name: 'Scorpion' },
  { emoji: '🪰', name: 'Fly' },
  { emoji: '🦎', name: 'Lizard' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🐌', name: 'Snail' },
  { emoji: '🦋', name: 'Moth' },
  { emoji: '🐝', name: 'Wasp' },
  { emoji: '🐛', name: 'Worm' },
];

// ── Sound Engine (Web Audio API Synthesizer) ──────────────────────
let audioCtx = null;

const SoundEngine = {
  muted: false,

  _init() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
      btn.textContent = this.muted ? '🔇' : '🔊';
      btn.classList.toggle('muted', this.muted);
    }
    if (!this.muted) this.playClick();
    return this.muted;
  },

  playFlip() {
    if (this.muted) return;
    this._init();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // Soft woosh / leaf flip frequency drop
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);

      // Gentle leaf rustle noise
      const bufferSize = Math.ceil(audioCtx.sampleRate * 0.04);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.04, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
    } catch (e) {}
  },

  playMatch() {
    if (this.muted) return;
    this._init();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // Cheerful 4-note arpeggio (C5, E5, G5, C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const startTime = now + idx * 0.07;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch (e) {}
  },

  playMismatch() {
    if (this.muted) return;
    this._init();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // Friendly low double wobble / sad bug buzz
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.15);
      osc.frequency.linearRampToValueAtTime(110, now + 0.3);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  },

  playClick() {
    if (this.muted) return;
    this._init();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.04);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  },

  playWin() {
    if (this.muted) return;
    this._init();
    if (!audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      // Victory fanfare sequence
      const melody = [
        { f: 523.25, t: 0 },
        { f: 659.25, t: 0.1 },
        { f: 783.99, t: 0.2 },
        { f: 1046.50, t: 0.35 },
        { f: 1318.51, t: 0.5 },
        { f: 1567.98, t: 0.65 }
      ];
      melody.forEach(n => {
        const startTime = now + n.t;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) {}
  }
};

// ── Grid sizes ────────────────────────────────────────────────────
const GRID_CONFIGS = {
  4: { cols: 4, rows: 4, pairs: 8  },  // 4×4
  5: { cols: 5, rows: 4, pairs: 10 },  // 4×5
  6: { cols: 6, rows: 6, pairs: 18 },  // 6×6
};

// ── State ─────────────────────────────────────────────────────────
let state = {
  cards: [],           // array of card data objects
  flipped: [],         // indices of currently face-up (unmatched) cards
  matched: new Set(),  // indices of matched cards
  moves: 0,
  matchCount: 0,
  totalPairs: 0,
  isLocked: false,     // block clicks during mismatch flip-back
  timerInterval: null,
  elapsedSeconds: 0,
  gridSize: 5,
  numPlayers: 1,       // 1 or 2
  currentPlayer: 1,    // 1 or 2
  scores: { 1: 0, 2: 0 }
};

// ── DOM refs ──────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const menuScreen    = $('menuScreen');
const gameScreen    = $('gameScreen');
const gameBoard     = $('gameBoard');
const winOverlay    = $('winOverlay');

// 1P Stats
const stats1P       = $('stats1P');
const movesCount    = $('movesCount');
const matchesCount  = $('matchesCount');
const timerDisplay  = $('timerDisplay');
const winStats1P    = $('winStats1P');
const winMoves      = $('winMoves');
const winTime       = $('winTime');
const winStars      = $('winStars');

// 2P Stats
const stats2P       = $('stats2P');
const panelP1       = $('panelP1');
const panelP2       = $('panelP2');
const scoreP1       = $('scoreP1');
const scoreP2       = $('scoreP2');
const winStats2P    = $('winStats2P');
const winScoreP1    = $('winScoreP1');
const winScoreP2    = $('winScoreP2');

const winTitleText  = $('winTitleText');
const winSubText    = $('winSubText');

// ── Utility ───────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function calcStars(moves, pairs) {
  const ratio = moves / pairs; 
  if (ratio <= 1.5) return '⭐⭐⭐';
  if (ratio <= 2.5) return '⭐⭐';
  return '⭐';
}

// ── Timer ─────────────────────────────────────────────────────────

function startTimer() {
  stopTimer();
  state.elapsedSeconds = 0;
  timerDisplay.textContent = '0:00';
  if (state.numPlayers === 1) {
    state.timerInterval = setInterval(() => {
      state.elapsedSeconds++;
      timerDisplay.textContent = formatTime(state.elapsedSeconds);
    }, 1000);
  }
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ── Ambient Bug Particles ─────────────────────────────────────────

function spawnAmbientBugs() {
  const container = $('ambientBugs');
  if (!container) return;
  container.innerHTML = '';
  const ambientEmojis = ['🐞', '🦋', '🐛', '🐝', '🐜', '🦗', '🪲', '🪰'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('span');
    el.className = 'ambient-bug';
    el.textContent = ambientEmojis[Math.floor(Math.random() * ambientEmojis.length)];
    const startX = Math.random() * 100;
    const startY = Math.random() * 100;
    const driftX = (Math.random() - 0.5) * 300;
    const driftY = (Math.random() - 0.5) * 300;
    const driftR = (Math.random() - 0.5) * 360;
    const duration = 8 + Math.random() * 14;
    const delay = Math.random() * -duration;
    el.style.cssText = `
      left: ${startX}%;
      top: ${startY}%;
      --drift-x: ${driftX}px;
      --drift-y: ${driftY}px;
      --drift-r: ${driftR}deg;
      animation-duration: ${duration}s;
      animation-delay: ${delay}s;
      font-size: ${0.9 + Math.random() * 1.2}rem;
    `;
    container.appendChild(el);
  }
}

function launchConfetti() {
  const colors = ['#6fce6f', '#f5c842', '#ff6b6b', '#4ecdc4', '#a8e6cf', '#ffd3a5'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'bm-confetti';
    el.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${5 + Math.random() * 8}px;
      height: ${8 + Math.random() * 10}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.8}s;
      transform: rotate(${Math.random() * 360}deg);
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Card Building ─────────────────────────────────────────────────

function buildDeck(pairs) {
  const bugPool = shuffle(UNIQUE_BUGS).slice(0, pairs);
  const deck = [];
  bugPool.forEach((bug, pairIdx) => {
    deck.push({ bug, pairIdx, id: deck.length });
    deck.push({ bug, pairIdx, id: deck.length });
  });
  return shuffle(deck);
}

function createCardElement(cardData, index) {
  const card = document.createElement('div');
  card.className = 'bm-card';
  card.dataset.index = index;
  card.setAttribute('role', 'gridcell');
  card.setAttribute('aria-label', 'Leaf — click to flip');
  card.setAttribute('tabindex', '0');

  card.innerHTML = `
    <div class="bm-card-inner">
      <div class="bm-card-front">
        <span class="bm-leaf-icon">🍃</span>
      </div>
      <div class="bm-card-back">
        <span class="bm-bug-emoji" aria-hidden="true">${cardData.bug.emoji}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => onCardClick(index));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCardClick(index);
    }
  });

  return card;
}

// ── Game Initialization ───────────────────────────────────────────

function initGame() {
  const config = GRID_CONFIGS[state.gridSize];
  stopTimer();

  state = {
    ...state,
    cards: buildDeck(config.pairs),
    flipped: [],
    matched: new Set(),
    moves: 0,
    matchCount: 0,
    totalPairs: config.pairs,
    isLocked: false,
    elapsedSeconds: 0,
    currentPlayer: 1,
    scores: { 1: 0, 2: 0 }
  };

  // Reset UI
  if (state.numPlayers === 1) {
    stats1P.classList.remove('hidden');
    stats2P.classList.add('hidden');
    movesCount.textContent = '0';
    matchesCount.textContent = '0';
    timerDisplay.textContent = '0:00';
  } else {
    stats1P.classList.add('hidden');
    stats2P.classList.remove('hidden');
    scoreP1.textContent = '0';
    scoreP2.textContent = '0';
    updatePlayerTurnUI();
  }

  winOverlay.classList.add('hidden');

  // Build board
  gameBoard.innerHTML = '';
  gameBoard.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;

  const maxBoardWidth = Math.min(window.innerWidth - 48, 700);
  const cardSize = Math.floor((maxBoardWidth - (config.cols - 1) * 12) / config.cols);
  const clampedSize = Math.max(62, Math.min(cardSize, 110));
  document.documentElement.style.setProperty('--bm-card-size', `${clampedSize}px`);

  state.cards.forEach((cardData, index) => {
    const el = createCardElement(cardData, index);
    el.style.width = `${clampedSize}px`;
    el.style.height = `${clampedSize}px`;
    el.style.fontSize = `${Math.round(clampedSize * 0.27)}px`;
    gameBoard.appendChild(el);
  });

  showScreen('game');
  setTimeout(() => startTimer(), 300);
}

function updatePlayerTurnUI() {
  if (state.currentPlayer === 1) {
    panelP1.classList.add('active-turn');
    panelP2.classList.remove('active-turn');
  } else {
    panelP1.classList.remove('active-turn');
    panelP2.classList.add('active-turn');
  }
}

// ── Card Click Logic ──────────────────────────────────────────────

function onCardClick(index) {
  if (state.isLocked) return;
  if (state.matched.has(index)) return;
  if (state.flipped.includes(index)) return;
  if (state.flipped.length >= 2) return;

  // Play flip sound effect
  SoundEngine.playFlip();

  const cardEls = gameBoard.querySelectorAll('.bm-card');
  const el = cardEls[index];
  el.classList.add('flipped');
  el.setAttribute('aria-label', `${state.cards[index].bug.name} — flipped`);
  state.flipped.push(index);

  if (state.flipped.length === 2) {
    state.moves++;
    if (state.numPlayers === 1) {
      movesCount.textContent = state.moves;
    }
    checkForMatch();
  }
}

function checkForMatch() {
  const [a, b] = state.flipped;
  const cardEls = gameBoard.querySelectorAll('.bm-card');
  const isMatch = state.cards[a].pairIdx === state.cards[b].pairIdx;

  if (isMatch) {
    // Play match sound effect
    SoundEngine.playMatch();

    state.matched.add(a);
    state.matched.add(b);
    state.matchCount++;

    if (state.numPlayers === 1) {
      matchesCount.textContent = state.matchCount;
    } else {
      state.scores[state.currentPlayer]++;
      $('scoreP' + state.currentPlayer).textContent = state.scores[state.currentPlayer];
    }

    cardEls[a].classList.add('matched');
    cardEls[b].classList.add('matched');
    cardEls[a].setAttribute('aria-label', `${state.cards[a].bug.name} — matched!`);
    cardEls[b].setAttribute('aria-label', `${state.cards[b].bug.name} — matched!`);

    state.flipped = [];

    if (state.matchCount === state.totalPairs) {
      setTimeout(showWin, 500);
    }
  } else {
    // Play mismatch sound effect
    SoundEngine.playMismatch();

    state.isLocked = true;
    cardEls[a].classList.add('wrong');
    cardEls[b].classList.add('wrong');

    setTimeout(() => {
      cardEls[a].classList.remove('flipped', 'wrong');
      cardEls[b].classList.remove('flipped', 'wrong');
      cardEls[a].setAttribute('aria-label', 'Leaf — click to flip');
      cardEls[b].setAttribute('aria-label', 'Leaf — click to flip');
      state.flipped = [];
      
      // Swap turns if 2P
      if (state.numPlayers === 2) {
        state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
        updatePlayerTurnUI();
      }
      
      state.isLocked = false;
    }, 900);
  }
}

// ── Win Screen ────────────────────────────────────────────────────

function showWin() {
  stopTimer();
  SoundEngine.playWin();

  if (state.numPlayers === 1) {
    winStats1P.classList.remove('hidden');
    winStats2P.classList.add('hidden');
    winTitleText.textContent = "You Did It! 🎊";
    winSubText.textContent = "You matched all the bugs!";
    
    winMoves.textContent = state.moves;
    winTime.textContent  = formatTime(state.elapsedSeconds);
    winStars.textContent = calcStars(state.moves, state.totalPairs);
  } else {
    winStats1P.classList.add('hidden');
    winStats2P.classList.remove('hidden');
    
    winScoreP1.textContent = state.scores[1];
    winScoreP2.textContent = state.scores[2];
    
    if (state.scores[1] > state.scores[2]) {
      winTitleText.textContent = "Player 1 Wins! 🏆";
      winSubText.textContent = "What a sharp memory!";
    } else if (state.scores[2] > state.scores[1]) {
      winTitleText.textContent = "Player 2 Wins! 🏆";
      winSubText.textContent = "What a sharp memory!";
    } else {
      winTitleText.textContent = "It's a Tie! 🤝";
      winSubText.textContent = "You both found the same number of bugs!";
    }
  }

  winOverlay.classList.remove('hidden');
  launchConfetti();
}

// ── Screen Management ─────────────────────────────────────────────

function showScreen(name) {
  menuScreen.classList.remove('active');
  gameScreen.classList.remove('active');
  if (name === 'menu') {
    menuScreen.style.display = 'flex';
    menuScreen.classList.add('active');
    gameScreen.style.display = 'none';
  } else {
    gameScreen.style.display = 'flex';
    gameScreen.classList.add('active');
    menuScreen.style.display = 'none';
  }
}

// ── Event Listeners ───────────────────────────────────────────────

// Mute toggle button
const soundToggleBtn = $('soundToggleBtn');
if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => SoundEngine.toggleMute());
}

// Player mode buttons
document.querySelectorAll('#mode1P, #mode2P').forEach(btn => {
  btn.addEventListener('click', () => {
    SoundEngine.playClick();
    document.querySelectorAll('#mode1P, #mode2P').forEach(b => b.classList.remove('bm-diff-btn--selected'));
    btn.classList.add('bm-diff-btn--selected');
    state.numPlayers = parseInt(btn.dataset.mode, 10);
  });
});

// Difficulty buttons
document.querySelectorAll('#diffEasy, #diffMedium, #diffHard').forEach(btn => {
  btn.addEventListener('click', () => {
    SoundEngine.playClick();
    document.querySelectorAll('#diffEasy, #diffMedium, #diffHard').forEach(b => b.classList.remove('bm-diff-btn--selected'));
    btn.classList.add('bm-diff-btn--selected');
    state.gridSize = parseInt(btn.dataset.size, 10);
  });
});

$('startBtn').addEventListener('click', () => {
  SoundEngine.playClick();
  initGame();
});

$('restartBtn').addEventListener('click', () => {
  SoundEngine.playClick();
  initGame();
});

$('menuBtn').addEventListener('click', () => {
  SoundEngine.playClick();
  stopTimer();
  winOverlay.classList.add('hidden');
  showScreen('menu');
});

$('playAgainBtn').addEventListener('click', () => {
  SoundEngine.playClick();
  winOverlay.classList.add('hidden');
  initGame();
});

$('winMenuBtn').addEventListener('click', () => {
  SoundEngine.playClick();
  stopTimer();
  winOverlay.classList.add('hidden');
  showScreen('menu');
});

// ── Init ──────────────────────────────────────────────────────────

spawnAmbientBugs();
menuScreen.style.display = 'flex';
gameScreen.style.display = 'none';
