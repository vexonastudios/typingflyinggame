(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const easeOut = value => 1 - Math.pow(1 - value, 3);
  const random = (min, max) => min + Math.random() * (max - min);

  const EVENT_CONFIG = {
    discipline: { label: 'Batting Challenge', limit: 20, record: 'High score' },
    derby: { label: 'Home Run Derby', outs: 10, pitchCap: 30, record: 'High score' },
    targets: { label: 'Target Field', limit: 15, record: 'High score' },
  };

  const DIFFICULTY_CONFIG = {
    rookie: {
      duration: 1.16,
      contactWindow: 0.16,
      strikeChance: 0.78,
      types: ['fastball', 'changeup'],
      note: 'Slower fastballs and changeups with a wide contact window',
    },
    allstar: {
      duration: 0.9,
      contactWindow: 0.12,
      strikeChance: 0.72,
      types: ['fastball', 'changeup', 'curveball', 'sinker'],
      note: 'Fastballs, changeups, and breaking pitches',
    },
    legend: {
      duration: 0.7,
      contactWindow: 0.09,
      strikeChance: 0.68,
      types: ['fastball', 'fastball', 'changeup', 'curveball', 'sinker'],
      note: 'Late-breaking pitches with a narrow contact window',
    },
  };

  const PITCH_NAMES = {
    fastball: 'FASTBALL',
    changeup: 'CHANGEUP',
    curveball: 'CURVEBALL',
    sinker: 'SINKER',
  };

  const FIELD_TARGETS = [
    { id: 'barn', label: 'BARN', x: 0.19, distance: 315, points: 1800, color: '#ef6a42' },
    { id: 'gate', label: 'CENTER GATE', x: 0.5, distance: 385, points: 2500, color: '#f3c552' },
    { id: 'tower', label: 'WATER TOWER', x: 0.73, distance: 405, points: 3200, color: '#64b5dd' },
  ];

  class SoundBoard {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    resume() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.ctx = new AudioContext();
      }
      if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    }

    tone(frequency, duration, type = 'sine', volume = 0.08, slide = 0) {
      if (!this.enabled) return;
      this.resume();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + slide), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    noise(duration, volume, highpass = 0) {
      if (!this.enabled) return;
      this.resume();
      if (!this.ctx) return;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      if (highpass) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = highpass;
        source.connect(filter).connect(gain).connect(this.ctx.destination);
      } else {
        source.connect(gain).connect(this.ctx.destination);
      }
      source.start();
    }

    play(name) {
      if (!this.enabled) return;
      if (name === 'count') this.tone(420, 0.12, 'square', 0.07, 80);
      if (name === 'pitch') this.noise(0.13, 0.035, 900);
      if (name === 'miss') this.tone(145, 0.2, 'sawtooth', 0.07, -60);
      if (name === 'called') this.tone(210, 0.16, 'square', 0.06, -40);
      if (name === 'ball') this.tone(390, 0.12, 'sine', 0.05, 90);
      if (name === 'crack') {
        this.noise(0.16, 0.18, 700);
        this.tone(125, 0.18, 'square', 0.11, -35);
      }
      if (name === 'foul') {
        this.noise(0.1, 0.09, 1300);
        this.tone(260, 0.16, 'triangle', 0.06, -80);
      }
      if (name === 'target') {
        [520, 660, 820].forEach((frequency, index) => {
          window.setTimeout(() => this.tone(frequency, 0.18, 'triangle', 0.08, 100), index * 75);
        });
      }
      if (name === 'cheer' || name === 'win') {
        this.noise(name === 'win' ? 1.1 : 0.75, 0.06, 260);
        [330, 440, 550, 660].forEach((frequency, index) => {
          window.setTimeout(() => this.tone(frequency, 0.35, 'triangle', 0.045, 80), index * 90);
        });
      }
    }
  }

  class FenceBusters {
    constructor() {
      this.canvas = $('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.background = new Image();
      this.background.src = 'images/fence-busters-ballpark.jpg';
      this.sfx = new SoundBoard();
      this.state = 'setup';
      this.phase = 'idle';
      this.paused = false;
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = 1;
      this.sessionToken = 0;
      this.lastTime = 0;
      this.time = 0;
      this.swingTime = 0;
      this.pitch = null;
      this.flight = null;
      this.particles = [];
      this.activePlayer = 0;
      this.players = [];
      this.event = 'discipline';
      this.difficulty = 'allstar';
      this.playerCount = 1;
      this.phaseTime = 0;
      this.resultDelay = 0;
      this.shake = 0;
      this.flash = 0;
      this.turnChanged = false;

      this._bindUi();
      this._resize();
      this._refreshSetup();
      this._refreshIcons();
      window.addEventListener('resize', () => this._resize());
      window.addEventListener('keydown', event => this._handleKey(event));
      document.addEventListener('fullscreenchange', () => this._syncFullscreen());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.state === 'playing' && !this.paused) this._pause();
      });
      requestAnimationFrame(time => this._loop(time));
      window.__fenceBusters = this;
    }

    _bindUi() {
      document.querySelectorAll('input[name="event"]').forEach(input => {
        input.addEventListener('change', () => this._refreshSetup());
      });
      document.querySelectorAll('input[name="difficulty"]').forEach(input => {
        input.addEventListener('change', () => this._refreshSetup());
      });
      document.querySelectorAll('input[name="players"]').forEach(input => {
        input.addEventListener('change', () => this._refreshSetup());
      });

      $('startBtn').addEventListener('click', () => this._startGame());
      $('swingBtn').addEventListener('pointerdown', event => {
        event.preventDefault();
        this._swing();
      });
      this.canvas.addEventListener('pointerdown', event => {
        if (this.state !== 'playing' || this.paused) return;
        event.preventDefault();
        this._swing();
      });
      $('pauseBtn').addEventListener('click', () => this._pause());
      $('resumeBtn').addEventListener('click', () => this._resume());
      $('restartBtn').addEventListener('click', () => this._startGame());
      $('setupBtn').addEventListener('click', () => this._showSetup());
      $('playAgainBtn').addEventListener('click', () => this._startGame());
      $('resultsSetupBtn').addEventListener('click', () => this._showSetup());
      $('soundBtn').addEventListener('click', () => this._toggleSound());
      $('fullscreenBtn').addEventListener('click', () => this._toggleFullscreen());
    }

    _handleKey(event) {
      if (event.target.matches('input, select, textarea')) return;
      if (['Space', 'KeyF', 'Escape'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Space') this._swing();
      if (event.code === 'KeyF') this._toggleFullscreen();
      if (event.code === 'Escape' && this.state === 'playing') {
        if (this.paused) this._resume();
        else this._pause();
      }
    }

    _refreshSetup() {
      this.event = document.querySelector('input[name="event"]:checked')?.value || 'discipline';
      this.difficulty = document.querySelector('input[name="difficulty"]:checked')?.value || 'allstar';
      this.playerCount = Number(document.querySelector('input[name="players"]:checked')?.value || 1);

      document.querySelectorAll('.event-option').forEach(option => {
        option.classList.toggle('selected', option.querySelector('input').checked);
      });
      $('p2NameField').classList.toggle('hidden', this.playerCount === 1);
      $('pitcherNote').textContent = DIFFICULTY_CONFIG[this.difficulty].note;
      this._updateBestRecord();
    }

    _recordKey() {
      return `fence-busters-v1-${this.event}-${this.difficulty}-${this.playerCount}`;
    }

    _updateBestRecord() {
      const best = Number(localStorage.getItem(this._recordKey()) || 0);
      $('bestRecord').textContent = `${EVENT_CONFIG[this.event].record}: ${best.toLocaleString()}`;
    }

    _makePlayer(index) {
      const input = index === 0 ? $('p1Name') : $('p2Name');
      return {
        name: input.value.trim() || `Slugger ${index + 1}`,
        score: 0,
        pitches: 0,
        outs: 0,
        hits: 0,
        homeRuns: 0,
        smartTakes: 0,
        perfects: 0,
        chases: 0,
        streak: 0,
        bestDistance: 0,
      };
    }

    async _startGame() {
      this._refreshSetup();
      this.sfx.resume();
      this.sessionToken += 1;
      const token = this.sessionToken;
      this.players = Array.from({ length: this.playerCount }, (_, index) => this._makePlayer(index));
      this.activePlayer = 0;
      this.state = 'playing';
      this.phase = 'countdown';
      this.paused = false;
      this.pitch = null;
      this.flight = null;
      this.particles = [];
      this.swingTime = 0;
      this.shake = 0;
      this.flash = 0;
      document.body.classList.add('playing');
      $('gameSetup').classList.add('hidden');
      $('resultsOverlay').classList.add('hidden');
      $('pauseOverlay').classList.add('hidden');
      $('gameHud').classList.remove('hidden');
      $('gameTools').classList.remove('hidden');
      $('swingBtn').classList.remove('hidden');
      $('pitchReadout').classList.add('hidden');
      $('turnBanner').classList.add('hidden');
      this._updateHud();
      this._refreshIcons();

      $('countdown').classList.remove('hidden');
      for (const value of ['3', '2', '1', 'PLAY BALL']) {
        if (token !== this.sessionToken) return;
        $('countdown').textContent = value;
        this.sfx.play('count');
        await new Promise(resolve => window.setTimeout(resolve, value === 'PLAY BALL' ? 650 : 560));
      }
      if (token !== this.sessionToken) return;
      $('countdown').classList.add('hidden');
      this._beginPitch();
    }

    _beginPitch() {
      if (this.state !== 'playing') return;
      const difficulty = DIFFICULTY_CONFIG[this.difficulty];
      const type = difficulty.types[Math.floor(Math.random() * difficulty.types.length)];
      const isStrike = Math.random() < difficulty.strikeChance;
      const location = this._makePitchLocation(isStrike);
      let duration = difficulty.duration;
      if (type === 'fastball') duration *= 0.9;
      if (type === 'changeup') duration *= 1.2;
      if (type === 'sinker') duration *= 0.98;
      const curveDirection = type === 'curveball' ? (Math.random() < 0.5 ? -1 : 1) : 0;

      this.pitch = {
        type,
        isStrike,
        location,
        duration,
        curve: curveDirection * random(0.12, 0.2),
        progress: 0,
        windup: 0,
        windupDuration: random(0.62, 0.92),
        resolved: false,
        trail: [],
      };
      this.flight = null;
      this.phase = 'windup';
      this.phaseTime = 0;
      this.swingTime = 0;
      $('pitchReadout').classList.add('hidden');
      $('swingBtn').classList.remove('pressed');
    }

    _makePitchLocation(isStrike) {
      if (isStrike) {
        return { x: random(0.12, 0.88), y: random(0.12, 0.88) };
      }
      const side = Math.floor(Math.random() * 4);
      if (side === 0) return { x: random(-0.38, -0.08), y: random(0.05, 0.95) };
      if (side === 1) return { x: random(1.08, 1.38), y: random(0.05, 0.95) };
      if (side === 2) return { x: random(0.05, 0.95), y: random(-0.36, -0.08) };
      return { x: random(0.05, 0.95), y: random(1.08, 1.38) };
    }

    _swing() {
      if (this.state !== 'playing' || this.paused || !this.pitch || this.pitch.resolved) return;
      if (!['windup', 'pitching'].includes(this.phase)) return;
      this.sfx.resume();
      this.swingTime = 0.42;
      $('swingBtn').classList.add('pressed');

      if (this.phase === 'windup') {
        this.pitch.resolved = true;
        this._resolveMiss('WAY EARLY');
        return;
      }

      const ideal = 0.91;
      const timingError = this.pitch.progress - ideal;
      const windowSize = DIFFICULTY_CONFIG[this.difficulty].contactWindow;
      const reachable = this.pitch.location.x > -0.2 && this.pitch.location.x < 1.2
        && this.pitch.location.y > -0.24 && this.pitch.location.y < 1.24;

      this.pitch.resolved = true;
      if (Math.abs(timingError) <= windowSize && reachable) {
        this._makeContact(timingError, windowSize);
      } else {
        this._resolveMiss(timingError < 0 ? 'EARLY' : 'LATE');
      }
    }

    _makeContact(timingError, windowSize) {
      const quality = clamp(1 - Math.abs(timingError) / windowSize, 0, 1);
      const locationPenalty = Math.max(
        Math.abs(this.pitch.location.x - 0.5) - 0.42,
        Math.abs(this.pitch.location.y - 0.5) - 0.44,
        0,
      ) * 1.4;
      const adjustedQuality = clamp(quality - locationPenalty, 0, 1);
      const direction = clamp(
        timingError * 3.7 + (this.pitch.location.x - 0.5) * 0.26 + random(-0.035, 0.035),
        -0.78,
        0.78,
      );
      let distance = Math.round(105 + adjustedQuality * 325 + random(-15, 20));
      const foul = adjustedQuality < 0.22 || Math.abs(direction) > 0.58;
      const grounder = !foul && adjustedQuality < 0.45;
      if (grounder) distance = Math.round(70 + adjustedQuality * 170);
      if (foul) distance = Math.round(random(75, 170));
      const homeRun = !foul && !grounder && distance >= 355 && Math.abs(direction) < 0.52;
      const timing = Math.abs(timingError) < windowSize * 0.24
        ? 'PERFECT'
        : (timingError < 0 ? 'EARLY' : 'LATE');
      const target = this.event === 'targets' && !foul
        ? FIELD_TARGETS.find(item => {
          const destinationX = 0.5 + direction * 0.62;
          return Math.abs(destinationX - item.x) < 0.095 && Math.abs(distance - item.distance) < 82;
        })
        : null;

      this.flight = {
        progress: 0,
        duration: grounder ? 0.72 : 1.08,
        direction,
        distance,
        quality: adjustedQuality,
        foul,
        grounder,
        homeRun,
        target,
        timing,
        pitchType: this.pitch.type,
        recorded: false,
      };
      this.phase = 'flight';
      this.sfx.play(foul ? 'foul' : 'crack');
      this.shake = homeRun ? 12 : (adjustedQuality > 0.75 ? 7 : 3);
      this.flash = adjustedQuality > 0.8 ? 0.18 : 0.08;
      this._spawnContactBurst(adjustedQuality, foul);
      this._showReadout(PITCH_NAMES[this.pitch.type], timing, adjustedQuality > 0.55 ? 'positive' : '');
    }

    _resolveMiss(timing) {
      const player = this.players[this.activePlayer];
      player.chases += this.pitch && !this.pitch.isStrike ? 1 : 0;
      player.streak = 0;
      if (this.event === 'derby') player.outs += 1;
      this.sfx.play('miss');
      this._showReadout(this.pitch ? PITCH_NAMES[this.pitch.type] : 'PITCH', timing, 'negative');
      this._recordResolvedPitch({ positive: false, label: timing });
    }

    _resolveTake() {
      if (!this.pitch || this.pitch.resolved) return;
      this.pitch.resolved = true;
      const player = this.players[this.activePlayer];
      if (this.pitch.isStrike) {
        player.streak = 0;
        if (this.event === 'derby') player.outs += 1;
        this.sfx.play('called');
        this._showReadout(PITCH_NAMES[this.pitch.type], 'CALLED STRIKE', 'negative');
        this._recordResolvedPitch({ positive: false, label: 'Called strike' });
      } else {
        const points = this.event === 'discipline' ? 150 + player.streak * 25 : 50;
        player.smartTakes += 1;
        player.streak += 1;
        player.score += points;
        this.sfx.play('ball');
        this._showReadout(PITCH_NAMES[this.pitch.type], `GOOD TAKE +${points}`, 'positive');
        this._recordResolvedPitch({ positive: true, label: 'Good take' });
      }
    }

    _finishFlight() {
      if (!this.flight || this.flight.recorded) return;
      this.flight.recorded = true;
      const player = this.players[this.activePlayer];
      const hit = this.flight;
      let points = 0;
      let label = '';

      if (hit.foul) {
        points = 40;
        player.streak = 0;
        label = 'FOUL BALL';
        if (this.event === 'derby') player.outs += 1;
      } else {
        player.hits += 1;
        player.streak += 1;
        player.bestDistance = Math.max(player.bestDistance, hit.distance);
        if (hit.timing === 'PERFECT') player.perfects += 1;
        if (hit.homeRun) {
          player.homeRuns += 1;
          points = 1000 + hit.distance + player.streak * 75;
          label = `HOME RUN · ${hit.distance} FT`;
          this.sfx.play('cheer');
        } else if (hit.grounder) {
          points = 120 + Math.round(hit.quality * 180);
          label = `GROUNDER · ${hit.distance} FT`;
          if (this.event === 'derby') player.outs += 1;
        } else {
          points = 280 + hit.distance + Math.round(hit.quality * 220);
          label = `DRIVE · ${hit.distance} FT`;
          if (this.event === 'derby') player.outs += 1;
        }

        if (hit.target) {
          points += hit.target.points;
          label = `${hit.target.label} HIT · +${hit.target.points}`;
          this.sfx.play('target');
        }
      }

      const multiplier = 1 + Math.min(1.5, Math.max(0, player.streak - 1) * 0.15);
      points = Math.round(points * multiplier);
      player.score += points;
      this._showReadout(PITCH_NAMES[hit.pitchType], `${label} · +${points}`, hit.foul ? 'negative' : 'positive');
      this._recordResolvedPitch({ positive: !hit.foul, label });
    }

    _recordResolvedPitch() {
      const player = this.players[this.activePlayer];
      player.pitches += 1;
      this.phase = 'result';
      this.phaseTime = 0;
      this.resultDelay = this.flight ? 1.05 : 0.85;
      this._updateHud();
    }

    _isPlayerDone(player) {
      const config = EVENT_CONFIG[this.event];
      if (this.event === 'derby') return player.outs >= config.outs || player.pitches >= config.pitchCap;
      return player.pitches >= config.limit;
    }

    _advanceTurn() {
      if (this.players.every(player => this._isPlayerDone(player))) {
        this._finishGame();
        return;
      }

      const previous = this.activePlayer;
      if (this.playerCount > 1) {
        for (let offset = 1; offset <= this.playerCount; offset++) {
          const candidate = (previous + offset) % this.playerCount;
          if (!this._isPlayerDone(this.players[candidate])) {
            this.activePlayer = candidate;
            break;
          }
        }
      }
      this.turnChanged = this.activePlayer !== previous;
      this.phase = 'between';
      this.phaseTime = 0;
      this.pitch = null;
      this.flight = null;
      if (this.turnChanged) {
        $('turnName').textContent = this.players[this.activePlayer].name;
        $('turnBanner').classList.remove('hidden');
      }
      this._updateHud();
    }

    _finishGame() {
      this.state = 'results';
      this.phase = 'idle';
      this.pitch = null;
      this.flight = null;
      $('swingBtn').classList.add('hidden');
      $('gameHud').classList.add('hidden');
      $('gameTools').classList.add('hidden');
      $('pitchReadout').classList.add('hidden');
      $('turnBanner').classList.add('hidden');
      document.body.classList.remove('playing');

      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      const topScore = sorted[0]?.score || 0;
      const previousBest = Number(localStorage.getItem(this._recordKey()) || 0);
      if (topScore > previousBest) localStorage.setItem(this._recordKey(), String(topScore));
      this._updateBestRecord();

      $('resultsTitle').textContent = this.playerCount > 1
        ? `${sorted[0].name} Wins!`
        : (sorted[0].homeRuns > 0 ? 'Fence Cleared!' : 'Strong Showing!');
      $('resultsList').innerHTML = sorted.map((player, index) => `
        <div class="result-row">
          <span class="result-rank">${index + 1}</span>
          <span>
            <span class="result-name">${this._escapeHtml(player.name)}</span>
            <span class="result-detail">${player.hits} hits · ${player.homeRuns} HR · ${player.smartTakes} smart takes · ${player.bestDistance} ft</span>
          </span>
          <strong class="result-score">${player.score.toLocaleString()}</strong>
        </div>
      `).join('');
      $('resultsOverlay').classList.remove('hidden');
      this._refreshIcons();
      this.sfx.play('win');
    }

    _escapeHtml(value) {
      const div = document.createElement('div');
      div.textContent = value;
      return div.innerHTML;
    }

    _showReadout(type, result, tone = '') {
      $('pitchType').textContent = type;
      $('timingValue').textContent = result;
      $('pitchReadout').className = `pitch-readout ${tone}`.trim();
      $('pitchReadout').classList.remove('hidden');
    }

    _updateHud() {
      const player = this.players[this.activePlayer];
      if (!player) return;
      $('activePlayer').textContent = player.name;
      $('scoreValue').textContent = player.score.toLocaleString();
      $('eventValue').textContent = EVENT_CONFIG[this.event].label;
      $('streakValue').textContent = player.streak;
      $('distanceValue').textContent = `${player.bestDistance} FT`;
      if (this.event === 'derby') {
        $('remainingValue').textContent = `${Math.max(0, EVENT_CONFIG.derby.outs - player.outs)} OUTS`;
      } else {
        $('remainingValue').textContent = `${Math.max(0, EVENT_CONFIG[this.event].limit - player.pitches)} PITCHES`;
      }
    }

    _pause() {
      if (this.state !== 'playing' || this.paused || this.phase === 'countdown') return;
      this.paused = true;
      $('pauseOverlay').classList.remove('hidden');
      this._refreshIcons();
    }

    _resume() {
      if (!this.paused) return;
      this.paused = false;
      $('pauseOverlay').classList.add('hidden');
      this.lastTime = performance.now();
    }

    _showSetup() {
      this.sessionToken += 1;
      this.state = 'setup';
      this.phase = 'idle';
      this.paused = false;
      this.pitch = null;
      this.flight = null;
      document.body.classList.remove('playing');
      $('gameSetup').classList.remove('hidden');
      $('pauseOverlay').classList.add('hidden');
      $('resultsOverlay').classList.add('hidden');
      $('gameHud').classList.add('hidden');
      $('gameTools').classList.add('hidden');
      $('swingBtn').classList.add('hidden');
      $('pitchReadout').classList.add('hidden');
      $('turnBanner').classList.add('hidden');
      $('countdown').classList.add('hidden');
      this._refreshSetup();
    }

    _toggleSound() {
      this.sfx.enabled = !this.sfx.enabled;
      const button = $('soundBtn');
      button.innerHTML = `<i data-lucide="${this.sfx.enabled ? 'volume-2' : 'volume-x'}"></i>`;
      button.setAttribute('aria-label', this.sfx.enabled ? 'Mute sound' : 'Enable sound');
      button.title = this.sfx.enabled ? 'Mute Sound' : 'Enable Sound';
      if (this.sfx.enabled) this.sfx.play('ball');
      this._refreshIcons();
    }

    async _toggleFullscreen() {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) {
        console.warn('Fullscreen is unavailable:', error);
      }
    }

    _syncFullscreen() {
      const active = Boolean(document.fullscreenElement);
      const button = $('fullscreenBtn');
      button.innerHTML = `<i data-lucide="${active ? 'minimize' : 'maximize'}"></i>`;
      button.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
      button.title = active ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
      this._refreshIcons();
      this._resize();
    }

    _refreshIcons() {
      if (window.lucide) window.lucide.createIcons();
    }

    _resize() {
      this.W = window.innerWidth;
      this.H = window.innerHeight;
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.canvas.style.width = `${this.W}px`;
      this.canvas.style.height = `${this.H}px`;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    _layout() {
      const portrait = this.H > this.W;
      const zoneWidth = portrait ? Math.min(160, this.W * 0.38) : Math.min(180, this.W * 0.18);
      const zoneHeight = portrait ? Math.min(145, this.H * 0.18) : Math.min(150, this.H * 0.25);
      const zoneTop = portrait ? this.H * 0.54 : this.H * 0.57;
      return {
        portrait,
        pitcher: { x: this.W * 0.5, y: portrait ? this.H * 0.39 : this.H * 0.42 },
        zone: {
          x: this.W * 0.5 - zoneWidth / 2,
          y: zoneTop,
          width: zoneWidth,
          height: zoneHeight,
        },
      };
    }

    _update(dt) {
      if (this.state !== 'playing' || this.paused || this.phase === 'countdown') return;
      this.time += dt;
      this.phaseTime += dt;
      this.swingTime = Math.max(0, this.swingTime - dt);
      if (this.swingTime === 0) $('swingBtn').classList.remove('pressed');
      this.shake = Math.max(0, this.shake - dt * 28);
      this.flash = Math.max(0, this.flash - dt);

      for (const particle of this.particles) {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 120 * dt;
      }
      this.particles = this.particles.filter(particle => particle.life > 0);

      if (this.phase === 'windup') {
        this.pitch.windup = clamp(this.phaseTime / this.pitch.windupDuration, 0, 1);
        if (this.phaseTime >= this.pitch.windupDuration) {
          this.phase = 'pitching';
          this.phaseTime = 0;
          this.sfx.play('pitch');
        }
      } else if (this.phase === 'pitching') {
        this.pitch.progress = clamp(this.phaseTime / this.pitch.duration, 0, 1);
        const position = this._pitchPosition(this.pitch.progress);
        this.pitch.trail.push(position);
        if (this.pitch.trail.length > 8) this.pitch.trail.shift();
        if (this.pitch.progress >= 1) this._resolveTake();
      } else if (this.phase === 'flight') {
        this.flight.progress = clamp(this.phaseTime / this.flight.duration, 0, 1);
        if (this.flight.progress >= 1) this._finishFlight();
      } else if (this.phase === 'result' && this.phaseTime >= this.resultDelay) {
        this._advanceTurn();
      } else if (this.phase === 'between' && this.phaseTime >= (this.turnChanged ? 0.8 : 0.42)) {
        $('turnBanner').classList.add('hidden');
        this._beginPitch();
      }
    }

    _pitchPosition(progress) {
      const layout = this._layout();
      const zone = layout.zone;
      const targetX = zone.x + this.pitch.location.x * zone.width;
      const targetY = zone.y + this.pitch.location.y * zone.height;
      let x = lerp(layout.pitcher.x, targetX, progress);
      let y = lerp(layout.pitcher.y, targetY, progress) - Math.sin(progress * Math.PI) * this.H * 0.035;
      if (this.pitch.type === 'curveball') x += Math.sin(progress * Math.PI) * this.pitch.curve * this.W;
      if (this.pitch.type === 'sinker') y += Math.pow(progress, 4) * this.H * 0.045;
      if (this.pitch.type === 'changeup') y -= Math.sin(progress * Math.PI) * this.H * 0.018;
      return { x, y, radius: 3 + Math.pow(progress, 2.3) * Math.min(17, this.W * 0.032) };
    }

    _spawnContactBurst(quality, foul) {
      const layout = this._layout();
      const x = layout.zone.x + layout.zone.width * 0.5;
      const y = layout.zone.y + layout.zone.height * 0.68;
      const count = 10 + Math.round(quality * 18);
      for (let i = 0; i < count; i++) {
        const angle = random(0, Math.PI * 2);
        const speed = random(40, 180 + quality * 170);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: random(0.25, 0.65),
          maxLife: 0.65,
          color: foul ? '#f3c552' : (quality > 0.75 ? '#fff4bd' : '#d9e5d8'),
          size: random(2, 5),
        });
      }
    }

    _loop(timestamp) {
      const dt = clamp((timestamp - (this.lastTime || timestamp)) / 1000, 0, 0.05);
      this.lastTime = timestamp;
      this._update(dt);
      this._draw();
      requestAnimationFrame(time => this._loop(time));
    }

    _draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.save();
      if (this.shake > 0) ctx.translate(random(-this.shake, this.shake), random(-this.shake * 0.5, this.shake * 0.5));
      this._drawBackground(ctx);
      if (this.event === 'targets' && this.state === 'playing') this._drawTargets(ctx);
      this._drawPitcher(ctx);
      this._drawStrikeZone(ctx);
      this._drawBatter(ctx);
      if (this.phase === 'pitching' && this.pitch) this._drawPitch(ctx);
      if (this.phase === 'flight' && this.flight) this._drawFlight(ctx);
      this._drawParticles(ctx);
      ctx.restore();
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255, 246, 190, ${this.flash * 1.7})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
    }

    _drawBackground(ctx) {
      if (this.background.complete && this.background.naturalWidth) {
        const scale = Math.max(this.W / this.background.naturalWidth, this.H / this.background.naturalHeight);
        const width = this.background.naturalWidth * scale;
        const height = this.background.naturalHeight * scale;
        ctx.drawImage(this.background, (this.W - width) / 2, (this.H - height) / 2, width, height);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, this.H);
        gradient.addColorStop(0, '#62b9e8');
        gradient.addColorStop(0.55, '#9fd7e9');
        gradient.addColorStop(0.56, '#4c9c45');
        gradient.addColorStop(1, '#ad582e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      ctx.fillStyle = this.state === 'setup' ? 'rgba(8, 16, 9, 0.05)' : 'rgba(6, 15, 8, 0.08)';
      ctx.fillRect(0, 0, this.W, this.H);
    }

    _drawStrikeZone(ctx) {
      if (this.state !== 'playing') return;
      const { zone } = this._layout();
      const opacity = this.difficulty === 'rookie' ? 0.58 : (this.difficulty === 'allstar' ? 0.4 : 0.26);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.45})`;
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(zone.x + zone.width * i / 3, zone.y);
        ctx.lineTo(zone.x + zone.width * i / 3, zone.y + zone.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(zone.x, zone.y + zone.height * i / 3);
        ctx.lineTo(zone.x + zone.width, zone.y + zone.height * i / 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawPitcher(ctx) {
      const layout = this._layout();
      const windup = this.pitch?.windup || (Math.sin(this.time * 1.4) * 0.04 + 0.04);
      const scale = clamp(this.H / 720, 0.48, 0.9);
      ctx.save();
      ctx.translate(layout.pitcher.x, layout.pitcher.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, 43, 28, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a3f2b';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7, 25);
      ctx.lineTo(-11 - windup * 12, 43);
      ctx.moveTo(7, 25);
      ctx.lineTo(11 + windup * 18, 43 - windup * 20);
      ctx.stroke();
      ctx.fillStyle = '#f7f0dc';
      ctx.fillRect(-14, -5, 28, 34);
      ctx.fillStyle = '#d94837';
      ctx.fillRect(-14, 8, 28, 8);
      ctx.fillStyle = '#9b6544';
      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#17331e';
      ctx.beginPath();
      ctx.arc(0, -19, 12, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f7f0dc';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-10, 2);
      ctx.lineTo(-20 + windup * 8, 10 - windup * 18);
      ctx.moveTo(10, 2);
      ctx.lineTo(21 - windup * 10, 9 - windup * 20);
      ctx.stroke();
      ctx.fillStyle = '#6f4028';
      ctx.beginPath();
      ctx.arc(-20 + windup * 8, 10 - windup * 18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawBatter(ctx) {
      const { zone, portrait } = this._layout();
      const scale = clamp(this.H / 650, 0.62, 1.08);
      const x = zone.x - (portrait ? 20 : 42 * scale);
      const y = zone.y + zone.height + 28 * scale;
      const swingProgress = this.swingTime > 0 ? clamp(1 - this.swingTime / 0.42, 0, 1) : 0;
      const swingCurve = swingProgress < 0.65
        ? easeOut(swingProgress / 0.65)
        : 1 - (swingProgress - 0.65) / 0.35 * 0.25;
      const batAngle = -1.25 + swingCurve * 2.35;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 45, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#233426';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, -38);
      ctx.lineTo(-19, 3);
      ctx.moveTo(9, -38);
      ctx.lineTo(21, 3);
      ctx.stroke();
      ctx.fillStyle = '#d94837';
      ctx.beginPath();
      ctx.roundRect(-23, -94, 46, 62, 10);
      ctx.fill();
      ctx.fillStyle = '#fff3db';
      ctx.fillRect(-23, -57, 46, 10);
      ctx.fillStyle = '#a86d47';
      ctx.beginPath();
      ctx.arc(0, -110, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#18341f';
      ctx.beginPath();
      ctx.arc(0, -116, 19, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-19, -116, 38, 7);
      ctx.strokeStyle = '#d99a6c';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-15, -83);
      ctx.lineTo(10, -76);
      ctx.lineTo(22, -94);
      ctx.moveTo(15, -82);
      ctx.lineTo(25, -72);
      ctx.lineTo(22, -94);
      ctx.stroke();
      ctx.translate(22, -94);
      ctx.rotate(batAngle);
      ctx.strokeStyle = '#dfad62';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -88);
      ctx.stroke();
      ctx.strokeStyle = '#70462b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -19);
      ctx.stroke();
      ctx.restore();
    }

    _drawPitch(ctx) {
      const position = this._pitchPosition(this.pitch.progress);
      this.pitch.trail.forEach((point, index) => {
        const alpha = (index + 1) / this.pitch.trail.length * 0.2;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
      this._drawBall(ctx, position.x, position.y, position.radius, this.pitch.progress * 7);
    }

    _drawBall(ctx, x, y, radius, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = '#fffdf4';
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = radius * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#d94837';
      ctx.lineWidth = Math.max(1, radius * 0.12);
      ctx.beginPath();
      ctx.arc(-radius * 0.52, 0, radius * 0.73, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(radius * 0.52, 0, radius * 0.73, 2.04, 4.24);
      ctx.stroke();
      ctx.restore();
    }

    _flightPosition(progress) {
      const { zone } = this._layout();
      const startX = zone.x + zone.width * 0.5;
      const startY = zone.y + zone.height * 0.68;
      const destinationX = this.W * (0.5 + this.flight.direction * 0.62);
      const destinationY = this._distanceY(this.flight.distance);
      const controlX = lerp(startX, destinationX, 0.48);
      const controlY = this.flight.grounder
        ? lerp(startY, destinationY, 0.55) + this.H * 0.08
        : Math.min(this.H * 0.14, destinationY - this.H * (0.1 + this.flight.quality * 0.12));
      const t = easeOut(progress);
      const inv = 1 - t;
      return {
        x: inv * inv * startX + 2 * inv * t * controlX + t * t * destinationX,
        y: inv * inv * startY + 2 * inv * t * controlY + t * t * destinationY,
        radius: lerp(Math.min(18, this.W * 0.032), 3.5, t),
      };
    }

    _distanceY(distance) {
      return this.H * (0.59 - clamp((distance - 110) / 330, 0, 1) * 0.31);
    }

    _drawFlight(ctx) {
      const position = this._flightPosition(this.flight.progress);
      const previous = this._flightPosition(Math.max(0, this.flight.progress - 0.055));
      ctx.save();
      ctx.strokeStyle = this.flight.foul ? 'rgba(243,197,82,0.65)' : 'rgba(255,255,255,0.72)';
      ctx.lineWidth = Math.max(2, position.radius * 0.5);
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(position.x, position.y);
      ctx.stroke();
      ctx.restore();
      this._drawBall(ctx, position.x, position.y, position.radius, this.flight.progress * 12);
    }

    _drawTargets(ctx) {
      FIELD_TARGETS.forEach((target, index) => {
        const pulse = 1 + Math.sin(this.time * 3 + index) * 0.08;
        const x = this.W * target.x;
        const y = this._distanceY(target.distance);
        const radius = clamp(this.W * 0.035, 22, 42) * pulse;
        ctx.save();
        ctx.strokeStyle = target.color;
        ctx.fillStyle = 'rgba(8, 18, 10, 0.58)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '800 10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(target.label, x, y + 3);
        ctx.fillStyle = target.color;
        ctx.font = '900 9px Outfit, sans-serif';
        ctx.fillText(`${target.points}`, x, y + radius + 14);
        ctx.restore();
      });
    }

    _drawParticles(ctx) {
      for (const particle of this.particles) {
        ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;
    }
  }

  new FenceBusters();
})();
