'use strict';

// ─────────────────────────────────────────────
// Audio Engine
// ─────────────────────────────────────────────
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sfx = {
  resume: () => { if (audioCtx.state === 'suspended') audioCtx.resume(); },
  playTone: (freq, type, dur, vol=0.1) => {
    try {
      Sfx.resume();
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type   = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch(e) {}
  },
  correct: () => {
    Sfx.playTone(600, 'sine', 0.1, 0.1);
    setTimeout(() => Sfx.playTone(800, 'sine', 0.15, 0.1), 100);
  },
  wrong: ()   => Sfx.playTone(200, 'sawtooth', 0.3, 0.1),
  snap: ()    => Sfx.playTone(100, 'triangle', 0.3, 0.4),
  build: ()   => Sfx.playTone(400, 'square', 0.05, 0.05),
  win: ()     => {
    Sfx.playTone(400, 'sine', 0.15, 0.1);
    setTimeout(() => Sfx.playTone(500, 'sine', 0.15, 0.1), 150);
    setTimeout(() => Sfx.playTone(600, 'sine', 0.4, 0.1), 300);
  }
};

// ─────────────────────────────────────────────
// Bridge Physics & Game State
// ─────────────────────────────────────────────
const CW = 1200;
const CH = 500;
const GRID = 50;

class BrainBridge {
  constructor() {
    this.canvas = document.getElementById('bridgeCanvas');
    this.ctx    = this.canvas.getContext('2d');
    
    // UI Elements
    this.mathProblem  = document.getElementById('mathProblem');
    this.mathInput    = document.getElementById('mathInput');
    this.mathFeedback = document.getElementById('mathFeedback');
    
    // Inventory
    this.inv = { wood: 3, steel: 1, road: 4 };
    this.activeMat = 'road'; // default
    
    // Physics
    this.nodes = [];
    this.edges = [];
    this.sparks = [];
    
    // Interaction
    this.hoverGrid = null;
    this.hoverNode = null;
    this.dragStart = null;
    
    // Mission State
    this.state = 'setup'; // setup, build, test, end
    this.currentAnswer = 0;
    this.mathMode = 'mult';
    
    // Truck testing
    this.truck = { x: 0, y: 0, active: false };
    
    this._bindEvents();
    this._initWorld();
    requestAnimationFrame((ts) => this._loop(ts));
  }

  // ── INIT WORLD ──
  _initWorld() {
    this.nodes = [];
    this.edges = [];
    this.sparks = [];
    this.inv = { wood: 15, steel: 8, road: 14 }; // Increased starting bits
    this.updateInventoryUI();
    
    // Left Cliff Anchors (extended to x=350)
    for(let x=50; x<=350; x+=50) {
      this._addNode(x, 250, true);
      this._addNode(x, 300, true);
    }

    // Right Cliff Anchors (extended from x=850)
    for(let x=850; x<=1150; x+=50) {
      this._addNode(x, 250, true);
      this._addNode(x, 300, true);
    }

    // Initial basic support
    this._addEdge(this._getNode(300,250), this._getNode(350,250), 'road');
    this._addEdge(this._getNode(350,300), this._getNode(350,250), 'wood');
    
    this._addEdge(this._getNode(900,250), this._getNode(850,250), 'road');
    this._addEdge(this._getNode(850,300), this._getNode(850,250), 'wood');
  }

  _addNode(x, y, pinned=false) {
    let n = this._getNode(x, y);
    if(n) return n;
    n = { x, y, ox: x, oy: y, targetX: x, targetY: y, pinned, id: Math.random() };
    this.nodes.push(n);
    return n;
  }
  
  _getNode(x, y) {
    return this.nodes.find(n => Math.abs(n.x - x) < 5 && Math.abs(n.y - y) < 5);
  }

  _addEdge(n1, n2, type) {
    if(n1 === n2) return null;
    // Check if exists
    const exists = this.edges.find(e => (e.n1===n1 && e.n2===n2) || (e.n1===n2 && e.n2===n1));
    if(exists) return null;
    
    const e = { n1, n2, type, baseLen: Math.hypot(n1.x-n2.x, n1.y-n2.y), broken: false };
    this.edges.push(e);
    return e;
  }

  // ── EVENTS ──
  _bindEvents() {
    // UI Events
    document.getElementById('startMissionBtn').addEventListener('click', () => {
      this.mathMode = document.getElementById('mathMode').value;
      document.getElementById('gameSetup').style.display = 'none';
      this.state = 'build';
      this._generateMath();
      this.mathInput.focus();
      document.getElementById('testBridgeBtn').disabled = false;
      Sfx.resume();
    });

    document.getElementById('resetBridgeBtn').addEventListener('click', () => {
      this._initWorld();
      this.truck.active = false;
      this.state = 'build';
    });
    
    document.getElementById('testBridgeBtn').addEventListener('click', () => {
      this.state = 'test';
      this.truck.active = true;
      this.truck.x = 280;
      this.truck.y = 230;
      this.truck.failTimer = 0;
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
      document.getElementById('gameEnd').style.display = 'none';
      this._initWorld();
      this.state = 'build';
      this.truck.active = false;
    });

    // Inventory selection
    ['wood', 'steel', 'road'].forEach(type => {
      document.getElementById(`inv-${type}`).addEventListener('click', (e) => {
        document.querySelectorAll('.inv-item').forEach(el => el.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeMat = type;
      });
    });

    // Math submission
    this.mathInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') this._checkMath();
    });

    // Canvas Mouse Events
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mouseup',   (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave',() => { this.hoverGrid = null; this.dragStart = null; });
  }

  // ── BUILDER INTERACTION ──
  _getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  _onMouseMove(e) {
    if(this.state !== 'build') return;
    const pos = this._getMousePos(e);
    // snap to grid
    const gx = Math.round(pos.x / GRID) * GRID;
    const gy = Math.round(pos.y / GRID) * GRID;
    this.hoverGrid = { x: gx, y: gy };
    this.hoverNode = this._getNode(gx, gy);
  }

  _onMouseDown(e) {
    if(this.state !== 'build' || !this.hoverGrid) return;
    if(this.inv[this.activeMat] <= 0) {
      this._floatingText("No pieces!", this.hoverGrid.x, this.hoverGrid.y, '#e84040');
      Sfx.wrong();
      return;
    }
    this.dragStart = this.hoverNode || { x: this.hoverGrid.x, y: this.hoverGrid.y };
  }

  _onMouseUp(e) {
    if(this.state !== 'build' || !this.dragStart || !this.hoverGrid) return;
    
    const dx = this.hoverGrid.x - this.dragStart.x;
    const dy = this.hoverGrid.y - this.dragStart.y;
    const dist = Math.hypot(dx, dy);
    
    // Validations
    if(dist < 10) { this.dragStart = null; return; } // clicked same spot
    
    const MAX_LEN = this.activeMat === 'steel' ? GRID * 5.5 : GRID * 4.5;
    if(dist > MAX_LEN) {
      this._floatingText("Too far!", this.hoverGrid.x, this.hoverGrid.y, '#e84040');
      Sfx.wrong();
      this.dragStart = null;
      return;
    }

    if(this.activeMat === 'road' && Math.abs(dy) > 10) {
      this._floatingText("Roads must be flat!", this.hoverGrid.x, this.hoverGrid.y, '#e84040');
      Sfx.wrong();
      this.dragStart = null;
      return;
    }

    // Creating edge
    // Must attach to an existing node somewhere!
    const n1 = this._getNode(this.dragStart.x, this.dragStart.y);
    const n2 = this.hoverNode;
    
    if(!n1 && !n2) {
      this._floatingText("Must attach to bridge!", this.hoverGrid.x, this.hoverGrid.y, '#e84040');
      Sfx.wrong();
      this.dragStart = null;
      return;
    }

    const nodeA = n1 || this._addNode(this.dragStart.x, this.dragStart.y);
    const nodeB = n2 || this._addNode(this.hoverGrid.x, this.hoverGrid.y);

    const edge = this._addEdge(nodeA, nodeB, this.activeMat);
    if(edge) {
      this.inv[this.activeMat]--;
      this.updateInventoryUI();
      Sfx.build();
    }
    
    this.dragStart = null;
  }

  // ── SOLVER STATION ──
  _generateMath() {
    let a, b, op;
    if(this.mathMode === 'add') {
      op = Math.random() > 0.5 ? '+' : '-';
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      if(op === '-' && b > a) { let t = a; a = b; b = t; }
      this.currentAnswer = op === '+' ? a + b : a - b;
    } else if(this.mathMode === 'mult') {
      op = Math.random() > 0.4 ? '×' : '÷';
      if(op === '×') {
        a = Math.floor(Math.random() * 11) + 2;
        b = Math.floor(Math.random() * 11) + 2;
        this.currentAnswer = a * b;
      } else {
        b = Math.floor(Math.random() * 11) + 2;
        this.currentAnswer = Math.floor(Math.random() * 11) + 2;
        a = this.currentAnswer * b;
      }
    } else {
      // Mixed - simple coordinates or angles for variety (faked as numbers)
      const types = ['add', 'mult', 'angle'];
      const t = types[Math.floor(Math.random()*types.length)];
      if(t==='add') { a = Math.floor(Math.random()*100); b = Math.floor(Math.random()*100); op = '+'; this.currentAnswer = a+b; }
      else if(t==='mult') { a = Math.floor(Math.random()*12); b = Math.floor(Math.random()*12); op = '×'; this.currentAnswer = a*b; }
      else {
        a = [90, 180, 45, 360][Math.floor(Math.random()*4)];
        this.mathProblem.textContent = `A right angle = ? °`;
        this.currentAnswer = 90;
        this.mathInput.value = '';
        return;
      }
    }
    this.mathProblem.textContent = `${a} ${op} ${b} = ?`;
    this.mathInput.value = '';
  }

  _checkMath() {
    const val = parseInt(this.mathInput.value, 10);
    if(val === this.currentAnswer) {
      Sfx.correct();
      this.mathFeedback.textContent = "Correct! Sending 3 pieces...";
      this.mathFeedback.className = "feedback-text good";
      // Random piece weight: 50% wood, 30% road, 20% steel
      for(let i=0; i<3; i++) {
        const r = Math.random();
        const type = r < 0.5 ? 'wood' : r < 0.8 ? 'road' : 'steel';
        this.inv[type]++;
      }
      this.updateInventoryUI();
      
      this.mathProblem.textContent = "CORRECT!";
      setTimeout(() => {
        this.mathFeedback.textContent = "Type and press Enter";
        this.mathFeedback.className = "feedback-text";
        this._generateMath();
      }, 800);
    } else {
      Sfx.wrong();
      this.mathFeedback.textContent = "Incorrect. Try again!";
      this.mathFeedback.className = "feedback-text bad";
      this.mathInput.value = '';
      this.mathInput.classList.add('shake');
      setTimeout(() => this.mathInput.classList.remove('shake'), 400);
    }
  }

  updateInventoryUI() {
    document.getElementById('count-wood').textContent = this.inv.wood;
    document.getElementById('count-steel').textContent = this.inv.steel;
    document.getElementById('count-road').textContent = this.inv.road;
    
    // auto switch if out
    if(this.inv[this.activeMat] <= 0) {
      if(this.inv.wood > 0) document.getElementById('inv-wood').click();
      else if(this.inv.road > 0) document.getElementById('inv-road').click();
      else if(this.inv.steel > 0) document.getElementById('inv-steel').click();
    }
  }

  _floatingText(msg, x, y, col) {
    this.sparks.push({ text: msg, x, y, life: 1.0, col });
  }
  
  _emitBreakSparks(x, y) {
    for(let i=0; i<8; i++) {
      this.sparks.push({
        x, y,
        vx: (Math.random()-0.5)*150,
        vy: (Math.random()-0.5)*150,
        life: 0.5 + Math.random()*0.5,
        col: '#ff4d4d',
        size: 3 + Math.random()*3
      });
    }
  }

  _calcSupportStrength() {
    for(let n of this.nodes) { n.connected = false; n.supportDist = 999; }
    let queue = this.nodes.filter(n => n.pinned);
    for(let q of queue) { q.connected = true; q.supportDist = 0; }
    
    // BFS to find structural path cost to cliffs
    while(queue.length > 0) {
      let curr = queue.shift();
      let neighbors = [];
      for(let e of this.edges) {
        if(!e.broken) {
          let cost = (e.baseLen / GRID) * (e.type==='steel'? 0.5 : e.type==='wood'? 0.9 : 1.4);
          if(e.n1 === curr) neighbors.push({n: e.n2, dist: cost});
          if(e.n2 === curr) neighbors.push({n: e.n1, dist: cost});
        }
      }
      for(let edgeInfo of neighbors) {
        let neighbor = edgeInfo.n;
        let alt = curr.supportDist + edgeInfo.dist;
        if(alt < neighbor.supportDist) {
           neighbor.supportDist = alt;
           neighbor.connected = true;
           queue.push(neighbor);
        }
      }
    }
  }

  // ── PHYSICS PHYSICS PHYSICS ──
  _updatePhysics(dt) {
    this._calcSupportStrength();

    // 1. Apply Forces
    for(let n of this.nodes) {
      if(n.pinned) {
        n.x = n.targetX; n.y = n.targetY; 
        continue;
      }
      
      let extraG = 0;
      // Truck weight applied to nearby nodes ONLY DURING TEST
      if(this.state === 'test' && this.truck.active && Math.abs(n.x - this.truck.x) < 65) {
        extraG = 4.0; // very heavy load from truck
      }

      let vx = (n.x - n.ox) * 0.85; // high dampening for stability
      let vy = (n.y - n.oy) * 0.85;
      n.ox = n.x;
      n.oy = n.y;
      
      if(n.connected) {
         // ARCADE RIGIDITY: The structure holds its shape based on how well it's supported!
         // A strong support path (low supportDist) means it perfectly holds its target grid spot.
         let str = Math.max(0, 1.0 - (n.supportDist / 12.0)); 
         let rigidity = str * 0.35 + 0.05; // Base 5% rigidity so it always somewhat holds shape
         
         n.x += vx + (n.targetX - n.x) * rigidity;
         n.y += vy + (n.targetY - n.y) * rigidity + extraG;
      } else {
         // Disconnected pieces fall out of the sky
         n.x += vx;
         n.y += vy + 0.8;
      }
    }

    // 2. Solve Constraints
    for(let i=0; i<10; i++) {
      for(let e of this.edges) {
        let dx = e.n2.x - e.n1.x;
        let dy = e.n2.y - e.n1.y;
        let dist = Math.hypot(dx, dy);
        if(dist === 0) dist = 0.01;
        let diff = dist - e.baseLen;
        let p = (diff / dist) / 2;
        let ox = dx * p;
        let oy = dy * p;

        let stiff = e.type === 'steel' ? 0.9 : e.type === 'wood' ? 0.45 : 0.6;
        
        if(!e.n1.pinned) { e.n1.x += ox * stiff; e.n1.y += oy * stiff; }
        if(!e.n2.pinned) { e.n2.x -= ox * stiff; e.n2.y -= oy * stiff; }

        // Break limit map (buffed to make game easier)
        const breaks = { 'steel': 0.60, 'wood': 0.35, 'road': 0.25 };
        if(this.state === 'test' && Math.abs(diff) > e.baseLen * breaks[e.type]) {
           e.broken = true;
           Sfx.snap();
           this._emitBreakSparks((e.n1.x+e.n2.x)/2, (e.n1.y+e.n2.y)/2);
        }
      }
      this.edges = this.edges.filter(e => !e.broken);
    }
  }

  // ── UPDATE LOOP ──
  _update(dt) {
    if(this.state === 'setup') return;

    // Sparks
    this.sparks = this.sparks.filter(s => {
      s.life -= dt;
      if(s.text) s.y -= 25*dt;
      else {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 400 * dt; // gravity
      }
      return s.life > 0;
    });

    this._updatePhysics(dt);

    if(this.state === 'test' && this.truck.active) {
      // Truck moves right slowly
      this.truck.x += 60 * dt;
      
      // Calculate truck Y based on road pieces near X
      let closestRoads = this.edges.filter(e => e.type==='road' && 
         ((e.n1.x <= this.truck.x && e.n2.x >= this.truck.x) || (e.n2.x <= this.truck.x && e.n1.x >= this.truck.x)));
      
      let ty = Infinity;
      if(closestRoads.length > 0) {
        let r = closestRoads[0];
        // interpolate Y
        let p = (this.truck.x - Math.min(r.n1.x, r.n2.x)) / Math.abs(r.n1.x - r.n2.x);
        let ly = r.n1.x < r.n2.x ? r.n1.y : r.n2.y;
        let ry = r.n1.x < r.n2.x ? r.n2.y : r.n1.y;
        ty = ly + (ry - ly)*p - 15; // 15px above road
      } else {
        // Falling
        ty = this.truck.y + 250*dt;
      }
      
      this.truck.y += (ty - this.truck.y) * 0.2; // smooth catchup

      if(this.truck.y > 350) {
        // Failed
        this.truck.failTimer += dt;
        if(this.truck.failTimer > 1.5) {
          document.getElementById('endTitle').textContent = "Bridge Collapsed!";
          document.getElementById('endTitle').style.color = "#e84040";
          document.getElementById('endMessage').textContent = "The rescue truck didn't make it. Back to the drawing board!";
          document.getElementById('gameEnd').style.display = 'flex';
          Sfx.wrong();
          this.state = 'end';
        }
      } else if(this.truck.x > 850) {
        // Win!
        document.getElementById('endTitle').textContent = "Bridge Holds!";
        document.getElementById('endTitle').style.color = "#2ec97a";
        document.getElementById('endMessage').textContent = "Incredible engineering! The rescue truck crossed safely!";
        document.getElementById('gameEnd').style.display = 'flex';
        Sfx.win();
        this.state = 'end';
        this.truck.active = false;
      }
    }
  }

  // ── DRAWING ──
  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0,0,CW,CH);

    // Canyon Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(350, 300, 500, 200); // the gap
    
    // Cliffs (Snapping to grid)
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 250, 350, 250);   // Left cliff
    ctx.fillRect(850, 250, 350, 250); // Right cliff

    // Grid dots
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for(let x=350; x<=850; x+=GRID) {
      for(let y=50; y<=400; y+=GRID) {
        ctx.beginPath(); ctx.arc(x,y, 3, 0, Math.PI*2); ctx.fill();
      }
    }

    // Hover UI
    if(this.hoverGrid && this.state === 'build') {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(this.hoverGrid.x, this.hoverGrid.y, 10, 0, Math.PI*2); ctx.fill();
    }
    if(this.dragStart && this.hoverGrid && this.state === 'build') {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.setLineDash([5,5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.dragStart.x, this.dragStart.y);
      ctx.lineTo(this.hoverGrid.x, this.hoverGrid.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Edges
    for(let e of this.edges) {
      ctx.beginPath();
      ctx.moveTo(e.n1.x, e.n1.y);
      ctx.lineTo(e.n2.x, e.n2.y);
      if(e.type === 'wood') {
        ctx.strokeStyle = '#c07b46'; ctx.lineWidth = 6;
      } else if(e.type === 'steel') {
        ctx.strokeStyle = '#8a9ba8'; ctx.lineWidth = 4;
      } else if(e.type === 'road') {
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 12;
      }
      ctx.stroke();
      
      // Road dash
      if(e.type === 'road') {
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.setLineDash([10,10]);
        ctx.stroke(); ctx.setLineDash([]);
      }
    }

    // Draw Nodes
    ctx.fillStyle = '#fff';
    for(let n of this.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.pinned ? 5 : 4, 0, Math.PI*2);
      ctx.fillStyle = n.pinned ? '#e84040' : '#475569';
      ctx.fill();
    }

    // Truck
    if(this.truck.active) {
      ctx.fillStyle = '#f5a623';
      ctx.fillRect(this.truck.x - 20, this.truck.y - 20, 50, 30);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(this.truck.x, this.truck.y+10, 8, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(this.truck.x+30, this.truck.y+10, 8, 0, Math.PI*2); ctx.fill();
    }

    // Sparks
    for(let s of this.sparks) {
      if(s.text) {
        ctx.fillStyle = s.col;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = s.life;
        ctx.fillText(s.text, s.x, s.y);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  _loop(ts) {
    const dt = Math.min((ts - (this.lastTs||ts)) / 1000, 0.05);
    this.lastTs = ts;
    this._update(dt);
    this._draw();
    requestAnimationFrame((ts) => this._loop(ts));
  }
}

window.addEventListener('DOMContentLoaded', () => { new BrainBridge(); });
