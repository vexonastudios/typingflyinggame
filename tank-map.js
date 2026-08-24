// tank-map.js — Level data, wall/obstacle definitions, zone layout

// Tile types
const T = {
  EMPTY:    0,  // Grass
  WALL:     1,
  RUBBLE:   2,
  TREE:     3,
  WATER:    4,
  SAND:     5,
  ROAD:     6,
  SPAWN:    7,
  OBJECTIVE:8
};

const TILE_SIZE = 48;

// Tile colours for drawing
const TILE_COLORS = {
  [T.EMPTY]:    '#8fad6e',
  [T.WALL]:     '#555a4a',
  [T.RUBBLE]:   '#7a6e56',
  [T.TREE]:     '#2e6b2e',
  [T.WATER]:    '#2a6080',
  [T.SAND]:     '#d4b85a', // Brighter sand
  [T.ROAD]:     '#4a4a4a',
  [T.SPAWN]:    '#8fad6e',
  [T.OBJECTIVE]:'#c8a832',
};

// Is a tile solid (blocks movement)?
function isSolid(type) {
  return type === T.WALL || type === T.RUBBLE || type === T.TREE || type === T.WATER;
}

// ── Level Parsing System ─────────────────────────────────────
function parseMap(mapStrs, defaultTile = T.EMPTY) {
  const rows = mapStrs.length;
  const cols = mapStrs[0].length;
  const g = Array.from({ length: rows }, () => Array(cols).fill(defaultTile));
  const spawns = [];
  let objective = null;

  for (let r = 0; r < rows; r++) {
    const rowStr = mapStrs[r];
    for (let c = 0; c < cols; c++) {
      const char = rowStr[c];
      
      let tile = defaultTile;
      if (char === '#') tile = T.WALL;
      else if (char === 'T') tile = T.TREE;
      else if (char === '~') tile = T.WATER;
      else if (char === 'R') tile = T.ROAD;
      else if (char === 'x') tile = T.RUBBLE;
      else if (char === '*') { tile = T.OBJECTIVE; objective = { col: c, row: r }; }
      else if (char === 'O') tile = T.SPAWN;
      
      // Spawns
      if (char === 'i') { spawns.push({ type: 'infantry', col: c, row: r }); }
      else if (char === 'b') { spawns.push({ type: 'bunker', col: c, row: r }); }
      else if (char === 't') { spawns.push({ type: 'tank', col: c, row: r }); }
      else if (char === 'c') { spawns.push({ type: 'commander', col: c, row: r }); }

      g[r][c] = tile;
    }
  }
  return { tiles: g, enemySpawns: spawns, objective };
}

// ── Zones ────────────────────────────────────────────────────
const z1 = parseMap([
  "########################################",
  "#TTT..............xxx..........TTTTTTTT#",
  "#TT....i..i.#x....x#x...i......TTTTTTTT#",
  "#T..........#x.....#......x......i..TTT#",
  "#...........#...i..#......#...........T#",
  "#...i....x..#.............#............#",
  "#.......##..#..............#.#.........#",
  "#........#..#..........................#",
  "#..O....x#.............................#",
  "#..................#x..................#",
  "#........~~~.......##........~~~~~.....#",
  "#.......~~~~~................~~~~~~~...#",
  "#......~~~~~~~x.............~~~~~~~~~*.#",
  "#......~~~~~~~~...x#x...i..~~~~~~~~~~~.#",
  "#x......~~~~~~....x#x.......~~~~~~~~~..#",
  "##x......~~~~...i..x#.....i..~~~~~~~~..#",
  "##.......~~~.................~~~~~~~...#",
  "#T..x.....~......i....i..xx...~~~~~....#",
  "#T.......................xx....~~~.....#",
  "#........xx............................#",
  "#........xx............................#",
  "#TT............i.......................#",
  "#TTT...................xx...i..........#",
  "#TTTT..............................i...#",
  "########################################"
], T.EMPTY);

const z2 = parseMap([
  "########################################",
  "#~~~~~~~~~~~~~~xRRx........TT..#.......#",
  "#~~~~~~~~~~~~~~xRRx........TT..#..i....#",
  "#~~~~~~~~~~~~~~xRRx........TT..#.......#",
  "#~~~~~~~~~~~~~~xRRx............#.......#",
  "#..........##..xRRx....i..i..###.......#",
  "#.....x....i....RR.............#.......#",
  "#..........##...RR...i..i..i...#.......#",
  "#...........#...RR.............#..b....#",
  "#..O........#...RR.....................#",
  "#...i...i...#...RR.....##..............#",
  "#...............RR.....##...t..#.......#",
  "#.....i.........RR.............#.....*.#",
  "#....##x........RR...b.........#.......#",
  "#x...##x...##...RR.............#...t...#",
  "#x.....i....#...RR...i.........#.......#",
  "#..........x#..xRRx...i..i.....#.......#",
  "#~~~~~~~~~~~~~~xRRx.......t....#.......#",
  "#~~~~~~~~~~~~~~xRRx..x#x.......#..i....#",
  "#~~~~~~~~~~~~~~xRRx..x#x.......#.......#",
  "#~~~~~~~~~~~~~~xRRx............#.......#",
  "#~~~~~~~~~~~~~~xRRx..i.........#.......#",
  "#~~~~~~~~~~~~~~xRRx........i...#.......#",
  "#~~~~~~~~~~~~~~xRRx............#...i...#",
  "########################################"
], T.SAND);

const z3 = parseMap([
  "########################################",
  "#TTT..x................x#x...##........#",
  "#TT....x#x...b......i...#..i.##...c....#",
  "#...i...#.........t.....#..i.##........#",
  "#.......#..x#x......#x.......##...i....#",
  "#...i...#...#.......##.......##........#",
  "#.......#...#......i.........##........#",
  "#...........#................##........#",
  "#..O........#......t.............b.....#",
  "#.......#x.............................#",
  "#.......##......#......i.....##........#",
  "#...............#x........b..##........#",
  "#...i...x#x.....##...i.......##......*.#",
  "#........#...................##...t....#",
  "#........#......t...i........##........#",
  "#x..x....#......i............##........#",
  "##..#x.......b.......#.......##........#",
  "##..##x........i.....#.......##........#",
  "#TT.....i...........x#x...i..##..i.....#",
  "#TT...i.........b............##........#",
  "#............................##........#",
  "#..t...........i......t......##........#",
  "#......i.................i...##...b....#",
  "#...x#x......................##........#",
  "########################################"
], T.EMPTY);

const ZONE_DEFS = [
  {
    name: "ZONE 1 — FOREST RIVER",
    cols: z1.tiles[0].length, rows: z1.tiles.length,
    enemySpawns: z1.enemySpawns,
    objective: z1.objective,
    tiles: z1.tiles
  },
  {
    name: "ZONE 2 — CANYON BRIDGE",
    cols: z2.tiles[0].length, rows: z2.tiles.length,
    enemySpawns: z2.enemySpawns,
    objective: z2.objective,
    tiles: z2.tiles
  },
  {
    name: "ZONE 3 — URBAN WARZONE",
    cols: z3.tiles[0].length, rows: z3.tiles.length,
    enemySpawns: z3.enemySpawns,
    objective: z3.objective,
    tiles: z3.tiles
  }
];
