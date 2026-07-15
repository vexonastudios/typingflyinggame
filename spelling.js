// --- Profile-scoped storage helpers ---
function _spKey(base) { return typeof ProfileManager !== 'undefined' ? ProfileManager.getKey(base) : base; }

// --- IndexedDB Audio Cache ---
const dbName = "SpellingBeeDB";
const storeName = "audioCache";
let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(storeName);
    };
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve();
    };
    request.onerror = (e) => reject(e);
  });
}

function getAudioFromCache(textKey) {
  return new Promise((resolve) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(textKey);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function saveAudioToCache(textKey, blob) {
  const transaction = db.transaction([storeName], "readwrite");
  const store = transaction.objectStore(storeName);
  store.put(blob, textKey);
}

// --- TTS Engine ---
let currentAudio = null;

async function playNarrator(audioText, displayText) {
  // Update UI text (hide the actual spelling word from sight!)
  document.getElementById('announcerText').innerText = displayText || "Listen closely...";

  // Stop currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    let blob = await getAudioFromCache(audioText);
    if (!blob) {
      // Fetch from Vercel API securely
      const res = await fetch(`/api/tts?text=${encodeURIComponent(audioText)}`);
      if (!res.ok) {
        const errDesc = await res.text();
        throw new Error(`API failed (${res.status}): ${errDesc}`);
      }
      blob = await res.blob();
      saveAudioToCache(audioText, blob);
    }

    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    
    return new Promise((resolve) => {
      currentAudio.onended = () => {
        resolve();
      };
      currentAudio.play().catch(e => {
        console.error("Audio playback blocked", e);
        // Fallback resolve if blocked
        setTimeout(resolve, 2000); 
      });
    });

  } catch (error) {
    console.error("TTS Error:", error);
    // If api fails, gracefully wait 2 seconds then resolve
    return new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// --- Game Logic Engine ---
let players = [];
let totalRounds = 5;
let difficultyStr = 'Easy';
let currentRound = 1;
let currentPlayerIndex = 0;
let currentWordObj = null;
let remainingWords = [];
let inSuddenDeath = false;
let isFirstTurn = true;
let timerEnabled = false;
let turnTimer = null;

// DOM Elements
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const winScreen = document.getElementById('winScreen');
const playerInputsDiv = document.getElementById('playerInputs');
const btnAddPlayer = document.getElementById('btnAddPlayer');
const btnStart = document.getElementById('btnStart');

const btnSayWord = document.getElementById('btnSayWord');
const btnSayDef = document.getElementById('btnSayDef');
const btnSaySent = document.getElementById('btnSaySent');
const spellingInput = document.getElementById('spellingInput');
const btnSubmitSpell = document.getElementById('btnSubmitSpell');
const spellingForm = document.getElementById('spellingForm');

const activePlayerNameText = document.getElementById('activePlayerName');
const roundIndicator = document.getElementById('roundIndicator');
const scoreboard = document.getElementById('scoreboard');
const scoreList = document.getElementById('scoreList');
const stageBg = document.querySelector('.stage-bg');

// Initialize
initDB().then(() => {
  console.log("Audio cache ready!");
});

function renderHallOfFame() {
  const hof = JSON.parse(localStorage.getItem(_spKey('spellingHallOfFame')) || '{}');
  const hofKeys = Object.keys(hof);
  const container = document.getElementById('hallOfFameContainer');
  const list = document.getElementById('hofList');
  if (hofKeys.length === 0) {
    if (container) container.classList.add('hidden');
    return;
  }
  if (container) container.classList.remove('hidden');
  
  const sorted = hofKeys.map(k => ({name: k, ...hof[k]})).sort((a,b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.highestScore - a.highestScore;
  });
  
  if (list) {
    list.innerHTML = sorted.slice(0, 5).map(p => `
      <li class="hof-item">
        <span class="hof-name">${p.name}</span>
        <span class="hof-stats">🏆 ${p.wins} <span style="color: rgba(255,255,255,0.3); margin: 0 4px;">|</span> ⭐ ${p.highestScore}</span>
      </li>
    `).join('');
  }
}
renderHallOfFame();

// Lobby logic
btnAddPlayer.addEventListener('click', () => {
  if (playerInputsDiv.children.length >= 6) return;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'input-modern p-input';
  input.placeholder = `Player ${playerInputsDiv.children.length + 1}`;
  playerInputsDiv.appendChild(input);
});

btnStart.addEventListener('click', () => {
  players = [];
  document.querySelectorAll('.p-input').forEach(inp => {
    let val = inp.value.trim();
    if (val) players.push({ name: val, score: 0, correct: 0 });
  });
  
  if (players.length < 1) {
    alert("Please add at least one player.");
    return;
  }

  difficultyStr = document.getElementById('difficultySelect').value;
  totalRounds = parseInt(document.getElementById('roundsSelect').value);

  // Initialize fresh, unrepeated word pool preventing repeats in memory
  let history = JSON.parse(localStorage.getItem(_spKey('spellingUsedWords')) || '[]');
  remainingWords = DICTIONARY[difficultyStr].filter(ob => !history.includes(ob.word));
  
  if (remainingWords.length === 0) {
      // Emergency reset if dictionary fully exhausted
      const currentTierWords = DICTIONARY[difficultyStr].map(i => i.word);
      history = history.filter(w => !currentTierWords.includes(w));
      localStorage.setItem(_spKey('spellingUsedWords'), JSON.stringify(history));
      remainingWords = [...DICTIONARY[difficultyStr]];
  }

  currentRound = 1;
  currentPlayerIndex = 0;
  inSuddenDeath = false;
  isFirstTurn = true;
  timerEnabled = document.getElementById('timerToggle').checked;
  document.getElementById('sdWarning').classList.add('hidden');
  document.getElementById('diffText').innerText = difficultyStr + ' Difficulty';
  
  lobbyScreen.classList.remove('active');
  gameScreen.classList.add('active');
  scoreboard.classList.remove('hidden');
  
  updateScoreboard();
  startTurn();
});

function updateScoreboard() {
  // Sort by decending score
  const sorted = [...players].sort((a,b) => b.score - a.score);
  scoreList.innerHTML = sorted.map((p, i) => `
    <li>
      <span class="score-name">${i+1}. ${p.name}</span>
      <span class="score-pts">${p.score} pts</span>
    </li>
  `).join('');
}

function disableInputs() {
  btnSayWord.disabled = true;
  btnSayDef.disabled = true;
  btnSaySent.disabled = true;
  spellingInput.disabled = true;
  btnSubmitSpell.disabled = true;
}

function enableInputs() {
  btnSayWord.disabled = false;
  btnSayDef.disabled = false;
  btnSaySent.disabled = false;
  spellingInput.disabled = false;
  btnSubmitSpell.disabled = false;
  setTimeout(() => spellingInput.focus(), 100);

  if (timerEnabled && turnTimer === null) {
    document.getElementById('timerContainer').classList.add('active');
    setTimeout(() => { 
      document.getElementById('timerFill').style.transition = 'width 30s linear'; 
      document.getElementById('timerFill').style.width = '0%'; 
    }, 50);
    
    let timeElapsed = 0;
    turnTimer = setInterval(async () => {
      timeElapsed++;
      if (timeElapsed >= 30) {
        clearInterval(turnTimer);
        turnTimer = null;
        await failPlayerDueToTime();
      }
    }, 1000);
  }
}

async function failPlayerDueToTime() {
    disableInputs();
    stageBg.classList.add('wrong');
    
    if (inSuddenDeath) {
       players[currentPlayerIndex].eliminated = true;
    }

    await playNarrator(
      `Time is up! The correct spelling is: ${currentWordObj.word.toUpperCase().split('').join(', ')}.`, 
      `Time's up! The word was: ${currentWordObj.word}`
    );
    advanceState();
}

async function startTurn() {
  if (turnTimer) {
     clearInterval(turnTimer);
     turnTimer = null;
  }
  document.getElementById('timerContainer').classList.remove('active');
  document.getElementById('timerFill').style.transition = 'none';
  document.getElementById('timerFill').style.width = '100%';

  disableInputs();
  spellingInput.value = '';
  spellingInput.classList.remove('wrong-shake');
  stageBg.classList.remove('correct', 'wrong');

  const player = players[currentPlayerIndex];
  activePlayerNameText.innerText = player.name;
  
  // Animation pop
  activePlayerNameText.classList.remove('name-pop');
  void activePlayerNameText.offsetWidth; // trigger reflow
  activePlayerNameText.classList.add('name-pop');
  
  if (!inSuddenDeath) {
    roundIndicator.querySelector('span').innerText = `Round ${currentRound} / ${totalRounds}`;
  } else {
    roundIndicator.querySelector('span').innerText = `Tie Breaker`;
  }

  // Select random word without repeating
  if (remainingWords.length === 0) {
      let historyObj = JSON.parse(localStorage.getItem(_spKey('spellingUsedWords')) || '[]');
      const tierWds = DICTIONARY[difficultyStr].map(i => i.word);
      historyObj = historyObj.filter(w => !tierWds.includes(w));
      localStorage.setItem(_spKey('spellingUsedWords'), JSON.stringify(historyObj));
      remainingWords = [...DICTIONARY[difficultyStr]]; // Refill if exhausted
  }
  const ranIndex = Math.floor(Math.random() * remainingWords.length);
  currentWordObj = remainingWords.splice(ranIndex, 1)[0];

  let currentHistory = JSON.parse(localStorage.getItem(_spKey('spellingUsedWords')) || '[]');
  if (!currentHistory.includes(currentWordObj.word)) {
      currentHistory.push(currentWordObj.word);
      localStorage.setItem(_spKey('spellingUsedWords'), JSON.stringify(currentHistory));
  }

  // Formatting strings
  let audioStr = `${player.name}, your word is, ${currentWordObj.word}.`;
  let textStr = `${player.name}, your word is...`;

  if (isFirstTurn) {
    audioStr = `${player.name}, step up to the podium. Your word is, ${currentWordObj.word}.`;
    textStr = `${player.name}, step up to the podium!`;
    isFirstTurn = false;
  } else if (inSuddenDeath && players.filter(p => !p.eliminated).length === 1) {
    audioStr = `${player.name}, if you spell this right, you win! Your word is, ${currentWordObj.word}.`;
    textStr = `If you spell this right, you win!`;
  }

  // Announce
  await playNarrator(audioStr, textStr);
  
  enableInputs();
}

btnSayWord.addEventListener('click', async () => {
  disableInputs();
  await playNarrator(`The word is, ${currentWordObj.word}.`, `The word is...`);
  enableInputs();
});

btnSayDef.addEventListener('click', async () => {
  disableInputs();
  await playNarrator(`${currentWordObj.def}`, `Definition: ${currentWordObj.def}`);
  enableInputs();
});

btnSaySent.addEventListener('click', async () => {
  disableInputs();
  await playNarrator(`${currentWordObj.sent}`, `Listen to the sentence...`);
  enableInputs();
});

spellingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const guess = spellingInput.value.trim().toLowerCase();
  
  if (!guess) return;

  if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
  }
  document.getElementById('timerFill').style.transition = 'none';

  disableInputs();

  if (guess === currentWordObj.word.toLowerCase()) {
    // Correct
    stageBg.classList.add('correct');
    
    // Fair, equal points
    let earned = 1;
    players[currentPlayerIndex].score += earned;
    players[currentPlayerIndex].correct++;
    updateScoreboard();

    await playNarrator(
      `Correct!`, 
      `Correct! +1 pt`
    );
    
  } else {
    // Wrong
    stageBg.classList.add('wrong');
    // Animate shaking input (we can add a keyframe later if we want)
    
    if (inSuddenDeath) {
       players[currentPlayerIndex].eliminated = true;
    }

    await playNarrator(
      `Incorrect. The correct spelling is: ${currentWordObj.word.toUpperCase().split('').join(', ')}... ${currentWordObj.word}.`, 
      `Incorrect! The spelling was: ${currentWordObj.word}`
    );
  }

  advanceState();
});

async function advanceState() {
  // Advance state
  do {
    currentPlayerIndex++;
    if (currentPlayerIndex >= players.length) {
      currentPlayerIndex = 0;
      
      if (inSuddenDeath) {
         let activeCount = players.filter(p => !p.eliminated).length;
         if (activeCount <= 1) {
            showWinScreen();
            return;
         }
      } else {
         currentRound++;
      }
    }
  } while (inSuddenDeath && players[currentPlayerIndex].eliminated);

  if (!inSuddenDeath && currentRound > totalRounds) {
     const highestScore = Math.max(...players.map(p => p.score));
     const tied = players.filter(p => p.score === highestScore);
     if (tied.length > 1) {
         inSuddenDeath = true;
         // Mark offline players
         players.forEach(p => { p.eliminated = !tied.includes(p); });
         
         // Fix indexing on jump
         currentPlayerIndex = players.findIndex(p => !p.eliminated);
         
         // Increase difficulty
         if (difficultyStr === 'Easy') difficultyStr = 'Medium';
         else if (difficultyStr === 'Medium') difficultyStr = 'Hard';
         else if (difficultyStr === 'Hard') difficultyStr = 'SpellingBee';
         
         let hist = JSON.parse(localStorage.getItem(_spKey('spellingUsedWords')) || '[]');
         remainingWords = DICTIONARY[difficultyStr].filter(ob => !hist.includes(ob.word));
         
         if (remainingWords.length === 0) {
             const sdTierWords = DICTIONARY[difficultyStr].map(i => i.word);
             hist = hist.filter(w => !sdTierWords.includes(w));
             localStorage.setItem(_spKey('spellingUsedWords'), JSON.stringify(hist));
             remainingWords = [...DICTIONARY[difficultyStr]];
         }
         document.getElementById('diffText').innerText = difficultyStr + " Difficulty";
         document.getElementById('sdWarning').classList.remove('hidden');
         await playNarrator("We have a tie! Increasing dictionary difficulty for sudden death...!", "TIE! Sudden Death!");
     } else {
         showWinScreen();
         return;
     }
  }

  // Small delay before next turn
  setTimeout(() => {
    startTurn();
  }, 1500);
}

function showWinScreen() {
  gameScreen.classList.remove('active');
  scoreboard.classList.add('hidden');
  winScreen.classList.add('active');

  const sorted = [...players].sort((a,b) => b.score - a.score);
  
  // Save to Hall of Fame
  const hof = JSON.parse(localStorage.getItem(_spKey('spellingHallOfFame')) || '{}');
  const topScore = sorted[0].score;
  const winners = sorted.filter(p => p.score === topScore);
  
  players.forEach(p => {
    if (!hof[p.name]) hof[p.name] = { wins: 0, highestScore: 0, totalCorrect: 0 };
    if (p.score > hof[p.name].highestScore) hof[p.name].highestScore = p.score;
    // Add correct words
    hof[p.name].totalCorrect += p.correct;
  });
  winners.forEach(w => {
    hof[w.name].wins += 1;
  });
  localStorage.setItem(_spKey('spellingHallOfFame'), JSON.stringify(hof));
  
  let html = `<h2 class="win-title">Championship Over!</h2>
              <div class="final-results">`;
  
  sorted.forEach((p, i) => {
    let placeClass = i === 0 ? 'first-place' : '';
    let medal = i === 0 ? '🏆 1st' : i === 1 ? '🥈 2nd' : i === 2 ? '🥉 3rd' : `${i+1}th`;
    html += `
      <div class="result-item ${placeClass}">
        <span>${medal} - ${p.name}</span>
        <span class="result-points">${p.score} pts</span>
      </div>`;
  });

  html += `</div>
           <button class="btn btn-start" onclick="location.reload()">Play Again</button>
           <a href="index.html" class="btn-back" style="display:block; margin-top:15px;">← Back to Hub</a>`;
           
  document.getElementById('winCard').innerHTML = html;
  
  // Play Fanfare Audio Synth
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, actx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, actx.currentTime + 0.15); // E5
    osc.frequency.setValueAtTime(783.99, actx.currentTime + 0.3); // G5
    osc.frequency.setValueAtTime(1046.50, actx.currentTime + 0.45); // C6
    gain.gain.setValueAtTime(0, actx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, actx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0.3, actx.currentTime + 0.8);
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + 1.2);
    osc.start();
    osc.stop(actx.currentTime + 1.2);
  } catch(e) {}

  if(sorted.length > 0) {
    playNarrator(
      `The spelling bee has concluded! Congratulations to ${sorted[0].name} for winning the golden trophy!`, 
      `Congratulations to ${sorted[0].name}!`
    );
  }
}
