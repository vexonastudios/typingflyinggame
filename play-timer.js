// play-timer.js

(function() {
  // Ensure this script only runs once per page
  if (window.__playTimerInitialized) return;
  window.__playTimerInitialized = true;

  // HTML to inject
  const htmlTemplate = `
    <!-- Floating Time Display / Settings Button -->
    <div id="kid-timer-btn" title="Timer Settings">
      <span class="kid-timer-icon">⏰</span>
      <span id="kid-timer-text">Set Time</span>
    </div>

    <!-- Main Overlay Container -->
    <div id="timer-main-overlay" class="timer-overlay">

      <!-- Settings Modal -->
      <div id="timer-settings-modal" class="timer-modal" style="display: none;">
        <h2>Playtime Limit</h2>
        <p>Set a playtime limit. We'll let you know when it's time to take a break or let someone else play.</p>

        <div class="timer-btn-row">
          <button class="timer-btn timer-set-btn" data-minutes="15">15 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="30">30 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="45">45 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="60">1 Hour</button>
        </div>
        
        <div id="timer-stop-container" style="display: none; margin-top: 12px;">
           <button id="timer-stop-btn" class="timer-btn timer-btn--cancel" style="border: 1px solid #334155;">Stop Timer</button>
        </div>

        <button id="timer-settings-close" class="timer-btn timer-btn--cancel" style="margin-top: 16px;">Cancel</button>
      </div>

      <!-- Block Modal (Time's Up) -->
      <div id="timer-block-modal" class="timer-modal" style="display: none;">
        <h2>⏰ Time's Up!</h2>
        <p>Great job playing! Your time is up for now. Let the next player have a turn, or take a break!</p>
        <button id="timer-unlock-btn" class="timer-btn timer-btn--success timer-btn--full">Play Again (Reset)</button>
      </div>

    </div>
  `;

  // Inject DOM
  document.addEventListener("DOMContentLoaded", () => {
    document.body.insertAdjacentHTML('beforeend', htmlTemplate);
    setupTimerLogic();
  });

  // If DOM is already loaded (e.g. script loaded async late)
  if (document.readyState === "interactive" || document.readyState === "complete") {
    document.body.insertAdjacentHTML('beforeend', htmlTemplate);
    setupTimerLogic();
  }

  function setupTimerLogic() {
    const overlay = document.getElementById('timer-main-overlay');
    const settingsModal = document.getElementById('timer-settings-modal');
    const blockModal = document.getElementById('timer-block-modal');
    
    const stopContainer = document.getElementById('timer-stop-container');
    const timerText = document.getElementById('kid-timer-text');

    let checkInterval = null;
    let isBlocked = false;

    // ----- UI Flow -----

    // Open Settings
    function openSettingsModal() {
      overlay.classList.add('active');
      settingsModal.style.display = 'block';
      blockModal.style.display = 'none';
      updateSettingsUI();
    }

    // Close all
    function closeModals() {
      if (isBlocked) {
        // If blocked, just show block screen
        settingsModal.style.display = 'none';
        blockModal.style.display = 'block';
      } else {
        overlay.classList.remove('active');
        setTimeout(() => {
          settingsModal.style.display = 'none';
          blockModal.style.display = 'none';
        }, 300);
      }
    }

    // Show Block Screen
    function showBlockScreen() {
      isBlocked = true;
      overlay.classList.add('active');
      settingsModal.style.display = 'none';
      blockModal.style.display = 'block';
    }

    // ----- Event Listeners -----

    document.getElementById('kid-timer-btn').addEventListener('click', openSettingsModal);
    document.getElementById('timer-settings-close').addEventListener('click', closeModals);
    
    // Reset/Unlock button on the block screen (Honor system)
    document.getElementById('timer-unlock-btn').addEventListener('click', () => {
      localStorage.removeItem('typing_games_timer_end');
      isBlocked = false;
      closeModals();
      updateSettingsUI();
    });

    // Set Timer Buttons
    document.querySelectorAll('.timer-set-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mins = parseInt(e.target.dataset.minutes, 10);
        setTimer(mins);
      });
    });

    // Stop Timer Button
    document.getElementById('timer-stop-btn').addEventListener('click', () => {
      localStorage.removeItem('typing_games_timer_end');
      isBlocked = false;
      closeModals();
      updateSettingsUI();
    });

    // ----- Core Logic -----

    function setTimer(minutes) {
      const endTime = Date.now() + (minutes * 60 * 1000);
      localStorage.setItem('typing_games_timer_end', endTime.toString());
      isBlocked = false;
      closeModals();
      startLoop();
    }

    function updateSettingsUI() {
      const endTimeStr = localStorage.getItem('typing_games_timer_end');
      if (endTimeStr) {
        stopContainer.style.display = 'block';
      } else {
        stopContainer.style.display = 'none';
        timerText.textContent = "Set Time";
      }
    }

    function startLoop() {
      if (checkInterval) clearInterval(checkInterval);
      checkInterval = setInterval(checkTimer, 1000);
      checkTimer(); // Check immediately
    }

    function checkTimer() {
      const endTimeStr = localStorage.getItem('typing_games_timer_end');
      if (!endTimeStr) {
        if (isBlocked) {
          isBlocked = false;
          closeModals();
        }
        timerText.textContent = "Set Time";
        return; // No timer active
      }

      const endTime = parseInt(endTimeStr, 10);
      const now = Date.now();
      const remainingMs = endTime - now;

      if (remainingMs <= 0) {
        // Time is up!
        if (!isBlocked && overlay.style.display !== 'block') {
          showBlockScreen();
        }
        timerText.textContent = "00:00";
      } else {
        // Time still running
        if (isBlocked) {
          isBlocked = false;
          closeModals();
        }
        // Format MM:SS
        const totalSecs = Math.floor(remainingMs / 1000);
        const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const s = (totalSecs % 60).toString().padStart(2, '0');
        timerText.textContent = `${m}:${s}`;
      }
    }

    // Listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'typing_games_timer_end') {
        checkTimer();
        if (settingsModal.style.display === 'block') {
          updateSettingsUI();
        }
      }
    });

    // Start loop on load
    startLoop();
  }

})();
