/* ============================================================
   BODEE BOOKS FAMILY GAME HUB — profile-manager.js
   Local user profile management via localStorage.
   Include this script on every page before game-specific scripts.
   ============================================================ */

(function () {
  if (window.ProfileManager) return; // Already loaded

  const PROFILES_KEY = 'bbg_profiles';
  const ACTIVE_KEY = 'bbg_active_profile';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _readProfiles() {
    try {
      return JSON.parse(localStorage.getItem(PROFILES_KEY)) || [];
    } catch { return []; }
  }

  function _writeProfiles(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  function _generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // Simple hash for PIN (not cryptographic — just enough to keep kids honest)
  function _hashPin(pin) {
    if (!pin) return null;
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h + pin.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  // ── Play Time Tracker ─────────────────────────────────────────────────────
  let _playTimeInterval = null;
  const PLAY_TICK_MS = 10000; // Record every 10 seconds

  function _startPlayTimeTracking() {
    _stopPlayTimeTracking();
    _playTimeInterval = setInterval(() => {
      const profile = ProfileManager.getActiveProfile();
      if (!profile) return;
      const profiles = _readProfiles();
      const idx = profiles.findIndex(p => p.id === profile.id);
      if (idx === -1) return;
      profiles[idx].totalPlayTimeMs = (profiles[idx].totalPlayTimeMs || 0) + PLAY_TICK_MS;
      profiles[idx].lastActiveAt = new Date().toISOString();
      _writeProfiles(profiles);
    }, PLAY_TICK_MS);
  }

  function _stopPlayTimeTracking() {
    if (_playTimeInterval) {
      clearInterval(_playTimeInterval);
      _playTimeInterval = null;
    }
  }

  // ── Data Migration ────────────────────────────────────────────────────────
  // Old un-scoped keys that games used before profiles existed
  const LEGACY_KEYS = [
    'harvestDashProgressV1',
    'sky-typer-squadron-high-scores',
    'spellingHallOfFame',
    'spellingUsedWords',
    'nerfops_save',
    'pool_fastest_wins',
    'duckHuntNames',
    'duckHuntVoiceToggle',
    'typing_games_timer_end',
  ];
  // Brain Bridge uses dynamic keys like bb_best_addition, bb_best_multiplication, etc.
  const LEGACY_PREFIX_KEYS = ['bb_best_'];

  function _migrateToProfile(profileId) {
    // Move old un-scoped data into this profile
    let migrated = 0;

    LEGACY_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        localStorage.setItem(`bbg_${profileId}_${key}`, val);
        localStorage.removeItem(key);
        migrated++;
      }
    });

    // Handle prefix-based keys (Brain Bridge)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const prefix of LEGACY_PREFIX_KEYS) {
        if (key.startsWith(prefix)) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            localStorage.setItem(`bbg_${profileId}_${key}`, val);
            localStorage.removeItem(key);
            migrated++;
            i--; // Adjust since we removed a key
          }
        }
      }
    }

    return migrated;
  }

  function _hasLegacyData() {
    for (const key of LEGACY_KEYS) {
      if (localStorage.getItem(key) !== null) return true;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const prefix of LEGACY_PREFIX_KEYS) {
        if (key.startsWith(prefix)) return true;
      }
    }
    return false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.ProfileManager = {

    // Get all profiles
    getProfiles() {
      return _readProfiles();
    },

    // Get the currently active profile (or null)
    getActiveProfile() {
      const id = localStorage.getItem(ACTIVE_KEY);
      if (!id) return null;
      const profiles = _readProfiles();
      return profiles.find(p => p.id === id) || null;
    },

    // Set the active profile by id
    setActiveProfile(id) {
      localStorage.setItem(ACTIVE_KEY, id);
      _startPlayTimeTracking();
    },

    // Create a new profile. Returns the profile object.
    createProfile(name, avatar, pin) {
      const profiles = _readProfiles();
      const profile = {
        id: _generateId(),
        name: name.trim(),
        avatar: avatar || '🎮',
        pin: _hashPin(pin) || null,
        createdAt: new Date().toISOString(),
        totalPlayTimeMs: 0,
        lastActiveAt: new Date().toISOString(),
      };
      profiles.push(profile);
      _writeProfiles(profiles);
      return profile;
    },

    // Delete a profile and all its scoped data
    deleteProfile(id) {
      let profiles = _readProfiles();
      profiles = profiles.filter(p => p.id !== id);
      _writeProfiles(profiles);

      // Remove all scoped keys for this profile
      const prefix = `bbg_${id}_`;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          toRemove.push(key);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      // If the deleted profile was active, clear active
      if (localStorage.getItem(ACTIVE_KEY) === id) {
        localStorage.removeItem(ACTIVE_KEY);
        _stopPlayTimeTracking();
      }
    },

    // Update a profile's name, avatar, or PIN
    updateProfile(id, updates) {
      const profiles = _readProfiles();
      const idx = profiles.findIndex(p => p.id === id);
      if (idx === -1) return null;
      if (updates.name !== undefined) profiles[idx].name = updates.name.trim();
      if (updates.avatar !== undefined) profiles[idx].avatar = updates.avatar;
      if (updates.pin !== undefined) profiles[idx].pin = _hashPin(updates.pin) || null;
      _writeProfiles(profiles);
      return profiles[idx];
    },

    // Verify a PIN for a profile. Returns true if correct or no PIN set.
    verifyPin(id, pin) {
      const profiles = _readProfiles();
      const profile = profiles.find(p => p.id === id);
      if (!profile) return false;
      if (!profile.pin) return true; // No PIN set
      return profile.pin === _hashPin(pin);
    },

    // Check if a profile has a PIN set
    hasPin(id) {
      const profiles = _readProfiles();
      const profile = profiles.find(p => p.id === id);
      return profile ? !!profile.pin : false;
    },

    // Get a profile-scoped localStorage key.
    // If no active profile, falls back to the raw key (graceful degradation).
    getKey(baseKey) {
      const id = localStorage.getItem(ACTIVE_KEY);
      if (!id) return baseKey;
      return `bbg_${id}_${baseKey}`;
    },

    // Start play time tracking (called automatically on setActiveProfile)
    trackPlayTime() {
      _startPlayTimeTracking();
    },

    // Stop play time tracking
    stopPlayTime() {
      _stopPlayTimeTracking();
    },

    // Migrate legacy data into a profile
    migrateToProfile(profileId) {
      return _migrateToProfile(profileId);
    },

    // Check if there is old un-scoped data to migrate
    hasLegacyData() {
      return _hasLegacyData();
    },

    // Format play time for display
    formatPlayTime(ms) {
      if (!ms || ms < 60000) return 'Just started';
      const totalMins = Math.floor(ms / 60000);
      if (totalMins < 60) return `${totalMins}m played`;
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return m > 0 ? `${h}h ${m}m played` : `${h}h played`;
    },
  };

  // Auto-start tracking if there's already an active profile
  if (ProfileManager.getActiveProfile()) {
    _startPlayTimeTracking();
  }

  // Track across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_KEY) {
      if (e.newValue) {
        _startPlayTimeTracking();
      } else {
        _stopPlayTimeTracking();
      }
    }
  });

})();
