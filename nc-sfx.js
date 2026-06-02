// nc-sfx.js — NERF OPS: Rogue Protocol — Audio Engine
'use strict';

const _ac = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  _r() { if (_ac.state === 'suspended') _ac.resume(); },

  _osc(freq, type, dur, vol = 0.08, freqEnd = null, attack = 0.005) {
    try {
      this._r();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, _ac.currentTime);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, _ac.currentTime + dur);
      g.gain.setValueAtTime(0.001, _ac.currentTime);
      g.gain.linearRampToValueAtTime(vol, _ac.currentTime + attack);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      o.connect(g); g.connect(_ac.destination);
      o.start(); o.stop(_ac.currentTime + dur);
    } catch (e) {}
  },

  _noise(dur, vol = 0.05, hiPass = 0) {
    try {
      this._r();
      const len = Math.ceil(_ac.sampleRate * dur);
      const buf = _ac.createBuffer(1, len, _ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
      const src = _ac.createBufferSource();
      src.buffer = buf;
      const g = _ac.createGain();
      g.gain.setValueAtTime(vol, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
      if (hiPass > 0) {
        const f = _ac.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = hiPass;
        src.connect(f); f.connect(g);
      } else {
        src.connect(g);
      }
      g.connect(_ac.destination);
      src.start();
    } catch (e) {}
  },

  shoot() {
    this._osc(180, 'sawtooth', 0.06, 0.1, 60);
    this._noise(0.05, 0.07, 800);
    this._osc(90, 'square', 0.08, 0.05, 40);
  },

  enemyShoot() {
    this._osc(140, 'sawtooth', 0.06, 0.08, 50);
    this._noise(0.04, 0.05, 600);
  },

  empty() {
    this._osc(140, 'square', 0.08, 0.05, 100);
    this._noise(0.04, 0.03, 200);
  },

  reload() {
    this._noise(0.04, 0.04, 400);
    setTimeout(() => { this._osc(260, 'triangle', 0.1, 0.06, 380); }, 120);
    setTimeout(() => { this._noise(0.03, 0.05, 600); this._osc(320, 'triangle', 0.1, 0.07, 440); }, 350);
  },

  hit() {
    this._osc(800, 'sine', 0.05, 0.1, 200);
    this._noise(0.12, 0.09, 100);
    this._osc(120, 'sawtooth', 0.15, 0.06, 60);
  },

  playerHit() {
    this._osc(120, 'sawtooth', 0.2, 0.15, 60);
    this._noise(0.15, 0.1, 50);
  },

  splat() {
    this._noise(0.08, 0.06, 300);
    this._osc(160, 'sine', 0.1, 0.04, 80);
  },

  step() { 
    this._noise(0.035, 0.012, 80); 
    this._osc(60, 'sine', 0.04, 0.015); 
  },

  pickup() {
    [600, 800, 1000].forEach((f, i) => setTimeout(() => this._osc(f, 'sine', 0.15, 0.08), i * 80));
  },

  door() {
    this._noise(0.5, 0.08, 100);
    this._osc(80, 'square', 0.5, 0.05, 60);
  },

  win() { 
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => setTimeout(() => this._osc(f, 'sine', 0.3, 0.09), i * 90)); 
  },

  click() { 
    this._osc(700, 'sine', 0.04, 0.04); 
  },
};
