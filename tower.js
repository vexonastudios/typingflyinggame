const MAX_HEIGHT = 20;

const PLAYERS_CONFIG = [
  { id: 1, color: 'Blue', keys: ['Z', 'X', 'C', 'V'], keysCode: ['KeyZ', 'KeyX', 'KeyC', 'KeyV'], score: 0 },
  { id: 2, color: 'Red', keys: ['H', 'J', 'K', 'L'], keysCode: ['KeyH', 'KeyJ', 'KeyK', 'KeyL'], score: 0 },
  { id: 3, color: 'Gold', keys: ['4', '5', '6', '+'], keysCode: ['Numpad4', 'Numpad5', 'Numpad6', 'NumpadAdd'], score: 0 }
];

let gameState = 'LOBBY'; // LOBBY, COUNTDOWN, PLAYING, END
let numPlayers = 2;
let activePlayers = [];
let difficulty = 'Easy';
let placements = [];
let gameStartTime = 0;
let timerInterval = null;

// Audio Context for Synths
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  if(type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if(type === 'wrong') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if(type === 'win') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554, now + 0.1);
    osc.frequency.setValueAtTime(659, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
    osc.start(now); osc.stop(now + 0.6);
  } else if(type === 'drop') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  }
}

// DOM Elements
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const winOverlay = document.getElementById('winOverlay');
const winnerText = document.getElementById('winnerText');
const gameContainer = document.getElementById('gameContainer');

// Lobby events
document.getElementById('btn2p').addEventListener('click', (e) => {
  numPlayers = 2;
  e.target.classList.add('active');
  document.getElementById('btn3p').classList.remove('active');
  document.getElementById('col-p3').style.display = 'none';
});

document.getElementById('btn3p').addEventListener('click', (e) => {
  numPlayers = 3;
  e.target.classList.add('active');
  document.getElementById('btn2p').classList.remove('active');
  document.getElementById('col-p3').style.display = 'block';
});

const diffBtns = [document.getElementById('btnDiffEasy'), document.getElementById('btnDiffMedium'), document.getElementById('btnDiffHard')];
diffBtns.forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    diffBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    difficulty = e.target.innerText;
  });
});

document.getElementById('btnStart').addEventListener('click', startGameSequence);
document.getElementById('btnRestart').addEventListener('click', startGameSequence);
document.getElementById('btnLobby').addEventListener('click', () => {
  winOverlay.classList.add('hidden');
  gameScreen.classList.remove('active');
  lobbyScreen.classList.add('active');
});

function startGameSequence() {
  lobbyScreen.classList.remove('active');
  winOverlay.classList.add('hidden');
  gameScreen.classList.add('active');
  
  initializeGame();
  
  gameState = 'COUNTDOWN';
  countdownOverlay.classList.remove('hidden');
  
  let count = 3;
  countdownText.innerText = count;
  
  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      countdownText.innerText = count;
    } else if (count === 0) {
      countdownText.innerText = 'GO!';
    } else {
      clearInterval(timer);
      countdownOverlay.classList.add('hidden');
      gameState = 'PLAYING';
      
      gameStartTime = performance.now();
      document.getElementById('liveTimer').classList.remove('hidden');
      timerInterval = setInterval(() => {
        const elapsed = ((performance.now() - gameStartTime) / 1000).toFixed(2);
        document.getElementById('liveTimer').innerText = elapsed + 's';
      }, 50);
    }
  }, 1000);
}

function initializeGame() {
  gameContainer.innerHTML = '';
  activePlayers = [];
  placements = [];
  clearInterval(timerInterval);
  document.getElementById('liveTimer').classList.add('hidden');
  document.getElementById('winnerText').innerHTML = '';

  for (let i = 0; i < numPlayers; i++) {
    const config = { ...PLAYERS_CONFIG[i], score: 0 };
    const nameInput = document.getElementById(`p${config.id}Name`);
    config.name = nameInput && nameInput.value.trim() !== '' ? nameInput.value.trim() : `Player ${config.id}`;
    
    activePlayers.push(config);
    setupPlayerUI(config);
    generateProblem(config);
  }
}

function setupPlayerUI(player) {
  const template = document.getElementById('playerColumnTemplate');
  const clone = template.content.cloneNode(true);
  const col = clone.querySelector('.player-col');
  col.setAttribute('data-player', player.id);
  
  player.dom = {
    col: col,
    nameDisplay: col.querySelector('.player-name-display'),
    blocks: col.querySelector('.tower-blocks'),
    probText: col.querySelector('.problem-text'),
    ansBoxes: Array.from(col.querySelectorAll('.answer-box')),
    probContainer: col.querySelector('.problem-container')
  };

  player.finished = false;

  if (player.dom.nameDisplay) {
    player.dom.nameDisplay.innerText = player.name;
  }

  // Assign keys visually
  player.dom.ansBoxes.forEach((box, i) => {
    box.querySelector('.answer-key').innerText = player.keys[i];
  });

  gameContainer.appendChild(col);
}

function generateProblem(player) {
  // Simple math generator based on difficulty
  const ops = difficulty === 'Easy' ? ['+'] : difficulty === 'Medium' ? ['+', '-'] : ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let num1, num2, answer;

  if (op === '+') {
    let max = difficulty === 'Easy' ? 10 : difficulty === 'Medium' ? 50 : 100;
    num1 = Math.floor(Math.random() * max) + 1;
    num2 = Math.floor(Math.random() * max) + 1;
    answer = num1 + num2;
  } else if (op === '-') {
    let max = difficulty === 'Medium' ? 50 : 100;
    num1 = Math.floor(Math.random() * max) + 10;
    num2 = Math.floor(Math.random() * num1) + 1;
    answer = num1 - num2;
  } else {
    let max = 12;
    num1 = Math.floor(Math.random() * max) + 2;
    num2 = Math.floor(Math.random() * max) + 2;
    answer = num1 * num2;
  }

  const displayOp = op === '*' ? '×' : op;
  player.currentProblem = { text: `${num1} ${displayOp} ${num2} = ?`, answer: answer };
  player.dom.probText.innerText = player.currentProblem.text;

  // Generate options
  let options = new Set([answer]);
  while (options.size < 4) {
    let offset = Math.floor(Math.random() * 10) - 4;
    if (offset === 0) offset = 5;
    let fakeAns = answer + offset;
    if (fakeAns >= 0) options.add(fakeAns);
  }

  options = Array.from(options);
  options.sort(() => Math.random() - 0.5); // shuffle

  player.activeOptions = options;
  player.correctIndex = options.indexOf(answer);

  player.dom.ansBoxes.forEach((box, i) => {
    box.querySelector('.answer-value').innerText = options[i];
    box.classList.remove('active');
  });
}

function handleInput(keyCode) {
  if (gameState !== 'PLAYING') return;

  activePlayers.forEach((player) => {
    const keyIndex = player.keysCode.indexOf(keyCode);
    if (keyIndex !== -1) {
      // Key pressed for this player
      checkAnswer(player, keyIndex);
      
      // Visual feedback on the box
      const box = player.dom.ansBoxes[keyIndex];
      box.classList.add('active');
      setTimeout(() => box.classList.remove('active'), 150);
    }
  });
}

function checkAnswer(player, index) {
  // Prevent spamming if locked or finished
  if (player.locked || player.finished) return;

  if (index === player.correctIndex) {
    // Correct!
    player.score++;
    playSound('correct');
    addBlock(player);
    player.dom.probContainer.classList.add('success');
    setTimeout(() => player.dom.probContainer.classList.remove('success'), 300);
    
    if (player.score >= MAX_HEIGHT) {
      triggerWin(player);
    } else {
      generateProblem(player);
    }
  } else {
    // Incorrect!
    playSound('wrong');
    if (player.score > 0) {
      player.score--;
      removeBlock(player);
    }
    
    player.dom.probContainer.classList.add('error');
    player.locked = true;
    setTimeout(() => {
      player.dom.probContainer.classList.remove('error');
      player.locked = false;
    }, 400); // Wait penalty
  }
}

function addBlock(player) {
  const block = document.createElement('div');
  block.className = 'tower-block';
  player.dom.blocks.appendChild(block);
  setTimeout(() => playSound('drop'), 100); // Sync sound roughly with visual drop hit
}

function removeBlock(player) {
  if (player.dom.blocks.lastChild) {
    const block = player.dom.blocks.lastChild;
    block.classList.add('block-break');
    setTimeout(() => {
      if(block.parentElement) block.parentElement.removeChild(block);
    }, 300);
  }
}

function triggerWin(player) {
  const elapsed = ((performance.now() - gameStartTime) / 1000).toFixed(2);
  player.finished = true;
  placements.push({ id: player.id, name: player.name, time: elapsed });
  playSound('win');
  
  const finishedDiv = document.createElement('div');
  finishedDiv.className = 'finished-overlay';
  finishedDiv.innerText = placements.length === 1 ? '1st!' : placements.length === 2 ? '2nd!' : '3rd!';
  player.dom.col.appendChild(finishedDiv);

  if ((numPlayers === 2 && placements.length === 1) || (numPlayers === 3 && placements.length === 2)) {
    endGame();
  }
}

function endGame() {
  gameState = 'END';
  clearInterval(timerInterval);
  document.getElementById('liveTimer').classList.add('hidden');
  
  const resultsHtml = placements.map((p, i) => `
    <div class="result-row">
      <span>${i === 0 ? '🏆 1st' : '🥈 2nd'} - <span style="color:var(--p${p.id}-color)">${p.name}</span></span>
      <span>${p.time}s</span>
    </div>
  `).join('');
  
  document.getElementById('winnerText').innerHTML = resultsHtml;
  document.getElementById('winTitle').innerText = 'Results';
  winOverlay.classList.remove('hidden');
}

// Global key listener
window.addEventListener('keydown', (e) => {
  // Prevent default scrolling for space/arrows if we used them, but we are using alphanumeric
  handleInput(e.code);
});
