'use strict';

// ═══════════════════════════════════════════════════════════
//  NERF ARENA — Split-Screen Raycasting FPS  v4.0
//  Major improvements:
//   1. Power-Up Pickups (ammo packs + speed boost)
//   2. Kill Feed / Combat Log
//   3. Aim-Down-Sights (ADS) zoom with FOV lerp
//   4. Rich Win Screen with confetti + accuracy stats
//  Glitch fixes:
//   - Shooting blocked during countdown
//   - Double reload-sound on empty gun
//   - Dart z-buffer direction fix
//   - Minimap shows opponent facing direction
// ═══════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────
const FOV_NORMAL   = Math.PI / 2.5;   // ~72° hip fire
const FOV_ADS      = Math.PI / 5.5;   // ~33° aimed
const FOV_LERP_SPD = 8.0;             // ADS zoom speed
const HALF_FOV     = FOV_NORMAL / 2;  // used for clipping
const MOVE_SPD     = 3.5;
const MOVE_ACCEL   = 14.0;
const TURN_SPD     = 1.55;
const TURN_ACCEL   = 7.0;
const DART_SPD     = 12.0;
const MAX_AMMO     = 8;
const RELOAD_TIME  = 1.5;
const HIT_DIST     = 0.5;
const WALL_MARGIN  = 0.28;
const INVINCIBLE_T = 1.2;

// ─── Palette ─────────────────────────────────────────────────
const WALL_PALETTES = [
  // 0: Classic — burnt orange + slate + forest
  [ null, '#c44a0a', '#1565c0', '#2e7d32', '#7b1fa2', '#b71c1c', '#e65100', '#00838f' ],
  // 1: Maze — deep navy labyrinth
  [ null, '#0d47a1', '#01579b', '#004d40', '#311b92', '#6a1b4d', '#1b5e20', '#bf360c' ],
  // 2: Fortress — stone brown + earth
  [ null, '#4e342e', '#5d4037', '#3e2723', '#6d4c41', '#8d6e63', '#795548', '#bc5000' ],
  // 3: Warehouse — steel blue + hi-vis orange
  [ null, '#546e7a', '#e65100', '#37474f', '#78909c', '#263238', '#bf360c', '#455a64' ],
  // 4: Nuclear Reactor — hazard yellow + toxic green
  [ null, '#004d40', '#f9a825', '#1b5e20', '#ff6f00', '#006064', '#558b2f', '#33691e' ],
  // 5: Western Frontier — terracotta + dusty adobe
  [ null, '#6d4c41', '#bf360c', '#8d6e63', '#4e342e', '#795548', '#d84315', '#a1887f' ],
  // 6: Space Hub — deep navy + electric cyan
  [ null, '#1a237e', '#0097a7', '#283593', '#0288d1', '#006064', '#01579b', '#004d40' ],
  // 7: Catacombs — charcoal stone + bone
  [ null, '#37474f', '#4e342e', '#263238', '#4a4a2a', '#455a64', '#4a148c', '#212121' ],
];

// ─── Arena Maps ─────────────────────────────────────────────
const MAPS = [
  // 0: Classic
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,2,0,0,0,0,3,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,3,0,0,0,0,2,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 1: Maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,0,0,1,0,0,1,0,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,1,0,2,2,2,2,0,1,0,0,0,1,0,1],
    [1,0,1,1,0,0,1,0,2,0,0,2,0,1,0,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,0,1,0,2,0,0,2,0,1,0,0,1,1,0,1],
    [1,0,1,0,0,0,1,0,2,2,2,2,0,1,0,0,0,1,0,1],
    [1,0,1,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,0,1,0,0,1,0,0,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,1,1,0,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 2: Fortress
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,3,3,3,3,3,3,0,0,3,3,3,3,3,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,0,0,0,0,3,0,0,3,0,0,0,0,3,0,0,1],
    [1,0,0,3,3,3,3,3,3,0,0,3,3,3,3,3,3,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 3: Warehouse — industrial crate stacks + structural pillars
  //   1=steel wall  2=hi-vis orange grate crates  6=rust shelving  7=gunmetal columns
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,2,2,0,0,2,2,0,0,0,0,2,2,0,0,2,2,0,1],
    [1,0,2,2,0,0,2,2,0,0,0,0,2,2,0,0,2,2,0,1],
    [1,0,0,0,0,0,0,0,0,7,7,0,0,0,0,0,0,0,0,1],
    [1,0,0,7,0,0,0,0,0,7,7,0,0,0,0,0,7,0,0,1],
    [1,0,0,7,0,2,2,0,0,0,0,0,0,2,2,0,7,0,0,1],
    [1,0,0,0,0,2,2,0,0,0,0,0,0,2,2,0,0,0,0,1],
    [1,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,1],
    [1,0,6,0,0,0,0,0,6,6,6,6,0,0,0,0,0,6,0,1],
    [1,0,6,0,0,0,0,0,6,0,0,6,0,0,0,0,0,6,0,1],
    [1,0,0,0,0,0,0,0,6,6,6,6,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,2,2,0,0,0,0,0,0,2,2,0,0,0,0,1],
    [1,0,0,7,0,2,2,0,0,0,0,0,0,2,2,0,7,0,0,1],
    [1,0,0,7,0,0,0,0,0,7,7,0,0,0,0,0,7,0,0,1],
    [1,0,0,0,0,0,0,0,0,7,7,0,0,0,0,0,0,0,0,1],
    [1,0,2,2,0,0,2,2,0,0,0,0,2,2,0,0,2,2,0,1],
    [1,0,2,2,0,0,2,2,0,0,0,0,2,2,0,0,2,2,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 4: Nuclear Reactor — reactor core ring + control-room hazard bays
  //   1=outer walls  2=tech consoles  3=hazard control posts  4=blast-door shaft  5=reactor core ring
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,3,3,0,0,0,0,0,0,0,0,0,0,3,3,0,0,1],
    [1,0,0,3,3,0,0,0,4,4,4,4,0,0,0,3,3,0,0,1],
    [1,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,5,5,5,0,0,5,5,5,0,0,0,0,0,1],
    [1,0,2,0,0,5,0,0,0,0,0,0,0,0,5,0,0,2,0,1],
    [1,0,2,0,0,5,0,0,0,0,0,0,0,0,5,0,0,2,0,1],
    [1,0,0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0,0,1],
    [1,0,0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0,0,1],
    [1,0,2,0,0,5,0,0,0,0,0,0,0,0,5,0,0,2,0,1],
    [1,0,2,0,0,5,0,0,0,0,0,0,0,0,5,0,0,2,0,1],
    [1,0,0,0,0,0,5,5,5,0,0,5,5,5,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
    [1,0,0,3,3,0,0,0,4,4,4,4,0,0,0,3,3,0,0,1],
    [1,0,0,3,3,0,0,0,0,0,0,0,0,0,0,3,3,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 5: Western Frontier — frontier town with saloon facades + barrel barricades
  //   1=outer walls  2=barrel/post barricades  4=adobe building facades
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,4,4,4,0,0,0,0,0,0,0,0,0,4,4,4,0,1],
    [1,0,0,4,0,4,0,0,0,0,0,0,0,0,0,4,0,4,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,4,4,0,0,0,0,2,2,0,0,2,2,0,0,0,0,4,4,1],
    [1,4,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,4,1],
    [1,4,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,4,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,4,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,4,1],
    [1,4,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,4,1],
    [1,4,4,0,0,0,0,2,2,0,0,2,2,0,0,0,0,4,4,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,1],
    [1,0,0,4,0,4,0,0,0,0,0,0,0,0,0,4,0,4,0,1],
    [1,0,0,4,4,4,0,0,0,0,0,0,0,0,0,4,4,4,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 6: Space Hub — starport concourse with hub rings + docking pylons
  //   1=outer walls  2=docking panels  3=hub ring segments  6=pylon columns
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,1],
    [1,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,1],
    [1,0,0,0,0,0,0,3,3,0,0,3,3,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,2,2,0,0,3,0,0,0,0,0,0,0,0,3,0,0,2,2,1],
    [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
    [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
    [1,2,2,0,0,3,0,0,0,0,0,0,0,0,3,0,0,2,2,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,3,0,0,0,0,0,0,3,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,3,3,0,0,3,3,0,0,0,0,0,0,1],
    [1,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,1],
    [1,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // 7: Catacombs — winding stone tunnels with alcoves + bone-dry chambers
  //   1=stone everywhere  2=alcove arches  3=collapsed pillars
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,0,1,0,0,1,0,0,1,0,1,1,0,1],
    [1,0,0,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,1],
    [1,0,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,1,0,0,1],
    [1,0,1,1,0,0,0,1,0,0,0,0,1,0,0,0,1,1,0,1],
    [1,0,1,1,0,0,0,1,0,0,0,0,1,0,0,0,1,1,0,1],
    [1,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,1,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1,0,1],
    [1,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,1],
    [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
    [1,0,0,1,0,1,0,1,1,0,0,1,1,0,1,0,1,0,0,1],
    [1,0,1,1,0,1,0,0,1,0,0,1,0,0,1,0,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
];

const STARTS = [
  // 0: Classic  — diagonal corners
  [ {x:2.5, y:2.5,  a:Math.PI*0.25},  {x:17.5,y:17.5, a:Math.PI*1.25} ],
  // 1: Maze     — tight inside corners
  [ {x:1.5, y:1.5,  a:0.1},            {x:18.5,y:18.5, a:Math.PI+0.1}  ],
  // 2: Fortress — diagonal corners outside bases
  [ {x:2.5, y:2.5,  a:Math.PI*0.25},  {x:17.5,y:17.5, a:Math.PI*1.25} ],
  // 3: Warehouse — aisle corners, facing inward
  [ {x:1.5, y:1.5,  a:Math.PI*0.2},   {x:18.5,y:18.5, a:Math.PI*1.2}  ],
  // 4: Reactor  — left & right flanks of the reactor, facing each other
  [ {x:1.5, y:9.5,  a:0.05},           {x:18.5,y:9.5,  a:Math.PI-0.05} ],
  // 5: Western  — opposite saloon corners
  [ {x:1.5, y:1.5,  a:Math.PI*0.15},  {x:18.5,y:18.5, a:Math.PI*1.15} ],
  // 6: Space Hub — far quadrant corners
  [ {x:1.5, y:1.5,  a:Math.PI*0.3},   {x:18.5,y:18.5, a:Math.PI*1.3}  ],
  // 7: Catacombs — open-corridor corners
  [ {x:1.5, y:1.5,  a:Math.PI*0.25},  {x:18.5,y:18.5, a:Math.PI*1.25} ],
];

const P_COLORS = ['#ff6b35', '#38bdf8'];
const P_NAMES  = ['Player 1', 'Player 2'];

// ─── Audio Engine ────────────────────────────────────────────
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

  shoot()    { this._osc(180,'sawtooth',0.06,0.1,60); this._noise(0.05,0.07,800); this._osc(90,'square',0.08,0.05,40); },
  empty()    { this._osc(140,'square',0.08,0.05,100); this._noise(0.04,0.03,200); },
  reload()   {
    this._noise(0.04,0.04,400);
    setTimeout(() => { this._osc(260,'triangle',0.1,0.06,380); }, 120);
    setTimeout(() => { this._noise(0.03,0.05,600); this._osc(320,'triangle',0.1,0.07,440); }, 350);
  },
  hit()      { this._osc(800,'sine',0.05,0.1,200); this._noise(0.12,0.09,100); this._osc(120,'sawtooth',0.15,0.06,60); },
  splat()    { this._noise(0.08,0.06,300); this._osc(160,'sine',0.1,0.04,80); },
  pickup()   { [660,880,1100].forEach((f,i) => setTimeout(() => this._osc(f,'sine',0.12,0.07), i*55)); },
  countdown(){ this._osc(520,'sine',0.15,0.06); },
  go()       { [523,659,784,1047].forEach((f,i) => setTimeout(() => this._osc(f,'sine',0.22,0.08), i*80)); },
  win()      { [523,659,784,1047,1319,1568].forEach((f,i) => setTimeout(() => this._osc(f,'sine',0.3,0.09), i*90)); },
  click()    { this._osc(700,'sine',0.04,0.04); },
  step()     { this._noise(0.035,0.012,80); this._osc(60,'sine',0.04,0.015); },
  ads()      { this._osc(300,'sine',0.06,0.03,280); },
};

// ─── Utilities ───────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ═══════════════════════════════════════════════════════════
//  PLAYER STATE
// ═══════════════════════════════════════════════════════════
class Player {
  constructor(id, ctrl, startPos) {
    this.id         = id;
    this.ctrl       = ctrl;
    this.color      = P_COLORS[id];
    this.name       = P_NAMES[id];
    this.x          = startPos.x;
    this.y          = startPos.y;
    this.angle      = startPos.a;
    this.velFwd     = 0;
    this.velTurn    = 0;

    // Combat
    this.ammo       = MAX_AMMO;
    this.reloading  = false;
    this.reloadTimer= 0;
    this.hits       = 0;
    this.invincible = 0;
    this.darts      = [];
    this._shootCd   = 0;

    // Stats (improvement 4)
    this.shotsFired = 0;
    this.shotsHit   = 0;

    // ADS (improvement 3)
    this.ads        = false;   // aiming down sights
    this.fov        = FOV_NORMAL;  // current (lerped) FOV
    this.adsMult    = 1.0;     // 1=hip, <1=aimed (turn speed multiplier)
    this._adsSfxCd  = 0;

    // Visual / HUD
    this.hitFlash   = 0;
    this.muzzleFlash= 0;
    this.bobTimer   = 0;
    this.gunRecoil  = 0;
    this.gunSwayX   = 0;
    this.gunSwayY   = 0;
    this._stepTimer = 0;
    this.hitPop     = 0;

    // Speed boost (improvement 1)
    this.speedBoost = 0;  // remaining seconds
  }
}

// ═══════════════════════════════════════════════════════════
//  DDA RAYCASTER
// ═══════════════════════════════════════════════════════════
function castRay(map, px, py, angle) {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const mapX0 = Math.floor(px), mapY0 = Math.floor(py);
  const stepX = cosA > 0 ? 1 : -1;
  const stepY = sinA > 0 ? 1 : -1;
  const dX = Math.abs(1 / (cosA || 1e-9));
  const dY = Math.abs(1 / (sinA || 1e-9));
  let sdX = cosA > 0 ? (mapX0 + 1 - px) * dX : (px - mapX0) * dX;
  let sdY = sinA > 0 ? (mapY0 + 1 - py) * dY : (py - mapY0) * dY;
  let mx = mapX0, my = mapY0, side = 0;

  for (let i = 0; i < 80; i++) {
    if (sdX < sdY) { sdX += dX; mx += stepX; side = 0; }
    else           { sdY += dY; my += stepY; side = 1; }
    if (mx < 0 || my < 0 || my >= map.length || mx >= map[0].length) break;
    if (map[my][mx] > 0) {
      const dist = side === 0
        ? (mx - px + (1 - stepX) / 2) / cosA
        : (my - py + (1 - stepY) / 2) / sinA;
      const absDist = Math.abs(dist);
      let wallX = side === 0 ? py + absDist * sinA : px + absDist * cosA;
      wallX -= Math.floor(wallX);
      return { dist: absDist, wallType: map[my][mx], side, wallX };
    }
  }
  return { dist: 30, wallType: 0, side: 0, wallX: 0 };
}

// ═══════════════════════════════════════════════════════════
//  POWER-UP SYSTEM  (Improvement #1)
// ═══════════════════════════════════════════════════════════
const PICKUP_TYPES = {
  ammo:  { color: '#ffcc00', glowColor: 'rgba(255,200,0,0.6)',  icon: '🔋', label: 'AMMO',  duration: 0 },
  speed: { color: '#00e5ff', glowColor: 'rgba(0,220,255,0.6)', icon: '⚡', label: 'SPEED', duration: 4.0 },
};

class Pickup {
  constructor(x, y, type) {
    this.x     = x;
    this.y     = y;
    this.type  = type;
    this.alive = true;
    this.bob   = Math.random() * Math.PI * 2;
    this.spin  = Math.random() * Math.PI * 2;
  }
}

// ═══════════════════════════════════════════════════════════
//  KILL FEED  (Improvement #2)
// ═══════════════════════════════════════════════════════════
class KillFeed {
  constructor() { this.entries = []; }

  add(attacker, victim, isKill) {
    this.entries.unshift({
      text:    isKill ? `${attacker} eliminated ${victim}!` : `${attacker} hit ${victim}`,
      color:   P_COLORS[P_NAMES.indexOf(attacker)],
      ttl:     isKill ? 4.5 : 2.8,
      maxTtl:  isKill ? 4.5 : 2.8,
      isKill,
    });
    if (this.entries.length > 5) this.entries.length = 5;
  }

  addPickup(playerName, label) {
    const pColor = P_COLORS[P_NAMES.indexOf(playerName)];
    this.entries.unshift({
      text:   `${playerName} picked up ${label}!`,
      color:  pColor,
      ttl:    2.2,
      maxTtl: 2.2,
      isKill: false,
      isPickup: true,
    });
    if (this.entries.length > 5) this.entries.length = 5;
  }

  update(dt) {
    this.entries = this.entries.filter(e => { e.ttl -= dt; return e.ttl > 0; });
  }

  draw(ctx, x, y) {
    ctx.save();
    ctx.textAlign = 'right';
    this.entries.forEach((e, i) => {
      const alpha = Math.min(1, e.ttl / 0.6) * (e.isKill ? 1 : 0.85);
      const yp = y + i * 20;
      ctx.font = e.isKill ? 'bold 12px Outfit' : '11px Outfit';
      ctx.shadowColor = e.isPickup ? '#00e5ff' : e.color;
      ctx.shadowBlur  = e.isKill ? 8 : 4;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(e.text, x, yp);
    });
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════
//  CONFETTI  (Improvement #4)
// ═══════════════════════════════════════════════════════════
class Confetti {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.particles = [];
    this._spawn();
  }

  _spawn() {
    const colors = ['#ff6b35','#38bdf8','#ffcc00','#a855f7','#22c55e','#f43f5e','#fb923c'];
    for (let i = 0; i < 140; i++) {
      this.particles.push({
        x: Math.random() * this.W,
        y: -20 - Math.random() * this.H * 0.5,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 8,
        w: 8 + Math.random() * 8,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.9 + Math.random() * 0.1,
      });
    }
  }

  update(dt) {
    this.particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.rotV * dt;
      p.vx  += (Math.random() - 0.5) * 0.3;
      p.vy  = Math.min(p.vy + 2 * dt, 8);
    });
    this.particles = this.particles.filter(p => p.y < this.H + 30);
  }

  draw(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════
class NerfArena {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.keys   = {};
    this.state  = 'setup';
    this.lastTs = 0;
    this.time   = 0;
    this.textures = [];

    this.players    = [];
    this.map        = null;
    this.palette    = null;
    this.targetHits = 5;
    this.arenaIdx   = 0;

    this._cdCount     = 3;
    this._cdTimer     = 0;
    this._globalShake = 0;
    this._shakeAngle  = 0;

    // Improvement systems
    this.pickups    = [];
    this._pickupTimer = 0;
    this.killFeed   = new KillFeed();
    this.confetti   = null;

    this._bindUI();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    const BLOCKED = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space',
                     'KeyW','KeyS','KeyA','KeyD','KeyR','Enter','Slash',
                     'KeyQ','Numpad0'];  // ADS keys also blocked
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (BLOCKED.includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    requestAnimationFrame(ts => this._loop(ts));
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
    this._floorCeilCache = null;
  }

  // ─── UI Binding ────────────────────────────────────────────
  _bindUI() {
    document.querySelectorAll('.diff-opt').forEach(el => {
      el.addEventListener('click', () => {
        const grp = el.closest('.option-group');
        grp.querySelectorAll('.diff-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        const input = el.querySelector('input');
        input.checked = true;
        Sfx.click();

        if (input.name === 'gamemode') {
          const isCampaign = input.value === 'campaign';
          const isDavid    = input.value === 'david';
          const isAlt = isCampaign || isDavid;
          document.getElementById('duelSettings').style.display = isAlt ? 'none' : 'block';
          document.getElementById('ctrlDivider').style.display = isAlt ? 'none' : 'block';
          document.getElementById('player2Controls').style.display = isAlt ? 'none' : 'block';

          const p1Controls = document.getElementById('player1Controls');
          if (isDavid) {
            p1Controls.innerHTML = `
              <h4><span class="player-color-1">David</span></h4>
              <p><b>W / S</b> — Move forward / back</p>
              <p><b>A / D</b> — Turn left / right</p>
              <p><b>Hold Space</b> — Charge sling, release to fire</p>
              <p><b>R</b> — Gather more stones</p>
            `;
          } else if (isCampaign) {
            p1Controls.innerHTML = `
              <h4><span class="player-color-1">Single Player</span></h4>
              <p><b>↑ / ↓</b> — Move forward / back</p>
              <p><b>← / →</b> — Turn left / right</p>
              <p><b>LClick / Space</b> — Shoot</p>
              <p><b>R</b> — Reload</p>
            `;
          } else {
            p1Controls.innerHTML = `
              <h4><span class="player-color-1">Player 1</span></h4>
              <p><b>W / S</b> — Move forward / back</p>
              <p><b>A / D</b> — Turn left / right</p>
              <p><b>Space</b> — Shoot &nbsp;<b>Q</b> — Aim</p>
              <p><b>R</b> — Reload</p>
            `;
          }
        }
      });
    });

    document.getElementById('startBtn').addEventListener('click', () => {
      const mode = document.querySelector('input[name="gamemode"]:checked')?.value || 'duel';
      if (mode === 'campaign') {
        window.location.href = 'nerf-campaign.html';
      } else if (mode === 'david') {
        window.location.href = 'david.html';
      } else {
        this._startGame();
      }
    });

    document.getElementById('restartBtn').addEventListener('click', () => this._goSetup());
  }

  _startGame() {
    Sfx._r();
    this.targetHits = parseInt(document.querySelector('input[name="target"]:checked')?.value || '5');
    this.arenaIdx   = parseInt(document.querySelector('input[name="arena"]:checked')?.value  || '0');
    this.map        = MAPS[this.arenaIdx];
    this.palette    = WALL_PALETTES[this.arenaIdx];
    this._generateTextures();
    this._floorCeilCache = null;

    document.getElementById('gameSetup').style.display   = 'none';
    document.getElementById('gameResults').style.display = 'none';

    // P1: WASD + Space fire + Q for ADS
    // P2: Arrows + Enter fire + Numpad0 for ADS
    const starts = STARTS[this.arenaIdx];
    const C1 = { fwd:'KeyW', back:'KeyS', turnL:'KeyA', turnR:'KeyD', shoot:'Space', reload:'KeyR', ads:'KeyQ' };
    const C2 = { fwd:'ArrowUp', back:'ArrowDown', turnL:'ArrowLeft', turnR:'ArrowRight', shoot:'Enter', reload:'Slash', ads:'Numpad0' };

    this.players = [
      new Player(0, C1, starts[0]),
      new Player(1, C2, starts[1]),
    ];

    // Reset systems
    this.pickups       = [];
    this._pickupTimer  = 5;  // first pickup spawns in 5s
    this.killFeed      = new KillFeed();
    this.confetti      = null;

    this._cdCount = 3;
    this._cdTimer = 0.9;
    this.state = 'countdown';
    Sfx.countdown();
    this._showBanner('NERF ARENA!');
  }

  _goSetup() {
    document.getElementById('gameSetup').style.display   = '';
    document.getElementById('gameResults').style.display = 'none';
    this.state = 'setup';
    this.confetti = null;
  }

  _showBanner(text) {
    const el = document.getElementById('levelBanner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // ─── Procedural Textures ────────────────────────────────────
  _generateTextures() {
    this.textures = [];
    const S = 128;
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const base = this.palette[i] || '#444';

      const r0 = parseInt(base.slice(1,3),16);
      const g0 = parseInt(base.slice(3,5),16);
      const b0 = parseInt(base.slice(5,7),16);

      if (i === 0) { this.textures.push(c); continue; }

      g.fillStyle = base;
      g.fillRect(0, 0, S, S);

      if (i === 1 || i === 6 || i === 7) {
        const grad = g.createLinearGradient(0,0,0,S);
        grad.addColorStop(0, `rgba(255,255,255,0.12)`);
        grad.addColorStop(1, `rgba(0,0,0,0.2)`);
        g.fillStyle = grad; g.fillRect(0, 0, S, S);
        g.fillStyle = `rgba(0,0,0,0.5)`;
        g.fillRect(0, 0, S, 7); g.fillRect(0, S-7, S, 7);
        g.fillRect(0, 0, 7, S); g.fillRect(S-7, 0, 7, S);
        g.fillStyle = `rgba(255,255,255,0.08)`;
        g.fillRect(7, 7, S-14, 4);
        g.fillStyle = `rgba(0,0,0,0.35)`;
        g.fillRect(0, S/2-2, S, 4);
        g.fillStyle = `rgba(255,255,255,0.06)`;
        g.fillRect(0, S/2-2, S, 1);
        g.fillStyle = `rgba(0,0,0,0.6)`;
        const rv = [[10,10],[S-14,10],[10,S-14],[S-14,S-14]];
        rv.forEach(([rx,ry]) => { g.beginPath(); g.roundRect(rx, ry, 4, 4, 1); g.fill(); });
        g.fillStyle = `rgba(255,255,255,0.25)`;
        rv.forEach(([rx,ry]) => { g.fillRect(rx, ry, 2, 1); });
      }
      else if (i === 2) {
        g.fillStyle = `rgba(0,0,0,0.55)`; g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 14) {
          g.fillStyle = base; g.fillRect(0, y, S, 7);
          g.fillStyle = `rgba(255,255,255,0.1)`; g.fillRect(0, y, S, 1);
          g.fillStyle = `rgba(0,0,0,0.3)`; g.fillRect(0, y+6, S, 1);
        }
        g.fillStyle = this._mixColor(r0,g0,b0, 0.65);
        g.fillRect(28, 0, 14, S); g.fillRect(86, 0, 14, S);
        g.fillStyle = `rgba(0,0,0,0.4)`;
        g.fillRect(28, 0, 1, S); g.fillRect(41, 0, 1, S);
        g.fillRect(86, 0, 1, S); g.fillRect(99, 0, 1, S);
      }
      else if (i === 3) {
        g.fillStyle = '#e0a800'; g.fillRect(0, 0, S, S);
        g.fillStyle = '#111';
        for (let j = -S; j < S*2; j += 30) {
          g.beginPath(); g.moveTo(j, 0); g.lineTo(j+30, 0);
          g.lineTo(j-S+30, S); g.lineTo(j-S, S); g.closePath(); g.fill();
        }
        g.fillStyle = `rgba(0,0,0,0.55)`;
        g.fillRect(0,0,S,8); g.fillRect(0,S-8,S,8);
        g.fillRect(0,0,8,S); g.fillRect(S-8,0,8,S);
        g.fillStyle = `rgba(255,255,255,0.06)`;
        g.fillRect(8, 8, S-16, 2);
      }
      else if (i === 4) {
        g.fillStyle = this._mixColor(r0,g0,b0, 0.75);
        g.fillRect(12, 12, S-24, S-24);
        g.fillStyle = `rgba(255,255,255,0.07)`; g.fillRect(12, 12, S-24, 2);
        const lx = S/2-6, ly = S/2-20, lw = 12, lh = 40;
        g.shadowColor = '#00e5ff'; g.shadowBlur = 20;
        g.fillStyle = '#00e5ff'; g.fillRect(lx, ly, lw, lh);
        g.shadowBlur = 0;
        g.fillStyle = `rgba(0,0,0,0.7)`; g.fillRect(lx+2, ly+lh*0.5, lw-4, lh*0.45);
        [0.2, 0.5, 0.8].forEach(t => {
          g.fillStyle = `rgba(0,0,0,0.5)`;
          g.beginPath(); g.roundRect(4, t*S-3, 8, 6, 1); g.fill();
          g.beginPath(); g.roundRect(S-12, t*S-3, 8, 6, 1); g.fill();
        });
      }
      else if (i === 5) {
        g.fillStyle = '#111'; g.fillRect(0, 0, S, S);
        for (let cx = 6; cx < S-6; cx += 22) {
          g.fillStyle = '#2a2a2a'; g.fillRect(cx, 4, 16, S-8);
          g.fillStyle = '#1a1a1a'; g.fillRect(cx, 4, 1, S-8); g.fillRect(cx+15, 4, 1, S-8);
          for (let cy = 10; cy < S-10; cy += 10) {
            if (Math.random() > 0.28) {
              const colors = ['#ff2020','#20ff40','#2090ff','#ffaa00'];
              g.fillStyle = colors[Math.floor(Math.random()*colors.length)];
              g.fillRect(cx+4, cy, 8, 4);
            }
          }
        }
      }

      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (let n = 0; n < 400; n++) g.fillRect(Math.random()*S, Math.random()*S, 2, 2);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      for (let n = 0; n < 250; n++) g.fillRect(Math.random()*S, Math.random()*S, 2, 2);
      this.textures.push(c);
    }
  }

  // ─── Game Loop ───────────────────────────────────────────────
  _loop(ts) {
    const dt = clamp((ts - this.lastTs) / 1000, 0, 0.05);
    this.lastTs = ts;
    this.time  += dt;
    this._update(dt);
    this._draw();
    requestAnimationFrame(ts2 => this._loop(ts2));
  }

  // ─── Update ─────────────────────────────────────────────────
  _update(dt) {
    if (this.state === 'setup') return;

    // Confetti runs even on results screen
    if (this.confetti) this.confetti.update(dt);

    if (this.state === 'results') return;

    if (this.state === 'countdown') {
      this._cdTimer -= dt;
      if (this._cdTimer <= 0) {
        this._cdCount--;
        if (this._cdCount > 0) { this._cdTimer = 0.9; Sfx.countdown(); }
        else { this.state = 'playing'; Sfx.go(); }
      }
      // During countdown still render but don't process input
      return;
    }

    // Decay screen shake
    this._globalShake = Math.max(0, this._globalShake - dt * 18);
    this._shakeAngle += dt * 37;

    // Pickup spawning (Improvement #1)
    this._pickupTimer -= dt;
    if (this._pickupTimer <= 0 && this.pickups.length < 3) {
      this._spawnPickup();
      this._pickupTimer = 8 + Math.random() * 6;
    }

    // Pickup bob animation
    this.pickups.forEach(pk => { pk.bob += dt * 2.8; pk.spin += dt * 1.5; });

    // Kill feed update (Improvement #2)
    this.killFeed.update(dt);

    this.players.forEach((p, i) => this._updatePlayer(p, this.players[1-i], dt));

    // Win check
    if (this.state === 'playing') {
      const winner = this.players.find(p => p.hits >= this.targetHits);
      if (winner) {
        this.state = 'done';
        Sfx.win();
        this.confetti = new Confetti(this.W, this.H);
        setTimeout(() => this._showResults(winner), 1800);
      }
    }
  }

  // ─── Pickup Spawning ─────────────────────────────────────────
  _spawnPickup() {
    const map   = this.map;
    const ROWS  = map.length, COLS = map[0].length;
    // Find random empty tile
    for (let tries = 0; tries < 40; tries++) {
      const r = 1 + Math.floor(Math.random() * (ROWS-2));
      const c = 1 + Math.floor(Math.random() * (COLS-2));
      if (map[r][c] === 0) {
        const type = Math.random() < 0.65 ? 'ammo' : 'speed';
        this.pickups.push(new Pickup(c + 0.5, r + 0.5, type));
        return;
      }
    }
  }

  _updatePlayer(p, opp, dt) {
    const k = this.keys;

    // Timers
    p.hitFlash    = Math.max(0, p.hitFlash    - dt);
    p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    p.gunRecoil   = Math.max(0, p.gunRecoil   - dt * 6);
    p._shootCd    = Math.max(0, p._shootCd    - dt);
    p.invincible  = Math.max(0, p.invincible  - dt);
    p.hitPop      = Math.max(0, p.hitPop      - dt * 3);
    p.speedBoost  = Math.max(0, p.speedBoost  - dt);
    p._adsSfxCd   = Math.max(0, p._adsSfxCd   - dt);

    // ── ADS (Improvement #3) ──
    const wantsAds = k[p.ctrl.ads] || false;
    if (wantsAds !== p.ads) {
      p.ads = wantsAds;
      if (p._adsSfxCd <= 0) { Sfx.ads(); p._adsSfxCd = 0.15; }
    }
    const targetFov = p.ads ? FOV_ADS : FOV_NORMAL;
    p.fov += (targetFov - p.fov) * Math.min(1, FOV_LERP_SPD * dt);
    p.adsMult = p.ads ? 0.45 : 1.0;  // slow turning while ADS

    // ── Reload ──
    if (p.reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) { p.ammo = MAX_AMMO; p.reloading = false; }
    }
    if (!p.reloading && k[p.ctrl.reload] && p.ammo < MAX_AMMO) {
      p.reloading = true; p.reloadTimer = RELOAD_TIME; Sfx.reload();
    }

    // ── Shoot (only when playing, FIX: was missing state check) ──
    if (this.state === 'playing' && k[p.ctrl.shoot] && !p.reloading && p._shootCd <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        p.shotsFired++;
        p._shootCd    = p.ads ? 0.22 : 0.18;  // slight penalty while ADS
        p.muzzleFlash = 0.10;
        p.gunRecoil   = 0.4;
        Sfx.shoot();
        // ADS = tighter spread
        const spread = (Math.random() - 0.5) * (p.ads ? 0.008 : 0.03);
        p.darts.push({
          x: p.x, y: p.y,
          vx: Math.cos(p.angle + spread) * DART_SPD,
          vy: Math.sin(p.angle + spread) * DART_SPD,
          life: 3.0,
        });
      } else if (!p.reloading) {
        // FIX: only trigger empty + auto-reload if not already reloading
        p._shootCd    = 0.5;
        Sfx.empty();
        p.reloading   = true;
        p.reloadTimer = RELOAD_TIME;
        Sfx.reload();
      }
    }

    // ── Movement ──
    if (this.state !== 'playing') return;

    const speedMult  = p.speedBoost > 0 ? 1.6 : 1.0;
    const targetFwd  = k[p.ctrl.fwd]   ? MOVE_SPD * speedMult : k[p.ctrl.back] ? -MOVE_SPD * 0.6 * speedMult : 0;
    const targetTurn = k[p.ctrl.turnL] ? -TURN_SPD * p.adsMult : k[p.ctrl.turnR] ? TURN_SPD * p.adsMult : 0;

    p.velFwd  += (targetFwd  - p.velFwd)  * Math.min(1, MOVE_ACCEL  * dt);
    p.velTurn += (targetTurn - p.velTurn) * Math.min(1, TURN_ACCEL  * dt);

    p.angle += p.velTurn * dt;

    const cosA = Math.cos(p.angle), sinA = Math.sin(p.angle);
    const nx = p.x + cosA * p.velFwd * dt;
    const ny = p.y + sinA * p.velFwd * dt;
    const m  = WALL_MARGIN;

    if (!this._wallAt(nx + m*Math.sign(cosA), p.y) &&
        !this._wallAt(nx - m*Math.sign(cosA), p.y)) p.x = nx;
    if (!this._wallAt(p.x, ny + m*Math.sign(sinA)) &&
        !this._wallAt(p.x, ny - m*Math.sign(sinA))) p.y = ny;

    // Pickup collection (Improvement #1)
    this.pickups = this.pickups.filter(pk => {
      if (!pk.alive) return false;
      const ddx = pk.x - p.x, ddy = pk.y - p.y;
      if (ddx*ddx + ddy*ddy < 0.5*0.5) {
        // Collect!
        if (pk.type === 'ammo') {
          p.ammo = MAX_AMMO;
          if (p.reloading) { p.reloading = false; }
        } else if (pk.type === 'speed') {
          p.speedBoost = PICKUP_TYPES.speed.duration;
        }
        Sfx.pickup();
        this.killFeed.addPickup(p.name, PICKUP_TYPES[pk.type].label);
        pk.alive = false;
        return false;
      }
      return true;
    });

    // Gun bob
    const moving = Math.abs(p.velFwd) > 0.15;
    if (moving) {
      p.bobTimer  += dt * 7;
      p.gunSwayX   = Math.sin(p.bobTimer) * (p.ads ? 1.5 : 5);
      p.gunSwayY   = Math.abs(Math.sin(p.bobTimer)) * (p.ads ? 1 : 4);
      p._stepTimer -= dt;
      if (p._stepTimer <= 0) { Sfx.step(); p._stepTimer = 0.32; }
    } else {
      p.bobTimer  += dt * 1.2;
      p.gunSwayX   = Math.sin(p.bobTimer) * (p.ads ? 0.3 : 0.9);
      p.gunSwayY   = 0;
      p._stepTimer = 0;
    }

    // ── Dart physics ──
    p.darts = p.darts.filter(dart => {
      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
      dart.life -= dt;

      if (this._wallAt(Math.floor(dart.x), Math.floor(dart.y))) {
        Sfx.splat(); return false;
      }
      if (opp.invincible <= 0) {
        const ddx = dart.x - opp.x, ddy = dart.y - opp.y;
        if (ddx*ddx + ddy*ddy < HIT_DIST*HIT_DIST) {
          p.hits++;
          p.shotsHit++;
          opp.hitFlash   = 0.55;
          opp.invincible = INVINCIBLE_T;
          p.hitPop       = 1.0;
          this._globalShake = 7;
          Sfx.hit();
          const isWin = p.hits >= this.targetHits;
          this.killFeed.add(p.name, opp.name, isWin);
          const msg = isWin
            ? `🏆 ${p.name} WINS!`
            : `🎯 ${p.name} hits! ${p.hits}/${this.targetHits}`;
          this._showBanner(msg);
          return false;
        }
      }
      return dart.life > 0;
    });
  }

  _wallAt(mx, my) {
    if (my < 0 || my >= this.map.length || mx < 0 || mx >= this.map[0].length) return true;
    return this.map[Math.floor(my)][Math.floor(mx)] > 0;
  }

  // ─── Results Screen (Improvement #4: accuracy + confetti) ──
  _showResults(winner) {
    this.state = 'results';
    document.getElementById('gameResults').style.display = 'flex';
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    document.getElementById('resultsIcon').textContent  = '🏆';
    document.getElementById('resultsTitle').textContent = `${winner.name} Wins!`;

    [...this.players].sort((a,b) => b.hits - a.hits).forEach((p, i) => {
      const acc = p.shotsFired > 0 ? Math.round((p.shotsHit / p.shotsFired) * 100) : 0;
      const e = document.createElement('div');
      e.className = 'result-entry';
      e.innerHTML = `
        <span class="result-pos">${i===0?'🥇 1st':'🥈 2nd'}</span>
        <span class="result-swatch" style="background:${p.color}"></span>
        <span class="result-name">${p.name}</span>
        <span class="result-stats">
          <span class="result-stat">${p.hits} hits</span>
          <span class="result-acc">${acc}% acc</span>
          <span class="result-shots">${p.shotsFired} shots</span>
        </span>`;
      list.appendChild(e);
    });

    // Render confetti behind the overlay in the game loop
    if (!this.confetti) this.confetti = new Confetti(this.W, this.H);
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDERING
  // ═══════════════════════════════════════════════════════════
  _draw() {
    const ctx = this.ctx;
    ctx.save();

    if (this._globalShake > 0.05) {
      const sx = Math.cos(this._shakeAngle) * this._globalShake;
      const sy = Math.sin(this._shakeAngle * 1.3) * this._globalShake * 0.6;
      ctx.translate(sx, sy);
    }

    ctx.clearRect(-20, -20, this.W+40, this.H+40);

    if (this.state === 'setup') {
      ctx.fillStyle = '#060c1a';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
      return;
    }

    // Draw confetti under results overlay
    if (this.state === 'results' || this.state === 'done') {
      ctx.fillStyle = '#060c1a';
      ctx.fillRect(0, 0, this.W, this.H);
      if (this.confetti) this.confetti.draw(ctx);
      ctx.restore();
      return;
    }

    const vpW = Math.floor(this.W / 2);
    const vpH = this.H;

    // P1 — left half
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[0], this.players[1], 0, 0, vpW, vpH);
    this._drawMinimap(ctx, this.players[0], 0, vpW, vpH);
    ctx.restore();

    // P2 — right half
    ctx.save();
    ctx.beginPath(); ctx.rect(vpW, 0, vpW, vpH); ctx.clip();
    this._drawView(ctx, this.players[1], this.players[0], vpW, 0, vpW, vpH);
    this._drawMinimap(ctx, this.players[1], vpW, vpW, vpH);
    ctx.restore();

    // Kill feed (Improvement #2) — drawn in center above the divider
    this.killFeed.draw(ctx, this.W - 14, 22);

    // Divider — glowing seam
    ctx.fillStyle = '#000';
    ctx.fillRect(vpW-2, 0, 4, vpH);
    const divGrad = ctx.createLinearGradient(vpW-2, 0, vpW+2, 0);
    divGrad.addColorStop(0, 'rgba(255,255,255,0)');
    divGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    divGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = divGrad;
    ctx.fillRect(vpW-2, 0, 4, vpH);

    if (this.state === 'countdown') this._drawCountdown(ctx);

    ctx.restore();
  }

  _drawView(ctx, p, opp, ox, oy, vpW, vpH) {
    const halfH = vpH / 2;

    // ADS vignette darkens the edges
    const adsAlpha = p.ads ? (1 - (p.fov - FOV_ADS) / (FOV_NORMAL - FOV_ADS)) * 0.55 : 0;

    // ── Ceiling ──
    const ceilG = ctx.createLinearGradient(0, oy, 0, oy + halfH);
    ceilG.addColorStop(0, '#060609');
    ceilG.addColorStop(1, '#141420');
    ctx.fillStyle = ceilG;
    ctx.fillRect(ox, oy, vpW, halfH);

    // ── Floor ──
    const floorG = ctx.createLinearGradient(0, oy + halfH, 0, oy + vpH);
    floorG.addColorStop(0, '#030303');
    floorG.addColorStop(0.45, '#0d0d12');
    floorG.addColorStop(1, '#191926');
    ctx.fillStyle = floorG;
    ctx.fillRect(ox, oy + halfH, vpW, halfH);

    // ── Neon floor grid ──
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 18; i++) {
      const t = Math.pow(i / 18, 1.8);
      const y = oy + halfH + t * halfH;
      if (y > oy + vpH) break;
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + vpW, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.07)';
    for (let j = -6; j <= 6; j++) {
      const px2 = ox + vpW/2 + j * vpW * 0.16;
      ctx.beginPath();
      ctx.moveTo(ox + vpW/2, oy + halfH);
      ctx.lineTo(px2, oy + vpH);
      ctx.stroke();
    }
    ctx.restore();

    // ── Textured Walls ──
    const zBuf = new Float32Array(vpW);
    const halfFov = p.fov / 2;  // use player's current (lerped) FOV

    for (let col = 0; col < vpW; col++) {
      const rayAngle = p.angle - halfFov + (col / vpW) * p.fov;
      const { dist, wallType, side, wallX } = castRay(this.map, p.x, p.y, rayAngle);

      const cDist = Math.max(0.04, dist * Math.cos(rayAngle - p.angle));
      zBuf[col] = cDist;

      if (wallType === 0) continue;

      const wallH = Math.min(vpH * 4, vpH / cDist);
      const wallY = (vpH - wallH) / 2;

      const tex = this.textures[wallType] || this.textures[1];
      const TW = tex.width, TH = tex.height;
      let texX = Math.floor(wallX * TW);
      if (side === 0 && Math.cos(rayAngle) > 0) texX = TW - texX - 1;
      if (side === 1 && Math.sin(rayAngle) < 0) texX = TW - texX - 1;
      texX = clamp(texX, 0, TW-1);

      ctx.drawImage(tex, texX, 0, 1, TH, ox+col, oy+wallY, 1, wallH);

      let fog = clamp(cDist / 14, 0, 1) * 0.92;
      if (side === 1) fog = clamp(fog + 0.22, 0, 1);

      if (fog > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${fog.toFixed(2)})`;
        ctx.fillRect(ox+col, oy+wallY, 1, wallH);
      }

      const aoY = oy + wallY + wallH;
      if (aoY > oy + halfH && aoY < oy + vpH) {
        const aoH = Math.min(wallH * 0.18, 55);
        ctx.fillStyle = `rgba(0,0,0,0.5)`;
        ctx.fillRect(ox+col, aoY - aoH, 1, aoH);
      }
    }

    // ── Pickup billboards (Improvement #1) ──
    this.pickups.forEach(pk => {
      this._drawPickup(ctx, p, pk, ox, oy, vpW, vpH, zBuf);
    });

    // ── Opponent sprite ──
    this._drawSprite(ctx, p, opp, ox, oy, vpW, vpH, zBuf);

    // ── Dart projectiles ──
    this.players.forEach(shooter => {
      shooter.darts.forEach(dart => {
        this._drawDart(ctx, p, dart, shooter.color, ox, oy, vpW, vpH, zBuf);
      });
    });

    // ── Muzzle flash ──
    if (p.muzzleFlash > 0) {
      const mf = p.muzzleFlash / 0.10;
      ctx.fillStyle = `rgba(255,220,80,${mf * 0.18})`;
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── Hit damage overlay ──
    if (p.hitFlash > 0) {
      const hf = p.hitFlash / 0.55;
      const vigG = ctx.createRadialGradient(
        ox+vpW/2, oy+vpH/2, vpH*0.1,
        ox+vpW/2, oy+vpH/2, vpH*0.85
      );
      vigG.addColorStop(0, `rgba(200,0,0,0)`);
      vigG.addColorStop(1, `rgba(220,0,0,${hf * 0.55})`);
      ctx.fillStyle = vigG;
      ctx.fillRect(ox, oy, vpW, vpH);
      ctx.fillStyle = `rgba(255,30,30,${hf * 0.15})`;
      ctx.fillRect(ox, oy, vpW, vpH);
      ctx.strokeStyle = `rgba(255,60,60,${hf * 0.8})`;
      ctx.lineWidth   = 2.5;
      const cx2 = ox+vpW/2, cy2 = oy+vpH/2, mk = 18, mg = 5;
      ctx.beginPath(); ctx.moveTo(cx2-mk-mg, cy2); ctx.lineTo(cx2-mg, cy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2+mg, cy2);     ctx.lineTo(cx2+mk+mg, cy2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2, cy2-mk-mg);  ctx.lineTo(cx2, cy2-mg); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx2, cy2+mg);     ctx.lineTo(cx2, cy2+mk+mg); ctx.stroke();
    }

    // ── Invincibility flicker ──
    if (p.invincible > 0 && Math.floor(this.time * 12) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── ADS scope overlay (Improvement #3) ──
    if (adsAlpha > 0.01) {
      // Dark vignette around the scope
      const scopeG = ctx.createRadialGradient(
        ox+vpW/2, oy+vpH/2, vpH * 0.18,
        ox+vpW/2, oy+vpH/2, vpH * 0.72
      );
      scopeG.addColorStop(0, `rgba(0,0,0,0)`);
      scopeG.addColorStop(1, `rgba(0,0,0,${adsAlpha})`);
      ctx.fillStyle = scopeG;
      ctx.fillRect(ox, oy, vpW, vpH);
    }

    // ── Crosshair ──
    this._drawCrosshair(ctx, p, ox, oy, vpW, vpH);

    // ── Gun sprite ──
    this._drawGun(ctx, p, ox, oy, vpW, vpH);

    // ── HUD ──
    this._drawHUD(ctx, p, ox, oy, vpW, vpH);
  }

  // ─── Pickup Billboard (Improvement #1) ─────────────────────
  _drawPickup(ctx, viewer, pk, ox, oy, vpW, vpH, zBuf) {
    const dx = pk.x - viewer.x, dy = pk.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.3 || dist > 14) return;

    const sa = Math.atan2(dy, dx) - viewer.angle;
    const na = Math.atan2(Math.sin(sa), Math.cos(sa));
    const halfFov = viewer.fov / 2;
    if (Math.abs(na) > halfFov + 0.2) return;

    const sx  = (na / viewer.fov + 0.5) * vpW;
    const sH  = clamp(vpH / dist, 20, vpH * 0.7);
    const sW  = sH;
    const bob = Math.sin(pk.bob) * 5;
    const sY  = (vpH - sH) / 2 + bob;

    const sC = Math.floor(sx - sW/2), eC = Math.floor(sx + sW/2);
    const info = PICKUP_TYPES[pk.type];

    const pulseSin = 0.6 + Math.abs(Math.sin(pk.bob * 0.9)) * 0.4;

    for (let col = Math.max(0, sC); col < Math.min(vpW, eC); col++) {
      // FIX: dart z-buffer comparison — >= blocks darts behind wall
      if (zBuf[col] <= dist) continue;

      const u = (col - sC) / Math.max(1, eC - sC);
      const brt = Math.max(0.4, 1 - dist / 10);
      // Outer glow ring
      const isRing = u < 0.08 || u > 0.92 || (u > 0.42 && u < 0.58);
      if (isRing) {
        ctx.fillStyle = `rgba(255,255,255,${brt * 0.15})`;
      } else {
        ctx.fillStyle = pk.type === 'ammo'
          ? `rgba(255, 200, 0, ${brt * pulseSin})`
          : `rgba(0, 220, 255, ${brt * pulseSin})`;
      }
      ctx.fillRect(ox+col, oy+sY, 1, sH);
    }

    // Draw label text as a billboard (only if not too far)
    if (dist < 5) {
      const labelAlpha = Math.max(0, 1 - dist / 5);
      ctx.save();
      ctx.font = `bold ${Math.max(8, 14 / dist)}px Outfit`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${labelAlpha})`;
      ctx.shadowColor = info.glowColor;
      ctx.shadowBlur  = 8;
      ctx.fillText(info.label, ox + sx, oy + sY - 4);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ─── Opponent Sprite ────────────────────────────────────────
  _drawSprite(ctx, viewer, sprite, ox, oy, vpW, vpH, zBuf) {
    const dx = sprite.x - viewer.x, dy = sprite.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.25) return;

    const spriteAngle = Math.atan2(dy, dx) - viewer.angle;
    const normAngle   = Math.atan2(Math.sin(spriteAngle), Math.cos(spriteAngle));
    const halfFov = viewer.fov / 2;
    if (Math.abs(normAngle) > halfFov + 0.25) return;

    const screenX  = (normAngle / viewer.fov + 0.5) * vpW;
    const spriteH  = Math.min(vpH * 1.9, vpH / dist);
    const spriteW  = spriteH * 0.62;
    const spriteTop = (vpH - spriteH) / 2;
    const brt      = Math.max(0.35, 1 - dist / 11);

    const startCol = Math.floor(screenX - spriteW/2);
    const endCol   = Math.floor(screenX + spriteW/2);

    const flickOff = sprite.invincible > 0 && Math.floor(this.time * 12) % 2 === 0;
    if (flickOff) return;

    for (let col = Math.max(0, startCol); col < Math.min(vpW, endCol); col++) {
      // FIX: use <= for correct z-comparison
      if (zBuf[col] <= dist) continue;

      const u = (col - startCol) / Math.max(1, endCol - startCol);

      if (u > 0.28 && u < 0.72) {
        const hTop = spriteTop, hH = spriteH * 0.22;
        ctx.fillStyle = (u < 0.33 || u > 0.67)
          ? `rgba(8,8,12,${brt})`
          : `rgba(235,240,255,${brt})`;
        ctx.fillRect(ox+col, oy+hTop, 1, hH);
        if (u > 0.37 && u < 0.63) {
          const vTop = hTop + hH*0.28, vH = hH*0.38;
          ctx.fillStyle = sprite.color;
          ctx.fillRect(ox+col, oy+vTop, 1, vH);
          if (u > 0.44 && u < 0.56) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ox+col, oy+vTop+2, 1, vH-4);
          }
        }
        if (u > 0.35 && u < 0.65) {
          const cTop = hTop + hH * 0.75, cH = hH * 0.25;
          ctx.fillStyle = `rgba(180,185,200,${brt})`;
          ctx.fillRect(ox+col, oy+cTop, 1, cH);
        }
      }

      if ((u > 0.12 && u <= 0.28) || (u >= 0.72 && u < 0.88)) {
        const aTop = spriteTop + spriteH*0.21, aH = spriteH*0.46;
        if (u < 0.17 || u > 0.83) {
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
        } else {
          const isPad = (u < 0.28 && u > 0.17) || (u > 0.72 && u < 0.83);
          ctx.fillStyle = isPad ? sprite.color : `rgba(55,60,65,${brt})`;
        }
        ctx.fillRect(ox+col, oy+aTop, 1, aH);
        const handTop = aTop + aH*0.8;
        ctx.fillStyle = `rgba(225,175,115,${brt})`;
        ctx.fillRect(ox+col, oy+handTop, 1, aH*0.2);
        if (u > 0.14 && u <= 0.28) {
          const gTop = handTop - spriteH*0.04, gH = spriteH*0.2;
          ctx.fillStyle = `rgba(8,8,12,${brt})`;
          ctx.fillRect(ox+col, oy+gTop-1, 1, gH+2);
          ctx.fillStyle = '#ff6600';
          ctx.fillRect(ox+col, oy+gTop, 1, gH);
        }
      }

      if (u > 0.28 && u < 0.72) {
        const tTop = spriteTop + spriteH*0.22, tH = spriteH*0.45;
        ctx.fillStyle = (u < 0.33 || u > 0.67)
          ? `rgba(8,8,12,${brt})`
          : `rgba(235,240,255,${brt})`;
        ctx.fillRect(ox+col, oy+tTop, 1, tH);
        if (u > 0.44 && u < 0.56) {
          const rTop = tTop+tH*0.18, rH = tH*0.32;
          ctx.fillStyle = sprite.color;
          ctx.fillRect(ox+col, oy+rTop, 1, rH);
        }
        const bTop = tTop+tH-spriteH*0.07, bH = spriteH*0.07;
        ctx.fillStyle = `rgba(25,25,30,${brt})`;
        ctx.fillRect(ox+col, oy+bTop, 1, bH);
      }

      if (u > 0.3 && u < 0.7 && !(u > 0.46 && u < 0.54)) {
        const lTop = spriteTop+spriteH*0.67, lH = spriteH*0.33;
        ctx.fillStyle = (u < 0.34 || u > 0.66 || (u > 0.43 && u < 0.46) || (u > 0.54 && u < 0.57))
          ? `rgba(8,8,12,${brt})`
          : `rgba(75,80,88,${brt})`;
        ctx.fillRect(ox+col, oy+lTop, 1, lH);
        const kTop = lTop+lH*0.28, kH = lH*0.26;
        ctx.fillStyle = sprite.color;
        ctx.fillRect(ox+col, oy+kTop, 1, kH);
      }
    }
  }

  // ─── Dart Projectile ────────────────────────────────────────
  _drawDart(ctx, viewer, dart, color, ox, oy, vpW, vpH, zBuf) {
    const dx = dart.x - viewer.x, dy = dart.y - viewer.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.18 || dist > 20) return;

    const sa = Math.atan2(dy, dx) - viewer.angle;
    const na = Math.atan2(Math.sin(sa), Math.cos(sa));
    const halfFov = viewer.fov / 2;
    if (Math.abs(na) > halfFov + 0.12) return;

    const sx = (na / viewer.fov + 0.5) * vpW;
    const dH = clamp(7 / dist * 5, 3, vpH * 0.4);
    const dW = dH * 2.8;
    const dY = vpH / 2 - dH / 2;

    const sC = Math.floor(sx - dW/2), eC = Math.floor(sx + dW/2);
    for (let col = Math.max(0, sC); col < Math.min(vpW, eC); col++) {
      // FIX: correct z-test — skip if wall is closer OR at same dist
      if (zBuf[col] <= dist) continue;
      const t = (col - sC) / Math.max(1, eC - sC);
      const brt = Math.max(0.5, 1 - dist/12);
      if (t < 0.22) {
        ctx.fillStyle = `rgba(60,30,15,${brt})`;
      } else if (t < 0.5) {
        ctx.fillStyle = `rgba(255,200,40,${brt})`;
      } else {
        ctx.fillStyle = `rgba(255,130,20,${brt})`;
      }
      ctx.fillRect(ox+col, oy+dY, 1, dH);
    }
  }

  // ─── Crosshair (ADS variant) ─────────────────────────────────
  _drawCrosshair(ctx, p, ox, oy, vpW, vpH) {
    const cx = ox + vpW/2, cy = oy + vpH/2;
    const reloading = p.reloading;
    const adsAmt = 1 - (p.fov - FOV_ADS) / (FOV_NORMAL - FOV_ADS);

    ctx.save();
    ctx.strokeStyle = reloading ? 'rgba(255,200,0,0.6)' : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;

    if (reloading) {
      const pct = 1 - p.reloadTimer / RELOAD_TIME;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, -Math.PI/2, -Math.PI/2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,0,0.5)';
      ctx.font = 'bold 9px Outfit';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R', cx, cy);
    } else if (p.ads && adsAmt > 0.5) {
      // Scope reticle (Improvement #3)
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1;
      const r = 18;
      // Circle
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      // Center dot
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.fill();
      // Crosshair lines touching circle
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(cx-r-6, cy); ctx.lineTo(cx-r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+r, cy);   ctx.lineTo(cx+r+6, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy-r-6); ctx.lineTo(cx, cy-r); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy+r);   ctx.lineTo(cx, cy+r+6); ctx.stroke();
      // Range dots
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      [-r*0.5, r*0.5].forEach(off => {
        ctx.beginPath(); ctx.arc(cx + off, cy, 1.2, 0, Math.PI*2); ctx.fill();
      });
    } else {
      // Classic tactical crosshair
      const gap = 5, len = 10;
      ctx.beginPath(); ctx.moveTo(cx-gap-len, cy); ctx.lineTo(cx-gap, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+gap, cy);     ctx.lineTo(cx+gap+len, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy-gap-len); ctx.lineTo(cx, cy-gap); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy+gap);     ctx.lineTo(cx, cy+gap+len); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  // ─── Gun Viewmodel (ADS raises gun to eye line) ─────────────
  _drawGun(ctx, p, ox, oy, vpW, vpH) {
    const gunColor = p.color;
    const adsAmt   = clamp(1 - (p.fov - FOV_ADS) / (FOV_NORMAL - FOV_ADS), 0, 1);

    const swayX   = p.gunSwayX * 1.5;
    const swayY   = p.gunSwayY * 1.2;
    const recoilY = p.gunRecoil * 45;

    const scale = vpH / 700;

    // ADS: raise gun towards center, scale down slightly
    const hipX = ox + vpW * 0.85;
    const hipY = oy + vpH + 50 * scale;
    const adsX  = ox + vpW * 0.62;
    const adsY  = oy + vpH * 0.72;

    const ax = hipX + (adsX - hipX) * adsAmt + swayX;
    const ay = hipY + (adsY - hipY) * adsAmt + recoilY + swayY;
    const sc = scale * (1 - adsAmt * 0.12);

    const cx = ox + vpW / 2;
    const cy = oy + vpH / 2;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(sc, sc);

    const vpX = (cx - ax) / sc;
    const vpY = (cy - ay) / sc;

    function pt(x, y, z) {
      return [ vpX + (x - vpX) / z, vpY + (y - vpY) / z ];
    }

    function drawFace(fill, pts) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    const mix = (hex, amt) => {
      const [r, g, b] = this._hexToRgb(hex);
      const cl = v => Math.max(0, Math.min(255, Math.round(v)));
      return `rgb(${cl(r*amt)},${cl(g*amt)},${cl(b*amt)})`;
    };

    function drawBlock(x1, x2, y1, y2, z1, z2, baseColor) {
      const cTop  = mix(baseColor, 1.15);
      const cSide = mix(baseColor, 0.65);
      const cBack = baseColor;
      drawFace(cSide, [ pt(x1,y1,z1), pt(x1,y1,z2), pt(x1,y2,z2), pt(x1,y2,z1) ]);
      drawFace(cTop,  [ pt(x1,y1,z1), pt(x2,y1,z1), pt(x2,y1,z2), pt(x1,y1,z2) ]);
      drawFace(cBack, [ pt(x1,y1,z1), pt(x2,y1,z1), pt(x2,y2,z1), pt(x1,y2,z1) ]);
    }

    drawBlock(-20, 20, -35, 35, 3.4, 3.6, '#ff5500');
    drawBlock(-24, 24, -40, 40, 3.2, 3.4, '#cc3300');
    drawBlock(-8, 8, -42, -30, 1.8, 3.0, '#1a1a1a');
    drawBlock(-18, 18, -30, 25, 1.8, 3.2, '#333333');
    drawBlock(-35, 35, -45, 60, 1.3, 1.8, gunColor);

    if (p.ammo > 0) {
      drawBlock(-65, -35, -15, 45, 1.25, 1.45, '#ffaa00');
      const cDart = mix('#ff2200', 0.8);
      drawFace(cDart, [ pt(-65,-15,1.25), pt(-65,-15,1.45), pt(-65,-5,1.45), pt(-65,-5,1.25) ]);
    }

    drawBlock(-35, 35, -45, 60, 1.0, 1.3, gunColor);
    drawBlock(-15, 15, 60, 200, 1.0, 1.25, '#2a2a2a');

    // Muzzle flash
    if (p.muzzleFlash > 0) {
      const mf = p.muzzleFlash / 0.10;
      ctx.save();
      ctx.globalAlpha = mf;
      const [fx, fy] = pt(0, -5, 3.6);
      const glowG = ctx.createRadialGradient(fx, fy, 2, fx, fy, 120);
      glowG.addColorStop(0, 'rgba(255,255,200,1)');
      glowG.addColorStop(0.3, 'rgba(255,180,30,0.8)');
      glowG.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = glowG;
      ctx.beginPath(); ctx.arc(fx, fy, 120, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#ffffbb';
      ctx.lineWidth = 4;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2 + (Math.random()*0.2);
        const len2 = 40 + Math.random() * 40;
        ctx.beginPath(); ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(ang)*len2, fy + Math.sin(ang)*len2); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(fx, fy, 15, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Reload shimmer
    if (p.reloading) {
      const pct = 1 - p.reloadTimer / RELOAD_TIME;
      const pulse = 0.5 + Math.abs(Math.sin(this.time * 14)) * 0.5;
      ctx.globalAlpha = 0.3 * pulse;
      drawBlock(-38, 38, -48, 63, 1.0, 1.0 + pct * 2.2, '#ffff00');
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  // ─── HUD (adds ADS indicator + speed boost timer) ────────────
  _drawHUD(ctx, p, ox, oy, vpW, vpH) {
    ctx.save();
    const px2 = ox + 14;

    // Player tag
    ctx.font = 'bold 13px Outfit';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    ctx.fillText(p.name, px2, oy + 24);

    // ADS mode indicator
    if (p.ads) {
      ctx.font = 'bold 10px Outfit';
      ctx.fillStyle = 'rgba(0,220,255,0.85)';
      ctx.fillText('◉ ADS', px2, oy + 38);
    }

    // Speed boost indicator
    if (p.speedBoost > 0) {
      const bPct = p.speedBoost / PICKUP_TYPES.speed.duration;
      ctx.font = 'bold 10px Outfit';
      ctx.fillStyle = `rgba(0,220,255,${0.7 + Math.sin(this.time*8)*0.3})`;
      ctx.fillText(`⚡ BOOST ${p.speedBoost.toFixed(1)}s`, px2, oy + (p.ads ? 52 : 38));
    }

    // Score
    const scorePop = 1 + p.hitPop * 0.35;
    ctx.save();
    ctx.translate(ox + vpW/2, oy + 46);
    ctx.scale(scorePop, scorePop);
    ctx.font = 'bold 30px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(`${p.hits}`, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(`${p.hits}`, 0, 0);
    ctx.restore();

    ctx.font = '11px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'center';
    ctx.fillText(`/ ${this.targetHits} to win`, ox + vpW/2, oy + 62);

    // Ammo bar
    const aX = ox + 14, aY = oy + vpH - 68;
    ctx.font = '10px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText('AMMO', aX, aY - 5);

    const dW2 = 11, dH2 = 6, dGap = 3;
    for (let i = 0; i < MAX_AMMO; i++) {
      const lx = aX + i * (dW2 + dGap);
      const loaded = i < p.ammo;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.roundRect(lx+1, aY+1, dW2, dH2, 2); ctx.fill();
      ctx.fillStyle = loaded ? '#ffaa00' : 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.roundRect(lx, aY, dW2, dH2, 2); ctx.fill();
      if (loaded) {
        ctx.fillStyle = '#ff5500';
        ctx.beginPath(); ctx.roundRect(lx, aY, 4, dH2, [2,0,0,2]); ctx.fill();
      }
    }

    // Controls reminder
    ctx.font = '9px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.textAlign = 'right';
    const ctrlStr = p.id === 0
      ? 'WASD·Move | SPC·Fire | Q·ADS | R·Reload'
      : '↑↓←→·Move | ENT·Fire | 0·ADS | /·Reload';
    ctx.fillText(ctrlStr, ox+vpW-10, oy+vpH-10);

    ctx.restore();
  }

  // ─── Minimap (shows opponent direction too) ──────────────────
  _drawMinimap(ctx, p, ox, vpW, vpH) {
    const map  = this.map;
    const ROWS = map.length, COLS = map[0].length;
    const S    = 4.5;
    const mW   = COLS * S, mH = ROWS * S;
    const mx   = ox + vpW - mW - 12;
    const my   = vpH - mH - 12;

    ctx.save();
    ctx.globalAlpha = 0.72;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mW + 8, mH + 8, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx - 4, my - 4, mW + 8, mH + 8, 5);
    ctx.stroke();

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = map[row][col];
        if (cell > 0) {
          const baseColor = this.palette[cell] || '#555';
          ctx.fillStyle = this._mixColor(...this._hexToRgb(baseColor), 0.6);
          ctx.fillRect(mx + col*S, my + row*S, S-0.5, S-0.5);
        }
      }
    }

    // Pickup dots on minimap
    this.pickups.forEach(pk => {
      ctx.fillStyle = pk.type === 'ammo' ? '#ffcc00' : '#00e5ff';
      ctx.beginPath();
      ctx.arc(mx + pk.x*S, my + pk.y*S, 2, 0, Math.PI*2);
      ctx.fill();
    });

    // Opponent dot + direction (FIX: now shows opponent facing direction)
    const opp = this.players.find(pl => pl.id !== p.id);
    if (opp) {
      ctx.fillStyle = opp.color;
      ctx.beginPath();
      ctx.arc(mx + opp.x*S, my + opp.y*S, 2.5, 0, Math.PI*2);
      ctx.fill();
      // Opponent direction indicator
      ctx.strokeStyle = opp.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(mx + opp.x*S, my + opp.y*S);
      ctx.lineTo(mx + opp.x*S + Math.cos(opp.angle)*5, my + opp.y*S + Math.sin(opp.angle)*5);
      ctx.stroke();
      ctx.globalAlpha = 0.72;
    }

    // Player dot + direction
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(mx + p.x*S, my + p.y*S, 3, 0, Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx + p.x*S, my + p.y*S);
    ctx.lineTo(mx + p.x*S + Math.cos(p.angle)*6, my + p.y*S + Math.sin(p.angle)*6);
    ctx.stroke();

    ctx.restore();
  }

  // ─── Countdown ──────────────────────────────────────────────
  _drawCountdown(ctx) {
    const txt = this._cdCount > 0 ? String(this._cdCount) : 'GO!';
    const scale = 1 + (1 - this._cdTimer / 0.9) * 0.22;
    ctx.save();
    ctx.translate(this.W/2, this.H/2 - 20);
    ctx.scale(scale, scale);
    ctx.font = `900 80px Outfit`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this._cdCount > 0 ? '#fff' : '#ffcc00';
    ctx.shadowColor = this._cdCount > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,200,0,0.5)';
    ctx.shadowBlur = 28;
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  // ─── Colour Helpers ─────────────────────────────────────────
  _hexToRgb(hex) {
    return [
      parseInt(hex.slice(1,3),16),
      parseInt(hex.slice(3,5),16),
      parseInt(hex.slice(5,7),16),
    ];
  }

  _mixColor(r, g, b, amt) {
    return `rgb(${Math.round(r*amt)},${Math.round(g*amt)},${Math.round(b*amt)})`;
  }

  _shadeColor(hex, amt) {
    const [r,g,b] = this._hexToRgb(hex);
    return this._mixColor(r,g,b,amt);
  }
}

// ─── Boot ────────────────────────────────────────────────────
new NerfArena();
