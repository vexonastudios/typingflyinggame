// nc-levels.js — NERF OPS: Rogue Protocol — Level Definitions
// Each level: map grid, spawn, objectives, enemy configs, pickups

'use strict';

// Tile types
const T = {
  EMPTY: 0,
  WALL:  1,
  DOOR:  2,  // locked door (requires key)
  CRATE: 3,  // destructible cover
  BARREL:4,  // explosive barrel
  EXIT:  5,  // level exit
  PICKUP_AMMO: 6,
  PICKUP_HEALTH: 7,
  PICKUP_KEY: 8,
};

// Wall texture IDs
const TEX = {
  CONCRETE: 0,
  BRICK:    1,
  METAL:    2,
  WOOD:     3,
  CAMO:     4,
  HAZARD:   5,
};

// ─── LEVEL 1: The Warehouse ───────────────────────────────────────────────────
const LEVEL_1 = {
  id: 1,
  name: 'The Warehouse',
  subtitle: 'Infiltrate and clear the storage facility',
  briefing: [
    'Intel confirms Rogue operatives have seized Warehouse Delta.',
    'Three hostiles guard the main floor. Neutralize them.',
    'Locate the exit and extract. Watch for supply crates.'
  ],
  music: 'tense',
  ambientColor: '#1a1a2e',
  fogColor: '#0d0d1a',
  fogDepth: 10,
  par: 90, // par time in seconds

  // 16x16 map
  width: 16,
  height: 16,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,1,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,3,0,0,0,3,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,
    1,0,3,0,0,0,1,0,1,0,0,3,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,6,0,0,0,0,0,0,7,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  texMap: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,1,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,0,1,1,1,1,1,0,1,1,1,0,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,3,0,0,0,3,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,
    1,0,3,0,0,0,1,0,1,0,0,3,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.CONCRETE,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 7.5, y: 2.5,  type: 'grunt',   patrol: [{x:7.5,y:2.5},{x:11.5,y:2.5}] },
    { x: 5.5, y: 9.5,  type: 'grunt',   patrol: [{x:5.5,y:9.5},{x:5.5,y:12.5}] },
    { x: 10.5, y: 8.5, type: 'scout',   patrol: [{x:10.5,y:8.5},{x:12.5,y:12.5}] },
  ],

  pickups: [
    { x: 3.5, y: 13.5, type: 'ammo',   amount: 20 },
    { x: 10.5, y: 13.5, type: 'health', amount: 25 },
  ],

  winCondition: 'eliminate_all', // kill all enemies to unlock exit

  scenery: [
    { x: 3.5, y: 3.5, propType: 'ammo_crate' },
    { x: 12.5, y: 3.5, propType: 'ammo_crate' },
    { x: 8.5, y: 8.5, propType: 'light_pole' },
    { x: 2.5, y: 8.5, propType: 'sandbag' },
    { x: 13.5, y: 8.5, propType: 'sandbag' },
    { x: 7.5, y: 13.5, propType: 'table', angle: 0.5 },
  ],
};

// ─── LEVEL 2: Jungle Outpost ──────────────────────────────────────────────────
const LEVEL_2 = {
  id: 2,
  name: 'Jungle Outpost',
  subtitle: 'Fight through the forward operating base',
  briefing: [
    'A rogue FOB has been established deep in the jungle.',
    'Four guards are patrolling. Intel says one carries a key.',
    'Find the key, breach the locked door, reach the evac point.'
  ],
  music: 'jungle',
  ambientColor: '#0d1f0d',
  fogColor: '#0a1a0a',
  fogDepth: 9,
  par: 120,

  width: 20,
  height: 20,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,
    1,0,0,1,1,0,0,0,0,0,0,0,0,0,1,1,0,0,0,1,
    1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,
    1,0,0,0,0,0,3,0,0,0,0,0,3,0,0,0,0,0,0,1,
    1,0,0,0,0,3,0,0,0,0,0,0,0,3,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,1,1,1,2,1,1,1,1,2,1,1,1,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,6,0,0,0,0,0,0,0,8,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,7,0,0,0,0,7,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.CAMO,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 5.5,  y: 2.5,  type: 'grunt',   patrol: [{x:5.5,y:2.5},{x:8.5,y:2.5}] },
    { x: 14.5, y: 3.5,  type: 'grunt',   patrol: [{x:14.5,y:3.5},{x:17.5,y:3.5}] },
    { x: 2.5,  y: 13.5, type: 'scout',   patrol: [{x:2.5,y:13.5},{x:2.5,y:17.5}] },
    { x: 15.5, y: 13.5, type: 'keyguard',patrol: [{x:15.5,y:13.5},{x:15.5,y:17.5}], dropsKey: true },
  ],

  pickups: [
    { x: 5.5,  y: 15.5, type: 'ammo',   amount: 15 },
    { x: 8.5,  y: 17.5, type: 'health', amount: 30 },
    { x: 12.5, y: 17.5, type: 'health', amount: 20 },
    { x: 13.5, y: 15.5, type: 'key' },
  ],

  winCondition: 'reach_exit', // reach exit tile (door must be unlocked)

  scenery: [
    { x: 3.5, y: 5.5, propType: 'sandbag' },
    { x: 16.5, y: 5.5, propType: 'sandbag' },
    { x: 10.5, y: 7.5, propType: 'light_pole' },
    { x: 3.5, y: 13.5, propType: 'ammo_crate', angle: 0.3 },
    { x: 16.5, y: 13.5, propType: 'ammo_crate', angle: -0.3 },
    { x: 8.5, y: 17.5, propType: 'table' },
    { x: 14.5, y: 17.5, propType: 'table', angle: 1.2 },
    { x: 1.5, y: 17.5, propType: 'locker' },
  ],
};

// ─── LEVEL 3: Research Lab ────────────────────────────────────────────────────
const LEVEL_3 = {
  id: 3,
  name: 'Research Lab',
  subtitle: 'Destroy the prototype weapon cache',
  briefing: [
    'A classified research facility is producing illegal NERF tech.',
    'Five operatives guard the lab. Eliminate the commander.',
    'Find and destroy all 3 weapon caches marked on your scanner.'
  ],
  music: 'sci-fi',
  ambientColor: '#0d1f2e',
  fogColor: '#060f17',
  fogDepth: 8,
  par: 150,

  width: 22,
  height: 22,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,
    1,0,0,1,1,1,0,0,0,1,1,1,1,1,0,0,0,1,1,1,0,1,
    1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,
    1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,
    1,0,0,0,0,0,0,3,0,0,0,0,0,0,0,3,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,
    1,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,3,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,0,0,1,1,1,0,1,1,0,0,1,1,0,1,1,0,0,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.METAL,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 5.5,  y: 2.5,  type: 'grunt',    patrol: [{x:5.5,y:2.5},{x:9.5,y:2.5}] },
    { x: 15.5, y: 2.5,  type: 'scout',    patrol: [{x:15.5,y:2.5},{x:19.5,y:2.5}] },
    { x: 10.5, y: 7.5,  type: 'grunt',    patrol: [{x:10.5,y:7.5},{x:10.5,y:10.5}] },
    { x: 6.5,  y: 14.5, type: 'scout',    patrol: [{x:6.5,y:14.5},{x:14.5,y:14.5}] },
    { x: 10.5, y: 19.5, type: 'commander',patrol: [{x:10.5,y:19.5},{x:10.5,y:17.5}], isCommander: true },
  ],

  objectives: [
    { type: 'destroy_barrel', x: 9,  y: 9,  id: 'cache_a', label: 'Cache A' },
    { type: 'destroy_barrel', x: 13, y: 9,  id: 'cache_b', label: 'Cache B' },
    { type: 'destroy_barrel', x: 9,  y: 13, id: 'cache_c', label: 'Cache C' },
  ],

  pickups: [
    { x: 3.5,  y: 18.5, type: 'ammo',   amount: 25 },
    { x: 16.5, y: 18.5, type: 'health', amount: 30 },
  ],

  winCondition: 'objectives', // complete all objectives + reach exit

  scenery: [
    { x: 2.5, y: 4.5, propType: 'server_rack' },
    { x: 19.5, y: 4.5, propType: 'server_rack' },
    { x: 6.5, y: 7.5, propType: 'monitor', angle: 0.5 },
    { x: 14.5, y: 7.5, propType: 'monitor', angle: -0.5 },
    { x: 3.5, y: 10.5, propType: 'table' },
    { x: 18.5, y: 10.5, propType: 'table' },
    { x: 10.5, y: 15.5, propType: 'light_pole' },
    { x: 5.5, y: 17.5, propType: 'server_rack', angle: 1.0 },
    { x: 16.5, y: 17.5, propType: 'server_rack', angle: -1.0 },
    { x: 10.5, y: 19.5, propType: 'ammo_crate' },
  ],
};

// ─── LEVEL 4: Rooftop Assault ─────────────────────────────────────────────────
const LEVEL_4 = {
  id: 4,
  name: 'Rooftop Assault',
  subtitle: 'Scale the tower and take down the sniper',
  briefing: [
    'A rogue sniper has locked down the city block from the rooftop.',
    'Navigate the stairwell corridors and reach the roof.',
    'Eliminate the sniper before they call for reinforcements.'
  ],
  music: 'urban',
  ambientColor: '#1a0d2e',
  fogColor: '#0d0617',
  fogDepth: 7,
  par: 140,

  width: 18,
  height: 24,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1,
    1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1,
    1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,1,1,1,1,1,0,1,1,1,0,1,1,1,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,6,0,0,0,0,0,7,0,0,0,0,0,0,1,
    1,1,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.BRICK,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 8.5,  y: 1.5,  type: 'grunt',   patrol: [{x:8.5,y:1.5},{x:8.5,y:3.5}] },
    { x: 8.5,  y: 5.5,  type: 'scout',   patrol: [{x:8.5,y:5.5},{x:14.5,y:5.5}] },
    { x: 4.5,  y: 11.5, type: 'grunt',   patrol: [{x:4.5,y:11.5},{x:12.5,y:11.5}] },
    { x: 8.5,  y: 17.5, type: 'grunt',   patrol: [{x:8.5,y:17.5},{x:14.5,y:17.5}] },
    { x: 8.5,  y: 21.5, type: 'sniper',  patrol: [{x:8.5,y:21.5},{x:14.5,y:21.5}], isCommander: true },
  ],

  pickups: [
    { x: 4.5,  y: 18.5, type: 'ammo',   amount: 30 },
    { x: 10.5, y: 18.5, type: 'health', amount: 25 },
  ],

  winCondition: 'eliminate_commander',

  scenery: [
    { x: 4.5, y: 2.5, propType: 'sandbag' },
    { x: 12.5, y: 2.5, propType: 'sandbag' },
    { x: 3.5, y: 5.5, propType: 'ammo_crate' },
    { x: 13.5, y: 5.5, propType: 'ammo_crate' },
    { x: 8.5, y: 8.5, propType: 'light_pole' },
    { x: 8.5, y: 14.5, propType: 'light_pole' },
    { x: 3.5, y: 11.5, propType: 'locker' },
    { x: 13.5, y: 11.5, propType: 'locker', angle: 1.5 },
    { x: 3.5, y: 17.5, propType: 'table' },
    { x: 12.5, y: 17.5, propType: 'table', angle: 0.7 },
    { x: 8.5, y: 20.5, propType: 'sandbag' },
  ],
};

// ─── LEVEL 5: The Armory ──────────────────────────────────────────────────────
const LEVEL_5 = {
  id: 5,
  name: 'The Armory',
  subtitle: 'Secure the weapons cache before extraction',
  briefing: [
    'Rogue forces have barricaded themselves inside the central armory.',
    'Six guards. Two locked vaults. You need both vault keys.',
    'Secure the armory and signal extraction. Do not fail.'
  ],
  music: 'intense',
  ambientColor: '#2e1a0d',
  fogColor: '#170d06',
  fogDepth: 6,
  par: 180,

  width: 24,
  height: 24,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,1,1,1,1,1,0,1,0,0,0,0,1,0,1,1,1,1,1,0,0,1,
    1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,
    1,0,0,1,0,3,0,0,0,0,0,0,0,0,0,0,0,0,3,0,1,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,2,1,1,1,1,1,1,0,0,1,1,1,1,1,1,2,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,3,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,4,0,0,4,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,0,0,8,0,0,0,0,0,0,8,0,0,0,0,0,3,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,6,0,0,0,0,0,0,7,0,7,0,0,0,0,0,0,6,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.METAL,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 6.5,  y: 2.5,  type: 'grunt',    patrol: [{x:6.5,y:2.5},{x:16.5,y:2.5}] },
    { x: 6.5,  y: 6.5,  type: 'scout',    patrol: [{x:6.5,y:6.5},{x:16.5,y:6.5}] },
    { x: 11.5, y: 10.5, type: 'heavy',    patrol: [{x:11.5,y:10.5},{x:11.5,y:14.5}] },
    { x: 5.5,  y: 17.5, type: 'grunt',    patrol: [{x:5.5,y:17.5},{x:5.5,y:21.5}] },
    { x: 17.5, y: 17.5, type: 'scout',    patrol: [{x:17.5,y:17.5},{x:17.5,y:21.5}] },
    { x: 11.5, y: 21.5, type: 'commander',patrol: [{x:11.5,y:21.5},{x:11.5,y:19.5}], isCommander: true, dropsKey: true },
  ],

  pickups: [
    { x: 3.5,  y: 20.5, type: 'ammo',   amount: 35 },
    { x: 19.5, y: 20.5, type: 'ammo',   amount: 35 },
    { x: 10.5, y: 20.5, type: 'health', amount: 40 },
    { x: 12.5, y: 20.5, type: 'health', amount: 40 },
    { x: 8.5,  y: 18.5, type: 'key' },
    { x: 15.5, y: 18.5, type: 'key' },
  ],

  winCondition: 'objectives',
  objectives: [
    { type: 'destroy_barrel', x: 10, y: 12, id: 'vault_a', label: 'Vault A Cache' },
    { type: 'destroy_barrel', x: 13, y: 12, id: 'vault_b', label: 'Vault B Cache' },
  ],

  scenery: [
    { x: 3.5, y: 4.5, propType: 'server_rack' },
    { x: 19.5, y: 4.5, propType: 'server_rack' },
    { x: 11.5, y: 4.5, propType: 'monitor', angle: 0.3 },
    { x: 11.5, y: 6.5, propType: 'table' },
    { x: 3.5, y: 10.5, propType: 'pillar' },
    { x: 19.5, y: 10.5, propType: 'pillar' },
    { x: 3.5, y: 14.5, propType: 'pillar' },
    { x: 19.5, y: 14.5, propType: 'pillar' },
    { x: 8.5, y: 17.5, propType: 'locker' },
    { x: 14.5, y: 17.5, propType: 'locker', angle: 1.5 },
    { x: 6.5, y: 20.5, propType: 'sandbag' },
    { x: 16.5, y: 20.5, propType: 'sandbag' },
    { x: 11.5, y: 20.5, propType: 'light_pole' },
  ],
};

// ─── LEVEL 6: Command & Control ───────────────────────────────────────────────
const LEVEL_6 = {
  id: 6,
  name: 'Command & Control',
  subtitle: 'Final confrontation — take down the rogue general',
  briefing: [
    'You\'ve tracked the Rogue General to their command bunker.',
    'Eight elite operatives stand between you and the target.',
    'Eliminate the general. This ends today.'
  ],
  music: 'boss',
  ambientColor: '#1a0000',
  fogColor: '#0d0000',
  fogDepth: 5,
  par: 240,

  width: 26,
  height: 26,
  grid: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,3,0,0,0,0,3,0,0,0,0,3,0,0,0,0,3,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,0,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,4,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,4,4,4,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,0,1,1,1,0,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,3,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,7,0,0,0,7,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,6,0,0,6,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  wallTex: TEX.HAZARD,

  playerStart: { x: 1.5, y: 1.5, angle: 0 },

  enemies: [
    { x: 5.5,  y: 2.5,  type: 'scout',    patrol: [{x:5.5,y:2.5},{x:19.5,y:2.5}] },
    { x: 12.5, y: 2.5,  type: 'grunt',    patrol: [{x:12.5,y:2.5},{x:12.5,y:5.5}] },
    { x: 2.5,  y: 10.5, type: 'heavy',    patrol: [{x:2.5,y:10.5},{x:7.5,y:10.5}] },
    { x: 22.5, y: 10.5, type: 'heavy',    patrol: [{x:22.5,y:10.5},{x:17.5,y:10.5}] },
    { x: 5.5,  y: 17.5, type: 'scout',    patrol: [{x:5.5,y:17.5},{x:5.5,y:21.5}] },
    { x: 19.5, y: 17.5, type: 'scout',    patrol: [{x:19.5,y:17.5},{x:19.5,y:21.5}] },
    { x: 8.5,  y: 22.5, type: 'grunt',    patrol: [{x:8.5,y:22.5},{x:14.5,y:22.5}] },
    { x: 12.5, y: 23.5, type: 'general',  patrol: [{x:12.5,y:23.5},{x:10.5,y:23.5}], isCommander: true, health: 200 },
  ],

  pickups: [
    { x: 3.5,  y: 21.5, type: 'ammo',   amount: 40 },
    { x: 5.5,  y: 21.5, type: 'ammo',   amount: 40 },
    { x: 18.5, y: 21.5, type: 'ammo',   amount: 40 },
    { x: 20.5, y: 21.5, type: 'ammo',   amount: 40 },
    { x: 10.5, y: 20.5, type: 'health', amount: 50 },
    { x: 13.5, y: 20.5, type: 'health', amount: 50 },
  ],

  winCondition: 'eliminate_commander',

  scenery: [
    { x: 5.5, y: 5.5, propType: 'sandbag' },
    { x: 10.5, y: 5.5, propType: 'sandbag' },
    { x: 15.5, y: 5.5, propType: 'sandbag' },
    { x: 20.5, y: 5.5, propType: 'sandbag' },
    { x: 4.5, y: 10.5, propType: 'ammo_crate' },
    { x: 20.5, y: 10.5, propType: 'ammo_crate' },
    { x: 3.5, y: 17.5, propType: 'pillar' },
    { x: 21.5, y: 17.5, propType: 'pillar' },
    { x: 8.5, y: 18.5, propType: 'table' },
    { x: 16.5, y: 18.5, propType: 'table', angle: 0.8 },
    { x: 6.5, y: 22.5, propType: 'server_rack' },
    { x: 18.5, y: 22.5, propType: 'server_rack' },
    { x: 12.5, y: 20.5, propType: 'light_pole' },
    { x: 4.5, y: 22.5, propType: 'locker' },
    { x: 20.5, y: 22.5, propType: 'locker', angle: 1.5 },
  ],
};

// ─── Export ───────────────────────────────────────────────────────────────────
const NC_LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6];
const NC_TILE = T;
