/* ============================================================
   CHESS DUEL — chess.js
   Full two-player chess — Pro Edition
   Move hints toggle, sound toggle, board flip, undo, resign,
   draw, material advantage, board themes, insufficient material,
   50-move rule, threefold repetition
   ============================================================ */

(function () {
  'use strict';

  // ======== CONSTANTS ========
  const PIECES = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  const INITIAL_BOARD = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
  ];

  const FILES = 'abcdefgh';

  const BOARD_THEMES = {
    classic:  { light: '#e8dcc8', dark: '#7b6b4f', lightH: '#f0e8d6', darkH: '#8d7c5e' },
    walnut:   { light: '#f0d9b5', dark: '#b58863', lightH: '#f5e2c4', darkH: '#c49a75' },
    ocean:    { light: '#dee3e6', dark: '#5b8baa', lightH: '#e8ecee', darkH: '#6d9bb8' },
    emerald:  { light: '#ffffdd', dark: '#5f915f', lightH: '#ffffe8', darkH: '#6fa06f' },
    midnight: { light: '#c8c8d4', dark: '#4a4a6a', lightH: '#d4d4de', darkH: '#5a5a7a' }
  };

  // ======== AUDIO ENGINE (Rich Synthesis) ========
  const AudioEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (this.ctx) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },

    // Create a short noise burst (white noise) — used for wood/thock sounds
    _noise(duration) {
      const ctx = this.ctx;
      const len = ctx.sampleRate * duration;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      return src;
    },

    play(type) {
      if (!this.enabled || !this.ctx) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const dest = ctx.destination;

      switch (type) {

        // ── MOVE: Satisfying wood "thock" — piece placed on board ──
        case 'move': {
          // Layer 1: Noise burst through bandpass = woody impact
          const noise = this._noise(0.12);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.5;
          const g1 = ctx.createGain();
          g1.gain.setValueAtTime(0.5, now);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          noise.connect(bp).connect(g1).connect(dest);
          noise.start(now); noise.stop(now + 0.12);

          // Layer 2: Low body thump
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.35, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(g2).connect(dest);
          osc.start(now); osc.stop(now + 0.1);

          // Layer 3: High click transient
          const click = ctx.createOscillator();
          click.type = 'sine';
          click.frequency.setValueAtTime(3200, now);
          click.frequency.exponentialRampToValueAtTime(1200, now + 0.015);
          const g3 = ctx.createGain();
          g3.gain.setValueAtTime(0.15, now);
          g3.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
          click.connect(g3).connect(dest);
          click.start(now); click.stop(now + 0.04);
          break;
        }

        // ── CAPTURE: Heavy slam — piece takes another ──
        case 'capture': {
          // Layer 1: Aggressive noise burst (wider band)
          const noise = this._noise(0.2);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.8;
          const g1 = ctx.createGain();
          g1.gain.setValueAtTime(0.6, now);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          noise.connect(bp).connect(g1).connect(dest);
          noise.start(now); noise.stop(now + 0.2);

          // Layer 2: Deep impact thud
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.5, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(g2).connect(dest);
          osc.start(now); osc.stop(now + 0.16);

          // Layer 3: Sharp crack
          const crack = ctx.createOscillator();
          crack.type = 'sawtooth';
          crack.frequency.setValueAtTime(4000, now);
          crack.frequency.exponentialRampToValueAtTime(500, now + 0.03);
          const g3 = ctx.createGain();
          g3.gain.setValueAtTime(0.2, now);
          g3.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          crack.connect(g3).connect(dest);
          crack.start(now); crack.stop(now + 0.06);

          // Layer 4: Piece scatter resonance
          const res = ctx.createOscillator();
          res.type = 'triangle';
          res.frequency.setValueAtTime(800, now + 0.03);
          res.frequency.exponentialRampToValueAtTime(300, now + 0.15);
          const g4 = ctx.createGain();
          g4.gain.setValueAtTime(0.0, now);
          g4.gain.linearRampToValueAtTime(0.12, now + 0.04);
          g4.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          res.connect(g4).connect(dest);
          res.start(now); res.stop(now + 0.2);
          break;
        }

        // ── SELECT: Piece pickup — light wooden lift ──
        case 'select': {
          const noise = this._noise(0.06);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 2;
          const g1 = ctx.createGain();
          g1.gain.setValueAtTime(0.2, now);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          noise.connect(bp).connect(g1).connect(dest);
          noise.start(now); noise.stop(now + 0.06);

          // Soft rising click
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(1400, now + 0.04);
          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.12, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(g2).connect(dest);
          osc.start(now); osc.stop(now + 0.07);
          break;
        }

        // ── CHECK: Dramatic alert — two-tone warning ──
        case 'check': {
          // Two sharp alert tones
          [880, 1100].forEach((freq, i) => {
            const t = now + i * 0.12;
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.3, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(g).connect(dest);
            osc.start(t); osc.stop(t + 0.16);
          });

          // Tension noise swirl
          const noise = this._noise(0.3);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 3;
          const g1 = ctx.createGain();
          g1.gain.setValueAtTime(0.08, now);
          g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          noise.connect(bp).connect(g1).connect(dest);
          noise.start(now); noise.stop(now + 0.3);
          break;
        }

        // ── CASTLE: Double thock — king + rook placement ──
        case 'castle': {
          for (let i = 0; i < 2; i++) {
            const t = now + i * 0.15;

            // Wood thock per piece
            const noise = this._noise(0.1);
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = 1600 + i * 400; bp.Q.value = 1.5;
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0.4, t);
            g1.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
            noise.connect(bp).connect(g1).connect(dest);
            noise.start(t); noise.stop(t + 0.1);

            // Body thump
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(250 + i * 80, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.3, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.connect(g2).connect(dest);
            osc.start(t); osc.stop(t + 0.1);
          }

          // Regal slide tone underneath
          const slide = ctx.createOscillator();
          slide.type = 'sine';
          slide.frequency.setValueAtTime(350, now);
          slide.frequency.linearRampToValueAtTime(500, now + 0.3);
          const gs = ctx.createGain();
          gs.gain.setValueAtTime(0.08, now);
          gs.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          slide.connect(gs).connect(dest);
          slide.start(now); slide.stop(now + 0.35);
          break;
        }

        // ── PROMOTE: Triumphant ascending arpeggio ──
        case 'promote': {
          const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
          notes.forEach((freq, i) => {
            const t = now + i * 0.09;

            // Bright tone
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0.25, t);
            g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            osc.connect(g1).connect(dest);
            osc.start(t); osc.stop(t + 0.28);

            // Shimmer harmonic
            const h = ctx.createOscillator();
            h.type = 'sine';
            h.frequency.setValueAtTime(freq * 2, t);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.08, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            h.connect(g2).connect(dest);
            h.start(t); h.stop(t + 0.22);
          });

          // Sparkle noise at end
          const spark = this._noise(0.15);
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass'; hp.frequency.value = 6000;
          const gn = ctx.createGain();
          gn.gain.setValueAtTime(0.0, now + 0.3);
          gn.gain.linearRampToValueAtTime(0.1, now + 0.35);
          gn.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          spark.connect(hp).connect(gn).connect(dest);
          spark.start(now + 0.3); spark.stop(now + 0.5);
          break;
        }

        // ── CHECKMATE: Dramatic descending doom ──
        case 'checkmate': {
          const notes = [440, 415, 370, 330, 262];
          notes.forEach((freq, i) => {
            const t = now + i * 0.18;

            // Dark sawtooth
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 1200;
            const g1 = ctx.createGain();
            g1.gain.setValueAtTime(0.18, t);
            g1.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(lp).connect(g1).connect(dest);
            osc.start(t); osc.stop(t + 0.38);

            // Octave below for weight
            const sub = ctx.createOscillator();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(freq / 2, t);
            const g2 = ctx.createGain();
            g2.gain.setValueAtTime(0.12, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            sub.connect(g2).connect(dest);
            sub.start(t); sub.stop(t + 0.32);
          });

          // Impact boom at start
          const boom = ctx.createOscillator();
          boom.type = 'sine';
          boom.frequency.setValueAtTime(80, now);
          boom.frequency.exponentialRampToValueAtTime(30, now + 0.3);
          const gb = ctx.createGain();
          gb.gain.setValueAtTime(0.3, now);
          gb.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          boom.connect(gb).connect(dest);
          boom.start(now); boom.stop(now + 0.4);

          // Rumble noise
          const rum = this._noise(0.6);
          const rlp = ctx.createBiquadFilter();
          rlp.type = 'lowpass'; rlp.frequency.value = 400;
          const gr = ctx.createGain();
          gr.gain.setValueAtTime(0.12, now);
          gr.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          rum.connect(rlp).connect(gr).connect(dest);
          rum.start(now); rum.stop(now + 0.6);
          break;
        }

        // ── ILLEGAL: Error buzz — blocked move ──
        case 'illegal': {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(150, now);
          osc.frequency.setValueAtTime(130, now + 0.06);
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = 600;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(lp).connect(g).connect(dest);
          osc.start(now); osc.stop(now + 0.18);

          // Scratch noise
          const noise = this._noise(0.1);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
          const gn = ctx.createGain();
          gn.gain.setValueAtTime(0.1, now);
          gn.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          noise.connect(bp).connect(gn).connect(dest);
          noise.start(now); noise.stop(now + 0.1);
          break;
        }

        // ── UNDO: Reverse whoosh ──
        case 'undo': {
          // Reverse sweep
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.12);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.18);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.18, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(g).connect(dest);
          osc.start(now); osc.stop(now + 0.2);

          // Breathy whoosh
          const noise = this._noise(0.15);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 0.5;
          bp.frequency.exponentialRampToValueAtTime(5000, now + 0.1);
          const gn = ctx.createGain();
          gn.gain.setValueAtTime(0.12, now);
          gn.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          noise.connect(bp).connect(gn).connect(dest);
          noise.start(now); noise.stop(now + 0.15);
          break;
        }

        // ── DRAW: Peaceful resolution ──
        case 'draw': {
          [440, 523, 659].forEach((freq, i) => {
            const t = now + i * 0.15;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.18, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(g).connect(dest);
            osc.start(t); osc.stop(t + 0.32);

            // Soft harmonic
            const h = ctx.createOscillator();
            h.type = 'sine';
            h.frequency.setValueAtTime(freq * 1.5, t);
            const gh = ctx.createGain();
            gh.gain.setValueAtTime(0.06, t);
            gh.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            h.connect(gh).connect(dest);
            h.start(t); h.stop(t + 0.27);
          });
          break;
        }

        // ── GAME START: Opening fanfare ──
        case 'gamestart': {
          const notes = [262, 330, 392, 523]; // C4 E4 G4 C5
          notes.forEach((freq, i) => {
            const t = now + i * 0.07;
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.2, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(g).connect(dest);
            osc.start(t); osc.stop(t + 0.2);
          });
          break;
        }

        // ── TICK: Timer low warning tick ──
        case 'tick': {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1000, now);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.08, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.connect(g).connect(dest);
          osc.start(now); osc.stop(now + 0.05);
          break;
        }
      }
    }
  };

  // ======== GAME STATE ========
  let board = [];
  let turn = 'white';
  let selectedSquare = null;
  let legalMoves = [];
  let moveHistory = [];
  let capturedWhite = [];
  let capturedBlack = [];
  let lastMoveFrom = null;
  let lastMoveTo = null;
  let gameOver = false;
  let moveCount = 0;
  let castling = { K: true, Q: true, k: true, q: true };
  let enPassantTarget = null;

  // Pro features state
  let showHints = true;
  let boardFlipped = false;
  let currentTheme = 'classic';
  let halfMoveClock = 0;        // 50-move rule counter
  let positionHistory = [];     // for threefold repetition
  let stateStack = [];          // for undo

  // Timer
  let timerSeconds = 600;
  let whiteTime = 0;
  let blackTime = 0;
  let timerInterval = null;
  let useTimer = false;

  // Pending promotion
  let pendingPromotion = null;

  // Confirm dialog callback
  let confirmCallback = null;

  // AI Opponent State
  let isVsComputer = false;
  let aiDifficulty = 'medium';
  let playerColor = 'white';
  let aiColor = 'black';

  // ======== DOM REFS ========
  const $ = id => document.getElementById(id);
  const setupOverlay = $('setupOverlay');
  const gameArea = $('gameArea');
  const chessBoard = $('chessBoard');
  const rankLabels = $('rankLabels');
  const fileLabels = $('fileLabels');
  const turnIndicator = $('turnIndicator');
  const turnText = $('turnText');
  const statusBanner = $('statusBanner');
  const statusText = $('statusText');
  const timerDisplay = $('timerDisplay');
  const whiteTimerEl = $('whiteTimer');
  const blackTimerEl = $('blackTimer');
  const capturedByWhiteEl = $('capturedByWhite');
  const capturedByBlackEl = $('capturedByBlack');
  const whiteAdvEl = $('whiteAdvantage');
  const blackAdvEl = $('blackAdvantage');
  const historyList = $('historyList');
  const promotionOverlay = $('promotionOverlay');
  const promotionChoices = $('promotionChoices');
  const resultsOverlay = $('resultsOverlay');
  const resultsEmoji = $('resultsEmoji');
  const resultsHeadline = $('resultsHeadline');
  const resultsSub = $('resultsSub');
  const undoBtn = $('undoBtn');
  const settingsDrawer = $('settingsDrawer');
  const confirmOverlay = $('confirmOverlay');

  // ======== HELPERS ========
  function isWhite(piece) { return piece && piece === piece.toUpperCase(); }
  function isBlack(piece) { return piece && piece === piece.toLowerCase(); }
  function pieceColor(piece) {
    if (!piece) return null;
    return isWhite(piece) ? 'white' : 'black';
  }
  function opponentColor(c) { return c === 'white' ? 'black' : 'white'; }
  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function cloneBoard(b) { return b.map(row => [...row]); }

  function findKing(b, color) {
    const king = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (b[r][c] === king) return { row: r, col: c };
    return null;
  }

  // ======== POSITION HASHING (for threefold repetition) ========
  function boardHash() {
    // Simplified FEN-like hash: board + turn + castling + ep
    let h = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        if (board[r][c]) {
          if (empty) { h += empty; empty = 0; }
          h += board[r][c];
        } else { empty++; }
      }
      if (empty) h += empty;
      h += '/';
    }
    h += ' ' + turn[0];
    h += ' ' + (castling.K ? 'K' : '') + (castling.Q ? 'Q' : '') +
         (castling.k ? 'k' : '') + (castling.q ? 'q' : '');
    if (!castling.K && !castling.Q && !castling.k && !castling.q) h += '-';
    if (enPassantTarget) h += ' ' + FILES[enPassantTarget.col] + (8 - enPassantTarget.row);
    else h += ' -';
    return h;
  }

  function checkThreefoldRepetition() {
    const current = boardHash();
    let count = 0;
    for (const h of positionHistory) {
      if (h === current) count++;
    }
    return count >= 3; // current is already in positionHistory
  }

  // ======== INSUFFICIENT MATERIAL ========
  function isInsufficientMaterial() {
    const pieces = { white: [], black: [] };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const color = pieceColor(p);
        const type = p.toLowerCase();
        if (type !== 'k') pieces[color].push({ type, row: r, col: c });
      }
    }
    const w = pieces.white;
    const b = pieces.black;

    // K vs K
    if (w.length === 0 && b.length === 0) return true;

    // K+B vs K or K+N vs K
    if (w.length === 0 && b.length === 1 && (b[0].type === 'b' || b[0].type === 'n')) return true;
    if (b.length === 0 && w.length === 1 && (w[0].type === 'b' || w[0].type === 'n')) return true;

    // K+B vs K+B same color bishops
    if (w.length === 1 && b.length === 1 && w[0].type === 'b' && b[0].type === 'b') {
      const wBishopColor = (w[0].row + w[0].col) % 2;
      const bBishopColor = (b[0].row + b[0].col) % 2;
      if (wBishopColor === bBishopColor) return true;
    }

    return false;
  }

  // ======== STATE SNAPSHOTS (for undo) ========
  function saveState() {
    stateStack.push({
      board: cloneBoard(board),
      turn,
      castling: { ...castling },
      enPassantTarget: enPassantTarget ? { ...enPassantTarget } : null,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      lastMoveFrom: lastMoveFrom ? { ...lastMoveFrom } : null,
      lastMoveTo: lastMoveTo ? { ...lastMoveTo } : null,
      moveCount,
      halfMoveClock,
      moveHistory: moveHistory.map(m => ({ ...m })),
      positionHistory: [...positionHistory]
    });
    undoBtn.disabled = false;
  }

  function undoMove() {
    if (stateStack.length === 0 || gameOver) return;

    let steps = 1;
    if (isVsComputer && turn === playerColor && stateStack.length >= 2) {
      steps = 2;
    }

    for (let i = 0; i < steps; i++) {
      if (stateStack.length === 0) break;
      const state = stateStack.pop();
      board = state.board;
      turn = state.turn;
      castling = state.castling;
      enPassantTarget = state.enPassantTarget;
      capturedWhite = state.capturedWhite;
      capturedBlack = state.capturedBlack;
      lastMoveFrom = state.lastMoveFrom;
      lastMoveTo = state.lastMoveTo;
      moveCount = state.moveCount;
      halfMoveClock = state.halfMoveClock;
      moveHistory = state.moveHistory;
      positionHistory = state.positionHistory;
    }

    selectedSquare = null;
    legalMoves = [];

    undoBtn.disabled = stateStack.length === 0;

    AudioEngine.play('undo');
    renderAll();
    hideStatusBanner();

    // Re-check for check display
    if (isInCheck(board, turn)) {
      showStatusBanner(`${turn === 'white' ? 'White' : 'Black'} is in CHECK!`);
    }
  }

  // ======== MATERIAL ADVANTAGE ========
  function updateMaterialAdvantage() {
    let whiteVal = 0, blackVal = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const val = PIECE_VALUES[p.toLowerCase()] || 0;
        if (isWhite(p)) whiteVal += val;
        else blackVal += val;
      }
    }

    const diff = whiteVal - blackVal;

    whiteAdvEl.classList.remove('visible');
    blackAdvEl.classList.remove('visible');

    if (diff > 0) {
      whiteAdvEl.textContent = '+' + diff;
      whiteAdvEl.classList.add('visible');
    } else if (diff < 0) {
      blackAdvEl.textContent = '+' + Math.abs(diff);
      blackAdvEl.classList.add('visible');
    }
  }

  // ======== MOVE GENERATION ========
  function isSquareAttacked(b, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || pieceColor(p) !== byColor) continue;
        const rawMoves = getRawMoves(b, r, c, true);
        if (rawMoves.some(m => m.row === row && m.col === col)) return true;
      }
    }
    return false;
  }

  function isInCheck(b, color) {
    const king = findKing(b, color);
    if (!king) return false;
    return isSquareAttacked(b, king.row, king.col, opponentColor(color));
  }

  function getRawMoves(b, row, col, attackOnly) {
    const piece = b[row][col];
    if (!piece) return [];
    const color = pieceColor(piece);
    const moves = [];
    const type = piece.toLowerCase();

    function addMove(r, c) {
      if (!inBounds(r, c)) return false;
      const target = b[r][c];
      if (target && pieceColor(target) === color) return false;
      moves.push({ row: r, col: c, capture: !!target });
      return !target;
    }

    function addSlide(dr, dc) {
      for (let i = 1; i < 8; i++) {
        if (!addMove(row + dr * i, col + dc * i)) break;
      }
    }

    switch (type) {
      case 'p': {
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        if (!attackOnly) {
          if (inBounds(row + dir, col) && !b[row + dir][col]) {
            moves.push({ row: row + dir, col: col, capture: false });
            if (row === startRow && !b[row + 2 * dir][col]) {
              moves.push({ row: row + 2 * dir, col: col, capture: false });
            }
          }
        }

        for (const dc of [-1, 1]) {
          const nr = row + dir, nc = col + dc;
          if (!inBounds(nr, nc)) continue;
          if (attackOnly) {
            moves.push({ row: nr, col: nc, capture: true });
          } else if (b[nr][nc] && pieceColor(b[nr][nc]) !== color) {
            moves.push({ row: nr, col: nc, capture: true });
          }
        }

        if (!attackOnly && enPassantTarget) {
          for (const dc of [-1, 1]) {
            const nr = row + dir, nc = col + dc;
            if (nr === enPassantTarget.row && nc === enPassantTarget.col) {
              moves.push({ row: nr, col: nc, capture: true, enPassant: true });
            }
          }
        }
        break;
      }
      case 'n': {
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of offsets) addMove(row + dr, col + dc);
        break;
      }
      case 'b': {
        addSlide(-1, -1); addSlide(-1, 1); addSlide(1, -1); addSlide(1, 1);
        break;
      }
      case 'r': {
        addSlide(-1, 0); addSlide(1, 0); addSlide(0, -1); addSlide(0, 1);
        break;
      }
      case 'q': {
        addSlide(-1, -1); addSlide(-1, 1); addSlide(1, -1); addSlide(1, 1);
        addSlide(-1, 0); addSlide(1, 0); addSlide(0, -1); addSlide(0, 1);
        break;
      }
      case 'k': {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            addMove(row + dr, col + dc);
          }
        }
        if (!attackOnly) {
          const cr = color === 'white' ? 7 : 0;
          if (row === cr && col === 4) {
            const ks = color === 'white' ? 'K' : 'k';
            if (castling[ks] && !b[cr][5] && !b[cr][6] && b[cr][7] &&
                b[cr][7].toLowerCase() === 'r' && pieceColor(b[cr][7]) === color) {
              if (!isInCheck(b, color) &&
                  !isSquareAttacked(b, cr, 5, opponentColor(color)) &&
                  !isSquareAttacked(b, cr, 6, opponentColor(color))) {
                moves.push({ row: cr, col: 6, capture: false, castling: 'K' });
              }
            }
            const qs = color === 'white' ? 'Q' : 'q';
            if (castling[qs] && !b[cr][3] && !b[cr][2] && !b[cr][1] && b[cr][0] &&
                b[cr][0].toLowerCase() === 'r' && pieceColor(b[cr][0]) === color) {
              if (!isInCheck(b, color) &&
                  !isSquareAttacked(b, cr, 3, opponentColor(color)) &&
                  !isSquareAttacked(b, cr, 2, opponentColor(color))) {
                moves.push({ row: cr, col: 2, capture: false, castling: 'Q' });
              }
            }
          }
        }
        break;
      }
    }
    return moves;
  }

  function getLegalMoves(b, row, col) {
    const piece = b[row][col];
    if (!piece) return [];
    const color = pieceColor(piece);
    const raw = getRawMoves(b, row, col, false);

    return raw.filter(move => {
      const sim = cloneBoard(b);
      sim[move.row][move.col] = sim[row][col];
      sim[row][col] = '';
      if (move.enPassant) {
        const capturedRow = color === 'white' ? move.row + 1 : move.row - 1;
        sim[capturedRow][move.col] = '';
      }
      if (move.castling) {
        const cr = color === 'white' ? 7 : 0;
        if (move.castling === 'K') { sim[cr][5] = sim[cr][7]; sim[cr][7] = ''; }
        else { sim[cr][3] = sim[cr][0]; sim[cr][0] = ''; }
      }
      return !isInCheck(sim, color);
    });
  }

  function hasAnyLegalMove(b, color) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (b[r][c] && pieceColor(b[r][c]) === color)
          if (getLegalMoves(b, r, c).length > 0) return true;
    return false;
  }

  // ======== ALGEBRAIC NOTATION ========
  function toAlgebraic(row, col) {
    return FILES[col] + (8 - row);
  }

  function getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured, promotion, isCastle, isCheck, isCheckmate, isEnPassant) {
    if (isCastle === 'K') return isCheckmate ? 'O-O#' : isCheck ? 'O-O+' : 'O-O';
    if (isCastle === 'Q') return isCheckmate ? 'O-O-O#' : isCheck ? 'O-O-O+' : 'O-O-O';

    let notation = '';
    const type = piece.toLowerCase();
    if (type !== 'p') notation += type.toUpperCase();
    if (captured || isEnPassant) {
      if (type === 'p') notation += FILES[fromCol];
      notation += 'x';
    }
    notation += toAlgebraic(toRow, toCol);
    if (promotion) notation += '=' + promotion.toUpperCase();
    if (isCheckmate) notation += '#';
    else if (isCheck) notation += '+';
    return notation;
  }

  // ======== MAKE MOVE ========
  function makeMove(fromRow, fromCol, toRow, toCol, promoteTo) {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;
    const color = pieceColor(piece);
    const captured = board[toRow][toCol];
    const type = piece.toLowerCase();
    let isCastleType = null;
    let isEP = false;

    const move = legalMoves.find(m => m.row === toRow && m.col === toCol);
    if (!move) return false;

    // Save state for undo BEFORE making changes
    saveState();

    // Update half-move clock (for 50-move rule)
    if (type === 'p' || captured || move.enPassant) {
      halfMoveClock = 0;
    } else {
      halfMoveClock++;
    }

    // Handle en passant
    if (move.enPassant) {
      isEP = true;
      const epRow = color === 'white' ? toRow + 1 : toRow - 1;
      const epPiece = board[epRow][toCol];
      if (epPiece) {
        if (color === 'white') capturedWhite.push(epPiece);
        else capturedBlack.push(epPiece);
      }
      board[epRow][toCol] = '';
      AudioEngine.play('capture');
    }

    // Handle capture
    if (captured) {
      if (color === 'white') capturedWhite.push(captured);
      else capturedBlack.push(captured);
      AudioEngine.play('capture');
    }

    // Handle castling
    if (move.castling) {
      isCastleType = move.castling;
      const cr = color === 'white' ? 7 : 0;
      if (move.castling === 'K') { board[cr][5] = board[cr][7]; board[cr][7] = ''; }
      else { board[cr][3] = board[cr][0]; board[cr][0] = ''; }
      AudioEngine.play('castle');
    }

    // Move piece
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '';

    // Pawn promotion
    if (type === 'p' && (toRow === 0 || toRow === 7)) {
      if (promoteTo) {
        board[toRow][toCol] = color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        AudioEngine.play('promote');
      } else {
        pendingPromotion = { fromRow, fromCol, toRow, toCol, piece, captured, color, type, isCastleType, isEP };
        renderBoard();
        return 'promote';
      }
    }

    completeMove(fromRow, fromCol, toRow, toCol, piece, captured, color, type, isCastleType, isEP, promoteTo);
    return true;
  }

  function completeMove(fromRow, fromCol, toRow, toCol, piece, captured, color, type, isCastleType, isEP, promoteTo) {
    // Update en passant target
    if (type === 'p' && Math.abs(toRow - fromRow) === 2) {
      enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
    } else {
      enPassantTarget = null;
    }

    // Update castling rights
    if (type === 'k') {
      if (color === 'white') { castling.K = false; castling.Q = false; }
      else { castling.k = false; castling.q = false; }
    }
    if (type === 'r') {
      if (color === 'white') {
        if (fromRow === 7 && fromCol === 0) castling.Q = false;
        if (fromRow === 7 && fromCol === 7) castling.K = false;
      } else {
        if (fromRow === 0 && fromCol === 0) castling.q = false;
        if (fromRow === 0 && fromCol === 7) castling.k = false;
      }
    }
    if (toRow === 0 && toCol === 0) castling.q = false;
    if (toRow === 0 && toCol === 7) castling.k = false;
    if (toRow === 7 && toCol === 0) castling.Q = false;
    if (toRow === 7 && toCol === 7) castling.K = false;

    // Play move sound
    if (!captured && !isEP && !isCastleType && !promoteTo) {
      AudioEngine.play('move');
    }

    // Update last move
    lastMoveFrom = { row: fromRow, col: fromCol };
    lastMoveTo = { row: toRow, col: toCol };

    // Switch turn
    const nextTurn = opponentColor(color);

    // Record position hash AFTER the move
    turn = nextTurn;
    positionHistory.push(boardHash());

    // Check states
    const inCheck = isInCheck(board, nextTurn);
    const hasLegal = hasAnyLegalMove(board, nextTurn);
    let isCheckmate = inCheck && !hasLegal;
    let isStalemate = !inCheck && !hasLegal;
    let isInsufficient = isInsufficientMaterial();

    let winReason = 'checkmate';
    let gameWinner = color;

    if (isVsComputer) {
      if (isStalemate && nextTurn === aiColor) {
        // Human stalemated the computer -> Victory for Human
        isStalemate = false;
        isCheckmate = true;
        gameWinner = playerColor;
        winReason = 'stalemate-win';
      } else if (isInsufficient) {
        // Human has pieces, AI has none -> Victory for Human
        const humanPieces = [];
        const aiPieces = [];
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (!p) continue;
            if (pieceColor(p) === playerColor && p.toLowerCase() !== 'k') humanPieces.push(p);
            if (pieceColor(p) === aiColor && p.toLowerCase() !== 'k') aiPieces.push(p);
          }
        }
        if (aiPieces.length === 0 && humanPieces.length > 0) {
          isInsufficient = false;
          isCheckmate = true;
          gameWinner = playerColor;
          winReason = 'material-win';
        }
      }
    }

    if (inCheck && !isCheckmate) AudioEngine.play('check');
    if (isCheckmate) AudioEngine.play('checkmate');

    // Generate notation
    moveCount++;
    const notation = getMoveNotation(fromRow, fromCol, toRow, toCol, piece, captured, promoteTo, isCastleType, inCheck, isCheckmate, isEP);
    moveHistory.push({
      moveNum: Math.ceil(moveCount / 2),
      color: color,
      notation: notation,
      piece: piece
    });

    // Clear selection
    selectedSquare = null;
    legalMoves = [];

    // Render
    renderAll();

    // End-of-game checks
    if (isCheckmate) {
      gameOver = true;
      stopTimer();
      showResults(gameWinner, winReason);
    } else if (isStalemate) {
      gameOver = true;
      stopTimer();
      showResults(null, 'stalemate');
    } else if (isInsufficient) {
      gameOver = true;
      stopTimer();
      AudioEngine.play('draw');
      showResults(null, 'insufficient');
    } else if (halfMoveClock >= 100) {
      gameOver = true;
      stopTimer();
      AudioEngine.play('draw');
      showResults(null, 'fifty-move');
    } else if (checkThreefoldRepetition()) {
      gameOver = true;
      stopTimer();
      AudioEngine.play('draw');
      showResults(null, 'repetition');
    } else {
      if (inCheck) {
        showStatusBanner(`${nextTurn === 'white' ? 'White' : 'Black'} is in CHECK!`);
      } else {
        hideStatusBanner();
      }

      // Trigger AI Move
      if (isVsComputer && nextTurn === aiColor) {
        triggerAIMove();
      }
    }
  }

  // ======== RENDERING ========
  function renderAll() {
    renderBoard();
    renderCaptured();
    renderHistory();
    updateTurnIndicator();
    updateMaterialAdvantage();
  }

  function renderBoard() {
    if (!board || board.length === 0) return;
    chessBoard.innerHTML = '';

    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const r = boardFlipped ? 7 - ri : ri;
        const c = boardFlipped ? 7 - ci : ci;

        const sq = document.createElement('div');
        const isLight = (r + c) % 2 === 0;
        sq.className = `square ${isLight ? 'square--light' : 'square--dark'}`;
        sq.dataset.row = r;
        sq.dataset.col = c;
        sq.id = `sq-${r}-${c}`;

        // Last move highlight
        if (lastMoveFrom && lastMoveFrom.row === r && lastMoveFrom.col === c) sq.classList.add('last-move');
        if (lastMoveTo && lastMoveTo.row === r && lastMoveTo.col === c) {
          sq.classList.add('last-move');
          sq.classList.add('just-moved');
        }

        // Selected
        if (selectedSquare && selectedSquare.row === r && selectedSquare.col === c) {
          sq.classList.add('selected');
        }

        // King in check
        const piece = board[r][c];
        if (piece && piece.toLowerCase() === 'k') {
          const kingColor = pieceColor(piece);
          if (isInCheck(board, kingColor) && turn === kingColor) {
            sq.classList.add('in-check');
          }
        }

        // Piece
        if (piece) {
          const pieceEl = document.createElement('span');
          pieceEl.className = `piece ${isWhite(piece) ? 'white-piece' : 'black-piece'}`;
          pieceEl.textContent = PIECES[piece];
          sq.appendChild(pieceEl);
        }

        // Move hints (only if enabled)
        if (showHints) {
          const legalMove = legalMoves.find(m => m.row === r && m.col === c);
          if (legalMove) {
            if (legalMove.capture || legalMove.enPassant) {
              const ring = document.createElement('div');
              ring.className = 'capture-ring';
              sq.appendChild(ring);
            } else if (legalMove.castling) {
              const indicator = document.createElement('div');
              indicator.className = 'castle-indicator';
              sq.appendChild(indicator);
            } else {
              const dot = document.createElement('div');
              dot.className = 'move-dot';
              sq.appendChild(dot);
            }
          }
        }

        sq.addEventListener('click', () => handleSquareClick(r, c));
        chessBoard.appendChild(sq);
      }
    }
  }

  function renderLabels() {
    rankLabels.innerHTML = '';
    fileLabels.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const r = boardFlipped ? i : 7 - i;
      const label = document.createElement('div');
      label.className = 'rank-label';
      label.textContent = r + 1;
      rankLabels.appendChild(label);
    }
    for (let i = 0; i < 8; i++) {
      const c = boardFlipped ? 7 - i : i;
      const label = document.createElement('div');
      label.className = 'file-label';
      label.textContent = FILES[c];
      fileLabels.appendChild(label);
    }
  }

  function renderCaptured() {
    capturedByWhiteEl.innerHTML = '';
    capturedByBlackEl.innerHTML = '';

    const sortByValue = (a, b) => PIECE_VALUES[b.toLowerCase()] - PIECE_VALUES[a.toLowerCase()];

    [...capturedWhite].sort(sortByValue).forEach(p => {
      const el = document.createElement('span');
      el.className = `captured-piece ${isWhite(p) ? 'white-piece' : 'black-piece'}`;
      el.textContent = PIECES[p];
      capturedByWhiteEl.appendChild(el);
    });

    [...capturedBlack].sort(sortByValue).forEach(p => {
      const el = document.createElement('span');
      el.className = `captured-piece ${isWhite(p) ? 'white-piece' : 'black-piece'}`;
      el.textContent = PIECES[p];
      capturedByBlackEl.appendChild(el);
    });
  }

  function renderHistory() {
    historyList.innerHTML = '';
    moveHistory.forEach((move) => {
      if (move.color === 'white') {
        const numSpan = document.createElement('span');
        numSpan.className = 'history-num';
        numSpan.textContent = move.moveNum + '.';
        historyList.appendChild(numSpan);
      }
      const moveSpan = document.createElement('span');
      moveSpan.className = 'history-move';
      moveSpan.textContent = move.notation;
      historyList.appendChild(moveSpan);
    });
    historyList.scrollTop = historyList.scrollHeight;
  }

  function updateTurnIndicator() {
    const dot = turnIndicator.querySelector('.turn-dot');
    dot.className = `turn-dot turn-dot--${turn}`;
    turnText.textContent = `${turn === 'white' ? 'White' : 'Black'}'s Turn`;
  }

  function showStatusBanner(text) {
    statusBanner.style.display = 'block';
    statusText.textContent = text;
  }

  function hideStatusBanner() {
    statusBanner.style.display = 'none';
  }

  // ======== CHESS AI ENGINE (LOCAL) ========
  const PIECE_VALS = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
  };

  const pstPawn = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ];

  const pstKnight = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];

  const pstBishop = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  const pstRook = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
  ];

  const pstQueen = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  5,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ];

  const pstKing = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
  ];

  function evaluateBoard(b) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        const type = p.toLowerCase();
        let val = PIECE_VALS[type] || 0;
        
        let pstVal = 0;
        let rIdx = r;
        let cIdx = c;
        if (isBlack(p)) {
          rIdx = 7 - r; // Mirror vertically for Black
        }
        
        if (type === 'p') pstVal = pstPawn[rIdx][cIdx];
        else if (type === 'n') pstVal = pstKnight[rIdx][cIdx];
        else if (type === 'b') pstVal = pstBishop[rIdx][cIdx];
        else if (type === 'r') pstVal = pstRook[rIdx][cIdx];
        else if (type === 'q') pstVal = pstQueen[rIdx][cIdx];
        else if (type === 'k') pstVal = pstKing[rIdx][cIdx];
        
        val += pstVal;
        
        if (isWhite(p)) {
          score += val;
        } else {
          score -= val;
        }
      }
    }
    return score;
  }

  function getAllLegalMoves(b, color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c] && pieceColor(b[r][c]) === color) {
          const pieceMoves = getLegalMoves(b, r, c);
          pieceMoves.forEach(m => {
            moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col, details: m });
          });
        }
      }
    }
    return moves;
  }

  function minimax(depth, alpha, beta, isMaximizing, b) {
    if (depth === 0) {
      return { score: evaluateBoard(b) };
    }
    
    const currentColor = isMaximizing ? 'white' : 'black';
    const moves = getAllLegalMoves(b, currentColor);
    
    if (moves.length === 0) {
      const inCheck = isInCheck(b, currentColor);
      if (inCheck) {
        return { score: isMaximizing ? -Infinity : Infinity };
      } else {
        return { score: 0 };
      }
    }
    
    moves.sort((moveA, moveB) => {
      const scoreA = moveA.details.capture ? PIECE_VALS[b[moveA.toRow][moveA.toCol]?.toLowerCase() || 'p'] : 0;
      const scoreB = moveB.details.capture ? PIECE_VALS[b[moveB.toRow][moveB.toCol]?.toLowerCase() || 'p'] : 0;
      return scoreB - scoreA;
    });

    let bestMove = null;
    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const move of moves) {
        const nextBoard = cloneBoard(b);
        nextBoard[move.toRow][move.toCol] = nextBoard[move.fromRow][move.fromCol];
        nextBoard[move.fromRow][move.fromCol] = '';
        if (move.details.enPassant) {
          const capturedRow = move.toRow + 1;
          nextBoard[capturedRow][move.toCol] = '';
        }
        if (move.details.castling) {
          const cr = 7; // white
          if (move.details.castling === 'K') { nextBoard[cr][5] = nextBoard[cr][7]; nextBoard[cr][7] = ''; }
          else { nextBoard[cr][3] = nextBoard[cr][0]; nextBoard[cr][0] = ''; }
        }
        const type = nextBoard[move.toRow][move.toCol]?.toLowerCase();
        if (type === 'p' && (move.toRow === 0 || move.toRow === 7)) {
          nextBoard[move.toRow][move.toCol] = 'Q';
        }
        
        const res = minimax(depth - 1, alpha, beta, false, nextBoard);
        if (res.score > maxScore) {
          maxScore = res.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, maxScore);
        if (beta <= alpha) break;
      }
      return { score: maxScore, move: bestMove };
    } else {
      let minScore = Infinity;
      for (const move of moves) {
        const nextBoard = cloneBoard(b);
        nextBoard[move.toRow][move.toCol] = nextBoard[move.fromRow][move.fromCol];
        nextBoard[move.fromRow][move.fromCol] = '';
        if (move.details.enPassant) {
          const capturedRow = move.toRow - 1;
          nextBoard[capturedRow][move.toCol] = '';
        }
        if (move.details.castling) {
          const cr = 0; // black
          if (move.details.castling === 'K') { nextBoard[cr][5] = nextBoard[cr][7]; nextBoard[cr][7] = ''; }
          else { nextBoard[cr][3] = nextBoard[cr][0]; nextBoard[cr][0] = ''; }
        }
        const type = nextBoard[move.toRow][move.toCol]?.toLowerCase();
        if (type === 'p' && (move.toRow === 0 || move.toRow === 7)) {
          nextBoard[move.toRow][move.toCol] = 'q';
        }
        
        const res = minimax(depth - 1, alpha, beta, true, nextBoard);
        if (res.score < minScore) {
          minScore = res.score;
          bestMove = move;
        }
        beta = Math.min(beta, minScore);
        if (beta <= alpha) break;
      }
      return { score: minScore, move: bestMove };
    }
  }

  function getAIMove() {
    const isAIWhite = (aiColor === 'white');
    const moves = getAllLegalMoves(board, aiColor);
    if (moves.length === 0) return null;

    if (aiDifficulty === 'easy') {
      if (Math.random() > 0.15) {
        return moves[Math.floor(Math.random() * moves.length)];
      } else {
        const captures = moves.filter(m => m.details.capture);
        if (captures.length > 0) {
          return captures[Math.floor(Math.random() * captures.length)];
        }
        return moves[Math.floor(Math.random() * moves.length)];
      }
    }

    const depth = aiDifficulty === 'medium' ? 2 : 3;
    const moveScores = [];
    const alpha = -Infinity;
    const beta = Infinity;

    for (const move of moves) {
      const nextBoard = cloneBoard(board);
      nextBoard[move.toRow][move.toCol] = nextBoard[move.fromRow][move.fromCol];
      nextBoard[move.fromRow][move.fromCol] = '';
      if (move.details.enPassant) {
        const capturedRow = aiColor === 'white' ? move.toRow + 1 : move.toRow - 1;
        nextBoard[capturedRow][move.toCol] = '';
      }
      if (move.details.castling) {
        const cr = aiColor === 'white' ? 7 : 0;
        if (move.details.castling === 'K') { nextBoard[cr][5] = nextBoard[cr][7]; nextBoard[cr][7] = ''; }
        else { nextBoard[cr][3] = nextBoard[cr][0]; nextBoard[cr][0] = ''; }
      }
      const type = nextBoard[move.toRow][move.toCol]?.toLowerCase();
      if (type === 'p' && (move.toRow === 0 || move.toRow === 7)) {
        nextBoard[move.toRow][move.toCol] = aiColor === 'white' ? 'Q' : 'q';
      }

      const res = minimax(depth - 1, alpha, beta, !isAIWhite, nextBoard);
      moveScores.push({ move, score: res.score });
    }

    // Find best score
    let bestScore = isAIWhite ? -Infinity : Infinity;
    for (const ms of moveScores) {
      if (isAIWhite) {
        if (ms.score > bestScore) bestScore = ms.score;
      } else {
        if (ms.score < bestScore) bestScore = ms.score;
      }
    }

    // Filter moves within threshold of the best score
    // Use a wider threshold in the opening to prevent copycat/symmetrical behavior
    const threshold = (moveCount <= 12) ? 60 : 20;
    const candidates = moveScores.filter(ms => {
      if (isAIWhite) {
        return ms.score >= bestScore - threshold;
      } else {
        return ms.score <= bestScore + threshold;
      }
    });

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.move;
  }

  function triggerAIMove() {
    if (gameOver || turn !== aiColor) return;
    
    turnText.textContent = `Computer is thinking...`;
    
    const delay = 400 + Math.random() * 450;
    setTimeout(() => {
      if (gameOver || turn !== aiColor) return;
      const aiMove = getAIMove();
      if (aiMove) {
        legalMoves = getLegalMoves(board, aiMove.fromRow, aiMove.fromCol);
        
        const isPawn = board[aiMove.fromRow][aiMove.fromCol].toLowerCase() === 'p';
        const promotePiece = (isPawn && (aiMove.toRow === 0 || aiMove.toRow === 7)) ? 'q' : null;
        
        makeMove(aiMove.fromRow, aiMove.fromCol, aiMove.toRow, aiMove.toCol, promotePiece);
      }
    }, delay);
  }

  // ======== CLICK HANDLER ========
  function handleSquareClick(row, col) {
    if (gameOver) return;
    if (isVsComputer && turn === aiColor) return;

    const piece = board[row][col];

    // If a legal move target is clicked
    if (selectedSquare && legalMoves.some(m => m.row === row && m.col === col)) {
      const fromRow = selectedSquare.row;
      const fromCol = selectedSquare.col;
      const result = makeMove(fromRow, fromCol, row, col);
      if (result === 'promote') {
        showPromotionDialog();
      }
      return;
    }

    // If clicking own piece
    if (piece && pieceColor(piece) === turn) {
      if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
        selectedSquare = null;
        legalMoves = [];
      } else {
        selectedSquare = { row, col };
        legalMoves = getLegalMoves(board, row, col);
        AudioEngine.play('select');
      }
      renderBoard();
      return;
    }

    // Clicking empty or opponent piece without valid selection
    if (selectedSquare) {
      AudioEngine.play('illegal');
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
    }
  }

  // ======== PROMOTION ========
  function showPromotionDialog() {
    if (!pendingPromotion) return;
    const { fromRow, fromCol, toRow, toCol, piece, captured, color, type, isCastleType, isEP } = pendingPromotion;

    promotionOverlay.style.display = 'flex';
    promotionChoices.innerHTML = '';

    const choices = color === 'white' ? ['Q','R','B','N'] : ['q','r','b','n'];
    choices.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'promotion-choice';
      btn.textContent = PIECES[p];
      btn.addEventListener('click', () => {
        promotionOverlay.style.display = 'none';
        const promoteTo = p.toLowerCase();
        board[toRow][toCol] = color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        AudioEngine.play('promote');
        completeMove(fromRow, fromCol, toRow, toCol, piece, captured, color, type, isCastleType, isEP, promoteTo);
        pendingPromotion = null;
      });
      promotionChoices.appendChild(btn);
    });
  }

  // ======== RESULTS ========
  function showResults(winnerColor, reason) {
    setTimeout(() => {
      resultsOverlay.style.display = 'flex';
      switch (reason) {
        case 'checkmate':
          resultsEmoji.textContent = '👑';
          resultsHeadline.textContent = 'Checkmate!';
          resultsSub.textContent = `${winnerColor === 'white' ? 'White' : 'Black'} Wins!`;
          break;
        case 'stalemate-win':
          resultsEmoji.textContent = '👑';
          resultsHeadline.textContent = 'Stalemate Victory!';
          resultsSub.textContent = `${winnerColor === 'white' ? 'White' : 'Black'} Wins by Stalemate!`;
          break;
        case 'material-win':
          resultsEmoji.textContent = '🏆';
          resultsHeadline.textContent = 'Material Victory!';
          resultsSub.textContent = `${winnerColor === 'white' ? 'White' : 'Black'} Wins by capturing all pieces!`;
          break;
        case 'stalemate':
          resultsEmoji.textContent = '🤝';
          resultsHeadline.textContent = 'Stalemate!';
          resultsSub.textContent = "It's a Draw!";
          break;
        case 'time':
          resultsEmoji.textContent = '⏱️';
          resultsHeadline.textContent = "Time's Up!";
          resultsSub.textContent = `${winnerColor === 'white' ? 'White' : 'Black'} Wins on Time!`;
          break;
        case 'resign':
          resultsEmoji.textContent = '🏳️';
          resultsHeadline.textContent = 'Resignation';
          resultsSub.textContent = `${winnerColor === 'white' ? 'White' : 'Black'} Wins!`;
          break;
        case 'agreed-draw':
          resultsEmoji.textContent = '🤝';
          resultsHeadline.textContent = 'Draw Agreed';
          resultsSub.textContent = 'Both players agreed to a draw.';
          break;
        case 'insufficient':
          resultsEmoji.textContent = '🤝';
          resultsHeadline.textContent = 'Insufficient Material';
          resultsSub.textContent = "Neither player can checkmate. It's a draw!";
          break;
        case 'fifty-move':
          resultsEmoji.textContent = '🤝';
          resultsHeadline.textContent = '50-Move Rule';
          resultsSub.textContent = '50 moves without a capture or pawn move. Draw!';
          break;
        case 'repetition':
          resultsEmoji.textContent = '🔄';
          resultsHeadline.textContent = 'Threefold Repetition';
          resultsSub.textContent = 'Same position occurred three times. Draw!';
          break;
      }
    }, 600);
  }

  // ======== CONFIRM DIALOG ========
  function showConfirm(emoji, title, msg, onYes) {
    $('confirmEmoji').textContent = emoji;
    $('confirmTitle').textContent = title;
    $('confirmMsg').textContent = msg;
    confirmCallback = onYes;
    confirmOverlay.style.display = 'flex';
  }

  function hideConfirm() {
    confirmOverlay.style.display = 'none';
    confirmCallback = null;
  }

  // ======== TIMER ========
  function startTimer() {
    if (!useTimer) return;
    timerDisplay.style.display = 'flex';
    whiteTime = timerSeconds;
    blackTime = timerSeconds;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      if (gameOver) { stopTimer(); return; }
      if (turn === 'white') {
        whiteTime--;
        if (whiteTime <= 0) {
          whiteTime = 0;
          gameOver = true;
          stopTimer();
          AudioEngine.play('checkmate');
          showResults('black', 'time');
        } else if (whiteTime <= 10) {
          AudioEngine.play('tick');
        }
      } else {
        blackTime--;
        if (blackTime <= 0) {
          blackTime = 0;
          gameOver = true;
          stopTimer();
          AudioEngine.play('checkmate');
          showResults('white', 'time');
        } else if (blackTime <= 10) {
          AudioEngine.play('tick');
        }
      }
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerDisplay() {
    const fmt = s => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    whiteTimerEl.textContent = fmt(whiteTime);
    blackTimerEl.textContent = fmt(blackTime);
    whiteTimerEl.classList.toggle('timer-low', whiteTime <= 30);
    blackTimerEl.classList.toggle('timer-low', blackTime <= 30);
  }

  // ======== BOARD THEME ========
  function applyTheme(themeName) {
    currentTheme = themeName;
    document.body.setAttribute('data-theme', themeName === 'classic' ? '' : themeName);
    if (themeName === 'classic') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', themeName);

    // Update swatch selection in both grids
    document.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.theme === themeName);
    });
  }

  // ======== SETTINGS DRAWER ========
  function openDrawer() {
    settingsDrawer.style.display = 'block';
    // Sync drawer state
    $('drawerHints').checked = showHints;
    $('drawerSound').checked = AudioEngine.enabled;
  }

  function closeDrawer() {
    settingsDrawer.style.display = 'none';
  }

  // ======== INIT ========
  function initGame() {
    board = INITIAL_BOARD.map(row => [...row]);
    turn = 'white';
    selectedSquare = null;
    legalMoves = [];
    moveHistory = [];
    capturedWhite = [];
    capturedBlack = [];
    lastMoveFrom = null;
    lastMoveTo = null;
    gameOver = false;
    moveCount = 0;
    castling = { K: true, Q: true, k: true, q: true };
    enPassantTarget = null;
    halfMoveClock = 0;
    positionHistory = [];
    stateStack = [];
    pendingPromotion = null;

    // Record initial position
    positionHistory.push(boardHash());

    undoBtn.disabled = true;
    stopTimer();

    renderLabels();
    renderAll();
    hideStatusBanner();

    if (useTimer) startTimer();
  }

  // ======== EVENT LISTENERS ========

  // Timer option selection
  // Toggle AI Settings panel based on opponent selection
  const oppRadios = document.querySelectorAll('input[name="opponent"]');
  const aiSettingsPanel = $('aiSettings');
  
  oppRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (aiSettingsPanel) {
        aiSettingsPanel.style.display = radio.value === 'computer' ? 'block' : 'none';
      }
    });
  });

  // Option selection (scoped to siblings in parent element)
  document.querySelectorAll('.timer-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const parent = opt.parentElement;
      parent.querySelectorAll('.timer-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  // Theme swatches — both setup and drawer
  document.querySelectorAll('.theme-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      applyTheme(sw.dataset.theme);
      renderBoard(); // refresh board with new colors
    });
  });

  // Start button
  $('startBtn').addEventListener('click', () => {
    AudioEngine.init();

    const selectedTimer = document.querySelector('input[name="timer"]:checked');
    timerSeconds = parseInt(selectedTimer.value) || 0;
    useTimer = timerSeconds > 0;

    showHints = $('setupHints').checked;
    AudioEngine.enabled = $('setupSound').checked;

    // Load AI options
    const oppVal = document.querySelector('input[name="opponent"]:checked').value;
    isVsComputer = (oppVal === 'computer');
    if (isVsComputer) {
      aiDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
      const playAsVal = document.querySelector('input[name="playAs"]:checked').value;
      if (playAsVal === 'random') {
        playerColor = Math.random() < 0.5 ? 'white' : 'black';
      } else {
        playerColor = playAsVal;
      }
      aiColor = opponentColor(playerColor);
      boardFlipped = (playerColor === 'black');
    } else {
      isVsComputer = false;
      boardFlipped = false;
    }

    setupOverlay.style.display = 'none';
    gameArea.style.display = 'flex';

    initGame();
    AudioEngine.play('gamestart');

    if (isVsComputer && aiColor === 'white') {
      triggerAIMove();
    }
  });

  // Menu button
  $('menuBtn').addEventListener('click', () => {
    gameOver = true;
    stopTimer();
    gameArea.style.display = 'none';
    resultsOverlay.style.display = 'none';
    setupOverlay.style.display = 'flex';
  });

  // Play again
  $('playAgainBtn').addEventListener('click', () => {
    resultsOverlay.style.display = 'none';
    initGame();
    if (isVsComputer && aiColor === 'white') {
      triggerAIMove();
    }
  });

  // Back to menu from results
  $('backToMenuBtn').addEventListener('click', () => {
    resultsOverlay.style.display = 'none';
    gameArea.style.display = 'none';
    setupOverlay.style.display = 'flex';
  });

  // Undo button
  undoBtn.addEventListener('click', () => undoMove());

  // Flip board button
  $('flipBtn').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    renderLabels();
    renderBoard();
  });

  // Resign button
  $('resignBtn').addEventListener('click', () => {
    if (gameOver) return;
    const loser = turn === 'white' ? 'White' : 'Black';
    showConfirm('🏳️', `${loser} Resigns?`, `${loser} will forfeit this game. Are you sure?`, () => {
      gameOver = true;
      stopTimer();
      showResults(opponentColor(turn), 'resign');
    });
  });

  // Draw button
  $('drawBtn').addEventListener('click', () => {
    if (gameOver) return;
    
    if (isVsComputer) {
      showConfirm('🤝', 'Offer Draw?', 'Offer a draw to the computer?', () => {
        let accept = false;
        const evalScore = evaluateBoard(board);
        const aiScore = aiColor === 'white' ? evalScore : -evalScore;
        
        if (aiDifficulty === 'easy') {
          accept = Math.random() < 0.5;
        } else if (aiDifficulty === 'medium') {
          accept = aiScore <= 150;
        } else {
          accept = aiScore <= -300;
        }
        
        if (accept) {
          gameOver = true;
          stopTimer();
          AudioEngine.play('draw');
          showResults(null, 'agreed-draw');
        } else {
          showConfirm('🤖', 'Draw Declined', 'The computer declines your draw offer.', () => {});
        }
      });
      return;
    }

    const asker = turn === 'white' ? 'White' : 'Black';
    const opp = turn === 'white' ? 'Black' : 'White';
    showConfirm('🤝', 'Offer Draw?', `${asker} is offering a draw. ${opp}, do you accept?`, () => {
      gameOver = true;
      stopTimer();
      AudioEngine.play('draw');
      showResults(null, 'agreed-draw');
    });
  });

  // Settings button
  $('settingsBtn').addEventListener('click', () => openDrawer());

  // Drawer close
  $('drawerClose').addEventListener('click', closeDrawer);
  $('drawerBackdrop').addEventListener('click', closeDrawer);

  // Drawer toggles
  $('drawerHints').addEventListener('change', (e) => {
    showHints = e.target.checked;
    $('setupHints').checked = showHints;
    renderBoard();
  });

  $('drawerSound').addEventListener('change', (e) => {
    AudioEngine.enabled = e.target.checked;
    $('setupSound').checked = AudioEngine.enabled;
  });

  // Confirm dialog
  $('confirmYes').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    hideConfirm();
  });

  $('confirmNo').addEventListener('click', hideConfirm);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (confirmOverlay.style.display === 'flex') { hideConfirm(); return; }
      if (settingsDrawer.style.display === 'block') { closeDrawer(); return; }
      if (promotionOverlay.style.display === 'flex') return;
      selectedSquare = null;
      legalMoves = [];
      renderBoard();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undoMove();
    }
  });

})();
