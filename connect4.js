// connect4.js
const COLS = 7;
const ROWS = 6;
const EMPTY = 0;
const RED = 1;
const YELLOW = 2;

// ElevenLabs SFX
const sfxDrop = new Audio('/api/sfx?text=heavy%20plastic%20token%20dropping%20into%20a%20hollow%20slot%20and%20clacking&duration=1');
const sfxWin = new Audio('/api/sfx?text=triumphant%20arcade%20level%20complete%20chime&duration=3');
const sfxDraw = new Audio('/api/sfx?text=sad%20arcade%20game%20over%20buzzer&duration=2');
const sfxError = new Audio('/api/sfx?text=short%20error%20buzz&duration=1');

sfxDrop.preload = 'auto';
sfxWin.preload = 'auto';
sfxDraw.preload = 'auto';
sfxError.preload = 'auto';

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(e => console.warn('SFX skipped:', e));
}

let board = [];
let currentPlayer = RED;
let gameMode = 'local'; // 'local', 'bot', 'training'
let isGameOver = false;
let isAnimating = false;

// DOM Elements
const menuScreen = document.getElementById('menuScreen');
const gameScreen = document.getElementById('gameScreen');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const winnerText = document.getElementById('winnerText');
const p2Name = document.getElementById('p2Name');
const columnsUI = document.querySelectorAll('.column');
const playerPanels = document.querySelectorAll('.player-panel');

// Initialization
function init() {
  document.getElementById('btnPVP').addEventListener('click', () => startGame('local'));
  document.getElementById('btnPVE').addEventListener('click', () => startGame('bot'));
  document.getElementById('btnTraining').addEventListener('click', () => startGame('training'));
  
  document.getElementById('btnPlayAgain').addEventListener('click', resetGame);
  document.getElementById('btnMainMenu').addEventListener('click', showMenu);
  document.getElementById('btnRestartMatch').addEventListener('click', resetGame);
  
  columnsUI.forEach((col, index) => {
    col.addEventListener('click', () => handleColumnClick(index));
    col.addEventListener('mouseenter', () => handleColumnHover(index));
    col.addEventListener('mouseleave', () => removeGhostChips());
  });
}

function startGame(mode) {
  gameMode = mode;
  p2Name.textContent = mode === 'local' ? 'Player 2' : 'Bot';
  menuScreen.classList.remove('active');
  gameScreen.classList.add('active');
  resetGame();
}

function showMenu() {
  gameScreen.classList.remove('active');
  gameOverOverlay.classList.add('hidden');
  menuScreen.classList.add('active');
}

function resetGame() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  currentPlayer = RED;
  isGameOver = false;
  isAnimating = false;
  gameOverOverlay.classList.add('hidden');
  
  // Clear UI chips
  columnsUI.forEach(col => {
    const chips = col.querySelectorAll('.chip');
    chips.forEach(c => c.remove());
    
    // add ghost chips back
    const ghost = document.createElement('div');
    ghost.className = 'ghost-chip';
    col.appendChild(ghost);
  });
  
  document.querySelectorAll('.hint-arrow').forEach(el => el.remove());
  
  updateUI();
  
  if (gameMode === 'training') {
    showHint();
  }
}

function handleColumnHover(colIndex) {
  if (isGameOver || isAnimating) return;
  if (gameMode === 'bot' && currentPlayer === YELLOW) return; // Prevent hover if bot turn
  
  removeGhostChips();
  const ghost = document.createElement('div');
  ghost.className = `ghost-chip ${currentPlayer === RED ? 'red' : 'yellow'}`;
  columnsUI[colIndex].appendChild(ghost);
}

function removeGhostChips() {
  document.querySelectorAll('.ghost-chip').forEach(el => el.remove());
}

async function handleColumnClick(colIndex) {
  if (isGameOver || isAnimating) return;
  if (gameMode === 'bot' && currentPlayer === YELLOW) return; // Prevent click during bot turn
  
  await playTurn(colIndex);
}

async function playTurn(colIndex) {
  const rowInfo = getAvailableRow(colIndex);
  if (rowInfo === -1) {
    playSound(sfxError);
    return; // Column full
  }

  isAnimating = true;
  removeGhostChips();
  document.querySelectorAll('.hint-arrow').forEach(el => el.remove());

  board[rowInfo][colIndex] = currentPlayer;
  
  // Animate chip drop
  const chip = document.createElement('div');
  chip.className = `chip ${currentPlayer === RED ? 'chip-red' : 'chip-yellow'}`;
  chip.style.bottom = `${rowInfo * 114}px`; // 100px slot + 14px gap
  
  playSound(sfxDrop);
  
  // We place chips inside the column. Columns are flex-direction: column-reverse, 
  // so appending a child adds it from the bottom.
  // Wait, if it's column-reverse, the first appended goes to the bottom.
  columnsUI[colIndex].appendChild(chip);
  
  // Wait for animation to finish
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Board shake effect
  const boardEl = document.getElementById('board');
  boardEl.classList.add('shake');
  setTimeout(() => boardEl.classList.remove('shake'), 200);
  
  const winLine = checkWin(rowInfo, colIndex);
  if (winLine) {
    endGame(currentPlayer, winLine);
    return;
  }
  
  if (checkDraw()) {
    endGame(EMPTY, null);
    return;
  }
  
  // Switch turns
  currentPlayer = currentPlayer === RED ? YELLOW : RED;
  isAnimating = false;
  updateUI();
  
  // If it's training mode, show the hint for the player
  if (gameMode === 'training' && currentPlayer === RED) {
    showHint();
  }
  
  // Bot turn
  if ((gameMode === 'bot' || gameMode === 'training') && currentPlayer === YELLOW) {
    const delay = Math.floor(Math.random() * 900) + 600; // 600ms - 1500ms
    setTimeout(makeBotMove, delay);
  }
}

function getAvailableRow(colIndex) {
  for (let r = 0; r < ROWS; r++) {
    if (board[r][colIndex] === EMPTY) {
      return r;
    }
  }
  return -1;
}

function updateUI() {
  playerPanels.forEach(p => p.classList.remove('active-turn'));
  if (currentPlayer === RED) {
    playerPanels[0].classList.add('active-turn');
  } else {
    playerPanels[1].classList.add('active-turn');
  }
}

function checkWin(r, c) {
  const player = board[r][c];
  
  // Directions: Horizontal, Vertical, Diagonal 1, Diagonal 2
  const directions = [
    [[0, 1], [0, -1]],  // Horizontal
    [[1, 0], [-1, 0]],  // Vertical
    [[1, 1], [-1, -1]], // Diagonal /
    [[1, -1], [-1, 1]]  // Diagonal \
  ];

  for (let dir of directions) {
    let count = 1;
    let line = [{r, c}];
    
    for (let sign of dir) {
      let r2 = r + sign[0];
      let c2 = c + sign[1];
      while (r2 >= 0 && r2 < ROWS && c2 >= 0 && c2 < COLS && board[r2][c2] === player) {
        count++;
        line.push({r: r2, c: c2});
        r2 += sign[0];
        c2 += sign[1];
      }
    }
    
    if (count >= 4) {
      return line;
    }
  }
  return null;
}

function checkDraw() {
  for (let c = 0; c < COLS; c++) {
    if (board[ROWS - 1][c] === EMPTY) return false;
  }
  return true;
}

function endGame(winner, winLine) {
  isGameOver = true;
  isAnimating = false;
  
  if (winner !== EMPTY) {
    playSound(sfxWin);
    const pName = winner === RED ? 'Player 1' : (gameMode === 'local' ? 'Player 2' : 'Bot');
    winnerText.textContent = `${pName} Wins!`;
    winnerText.style.color = winner === RED ? '#ff4d4d' : '#ffd060';
    
    // Highlight winning chips and dim others
    if (winLine) {
      document.querySelectorAll('.chip').forEach(c => c.classList.add('dimmed'));
      winLine.forEach(pos => {
        const chips = Array.from(columnsUI[pos.c].querySelectorAll('.chip'));
        if (chips[pos.r]) {
          chips[pos.r].classList.remove('dimmed');
          chips[pos.r].classList.add('win-highlight');
        }
      });
    }
  } else {
    playSound(sfxDraw);
    winnerText.textContent = "It's a Draw!";
    winnerText.style.color = "#fff";
  }
  
  setTimeout(() => {
    gameOverOverlay.classList.remove('hidden');
  }, 1000);
}

// ==========================================
// Bot & AI Logic (Heuristic based)
// ==========================================

async function makeBotMove() {
  if (isGameOver) return;
  const diff = document.getElementById('botDifficulty').value;
  let bestCol;
  if (diff === 'hard') {
    bestCol = getMinimaxMove(YELLOW);
  } else {
    bestCol = getBestMove(YELLOW);
  }
  await playTurn(bestCol);
}

function showHint() {
  if (isGameOver) return;
  const diff = document.getElementById('botDifficulty').value;
  const bestCol = diff === 'hard' ? getMinimaxMove(RED) : getBestMove(RED);
  const hint = document.createElement('div');
  hint.className = 'hint-arrow';
  columnsUI[bestCol].appendChild(hint);
}

// Simple heuristic bot for Connect 4
function getBestMove(player) {
  const opponent = player === RED ? YELLOW : RED;
  
  // 1. Can we win on this turn?
  for (let c = 0; c < COLS; c++) {
    if (canWin(player, c)) return c;
  }
  
  // 2. Can the opponent win on their next turn? If so, block them.
  for (let c = 0; c < COLS; c++) {
    if (canWin(opponent, c)) return c;
  }
  
  // 3. Score all possible moves and pick the best one
  let bestScore = -10000;
  let bestCols = [];
  
  for (let c = 0; c < COLS; c++) {
    let r = getAvailableRow(c);
    if (r !== -1) {
      // Simulate move
      board[r][c] = player;
      let score = evaluateBoard(player);
      board[r][c] = EMPTY; // Undo move
      
      // Slight preference for center columns
      const centerPreference = [0, 1, 3, 5, 3, 1, 0];
      score += centerPreference[c];
      
      if (score > bestScore) {
        bestScore = score;
        bestCols = [c];
      } else if (score === bestScore) {
        bestCols.push(c);
      }
    }
  }
  
  // Randomly pick from the best equal columns to avoid deterministic games
  if (bestCols.length > 0) {
    return bestCols[Math.floor(Math.random() * bestCols.length)];
  }
  
  // Fallback (should rarely happen unless board is almost full)
  for (let c = 0; c < COLS; c++) {
    if (getAvailableRow(c) !== -1) return c;
  }
  return 0;
}

function canWin(player, col) {
  const r = getAvailableRow(col);
  if (r === -1) return false;
  
  board[r][col] = player;
  const win = checkWin(r, col);
  board[r][col] = EMPTY;
  
  return win !== null;
}

function evaluateBoard(player) {
  let score = 0;
  const opponent = player === RED ? YELLOW : RED;
  
  // Evaluate horizontal windows
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]];
      score += evaluateWindow(window, player, opponent);
    }
  }
  
  // Evaluate vertical windows
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 3; r++) {
      const window = [board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]];
      score += evaluateWindow(window, player, opponent);
    }
  }
  
  // Evaluate diagonal /
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const window = [board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]];
      score += evaluateWindow(window, player, opponent);
    }
  }
  
  // Evaluate diagonal \
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 3; c < COLS; c++) {
      const window = [board[r][c], board[r+1][c-1], board[r+2][c-2], board[r+3][c-3]];
      score += evaluateWindow(window, player, opponent);
    }
  }
  
  return score;
}

function evaluateWindow(window, player, opponent) {
  let score = 0;
  let playerCount = 0;
  let oppCount = 0;
  let emptyCount = 0;
  
  for (let i = 0; i < 4; i++) {
    if (window[i] === player) playerCount++;
    else if (window[i] === opponent) oppCount++;
    else emptyCount++;
  }
  
  if (playerCount === 4) {
    score += 1000; // Found win
  } else if (playerCount === 3 && emptyCount === 1) {
    score += 50;
  } else if (playerCount === 2 && emptyCount === 2) {
    score += 10;
  }
  
  if (oppCount === 3 && emptyCount === 1) {
    score -= 80;
  }
  
  return score;
}

// ==========================================
// Minimax AI with Alpha-Beta Pruning (Depth 5)
// ==========================================

function getMinimaxMove(player) {
  const DEPTH = 5;
  let bestScore = -Infinity;
  let bestCols = [];
  
  // Center-out column order for better pruning
  const colOrder = [3, 2, 4, 1, 5, 0, 6];
  
  for (let c of colOrder) {
    let r = getAvailableRow(c);
    if (r !== -1) {
      board[r][c] = player;
      if (checkWin(r, c)) {
        board[r][c] = EMPTY;
        return c; // Immediate win
      }
      let score = minimax(board, DEPTH - 1, -Infinity, Infinity, false, player);
      board[r][c] = EMPTY;
      
      if (score > bestScore) {
        bestScore = score;
        bestCols = [c];
      } else if (score === bestScore) {
        bestCols.push(c);
      }
    }
  }
  
  if (bestCols.length > 0) {
    return bestCols[Math.floor(Math.random() * bestCols.length)];
  }
  return 0; // Fallback
}

function minimax(boardState, depth, alpha, beta, isMaximizing, botPlayer) {
  const opponent = botPlayer === RED ? YELLOW : RED;
  
  if (depth === 0) {
    return evaluateBoard(botPlayer);
  }
  
  const colOrder = [3, 2, 4, 1, 5, 0, 6];
  let isDraw = true;
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let c of colOrder) {
      let r = getAvailableRow(c);
      if (r !== -1) {
        isDraw = false;
        boardState[r][c] = botPlayer;
        if (checkWin(r, c)) {
          boardState[r][c] = EMPTY;
          return 100000 + depth; // Prefer faster wins
        }
        let eval = minimax(boardState, depth - 1, alpha, beta, false, botPlayer);
        boardState[r][c] = EMPTY;
        maxEval = Math.max(maxEval, eval);
        alpha = Math.max(alpha, eval);
        if (beta <= alpha) break;
      }
    }
    if (isDraw) return 0;
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let c of colOrder) {
      let r = getAvailableRow(c);
      if (r !== -1) {
        isDraw = false;
        boardState[r][c] = opponent;
        if (checkWin(r, c)) {
          boardState[r][c] = EMPTY;
          return -100000 - depth; // Penalize faster losses
        }
        let eval = minimax(boardState, depth - 1, alpha, beta, true, botPlayer);
        boardState[r][c] = EMPTY;
        minEval = Math.min(minEval, eval);
        beta = Math.min(beta, eval);
        if (beta <= alpha) break;
      }
    }
    if (isDraw) return 0;
    return minEval;
  }
}

// Start
init();
