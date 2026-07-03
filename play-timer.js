// play-timer.js

(function() {
  const PIN_CODE = "1234"; // Default simple pin

  // Ensure this script only runs once per page
  if (window.__playTimerInitialized) return;
  window.__playTimerInitialized = true;

  // HTML to inject
  const htmlTemplate = `
    <!-- Floating Settings Button -->
    <div id="parent-timer-btn" title="Parent Settings">⚙️</div>

    <!-- Main Overlay Container -->
    <div id="timer-main-overlay" class="timer-overlay">
      
      <!-- PIN Entry Modal -->
      <div id="timer-pin-modal" class="timer-modal" style="display: none;">
        <h2>Parent Settings</h2>
        <p>Enter Parent PIN to continue.</p>
        <input type="password" id="timer-pin-input" class="timer-pin-input" maxlength="4" placeholder="••••" autocomplete="off" />
        <div id="timer-pin-error" class="timer-pin-error">Incorrect PIN. Try 1234.</div>
        <div class="timer-btn-row">
          <button id="timer-pin-submit" class="timer-btn timer-btn--primary">Unlock</button>
          <button id="timer-pin-cancel" class="timer-btn timer-btn--cancel">Cancel</button>
        </div>
      </div>

      <!-- Settings Modal -->
      <div id="timer-settings-modal" class="timer-modal" style="display: none;">
        <h2>Time Limits</h2>
        <p>Set a playtime limit. The game will lock across all tabs when time is up.</p>
        
        <div id="timer-status-container" style="display: none;">
          <p style="margin-bottom: 0;">Time Remaining:</p>
          <div id="timer-status-display">00:00</div>
          <button id="timer-stop-btn" class="timer-btn timer-btn--danger timer-btn--full">Stop Timer & Reset</button>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
        </div>

        <p style="margin-bottom: 12px; color: #f1f5f9; font-weight: bold;">Set New Timer:</p>
        <div class="timer-btn-row">
          <button class="timer-btn timer-set-btn" data-minutes="15">15 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="30">30 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="45">45 Mins</button>
          <button class="timer-btn timer-set-btn" data-minutes="60">1 Hour</button>
        </div>
        <button id="timer-settings-close" class="timer-btn timer-btn--cancel" style="margin-top: 16px;">Close</button>
      </div>

      <!-- Block Modal (Time's Up) -->
      <div id="timer-block-modal" class="timer-modal" style="display: none;">
        <h2>⏰ Time's Up!</h2>
        <p>Your playtime is over. Great job playing!</p>
        <button id="timer-unlock-btn" class="timer-btn timer-btn--primary timer-btn--full">Parent Unlock</button>
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
    const pinModal = document.getElementById('timer-pin-modal');
    const settingsModal = document.getElementById('timer-settings-modal');
    const blockModal = document.getElementById('timer-block-modal');
    
    const pinInput = document.getElementById('timer-pin-input');
    const pinError = document.getElementById('timer-pin-error');
    
    const statusContainer = document.getElementById('timer-status-container');
    const statusDisplay = document.getElementById('timer-status-display');

    let checkInterval = null;
    let isBlocked = false;

    // ----- UI Flow -----

    // Open PIN modal
    function openPinModal() {
      overlay.classList.add('active');
      pinModal.style.display = 'block';
      settingsModal.style.display = 'none';
      blockModal.style.display = 'none';
      pinInput.value = '';
      pinError.style.display = 'none';
      setTimeout(() => pinInput.focus(), 100);
    }

    // Submit PIN
    function submitPin() {
      if (pinInput.value === PIN_CODE) {
        // Success
        pinModal.style.display = 'none';
        openSettingsModal();
      } else {
        // Fail
        pinError.style.display = 'block';
        pinInput.value = '';
        pinInput.focus();
      }
    }

    // Open Settings
    function openSettingsModal() {
      settingsModal.style.display = 'block';
      updateSettingsUI();
    }

    // Close all (if not blocked)
    function closeModals() {
      if (isBlocked) {
        // If blocked, can't close back to game, go back to block screen
        settingsModal.style.display = 'none';
        pinModal.style.display = 'none';
        blockModal.style.display = 'block';
      } else {
        overlay.classList.remove('active');
        setTimeout(() => {
          pinModal.style.display = 'none';
          settingsModal.style.display = 'none';
          blockModal.style.display = 'none';
        }, 300);
      }
    }

    // Show Block Screen
    function showBlockScreen() {
      isBlocked = true;
      overlay.classList.add('active');
      pinModal.style.display = 'none';
      settingsModal.style.display = 'none';
      blockModal.style.display = 'block';
    }

    // ----- Event Listeners -----

    document.getElementById('parent-timer-btn').addEventListener('click', () => {
      openPinModal();
    });

    document.getElementById('timer-pin-submit').addEventListener('click', submitPin);
    
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPin();
    });

    document.getElementById('timer-pin-cancel').addEventListener('click', closeModals);
    document.getElementById('timer-settings-close').addEventListener('click', closeModals);
    document.getElementById('timer-unlock-btn').addEventListener('click', openPinModal);

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
        statusContainer.style.display = 'block';
      } else {
        statusContainer.style.display = 'none';
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
        statusDisplay.textContent = "00:00";
      } else {
        // Time still running
        if (isBlocked) {
          // If they somehow had it blocked but time was extended in another tab
          isBlocked = false;
          closeModals();
        }
        // Format MM:SS
        const totalSecs = Math.floor(remainingMs / 1000);
        const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
        const s = (totalSecs % 60).toString().padStart(2, '0');
        statusDisplay.textContent = `${m}:${s}`;
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
