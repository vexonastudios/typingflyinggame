'use strict';

// ═══════════════════════════════════════════════════════════
//  DAVID & THE LIONS — Biblical Raycasting Survival  v1.0
//  Single-player wave survival, adapted from Nerf Arena v4.0
//  David vs Wolves (1 HP) and Lions (3 HP) — trust in the Lord!
// ═══════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────
const D_FOV        = Math.PI / 2.2;   // ~82°
const D_HALF_FOV   = D_FOV / 2;
const D_MOVE_SPD   = 3.0;
const D_TURN_SPD   = 1.75;
const D_ACCEL      = 12.0;
const D_STONE_LO   = 9.0;
const D_STONE_HI   = 20.0;
const D_CHARGE_RT  = 0.67;   // charge rate (1/sec → full in ~1.5 s)
const D_WALL_MRG   = 0.28;
const D_MAX_HP     = 5;
const D_INVINCIBLE = 1.6;    // post-hit grace period
const D_MAP_SIZE   = 20;

// ─── Pre-rendered 3D Sprites ─────────────────────────────────
const wolfImg = new Image();
wolfImg.src = 'wolf.png';
const lionImg = new Image();
lionImg.src = 'lion.png';

let wolfCanvas = null;
let lionCanvas = null;

function processSpriteImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i] > 200 && data.data[i+1] < 50 && data.data[i+2] > 200) {
      data.data[i+3] = 0;
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

wolfImg.onload = () => { wolfCanvas = processSpriteImage(wolfImg); };
lionImg.onload = () => { lionCanvas = processSpriteImage(lionImg); };

// ─── Enemy Configs ───────────────────────────────────────────
const ECFG = {
  wolf: { hp:1, speed:2.5, size:0.25, points:10,
          atRng:0.65, atDmg:1, atCd:1.4, turnRate:4.5,
          bodyR:95, bodyG:115, bodyB:125,
          eyeR:255, eyeG:220, eyeB:50 },
  lion: { hp:3, speed:1.6, size:0.40, points:30,
          atRng:0.85, atDmg:2, atCd:2.0, turnRate:2.5,
          bodyR:200, bodyG:165, bodyB:90,
          eyeR:255, eyeG:100, eyeB:30 },
};

// ─── Waves (6 total) ──────────────────────────────────────────
const WAVES = [
  [{type:'wolf',count:2}],
  [{type:'wolf',count:3}],
  [{type:'wolf',count:2},{type:'lion',count:1}],
  [{type:'wolf',count:3},{type:'lion',count:1}],
  [{type:'wolf',count:4},{type:'lion',count:2}],
  [{type:'wolf',count:3},{type:'lion',count:3}],
];

// ─── Difficulty multipliers ────────────────────────────────────
const DIFF = {
  easy:   { speedMult:0.65, hpMult:1.0, maxStones:15 },
  normal: { speedMult:1.00, hpMult:1.0, maxStones:12 },
  hard:   { speedMult:1.35, hpMult:1.5, maxStones:10 },
};

// ─── Wall Palettes (biblical theme) ──────────────────────────
const D_PALETTES = [
  // 0: Valley of Elah — sandy sandstone + ochre boulders
  [null,'#8d6e63','#c8a86e','#6d4c41','#a58050','#5d4037','#bf8040','#795548'],
  // 1: Shepherd's Pasture — earth + moss
  [null,'#558b2f','#8d6e63','#4e342e','#7cb342','#33691e','#9e7c3f','#6d4c41'],
  // 2: Cave of Adullam — dark stone + deep grey
  [null,'#37474f','#546e7a','#263238','#455a64','#212121','#4a4a2a','#304040'],
  // 3: Wilderness of Judah — desert sand + ruin stone
  [null,'#a08040','#bf8d50','#8d6e30','#c8a060','#705010','#b07030','#c09850'],
];

// ─── Sky/Floor colours per map ────────────────────────────────
const D_ATMO = [
  { skTop:'#87ceeb', skBot:'#d4b87a', flTop:'#c8a86e', flBot:'#9e784e' }, // valley (day)
  { skTop:'#7ec8e3', skBot:'#b8d898', flTop:'#8d6e40', flBot:'#6d4c30' }, // pasture
  { skTop:'#0d0d18', skBot:'#1a1a2e', flTop:'#141414', flBot:'#080808' }, // cave (night)
  { skTop:'#c04010', skBot:'#e8a050', flTop:'#c09030', flBot:'#906020' }, // wilderness (sunset)
];

// ─── Maps (20 × 20) ──────────────────────────────────────────
const D_MAPS = [
  // 0: Valley of Elah — open battlefield, scattered boulders (type 2) + thornbush (type 3)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 1: Shepherd's Pasture — very open
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 2: Cave of Adullam — made into a very wide open cavern instead of a maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 3: Wilderness of Judah — very wide open space
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

// ─── Player start positions ────────────────────────────────────
const D_STARTS = [
  {x:10, y:10, a:0},
  {x:10, y:10, a:0},
  {x:1.5, y:1.5, a:0.3},
  {x:10, y:9.5, a:0},
];

// ─── Utilities ────────────────────────────────────────────────
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));

function dda(map, px, py, ang) {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  let mx = Math.floor(px), my = Math.floor(py);
  const stepX = cos < 0 ? -1 : 1, stepY = sin < 0 ? -1 : 1;
  const dtX = Math.abs(1 / cos), dtY = Math.abs(1 / sin);
  let sX = (cos < 0 ? px - mx : mx + 1 - px) * dtX;
  let sY = (sin < 0 ? py - my : my + 1 - py) * dtY;
  let hit = 0, side = 0;
  for (let i = 0; i < 64 && !hit; i++) {
    if (sX < sY) { sX += dtX; mx += stepX; side = 0; }
    else          { sY += dtY; my += stepY; side = 1; }
    if (mx < 0 || my < 0 || mx >= D_MAP_SIZE || my >= D_MAP_SIZE) { hit = 1; break; }
    if (map[my][mx]) hit = map[my][mx];
  }
  const dist = side === 0
    ? (mx - px + (1 - stepX) / 2) / cos
    : (my - py + (1 - stepY) / 2) / sin;
  const wallX = side === 0
    ? py + dist * sin - Math.floor(py + dist * sin)
    : px + dist * cos - Math.floor(px + dist * cos);
  return { dist: Math.max(0.01, dist), wallType: hit, side, wallX };
}

// ─── Audio Engine ─────────────────────────────────────────────
const _dac = new (window.AudioContext || window.webkitAudioContext)();
const DSfx = {
  _r() { if (_dac.state === 'suspended') _dac.resume(); },
  _osc(freq, type, dur, vol=0.07, freqEnd=null) {
    try {
      this._r();
      const o = _dac.createOscillator(), g = _dac.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, _dac.currentTime);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, _dac.currentTime+dur);
      g.gain.setValueAtTime(0.001, _dac.currentTime);
      g.gain.linearRampToValueAtTime(vol, _dac.currentTime+0.004);
      g.gain.exponentialRampToValueAtTime(0.001, _dac.currentTime+dur);
      o.connect(g); g.connect(_dac.destination); o.start(); o.stop(_dac.currentTime+dur);
    } catch(e){}
  },
  _noise(dur, vol=0.05, hi=0) {
    try {
      this._r();
      const len = Math.ceil(_dac.sampleRate*dur);
      const buf = _dac.createBuffer(1, len, _dac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<len;i++) d[i]=Math.random()*2-1;
      const src = _dac.createBufferSource(); src.buffer = buf;
      const g = _dac.createGain();
      g.gain.setValueAtTime(vol, _dac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _dac.currentTime+dur);
      if (hi > 0) { const f = _dac.createBiquadFilter(); f.type='highpass'; f.frequency.value=hi;
                    src.connect(f); f.connect(g); } else src.connect(g);
      g.connect(_dac.destination); src.start();
    } catch(e){}
  },
  slingCharge() { this._osc(200,'sine',0.08,0.04,280); },
  slingFire()   { this._noise(0.08,0.06,600); this._osc(380,'sawtooth',0.12,0.07,80); },
  stoneMiss()   { this._noise(0.05,0.04,300); },
  stoneHitWolf(){ this._noise(0.07,0.09,200); this._osc(180,'square',0.09,0.05,80); },
  stoneHitLion(){ this._noise(0.10,0.12,100); this._osc(100,'sawtooth',0.15,0.08,50); },
  wolfGrowl()   { this._osc(110,'sawtooth',0.35,0.05,75); this._noise(0.25,0.04,30); },
  lionRoar()    { this._osc(65,'sawtooth',0.55,0.09,45);
                  this._osc(80,'triangle',0.4,0.06,55);  this._noise(0.3,0.07,20); },
  playerHurt()  { this._osc(320,'sawtooth',0.18,0.08,110); this._noise(0.12,0.05,100); },
  reload()      { this._noise(0.06,0.05,400); setTimeout(()=>this._osc(300,'triangle',0.1,0.06,380),140); },
  waveComplete(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this._osc(f,'sine',0.22,0.09),i*90)); },
  victory()     { [523,659,784,1047,1319,1568,2093].forEach((f,i)=>
                    setTimeout(()=>this._osc(f,'sine',0.3,0.11),i*90)); },
  defeat()      { [523,440,370,294].forEach((f,i)=>setTimeout(()=>this._osc(f,'sine',0.35,0.09),i*120)); },
};

// ─── Texture Generation ───────────────────────────────────────
function generateTextures(palette) {
  const SZ = 64;
  const types = [null]; // index 0 unused
  for (let t = 1; t <= 7; t++) {
    const oc = document.createElement('canvas'); oc.width = oc.height = SZ;
    const ox = oc.getContext('2d');
    const hx = palette[t] || '#888888';
    const r = parseInt(hx.slice(1,3),16);
    const g = parseInt(hx.slice(3,5),16);
    const b = parseInt(hx.slice(5,7),16);
    ox.fillStyle = hx; ox.fillRect(0,0,SZ,SZ);
    if (t === 1) { // stone brick
      for (let row=0;row<8;row++){
        const offset = row%2===0?0:SZ/4;
        for(let col=0;col<8;col++){
          const px=(col*SZ/4+offset)%SZ, py=row*SZ/8;
          const shade = 0.78+Math.random()*0.35;
          ox.fillStyle=`rgb(${~~(r*shade)},${~~(g*shade)},${~~(b*shade)})`;
          ox.fillRect(px+1,py+1,SZ/4-2,SZ/8-2);
        }
      }
    } else if (t===2) { // grate / rock texture
      ox.fillStyle=`rgba(0,0,0,0.25)`; ox.fillRect(0,0,SZ,SZ);
      for(let i=0;i<6;i++){
        ox.strokeStyle=`rgba(${r+40},${g+40},${b+40},0.4)`;
        ox.lineWidth=2; ox.beginPath();
        ox.moveTo(i*(SZ/6),0); ox.lineTo(i*(SZ/6),SZ); ox.stroke();
        ox.beginPath(); ox.moveTo(0,i*(SZ/6)); ox.lineTo(SZ,i*(SZ/6)); ox.stroke();
      }
    } else if (t===3) { // hazard stripes (thornbush)
      for(let s=0;s<SZ*2;s+=16){
        ox.fillStyle=s%32<16?`rgba(0,0,0,0.45)`:'transparent';
        ox.beginPath(); ox.moveTo(s,0); ox.lineTo(s+16,0);
        ox.lineTo(s-16,SZ); ox.lineTo(s-32,SZ); ox.closePath(); ox.fill();
      }
    } else if (t===4) { // blast door / ruins
      for(let i=0;i<4;i++){
        const shade=0.5+i*0.12;
        ox.fillStyle=`rgb(${~~(r*shade)},${~~(g*shade)},${~~(b*shade)})`;
        ox.fillRect(i*(SZ/4),0,SZ/4,SZ);
        ox.fillStyle=`rgba(255,255,255,0.05)`;
        ox.fillRect(i*(SZ/4)+2,2,4,SZ-4);
      }
    } else if (t===5) { // server rack / ancient pillar
      ox.fillStyle=`rgba(0,0,0,0.3)`; ox.fillRect(0,0,SZ,SZ);
      for(let row=0;row<8;row++){
        ox.fillStyle=`rgba(${r},${g},${b},${0.6+Math.random()*0.3})`;
        ox.fillRect(4,row*8+1,SZ-8,6);
        if(Math.random()>0.6){
          ox.fillStyle='rgba(255,255,100,0.3)'; ox.fillRect(SZ-10,row*8+2,4,3);
        }
      }
    } else { // types 6,7 — sci-fi / sandstone variants
      const sc=t===6?1.15:0.85;
      ox.fillStyle=`rgb(${~~(r*sc)},${~~(g*sc)},${~~(b*sc)})`;
      ox.fillRect(0,0,SZ,SZ);
      for(let i=0;i<SZ;i+=8){
        ox.fillStyle='rgba(0,0,0,0.1)'; ox.fillRect(0,i,SZ,1);
      }
    }
    types.push(oc);
  }
  return types;
}

// ═══════════════════════════════════════════════════════════
//  Main DavidGame Class
// ═══════════════════════════════════════════════════════════
class DavidGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.W = this.H = 0;
    this._texCache = [];
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this.keys  = {};
    window.addEventListener('keydown', e => { this.keys[e.code] = true;  e.preventDefault(); });
    window.addEventListener('keyup',   e => { this.keys[e.code] = false; });

    this.state     = 'setup';
    this.arenaIdx  = 0;
    this.diffKey   = 'normal';
    this.player    = null;
    this.enemies   = [];
    this.stones    = [];
    this.waveIdx   = 0;
    this.score     = 0;
    this.kills     = { wolf:0, lion:0 };
    this.time      = 0;
    this.dt        = 0;
    this.lastTs    = 0;

    this._bindUI();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  // ── UI ──────────────────────────────────────────────────────
  _bindUI() {
    const $ = id => document.getElementById(id);

    // Radio group styling
    document.querySelectorAll('input[type=radio]').forEach(inp => {
      inp.addEventListener('change', () => {
        const nm = inp.name;
        document.querySelectorAll(`input[name=${nm}]`).forEach(i => {
          i.closest('.diff-opt').classList.toggle('selected', i === inp);
        });
        if (nm === 'arena') this.arenaIdx = +inp.value;
        if (nm === 'diff')  this.diffKey  = inp.value;
      });
    });

    $('startBtn').addEventListener('click', () => this._startGame());

    $('restartBtn').addEventListener('click', () => {
      $('gameResults').style.display = 'none';
      $('gameSetup').style.display   = '';
      this.state = 'setup';
    });
  }

  // ── Game Start ───────────────────────────────────────────────
  _startGame() {
    document.getElementById('gameSetup').style.display = 'none';

    const st = D_STARTS[this.arenaIdx];
    const df = DIFF[this.diffKey];

    this.player = {
      x: st.x, y: st.y, a: st.a,
      velFwd: 0, velTurn: 0,
      hp: D_MAX_HP,
      invTimer: 0,
      stones: df.maxStones,
      maxStones: df.maxStones,
      reloading: false, reloadTimer: 0,
      charging: false, chargeLevel: 0,
      slingAnim: 0,    // snap-release animation 0→1
      gunSwayX: 0, gunSwayY: 0,
      swayVX: 0, swayVY: 0,
    };

    this.enemies = [];
    this.stones  = [];
    this.waveIdx = 0;
    this.score   = 0;
    this.kills   = { wolf:0, lion:0 };
    this.time    = 0;
    this._texCache = generateTextures(D_PALETTES[this.arenaIdx]);

    this.state = 'countdown';
    this._countdownTimer = 3.0;
    this._showBanner('Wave 1  🎯', 2.0, () => {
      this.state = 'playing';
      this._spawnWave(0);
    });
  }

  // ── Banner ───────────────────────────────────────────────────
  _showBanner(text, dur, cb) {
    const el = document.getElementById('waveBanner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); if (cb) cb(); }, dur * 1000);
  }

  // ── Wave Spawning ─────────────────────────────────────────────
  _spawnWave(wi) {
    const wave = WAVES[wi];
    const df   = DIFF[this.diffKey];
    wave.forEach(group => {
      for (let i = 0; i < group.count; i++) {
        setTimeout(() => this._spawnEnemy(group.type, df), i * 600);
      }
    });
  }

  _spawnEnemy(type, df) {
    if (this.state !== 'playing') return;
    const cfg = ECFG[type];
    const map = D_MAPS[this.arenaIdx];
    let ex, ey;
    // Try to find an open tile far from player
    for (let attempt = 0; attempt < 80; attempt++) {
      ex = 1.5 + Math.random() * (D_MAP_SIZE - 3);
      ey = 1.5 + Math.random() * (D_MAP_SIZE - 3);
      const dx = ex - this.player.x, dy = ey - this.player.y;
      if (Math.sqrt(dx*dx+dy*dy) < 7) continue;
      if (!map[Math.floor(ey)][Math.floor(ex)]) break;
    }
    const hp = Math.ceil(cfg.hp * df.hpMult);
    this.enemies.push({
      type, x:ex, y:ey,
      a: Math.random() * Math.PI * 2,
      hp, maxHp: hp,
      speed: cfg.speed * df.speedMult,
      hurtTimer: 0, attackCd: 0,
      wanderTimer: 0, wanderAngle: 0,
      bobTime: Math.random() * Math.PI * 2,
    });
    // Spawn roar
    if (type === 'wolf') DSfx.wolfGrowl(); else DSfx.lionRoar();
  }

  // ── Main Loop ────────────────────────────────────────────────
  _loop(ts) {
    this.dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.state !== 'setup') this.time += this.dt;

    if (this.state === 'playing' || this.state === 'countdown') {
      this._update(this.dt);
      this._draw();
    } else if (this.state === 'waveClear') {
      this._drawWaveClearFlash();
    }

    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ── Update ───────────────────────────────────────────────────
  _update(dt) {
    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updateStones(dt);

    // Check wave clear
    if (this.state === 'playing' && this.enemies.length === 0) {
      this.state = 'waveClear';
      this._waveClearTimer = 0;
      const wn = this.waveIdx + 1;
      DSfx.waveComplete();
      if (wn >= WAVES.length) {
        setTimeout(() => this._showResults(true), 2200);
      } else {
        const nextWi = this.waveIdx + 1;
        this._showBanner(`Wave ${wn} Clear! ⭐`, 1.8, () => {
          this.waveIdx = nextWi;
          // Refill 4 stones between waves
          this.player.stones = Math.min(this.player.maxStones, this.player.stones + 4);
          this._showBanner(`Wave ${nextWi + 1} — Face them! 🪨`, 1.5, () => {
            this.state = 'playing';
            this._spawnWave(nextWi);
          });
        });
      }
    }
  }

  // ── Player Update ─────────────────────────────────────────────
  _updatePlayer(dt) {
    const p = this.player;
    const map = D_MAPS[this.arenaIdx];
    const k = this.keys;

    // Turning
    const tgt = (k['KeyA']||k['ArrowLeft'] ? -1 : 0) + (k['KeyD']||k['ArrowRight'] ? 1 : 0);
    p.velTurn += (tgt * D_TURN_SPD - p.velTurn) * Math.min(1, D_ACCEL * dt);
    p.a += p.velTurn * dt;

    // Movement
    const mov = (k['KeyW']||k['ArrowUp'] ? 1 : 0) + (k['KeyS']||k['ArrowDown'] ? -1 : 0);
    p.velFwd += (mov * D_MOVE_SPD - p.velFwd) * Math.min(1, D_ACCEL * dt);
    const nx = p.x + Math.cos(p.a) * p.velFwd * dt;
    const ny = p.y + Math.sin(p.a) * p.velFwd * dt;
    if (!map[Math.floor(p.y)][Math.floor(nx)] && nx > D_WALL_MRG && nx < D_MAP_SIZE-D_WALL_MRG) p.x = nx;
    if (!map[Math.floor(ny)][Math.floor(p.x)] && ny > D_WALL_MRG && ny < D_MAP_SIZE-D_WALL_MRG) p.y = ny;

    // Gun sway (follows movement)
    const swTgt = p.velFwd / D_MOVE_SPD;
    p.swayVY += (-swTgt * 5 * Math.sin(this.time * 6.5) - p.swayVY) * 6 * dt;
    p.swayVX += (-p.velTurn * 3.5 - p.swayVX) * 5 * dt;
    p.gunSwayY += p.swayVY * dt;
    p.gunSwayX += p.swayVX * dt;
    p.gunSwayY = clamp(p.gunSwayY, -12, 12);
    p.gunSwayX = clamp(p.gunSwayX, -10, 10);

    // Sling anim decay
    if (p.slingAnim > 0) p.slingAnim = Math.max(0, p.slingAnim - dt * 3.5);

    // Invincibility
    if (p.invTimer > 0) p.invTimer -= dt;

    // Reload
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) {
        p.reloading = false;
        p.stones = p.maxStones;
        DSfx.reload();
      }
    }

    // Charge
    const shootKey = k['Space'];
    if (!p.reloading && p.stones > 0 && shootKey) {
      if (!p.charging) { p.charging = true; p.chargeLevel = 0; }
      p.chargeLevel = Math.min(1.0, p.chargeLevel + D_CHARGE_RT * dt);
      if (this.time % 0.25 < dt) DSfx.slingCharge();
    } else if (p.charging) {
      // Released — fire!
      p.charging = false;
      if (p.chargeLevel >= 0.22 && p.stones > 0) {
        this._fireStone(p);
      }
      p.chargeLevel = 0;
    }

    // Reload key
    if ((k['KeyR']) && !p.reloading && p.stones < p.maxStones) {
      p.reloading = true;
      p.reloadTimer = 2.8;
    }
  }

  _fireStone(p) {
    const spread = p.chargeLevel > 0.5 ? 0.025 : 0.07;
    const ang = p.a + (Math.random()-0.5)*spread*2;
    const spd = D_STONE_LO + p.chargeLevel * (D_STONE_HI - D_STONE_LO);
    this.stones.push({ x:p.x, y:p.y, a:ang, speed:spd, life:2.2, charge:p.chargeLevel });
    p.stones--;
    p.slingAnim = 1.0;
    DSfx.slingFire();
  }

  // ── Enemy Update ─────────────────────────────────────────────
  _updateEnemies(dt) {
    const map = D_MAPS[this.arenaIdx];
    const p   = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hurtTimer  = Math.max(0, e.hurtTimer - dt);
      e.attackCd   = Math.max(0, e.attackCd - dt);
      e.bobTime   += dt * 3.5;

      // Chase player
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.sqrt(dx*dx+dy*dy);

      // Turn toward player
      let targetAng = Math.atan2(dy, dx);
      // Add wander
      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = 0.8 + Math.random() * 0.6;
        e.wanderAngle = (Math.random()-0.5) * 0.5;
      }
      targetAng += e.wanderAngle * 0.3;

      let da = targetAng - e.a;
      while (da >  Math.PI) da -= Math.PI*2;
      while (da < -Math.PI) da += Math.PI*2;
      const turn = ECFG[e.type].turnRate;
      e.a += clamp(da, -turn*dt, turn*dt);

      // Move toward player (unless within attack range)
      const cfg = ECFG[e.type];
      if (dist > cfg.atRng * 0.7) {
        const spd = e.speed * dt;
        const cosA = Math.cos(e.a), sinA = Math.sin(e.a);
        const m = 0.3;
        const enx = e.x + cosA * spd;
        const eny = e.y + sinA * spd;
        if (!map[Math.floor(e.y)][Math.floor(enx)] &&
            !this._nearEnemy(i, enx, e.y, 0.35)) e.x = enx;
        if (!map[Math.floor(eny)][Math.floor(e.x)] &&
            !this._nearEnemy(i, e.x, eny, 0.35)) e.y = eny;
      }

      // Attack player
      if (dist < cfg.atRng && e.attackCd <= 0 && p.invTimer <= 0) {
        e.attackCd = cfg.atCd;
        p.hp -= cfg.atDmg;
        p.invTimer = D_INVINCIBLE;
        DSfx.playerHurt();
        if (p.hp <= 0) { p.hp = 0; this._showResults(false); return; }
      }
    }
  }

  _nearEnemy(selfIdx, nx, ny, margin) {
    for (let j = 0; j < this.enemies.length; j++) {
      if (j === selfIdx) continue;
      const e2 = this.enemies[j];
      const dx = nx - e2.x, dy = ny - e2.y;
      if (Math.sqrt(dx*dx+dy*dy) < margin) return true;
    }
    return false;
  }

  // ── Stone Update ─────────────────────────────────────────────
  _updateStones(dt) {
    const map = D_MAPS[this.arenaIdx];
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      s.life -= dt;
      if (s.life <= 0) { this.stones.splice(i,1); continue; }

      const nx = s.x + Math.cos(s.a) * s.speed * dt;
      const ny = s.y + Math.sin(s.a) * s.speed * dt;

      // Wall hit
      if (map[Math.floor(ny)][Math.floor(nx)]) {
        DSfx.stoneMiss();
        this.stones.splice(i,1);
        continue;
      }

      // Enemy hit check
      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = nx - e.x, dy = ny - e.y;
        if (Math.sqrt(dx*dx+dy*dy) < 0.65) {
          e.hp--;
          e.hurtTimer = 0.22;
          hit = true;
          if (e.type === 'wolf') DSfx.stoneHitWolf(); else DSfx.stoneHitLion();
          if (e.hp <= 0) {
            this.score += ECFG[e.type].points;
            this.kills[e.type]++;
            this.enemies.splice(j,1);
          }
          break;
        }
      }
      if (hit) { this.stones.splice(i,1); continue; }

      s.x = nx; s.y = ny;
    }
  }

  // ── Rendering ─────────────────────────────────────────────────
  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    this._drawView();
    this._drawSlingshot();
    this._drawCrosshair();
    this._drawHUD();
    if (this.player.hp <= 1) this._drawLowHealthPulse();
    if (this.state === 'countdown') this._drawCountdown();
  }

  _drawView() {
    const { ctx, W, H }  = this;
    const p  = this.player;
    const map = D_MAPS[this.arenaIdx];
    const atm = D_ATMO[this.arenaIdx];
    const tex = this._texCache;
    const zBuf = new Float32Array(W);

    // Sky gradient
    const skyG = ctx.createLinearGradient(0, 0, 0, H/2);
    skyG.addColorStop(0, atm.skTop); skyG.addColorStop(1, atm.skBot);
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, W, H/2);

    // Floor gradient
    const flG = ctx.createLinearGradient(0, H/2, 0, H);
    flG.addColorStop(0, atm.flTop); flG.addColorStop(1, atm.flBot);
    ctx.fillStyle = flG; ctx.fillRect(0, H/2, W, H/2);

    // Raycasting
    const startAng = p.a - D_HALF_FOV;
    for (let col = 0; col < W; col++) {
      const ang = startAng + (col / W) * D_FOV;
      const { dist, wallType, side, wallX } = dda(map, p.x, p.y, ang);
      zBuf[col] = dist;

      const lineH = Math.min(H * 2, H / dist);
      const top   = (H - lineH) / 2;
      const palette = D_PALETTES[this.arenaIdx];

      // Draw textured wall slice
      const tIdx = Math.min(wallType, tex.length - 1);
      if (tex[tIdx]) {
        const texX = Math.floor(wallX * 64);
        const shade = side === 1 ? 0.62 : 0.88;
        ctx.globalAlpha = shade;
        ctx.drawImage(tex[tIdx], texX, 0, 1, 64, col, top, 1, lineH);
        ctx.globalAlpha = 1;
      } else {
        const hx = palette[wallType] || '#888';
        const shade = side===1 ? 0.62 : 0.88;
        ctx.fillStyle = hx;
        ctx.globalAlpha = shade;
        ctx.fillRect(col, top, 1, lineH);
        ctx.globalAlpha = 1;
      }
    }

    // Draw stones in 3D
    this.stones.forEach(s => this._drawStone(ctx, p, s, W, H, zBuf));

    // Draw enemies (sorted far→near for correct overlap)
    const sorted = [...this.enemies].sort((a,b) => {
      const da = (a.x-p.x)**2+(a.y-p.y)**2;
      const db = (b.x-p.x)**2+(b.y-p.y)**2;
      return db - da;
    });
    sorted.forEach(e => this._drawEnemy(ctx, p, e, W, H, zBuf));

    // Distance fog
    if (this.arenaIdx !== 2) {
      const fogG = ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*0.72);
      fogG.addColorStop(0,'rgba(0,0,0,0)');
      fogG.addColorStop(1,'rgba(0,0,0,0.35)');
      ctx.fillStyle = fogG; ctx.fillRect(0,0,W,H);
    } else {
      // cave: heavier fog
      const fogG = ctx.createRadialGradient(W/2,H/2,H*0.05,W/2,H/2,H*0.6);
      fogG.addColorStop(0,'rgba(0,0,0,0)');
      fogG.addColorStop(1,'rgba(0,0,20,0.65)');
      ctx.fillStyle = fogG; ctx.fillRect(0,0,W,H);
    }
  }

  _drawStone(ctx, viewer, stone, W, H, zBuf) {
    const dx = stone.x - viewer.x, dy = stone.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.08 || dist > 20) return;
    const sa = Math.atan2(dy, dx) - viewer.a;
    const na = Math.atan2(Math.sin(sa), Math.cos(sa));
    if (Math.abs(na) > D_HALF_FOV + 0.15) return;
    const sx = (na / D_FOV + 0.5) * W;

    // Make stone large and very bright so it's always obvious
    const sH = clamp(H / dist * 0.28, 6, H * 0.14);
    const sW = sH * 0.75;
    const sY = H / 2 - sH / 2;     // centered at horizon

    const sC = Math.floor(sx - sW/2);
    const eC = Math.floor(sx + sW/2);
    for (let col = Math.max(0, sC); col < Math.min(W, eC); col++) {
      if (zBuf[col] < dist) continue;   // behind a wall
      // bright light-gray stone with white specular centre
      const u = (col - sC) / Math.max(1, eC - sC);
      const hl = 1 - Math.abs(u - 0.5) * 1.6;  // 0 at edges, ~0.6 at center
      const v  = clamp(hl, 0, 1);
      const r  = Math.round(195 + v * 55);
      const g  = Math.round(200 + v * 50);
      const b  = Math.round(210 + v * 40);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col, sY, 1, sH);
    }
  }

  _drawEnemy(ctx, viewer, enemy, W, H, zBuf) {
    const dx = enemy.x - viewer.x, dy = enemy.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.3 || dist > 18) return;
    const sa = Math.atan2(dy, dx) - viewer.a;
    const na = Math.atan2(Math.sin(sa), Math.cos(sa));
    if (Math.abs(na) > D_HALF_FOV + 0.25) return;
    const sx = (na / D_FOV + 0.5) * W;

    const cfg = ECFG[enemy.type];
    const bobOff = Math.sin(enemy.bobTime) * 4 / dist;
    const sprH = clamp(H / dist * cfg.size * 2.1, 4, H * 1.8);
    const sprW = sprH * (enemy.type === 'lion' ? 1.05 : 0.70);
    const sprTop = (H - sprH) / 2 + bobOff;

    const hurtFlash = enemy.hurtTimer > 0 && Math.floor(this.time * 20) % 2 === 0;
    const brt = Math.max(0.28, 1 - dist / 14);

    const startCol = Math.floor(sx - sprW / 2);
    const endCol   = Math.floor(sx + sprW / 2);

    ctx.save();
    ctx.filter = `brightness(${brt})`; // Apply shading based on distance
    ctx.imageSmoothingEnabled = false; // Keep it pixelated/PS1 style

    for (let col = Math.max(0, startCol); col < Math.min(W, endCol); col++) {
      if (zBuf[col] <= dist) continue;
      if (hurtFlash) { // white flash when hit
        ctx.fillStyle = `rgba(255,255,255,0.9)`;
        ctx.fillRect(col, sprTop, 1, sprH);
        continue;
      }
      const u = (col - startCol) / Math.max(1, endCol - startCol);
      
      if (enemy.type === 'wolf' && wolfCanvas) {
        const img = wolfCanvas;
        const isAttacking = enemy.attackCd > (cfg.atCd - 0.4);
        const attackJawDrop = isAttacking ? 0.08 : 0;
        // Smooth sine wave over U to prevent tearing at center
        const swing = Math.sin(enemy.bobTime * 8) * 0.12 * Math.sin(u * Math.PI * 2);

        // 1. Top half
        let sliceX = Math.floor(u * img.width);
        ctx.drawImage(img, sliceX, 0, 1, Math.floor(0.4 * img.height), col, sprTop, 1, 0.4 * sprH);

        // 2. Jaw/Mouth area
        ctx.drawImage(img, sliceX, Math.floor(0.4 * img.height), 1, Math.floor(0.25 * img.height), 
                      col, sprTop + (0.4 + attackJawDrop) * sprH, 1, 0.25 * sprH);

        if (isAttacking && u > 0.35 && u < 0.65) {
           ctx.fillStyle = '#6b0000';
           ctx.fillRect(col, sprTop + 0.4 * sprH, 1, attackJawDrop * sprH + 1);
        }

        // 3. Legs
        sliceX = Math.floor(clamp(u + swing, 0.01, 0.99) * img.width);
        ctx.drawImage(img, sliceX, Math.floor(0.65 * img.height), 1, Math.floor(0.35 * img.height), 
                      col, sprTop + (0.65 + attackJawDrop) * sprH, 1, 0.35 * sprH);

      } else if (enemy.type === 'lion' && lionCanvas) {
        const img = lionCanvas;
        const isAttacking = enemy.attackCd > (cfg.atCd - 0.4);
        const attackJawDrop = isAttacking ? 0.10 : 0;
        const swing = Math.sin(enemy.bobTime * 6) * 0.10 * Math.sin(u * Math.PI * 2);

        // 1. Top half
        let sliceX = Math.floor(u * img.width);
        ctx.drawImage(img, sliceX, 0, 1, Math.floor(0.45 * img.height), col, sprTop, 1, 0.45 * sprH);

        // 2. Jaw
        ctx.drawImage(img, sliceX, Math.floor(0.45 * img.height), 1, Math.floor(0.25 * img.height), 
                      col, sprTop + (0.45 + attackJawDrop) * sprH, 1, 0.25 * sprH);

        if (isAttacking && u > 0.3 && u < 0.7) {
           ctx.fillStyle = '#4a0000';
           ctx.fillRect(col, sprTop + 0.45 * sprH, 1, attackJawDrop * sprH + 1);
        }

        // 3. Legs
        sliceX = Math.floor(clamp(u + swing, 0.01, 0.99) * img.width);
        ctx.drawImage(img, sliceX, Math.floor(0.70 * img.height), 1, Math.floor(0.30 * img.height), 
                      col, sprTop + (0.70 + attackJawDrop) * sprH, 1, 0.30 * sprH);

      } else {
        if (enemy.type === 'wolf') this._wolfCol(ctx, u, 1, col, sprTop, sprH, enemy);
        else this._lionCol(ctx, u, 1, col, sprTop, sprH, enemy);
      }
    }
    ctx.restore();
  }

  /* ── Wolf sprite (column renderer) ─────────────────────────
     Each column draws NON-OVERLAPPING vertical segments so
     later draws never clobber earlier ones.                  */
  _wolfCol(ctx, u, brt, col, top, sprH, e) {
    if (u < 0.04 || u > 0.96) return;   // hard edge silhouette

    const y   = v => top + sprH * v;
    const seg = (v0, v1, r, g, b) => {
      const h = y(v1) - y(v0);
      if (h < 0.5) return;
      ctx.fillStyle = `rgb(${~~(r*brt)},${~~(g*brt)},${~~(b*brt)})`;
      ctx.fillRect(col, y(v0), 1, h);
    };

    const isLEar = u > 0.10 && u < 0.28;
    const isREar = u > 0.72 && u < 0.90;
    const isLEye = u > 0.22 && u < 0.38;
    const isREye = u > 0.62 && u < 0.78;
    const isSnout = u > 0.36 && u < 0.64;
    const isLLeg  = u > 0.16 && u < 0.42;
    const isRLeg  = u > 0.58 && u < 0.84;
    const isBody  = u > 0.12 && u < 0.88;

    const legPhase = isLLeg ? 0 : Math.PI;
    const legOff   = Math.sin(e.bobTime * 2.5 + legPhase) * 0.035;

    // ── Ears (tip: v 0.00–0.12) ──
    if (isLEar || isREar) seg(0.00, 0.12,  55,  65,  70);

    // ── Forehead (v 0.12–0.22) ──
    if (u > 0.08 && u < 0.92)  seg(0.12, 0.22,  98, 112, 122);

    // ── Eye band (v 0.22–0.36) ──
    if      (isLEye || isREye)  seg(0.22, 0.36, 255, 220,  18);  // glowing yellow
    else if (isSnout)           seg(0.22, 0.36,  50,  60,  65);  // dark snout
    else if (u > 0.08 && u < 0.92) seg(0.22, 0.36, 98, 112, 122);

    // ── Lower snout / jaw (v 0.36–0.46) ──
    if (isSnout)  seg(0.36, 0.46,  62,  72,  80);
    else if (isBody) seg(0.36, 0.46, 110, 125, 136);

    // ── Neck / chest (v 0.46–0.58) ──
    if (isBody)   seg(0.46, 0.58, 104, 118, 128);

    // ── Body (v 0.58–0.74) ──
    if (isBody)   seg(0.58, 0.74,  92, 105, 115);

    // ── Legs (v 0.74+legOff – 1.00) ──
    if (isLLeg || isRLeg) {
      const lv0 = clamp(0.74 + legOff, 0.60, 0.82);
      seg(lv0, 1.00, 58, 68, 76);
    }
  }

  /* ── Lion sprite (column renderer) ─────────────────────────
     Big mane ring, wide tawny body, bright orange eyes.      */
  _lionCol(ctx, u, brt, col, top, sprH, e) {
    if (u < 0.03 || u > 0.97) return;

    const y   = v => top + sprH * v;
    const seg = (v0, v1, r, g, b) => {
      const h = y(v1) - y(v0);
      if (h < 0.5) return;
      ctx.fillStyle = `rgb(${~~(r*brt)},${~~(g*brt)},${~~(b*brt)})`;
      ctx.fillRect(col, y(v0), 1, h);
    };

    const isMane  = (u > 0.05 && u < 0.28) || (u > 0.72 && u < 0.95);
    const isFace  =  u > 0.24 && u < 0.76;
    const isLEye  =  u > 0.30 && u < 0.44;
    const isREye  =  u > 0.56 && u < 0.70;
    const isNose  =  u > 0.42 && u < 0.58;
    const isBody  =  u > 0.10 && u < 0.90;
    const isLPaw  =  u > 0.15 && u < 0.44;
    const isRPaw  =  u > 0.56 && u < 0.85;
    const isTail  =  u > 0.80 && u < 0.96;

    const pawPhase = isLPaw ? 0 : Math.PI;
    const pawOff   = Math.sin(e.bobTime * 1.8 + pawPhase) * 0.03;

    // ── Mane top (v 0.00–0.08) ──
    if (isMane || isFace)  seg(0.00, 0.08, 120,  72,  20);

    // ── Mane sides + face row 1 (v 0.08–0.40) ──
    if (isMane)            seg(0.08, 0.44, 138,  82,  22);  // dark golden mane
    // Face centre within mane band
    if (isFace) {
      // Brow (v 0.08–0.20)
      seg(0.08, 0.20, 205, 162,  88);
      // Eyes (v 0.20–0.34)
      if (isLEye || isREye) seg(0.20, 0.34, 255,  95,  10);  // burning orange
      else                  seg(0.20, 0.34, 188, 145,  70);
      // Nose bridge (v 0.34–0.44)
      if (isNose)  seg(0.34, 0.44,  95,  55,  18);
      else         seg(0.34, 0.44, 192, 150,  75);
    }

    // ── Mane bottom row (v 0.44–0.52) ──
    if (isMane)  seg(0.44, 0.52, 120,  72,  20);
    if (isFace)  seg(0.44, 0.52, 175, 135,  60);   // chin

    // ── Upper body / chest (v 0.52–0.68) ──
    if (isBody) {
      const chest = u > 0.38 && u < 0.62;
      seg(0.52, 0.68, chest ? 210 : 185, chest ? 165 : 142, chest ? 80 : 62);
    }

    // ── Lower body (v 0.68–0.78) ──
    if (isBody)  seg(0.68, 0.78, 170, 130,  55);

    // ── Paws (v 0.78+pawOff – 1.00) ──
    if (isLPaw || isRPaw) {
      const pv0 = clamp(0.78 + pawOff, 0.65, 0.88);
      seg(pv0, 1.00, 155, 118,  48);
    }

    // ── Tail (right edge, v 0.55–0.88, wavy) ──
    if (isTail) {
      const tv0 = 0.55 + Math.sin(e.bobTime * 1.3) * 0.06;
      seg(tv0, 0.88, 148, 105,  38);
    }
  }

  // ── Slingshot Viewmodel ────────────────────────────────────────
  _drawSlingshot() {
    const { ctx, W, H } = this;
    const p = this.player;
    const charge = p.chargeLevel;
    const snap   = p.slingAnim;  // 1→0 after firing

    const scale = H / 700;

    // Anchor at bottom center-right
    const ax = W * 0.57 + p.gunSwayX * 1.1;
    const ay = H + 55 * scale + p.gunSwayY * 0.9;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(scale, scale);

    // Vanishing point (crosshair / center of view)
    const vpX = (W / 2 - ax) / scale;
    const vpY = (H / 2 - ay) / scale;

    const pt = (x, y, z) => [vpX + (x - vpX) / z, vpY + (y - vpY) / z];

    const mixC = (r, g, b, amt) => {
      const c = v => Math.max(0, Math.min(255, Math.round(v)));
      return `rgb(${c(r*amt)},${c(g*amt)},${c(b*amt)})`;
    };

    const drawBlock = (x1, x2, y1, y2, z1, z2, r, g, b) => {
      // Back face (nearest to player)
      const p1=pt(x1,y1,z1), p2=pt(x2,y1,z1), p3=pt(x2,y2,z1), p4=pt(x1,y2,z1);
      ctx.fillStyle = mixC(r,g,b,1.0);
      ctx.beginPath(); ctx.moveTo(p1[0],p1[1]);
      ctx.lineTo(p2[0],p2[1]); ctx.lineTo(p3[0],p3[1]);
      ctx.lineTo(p4[0],p4[1]); ctx.closePath(); ctx.fill();
      // Top face
      const q1=pt(x1,y1,z1), q2=pt(x2,y1,z1), q3=pt(x2,y1,z2), q4=pt(x1,y1,z2);
      ctx.fillStyle = mixC(r,g,b,1.25);
      ctx.beginPath(); ctx.moveTo(q1[0],q1[1]);
      ctx.lineTo(q2[0],q2[1]); ctx.lineTo(q3[0],q3[1]);
      ctx.lineTo(q4[0],q4[1]); ctx.closePath(); ctx.fill();
      // Left side
      const s1=pt(x1,y1,z1), s2=pt(x1,y1,z2), s3=pt(x1,y2,z2), s4=pt(x1,y2,z1);
      ctx.fillStyle = mixC(r,g,b,0.60);
      ctx.beginPath(); ctx.moveTo(s1[0],s1[1]);
      ctx.lineTo(s2[0],s2[1]); ctx.lineTo(s3[0],s3[1]);
      ctx.lineTo(s4[0],s4[1]); ctx.closePath(); ctx.fill();
    };

    // Stone pull-back during charge
    const stoneY = -62 + charge * 52 + snap * -18;
    const stoneZ = 1.30 - charge * 0.22;
    const stoneS = 13 + charge * 5;

    // Handle grip (wood)
    drawBlock(-10, 10, 18, 170, 1.28, 2.1,  93,  68,  55);
    // Wood highlight
    drawBlock( -3,  3, 18, 170, 1.26, 2.08,115,  85,  68);

    // Fork junction
    drawBlock(-14, 14, -12, 18, 1.28, 1.7,  78,  56,  45);

    // Left prong
    drawBlock(-52, -10, -92, -8, 1.28, 1.58, 93,  68,  55);
    drawBlock(-48, -14, -88,-12, 1.26, 1.56,115,  85,  68);
    // Left prong tip
    drawBlock(-60, -46, -104,-88, 1.30, 1.55, 75,  50,  38);

    // Right prong
    drawBlock( 10,  52, -92, -8, 1.28, 1.58, 93,  68,  55);
    drawBlock( 14,  48, -88,-12, 1.26, 1.56,115,  85,  68);
    // Right prong tip
    drawBlock( 46,  60,-104,-88, 1.30, 1.55, 75,  50,  38);

    // Stone (gray river pebble)
    drawBlock(-stoneS, stoneS, stoneY-stoneS, stoneY+stoneS, stoneZ-0.07, stoneZ+0.07, 95, 115, 128);
    // Stone highlight
    drawBlock(-stoneS*0.5, stoneS*0.55, stoneY-stoneS+3, stoneY-stoneS*0.3, stoneZ-0.09, stoneZ-0.06, 155, 175, 185);

    // Elastic bands (2D lines in projected space)
    const lTip  = pt(-53, -96, 1.42);
    const rTip  = pt( 53, -96, 1.42);
    const sto   = pt(  0, stoneY, stoneZ);

    ctx.strokeStyle = `rgba(210, 165, 30, ${0.7 + charge * 0.25})`;
    ctx.lineWidth   = 2.8;
    ctx.lineCap     = 'round';
    ctx.beginPath(); ctx.moveTo(lTip[0],lTip[1]); ctx.lineTo(sto[0],sto[1]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rTip[0],rTip[1]); ctx.lineTo(sto[0],sto[1]); ctx.stroke();

    // Charge glow ring on stone
    if (charge > 0.45) {
      const gAlpha = (charge - 0.45) / 0.55;
      const [gx, gy] = pt(0, stoneY, stoneZ - 0.1);
      ctx.save();
      ctx.globalAlpha = gAlpha * 0.75;
      const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, 55);
      grd.addColorStop(0, 'rgba(255,255,200,0.9)');
      grd.addColorStop(0.5, 'rgba(255,200,50,0.4)');
      grd.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(gx, gy, 55, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Leather pouch wrap (small straps around stone base)
    ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sto[0], sto[1], stoneS*scale*0.9, 0.45, Math.PI-0.45);
    ctx.stroke();

    ctx.restore();
  }

  // ── Crosshair ─────────────────────────────────────────────────
  _drawCrosshair() {
    const { ctx, W, H } = this;
    const p = this.player;
    const cx = W / 2, cy = H / 2;
    const noAmmo = p.stones <= 0 && !p.reloading;
    const alpha = noAmmo ? 0.3 : (0.6 + p.chargeLevel * 0.4);
    const col = p.chargeLevel > 0.8 ? `rgba(255,220,80,${alpha})` : `rgba(255,255,255,${alpha})`;
    const gap = 6 + p.chargeLevel * 12;  // gap opens when charging (spread indicator)
    const len = 12;

    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);       ctx.lineTo(cx + gap + len, cy);
    ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);       ctx.lineTo(cx, cy + gap + len);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();
  }

  // ── HUD ───────────────────────────────────────────────────────
  _drawHUD() {
    const { ctx, W, H } = this;
    const p = this.player;

    // Hearts (top-left)
    const heartSize = Math.min(36, W * 0.045);
    for (let i = 0; i < D_MAX_HP; i++) {
      const filled = i < p.hp;
      ctx.font = `${heartSize}px Arial`;
      ctx.globalAlpha = filled ? 1.0 : 0.25;
      ctx.fillText(filled ? '❤️' : '🖤', 14 + i * (heartSize + 4), 14 + heartSize);
    }
    ctx.globalAlpha = 1;

    // Wave (top-right)
    const waveStr = this.state === 'playing'
      ? `Wave ${this.waveIdx + 1} / ${WAVES.length}`
      : `Wave ${this.waveIdx + 1} Clear!`;
    ctx.font = `bold ${Math.round(H * 0.022)}px 'Outfit', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'right';
    ctx.fillText(waveStr, W - 14, 32);
    ctx.fillStyle = '#f5c842';
    ctx.fillText(`Score: ${this.score}`, W - 14, 56);
    ctx.textAlign = 'left';

    // Stone pips (bottom-left)
    const pipY = H - 20;
    ctx.font = `${Math.round(H*0.026)}px Arial`;
    ctx.fillText('🪨', 14, pipY);
    const pipX = 14 + H * 0.038;
    for (let i = 0; i < p.maxStones; i++) {
      const filled = i < p.stones;
      ctx.fillStyle = filled ? '#d4a520' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(pipX + i * 11, pipY - 10, 7, 10);
    }

    // Reload indicator
    if (p.reloading) {
      const pct = 1 - p.reloadTimer / 2.8;
      const bw = W * 0.2, bh = 8;
      const bx = W / 2 - bw / 2, by = H - 40;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f5c842';         ctx.fillRect(bx, by, bw * pct, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `${Math.round(H*0.018)}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Gathering Stones…', W/2, by - 6);
      ctx.textAlign = 'left';
    }

    // Enemy counter (bottom-right)
    const wolves = this.enemies.filter(e => e.type==='wolf').length;
    const lions  = this.enemies.filter(e => e.type==='lion').length;
    const szE = Math.round(H * 0.026);
    ctx.font = `${szE}px Arial`;
    ctx.textAlign = 'right';
    if (wolves > 0) ctx.fillText(`🐺×${wolves}`, W - 14, H - 38);
    if (lions  > 0) ctx.fillText(`🦁×${lions}`,  W - 14, H - 8);
    ctx.textAlign = 'left';
  }

  _drawLowHealthPulse() {
    const { ctx, W, H } = this;
    const t = Math.sin(this.time * 5) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(200,0,0,${t * 0.22})`;
    ctx.fillRect(0, 0, W, H);
    // Vignette ring
    const vg = ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*0.65);
    vg.addColorStop(0,'rgba(180,0,0,0)');
    vg.addColorStop(1,`rgba(180,0,0,${t*0.45})`);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
  }

  _drawWaveClearFlash() {
    const { ctx, W, H } = this;
    this._waveClearTimer = (this._waveClearTimer || 0) + this.dt;
    // Gold flash fades
    const alpha = Math.max(0, 0.45 - this._waveClearTimer * 0.9);
    if (alpha > 0) {
      ctx.fillStyle = `rgba(245, 200, 60, ${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _drawCountdown() {
    // No extra countdown needed — banner handles it
  }

  // ── Wall test ────────────────────────────────────────────────
  _wallAt(x, y) {
    const map = D_MAPS[this.arenaIdx];
    const mx = Math.floor(x), my = Math.floor(y);
    if (mx < 0 || my < 0 || mx >= D_MAP_SIZE || my >= D_MAP_SIZE) return true;
    return !!map[my][mx];
  }

  // ── Results Screen ────────────────────────────────────────────
  _showResults(won) {
    this.state = 'results';
    if (won) DSfx.victory(); else DSfx.defeat();

    const el  = document.getElementById('gameResults');
    const ico = document.getElementById('resultsIcon');
    const tit = document.getElementById('resultsTitle');
    const lst = document.getElementById('resultsList');

    ico.textContent = won ? '🏆' : '💀';
    tit.textContent = won ? 'God is with you, David!' : 'Defeated…';
    tit.style.color = won ? '#f5c842' : '#ef5350';

    lst.innerHTML = `
      <div class="result-entry">
        <span>⭐ Score</span>
        <span style="color:#f5c842;font-weight:700">${this.score}</span>
      </div>
      <div class="result-entry">
        <span>🌊 Waves Cleared</span>
        <span style="color:#fff">${this.waveIdx} / ${WAVES.length}</span>
      </div>
      <div class="result-entry">
        <span>🐺 Wolves Slain</span>
        <span style="color:#90caf9">${this.kills.wolf}</span>
      </div>
      <div class="result-entry">
        <span>🦁 Lions Slain</span>
        <span style="color:#ffb74d">${this.kills.lion}</span>
      </div>
      ${won ? `<div class="result-entry" style="border-color:rgba(245,200,60,0.4)">
        <span>✨ 1 Samuel 17:37</span>
        <span style="color:#f5c842;font-size:0.78rem">"The Lord who rescued me…"</span>
      </div>` : ''}
    `;

    el.style.display = 'flex';
  }
}

// ── Boot ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => new DavidGame());
