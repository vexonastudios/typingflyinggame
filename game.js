const LOGICAL_WIDTH = 1360;
const LOGICAL_HEIGHT = 760;
const PLAYER_X = 154;
const PLAYER_MIN_X = 88;
const PLAYER_MAX_X = 366;
const PLAYER_MIN_Y = 94;
const PLAYER_MAX_Y = 646;
const HIGH_SCORE_STORAGE_KEY = "sky-typer-squadron-high-scores";
const REPAIR_WORD_BANK = ["heal", "heart", "patch", "mend", "boost", "repair", "shield", "medic"];
const TURRET_WORD_BANK = ["aim", "arc", "ash", "bam", "bolt", "burst", "flak", "lock", "ping", "shot", "zap"];

const WORD_BANKS = {
  animals: [
    "ant", "bat", "bee", "cat", "cod", "cow", "dog", "doe", "elk", "emu",
    "fly", "fox", "gnu", "hen", "hog", "jay", "koi", "owl", "pig", "ram",
    "rat", "yak",
    "bear", "bird", "boar", "bull", "clam", "crab", "crow", "deer", "dove",
    "duck", "fawn", "fish", "flea", "frog", "gnat", "goat", "gull", "hare",
    "hawk", "ibis", "kite", "lamb", "lark", "lion", "lynx", "mink", "mole",
    "moth", "mule", "newt", "pony", "puma", "seal", "slug", "swan", "toad",
    "vole", "wasp", "worm", "wren",
    "bison", "cobra", "crane", "eagle", "egret", "finch", "gecko", "heron",
    "hippo", "horse", "hyena", "koala", "llama", "macaw", "moose", "mouse",
    "otter", "panda", "quail", "raven", "rhino", "robin", "shark", "sheep",
    "skunk", "sloth", "snail", "squid", "stork", "swift", "tapir", "tiger",
    "trout", "viper", "vixen", "whale", "zebra",
    "badger", "beaver", "canary", "condor", "coyote", "donkey", "falcon",
    "ferret", "gopher", "iguana", "impala", "jaguar", "lizard", "magpie",
    "monkey", "osprey", "parrot", "pigeon", "rabbit", "salmon", "toucan",
    "turkey", "walrus", "weasel", "buffalo", "caribou", "dolphin", "gorilla",
    "hamster", "manatee", "meerkat", "narwhal", "peacock", "penguin",
    "flamingo", "hedgehog", "pangolin", "platypus", "scorpion", "starfish",
    "stingray", "wolverine", "alligator", "butterfly", "caterpillar",
    "chimpanzee", "dragonfly", "elephant", "kangaroo", "porcupine",
    "rhinoceros", "seahorse", "tarantula"
  ],
  sky: [
    "ace", "air", "arc", "fog", "jet", "sky", "sun", "zap", "zoom",
    "beam", "bolt", "calm", "dart", "dash", "dive", "dusk", "flap", "flip",
    "flock", "foam", "gale", "glide", "glow", "halo", "high", "kite", "loft",
    "loop", "mist", "nose", "peak", "prop", "roll", "roar", "rise", "rush",
    "sail", "scan", "soar", "spin", "star", "surf", "tail", "tilt", "turn",
    "veer", "wake", "wing", "yaw",
    "airfoil", "airship", "ascent", "aviator", "balloon", "banking", "biplane",
    "breeze", "capsule", "carrier", "ceiling", "circuit", "cirrus", "clipper",
    "cockpit", "compass", "convoy", "descent", "drifter", "fighter", "flyover",
    "fuselage", "glider", "hangar", "heading", "horizon", "joystick",
    "landing", "mayday", "missile", "runway", "sortie", "strafe", "throttle",
    "turbine", "updraft", "vector", "waypoint",
    "afterburner", "airfield", "airframe", "airspeed", "airstrip", "approach",
    "autopilot", "cloudbank", "contrail", "crosswind", "downdraft", "freefall",
    "formation", "headwind", "overcast", "parachute", "propeller", "rollover",
    "starfighter", "tailspin", "tailwind", "touchdown", "turbulence",
    "wingspan", "wingman", "moonbeam", "sunshine", "starlight", "windstorm"
  ],
  colors: [
    "aqua", "blue", "cyan", "gold", "gray", "jade", "lime", "navy", "pink",
    "plum", "red", "rose", "rust", "sage", "tan", "teal",
    "amber", "black", "blush", "brown", "camel", "cocoa", "coral", "cream",
    "ebony", "green", "hazel", "honey", "ivory", "khaki", "lilac", "mauve",
    "mocha", "ochre", "olive", "pearl", "peach", "rouge", "taupe", "umber",
    "white", "wheat",
    "cobalt", "crimson", "fuchsia", "indigo", "jasper", "maroon", "orange",
    "orchid", "purple", "salmon", "sienna", "silver", "violet",
    "aquamarine", "aubergine", "carnelian", "champagne", "chocolate",
    "goldenrod", "lavender", "periwinkle", "tangerine", "turquoise",
    "vermillion", "ultramarine", "scarlet", "cerulean", "magenta", "rainbow"
  ],
  combat: [
    "aim", "arc", "bay", "cap", "gun", "hit", "map", "ops", "war", "zap",
    "alert", "ammo", "base", "bomb", "bolt", "camp", "code", "deck", "duel",
    "duty", "flak", "fort", "frag", "fuel", "gear", "grid", "jump", "land",
    "lift", "line", "load", "lock", "mark", "mine", "move", "navy", "nest",
    "pack", "path", "plan", "post", "push", "raid", "rank", "role", "safe",
    "scan", "seek", "send", "ship", "site", "slam", "sort", "tank", "test",
    "trap", "unit", "wave", "zone",
    "bandit", "bogey", "bullet", "bunker", "combat", "convoy", "defend",
    "deploy", "eject", "engage", "escort", "fighter", "flank", "gunner",
    "hangar", "hostile", "impact", "launch", "mortar", "patrol", "pincer",
    "radar", "recon", "rescue", "rocket", "search", "sector", "signal",
    "sortie", "strafe", "strike", "supply", "target", "vector", "volley",
    "airstrike", "ambush", "assault", "barrage", "bearing", "callsign",
    "cluster", "command", "counter", "defense", "disable", "evasion",
    "extract", "flanking", "gambit", "garrison", "grenade", "gunship",
    "intercept", "lockdown", "marksman", "mission", "ordnance", "perimeter",
    "regiment", "reinforce", "skirmish", "squadron", "standoff", "stealth",
    "suppress", "tactical", "torpedo", "tracer", "warfare"
  ],
  space: [
    "arc", "gas", "ray", "sun", "void",
    "atom", "burn", "core", "dark", "dawn", "dust", "flux", "glow", "heat",
    "halo", "hull", "lens", "lift", "mass", "moon", "nova", "pull", "ring",
    "rock", "scan", "ship", "spin", "star", "tide", "warp", "wave",
    "comet", "craft", "dense", "drift", "dwarf", "earth", "flare", "giant",
    "laser", "lunar", "orbit", "ozone", "phase", "probe", "radio", "relay",
    "rings", "rover", "solar", "sonic", "speed", "titan", "venus", "zenith",
    "aurora", "cosmos", "crater", "debris", "fusion", "galaxy", "helium",
    "impact", "launch", "meteor", "nebula", "oxygen", "photon", "plasma",
    "pulsar", "quasar", "rocket", "saturn", "signal", "sulfur", "system",
    "thrust", "vacuum", "voyage",
    "asteroid", "blackhole", "cosmonaut", "eclipse", "exoplanet",
    "graviton", "ionized", "isotope", "jupiter", "magnetic", "momentum",
    "neptune", "particle", "reentry", "satellite", "spectrum", "starfield",
    "supernova", "telescope", "universe", "wormhole", "xenon", "quantum",
    "spacecraft", "atmosphere"
  ]
};

WORD_BANKS.mixed = Array.from(new Set([
  ...WORD_BANKS.animals,
  ...WORD_BANKS.sky,
  ...WORD_BANKS.colors,
  ...WORD_BANKS.combat,
  ...WORD_BANKS.space
]));

const BOSS_WORD_BANKS = {
  animals: [
    "alligator", "butterfly", "caterpillar", "chimpanzee", "dragonfly",
    "elephant", "kangaroo", "porcupine", "rhinoceros", "seahorse",
    "wolverine", "tarantula", "platypus", "hedgehog", "flamingo", "stingray"
  ],
  sky: [
    "afterburner", "airplane", "airstrip", "cloudbank", "crosswind",
    "formation", "parachute", "starfighter", "tailwind", "turbulence",
    "wingspan", "autopilot", "contrail", "freefall", "windstorm"
  ],
  colors: [
    "aquamarine", "aubergine", "carnelian", "champagne", "chocolate",
    "goldenrod", "lavender", "periwinkle", "tangerine", "turquoise",
    "ultramarine", "vermillion", "cerulean"
  ],
  combat: [
    "airstrike", "barricade", "bombardment", "callsign", "commander",
    "counterattack", "deployment", "extraction", "frontline", "infiltrate",
    "interception", "lockdown", "marksmen", "munitions", "perimeter",
    "reconnaissance", "reinforcement", "skirmish", "squadron", "suppression",
    "tactical", "warfare"
  ],
  space: [
    "atmosphere", "constellation", "cosmonaut", "exoplanet", "gravitational",
    "interstellar", "propulsion", "satellite", "singularity", "spacecraft",
    "starfield", "supernova", "telescope", "wormhole", "blackhole"
  ]
};

BOSS_WORD_BANKS.mixed = Array.from(new Set([
  ...BOSS_WORD_BANKS.animals,
  ...BOSS_WORD_BANKS.sky,
  ...BOSS_WORD_BANKS.colors,
  ...BOSS_WORD_BANKS.combat,
  ...BOSS_WORD_BANKS.space
]));

const DIFFICULTIES = {
  rookie: {
    label: "Rookie Pilot",
    shields: 6,
    waves: 50,
    minLength: 3,
    maxLength: 4,
    peakMaxLength: 8,
    baseEnemies: 2,
    maxEnemies: 7,
    enemySpeed: 68,
    enemyBulletSpeed: 175,
    enemyFireDelay: 4.2,
    playerBulletSpeed: 520,
    speedRamp: 4,
    bulletRamp: 4,
    fireRamp: 0.09,
    minFireDelay: 1.55,
    eliteEvery: 4,
    eliteBonusEnemies: 1,
    eliteSpeedBonus: 14,
    eliteBulletBonus: 16,
    eliteLengthBonus: 1
  },
  pilot: {
    label: "Sky Captain",
    shields: 5,
    waves: 50,
    minLength: 3,
    maxLength: 5,
    peakMaxLength: 9,
    baseEnemies: 3,
    maxEnemies: 8,
    enemySpeed: 86,
    enemyBulletSpeed: 205,
    enemyFireDelay: 3.35,
    playerBulletSpeed: 560,
    speedRamp: 5,
    bulletRamp: 5,
    fireRamp: 0.1,
    minFireDelay: 1.2,
    eliteEvery: 4,
    eliteBonusEnemies: 1,
    eliteSpeedBonus: 18,
    eliteBulletBonus: 20,
    eliteLengthBonus: 1
  },
  ace: {
    label: "Ace Flyer",
    shields: 4,
    waves: 50,
    minLength: 4,
    maxLength: 6,
    peakMaxLength: 10,
    baseEnemies: 3,
    maxEnemies: 9,
    enemySpeed: 104,
    enemyBulletSpeed: 235,
    enemyFireDelay: 2.7,
    playerBulletSpeed: 600,
    speedRamp: 6,
    bulletRamp: 6,
    fireRamp: 0.11,
    minFireDelay: 0.95,
    eliteEvery: 3,
    eliteBonusEnemies: 2,
    eliteSpeedBonus: 22,
    eliteBulletBonus: 24,
    eliteLengthBonus: 1
  },
  legend: {
    label: "Squadron Commander",
    shields: 4,
    waves: 50,
    minLength: 4,
    maxLength: 6,
    peakMaxLength: 10,
    baseEnemies: 4,
    maxEnemies: 10,
    enemySpeed: 114,
    enemyBulletSpeed: 250,
    enemyFireDelay: 2.35,
    playerBulletSpeed: 620,
    speedRamp: 7,
    bulletRamp: 7,
    fireRamp: 0.12,
    minFireDelay: 0.82,
    eliteEvery: 3,
    eliteBonusEnemies: 2,
    eliteSpeedBonus: 26,
    eliteBulletBonus: 28,
    eliteLengthBonus: 1
  }
};

const SOUND_PRESETS = {
  shoot: [{ type: "square", start: 540, end: 260, duration: 0.09, volume: 0.035 }],
  hit: [{ type: "triangle", start: 340, end: 180, duration: 0.12, volume: 0.04 }],
  boom: [
    { type: "sawtooth", start: 170, end: 60, duration: 0.24, volume: 0.055 },
    { type: "triangle", start: 270, end: 90, duration: 0.18, volume: 0.03, delay: 0.02 }
  ],
  hurt: [{ type: "square", start: 180, end: 110, duration: 0.18, volume: 0.045 }],
  miss: [{ type: "triangle", start: 240, end: 140, duration: 0.12, volume: 0.03 }],
  victory: [
    { type: "triangle", start: 392, end: 392, duration: 0.12, volume: 0.03, delay: 0.0 },
    { type: "triangle", start: 494, end: 494, duration: 0.14, volume: 0.03, delay: 0.14 },
    { type: "triangle", start: 659, end: 659, duration: 0.2, volume: 0.03, delay: 0.31 }
  ],
  gameover: [{ type: "sawtooth", start: 150, end: 70, duration: 0.32, volume: 0.05 }]
};

class SkyTyperGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.ui = {
      startButton: document.getElementById("startButton"),
      pauseButton: document.getElementById("pauseButton"),
      difficultySelect: document.getElementById("difficultySelect"),
      packSelect: document.getElementById("packSelect"),
      practiceToggle: document.getElementById("practiceToggle"),
      audioToggle: document.getElementById("audioToggle"),
      waveValue: document.getElementById("waveValue"),
      healthValue: document.getElementById("healthValue"),
      healthFill: document.getElementById("healthFill"),
      scoreValue: document.getElementById("scoreValue"),
      bestScoreValue: document.getElementById("bestScoreValue"),
      bestRunBadge: document.getElementById("bestRunBadge"),
      scoreboardList: document.getElementById("scoreboardList"),
      comboValue: document.getElementById("comboValue"),
      statusBanner: document.getElementById("statusBanner"),
      targetValue: document.getElementById("targetValue"),
      fullscreenButton: document.getElementById("fullscreenButton")
    };

    this.audioContext = null;
    this.lastTime = 0;
    this.totalTime = 0;
    this.idCounter = 1;
    this.input = { up: false, down: false, left: false, right: false };
    this.highScores = this.loadHighScores();
    this.settings = this.buildSettings();
    this.tournament = this.buildTournamentState();

    this.bindEvents();
    this.bindTournamentEvents();
    this.resizeCanvas();
    this.seedBackground();
    this.resetState();
    this.renderHighScores();

    requestAnimationFrame((timestamp) => this.loop(timestamp));
  }

  loadHighScores() {
    try {
      const raw = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((entry) => Number.isFinite(entry?.score))
        .slice(0, 5);
    } catch {
      return [];
    }
  }

  saveHighScores() {
    try {
      window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, JSON.stringify(this.highScores.slice(0, 5)));
    } catch {
      // Ignore storage write issues and keep the run going.
    }
  }

  updateHighScores() {
    if (this.score <= 0) {
      return false;
    }

    const entry = {
      score: this.score,
      wave: this.wave,
      difficulty: this.settings.label,
      pack: this.settings.packKey,
      stamp: new Date().toISOString()
    };

    this.highScores = [...this.highScores, entry]
      .sort((a, b) => b.score - a.score || b.wave - a.wave)
      .slice(0, 5);

    this.saveHighScores();
    this.renderHighScores();
    return this.highScores[0] === entry;
  }

  renderHighScores() {
    const bestScore = this.highScores[0]?.score ?? 0;
    this.ui.bestScoreValue.textContent = `${bestScore}`;
    this.ui.bestRunBadge.textContent = `Best ${bestScore}`;

    this.ui.scoreboardList.innerHTML = "";

    if (this.highScores.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "No high scores yet.";
      this.ui.scoreboardList.append(emptyItem);
      return;
    }

    this.highScores.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.score} pts | Wave ${entry.wave} | ${entry.difficulty}`;
      this.ui.scoreboardList.append(item);
    });
  }

  buildSettings() {
    const difficultyKey = this.ui.difficultySelect.value;
    const packKey = this.ui.packSelect.value;
    const preset = DIFFICULTIES[difficultyKey];
    return {
      ...preset,
      difficultyKey,
      packKey,
      words: WORD_BANKS[packKey] ?? WORD_BANKS.mixed,
      bossWords: BOSS_WORD_BANKS[packKey] ?? BOSS_WORD_BANKS.mixed,
      practice: this.ui.practiceToggle.checked,
      audio: this.ui.audioToggle.checked
    };
  }

  refreshMenuPreview() {
    if (this.running) {
      return;
    }

    this.settings = this.buildSettings();
    this.maxWaves = this.settings.waves;
    this.maxHealth = this.settings.shields;
    this.shields = this.settings.shields;
    this.messageText = `${this.settings.label} ready. ${this.settings.waves} waves ahead.`;
    this.updateUi();
  }

  resetState() {
    this.running = false;
    this.paused = false;
    this.victory = false;
    this.gameOver = false;
    this.wave = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.keyJamTimer = 0;
    this.flashTimer = 0;
    this.pendingWaveTimer = 0;
    this.maxWaves = this.settings.waves;
    this.maxHealth = this.settings.shields;
    this.shields = this.settings.shields;
    this.currentWaveConfig = null;
    this.activeTargetId = null;
    this.messageText = "Choose a mission, then type the enemy words to fire.";

    this.player = {
      x: PLAYER_X,
      y: Math.round(LOGICAL_HEIGHT * 0.53),
      speed: 320,
      flash: 0,
      level: 1
    };

    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.explosions = [];
    this.shockRings = [];
    this.sparkles = [];
    this.input.up = false;
    this.input.down = false;
    this.input.left = false;
    this.input.right = false;

    this.updateUi();
  }

  bindEvents() {
    this.ui.startButton.addEventListener("click", () => this.startMission());
    this.ui.pauseButton.addEventListener("click", () => this.togglePause());
    this.ui.fullscreenButton.addEventListener("click", () => this.toggleFullScreen());
    window.addEventListener("resize", () => this.resizeCanvas());
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove("fs-mode");
        this.ui.fullscreenButton.textContent = "\u26F6 Full Screen";
      }
      this.resizeCanvas();
    });
    this.ui.difficultySelect.addEventListener("change", () => this.refreshMenuPreview());
    window.addEventListener("blur", () => {
      this.input.up = false;
      this.input.down = false;
      this.input.left = false;
      this.input.right = false;
    });

    document.addEventListener("keydown", (event) => {
      if (event.code === "ArrowUp" || event.code === "Numpad8") {
        event.preventDefault();
        this.input.up = true;
        return;
      }

      if (event.code === "ArrowDown" || event.code === "Numpad2") {
        event.preventDefault();
        this.input.down = true;
        return;
      }

      if (event.code === "ArrowLeft" || event.code === "Numpad4") {
        event.preventDefault();
        this.input.left = true;
        return;
      }

      if (event.code === "ArrowRight" || event.code === "Numpad6") {
        event.preventDefault();
        this.input.right = true;
        return;
      }

      if (event.repeat) {
        return;
      }

      if (event.key === "Enter" && !this.running) {
        this.startMission();
        return;
      }

      if (event.code === "Space" && this.running) {
        event.preventDefault();
        this.togglePause();
        return;
      }

      if (!this.running || this.paused) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        this.clearFreshLock();
        return;
      }

      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        this.processLetter(event.key.toLowerCase());
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code === "ArrowUp" || event.code === "Numpad8") {
        this.input.up = false;
      }

      if (event.code === "ArrowDown" || event.code === "Numpad2") {
        this.input.down = false;
      }

      if (event.code === "ArrowLeft" || event.code === "Numpad4") {
        this.input.left = false;
      }

      if (event.code === "ArrowRight" || event.code === "Numpad6") {
        this.input.right = false;
      }
    });
  }

  toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        document.body.classList.add("fs-mode");
        this.ui.fullscreenButton.textContent = "\u2715 Exit Full Screen";
        this.resizeCanvas();
      }).catch((err) => {
        console.log("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        document.body.classList.remove("fs-mode");
        this.ui.fullscreenButton.textContent = "\u26F6 Full Screen";
        this.resizeCanvas();
      });
    }
  }

  resizeCanvas() {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    this.canvas.width = LOGICAL_WIDTH * dpr;
    this.canvas.height = LOGICAL_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  seedBackground() {
    this.clouds = Array.from({ length: 8 }, (_, index) => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: 60 + Math.random() * 250,
      size: 45 + Math.random() * 70,
      speed: 10 + Math.random() * 20,
      puffCount: 4 + (index % 3)
    }));

    this.ridges = [
      {
        y: 590,
        color: "#6f9fba",
        speed: 12,
        offset: 0,
        patternWidth: 1200,
        points: [[0, 0], [120, -48], [250, -10], [380, -64], [560, -22], [760, -72], [970, -12], [1200, 0]]
      },
      {
        y: 668,
        color: "#4d758f",
        speed: 22,
        offset: 0,
        patternWidth: 1200,
        points: [[0, 0], [150, -74], [320, -22], [470, -88], [680, -28], [860, -92], [1030, -34], [1200, 0]]
      }
    ];
  }

  startMission() {
    this.settings = this.buildSettings();
    this.resetState();
    this.running = true;
    this.maxWaves = this.settings.waves;
    this.maxHealth = this.settings.shields;
    this.shields = this.settings.shields;
    this.messageText = this.settings.practice
      ? `${this.settings.label} practice mission. Enemy bullets are off.`
      : `${this.settings.label} mission launched. Type the word to fire.`;

    this.ui.startButton.textContent = "Restart Mission";
    this.ui.pauseButton.textContent = "Pause";
    this.resumeAudio();
    this.spawnWave(1);
    this.updateUi();
  }

  togglePause() {
    if (!this.running || this.gameOver || this.victory) {
      return;
    }

    this.paused = !this.paused;
    this.messageText = this.paused ? "Mission paused. Press Space or Pause to fly again." : "Mission resumed. Keep typing!";
    this.ui.pauseButton.textContent = this.paused ? "Resume" : "Pause";
    this.updateUi();
  }

  clearFreshLock() {
    const target = this.getActiveTarget();

    if (!target) {
      this.messageText = "No active target to clear.";
      this.updateUi();
      return;
    }

    if (target.typedIndex > 0) {
      this.messageText = "That word is already in progress. Finish the attack!";
      this.updateUi();
      return;
    }

    this.activeTargetId = null;
    this.messageText = "Target lock cleared.";
    this.updateUi();
  }

  processLetter(letter) {
    if (!this.running || this.paused || this.gameOver || this.victory) {
      return;
    }

    if (this.keyJamTimer > 0) {
      return;
    }

    let target = this.getActiveTarget();

    if (!target) {
      target = this.pickTarget(letter);
      if (target) {
        this.activeTargetId = target.id;
      }
    }

    if (!target) {
      this.registerMiss("Try the first letter from a plane word.");
      return;
    }

    const expected = target.word[target.typedIndex];

    if (letter !== expected) {
      this.registerMiss(`Oops! ${expected.toUpperCase()} was next.`);
      return;
    }

    target.typedIndex += 1;
    target.flash = 0.15;
    this.player.flash = 0.12;
    this.keyJamTimer = 0.03;
    this.comboTimer = 2.8;
    this.messageText = `Locked on ${target.word.toUpperCase()}!`;
    this.spawnPlayerBullet(target);
    this.playSound("shoot");

    if (target.typedIndex >= target.word.length) {
      target.completedTyping = true;
      this.activeTargetId = null;
      this.messageText = `${target.word.toUpperCase()} finished. Watch the plane burst!`;
    }

    this.updateUi();
  }

  pickTarget(letter) {
    const matchingEnemies = this.enemies
      .filter((enemy) => !enemy.completedTyping && enemy.typedIndex === 0 && enemy.word.startsWith(letter))
      .sort((a, b) => a.x - b.x);

    return matchingEnemies[0] ?? null;
  }

  getActiveTarget() {
    if (!this.activeTargetId) {
      return null;
    }

    const target = this.enemies.find((enemy) => enemy.id === this.activeTargetId);
    if (!target) {
      this.activeTargetId = null;
      return null;
    }

    return target;
  }

  registerMiss(message) {
    this.combo = 0;
    this.comboTimer = 0;
    this.flashTimer = 0.18;
    this.keyJamTimer = 0.18;
    this.messageText = message;
    this.playSound("miss");
    this.updateUi();
  }

  buildWaveConfig(waveNumber) {
    const isFinalWave = waveNumber === this.maxWaves;
    const isBossWave = isFinalWave || waveNumber % 10 === 0;
    const isEliteWave = isFinalWave || waveNumber % this.settings.eliteEvery === 0;
    const campaignProgress = this.maxWaves > 1 ? (waveNumber - 1) / (this.maxWaves - 1) : 1;
    const maxLengthRamp = Math.max(0, (this.settings.peakMaxLength ?? this.settings.maxLength) - this.settings.maxLength);
    const lengthRampSteps = Math.floor(campaignProgress * (maxLengthRamp + 1));
    const currentMaxLength = Math.min(
      this.settings.maxLength + Math.min(lengthRampSteps, maxLengthRamp) + (isEliteWave ? this.settings.eliteLengthBonus : 0),
      this.settings.peakMaxLength ?? this.settings.maxLength
    );
    const currentMinLength = Math.min(
      this.settings.minLength + Math.floor(campaignProgress * Math.max(0, currentMaxLength - this.settings.minLength - 1)),
      Math.max(this.settings.minLength, currentMaxLength - 2)
    );

    return {
      waveNumber,
      isBossWave,
      isEliteWave,
      isFinalWave,
      enemyCount: Math.min(
        this.settings.baseEnemies + Math.floor(campaignProgress * (this.settings.maxEnemies - this.settings.baseEnemies)) + (isEliteWave ? this.settings.eliteBonusEnemies : 0),
        this.settings.maxEnemies
      ),
      enemySpeed: this.settings.enemySpeed + waveNumber * this.settings.speedRamp + (isEliteWave ? this.settings.eliteSpeedBonus : 0),
      enemyBulletSpeed: this.settings.enemyBulletSpeed + waveNumber * this.settings.bulletRamp + (isEliteWave ? this.settings.eliteBulletBonus : 0),
      fireDelay: Math.max(
        this.settings.minFireDelay,
        this.settings.enemyFireDelay - waveNumber * this.settings.fireRamp - (isEliteWave ? 0.18 : 0)
      ),
      minLength: currentMinLength,
      maxLength: currentMaxLength,
      bossMinLength: Math.max(currentMaxLength + 2, 8),
      bossMaxLength: Math.max(currentMaxLength + 4, 11),
      killValue: 100 + waveNumber * 6 + (isEliteWave ? 40 : 0)
    };
  }

  pickBossWord(minLength, maxLength) {
    let pool = this.settings.bossWords.filter((word) => word.length >= minLength && word.length <= maxLength);
    if (pool.length === 0) {
      pool = this.settings.bossWords.filter((word) => word.length >= minLength - 1);
    }
    if (pool.length === 0) {
      pool = BOSS_WORD_BANKS.mixed;
    }
    return pool[Math.floor(Math.random() * pool.length)] ?? "starfighter";
  }

  pickRepairWord() {
    return REPAIR_WORD_BANK[Math.floor(Math.random() * REPAIR_WORD_BANK.length)] ?? "heal";
  }

  pickTurretWord() {
    return TURRET_WORD_BANK[Math.floor(Math.random() * TURRET_WORD_BANK.length)] ?? "flak";
  }

  createStandardEnemy(word, index, waveConfig) {
    const lane = index % 4;
    return {
      id: this.idCounter++,
      x: LOGICAL_WIDTH + 180 + (index * 185),
      y: 132 + lane * 108 + Math.random() * 18,
      baseY: 132 + lane * 108 + Math.random() * 18,
      speed: waveConfig.enemySpeed + Math.random() * 18,
      bulletSpeed: waveConfig.enemyBulletSpeed + Math.random() * 14,
      fireDelay: waveConfig.fireDelay,
      swaySpeed: 1.1 + Math.random() * 1.3,
      swayAmount: 8 + Math.random() * 10,
      shootCooldown: 1.1 + Math.random() * Math.max(0.8, waveConfig.fireDelay),
      word,
      typedIndex: 0,
      health: word.length,
      flash: 0,
      completedTyping: false,
      scoreValue: waveConfig.killValue + word.length * 10,
      collisionRadius: 24
    };
  }

  createRepairTarget(waveConfig, index) {
    const word = this.pickRepairWord();
    const healAmount = this.shields <= this.maxHealth - 2 ? 2 : 1;

    return {
      id: this.idCounter++,
      x: LOGICAL_WIDTH + 180 + index * 170,
      y: 156 + Math.random() * 350,
      baseY: 156 + Math.random() * 350,
      speed: Math.max(58, waveConfig.enemySpeed * 0.72),
      bulletSpeed: 0,
      fireDelay: 999,
      swaySpeed: 1.5 + Math.random() * 0.8,
      swayAmount: 10 + Math.random() * 8,
      shootCooldown: 999,
      word,
      typedIndex: 0,
      health: word.length,
      flash: 0,
      completedTyping: false,
      scoreValue: waveConfig.killValue + 80,
      collisionRadius: 28,
      isRepairTarget: true,
      healAmount
    };
  }

  createTurret(waveConfig, index) {
    const word = this.pickTurretWord();
    const groundY = LOGICAL_HEIGHT - 118;
    return {
      id: this.idCounter++,
      x: LOGICAL_WIDTH + 160 + index * 180,
      y: groundY,
      baseY: groundY,
      speed: Math.max(62, waveConfig.enemySpeed * 0.82),
      bulletSpeed: waveConfig.enemyBulletSpeed * 0.92,
      fireDelay: Math.max(1.1, waveConfig.fireDelay * 1.25),
      swaySpeed: 0,
      swayAmount: 0,
      shootCooldown: 0.9 + Math.random() * 1.2,
      word,
      typedIndex: 0,
      health: word.length,
      flash: 0,
      completedTyping: false,
      scoreValue: waveConfig.killValue + 120,
      collisionRadius: 26,
      isTurret: true
    };
  }

  createBossEnemy(word, waveConfig) {
    return {
      id: this.idCounter++,
      x: LOGICAL_WIDTH + 260,
      y: LOGICAL_HEIGHT / 2 - 18,
      baseY: LOGICAL_HEIGHT / 2 - 18,
      speed: waveConfig.enemySpeed * 0.48,
      bulletSpeed: waveConfig.enemyBulletSpeed + 18,
      fireDelay: Math.max(waveConfig.fireDelay * 1.05, 0.85),
      swaySpeed: 0.95,
      swayAmount: 22,
      shootCooldown: 1.25,
      word,
      typedIndex: 0,
      health: word.length,
      flash: 0,
      completedTyping: false,
      scoreValue: waveConfig.killValue * 4 + word.length * 35,
      collisionRadius: 58,
      isBoss: true,
      gunPorts: [
        { x: -90, y: -24, angleOffset: -0.16 },
        { x: -102, y: 0, angleOffset: 0 },
        { x: -90, y: 24, angleOffset: 0.16 }
      ]
    };
  }

  spawnWave(waveNumber) {
    const waveConfig = this.buildWaveConfig(waveNumber);
    this.currentWaveConfig = waveConfig;
    this.wave = waveNumber;
    const words = this.pickWords(waveConfig.enemyCount, waveConfig.minLength, waveConfig.maxLength);
    const shouldSpawnRepairTarget = !waveConfig.isBossWave && (this.shields < this.maxHealth || waveNumber % 6 === 0);
    const turretCount = !waveConfig.isBossWave && waveNumber >= 4
      ? Math.min(2, (waveNumber % 3 === 0 ? 1 : 0) + (waveConfig.isEliteWave ? 1 : 0))
      : 0;

    this.enemies = waveConfig.isBossWave
      ? [this.createBossEnemy(this.pickBossWord(waveConfig.bossMinLength, waveConfig.bossMaxLength), waveConfig)]
      : words.map((word, index) => this.createStandardEnemy(word, index, waveConfig));

    if (shouldSpawnRepairTarget) {
      this.enemies.push(this.createRepairTarget(waveConfig, this.enemies.length));
    }

    for (let turretIndex = 0; turretIndex < turretCount; turretIndex += 1) {
      this.enemies.push(this.createTurret(waveConfig, turretIndex));
    }

    this.pendingWaveTimer = 0;
    if (this.settings.practice) {
      this.messageText = waveConfig.isBossWave
        ? `Boss practice wave ${waveNumber}. The giant plane has a bigger word.`
        : waveConfig.isEliteWave
        ? `Ace practice wave ${waveNumber}. Longer words are coming in.`
        : `Wave ${waveNumber} ready. Practice mission is calm and safe.`;
    } else if (waveConfig.isBossWave) {
      this.messageText = waveConfig.isFinalWave
        ? `Final boss wave ${waveNumber}! Giant plane, huge word, and triple cannons.`
        : `Boss wave ${waveNumber}! Giant plane ahead with a bigger word and multiple guns.`;
    } else if (turretCount > 0 && shouldSpawnRepairTarget) {
      this.messageText = `Wave ${waveNumber} incoming. Ground turrets are firing flak, and a repair plane is available.`;
    } else if (turretCount > 0) {
      this.messageText = `Wave ${waveNumber} incoming. Ground turrets are active and firing flak from below.`;
    } else if (shouldSpawnRepairTarget) {
      this.messageText = `Wave ${waveNumber} incoming. A repair plane is in the sky if you need integrity back.`;
    } else if (waveConfig.isFinalWave) {
      this.messageText = `Final ace wave ${waveNumber}! Fast planes, harder words, heavy fire.`;
    } else if (waveConfig.isEliteWave) {
      this.messageText = `Ace wave ${waveNumber}! More planes, faster shots, bigger words.`;
    } else {
      this.messageText = `Wave ${waveNumber} incoming. Type fast and dodge return fire.`;
    }
    this.updateUi();
  }

  pickWords(count, minLength, maxLength) {
    let pool = this.settings.words.filter((word) => word.length >= minLength && word.length <= maxLength);
    if (pool.length < count) {
      const bonusPool = WORD_BANKS.mixed.filter((word) => word.length >= minLength && word.length <= maxLength);
      pool = Array.from(new Set([...pool, ...bonusPool]));
    }
    if (pool.length === 0) {
      pool = this.settings.words.filter((word) => word.length <= maxLength);
    }
    if (pool.length === 0) {
      pool = [...this.settings.words];
    }
    const choices = [];
    const used = new Set();

    while (choices.length < count && used.size < pool.length) {
      const word = pool[Math.floor(Math.random() * pool.length)];
      if (!used.has(word)) {
        used.add(word);
        choices.push(word);
      }
    }

    while (choices.length < count) {
      choices.push(pool[Math.floor(Math.random() * pool.length)] ?? "jet");
    }

    return choices;
  }

  spawnPlayerBullet(target) {
    this.playerBullets.push({
      x: this.player.x + 42,
      y: this.player.y + (Math.random() * 8 - 4),
      speed: this.settings.playerBulletSpeed,
      targetId: target.id,
      radius: 4,
      vx: 0,
      vy: 0,
      hue: 48 + Math.random() * 16
    });
  }

  spawnEnemyProjectile(originX, originY, targetX, targetY, speed, angleOffset = 0, radius = 4, kind = "plane") {
    const dx = targetX - originX;
    const dy = targetY - originY;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const directionX = dx / distance;
    const directionY = dy / distance;
    const cos = Math.cos(angleOffset);
    const sin = Math.sin(angleOffset);
    const velocityX = (directionX * cos - directionY * sin) * speed;
    const velocityY = (directionX * sin + directionY * cos) * speed;

    this.enemyBullets.push({
      x: originX,
      y: originY,
      vx: velocityX,
      vy: velocityY,
      radius,
      glow: 0.2 + Math.random() * 0.2,
      kind
    });
  }

  healPlayer(amount, message) {
    if (amount <= 0) {
      return;
    }

    const nextHealth = Math.min(this.maxHealth, this.shields + amount);
    const healed = nextHealth - this.shields;
    if (healed <= 0) {
      this.messageText = "Repair pickup reached you, but hull integrity is already full.";
      this.updateUi();
      return;
    }

    this.shields = nextHealth;
    this.player.flash = 0.18;
    this.createExplosion(this.player.x + 18, this.player.y, "#75ff9a", 30 + healed * 8);
    this.sparkleBurst(this.player.x + 18, this.player.y);
    this.messageText = message ?? `Hull integrity restored by ${healed}.`;
    this.updateUi();
  }

  spawnEnemyBullet(enemy) {
    const speed = enemy.bulletSpeed ?? this.settings.enemyBulletSpeed;
    if (enemy.isRepairTarget) {
      return;
    }
    if (enemy.isTurret) {
      this.spawnEnemyProjectile(enemy.x - 24, enemy.y - 34, this.player.x + 18, this.player.y, speed, -0.02, 6, "flak");
      return;
    }
    if (enemy.isBoss) {
      enemy.gunPorts.forEach((gun) => {
        this.spawnEnemyProjectile(
          enemy.x + gun.x,
          enemy.y + gun.y,
          this.player.x + 18,
          this.player.y,
          speed,
          gun.angleOffset,
          5,
          "plane"
        );
      });
      return;
    }

    this.spawnEnemyProjectile(enemy.x - 34, enemy.y + 4, this.player.x + 18, this.player.y, speed, 0, 4, "plane");
  }

  update(dt) {
    this.totalTime += dt;

    this.clouds.forEach((cloud) => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x < -cloud.size * 3) {
        cloud.x = LOGICAL_WIDTH + cloud.size * 2;
        cloud.y = 50 + Math.random() * 250;
      }
    });

    this.ridges.forEach((ridge) => {
      ridge.offset -= ridge.speed * dt;
      if (ridge.offset <= -ridge.patternWidth) {
        ridge.offset += ridge.patternWidth;
      }
    });

    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(this.flashTimer - dt, 0);
    }

    if (this.keyJamTimer > 0) {
      this.keyJamTimer = Math.max(this.keyJamTimer - dt, 0);
    }

    if (this.player.flash > 0) {
      this.player.flash = Math.max(this.player.flash - dt, 0);
    }

    this.explosions = this.explosions.filter((explosion) => {
      explosion.life -= dt;
      return explosion.life > 0;
    });

    this.shockRings = this.shockRings.filter((ring) => {
      ring.life -= dt;
      ring.radius += dt * 120;
      return ring.life > 0;
    });

    this.sparkles = this.sparkles.filter((spark) => {
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vy += dt * 180;
      return spark.life > 0;
    });

    if (!this.running || this.paused || this.gameOver || this.victory) {
      return;
    }

    const verticalInput = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    const horizontalInput = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (verticalInput !== 0) {
      this.player.y += verticalInput * this.player.speed * dt;
      this.player.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, this.player.y));
    }
    if (horizontalInput !== 0) {
      this.player.x += horizontalInput * this.player.speed * dt;
      this.player.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, this.player.x));
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    this.enemies = this.enemies.filter((enemy) => {
      enemy.x -= enemy.speed * dt;
      enemy.y = enemy.baseY + Math.sin(this.totalTime * enemy.swaySpeed + enemy.id) * enemy.swayAmount;
      enemy.shootCooldown -= dt;
      enemy.flash = Math.max(enemy.flash - dt, 0);

      if (!this.settings.practice && !enemy.isRepairTarget && enemy.x < LOGICAL_WIDTH - 80 && enemy.shootCooldown <= 0) {
        this.spawnEnemyBullet(enemy);
        enemy.shootCooldown = Math.max(enemy.fireDelay * 0.72, enemy.fireDelay * (0.88 + Math.random() * 0.42));
      }

      if (enemy.isTurret && enemy.x < -60) {
        return false;
      }

      if (enemy.x < (enemy.isBoss ? 130 : 40)) {
        if (enemy.isRepairTarget) {
          this.messageText = "The repair plane slipped away before you could use it.";
          this.updateUi();
          return false;
        }
        if (enemy.isTurret) {
          return false;
        }
        this.createExplosion(enemy.x, enemy.y, "#ff8f57", enemy.isBoss ? 96 : 55);
        this.takeDamage(enemy.isBoss ? 2 : 1, enemy.isBoss ? "The boss plane broke through your line!" : "A plane slipped past your defenses!");
        return false;
      }

      return true;
    });

    this.playerBullets = this.playerBullets.filter((bullet) => {
      const target = this.enemies.find((enemy) => enemy.id === bullet.targetId);

      if (target) {
        const dx = target.x - bullet.x;
        const dy = target.y - bullet.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        bullet.vx = (dx / distance) * bullet.speed;
        bullet.vy = (dy / distance) * bullet.speed;
      }

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (target) {
        const hitDistance = Math.hypot(target.x - bullet.x, target.y - bullet.y);
        if (hitDistance < (target.collisionRadius ?? 24)) {
          this.hitEnemy(target);
          return false;
        }
      }

      return bullet.x < LOGICAL_WIDTH + 50 && bullet.y > -50 && bullet.y < LOGICAL_HEIGHT + 50;
    });

    this.enemyBullets = this.enemyBullets.filter((bullet) => {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      const hitDistance = Math.hypot(this.player.x + 18 - bullet.x, this.player.y - bullet.y);
      if (hitDistance < 28) {
        this.takeDamage(1, "Your plane took a hit. Keep going, pilot!");
        this.createExplosion(this.player.x + 20, this.player.y, "#ffd34d", 38);
        return false;
      }

      return bullet.x > -50 && bullet.y > -50 && bullet.y < LOGICAL_HEIGHT + 50;
    });

    if (this.enemies.length === 0) {
      if (this.pendingWaveTimer <= 0) {
        this.pendingWaveTimer = 0.15;
        this.messageText = this.wave >= this.maxWaves ? "Sky clear. Mission complete!" : "Wave clear!";
        this.updateUi();
      }
    }

    if (this.pendingWaveTimer > 0) {
      this.pendingWaveTimer -= dt;
      if (this.pendingWaveTimer <= 0) {
        if (this.wave >= this.maxWaves) {
          this.finishVictory();
        } else {
          this.spawnWave(this.wave + 1);
        }
      }
    }
  }

  hitEnemy(enemy) {
    enemy.health -= 1;
    enemy.flash = 0.2;
    this.createExplosion(enemy.x, enemy.y, enemy.isRepairTarget ? "#ff8db5" : "#ffd34d", enemy.isBoss ? 34 : enemy.isRepairTarget ? 28 : 24);
    this.playSound("hit");

    if (enemy.health > 0) {
      return;
    }

    this.combo += 1;
    this.comboTimer = 3.1;
    const comboBonus = Math.max(0, this.combo - 1) * 20;
    this.score += (enemy.scoreValue ?? 100) + comboBonus;
    this.checkUpgrades();
    this.createExplosion(enemy.x, enemy.y, enemy.isRepairTarget ? "#ff95bf" : "#ff8f57", enemy.isBoss ? 118 : enemy.isRepairTarget ? 76 : 64);
    this.playSound("boom");
    this.sparkleBurst(enemy.x, enemy.y);
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);

    if (this.activeTargetId === enemy.id) {
      this.activeTargetId = null;
    }

    if (enemy.isBoss) {
      this.messageText = `Boss destroyed! ${enemy.word.toUpperCase()} has been blasted out of the sky.`;
    } else if (enemy.isRepairTarget) {
      this.healPlayer(enemy.healAmount, `Repair target collected. Hull integrity +${enemy.healAmount}.`);
    }

    this.updateUi();
  }

  checkUpgrades() {
    let targetLevel = 1;
    if (this.score >= 12000) {
      targetLevel = 3;
    } else if (this.score >= 3500) {
      targetLevel = 2;
    }
    
    if (this.player.level < targetLevel) {
      this.player.level = targetLevel;
      this.maxHealth += 2;
      this.healPlayer(2, `Level ${targetLevel} Upgrade Unlocked! Hull capacity increased!`);
      this.sparkleBurst(this.player.x + 18, this.player.y);
    }
  }

  takeDamage(amount, message) {
    if (this.gameOver || this.victory) {
      return;
    }

    this.shields = Math.max(this.shields - amount, 0);
    this.combo = 0;
    this.comboTimer = 0;
    this.flashTimer = 0.24;
    this.player.flash = 0.24;
    this.messageText = message;
    this.playSound("hurt");

    if (this.shields <= 0) {
      this.finishGameOver();
    }

    this.updateUi();
  }

  finishVictory() {
    this.running = false;
    this.victory = true;
    const isNewBest = this.updateHighScores();
    this.messageText = isNewBest
      ? `New high score! Mission complete with ${this.score} points.`
      : `Mission complete! Score ${this.score}. Your pilot saved the sky!`;
    this.ui.pauseButton.textContent = "Pause";
    this.playSound("victory");
    if (this.tournament.active) this.recordTournamentScore(this.score);
    this.updateUi();
  }

  finishGameOver() {
    this.running = false;
    this.gameOver = true;
    const isNewBest = this.updateHighScores();
    this.messageText = isNewBest
      ? `New high score! ${this.score} points before repairs were needed.`
      : "Your plane needs repairs. Press Start Mission to fly again.";
    this.ui.pauseButton.textContent = "Pause";
    this.playSound("gameover");
    if (this.tournament.active) this.recordTournamentScore(this.score);
    this.updateUi();
  }

  createExplosion(x, y, color, size) {
    this.explosions.push({
      x,
      y,
      color,
      size,
      life: 0.35 + size / 260
    });

    this.shockRings.push({
      x,
      y,
      life: 0.24,
      radius: size * 0.15,
      color
    });
  }

  sparkleBurst(x, y) {
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI * 2 * index) / 12 + Math.random() * 0.15;
      const speed = 50 + Math.random() * 120;
      this.sparkles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.35
      });
    }
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000 || 0.016, 0.033);
    this.lastTime = timestamp;
    this.update(dt);
    this.draw();
    requestAnimationFrame((nextTimestamp) => this.loop(nextTimestamp));
  }

  draw() {
    this.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.drawBackground();
    this.drawPlayer();
    this.drawBullets();
    this.drawEnemies();
    this.drawEffects();
    this.drawOverlay();
    this.drawCrewBadge();
  }

  drawBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    gradient.addColorStop(0, "#2484eb");
    gradient.addColorStop(0.48, "#83d4ff");
    gradient.addColorStop(1, "#ddf6ff");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.save();
    this.ctx.globalAlpha = 0.85;
    this.ctx.fillStyle = "#ffe27a";
    this.ctx.beginPath();
    this.ctx.arc(LOGICAL_WIDTH - 250, 124, 54, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.26)";
    this.ctx.beginPath();
    this.ctx.arc(LOGICAL_WIDTH - 266, 108, 20, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    this.clouds.forEach((cloud) => this.drawCloud(cloud));

    this.ridges.forEach((ridge) => {
      this.drawRidge(ridge);
    });

    if (this.flashTimer > 0) {
      this.ctx.fillStyle = `rgba(255, 105, 120, ${this.flashTimer * 0.45})`;
      this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
  }

  drawCloud(cloud) {
    this.ctx.save();
    this.ctx.translate(cloud.x, cloud.y);
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.78)";

    for (let puff = 0; puff < cloud.puffCount; puff += 1) {
      const offsetX = puff * (cloud.size * 0.36);
      const offsetY = Math.sin(puff) * 6;
      const radius = cloud.size * (0.32 + (puff % 2) * 0.08);
      this.ctx.beginPath();
      this.ctx.arc(offsetX, offsetY, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawRidge(ridge) {
    const repeats = Math.ceil(LOGICAL_WIDTH / ridge.patternWidth) + 2;
    this.ctx.save();
    this.ctx.fillStyle = ridge.color;

    for (let repeat = -1; repeat < repeats; repeat += 1) {
      const startX = ridge.offset + repeat * ridge.patternWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, LOGICAL_HEIGHT);
      ridge.points.forEach(([pointX, pointYOffset]) => {
        this.ctx.lineTo(startX + pointX, ridge.y + pointYOffset);
      });
      this.ctx.lineTo(startX + ridge.patternWidth, LOGICAL_HEIGHT);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  drawPlayer() {
    this.drawPlane(this.player.x, this.player.y, "#ffb63f", "#f04f54", 1, this.player.flash, this.player.level);
  }

  drawEnemies() {
    this.enemies.forEach((enemy) => {
      const glow = enemy.flash + (this.activeTargetId === enemy.id ? 0.16 : 0);
      if (enemy.isBoss) {
        this.drawBossPlane(enemy, glow);
      } else if (enemy.isTurret) {
        this.drawTurret(enemy, glow);
      } else if (enemy.isRepairTarget) {
        this.drawRepairPlane(enemy, glow);
      } else {
        this.drawPlane(enemy.x, enemy.y, "#6ae29f", "#2b5f78", -1, glow);
      }
      this.drawWordBubble(enemy);
    });
  }

  drawPlane(x, y, bodyColor, wingColor, facing, glow, level = 1) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(facing, 1);

    if (glow > 0) {
      this.ctx.shadowColor = glow > 0.15 ? "#fff199" : "#ffffff";
      this.ctx.shadowBlur = 18 + glow * 22;
    }

    if (level === 2) {
      // Body Gradient
      const bodyGrad = this.ctx.createLinearGradient(-42, 0, 34, 0);
      bodyGrad.addColorStop(0, "#4a90e2");
      bodyGrad.addColorStop(1, "#6be0ff");
      
      // Wing Gradient
      const wingGrad = this.ctx.createLinearGradient(0, -12, 0, 26);
      wingGrad.addColorStop(0, "#2b5f78");
      wingGrad.addColorStop(1, "#1a3a4a");

      this.ctx.fillStyle = wingGrad;
      this.roundRect(-20, -12, 54, 14, 6);
      this.ctx.fill();
      this.roundRect(-14, 14, 46, 12, 5);
      this.ctx.fill();

      this.ctx.fillStyle = bodyGrad;
      this.roundRect(-42, -14, 76, 28, 14);
      this.ctx.fill();

      // Exhaust Glow
      this.ctx.fillStyle = "#ffaa00";
      this.beginTriangle(-42, 0, -56, -8, -56, 8);
      this.ctx.fill();

      // Cockpit
      const cockpitGrad = this.ctx.createLinearGradient(-10, -16, 10, -3);
      cockpitGrad.addColorStop(0, "#12324d");
      cockpitGrad.addColorStop(0.5, "#346b9a");
      cockpitGrad.addColorStop(1, "#12324d");
      this.ctx.fillStyle = cockpitGrad;
      this.roundRect(-10, -16, 20, 13, 6);
      this.ctx.fill();

      // Tail
      this.ctx.fillStyle = wingGrad;
      this.beginTriangle(32, 0, 52, -10, 52, 10);
      this.ctx.fill();
      
      this.ctx.strokeStyle = "rgba(255,255,255,0.3)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(-30, -5, 40, 10);
    } else if (level >= 3) {
      // Body Gradient
      const bodyGrad = this.ctx.createLinearGradient(-48, 0, 38, 0);
      bodyGrad.addColorStop(0, "#ffd700");
      bodyGrad.addColorStop(0.5, "#fdfd96");
      bodyGrad.addColorStop(1, "#ffd700");
      
      const decoColor = "#800080";

      this.ctx.fillStyle = decoColor;
      this.roundRect(-24, -16, 60, 16, 8);
      this.ctx.fill();
      this.roundRect(-18, 18, 52, 14, 6);
      this.ctx.fill();

      this.ctx.fillStyle = bodyGrad;
      this.roundRect(-48, -18, 86, 34, 16);
      this.ctx.fill();

      // Cockpit
      const cockpitGrad = this.ctx.createLinearGradient(-4, -20, 20, -5);
      cockpitGrad.addColorStop(0, "#ffffff");
      cockpitGrad.addColorStop(0.5, "#caecff");
      cockpitGrad.addColorStop(1, "#ffffff");
      this.ctx.fillStyle = cockpitGrad;
      this.roundRect(-4, -20, 24, 15, 7);
      this.ctx.fill();

      this.ctx.fillStyle = decoColor;
      this.beginTriangle(36, 0, 60, -12, 60, 12);
      this.ctx.fill();

      // Exotic Exhausts
      this.ctx.fillStyle = "#00ffff";
      this.beginTriangle(-48, -8, -64, -14, -64, -2);
      this.ctx.fill();
      this.beginTriangle(-48, 8, -64, 2, -64, 14);
      this.ctx.fill();
    } else {
      // === DEFAULT / ENEMY PLANE — Fully Redrawn ===
      // Draw swept wings first (behind fuselage)
      const wingGradDef = this.ctx.createLinearGradient(0, -26, 0, 26);
      wingGradDef.addColorStop(0, wingColor);
      wingGradDef.addColorStop(0.5, bodyColor);
      wingGradDef.addColorStop(1, wingColor);

      // Forward swept main wing
      this.ctx.fillStyle = wingGradDef;
      this.ctx.beginPath();
      this.ctx.moveTo(-5, -4);
      this.ctx.lineTo(16, -4);
      this.ctx.lineTo(-18, -28);
      this.ctx.lineTo(-26, -20);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(-5, 4);
      this.ctx.lineTo(16, 4);
      this.ctx.lineTo(-18, 28);
      this.ctx.lineTo(-26, 20);
      this.ctx.closePath();
      this.ctx.fill();

      // Small rear stabilizers
      this.ctx.fillStyle = wingColor;
      this.beginTriangle(-28, -3, -38, -14, -22, -3);
      this.ctx.fill();
      this.beginTriangle(-28, 3, -38, 14, -22, 3);
      this.ctx.fill();

      // Main fuselage with metallic gradient
      const hullGrad = this.ctx.createLinearGradient(-38, -10, -38, 12);
      hullGrad.addColorStop(0, bodyColor);
      hullGrad.addColorStop(0.35, "rgba(255,255,255,0.55)");
      hullGrad.addColorStop(0.6, bodyColor);
      hullGrad.addColorStop(1, wingColor);
      this.ctx.fillStyle = hullGrad;
      this.roundRect(-38, -10, 68, 20, 10);
      this.ctx.fill();

      // Nose cone
      this.ctx.fillStyle = wingColor;
      this.ctx.beginPath();
      this.ctx.moveTo(30, 0);
      this.ctx.lineTo(48, 0);
      this.ctx.lineTo(30, -6);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.moveTo(30, 0);
      this.ctx.lineTo(48, 0);
      this.ctx.lineTo(30, 6);
      this.ctx.closePath();
      this.ctx.fill();

      // Cockpit canopy with glare
      const cockpitGrad = this.ctx.createLinearGradient(-4, -16, 12, -5);
      cockpitGrad.addColorStop(0, "#0d1f33");
      cockpitGrad.addColorStop(0.4, "#3ea6e8");
      cockpitGrad.addColorStop(1, "#0d1f33");
      this.ctx.fillStyle = cockpitGrad;
      this.roundRect(2, -15, 18, 12, 4);
      this.ctx.fill();

      // Canopy glare streak
      this.ctx.strokeStyle = "rgba(255,255,255,0.6)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(5, -13);
      this.ctx.lineTo(14, -5);
      this.ctx.stroke();

      // Panel lines
      this.ctx.strokeStyle = "rgba(0,0,0,0.25)";
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(-10, -10);
      this.ctx.lineTo(-10, 10);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(2, -10);
      this.ctx.lineTo(2, 10);
      this.ctx.stroke();

      // Engine exhaust glow
      const exhaustGrad = this.ctx.createRadialGradient(-40, 0, 0, -40, 0, 10);
      exhaustGrad.addColorStop(0, "rgba(255,200,80,0.9)");
      exhaustGrad.addColorStop(0.4, "rgba(255,100,20,0.6)");
      exhaustGrad.addColorStop(1, "rgba(255,50,0,0)");
      this.ctx.fillStyle = exhaustGrad;
      this.ctx.beginPath();
      this.ctx.ellipse(-40, 0, 10, 5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Propeller spin
      this.ctx.strokeStyle = "rgba(255,255,255,0.85)";
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      const propAngle = this.totalTime * 30;
      this.ctx.moveTo(46, Math.sin(propAngle) * 8);
      this.ctx.lineTo(46, Math.sin(propAngle + Math.PI) * 8);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawBossPlane(enemy, glow) {
    this.ctx.save();
    this.ctx.translate(enemy.x, enemy.y);
    this.ctx.scale(-1, 1);

    if (glow > 0) {
      this.ctx.shadowColor = glow > 0.15 ? "#ffe06b" : "#ffffff";
      this.ctx.shadowBlur = 24 + glow * 28;
    }

    this.ctx.fillStyle = "#3d5d78";
    this.roundRect(-40, -18, 120, 22, 10);
    this.ctx.fill();
    this.roundRect(-26, 18, 112, 18, 10);
    this.ctx.fill();

    this.ctx.fillStyle = "#79c8a5";
    this.roundRect(-82, -26, 154, 56, 20);
    this.ctx.fill();

    // Exhausts
    this.ctx.fillStyle = "#ff8f57";
    this.roundRect(-80, -10, 20, 20, 5);
    this.ctx.fill();
    
    // Main Hull Gradient
    const hullGrad = this.ctx.createLinearGradient(-82, 0, 72, 0);
    hullGrad.addColorStop(0, "#5a9a7a");
    hullGrad.addColorStop(0.5, "#79c8a5");
    hullGrad.addColorStop(1, "#5a9a7a");

    this.ctx.fillStyle = "#3d5d78";
    this.roundRect(-40, -18, 120, 22, 10);
    this.ctx.fill();
    this.roundRect(-26, 18, 112, 18, 10);
    this.ctx.fill();

    this.ctx.fillStyle = hullGrad;
    this.roundRect(-82, -26, 154, 56, 20);
    this.ctx.fill();

    // Cockpit
    const cockpitGrad = this.ctx.createLinearGradient(-34, -34, 12, -14);
    cockpitGrad.addColorStop(0, "#163a4a");
    cockpitGrad.addColorStop(1, "#2a6279");
    this.ctx.fillStyle = cockpitGrad;
    this.roundRect(-34, -34, 46, 20, 8);
    this.ctx.fill();

    this.ctx.fillStyle = "#3d5d78";
    this.beginTriangle(72, 0, 106, -16, 106, 16);
    this.ctx.fill();
    
    // Large Fins
    this.ctx.fillStyle = "#2b5f78";
    this.beginTriangle(-78, -4, -114, -28, -44, -10);
    this.ctx.fill();
    this.beginTriangle(-78, 6, -114, 30, -44, 12);
    this.ctx.fill();

    enemy.gunPorts.forEach((gun) => {
      const localX = -gun.x;
      this.ctx.fillStyle = "#14263d";
      this.roundRect(localX - 8, gun.y - 7, 18, 14, 6);
      this.ctx.fill();
      this.ctx.fillStyle = "#ff6347";
      this.roundRect(localX + 8, gun.y - 3, 16, 6, 3);
      this.ctx.fill();
    });

    // Propellers
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    const propAngle = this.totalTime * 24;
    this.ctx.moveTo(98, Math.sin(propAngle) * 16);
    this.ctx.lineTo(98, Math.sin(propAngle + Math.PI) * 16);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawRepairPlane(enemy, glow) {
    this.drawPlane(enemy.x, enemy.y, "#ffe4ef", "#ff6f9f", -1, glow);

    this.ctx.save();
    this.ctx.translate(enemy.x - 4, enemy.y - 3);
    this.drawHeartShape(0, 0, 0.95, "#ff4f7c");
    this.ctx.restore();
  }

  drawTurret(enemy, glow) {
    this.ctx.save();
    this.ctx.translate(enemy.x, enemy.y);

    if (glow > 0) {
      this.ctx.shadowColor = "#ffe06b";
      this.ctx.shadowBlur = 18 + glow * 20;
    }

    this.ctx.fillStyle = "#345066";
    this.roundRect(-30, -10, 60, 18, 7);
    this.ctx.fill();

    this.ctx.fillStyle = "#1c3145";
    this.roundRect(-18, -26, 38, 18, 8);
    this.ctx.fill();

    this.ctx.fillStyle = "#6fb6e9";
    this.roundRect(2, -30, 44, 8, 4);
    this.ctx.fill();

    this.ctx.fillStyle = "#8fa7ba";
    this.roundRect(-10, -42, 20, 14, 6);
    this.ctx.fill();

    this.ctx.strokeStyle = "rgba(255,255,255,0.55)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(-16, 9);
    this.ctx.lineTo(16, 9);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawHeartShape(x, y, scale, color) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.scale(scale, scale);
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 10);
    this.ctx.bezierCurveTo(0, 2, -12, -4, -18, 4);
    this.ctx.bezierCurveTo(-24, 12, -18, 22, 0, 32);
    this.ctx.bezierCurveTo(18, 22, 24, 12, 18, 4);
    this.ctx.bezierCurveTo(12, -4, 0, 2, 0, 10);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  drawWordBubble(enemy) {
    const word = enemy.word.toUpperCase();
    const typed = word.slice(0, enemy.typedIndex);
    const remaining = word.slice(enemy.typedIndex);
    const isActive = this.activeTargetId === enemy.id;
    const bubbleY = enemy.y - (enemy.isBoss ? 98 : enemy.isTurret ? 74 : 58);

    this.ctx.save();
    this.ctx.font = enemy.isBoss ? 'bold 30px "Trebuchet MS", sans-serif' : enemy.isTurret ? 'bold 22px "Trebuchet MS", sans-serif' : 'bold 24px "Trebuchet MS", sans-serif';
    const textWidth = this.ctx.measureText(word).width;
    const bubbleWidth = textWidth + (enemy.isBoss ? 48 : enemy.isTurret ? 34 : 28);
    const bubbleHeight = enemy.isBoss ? 48 : 38;

    this.ctx.fillStyle = isActive ? "rgba(14, 39, 82, 0.96)" : "rgba(14, 39, 82, 0.78)";
    this.roundRect(enemy.x - bubbleWidth / 2, bubbleY - 28, bubbleWidth, bubbleHeight, 16);
    this.ctx.fill();

    this.ctx.strokeStyle = enemy.isBoss
      ? "#ff8f57"
      : enemy.isRepairTarget
      ? "#ff7aa8"
      : enemy.isTurret
      ? "#75c8ff"
      : isActive
      ? "#ffe06b"
      : "rgba(255, 255, 255, 0.22)";
    this.ctx.lineWidth = isActive ? 3 : 1.2;
    this.ctx.stroke();

    const startX = enemy.x - textWidth / 2;

    this.ctx.fillStyle = "#75ff9a";
    this.ctx.fillText(typed, startX, bubbleY + 2);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillText(remaining, startX + this.ctx.measureText(typed).width, bubbleY + 2);

    if (enemy.completedTyping) {
      this.ctx.fillStyle = "rgba(255, 211, 77, 0.95)";
      this.ctx.fillRect(enemy.x - 32, bubbleY + (enemy.isBoss ? 14 : 10), 64, 4);
    }

    if (enemy.isBoss) {
      this.ctx.fillStyle = "#ffb07c";
      this.ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
      this.ctx.fillText("BOSS", enemy.x - 22, bubbleY - 34);
    } else if (enemy.isTurret) {
      this.ctx.fillStyle = "#caecff";
      this.ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
      this.ctx.fillText("AA", enemy.x - 10, bubbleY - 28);
    } else if (enemy.isRepairTarget) {
      this.ctx.fillStyle = "#ffd7e4";
      this.ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
      this.ctx.fillText("REPAIR", enemy.x - 30, bubbleY - 28);
    }

    if (isActive) {
      this.ctx.strokeStyle = "rgba(255, 224, 107, 0.8)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(enemy.x, enemy.y, enemy.isBoss ? 68 : 30, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawBullets() {
    this.playerBullets.forEach((bullet) => {
      this.ctx.save();
      this.ctx.fillStyle = `hsl(${bullet.hue}, 100%, 63%)`;
      this.ctx.shadowColor = "#ffe06b";
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.enemyBullets.forEach((bullet) => {
      this.ctx.save();
      if (bullet.kind === "flak") {
        this.ctx.translate(bullet.x, bullet.y);
        this.ctx.rotate(this.totalTime * 6 + bullet.x * 0.01);
        this.ctx.fillStyle = "#7fd7ff";
        this.ctx.shadowColor = "rgba(127, 215, 255, 0.85)";
        this.ctx.shadowBlur = 16 + bullet.glow * 10;
        this.ctx.fillRect(-bullet.radius, -bullet.radius, bullet.radius * 2, bullet.radius * 2);
        this.ctx.fillStyle = "#203649";
        this.ctx.fillRect(-bullet.radius * 0.45, -bullet.radius * 0.45, bullet.radius * 0.9, bullet.radius * 0.9);
      } else {
        this.ctx.fillStyle = "#ff6f7a";
        this.ctx.shadowColor = "rgba(255, 111, 122, 0.8)";
        this.ctx.shadowBlur = 12 + bullet.glow * 10;
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });
  }

  drawEffects() {
    this.explosions.forEach((explosion) => {
      const progress = 1 - explosion.life / (0.35 + explosion.size / 260);
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.15, explosion.life * 1.4);
      this.ctx.fillStyle = explosion.color;
      this.ctx.beginPath();
      this.ctx.arc(explosion.x, explosion.y, explosion.size * progress, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#fff3c4";
      this.ctx.beginPath();
      this.ctx.arc(explosion.x, explosion.y, explosion.size * progress * 0.45, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    this.shockRings.forEach((ring) => {
      this.ctx.save();
      this.ctx.globalAlpha = ring.life * 2.4;
      this.ctx.strokeStyle = ring.color;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    });

    this.sparkles.forEach((spark) => {
      this.ctx.save();
      this.ctx.globalAlpha = spark.life * 1.4;
      this.ctx.fillStyle = "#fff3c4";
      this.ctx.fillRect(spark.x, spark.y, 3, 3);
      this.ctx.restore();
    });
  }

  drawOverlay() {
    if (this.running) {
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = "rgba(6, 15, 32, 0.34)";
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.fillStyle = "#ffffff";
    this.ctx.textAlign = "center";
    this.ctx.font = '48px Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';

    let title = "Ready To Fly?";
    if (this.victory) {
      title = "Mission Complete!";
    } else if (this.gameOver) {
      title = "Repair And Retry";
    }

    this.ctx.fillText(title, LOGICAL_WIDTH / 2, 208);
    this.ctx.font = '24px "Trebuchet MS", sans-serif';
    this.ctx.fillText(this.messageText, LOGICAL_WIDTH / 2, 250);
    this.ctx.fillStyle = "#ffe06b";
    this.ctx.fillText("Press Start Mission or Enter", LOGICAL_WIDTH / 2, 292);
    this.ctx.restore();
  }

  updateUi() {
    const healthPercent = this.maxHealth > 0 ? (this.shields / this.maxHealth) * 100 : 0;
    const bestScore = this.highScores[0]?.score ?? 0;
    let healthGradient = "linear-gradient(90deg, #64e88c 0%, #d8ff6d 100%)";

    if (healthPercent <= 35) {
      healthGradient = "linear-gradient(90deg, #ff6f7a 0%, #ffae57 100%)";
    } else if (healthPercent <= 65) {
      healthGradient = "linear-gradient(90deg, #ffd34d 0%, #ff9e55 100%)";
    }

    this.ui.waveValue.textContent = `${this.wave} / ${this.maxWaves}`;
    this.ui.healthValue.textContent = `${this.shields} / ${this.maxHealth}`;
    this.ui.healthFill.style.width = `${healthPercent}%`;
    this.ui.healthFill.style.background = healthGradient;
    this.ui.scoreValue.textContent = `${this.score}`;
    this.ui.bestScoreValue.textContent = `${bestScore}`;
    this.ui.comboValue.textContent = `x${Math.max(1, this.combo)}`;
    this.ui.statusBanner.textContent = this.messageText;
    this.ui.targetValue.innerHTML = this.formatTargetLabel();
  }

  formatTargetLabel() {
    const target = this.getActiveTarget();
    if (!target) {
      if (this.victory) {
        return "Sky secure";
      }

      if (this.gameOver) {
        return "Plane needs repairs";
      }

      return "No target locked";
    }

    const typed = target.word.slice(0, target.typedIndex).toUpperCase();
    const remaining = target.word.slice(target.typedIndex).toUpperCase();
    return `<span class="typed">${typed}</span>${remaining} (${target.typedIndex}/${target.word.length})`;
  }

  roundRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  beginTriangle(x1, y1, x2, y2, x3, y3) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.closePath();
  }

  resumeAudio() {
    if (!this.ui.audioToggle.checked) {
      return;
    }

    if (!this.audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return;
      }
      this.audioContext = new AudioCtor();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }
  }

  playSound(name) {
    if (!this.ui.audioToggle.checked) {
      return;
    }

    this.resumeAudio();
    if (!this.audioContext) {
      return;
    }

    const notes = SOUND_PRESETS[name] ?? [];
    const startTime = this.audioContext.currentTime;

    notes.forEach((note) => {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const delay = note.delay ?? 0;
      const noteStart = startTime + delay;
      const noteEnd = noteStart + note.duration;

      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.start, noteStart);
      oscillator.frequency.linearRampToValueAtTime(note.end, noteEnd);

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.linearRampToValueAtTime(note.volume, noteStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);

      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    });
  }

  // =========================================================
  // TOURNAMENT SYSTEM
  // =========================================================

  buildTournamentState() {
    return {
      active: false,
      teams: [],     // [{name, pilot, gunner, wins, losses, totalScore, matches}]
      schedule: [],  // [{t1Idx, t2Idx, t1Score, t2Score, done}]
      matchIdx: 0,
      teamTurn: 0,   // 0 = first team of match, 1 = second
      phase: "idle"  // idle | playing | awaiting | done
    };
  }

  getCrewNames() {
    if (this.tournament.active && this.tournament.phase !== "idle") {
      const match = this.tournament.schedule[this.tournament.matchIdx];
      if (!match) return { team: "", pilot: "", gunner: "" };
      const idx = this.tournament.teamTurn === 0 ? match.t1Idx : match.t2Idx;
      const team = this.tournament.teams[idx] || {};
      return { team: team.name || "", pilot: team.pilot || "", gunner: team.gunner || "" };
    }
    return {
      team: "",
      pilot: (document.getElementById("pilotNameInput") || {}).value || "",
      gunner: (document.getElementById("gunnerNameInput") || {}).value || ""
    };
  }

  drawCrewBadge() {
    const crew = this.getCrewNames();
    const parts = [];
    if (crew.team)   parts.push(`⚡ ${crew.team}`);
    if (crew.pilot)  parts.push(`✈ ${crew.pilot}`);
    if (crew.gunner) parts.push(`◎ ${crew.gunner}`);
    if (!parts.length) return;

    const text = parts.join("   |   ");
    this.ctx.save();
    this.ctx.font = "bold 13px 'Trebuchet MS', sans-serif";
    const tw = this.ctx.measureText(text).width;
    const px = 14;
    const bx = LOGICAL_WIDTH - tw - px * 2 - 10;
    const by = 10;
    const bw = tw + px * 2;
    const bh = 28;

    this.ctx.fillStyle = "rgba(4,18,44,0.82)";
    this.roundRect(bx, by, bw, bh, 10);
    this.ctx.fill();

    this.ctx.strokeStyle = "rgba(255,255,255,0.18)";
    this.ctx.lineWidth = 1;
    this.roundRect(bx, by, bw, bh, 10);
    this.ctx.stroke();

    this.ctx.fillStyle = "#c8ddf2";
    this.ctx.textAlign = "right";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(text, LOGICAL_WIDTH - 10 - px, by + bh / 2);
    this.ctx.restore();
  }

  // Generate round-robin pairs from team list
  generateRoundRobin(teams) {
    const schedule = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        schedule.push({ t1Idx: i, t2Idx: j, t1Score: null, t2Score: null, done: false });
      }
    }
    return schedule;
  }

  prepareTournamentTurn() {
    const match = this.tournament.schedule[this.tournament.matchIdx];
    if (!match) return;
    const idx  = this.tournament.teamTurn === 0 ? match.t1Idx : match.t2Idx;
    const oppI = this.tournament.teamTurn === 0 ? match.t2Idx : match.t1Idx;
    const team = this.tournament.teams[idx];
    const opp  = this.tournament.teams[oppI];
    const total = this.tournament.schedule.length;
    const num   = this.tournament.matchIdx + 1;
    this.messageText = `Match ${num}/${total}: ${team.name} vs ${opp.name} — ${team.pilot} flies & ${team.gunner} types! Press Start Mission.`;
    this.tournament.phase = "awaiting";
    this.updateUi();
    this.renderBracket();
  }

  recordTournamentScore(score) {
    const match = this.tournament.schedule[this.tournament.matchIdx];
    if (!match) return;

    if (this.tournament.teamTurn === 0) {
      match.t1Score = score;
      this.tournament.teamTurn = 1;
      const t2 = this.tournament.teams[match.t2Idx];
      this.messageText = `Score recorded (${score} pts)! Now ${t2.name}: ${t2.pilot} flies & ${t2.gunner} types. Press Start Mission!`;
      this.tournament.phase = "awaiting";
    } else {
      match.t2Score = score;
      match.done = true;
      this.resolveMatch(match);
      this.tournament.matchIdx++;
      this.tournament.teamTurn = 0;
      if (this.tournament.matchIdx >= this.tournament.schedule.length) {
        this.tournament.phase = "done";
        this.finishTournament();
      } else {
        this.prepareTournamentTurn();
      }
      // Always show the round result popup after both teams have played
      this.showRoundResultModal(match);
    }
    this.renderBracket();
    this.updateUi();
  }

  resolveMatch(match) {
    const t1 = this.tournament.teams[match.t1Idx];
    const t2 = this.tournament.teams[match.t2Idx];
    t1.totalScore = (t1.totalScore || 0) + (match.t1Score || 0);
    t2.totalScore = (t2.totalScore || 0) + (match.t2Score || 0);
    t1.matches = (t1.matches || 0) + 1;
    t2.matches = (t2.matches || 0) + 1;
    if ((match.t1Score || 0) >= (match.t2Score || 0)) {
      t1.wins   = (t1.wins   || 0) + 1;
      t2.losses = (t2.losses || 0) + 1;
      match.winner = match.t1Idx;
    } else {
      t2.wins   = (t2.wins   || 0) + 1;
      t1.losses = (t1.losses || 0) + 1;
      match.winner = match.t2Idx;
    }
  }

  finishTournament() {
    const sorted = [...this.tournament.teams].sort(
      (a, b) => (b.wins || 0) - (a.wins || 0) || (b.totalScore || 0) - (a.totalScore || 0)
    );
    const champ = sorted[0];
    this.messageText = `🏆 Tournament Over! Champion: ${champ.name} — ${champ.wins || 0} wins, ${champ.totalScore || 0} total points!`;
    this.renderBracket();
    this.updateUi();
    const nb = document.getElementById("nextMatchBtn");
    if (nb) nb.style.display = "none";
  }

  renderBracket() {
    const body    = document.getElementById("standingsTableBody");
    const nextBtn = document.getElementById("nextMatchBtn");
    if (!body) return;

    // Update sidebar banner
    const sidebarBanner = document.getElementById("sidebarCurrentMatch");
    const sorted = [...this.tournament.teams]
      .map((t, i) => ({ ...t, _idx: i }))
      .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.totalScore || 0) - (a.totalScore || 0));

    body.innerHTML = "";
    sorted.forEach((team, rank) => {
      const tr = document.createElement("tr");
      if (rank === 0 && (team.matches || 0) > 0) tr.className = "is-leader";
      tr.innerHTML = `<td>${team.name}</td><td>${team.wins || 0}</td><td>${team.losses || 0}</td><td>${team.totalScore || 0}</td>`;
      body.appendChild(tr);
    });

    // Banner
    let bannerHtml = "";
    if (this.tournament.phase === "done") {
      const champ = sorted[0];
      bannerHtml = `<strong>🏆 Champion: ${champ.name}!</strong>${champ.pilot} &amp; ${champ.gunner} lead the skies.`;
      if (nextBtn) nextBtn.style.display = "none";
    } else {
      const match = this.tournament.schedule[this.tournament.matchIdx];
      if (match) {
        const t1 = this.tournament.teams[match.t1Idx];
        const t2 = this.tournament.teams[match.t2Idx];
        const num   = this.tournament.matchIdx + 1;
        const total = this.tournament.schedule.length;
        if (this.tournament.teamTurn === 0) {
          bannerHtml = `<strong>Match ${num}/${total}: ${t1.name} vs ${t2.name}</strong>Playing now: ✈️ ${t1.pilot} (Pilot) &amp; 🎯 ${t1.gunner} (Gunner)`;
        } else {
          bannerHtml = `<strong>Match ${num}/${total}: ${t1.name} vs ${t2.name}</strong>Now: ✈️ ${t2.pilot} &amp; 🎯 ${t2.gunner} &nbsp;<small style="color:var(--accent)">(${t1.name} scored ${match.t1Score} pts)</small>`;
        }
        if (nextBtn) nextBtn.style.display = "block";
      }
    }
    if (sidebarBanner) sidebarBanner.innerHTML = bannerHtml;
  }

  startTournamentFromUI() {
    const entries = document.querySelectorAll(".team-entry");
    const teams = [];
    entries.forEach((entry) => {
      const inputs = entry.querySelectorAll(".team-input");
      if (inputs.length >= 3) {
        teams.push({
          name:   inputs[0].value.trim() || `Team ${teams.length + 1}`,
          pilot:  inputs[1].value.trim() || "Pilot",
          gunner: inputs[2].value.trim() || "Gunner",
          wins: 0, losses: 0, totalScore: 0, matches: 0
        });
      }
    });
    if (teams.length < 2) { alert("Add at least 2 teams!"); return; }
    this.tournament.active   = true;
    this.tournament.teams    = teams;
    this.tournament.schedule = this.generateRoundRobin(teams);
    this.tournament.matchIdx = 0;
    this.tournament.teamTurn = 0;
    // Show the live sidebar bracket panel
    const sideZone = document.getElementById("sidebarTournamentZone");
    if (sideZone) sideZone.style.display = "";
    this.closeTournamentModal();
    this.prepareTournamentTurn();
    this.renderBracket();
  }

  addTeamEntry() {
    const list = document.getElementById("teamEntriesList");
    if (!list) return;
    const count = list.children.length + 1;
    if (count > 8) { alert("Maximum 8 teams in a tournament."); return; }
    const div = document.createElement("div");
    div.className = "team-entry";
    div.innerHTML = `
      <div class="team-entry-header">
        <span class="team-entry-label">Team ${count}</span>
        <button class="team-entry-remove" type="button">✕</button>
      </div>
      <input type="text" class="team-input" placeholder="Team Name" maxlength="18">
      <input type="text" class="team-input" placeholder="✈️ Pilot Name" maxlength="18">
      <input type="text" class="team-input" placeholder="🎯 Gunner Name" maxlength="18">
    `;
    div.querySelector(".team-entry-remove").addEventListener("click", () => {
      div.remove();
      document.querySelectorAll(".team-entry-label").forEach((l, i) => { l.textContent = `Team ${i + 1}`; });
    });
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  openTournamentModal() {
    const modal = document.getElementById("tournamentModal");
    if (modal) modal.style.display = "flex";
  }

  closeTournamentModal() {
    const modal = document.getElementById("tournamentModal");
    if (modal) modal.style.display = "none";
  }

  // Called after both teams in a match have played — shows popup with scores + who's next
  showRoundResultModal(match) {
    const modal   = document.getElementById("roundResultModal");
    const body    = document.getElementById("rrBody");
    const title   = document.getElementById("rrModalTitle");
    const contBtn = document.getElementById("rrContinueBtn");
    if (!modal || !body) return;

    const t1 = this.tournament.teams[match.t1Idx];
    const t2 = this.tournament.teams[match.t2Idx];
    const winnerIdx = match.winner;
    const winner = this.tournament.teams[winnerIdx];

    const num   = this.tournament.matchIdx;   // already incremented
    const total = this.tournament.schedule.length;

    title.textContent = this.tournament.phase === "done"
      ? "🏆 Tournament Complete!"
      : `Match ${num}/${total} — Result`;

    // Build score cards
    const t1Winner = winnerIdx === match.t1Idx;
    const scoresHtml = `
      <div class="rr-scores">
        <div class="rr-score-card ${t1Winner ? "is-winner" : ""}">
          <div class="rr-team">${t1.name}</div>
          <div class="rr-crew">✈️ ${t1.pilot}<br>🎯 ${t1.gunner}</div>
          <div class="rr-pts">${match.t1Score ?? 0}</div>
          ${t1Winner ? "<div class='rr-winner-badge'>⭐ Match Winner</div>" : ""}
        </div>
        <div class="rr-score-card ${!t1Winner ? "is-winner" : ""}">
          <div class="rr-team">${t2.name}</div>
          <div class="rr-crew">✈️ ${t2.pilot}<br>🎯 ${t2.gunner}</div>
          <div class="rr-pts">${match.t2Score ?? 0}</div>
          ${!t1Winner ? "<div class='rr-winner-badge'>⭐ Match Winner</div>" : ""}
        </div>
      </div>`;

    // Standings mini-table
    const sorted = [...this.tournament.teams]
      .map((t, i) => ({ ...t, _i: i }))
      .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.totalScore || 0) - (a.totalScore || 0));

    const standingsHtml = `
      <div class="rr-standings">
        <h4>Current Standings</h4>
        <table class="standings-table">
          <thead><tr><th>Team</th><th>W</th><th>L</th><th>Pts</th></tr></thead>
          <tbody>${sorted.map((t, rank) => `
            <tr class="${rank === 0 && (t.matches || 0) > 0 ? "is-leader" : ""}">
              <td>${t.name}</td><td>${t.wins||0}</td><td>${t.losses||0}</td><td>${t.totalScore||0}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    // Next match block
    let nextHtml = "";
    if (this.tournament.phase === "done") {
      nextHtml = `<div class="rr-next"><strong>🏆 Champion: ${winner.name}!</strong>Congratulations — ${winner.pilot} &amp; ${winner.gunner} dominate the skies!</div>`;
      contBtn.textContent = "Close";
    } else {
      const next = this.tournament.schedule[this.tournament.matchIdx];
      if (next) {
        const nt1 = this.tournament.teams[next.t1Idx];
        const nt2 = this.tournament.teams[next.t2Idx];
        const nextNum = this.tournament.matchIdx + 1;
        nextHtml = `<div class="rr-next"><strong>Next: Match ${nextNum}/${total} — ${nt1.name} vs ${nt2.name}</strong>
          ✈️ ${nt1.pilot} &amp; 🎯 ${nt1.gunner} play first. Press Start Mission when ready!</div>`;
      }
      contBtn.textContent = "Got It — Let's Play! ▶";
    }

    body.innerHTML = scoresHtml + standingsHtml + nextHtml;
    modal.style.display = "flex";

    // One-time continue handler
    const onContinue = () => {
      modal.style.display = "none";
      contBtn.removeEventListener("click", onContinue);
    };
    contBtn.addEventListener("click", onContinue);
  }

  bindTournamentEvents() {
    // Header "Tournament" button opens the setup modal
    const tmBtn = document.getElementById("tournamentModalBtn");
    if (tmBtn) tmBtn.addEventListener("click", () => this.openTournamentModal());

    // Close buttons
    const closeBtn  = document.getElementById("closeTournamentModal");
    const closeBtn2 = document.getElementById("closeTournamentModal2");
    if (closeBtn)  closeBtn.addEventListener("click",  () => this.closeTournamentModal());
    if (closeBtn2) closeBtn2.addEventListener("click", () => this.closeTournamentModal());

    // Click backdrop to close
    const tmModal = document.getElementById("tournamentModal");
    if (tmModal) {
      tmModal.addEventListener("click", (e) => {
        if (e.target === tmModal) this.closeTournamentModal();
      });
    }

    // Add team / generate buttons
    const addBtn  = document.getElementById("addTeamBtn");
    const genBtn  = document.getElementById("generateBracketBtn");
    const nextBtn = document.getElementById("nextMatchBtn");
    const resetBtn = document.getElementById("resetTournamentBtn");

    if (addBtn) addBtn.addEventListener("click", () => this.addTeamEntry());
    if (genBtn) genBtn.addEventListener("click", () => this.startTournamentFromUI());
    if (nextBtn) nextBtn.addEventListener("click", () => {
      if (this.tournament.phase === "awaiting") this.prepareTournamentTurn();
    });
    if (resetBtn) resetBtn.addEventListener("click", () => {
      this.tournament = this.buildTournamentState();
      // Hide the sidebar live bracket
      const sideZone = document.getElementById("sidebarTournamentZone");
      if (sideZone) sideZone.style.display = "none";
      // Clear the modal's team list and re-seed it
      const list = document.getElementById("teamEntriesList");
      if (list) list.innerHTML = "";
      this.addTeamEntry();
      this.addTeamEntry();
      // Clear sidebar standings
      const body = document.getElementById("standingsTableBody");
      if (body) body.innerHTML = "";
      const sb = document.getElementById("sidebarCurrentMatch");
      if (sb) sb.innerHTML = "";
    });

    // Pre-populate 2 team slots in the modal list
    this.addTeamEntry();
    this.addTeamEntry();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new SkyTyperGame();
});
