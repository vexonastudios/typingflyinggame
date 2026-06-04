// pool-music.js — Procedural Pool Hall Jazz Ambience
// Generates infinite smooth jazz using Web Audio API synthesis
// Piano chords · Walking bass · Brush drums · Soft melodies
const PoolMusic = (() => {
  let ctx = null;
  let masterGain = null;
  let playing = false;
  let scheduleTimer = null;
  let nextBarTime = 0;
  let currentBar = 0;

  const BPM = 72;
  const BEAT = 60 / BPM;       // ~0.833s per beat
  const BAR = BEAT * 4;        // ~3.33s per bar

  // ── Note Frequencies ──
  const N = {
    C2:65.41, D2:73.42, Eb2:77.78, E2:82.41, F2:87.31, Gb2:92.50, G2:98.00,
    Ab2:103.83, A2:110.00, Bb2:116.54, B2:123.47,
    C3:130.81, D3:146.83, Eb3:155.56, E3:164.81, F3:174.61, Gb3:185.00,
    G3:196.00, Ab3:207.65, A3:220.00, Bb3:233.08, B3:246.94,
    C4:261.63, Db4:277.18, D4:293.66, Eb4:311.13, E4:329.63, F4:349.23,
    Gb4:369.99, G4:392.00, Ab4:415.30, A4:440.00, Bb4:466.16, B4:493.88,
    C5:523.25, D5:587.33, Eb5:622.25, E5:659.26, F5:698.46, G5:783.99,
    A5:880.00,
  };

  // ── Chord Progressions (multiple to rotate for variety) ──
  // Each chord: { bass, notes (piano voicing), walk (walking bass scale tones) }
  const PROGS = [
    // Progression A — Classic jazz turnaround
    [
      { bass: N.C2, notes: [N.E3, N.G3, N.B3, N.D4],    walk: [N.C2, N.E2, N.G2, N.B2] },
      { bass: N.A2, notes: [N.C3, N.E3, N.G3, N.B3],    walk: [N.A2, N.C2, N.E2, N.G2] },
      { bass: N.D2, notes: [N.F3, N.A3, N.C4, N.E4],    walk: [N.D2, N.F2, N.A2, N.C2] },
      { bass: N.G2, notes: [N.B3, N.D4, N.F4, N.A4],    walk: [N.G2, N.B2, N.D2, N.F2] },
      { bass: N.F2, notes: [N.A3, N.C4, N.E4, N.G4],    walk: [N.F2, N.A2, N.C2, N.E2] },
      { bass: N.Bb2, notes: [N.D3, N.F3, N.Ab3, N.C4],  walk: [N.Bb2, N.D2, N.F2, N.Ab2] },
      { bass: N.C2, notes: [N.E3, N.G3, N.Bb3, N.D4],   walk: [N.C2, N.E2, N.G2, N.Bb2] },
      { bass: N.G2, notes: [N.B3, N.D4, N.F4],           walk: [N.G2, N.A2, N.B2, N.D2] },
    ],
    // Progression B — Mellow minor vibe
    [
      { bass: N.D2, notes: [N.F3, N.A3, N.C4, N.E4],    walk: [N.D2, N.E2, N.F2, N.A2] },
      { bass: N.G2, notes: [N.B3, N.D4, N.F4],           walk: [N.G2, N.A2, N.B2, N.D2] },
      { bass: N.C2, notes: [N.E3, N.G3, N.B3, N.D4],    walk: [N.C2, N.D2, N.E2, N.G2] },
      { bass: N.A2, notes: [N.C3, N.E3, N.G3, N.B3],    walk: [N.A2, N.B2, N.C2, N.E2] },
      { bass: N.F2, notes: [N.A3, N.C4, N.E4],           walk: [N.F2, N.G2, N.A2, N.C2] },
      { bass: N.E2, notes: [N.Ab3, N.B3, N.D4, N.G4],   walk: [N.E2, N.G2, N.Ab2, N.B2] },
      { bass: N.A2, notes: [N.C3, N.E3, N.G3],           walk: [N.A2, N.C2, N.D2, N.E2] },
      { bass: N.E2, notes: [N.Ab3, N.B3, N.E4],          walk: [N.E2, N.G2, N.A2, N.B2] },
    ],
    // Progression C — Bossa-ish
    [
      { bass: N.F2, notes: [N.A3, N.C4, N.E4, N.G4],    walk: [N.F2, N.G2, N.A2, N.C2] },
      { bass: N.G2, notes: [N.B3, N.D4, N.F4, N.A4],    walk: [N.G2, N.A2, N.B2, N.D2] },
      { bass: N.C2, notes: [N.E3, N.G3, N.B3, N.D4],    walk: [N.C2, N.D2, N.E2, N.G2] },
      { bass: N.C2, notes: [N.E3, N.G3, N.B3, N.D4],    walk: [N.C2, N.E2, N.G2, N.B2] },
      { bass: N.D2, notes: [N.F3, N.A3, N.C4, N.E4],    walk: [N.D2, N.F2, N.A2, N.C2] },
      { bass: N.D2, notes: [N.F3, N.Ab3, N.C4, N.Eb4],  walk: [N.D2, N.F2, N.Ab2, N.C2] },
      { bass: N.C2, notes: [N.E3, N.G3, N.B3],           walk: [N.C2, N.E2, N.G2, N.Bb2] },
      { bass: N.G2, notes: [N.B3, N.D4, N.F4],           walk: [N.G2, N.B2, N.D2, N.F2] },
    ],
  ];

  let currentProg = 0;

  // ── Utility ──
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ── Envelope helper ──
  function env(gainNode, time, vol, attack, hold, release) {
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(vol, time + attack);
    gainNode.gain.setValueAtTime(vol, time + attack + hold);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + attack + hold + release);
  }

  // ── Piano tone (sine + harmonics) ──
  function pianoNote(freq, time, dur, vol) {
    if (!ctx || !masterGain) return;
    // Fundamental
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
    const g1 = ctx.createGain();
    env(g1, time, vol * 0.6, 0.008, dur * 0.35, dur * 0.55);
    o1.connect(g1); g1.connect(masterGain);
    o1.start(time); o1.stop(time + dur + 0.1);

    // 2nd harmonic
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.002;
    const g2 = ctx.createGain();
    env(g2, time, vol * 0.18, 0.006, dur * 0.2, dur * 0.4);
    o2.connect(g2); g2.connect(masterGain);
    o2.start(time); o2.stop(time + dur + 0.1);

    // 3rd harmonic (very subtle)
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = freq * 3.001;
    const g3 = ctx.createGain();
    env(g3, time, vol * 0.06, 0.005, dur * 0.15, dur * 0.25);
    o3.connect(g3); g3.connect(masterGain);
    o3.start(time); o3.stop(time + dur + 0.1);
  }

  // ── Upright bass (warm sine + slight fuzz) ──
  function bassNote(freq, time, dur, vol) {
    if (!ctx || !masterGain) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain();
    env(g, time, vol, 0.015, dur * 0.5, dur * 0.45);
    o.connect(g); g.connect(masterGain);
    o.start(time); o.stop(time + dur + 0.1);

    // Sub-harmonic warmth
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2.01;
    const g2 = ctx.createGain();
    env(g2, time, vol * 0.12, 0.01, dur * 0.3, dur * 0.35);
    o2.connect(g2); g2.connect(masterGain);
    o2.start(time); o2.stop(time + dur + 0.1);
  }

  // ── Brush hit (filtered noise) ──
  function brushHit(time, vol, freq, q) {
    if (!ctx || !masterGain) return;
    const len = 0.07 + Math.random() * 0.04;
    const bufSize = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq || 5500;
    filt.Q.value = q || 1.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);

    src.connect(filt); filt.connect(g); g.connect(masterGain);
    src.start(time);
  }

  // ── Ride cymbal shimmer ──
  function rideHit(time, vol) {
    if (!ctx || !masterGain) return;
    brushHit(time, vol * 0.6, 8000, 0.8);
    // Metallic tone
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = 4200 + Math.random() * 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.03, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    o.connect(g); g.connect(masterGain);
    o.start(time); o.stop(time + 0.5);
  }

  // ── Schedule one bar of music ──
  function scheduleBar(barIdx, t) {
    const prog = PROGS[currentProg];
    const chordIdx = barIdx % prog.length;
    const chord = prog[chordIdx];

    // When we loop around, sometimes switch progression
    if (barIdx > 0 && chordIdx === 0 && Math.random() < 0.4) {
      currentProg = Math.floor(Math.random() * PROGS.length);
    }

    const pianoVol = 0.10 + Math.random() * 0.04;

    // ─── Piano chord ───
    const style = Math.random();
    if (style < 0.4) {
      // Block chord on beat 1 with humanized timing
      for (const freq of chord.notes) {
        pianoNote(freq, t + rnd(0, 0.025), BAR * rnd(0.7, 0.9), pianoVol);
      }
      // Sometimes add a ghost chord on beat 3
      if (Math.random() < 0.5) {
        for (const freq of chord.notes) {
          pianoNote(freq, t + BEAT * 2 + rnd(0, 0.03), BEAT * rnd(1.2, 1.8), pianoVol * 0.5);
        }
      }
    } else if (style < 0.7) {
      // Arpeggiate up
      chord.notes.forEach((freq, i) => {
        pianoNote(freq, t + i * BEAT * 0.2 + rnd(0, 0.015), BAR * 0.6, pianoVol * 0.9);
      });
    } else {
      // Rhythmic comping — hits on beats 1, 2.5, 4
      const beats = [0, BEAT * 1.5, BEAT * 3];
      beats.forEach(offset => {
        for (const freq of chord.notes) {
          pianoNote(freq, t + offset + rnd(0, 0.02), BEAT * rnd(0.8, 1.3), pianoVol * 0.7);
        }
      });
    }

    // ─── Optional melody fragment ───
    if (Math.random() < 0.25) {
      const melStart = t + BEAT * rnd(1.5, 2.5);
      const melNotes = chord.notes.slice(-2); // top notes
      melNotes.forEach((freq, i) => {
        pianoNote(freq * 2, melStart + i * BEAT * rnd(0.4, 0.7), BEAT * rnd(0.8, 1.5), pianoVol * 0.35);
      });
    }

    // ─── Walking bass ───
    const walkNotes = [chord.bass, ...chord.walk.slice(1)]; // root first, then walk
    for (let beat = 0; beat < 4; beat++) {
      let bFreq;
      if (beat === 0) {
        bFreq = chord.bass; // always root on beat 1
      } else if (beat === 3) {
        // Approach tone to next chord's root
        const nextChord = prog[(chordIdx + 1) % prog.length];
        bFreq = nextChord.bass * (Math.random() < 0.5 ? 1.0595 : 0.9439); // half step above/below
      } else {
        bFreq = pick(walkNotes);
      }
      bassNote(bFreq, t + beat * BEAT + rnd(-0.01, 0.01), BEAT * 0.85, 0.18);
    }

    // ─── Drums — brush pattern ───
    for (let beat = 0; beat < 4; beat++) {
      const bt = t + beat * BEAT;

      // Ride cymbal — swing pattern (beat + upbeat)
      rideHit(bt + rnd(-0.008, 0.008), 0.035);
      // Swing upbeat (slightly before the and)
      if (Math.random() < 0.8) {
        rideHit(bt + BEAT * rnd(0.6, 0.72), 0.02);
      }

      // Brush sweep on 2 and 4 (like snare in jazz)
      if (beat === 1 || beat === 3) {
        brushHit(bt + rnd(0, 0.01), 0.06, 3500, 1.5);
      }

      // Ghost brush between beats
      if (Math.random() < 0.3) {
        brushHit(bt + BEAT * rnd(0.3, 0.5), 0.015, 6000, 2);
      }
    }

    // ─── Soft pad (sustained chord tone for warmth) ───
    if (barIdx % 4 === 0) {
      // Every 4 bars, a very soft sustained pad
      const padFreq = chord.notes[0];
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = padFreq;
      const g = ctx.createGain();
      const padDur = BAR * 4;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.025, t + BAR);
      g.gain.setValueAtTime(0.025, t + padDur - BAR);
      g.gain.linearRampToValueAtTime(0, t + padDur);
      o.connect(g); g.connect(masterGain);
      o.start(t); o.stop(t + padDur + 0.1);
    }
  }

  // ── Scheduler (keeps 3 seconds of audio queued ahead) ──
  function scheduler() {
    if (!playing) return;
    while (nextBarTime < ctx.currentTime + 3) {
      scheduleBar(currentBar, nextBarTime);
      currentBar++;
      nextBarTime += BAR;
    }
    scheduleTimer = setTimeout(scheduler, 400);
  }

  // ── Public API ──
  function init(audioCtx) {
    ctx = audioCtx;
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(ctx.destination);
  }

  function start() {
    if (playing || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    currentBar = 0;
    currentProg = Math.floor(Math.random() * PROGS.length);
    nextBarTime = ctx.currentTime + 0.3;
    scheduler();
  }

  function stop() {
    playing = false;
    if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null; }
  }

  function setVolume(v) {
    if (masterGain) masterGain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.3);
  }

  return { init, start, stop, setVolume };
})();
