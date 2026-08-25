(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const easeOut = value => 1 - Math.pow(1 - value, 3);
  const random = (min, max) => min + Math.random() * (max - min);

  const EVENT_CONFIG = {
    discipline: {
      label: 'Batting Challenge',
      limit: 20,
      record: 'High score',
      missionTitle: 'Complete the scorecard',
      gradeScores: [8500, 6000, 3600, 1800],
      goals: [
        { label: '8 solid hits', icon: 'circle-dot', test: player => player.hits >= 8 },
        { label: '3 smart takes', icon: 'eye', test: player => player.smartTakes >= 3 },
        { label: '2 perfect swings', icon: 'sparkles', test: player => player.perfects >= 2 },
      ],
    },
    derby: {
      label: 'Home Run Derby',
      outs: 10,
      pitchCap: 30,
      record: 'High score',
      missionTitle: 'Put on a power show',
      gradeScores: [11000, 7500, 4300, 2200],
      goals: [
        { label: '3 home runs', icon: 'flame', test: player => player.homeRuns >= 3 },
        { label: '400 ft blast', icon: 'ruler', test: player => player.bestDistance >= 400 },
        { label: '5-play streak', icon: 'zap', test: player => player.maxStreak >= 5 },
      ],
    },
    targets: {
      label: 'Target Field',
      limit: 15,
      record: 'High score',
      missionTitle: 'Own the whole outfield',
      gradeScores: [11500, 8000, 4700, 2400],
      goals: [
        { label: 'Hit 2 targets', icon: 'crosshair', test: player => player.targetsHit >= 2 },
        { label: 'Find center gate', icon: 'goal', test: player => player.targetIds.has('gate') },
        { label: '7 solid hits', icon: 'circle-dot', test: player => player.hits >= 7 },
      ],
    },
  };

  const DIFFICULTY_CONFIG = {
    rookie: {
      duration: 1.16,
      contactWindow: 0.16,
      strikeChance: 0.78,
      types: ['fastball', 'changeup'],
      windup: [0.72, 1.02],
      note: 'Slower fastballs and changeups with a wide contact window',
    },
    allstar: {
      duration: 0.9,
      contactWindow: 0.12,
      strikeChance: 0.72,
      types: ['fastball', 'fastball', 'changeup', 'curveball', 'sinker', 'slider'],
      windup: [0.55, 1.04],
      note: 'Five pitch types, changing speeds, and varied deliveries',
    },
    legend: {
      duration: 0.7,
      contactWindow: 0.09,
      strikeChance: 0.68,
      types: ['fastball', 'fastball', 'changeup', 'curveball', 'sinker', 'slider', 'knuckleball'],
      windup: [0.44, 1.08],
      note: 'Six pitch types, deceptive timing, and a narrow contact window',
    },
  };

  const PITCH_NAMES = {
    fastball: 'FASTBALL',
    changeup: 'CHANGEUP',
    curveball: 'CURVEBALL',
    sinker: 'SINKER',
    slider: 'SLIDER',
    knuckleball: 'KNUCKLEBALL',
  };

  const PITCH_PROFILES = {
    fastball: { duration: 0.9, mph: [89, 98], spin: 13, trail: '#fffdf4' },
    changeup: { duration: 1.2, mph: [70, 79], spin: 7, trail: '#f7e7a8' },
    curveball: { duration: 1.06, mph: [73, 83], spin: 15, trail: '#9fd8ff' },
    sinker: { duration: 0.98, mph: [84, 93], spin: 12, trail: '#c4f0bc' },
    slider: { duration: 0.96, mph: [81, 90], spin: 18, trail: '#efc2ff' },
    knuckleball: { duration: 1.28, mph: [63, 72], spin: 2.5, trail: '#ffd7ac' },
  };

  const UNIFORMS = [
    { jersey: '#d94837', stripe: '#fff3db', cap: '#18341f' },
    { jersey: '#2d83b7', stripe: '#e9f7ff', cap: '#163b5a' },
  ];

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
      if (name === 'streak') {
        [390, 520, 650].forEach((frequency, index) => {
          window.setTimeout(() => this.tone(frequency, 0.15, 'triangle', 0.055, 55), index * 55);
        });
      }
      if (name === 'fire') {
        this.noise(0.32, 0.045, 700);
        [440, 587, 784, 988].forEach((frequency, index) => {
          window.setTimeout(() => this.tone(frequency, 0.28, 'sawtooth', 0.035, 80), index * 58);
        });
      }
      if (name === 'landing') {
        this.tone(72, 0.22, 'sine', 0.09, -24);
        this.noise(0.15, 0.055, 120);
      }
      if (name === 'cheer' || name === 'win') {
        this.noise(name === 'win' ? 1.1 : 0.9, 0.075, 260);
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
      this.impactFreeze = 0;
      this.cameraPush = 0;
      this.crowdEnergy = 0;
      this.bigPlayTimer = 0;
      this.milestoneTimer = 0;
      this.landingMarks = [];

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
      const event = EVENT_CONFIG[this.event];
      $('missionTitle').textContent = event.missionTitle;
      $('missionGoals').innerHTML = event.goals.map(goal => `
        <span class="mission-goal"><i data-lucide="${goal.icon}"></i>${goal.label}</span>
      `).join('');
      this._updateBestRecord();
      this._refreshIcons();
    }

    _recordKey() {
      return `fence-busters-v2-${this.event}-${this.difficulty}-${this.playerCount}`;
    }

    _updateBestRecord() {
      const best = Number(localStorage.getItem(this._recordKey()) || 0);
      let career = {};
      try {
        career = JSON.parse(localStorage.getItem('fence-busters-career-v1') || '{}');
      } catch (error) {
        career = {};
      }
      const careerNote = career.games ? ` · Career ${career.homeRuns || 0} HR / ${career.bestDistance || 0} FT` : '';
      $('bestRecord').textContent = `${EVENT_CONFIG[this.event].record}: ${best.toLocaleString()}${careerNote}`;
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
        maxStreak: 0,
        bestDistance: 0,
        heat: 0,
        swings: 0,
        targetsHit: 0,
        targetIds: new Set(),
        totalExitVelocity: 0,
        maxExitVelocity: 0,
        hardHits: 0,
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
      this.impactFreeze = 0;
      this.cameraPush = 0;
      this.crowdEnergy = 0;
      this.bigPlayTimer = 0;
      this.milestoneTimer = 0;
      this.landingMarks = [];
      document.body.classList.add('playing');
      $('gameSetup').classList.add('hidden');
      $('resultsOverlay').classList.add('hidden');
      $('pauseOverlay').classList.add('hidden');
      $('gameHud').classList.remove('hidden');
      $('gameTools').classList.remove('hidden');
      $('swingBtn').classList.remove('hidden');
      $('pitchReadout').classList.add('hidden');
      $('turnBanner').classList.add('hidden');
      $('milestoneToast').classList.add('hidden');
      $('bigPlay').classList.add('hidden');
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
      const profile = PITCH_PROFILES[type];
      const player = this.players[this.activePlayer];
      const isStrike = Math.random() < difficulty.strikeChance;
      const location = this._makePitchLocation(isStrike);
      const pressureRamp = Math.min(0.075, player.pitches * 0.0035);
      const duration = difficulty.duration * profile.duration * (1 - pressureRamp);
      const breakDirection = ['curveball', 'slider'].includes(type) ? (Math.random() < 0.5 ? -1 : 1) : 0;
      const velocity = Math.round(random(profile.mph[0], profile.mph[1]) + pressureRamp * 55);

      this.pitch = {
        type,
        isStrike,
        location,
        duration,
        velocity,
        curve: breakDirection * random(type === 'slider' ? 0.08 : 0.12, type === 'slider' ? 0.14 : 0.2),
        knuckleSeed: random(0, Math.PI * 2),
        progress: 0,
        windup: 0,
        windupDuration: random(difficulty.windup[0], difficulty.windup[1]),
        resolved: false,
        trail: [],
      };
      this.flight = null;
      this.phase = 'windup';
      this.phaseTime = 0;
      this.swingTime = 0;
      this.cameraPush = 0;
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
      const player = this.players[this.activePlayer];
      player.swings += 1;

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
      const exitVelocity = Math.round(53 + adjustedQuality * 58 + random(-3, 4));
      const launchAngle = grounder
        ? Math.round(random(-5, 8))
        : Math.round((foul ? random(38, 58) : 13 + adjustedQuality * 24));
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
        duration: grounder ? 0.78 : (homeRun ? 1.36 : 1.16),
        direction,
        distance,
        quality: adjustedQuality,
        foul,
        grounder,
        homeRun,
        target,
        timing,
        pitchType: this.pitch.type,
        velocity: this.pitch.velocity,
        exitVelocity,
        launchAngle,
        timingError,
        recorded: false,
        celebrationStarted: false,
      };
      this.phase = 'flight';
      this.sfx.play(foul ? 'foul' : 'crack');
      this.shake = homeRun ? 12 : (adjustedQuality > 0.75 ? 7 : 3);
      this.impactFreeze = adjustedQuality > 0.78 ? 0.055 : 0.025;
      this.cameraPush = adjustedQuality * (homeRun ? 0.065 : 0.035);
      this.flash = adjustedQuality > 0.8 ? 0.18 : 0.08;
      this._spawnContactBurst(adjustedQuality, foul);
      this._showReadout(PITCH_NAMES[this.pitch.type], timing, adjustedQuality > 0.55 ? 'positive' : '', {
        speed: this.pitch.velocity,
        exitVelocity,
        timingError,
      });
    }

    _resolveMiss(timing) {
      const player = this.players[this.activePlayer];
      player.chases += this.pitch && !this.pitch.isStrike ? 1 : 0;
      player.streak = 0;
      this._breakMomentum(player, 42);
      if (this.event === 'derby') player.outs += 1;
      this.sfx.play('miss');
      this._showReadout(this.pitch ? PITCH_NAMES[this.pitch.type] : 'PITCH', timing, 'negative', {
        speed: this.pitch?.velocity,
        timingError: timing.includes('EARLY') ? -1 : 1,
      });
      this._recordResolvedPitch({ positive: false, label: timing });
    }

    _resolveTake() {
      if (!this.pitch || this.pitch.resolved) return;
      this.pitch.resolved = true;
      const player = this.players[this.activePlayer];
      if (this.pitch.isStrike) {
        player.streak = 0;
        this._breakMomentum(player, 32);
        if (this.event === 'derby') player.outs += 1;
        this.sfx.play('called');
        this._showReadout(PITCH_NAMES[this.pitch.type], 'CALLED STRIKE', 'negative', { speed: this.pitch.velocity });
        this._recordResolvedPitch({ positive: false, label: 'Called strike' });
      } else {
        const points = this.event === 'discipline' ? 150 + player.streak * 25 : 50;
        player.smartTakes += 1;
        player.streak += 1;
        this._gainMomentum(player, 18);
        player.score += points;
        this.sfx.play('ball');
        this._showReadout(PITCH_NAMES[this.pitch.type], `GOOD TAKE +${points}`, 'positive', { speed: this.pitch.velocity });
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
        this._breakMomentum(player, 24);
        label = 'FOUL BALL';
        if (this.event === 'derby') player.outs += 1;
      } else {
        player.hits += 1;
        player.streak += 1;
        player.maxStreak = Math.max(player.maxStreak, player.streak);
        player.bestDistance = Math.max(player.bestDistance, hit.distance);
        player.totalExitVelocity += hit.exitVelocity;
        player.maxExitVelocity = Math.max(player.maxExitVelocity, hit.exitVelocity);
        if (hit.exitVelocity >= 95) player.hardHits += 1;
        if (hit.timing === 'PERFECT') player.perfects += 1;
        if (hit.homeRun) {
          player.homeRuns += 1;
          points = 1000 + hit.distance + player.streak * 75;
          label = `HOME RUN · ${hit.distance} FT`;
          this._gainMomentum(player, 34);
          this._showBigPlay('BACKYARD BLAST', 'HOME RUN!', `${hit.distance} FT · ${hit.exitVelocity} MPH EXIT`);
          this.sfx.play('cheer');
        } else if (hit.grounder) {
          points = 120 + Math.round(hit.quality * 180);
          label = `GROUNDER · ${hit.distance} FT`;
          this._gainMomentum(player, 10);
          if (this.event === 'derby') player.outs += 1;
        } else {
          points = 280 + hit.distance + Math.round(hit.quality * 220);
          label = `DRIVE · ${hit.distance} FT`;
          this._gainMomentum(player, 20);
          if (this.event === 'derby') player.outs += 1;
        }

        if (hit.target) {
          player.targetsHit += 1;
          player.targetIds.add(hit.target.id);
          points += hit.target.points;
          label = `${hit.target.label} HIT · +${hit.target.points}`;
          this._gainMomentum(player, 22);
          this._showBigPlay('TARGET SMASHED', hit.target.label, `BONUS +${hit.target.points.toLocaleString()}`);
          this.sfx.play('target');
        }
      }

      const streakMultiplier = 1 + Math.min(1.5, Math.max(0, player.streak - 1) * 0.15);
      const heatMultiplier = player.heat >= 60 ? 1.25 + (player.heat - 60) / 160 : 1;
      points = Math.round(points * streakMultiplier * heatMultiplier);
      player.score += points;
      const landing = this._flightPosition(1);
      this.landingMarks.push({
        x: landing.x / this.W,
        y: landing.y / this.H,
        homeRun: hit.homeRun,
        color: hit.target?.color || (hit.foul ? '#f3c552' : '#fff3c5'),
      });
      if (this.landingMarks.length > 6) this.landingMarks.shift();
      this.sfx.play('landing');
      this._showReadout(PITCH_NAMES[hit.pitchType], `${label} · +${points}`, hit.foul ? 'negative' : 'positive', {
        speed: hit.velocity,
        exitVelocity: hit.exitVelocity,
        timingError: hit.timingError,
      });
      this._recordResolvedPitch({ positive: !hit.foul, label });
    }

    _gainMomentum(player, amount) {
      const previous = player.heat;
      player.heat = clamp(player.heat + amount, 0, 100);
      player.maxStreak = Math.max(player.maxStreak, player.streak);
      if (player.streak === 3) {
        this._showMilestone('MOMENTUM', '3-PLAY STREAK');
        this.sfx.play('streak');
      }
      if (previous < 60 && player.heat >= 60) {
        this._showMilestone('POWER BONUS ACTIVE', 'HOT BAT');
        this.sfx.play('fire');
      } else if (previous < 100 && player.heat === 100) {
        this._showMilestone('MAXIMUM POWER', 'BAT ON FIRE');
        this.sfx.play('fire');
      }
    }

    _breakMomentum(player, amount) {
      player.heat = clamp(player.heat - amount, 0, 100);
    }

    _showMilestone(kicker, text) {
      $('milestoneKicker').textContent = kicker;
      $('milestoneText').textContent = text;
      $('milestoneToast').classList.remove('hidden');
      this.milestoneTimer = 1.55;
    }

    _showBigPlay(kicker, text, detail) {
      $('bigPlayKicker').textContent = kicker;
      $('bigPlayText').textContent = text;
      $('bigPlayDetail').textContent = detail;
      $('bigPlay').classList.remove('hidden');
      this.bigPlayTimer = 1.8;
    }

    _recordResolvedPitch() {
      const player = this.players[this.activePlayer];
      player.pitches += 1;
      this.phase = 'result';
      this.phaseTime = 0;
      this.resultDelay = this.bigPlayTimer > 0 ? 1.75 : (this.flight ? 1.18 : 0.92);
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
      const leader = sorted[0];
      const previousBest = Number(localStorage.getItem(this._recordKey()) || 0);
      if (topScore > previousBest) localStorage.setItem(this._recordKey(), String(topScore));
      this._updateBestRecord();
      this._saveCareer(leader);

      const performance = this._performanceFor(leader);
      $('performanceGrade').textContent = performance.grade;
      $('performanceTitle').textContent = performance.title;
      $('performanceDetail').textContent = performance.detail;

      const soloTitles = {
        S: 'Backyard Legend!',
        A: 'Fence Cleared!',
        B: 'Good Wood!',
        C: 'Round Complete!',
        D: 'Keep Swinging!',
      };
      $('resultsTitle').textContent = this.playerCount > 1 ? `${sorted[0].name} Wins!` : soloTitles[performance.grade];
      $('resultsList').innerHTML = sorted.map((player, index) => `
        <div class="result-row">
          <span class="result-rank">${index + 1}</span>
          <span>
            <span class="result-name">${this._escapeHtml(player.name)}</span>
            <span class="result-detail">${player.hits} hits · ${player.homeRuns} HR · ${player.smartTakes} smart takes · ${player.maxStreak} best streak · ${player.maxExitVelocity ? `${player.maxExitVelocity} mph exit` : 'no contact'}</span>
          </span>
          <strong class="result-score">${player.score.toLocaleString()}</strong>
        </div>
      `).join('');
      $('resultsGoals').innerHTML = EVENT_CONFIG[this.event].goals.map(goal => {
        const complete = goal.test(leader);
        return `<span class="result-goal ${complete ? 'complete' : ''}"><i data-lucide="${complete ? 'circle-check' : 'circle'}"></i>${goal.label}</span>`;
      }).join('');
      $('resultsOverlay').classList.remove('hidden');
      this._refreshIcons();
      this.sfx.play('win');
    }

    _performanceFor(player) {
      const config = EVENT_CONFIG[this.event];
      const difficultyScale = this.difficulty === 'rookie' ? 1.08 : (this.difficulty === 'legend' ? 0.84 : 1);
      const gradeScore = player.score / difficultyScale;
      const completed = config.goals.filter(goal => goal.test(player)).length;
      const boostedScore = gradeScore + completed * 450;
      const grade = boostedScore >= config.gradeScores[0]
        ? 'S'
        : (boostedScore >= config.gradeScores[1] ? 'A' : (boostedScore >= config.gradeScores[2] ? 'B' : (boostedScore >= config.gradeScores[3] ? 'C' : 'D')));
      const titles = {
        S: 'Backyard Legend',
        A: 'All-Star Performance',
        B: 'Line-Drive Regular',
        C: 'Solid Day at the Plate',
        D: 'Keep Digging In',
      };
      const contactRate = player.swings ? Math.round(player.hits / player.swings * 100) : 0;
      const detail = `${completed}/3 goals · ${contactRate}% contact · ${player.hardHits} hard-hit ball${player.hardHits === 1 ? '' : 's'}`;
      return { grade, title: titles[grade], detail };
    }

    _saveCareer(player) {
      const key = 'fence-busters-career-v1';
      let career = { games: 0, homeRuns: 0, targets: 0, bestDistance: 0, highScore: 0 };
      try {
        career = { ...career, ...JSON.parse(localStorage.getItem(key) || '{}') };
      } catch (error) {
        console.warn('Unable to read Fence Busters career record:', error);
      }
      career.games += 1;
      career.homeRuns += player.homeRuns;
      career.targets += player.targetsHit;
      career.bestDistance = Math.max(career.bestDistance, player.bestDistance);
      career.highScore = Math.max(career.highScore, player.score);
      localStorage.setItem(key, JSON.stringify(career));
    }

    _escapeHtml(value) {
      const div = document.createElement('div');
      div.textContent = value;
      return div.innerHTML;
    }

    _showReadout(type, result, tone = '', details = {}) {
      $('pitchType').textContent = type;
      $('timingValue').textContent = result;
      const meta = [];
      if (details.speed) meta.push(`${details.speed} MPH`);
      if (details.exitVelocity) meta.push(`${details.exitVelocity} MPH EXIT`);
      $('pitchMeta').textContent = meta.join(' · ');
      const hasTiming = Number.isFinite(details.timingError);
      $('timingGauge').classList.toggle('hidden', !hasTiming);
      if (hasTiming) {
        const windowSize = DIFFICULTY_CONFIG[this.difficulty].contactWindow;
        const normalized = clamp(details.timingError / Math.max(windowSize, 0.01), -1.25, 1.25);
        $('timingMarker').style.left = `${50 + normalized * 38}%`;
      }
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
      $('heatValue').textContent = player.heat >= 60 ? `${(1.25 + (player.heat - 60) / 160).toFixed(2)}x` : `${player.heat}%`;
      $('heatFill').style.width = `${player.heat}%`;
      $('heatHud').classList.toggle('on-fire', player.heat >= 60);
      $('swingBtn').classList.toggle('on-fire', player.heat >= 60);
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
      $('milestoneToast').classList.add('hidden');
      $('bigPlay').classList.add('hidden');
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
      if (this.impactFreeze > 0) {
        this.impactFreeze = Math.max(0, this.impactFreeze - dt);
        return;
      }
      this.time += dt;
      this.phaseTime += dt;
      this.swingTime = Math.max(0, this.swingTime - dt);
      if (this.swingTime === 0) $('swingBtn').classList.remove('pressed');
      this.shake = Math.max(0, this.shake - dt * 28);
      this.flash = Math.max(0, this.flash - dt);
      this.crowdEnergy = Math.max(0, this.crowdEnergy - dt * 0.28);
      if (this.milestoneTimer > 0) {
        this.milestoneTimer = Math.max(0, this.milestoneTimer - dt);
        if (this.milestoneTimer === 0) $('milestoneToast').classList.add('hidden');
      }
      if (this.bigPlayTimer > 0) {
        this.bigPlayTimer = Math.max(0, this.bigPlayTimer - dt);
        if (this.bigPlayTimer === 0) $('bigPlay').classList.add('hidden');
      }

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
        if (!this.flight.celebrationStarted && this.flight.progress >= 0.66 && (this.flight.homeRun || this.flight.target)) {
          this.flight.celebrationStarted = true;
          this.crowdEnergy = 1;
          this._spawnFireworks(this.flight.target?.color || '#f3c552');
        }
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
      if (this.pitch.type === 'slider') {
        x += Math.sin(progress * Math.PI) * Math.pow(progress, 2.4) * this.pitch.curve * this.W * 1.65;
        y += Math.sin(progress * Math.PI) * Math.pow(progress, 2) * this.H * 0.014;
      }
      if (this.pitch.type === 'knuckleball') {
        const fade = Math.sin(progress * Math.PI);
        x += (Math.sin(progress * 14 + this.pitch.knuckleSeed) + Math.sin(progress * 25) * 0.45) * fade * this.W * 0.008;
        y += Math.sin(progress * 19 + this.pitch.knuckleSeed * 0.7) * fade * this.H * 0.007;
      }
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
          shape: 'chip',
          rotation: random(0, Math.PI),
        });
      }
    }

    _spawnFireworks(primaryColor) {
      const colors = [primaryColor, '#fff4bd', '#ef6a42', '#64b5dd', '#a6ef83'];
      const bursts = this.W < 620 ? 2 : 4;
      for (let burst = 0; burst < bursts; burst++) {
        const x = this.W * random(0.18, 0.82);
        const y = this.H * random(0.16, 0.36);
        const count = this.W < 620 ? 12 : 18;
        for (let i = 0; i < count; i++) {
          const angle = Math.PI * 2 * i / count + random(-0.08, 0.08);
          const speed = random(65, 155);
          this.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: random(0.65, 1.05),
            maxLife: 1.05,
            color: colors[(i + burst) % colors.length],
            size: random(2, 4),
            shape: 'spark',
            rotation: angle,
          });
        }
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
      const cameraZoom = this.phase === 'flight' && this.flight
        ? Math.sin(this.flight.progress * Math.PI) * this.cameraPush
        : 0;
      if (cameraZoom > 0) {
        ctx.translate(this.W / 2, this.H * 0.48);
        ctx.scale(1 + cameraZoom, 1 + cameraZoom);
        ctx.translate(-this.W / 2, -this.H * 0.48);
      }
      if (this.shake > 0) ctx.translate(random(-this.shake, this.shake), random(-this.shake * 0.5, this.shake * 0.5));
      this._drawBackground(ctx);
      this._drawStadiumLife(ctx);
      if (this.event === 'targets' && this.state === 'playing') this._drawTargets(ctx);
      this._drawLandingMarks(ctx);
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

    _drawStadiumLife(ctx) {
      if (this.state !== 'playing') return;
      ctx.save();
      for (let index = 0; index < 9; index++) {
        const drift = (this.time * (5 + index % 3) + index * 83) % (this.W + 80) - 40;
        const y = this.H * (0.31 + (index % 4) * 0.055) + Math.sin(this.time * 1.2 + index) * 5;
        ctx.globalAlpha = 0.16 + this.crowdEnergy * 0.18;
        ctx.fillStyle = index % 2 ? '#fff4bd' : '#d9f2d4';
        ctx.fillRect(drift, y, 2 + index % 2, 2);
      }

      const flagY = this.H * 0.285;
      for (let index = 0; index < 7; index++) {
        const x = this.W * (0.22 + index * 0.094);
        const wave = Math.sin(this.time * (2.2 + this.crowdEnergy * 2) + index) * 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, flagY);
        ctx.lineTo(x, flagY - 15);
        ctx.stroke();
        ctx.fillStyle = index % 2 ? '#f3c552' : '#d94837';
        ctx.beginPath();
        ctx.moveTo(x, flagY - 15);
        ctx.lineTo(x + 10 + wave, flagY - 11);
        ctx.lineTo(x, flagY - 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    _drawLandingMarks(ctx) {
      if (!this.landingMarks.length) return;
      ctx.save();
      this.landingMarks.forEach((mark, index) => {
        const x = mark.x * this.W;
        const y = mark.y * this.H;
        const pulse = index === this.landingMarks.length - 1 ? 1 + Math.sin(this.time * 5) * 0.12 : 1;
        ctx.globalAlpha = 0.34 + index / this.landingMarks.length * 0.32;
        ctx.strokeStyle = mark.color;
        ctx.lineWidth = mark.homeRun ? 3 : 2;
        ctx.beginPath();
        ctx.ellipse(x, y, (mark.homeRun ? 14 : 9) * pulse, (mark.homeRun ? 5 : 3) * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      });
      ctx.restore();
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
      if (this.phase === 'pitching' && this.pitch) {
        const timingPulse = clamp(1 - Math.abs(this.pitch.progress - 0.91) / 0.18, 0, 1);
        if (timingPulse > 0) {
          const bracket = 16;
          ctx.strokeStyle = `rgba(243, 197, 82, ${timingPulse * 0.78})`;
          ctx.lineWidth = 3;
          ctx.shadowColor = '#f3c552';
          ctx.shadowBlur = timingPulse * 13;
          [
            [zone.x, zone.y, 1, 1],
            [zone.x + zone.width, zone.y, -1, 1],
            [zone.x, zone.y + zone.height, 1, -1],
            [zone.x + zone.width, zone.y + zone.height, -1, -1],
          ].forEach(([x, y, dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(x + dx * bracket, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + dy * bracket);
            ctx.stroke();
          });
        }
      }
      ctx.restore();
    }

    _drawPitcher(ctx) {
      const layout = this._layout();
      const windup = this.phase === 'windup' ? (this.pitch?.windup || 0) : 0;
      const delivery = this.phase === 'pitching' ? easeOut(clamp(this.pitch.progress / 0.2, 0, 1)) : 0;
      const recovery = this.phase === 'pitching' ? clamp((this.pitch.progress - 0.18) / 0.45, 0, 1) : 0;
      const idle = Math.sin(this.time * 2.1) * 1.6;
      const legLift = Math.sin(windup * Math.PI) * 24;
      const stride = delivery * 22 - recovery * 7;
      const bodyLean = delivery * 0.16 - recovery * 0.06;
      const scale = clamp(this.H / 700, 0.5, 0.94);
      ctx.save();
      ctx.translate(layout.pitcher.x, layout.pitcher.y + idle * scale);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(stride * 0.35, 43, 31 + delivery * 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#f2ead7';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8 + stride * 0.15, 20);
      ctx.lineTo(-13 - stride * 0.28, 42);
      ctx.moveTo(8 + stride * 0.28, 20);
      ctx.lineTo(12 + stride + legLift * 0.35, 42 - legLift);
      ctx.stroke();

      ctx.strokeStyle = '#203d28';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-13 - stride * 0.28, 39);
      ctx.lineTo(-15 - stride * 0.32, 45);
      ctx.moveTo(12 + stride + legLift * 0.35, 39 - legLift);
      ctx.lineTo(16 + stride + legLift * 0.35, 44 - legLift);
      ctx.stroke();

      ctx.save();
      ctx.translate(stride * 0.22, -2);
      ctx.rotate(bodyLean);
      const jersey = ctx.createLinearGradient(-18, -6, 18, 25);
      jersey.addColorStop(0, '#fff8e7');
      jersey.addColorStop(1, '#ded6c4');
      ctx.fillStyle = jersey;
      ctx.beginPath();
      ctx.roundRect(-17, -9, 34, 38, 8);
      ctx.fill();
      ctx.fillStyle = '#d94837';
      ctx.fillRect(-17, 9, 34, 8);
      ctx.fillStyle = '#9e2d25';
      ctx.font = '900 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('7', 0, 7);

      ctx.fillStyle = '#9b6544';
      ctx.beginPath();
      ctx.arc(0, -20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#17331e';
      ctx.beginPath();
      ctx.arc(0, -25, 13, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-13, -25, 26, 5);
      ctx.fillRect(6, -22, 12, 3);

      const gloveX = lerp(-20 + windup * 18, 1, delivery);
      const gloveY = lerp(8 - windup * 25, -4, delivery);
      const armX = lerp(18 - windup * 24, 34, delivery) - recovery * 14;
      const armY = lerp(6 - windup * 16, -15, delivery) + recovery * 18;
      ctx.strokeStyle = '#f7f0dc';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(gloveX, gloveY);
      ctx.moveTo(12, 0);
      ctx.lineTo(armX, armY);
      ctx.stroke();

      ctx.fillStyle = '#6f4028';
      ctx.beginPath();
      ctx.arc(gloveX, gloveY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3e2518';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gloveX, gloveY, 5, -1.2, 1.2);
      ctx.stroke();
      if (this.phase === 'windup' && windup < 0.82) {
        this._drawBall(ctx, armX, armY, 4.2, this.time * 2);
      }
      ctx.restore();
      ctx.restore();
    }

    _drawBatter(ctx) {
      const { zone, portrait } = this._layout();
      const scale = clamp(this.H / 650, 0.62, 1.08);
      const x = zone.x - (portrait ? 16 : 48 * scale);
      const y = zone.y + zone.height + 28 * scale;
      const swingProgress = this.swingTime > 0 ? clamp(1 - this.swingTime / 0.42, 0, 1) : 0;
      const swingCurve = swingProgress < 0.65
        ? easeOut(swingProgress / 0.65)
        : 1 - (swingProgress - 0.65) / 0.35 * 0.25;
      const load = this.phase === 'windup' ? Math.sin((this.pitch?.windup || 0) * Math.PI * 0.75) : 0;
      const idle = Math.sin(this.time * 2.6) * 1.2;
      const torsoTurn = -load * 0.07 + swingCurve * 0.2;
      const frontStep = swingCurve * 11;
      const batAngle = -1.35 - load * 0.16 + swingCurve * 2.55;
      const uniform = UNIFORMS[this.activePlayer % UNIFORMS.length];
      const hotBat = (this.players[this.activePlayer]?.heat || 0) >= 60;

      ctx.save();
      ctx.translate(x, y + idle);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(frontStep * 0.3, 8, 46 + frontStep * 0.4, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#233426';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, -38);
      ctx.lineTo(-22 + load * 3, 3);
      ctx.moveTo(10, -38);
      ctx.lineTo(22 + frontStep, 3);
      ctx.stroke();

      ctx.strokeStyle = '#f7f0dc';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-25 + load * 3, 3);
      ctx.lineTo(-13 + load * 3, 3);
      ctx.moveTo(22 + frontStep, 3);
      ctx.lineTo(36 + frontStep, 3);
      ctx.stroke();

      ctx.save();
      ctx.rotate(torsoTurn);
      const jersey = ctx.createLinearGradient(-24, -94, 24, -35);
      jersey.addColorStop(0, uniform.jersey);
      jersey.addColorStop(1, this.activePlayer % 2 ? '#185d89' : '#a92d25');
      ctx.fillStyle = jersey;
      ctx.beginPath();
      ctx.roundRect(-24, -96, 48, 64, 11);
      ctx.fill();
      ctx.fillStyle = uniform.stripe;
      ctx.fillRect(-24, -58, 48, 10);
      ctx.globalAlpha = 0.88;
      ctx.font = '900 19px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(this.activePlayer + 1), 0, -65);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#a86d47';
      ctx.beginPath();
      ctx.arc(1, -113, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = uniform.cap;
      ctx.beginPath();
      ctx.arc(1, -120, 20, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-19, -120, 40, 8);
      ctx.beginPath();
      ctx.moveTo(13, -118);
      ctx.lineTo(31, -114);
      ctx.lineTo(13, -111);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#20231d';
      ctx.fillRect(12, -113, 3, 2);

      const handsX = 23 - load * 3 + swingCurve * 4;
      const handsY = -92 + load * 2 + swingCurve * 8;
      ctx.strokeStyle = '#d99a6c';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-15, -83);
      ctx.lineTo(8 + swingCurve * 4, -76 + swingCurve * 3);
      ctx.lineTo(handsX, handsY);
      ctx.moveTo(15, -82);
      ctx.lineTo(26 + swingCurve * 5, -73 + swingCurve * 4);
      ctx.lineTo(handsX, handsY);
      ctx.stroke();

      ctx.translate(handsX, handsY);
      if (swingProgress > 0 && swingProgress < 0.8) {
        for (let index = 3; index >= 1; index--) {
          const trailAngle = batAngle - index * 0.16;
          ctx.save();
          ctx.rotate(trailAngle);
          ctx.strokeStyle = `rgba(255, 244, 189, ${0.08 + (3 - index) * 0.06})`;
          ctx.lineWidth = 13 - index * 2;
          ctx.beginPath();
          ctx.moveTo(0, -15);
          ctx.lineTo(0, -86);
          ctx.stroke();
          ctx.restore();
        }
      }
      ctx.rotate(batAngle);
      ctx.strokeStyle = hotBat ? '#fff1a6' : '#dfad62';
      ctx.shadowColor = hotBat ? '#f3c552' : 'transparent';
      ctx.shadowBlur = hotBat ? 16 : 0;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -91);
      ctx.stroke();
      ctx.strokeStyle = '#70462b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -19);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    _drawPitch(ctx) {
      const position = this._pitchPosition(this.pitch.progress);
      const profile = PITCH_PROFILES[this.pitch.type];
      const { zone } = this._layout();
      const shadowX = lerp(this._layout().pitcher.x, zone.x + this.pitch.location.x * zone.width, this.pitch.progress);
      const shadowY = lerp(this._layout().pitcher.y + 22, zone.y + zone.height * 0.92, this.pitch.progress);
      ctx.save();
      ctx.globalAlpha = 0.1 + this.pitch.progress * 0.17;
      ctx.fillStyle = '#0b1a0d';
      ctx.beginPath();
      ctx.ellipse(shadowX, shadowY, position.radius * 1.25, position.radius * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.pitch.trail.forEach((point, index) => {
        const alpha = (index + 1) / this.pitch.trail.length * 0.2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = profile.trail;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      this._drawBall(ctx, position.x, position.y, position.radius, this.pitch.progress * profile.spin);
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
      ctx.save();
      for (let index = 7; index >= 1; index--) {
        const from = this._flightPosition(Math.max(0, this.flight.progress - index * 0.027));
        const to = this._flightPosition(Math.max(0, this.flight.progress - (index - 1) * 0.027));
        ctx.globalAlpha = (8 - index) / 8 * 0.68;
        ctx.strokeStyle = this.flight.foul ? '#f3c552' : '#fffdf0';
        ctx.lineWidth = Math.max(1.5, position.radius * (0.12 + (8 - index) * 0.045));
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
      const destination = this._flightPosition(1);
      const shadowProgress = easeOut(this.flight.progress);
      ctx.globalAlpha = 0.08 + shadowProgress * 0.2;
      ctx.fillStyle = '#08150a';
      ctx.beginPath();
      ctx.ellipse(position.x, lerp(position.y + 26, destination.y + 5, shadowProgress), position.radius * 1.25, position.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
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
        ctx.fillText(`${target.points}`, x, target.id === 'gate' ? y - radius - 8 : y + radius + 14);
        ctx.restore();
      });
    }

    _drawParticles(ctx) {
      for (const particle of this.particles) {
        ctx.save();
        ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.strokeStyle = particle.color;
        if (particle.shape === 'spark') {
          ctx.lineWidth = particle.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(particle.x - particle.vx * 0.035, particle.y - particle.vy * 0.035);
          ctx.stroke();
        } else {
          ctx.translate(particle.x, particle.y);
          ctx.rotate(particle.rotation + this.time * 7);
          ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  new FenceBusters();
})();
