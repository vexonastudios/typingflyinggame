// tank-engine.js — Rendering, camera, map drawing, minimap, collision helpers

const gameCanvas  = document.getElementById('gameCanvas');
const gctx        = gameCanvas.getContext('2d');
const minimapEl   = document.getElementById('minimap');
const mmCtx       = minimapEl.getContext('2d');

let camX = 0, camY = 0;

// ── Canvas resize ─────────────────────────────────────────
function resizeCanvas() {
  const hud = document.getElementById('hud');
  gameCanvas.width  = window.innerWidth;
  gameCanvas.height = window.innerHeight - hud.offsetHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); });
resizeCanvas();

// ── Camera update ─────────────────────────────────────────
// Uses dt-based exponential lerp so speed is frame-rate independent
function updateCamera(tank, dt) {
  const targetX = tank.x - gameCanvas.width  / 2;
  const targetY = tank.y - gameCanvas.height / 2;
  const k = 1 - Math.exp(-9 * dt);
  camX += (targetX - camX) * k;
  camY += (targetY - camY) * k;
}

// ── Map drawing ───────────────────────────────────────────
function drawMap(ctx, map, camX, camY, worldOffX) {
  const startCol = Math.max(0, Math.floor((camX - worldOffX) / TILE_SIZE) - 1);
  const endCol   = Math.min(map[0].length - 1, Math.floor((camX - worldOffX + ctx.canvas.width) / TILE_SIZE) + 1);
  const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const endRow   = Math.min(map.length - 1, Math.floor((camY + ctx.canvas.height) / TILE_SIZE) + 1);

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tile = map[r][c];
      const tx = (c * TILE_SIZE) - worldOffX - camX;
      const ty = r * TILE_SIZE - camY;
      const ts = TILE_SIZE;

      // Base fill
      ctx.fillStyle = TILE_COLORS[tile] || '#8fad6e';
      ctx.fillRect(tx, ty, ts, ts);

      // ── Enhanced tile decorations ────────────────────────
      if (tile === T.WALL) {
        // Darker top-left gradient (pseudo-lighting)
        const wg = ctx.createLinearGradient(tx, ty, tx + ts, ty + ts);
        wg.addColorStop(0, 'rgba(255,255,255,0.12)');
        wg.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = wg;
        ctx.fillRect(tx, ty, ts, ts);
        // Mortar lines
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1;
        const row = r, col = c;
        // Horizontal mortar
        ctx.beginPath();
        ctx.moveTo(tx, ty + ts/2); ctx.lineTo(tx + ts, ty + ts/2);
        ctx.stroke();
        // Vertical mortar — offset alternating rows
        const offV = (row % 2 === 0) ? 0 : ts/2;
        ctx.beginPath();
        ctx.moveTo(tx + offV, ty); ctx.lineTo(tx + offV, ty + ts/2);
        ctx.moveTo(tx + offV + ts/2, ty + ts/2); ctx.lineTo(tx + offV + ts/2, ty + ts);
        ctx.stroke();
        // Edge shadow (right+bottom)
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(tx + ts - 3, ty, 3, ts);
        ctx.fillRect(tx, ty + ts - 3, ts, 3);
        // Top/left highlight
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(tx, ty, ts, 2);
        ctx.fillRect(tx, ty, 2, ts);

      } else if (tile === T.TREE) {
        // Shadow on ground
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.ellipse(tx + ts/2 + 4, ty + ts/2 + 5, ts/2 - 2, ts/4, 0.3, 0, Math.PI*2);
        ctx.fill();
        // Dark canopy base
        ctx.fillStyle = '#162e16';
        ctx.beginPath();
        ctx.arc(tx + ts/2, ty + ts/2, ts/2 - 3, 0, Math.PI*2);
        ctx.fill();
        // Canopy clusters
        const treeClr = [['#1e5c1e',10],['#2a7a2a',7],['#3a9a3a',5]];
        const seeds = [(c*7+r*13)%12, (c*13+r*7)%10, (c*5+r*17)%14];
        treeClr.forEach(([col,rad],i) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(tx + ts/2 + seeds[i] - 6, ty + ts/2 + (seeds[(i+1)%3]%8) - 4, rad, 0, Math.PI*2);
          ctx.fill();
        });
        // Bright highlight spot
        ctx.fillStyle = 'rgba(100,220,80,0.18)';
        ctx.beginPath();
        ctx.arc(tx + ts/2 - 4, ty + ts/2 - 5, 5, 0, Math.PI*2);
        ctx.fill();

      } else if (tile === T.WATER) {
        // Shimmer gradient
        const wg2 = ctx.createLinearGradient(tx, ty, tx, ty + ts);
        wg2.addColorStop(0, 'rgba(80,180,255,0.2)');
        wg2.addColorStop(1, 'rgba(0,60,120,0.25)');
        ctx.fillStyle = wg2;
        ctx.fillRect(tx, ty, ts, ts);
        // Animated-ish ripples (deterministic phase from col)
        ctx.strokeStyle = 'rgba(160,230,255,0.35)';
        ctx.lineWidth = 1.2;
        for (let w = 0; w < 3; w++) {
          const wx = tx + 8 + w * 15 + ((c*3+w*7) % 8);
          ctx.beginPath();
          ctx.ellipse(wx, ty + ts/2 + ((r*5+w*3)%8)-4, 9, 4, 0, 0, Math.PI*2);
          ctx.stroke();
        }
        // Dark border
        ctx.strokeStyle = 'rgba(0,50,100,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tx, ty, ts, ts);

      } else if (tile === T.ROAD) {
        // Asphalt texture via subtle noise
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        for (let n = 0; n < 4; n++) {
          const nx = tx + ((c*11+r*7+n*13)%40) + 2;
          const ny = ty + ((c*7+r*13+n*5)%38) + 2;
          ctx.fillRect(nx, ny, 2, 1);
        }
        // White centre dashes
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(tx + ts/2 - 2, ty + 2, 4, ts/2 - 6);
        ctx.fillRect(tx + ts/2 - 2, ty + ts/2 + 4, 4, ts/2 - 6);
        // Edge tyre marks
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(tx, ty, 4, ts);
        ctx.fillRect(tx + ts - 4, ty, 4, ts);

      } else if (tile === T.OBJECTIVE) {
        const og = ctx.createRadialGradient(tx+ts/2, ty+ts/2, 0, tx+ts/2, ty+ts/2, ts/2);
        og.addColorStop(0, 'rgba(255,220,60,0.5)');
        og.addColorStop(1, 'rgba(200,140,20,0.0)');
        ctx.fillStyle = og;
        ctx.fillRect(tx, ty, ts, ts);
        ctx.fillStyle = '#ffd060';
        ctx.font = `bold ${ts * 0.6}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', tx + ts/2, ty + ts/2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      } else if (tile === T.RUBBLE) {
        // Rubble chunks — deterministic per-tile shapes
        for (let rb = 0; rb < 5; rb++) {
          const rx = ((c * 7 + r * 13 + rb * 5) % 32) + 3;
          const ry = ((c * 11 + r * 7 + rb * 9) % 30) + 3;
          const rsz = 3 + (rb % 4);
          ctx.fillStyle = rb % 2 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)';
          ctx.beginPath();
          ctx.arc(tx + rx, ty + ry, rsz, 0, Math.PI*2);
          ctx.fill();
          // Highlight edge
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath();
          ctx.arc(tx + rx - 1, ty + ry - 1, rsz * 0.5, 0, Math.PI*2);
          ctx.fill();
        }
        // Crack lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx + 8, ty + 10); ctx.lineTo(tx + 24, ty + 22);
        ctx.moveTo(tx + 30, ty + 8); ctx.lineTo(tx + 20, ty + 35);
        ctx.stroke();

      } else if (tile === T.SAND || tile === T.EMPTY || tile === T.SPAWN) {
        // Ground texture: small pebbles + subtle colour variation
        for (let sg = 0; sg < 5; sg++) {
          const rx = ((c * 17 + r * 5 + sg * 11) % 36) + 4;
          const ry = ((c * 5 + r * 19 + sg * 7) % 34) + 4;
          const dark = (sg + c + r) % 3 === 0;
          ctx.fillStyle = dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)';
          ctx.fillRect(tx + rx, ty + ry, 2 + sg%2, 1);
        }
        // Tiny pebble circles
        for (let pg = 0; pg < 2; pg++) {
          const px = ((c * 23 + r * 11 + pg * 17) % 38) + 4;
          const py = ((c * 11 + r * 23 + pg * 13) % 36) + 4;
          ctx.fillStyle = 'rgba(0,0,0,0.09)';
          ctx.beginPath();
          ctx.arc(tx + px, ty + py, 1.5, 0, Math.PI*2);
          ctx.fill();
        }
      }
    }
  }
}

// ── Minimap ───────────────────────────────────────────────
function drawMinimap(map, worldOffX, tank, enemies) {
  const mw = minimapEl.width;
  const mh = minimapEl.height;
  const totalW = map[0].length * TILE_SIZE;
  const totalH = map.length * TILE_SIZE;
  const scaleX = mw / totalW;
  const scaleY = mh / totalH;

  mmCtx.clearRect(0, 0, mw, mh);
  mmCtx.fillStyle = 'rgba(0,0,0,0.7)';
  mmCtx.fillRect(0, 0, mw, mh);

  // Tiles
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const tile = map[r][c];
      if (tile === T.EMPTY || tile === T.SAND) continue;
      const tx = (c * TILE_SIZE - worldOffX) * scaleX;
      const ty = r * TILE_SIZE * scaleY;
      mmCtx.fillStyle = TILE_COLORS[tile] || '#888';
      mmCtx.fillRect(tx, ty, Math.max(1, TILE_SIZE * scaleX), Math.max(1, TILE_SIZE * scaleY));
    }
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    mmCtx.fillStyle = '#ff4444';
    const ex = (e.x - worldOffX) * scaleX;
    const ey = e.y * scaleY;
    mmCtx.fillRect(ex - 2, ey - 2, 4, 4);
  }

  // Player
  const px = (tank.x - worldOffX) * scaleX;
  const py = tank.y * scaleY;
  mmCtx.fillStyle = '#78f050';
  mmCtx.fillRect(px - 3, py - 3, 6, 6);

  // Border
  mmCtx.strokeStyle = 'rgba(90,200,50,0.5)';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(0, 0, mw, mh);
}

// ── Input map ─────────────────────────────────────────────
// Keyed ONLY by e.code for consistency (avoids ;/Semicolon mismatch)
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // Prevent arrow keys / space scrolling page
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
});
// Convenience aliases: single-letter shorthands -> e.code equivalents
// NOTE: Arrow keys must NOT be aliased this way — keys['ArrowLeft'] is
// already set directly by the keydown handler, so no getter is needed.
// Defining a getter named 'ArrowLeft' that reads this['ArrowLeft'] is
// infinite recursion (getter calls itself).
Object.defineProperties(keys, {
  w: { get() { return this['KeyW']; }, configurable: true },
  a: { get() { return this['KeyA']; }, configurable: true },
  s: { get() { return this['KeyS']; }, configurable: true },
  d: { get() { return this['KeyD']; }, configurable: true },
});


// ── Collision helpers ─────────────────────────────────────
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX, dy = cy - nearY;
  return dx*dx + dy*dy < r*r;
}

function circleCircle(ax, ay, ar, bx, by, br) {
  const dx = ax-bx, dy = ay-by;
  return dx*dx + dy*dy < (ar+br)*(ar+br);
}

// ── Line-of-sight raycast ─────────────────────────────────
// Steps along the vector from (x1,y1) to (x2,y2) in tile-sized steps.
// Returns true if no solid tile blocks the path.
function hasLineOfSight(x1, y1, x2, y2, map) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist === 0) return true;
  const steps = Math.ceil(dist / (TILE_SIZE * 0.5));
  for (let i = 1; i < steps; i++) {
    const t  = i / steps;
    const wx = x1 + dx * t;
    const wy = y1 + dy * t;
    const col = Math.floor(wx / TILE_SIZE);
    const row = Math.floor(wy / TILE_SIZE);
    if (isSolid(getTile(map, col, row))) return false;
  }
  return true;
}
