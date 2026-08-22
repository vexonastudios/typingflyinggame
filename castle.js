(() => {
  "use strict";

  const WORLD_W = 1600;
  const WORLD_H = 900;
  const GROUND_Y = 690;
  const PHASE_PANELS = ["supply-panel", "armory-panel", "aim-panel", "waiting-panel"];
  const WEAPONS = {
    standard: { label: "Stone", cost: 1, radius: 15, damage: 1, density: 0.006, color: "#5b6670" },
    heavy: { label: "Heavy Stone", cost: 2, radius: 22, damage: 2, density: 0.011, color: "#3f4b55" },
    scatter: { label: "Scatter Shot", cost: 3, radius: 10, damage: 1, density: 0.004, color: "#74828c" },
    repair: { label: "Field Repair", cost: 2 }
  };

  const CASTLE_BLUEPRINT = [
    [-120, -20, 44, 38, 2, true], [-72, -20, 44, 38, 2, true], [-24, -20, 44, 38, 2, true],
    [24, -20, 44, 38, 2, true], [72, -20, 44, 38, 2, true], [120, -20, 44, 38, 2, true],
    [-96, -59, 44, 38, 1], [-48, -59, 44, 38, 1], [0, -59, 44, 38, 1], [48, -59, 44, 38, 1], [96, -59, 44, 38, 1],
    [-100, -98, 52, 38, 1], [0, -98, 48, 38, 1], [100, -98, 52, 38, 1],
    [-100, -137, 52, 38, 1], [0, -137, 48, 38, 3, false, true], [100, -137, 52, 38, 1],
    [-100, -174, 56, 32, 1], [0, -176, 52, 38, 3, false, true], [100, -174, 56, 32, 1]
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const random = (min, max) => min + Math.random() * (max - min);

  class MathGenerator {
    static make(level) {
      let a;
      let b;
      let answer;
      let text;

      if (level === "easy") {
        if (Math.random() < 0.5) {
          a = Math.floor(random(3, 16));
          b = Math.floor(random(2, 10));
          answer = a + b;
          text = `${a} + ${b} = ?`;
        } else {
          a = Math.floor(random(7, 21));
          b = Math.floor(random(2, a));
          answer = a - b;
          text = `${a} - ${b} = ?`;
        }
      } else if (level === "hard") {
        const kind = Math.floor(random(0, 4));
        if (kind === 0) {
          a = Math.floor(random(4, 13));
          b = Math.floor(random(3, 13));
          answer = a * b;
          text = `${a} x ${b} = ?`;
        } else if (kind === 1) {
          b = Math.floor(random(3, 13));
          answer = Math.floor(random(3, 13));
          a = b * answer;
          text = `${a} / ${b} = ?`;
        } else if (kind === 2) {
          a = Math.floor(random(24, 100));
          b = Math.floor(random(12, 70));
          answer = a + b;
          text = `${a} + ${b} = ?`;
        } else {
          a = Math.floor(random(42, 121));
          b = Math.floor(random(12, a - 4));
          answer = a - b;
          text = `${a} - ${b} = ?`;
        }
      } else if (Math.random() < 0.62) {
        a = Math.floor(random(2, 11));
        b = Math.floor(random(2, 11));
        answer = a * b;
        text = `${a} x ${b} = ?`;
      } else if (Math.random() < 0.5) {
        a = Math.floor(random(12, 51));
        b = Math.floor(random(5, 36));
        answer = a + b;
        text = `${a} + ${b} = ?`;
      } else {
        a = Math.floor(random(18, 61));
        b = Math.floor(random(4, a - 2));
        answer = a - b;
        text = `${a} - ${b} = ?`;
      }

      const options = new Set([answer]);
      const spread = answer > 30 ? 12 : answer > 12 ? 7 : 4;
      while (options.size < 3) {
        const offset = Math.floor(random(-spread, spread + 1));
        if (offset !== 0 && answer + offset >= 0) options.add(answer + offset);
      }

      return { text, answer, options: [...options].sort(() => Math.random() - 0.5) };
    }
  }

  class SoundBoard {
    constructor() {
      this.context = null;
      this.master = 0.2;
    }

    wake() {
      if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") this.context.resume();
    }

    tone(frequency, duration, type = "sine", volume = 0.16, delay = 0) {
      this.wake();
      const start = this.context.currentTime + delay;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume * this.master, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }

    noise(duration = 0.18, volume = 0.18) {
      this.wake();
      const length = Math.floor(this.context.sampleRate * duration);
      const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      gain.gain.value = volume * this.master;
      source.buffer = buffer;
      source.connect(filter).connect(gain).connect(this.context.destination);
      source.start();
    }

    correct() { this.tone(520, 0.12, "triangle"); this.tone(760, 0.18, "triangle", 0.18, 0.09); }
    wrong() { this.tone(180, 0.22, "square", 0.11); }
    select() { this.tone(330, 0.08, "triangle", 0.1); }
    launch() { this.noise(0.2, 0.28); this.tone(115, 0.3, "sawtooth", 0.14); }
    impact() { this.noise(0.25, 0.42); this.tone(72, 0.35, "square", 0.12); }
    repair() { this.tone(410, 0.08, "square", 0.1); this.tone(550, 0.11, "triangle", 0.12, 0.11); }
    victory() { [392, 494, 587, 784].forEach((note, index) => this.tone(note, 0.3, "triangle", 0.16, index * 0.12)); }
  }

  class CatapultClash {
    constructor() {
      this.canvas = document.getElementById("castleCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.bg = new Image();
      this.bg.src = "images/catapult-clash-valley.png";
      this.sound = new SoundBoard();
      this.mode = "solo";
      this.difficulty = "medium";
      this.state = "menu";
      this.phase = "menu";
      this.currentPlayer = 0;
      this.round = 1;
      this.wind = 0;
      this.question = null;
      this.projectiles = [];
      this.particles = [];
      this.destroyed = [[], []];
      this.toastTimer = null;
      this.actionTimer = null;
      this.flightStarted = 0;
      this.lastFrame = performance.now();
      this.shake = 0;
      this.recoil = [0, 0];
      this.players = [];
      this.dom = this.cacheDom();

      this.Engine = Matter.Engine;
      this.World = Matter.World;
      this.Bodies = Matter.Bodies;
      this.Body = Matter.Body;
      this.Sleeping = Matter.Sleeping;
      this.Events = Matter.Events;
      this.Composite = Matter.Composite;
      this.engine = this.Engine.create({ enableSleeping: true });
      this.engine.gravity.y = 0.92;
      this.engine.gravity.scale = 0.001;

      this.bindEvents();
      this.bindPhysics();
      this.resetPlayers();
      this.buildWorld();
      this.resize();
      this.updateHud();
      this.syncIcons();
      requestAnimationFrame((time) => this.frame(time));
    }

    cacheDom() {
      const ids = [
        "match-hud", "game-tools", "command-band", "setup-modal", "pause-modal", "results-modal",
        "question-text", "answer-options", "angle-slider", "power-slider", "angle-value", "power-value",
        "launch-button", "toast", "round-label", "turn-label", "wind-label", "waiting-title", "waiting-copy",
        "p1-name", "p2-name", "p1-wins", "p2-wins", "p1-integrity", "p2-integrity",
        "p1-integrity-text", "p2-integrity-text", "p1-supplies", "p2-supplies",
        "results-title", "results-copy", "result-accuracy", "result-streak", "result-shots"
      ];
      return Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
    }

    bindEvents() {
      window.addEventListener("resize", () => this.resize());
      document.getElementById("start-button").addEventListener("click", () => this.startMatch());
      document.getElementById("resume-button").addEventListener("click", () => this.resume());
      document.getElementById("restart-button").addEventListener("click", () => this.startMatch());
      document.getElementById("rematch-button").addEventListener("click", () => this.startMatch());
      document.getElementById("menu-button").addEventListener("click", () => this.openMenu());
      document.getElementById("pause-menu-button").addEventListener("click", () => this.openMenu());
      document.getElementById("results-menu-button").addEventListener("click", () => this.openMenu());
      document.getElementById("pause-button").addEventListener("click", () => this.pause());
      document.getElementById("fullscreen-button").addEventListener("click", () => this.toggleFullscreen());

      document.querySelectorAll("#mode-control button").forEach((button) => {
        button.addEventListener("click", () => {
          this.mode = button.dataset.mode;
          this.selectSegment("#mode-control button", button);
          this.sound.select();
        });
      });

      document.querySelectorAll("#difficulty-control button").forEach((button) => {
        button.addEventListener("click", () => {
          this.difficulty = button.dataset.difficulty;
          this.selectSegment("#difficulty-control button", button);
          this.sound.select();
        });
      });

      document.querySelectorAll(".armory-card").forEach((button) => {
        button.addEventListener("click", () => this.chooseWeapon(button.dataset.weapon));
      });

      this.dom["angle-slider"].addEventListener("input", () => this.readAimControls());
      this.dom["power-slider"].addEventListener("input", () => this.readAimControls());
      this.dom["launch-button"].addEventListener("click", () => this.launchCurrent());
      document.addEventListener("keydown", (event) => this.handleKey(event));
      document.addEventListener("fullscreenchange", () => this.syncFullscreenIcon());
    }

    bindPhysics() {
      this.Events.on(this.engine, "collisionStart", (event) => {
        event.pairs.forEach((pair) => {
          const projectile = pair.bodyA.gameData?.kind === "projectile" ? pair.bodyA : pair.bodyB.gameData?.kind === "projectile" ? pair.bodyB : null;
          if (!projectile) return;
          const other = projectile === pair.bodyA ? pair.bodyB : pair.bodyA;
          this.handleProjectileCollision(projectile, other);
        });
      });
    }

    selectSegment(selector, selected) {
      document.querySelectorAll(selector).forEach((button) => {
        const active = button === selected;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    syncIcons() {
      if (window.lucide) window.lucide.createIcons();
    }

    resetPlayers() {
      this.players = [
        this.makePlayer(0, "Red Keep", "#d9463f", "#8e292b", false),
        this.makePlayer(1, this.mode === "solo" ? "Blue Engineers" : "Blue Keep", "#2e78c7", "#174c86", this.mode === "solo")
      ];
    }

    makePlayer(id, name, color, dark, ai) {
      return {
        id, name, color, dark, ai, roundWins: 0, supplies: 3, correct: 0, total: 0,
        streak: 0, bestStreak: 0, shots: 0, angle: 45, power: 78, selectedWeapon: "standard",
        blocks: [], maxHealth: 0
      };
    }

    startMatch() {
      this.clearTimers();
      this.resetPlayers();
      this.round = 1;
      this.currentPlayer = 0;
      this.state = "playing";
      document.body.classList.add("playing");
      this.dom["setup-modal"].hidden = true;
      this.dom["pause-modal"].hidden = true;
      this.dom["results-modal"].hidden = true;
      this.dom["match-hud"].hidden = false;
      this.dom["game-tools"].hidden = false;
      this.dom["command-band"].hidden = false;
      this.startRound();
      this.sound.wake();
      this.track("castle_match_started", { mode: this.mode, difficulty: this.difficulty });
    }

    startRound() {
      this.clearTimers();
      this.players.forEach((player) => {
        player.supplies = 3;
        player.selectedWeapon = "standard";
      });
      this.currentPlayer = (this.round - 1) % 2;
      this.wind = Math.round(random(-3, 3));
      this.buildWorld();
      this.updateHud();
      this.showToast(`Round ${this.round}: bring down the rival banner tower.`, "", 1500);
      this.schedule(() => this.beginTurn(), 700);
    }

    buildWorld() {
      this.World.clear(this.engine.world, false);
      this.Engine.clear(this.engine);
      this.projectiles = [];
      this.particles = [];
      this.destroyed = [[], []];
      this.players.forEach((player) => { player.blocks = []; player.maxHealth = 0; });

      const ground = this.Bodies.rectangle(WORLD_W / 2, GROUND_Y + 29, WORLD_W + 240, 58, {
        isStatic: true, friction: 0.9, label: "ground"
      });
      ground.gameData = { kind: "ground" };
      const leftWall = this.Bodies.rectangle(-45, WORLD_H / 2, 90, WORLD_H, { isStatic: true });
      const rightWall = this.Bodies.rectangle(WORLD_W + 45, WORLD_H / 2, 90, WORLD_H, { isStatic: true });
      this.World.add(this.engine.world, [ground, leftWall, rightWall]);
      this.buildCastle(0, 245);
      this.buildCastle(1, 1355);
    }

    buildCastle(owner, centerX) {
      const player = this.players[owner];
      CASTLE_BLUEPRINT.forEach((definition, blueprintIndex) => {
        const [dx, dy, width, height, health, foundation = false, core = false] = definition;
        const body = this.createCastleBlock(owner, centerX + dx, GROUND_Y + dy, width, height, health, foundation, core, blueprintIndex);
        player.blocks.push(body);
        player.maxHealth += health;
        this.World.add(this.engine.world, body);
      });
    }

    createCastleBlock(owner, x, y, width, height, health, foundation, core, blueprintIndex) {
      const body = this.Bodies.rectangle(x, y, width, height, {
        isStatic: foundation,
        density: 0.0038,
        friction: 0.82,
        frictionStatic: 1,
        restitution: 0.04,
        chamfer: { radius: 2 },
        label: core ? "banner-tower" : "castle-block"
      });
      body.gameData = {
        kind: "block", owner, health, maxHealth: health, foundation, core, blueprintIndex,
        width, height, active: true, hitFlash: 0
      };
      return body;
    }

    beginTurn() {
      if (this.state !== "playing") return;
      const player = this.players[this.currentPlayer];
      this.wind = Math.round(random(-3, 3));
      this.updateHud();
      if (player.ai) {
        this.setPhase("ai");
        this.dom["waiting-title"].textContent = `${player.name} is solving`;
        this.dom["waiting-copy"].textContent = "The rival crew is earning supplies.";
        this.schedule(() => this.runAI(), 850);
      } else {
        this.setPhase("supply");
        this.askQuestion();
      }
    }

    setPhase(phase) {
      this.phase = phase;
      PHASE_PANELS.forEach((id) => { document.getElementById(id).hidden = true; });
      const panel = phase === "supply" ? "supply-panel" : phase === "armory" ? "armory-panel" : phase === "aim" ? "aim-panel" : "waiting-panel";
      document.getElementById(panel).hidden = false;
      this.updateHud();
    }

    askQuestion() {
      this.question = MathGenerator.make(this.difficulty);
      this.dom["question-text"].textContent = this.question.text;
      this.dom["answer-options"].replaceChildren();
      this.question.options.forEach((value, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "answer-button";
        button.textContent = value;
        button.dataset.answer = value;
        button.setAttribute("aria-label", `Answer ${index + 1}: ${value}`);
        button.addEventListener("click", () => this.answerQuestion(value, button));
        this.dom["answer-options"].appendChild(button);
      });
    }

    answerQuestion(value, button) {
      if (this.phase !== "supply") return;
      const player = this.players[this.currentPlayer];
      const correct = value === this.question.answer;
      player.total += 1;
      player.streak = correct ? player.streak + 1 : 0;
      player.bestStreak = Math.max(player.bestStreak, player.streak);
      if (correct) player.correct += 1;
      player.supplies = clamp(player.supplies + (correct ? 2 : 1), 0, 5);
      document.querySelectorAll(".answer-button").forEach((answerButton) => {
        answerButton.disabled = true;
        if (Number(answerButton.dataset.answer) === this.question.answer) answerButton.classList.add("is-correct");
      });
      if (!correct) button.classList.add("is-wrong");
      this.sound[correct ? "correct" : "wrong"]();
      this.showToast(correct ? "+2 supplies. Strong work!" : `The answer was ${this.question.answer}. You still earn 1 supply.`, correct ? "good" : "bad", 900);
      this.updateHud();
      this.schedule(() => this.openArmory(), 820);
    }

    openArmory() {
      if (this.state !== "playing") return;
      this.setPhase("armory");
      const player = this.players[this.currentPlayer];
      document.querySelectorAll(".armory-card").forEach((button) => {
        const weapon = WEAPONS[button.dataset.weapon];
        const repairBlocked = button.dataset.weapon === "repair" && this.integrity(player) >= 0.995;
        button.disabled = player.supplies < weapon.cost || repairBlocked;
      });
    }

    chooseWeapon(name) {
      if (this.phase !== "armory") return;
      const player = this.players[this.currentPlayer];
      const weapon = WEAPONS[name];
      if (!weapon || player.supplies < weapon.cost) return;
      this.sound.select();
      player.supplies -= weapon.cost;
      player.selectedWeapon = name;
      this.updateHud();

      if (name === "repair") {
        this.performRepair(player);
        this.schedule(() => this.endTurn(), 1000);
        return;
      }

      this.dom["angle-slider"].value = player.angle;
      this.dom["power-slider"].value = player.power;
      this.readAimControls();
      this.setPhase("aim");
    }

    performRepair(player) {
      let restored = false;
      while (this.destroyed[player.id].length && !restored) {
        const record = this.destroyed[player.id].pop();
        if (player.blocks.some((body) => body.gameData.active && body.gameData.blueprintIndex === record.blueprintIndex)) continue;
        const centerX = player.id === 0 ? 245 : 1355;
        const [dx, dy, width, height, health, foundation = false, core = false] = CASTLE_BLUEPRINT[record.blueprintIndex];
        const block = this.createCastleBlock(player.id, centerX + dx, GROUND_Y + dy, width, height, health, foundation, core, record.blueprintIndex);
        player.blocks.push(block);
        this.World.add(this.engine.world, block);
        restored = true;
      }

      if (!restored) {
        const damaged = player.blocks.find((block) => block.gameData.active && block.gameData.health < block.gameData.maxHealth);
        if (damaged) damaged.gameData.health = damaged.gameData.maxHealth;
      }
      this.sound.repair();
      this.showToast("Field repair complete. One wall section restored.", "good", 900);
      this.spawnParticles(player.id === 0 ? 245 : 1355, GROUND_Y - 100, "#f6bd3c", 18);
      this.updateHud();
    }

    readAimControls() {
      const player = this.players[this.currentPlayer];
      player.angle = Number(this.dom["angle-slider"].value);
      player.power = Number(this.dom["power-slider"].value);
      this.dom["angle-value"].textContent = `${player.angle} degrees`;
      this.dom["power-value"].textContent = `${player.power}%`;
    }

    launchCurrent() {
      if (this.phase !== "aim" || this.state !== "playing") return;
      this.launch(this.players[this.currentPlayer]);
    }

    launch(player) {
      const weaponName = player.selectedWeapon;
      const count = weaponName === "scatter" ? 3 : 1;
      const angleOffsets = count === 3 ? [-4, 0, 4] : [0];
      angleOffsets.forEach((offset, index) => this.spawnProjectile(player, weaponName, offset, index));
      player.shots += 1;
      this.recoil[player.id] = 18;
      this.flightStarted = performance.now();
      this.sound.launch();
      this.setPhase("flight");
      this.dom["waiting-title"].textContent = `${WEAPONS[weaponName].label} away!`;
      this.dom["waiting-copy"].textContent = "Follow the arc to the rival walls.";
    }

    spawnProjectile(player, weaponName, angleOffset, index) {
      const weapon = WEAPONS[weaponName];
      const direction = player.id === 0 ? 1 : -1;
      const angle = (player.angle + angleOffset) * Math.PI / 180;
      const speed = 8 + player.power * 0.09;
      const originX = player.id === 0 ? 442 : 1158;
      const originY = GROUND_Y - 78 - index * 2;
      const body = this.Bodies.circle(originX, originY, weapon.radius, {
        density: weapon.density,
        frictionAir: 0.002,
        restitution: 0.28,
        friction: 0.6,
        label: weaponName
      });
      body.gameData = { kind: "projectile", owner: player.id, weapon: weaponName, damage: weapon.damage, spent: false, born: performance.now(), hitIds: new Set() };
      this.Body.setVelocity(body, { x: Math.cos(angle) * speed * direction, y: -Math.sin(angle) * speed });
      this.World.add(this.engine.world, body);
      this.projectiles.push(body);
    }

    handleProjectileCollision(projectile, other) {
      const shot = projectile.gameData;
      if (!shot || shot.spent) return;
      const target = other.gameData;
      const speed = Matter.Vector.magnitude(projectile.velocity);

      if (target?.kind === "block" && target.owner !== shot.owner && target.active && !shot.hitIds.has(other.id)) {
        shot.hitIds.add(other.id);
        const weapon = WEAPONS[shot.weapon];
        const damage = speed > 7 ? weapon.damage : 1;
        this.damageBlock(other, damage, projectile.position);
        this.radialImpulse(projectile.position, shot.weapon === "heavy" ? 160 : 105, shot.weapon === "heavy" ? 0.038 : 0.02, target.owner);
        this.sound.impact();
        this.shake = shot.weapon === "heavy" ? 13 : 8;
        shot.spent = true;
        window.setTimeout(() => this.removeProjectile(projectile), 90);
      } else if (target?.kind === "ground" && speed > 3.5) {
        this.spawnParticles(projectile.position.x, projectile.position.y, "#ad8d58", 12);
        this.sound.impact();
        shot.spent = true;
        window.setTimeout(() => this.removeProjectile(projectile), 120);
      }
    }

    damageBlock(block, damage, impact) {
      const data = block.gameData;
      data.health -= damage;
      data.hitFlash = 12;
      this.spawnParticles(impact.x, impact.y, data.owner === 0 ? "#d46a59" : "#4f8bc5", 22);
      if (data.health <= 0) this.destroyBlock(block);
      this.updateHud();
      const defender = this.players[data.owner];
      if ((data.core && !data.active) || this.integrity(defender) <= 0.22) this.endRound(1 - data.owner);
    }

    destroyBlock(block) {
      const data = block.gameData;
      if (!data.active) return;
      data.active = false;
      this.destroyed[data.owner].push({ blueprintIndex: data.blueprintIndex });
      this.World.remove(this.engine.world, block);
      this.spawnParticles(block.position.x, block.position.y, "#9aa1a0", 30);
    }

    radialImpulse(origin, radius, force, owner) {
      this.players[owner].blocks.forEach((block) => {
        if (!block.gameData.active || block.isStatic) return;
        const dx = block.position.x - origin.x;
        const dy = block.position.y - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance < radius && distance > 1) {
          const strength = (1 - distance / radius) * force * block.mass;
          this.Body.applyForce(block, block.position, { x: dx / distance * strength, y: dy / distance * strength - strength * 0.35 });
          this.Sleeping.set(block, false);
        }
      });
    }

    removeProjectile(projectile) {
      if (!this.projectiles.includes(projectile)) return;
      this.World.remove(this.engine.world, projectile);
      this.projectiles = this.projectiles.filter((body) => body !== projectile);
    }

    runAI() {
      if (this.state !== "playing" || !this.players[this.currentPlayer].ai) return;
      const ai = this.players[this.currentPlayer];
      const skill = { easy: 0.68, medium: 0.8, hard: 0.9 }[this.difficulty];
      const solved = Math.random() < skill;
      ai.total += 1;
      if (solved) {
        ai.correct += 1;
        ai.streak += 1;
        ai.bestStreak = Math.max(ai.bestStreak, ai.streak);
      } else {
        ai.streak = 0;
      }
      ai.supplies = clamp(ai.supplies + (solved ? 2 : 1), 0, 5);
      this.updateHud();
      this.dom["waiting-title"].textContent = solved ? "Blue earned 2 supplies" : "Blue earned 1 supply";
      this.dom["waiting-copy"].textContent = "The rival crew is choosing its move.";
      this.schedule(() => this.aiChooseMove(ai), 700);
    }

    aiChooseMove(ai) {
      if (this.state !== "playing") return;
      if (this.integrity(ai) < 0.45 && ai.supplies >= 2 && Math.random() < 0.32) {
        ai.supplies -= 2;
        this.performRepair(ai);
        this.schedule(() => this.endTurn(), 850);
        return;
      }

      ai.selectedWeapon = ai.supplies >= 3 && Math.random() < 0.28 ? "scatter" : ai.supplies >= 2 && Math.random() < 0.55 ? "heavy" : "standard";
      ai.supplies -= WEAPONS[ai.selectedWeapon].cost;
      const targets = this.players[0].blocks.filter((block) => block.gameData.active && !block.gameData.foundation);
      const target = targets[Math.floor(Math.random() * targets.length)] || this.players[0].blocks[0];
      const distance = Math.abs(1158 - target.position.x);
      const baseAngle = random(41, 51);
      const gravityPerFrame = 0.255;
      const idealSpeed = Math.sqrt((distance * gravityPerFrame) / Math.max(0.55, Math.sin(2 * baseAngle * Math.PI / 180)));
      const error = { easy: 2.3, medium: 1.25, hard: 0.65 }[this.difficulty];
      ai.angle = clamp(Math.round(baseAngle + random(-error * 2, error * 2)), 25, 68);
      ai.power = clamp(Math.round((idealSpeed + random(-error, error) - 8) / 0.09), 22, 98);
      this.updateHud();
      this.dom["waiting-title"].textContent = `Blue loads a ${WEAPONS[ai.selectedWeapon].label.toLowerCase()}`;
      this.dom["waiting-copy"].textContent = "The catapult arm is rising.";
      this.schedule(() => this.launch(ai), 750);
    }

    updateFlight() {
      if (this.phase !== "flight") return;
      this.projectiles.forEach((projectile) => {
        if (!projectile.gameData.spent) {
          this.Body.applyForce(projectile, projectile.position, { x: this.wind * 0.000006 * projectile.mass, y: 0 });
        }
        const outside = projectile.position.y > WORLD_H + 80 || projectile.position.x < -80 || projectile.position.x > WORLD_W + 80;
        if (outside || performance.now() - projectile.gameData.born > 6200) this.removeProjectile(projectile);
      });

      if (this.projectiles.length === 0 && performance.now() - this.flightStarted > 600) {
        this.endTurn();
      }
    }

    endTurn() {
      if (this.state !== "playing" || this.phase === "round-end") return;
      this.currentPlayer = 1 - this.currentPlayer;
      this.beginTurn();
    }

    endRound(winnerId) {
      if (this.phase === "round-end" || this.state !== "playing") return;
      this.phase = "round-end";
      this.players[winnerId].roundWins += 1;
      this.sound.victory();
      this.updateHud();
      this.setPhase("round-end");
      this.dom["waiting-title"].textContent = `${this.players[winnerId].name} wins round ${this.round}!`;
      this.dom["waiting-copy"].textContent = "The banner tower has fallen.";
      this.spawnParticles(winnerId === 0 ? 390 : 1210, 250, this.players[winnerId].color, 70);

      if (this.players[winnerId].roundWins >= 2) {
        this.schedule(() => this.finishMatch(winnerId), 1800);
      } else {
        this.round += 1;
        this.schedule(() => this.startRound(), 1900);
      }
    }

    finishMatch(winnerId) {
      this.state = "results";
      this.phase = "results";
      document.body.classList.remove("playing");
      const winner = this.players[winnerId];
      const human = this.mode === "solo" ? this.players[0] : this.players[winnerId];
      const accuracy = human.total ? Math.round(human.correct / human.total * 100) : 0;
      this.dom["results-title"].textContent = `${winner.name} Wins!`;
      this.dom["results-copy"].textContent = winnerId === 0 ? "Red's banner still flies over the valley." : "Blue's engineers rule the field.";
      this.dom["result-accuracy"].textContent = `${accuracy}%`;
      this.dom["result-streak"].textContent = human.bestStreak;
      this.dom["result-shots"].textContent = human.shots;
      this.dom["results-modal"].hidden = false;
      this.track("castle_match_completed", { winner: winnerId, mode: this.mode, accuracy });
    }

    integrity(player) {
      const health = player.blocks.reduce((sum, block) => sum + (block.gameData.active ? Math.max(0, block.gameData.health) : 0), 0);
      return clamp(health / player.maxHealth, 0, 1);
    }

    updateHud() {
      this.players.forEach((player, index) => {
        const number = index + 1;
        const integrity = Math.round(this.integrity(player) * 100);
        this.dom[`p${number}-name`].textContent = player.name;
        this.dom[`p${number}-wins`].dataset.wins = player.roundWins;
        this.dom[`p${number}-integrity`].style.width = `${integrity}%`;
        this.dom[`p${number}-integrity-text`].textContent = `${integrity}%`;
        this.dom[`p${number}-supplies`].textContent = player.supplies;
      });
      const active = this.players[this.currentPlayer];
      this.dom["round-label"].textContent = `ROUND ${this.round} / BEST OF 3`;
      this.dom["turn-label"].textContent = `${active.name.endsWith("s") ? `${active.name}'` : `${active.name}'s`} turn`;
      this.dom["wind-label"].textContent = this.wind === 0 ? "CALM" : `${Math.abs(this.wind)} ${this.wind > 0 ? "RIGHT" : "LEFT"}`;
    }

    showToast(message, tone = "", duration = 1200) {
      window.clearTimeout(this.toastTimer);
      const toast = this.dom.toast;
      toast.textContent = message;
      toast.className = `toast${tone ? ` is-${tone}` : ""}`;
      toast.hidden = false;
      this.toastTimer = window.setTimeout(() => { toast.hidden = true; }, duration);
    }

    pause() {
      if (this.state !== "playing") return;
      this.state = "paused";
      this.dom["pause-modal"].hidden = false;
    }

    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.lastFrame = performance.now();
      this.dom["pause-modal"].hidden = true;
    }

    openMenu() {
      this.clearTimers();
      this.state = "menu";
      this.phase = "menu";
      document.body.classList.remove("playing");
      this.dom["setup-modal"].hidden = false;
      this.dom["pause-modal"].hidden = true;
      this.dom["results-modal"].hidden = true;
      this.dom["match-hud"].hidden = true;
      this.dom["game-tools"].hidden = true;
      this.dom["command-band"].hidden = true;
      this.buildWorld();
    }

    clearTimers() {
      window.clearTimeout(this.actionTimer);
      window.clearTimeout(this.toastTimer);
      this.dom.toast.hidden = true;
    }

    schedule(callback, delay) {
      window.clearTimeout(this.actionTimer);
      const run = () => {
        if (this.state === "paused") {
          this.actionTimer = window.setTimeout(run, 120);
          return;
        }
        callback();
      };
      this.actionTimer = window.setTimeout(run, delay);
    }

    handleKey(event) {
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        this.toggleFullscreen();
        return;
      }
      if (event.key === "Escape") {
        if (this.state === "playing") this.pause();
        else if (this.state === "paused") this.resume();
        return;
      }
      if (this.state !== "playing" || this.players[this.currentPlayer]?.ai) return;

      if (this.phase === "supply" && ["1", "2", "3"].includes(event.key)) {
        document.querySelectorAll(".answer-button")[Number(event.key) - 1]?.click();
      } else if (this.phase === "armory" && ["1", "2", "3", "4"].includes(event.key)) {
        document.querySelectorAll(".armory-card")[Number(event.key) - 1]?.click();
      } else if (this.phase === "aim") {
        const player = this.players[this.currentPlayer];
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          player.angle = clamp(player.angle + (event.key === "ArrowUp" ? 1 : -1), 20, 70);
          this.dom["angle-slider"].value = player.angle;
          this.readAimControls();
        } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          player.power = clamp(player.power + (event.key === "ArrowRight" ? 2 : -2), 20, 100);
          this.dom["power-slider"].value = player.power;
          this.readAimControls();
        } else if (event.code === "Space") {
          event.preventDefault();
          this.launchCurrent();
        }
      }
    }

    async toggleFullscreen() {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (error) {
        this.showToast("Fullscreen is not available in this browser.", "bad");
      }
    }

    syncFullscreenIcon() {
      const button = document.getElementById("fullscreen-button");
      const icon = button.querySelector("svg");
      if (!icon) return;
      const name = document.fullscreenElement ? "minimize" : "maximize";
      icon.outerHTML = `<i data-lucide="${name}"></i>`;
      button.title = document.fullscreenElement ? "Exit fullscreen (F)" : "Fullscreen (F)";
      this.syncIcons();
    }

    spawnParticles(x, y, color, count) {
      for (let i = 0; i < count; i += 1) {
        this.particles.push({
          x, y, color, size: random(3, 10), life: random(28, 58),
          vx: random(-5, 5), vy: random(-7, 1), gravity: random(0.12, 0.27)
        });
      }
    }

    updateParticles() {
      this.particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += particle.gravity;
        particle.life -= 1;
      });
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.cssWidth = window.innerWidth;
      this.cssHeight = window.innerHeight;
      this.canvas.width = Math.round(this.cssWidth * dpr);
      this.canvas.height = Math.round(this.cssHeight * dpr);
      this.dpr = dpr;
      this.scale = Math.min(this.cssWidth / WORLD_W, this.cssHeight / WORLD_H);
      this.offsetX = (this.cssWidth - WORLD_W * this.scale) / 2;
      this.offsetY = (this.cssHeight - WORLD_H * this.scale) / 2;
    }

    frame(time) {
      const delta = Math.min(33, time - this.lastFrame || 16.67);
      this.lastFrame = time;
      if (this.state !== "paused") {
        this.Engine.update(this.engine, delta);
        this.updateFlight();
        this.updateParticles();
        this.checkFallenBlocks();
        this.recoil[0] *= 0.86;
        this.recoil[1] *= 0.86;
        this.shake *= 0.83;
      }
      this.draw();
      requestAnimationFrame((next) => this.frame(next));
    }

    checkFallenBlocks() {
      if (this.state !== "playing") return;
      this.players.forEach((player) => {
        player.blocks.forEach((block) => {
          if (block.gameData.active && !block.isStatic && (block.position.y > GROUND_Y + 100 || block.position.x < 0 || block.position.x > WORLD_W)) {
            const wasCore = block.gameData.core;
            this.destroyBlock(block);
            if (wasCore && this.phase !== "round-end") this.endRound(1 - player.id);
          }
        });
        if (this.phase !== "round-end" && this.integrity(player) <= 0.22) this.endRound(1 - player.id);
      });
    }

    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const outerFill = ctx.createLinearGradient(0, 0, 0, this.cssHeight);
      outerFill.addColorStop(0, "#6ebfe5");
      outerFill.addColorStop(0.67, "#b8d9bb");
      outerFill.addColorStop(1, "#4f8f3c");
      ctx.fillStyle = outerFill;
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);
      const shakeX = this.shake > 0.4 ? random(-this.shake, this.shake) : 0;
      const shakeY = this.shake > 0.4 ? random(-this.shake * 0.45, this.shake * 0.45) : 0;
      ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * (this.offsetX + shakeX), this.dpr * (this.offsetY + shakeY));
      this.drawBackground(ctx);
      this.drawWind(ctx);
      this.players.forEach((player) => player.blocks.forEach((block) => {
        if (block.gameData.active) this.drawBlock(ctx, block, player);
      }));
      this.drawCatapult(ctx, 0);
      this.drawCatapult(ctx, 1);
      if (this.phase === "aim" && !this.players[this.currentPlayer].ai) this.drawTrajectory(ctx, this.players[this.currentPlayer]);
      this.projectiles.forEach((projectile) => this.drawProjectile(ctx, projectile));
      this.drawParticles(ctx);
      this.drawForeground(ctx);
    }

    drawBackground(ctx) {
      if (this.bg.complete && this.bg.naturalWidth) ctx.drawImage(this.bg, 0, 0, WORLD_W, WORLD_H);
      else {
        const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        sky.addColorStop(0, "#73c8ed");
        sky.addColorStop(0.66, "#d9eff0");
        sky.addColorStop(0.67, "#75b94a");
        sky.addColorStop(1, "#4f8f3c");
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      }
      ctx.fillStyle = "rgba(47, 98, 48, 0.24)";
      ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
      const groundShade = ctx.createLinearGradient(0, GROUND_Y - 20, 0, GROUND_Y + 80);
      groundShade.addColorStop(0, "rgba(93, 142, 53, 0)");
      groundShade.addColorStop(1, "rgba(38, 91, 42, 0.2)");
      ctx.fillStyle = groundShade;
      ctx.fillRect(0, GROUND_Y - 20, WORLD_W, 130);
      ctx.fillStyle = "rgba(39, 64, 51, 0.22)";
      ctx.beginPath();
      ctx.ellipse(245, GROUND_Y + 4, 185, 24, 0, 0, Math.PI * 2);
      ctx.ellipse(1355, GROUND_Y + 4, 185, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawWind(ctx) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      const direction = this.wind >= 0 ? 1 : -1;
      for (let i = 0; i < 4; i += 1) {
        const y = 210 + i * 77;
        const x = ((performance.now() * 0.035 * (Math.abs(this.wind) + 1) + i * 370) % 1300) + 150;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 35 * direction, y - 9, x + 82 * direction, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawBlock(ctx, block, player) {
      const data = block.gameData;
      const { x, y } = block.position;
      const width = data.width;
      const height = data.height;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(block.angle);
      const flash = data.hitFlash > 0;
      if (flash) data.hitFlash -= 1;
      ctx.fillStyle = flash ? "#fff2af" : data.foundation ? "#68757a" : "#849196";
      ctx.strokeStyle = player.dark;
      ctx.lineWidth = data.core ? 4 : 2;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.strokeRect(-width / 2, -height / 2, width, height);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-width / 2 + 5, -height / 2 + 7);
      ctx.lineTo(width / 2 - 6, -height / 2 + 7);
      ctx.stroke();
      ctx.strokeStyle = "rgba(41, 52, 56, 0.32)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -height / 2);
      ctx.lineTo(0, height / 2);
      if (data.health < data.maxHealth) {
        ctx.moveTo(-6, -height / 2 + 5);
        ctx.lineTo(4, -3);
        ctx.lineTo(-2, 7);
        ctx.lineTo(8, height / 2 - 4);
      }
      ctx.stroke();
      if (data.core) {
        ctx.fillStyle = "#243743";
        ctx.fillRect(-7, -3, 14, 17);
        ctx.beginPath();
        ctx.arc(0, -3, 7, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();

      if (data.core) this.drawFlag(ctx, block, player);
    }

    drawFlag(ctx, block, player) {
      const top = block.position.y - block.gameData.height / 2;
      ctx.save();
      ctx.translate(block.position.x, top);
      ctx.rotate(block.angle);
      ctx.strokeStyle = "#4d3826";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(0, -65);
      ctx.stroke();
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(2, -62);
      ctx.lineTo(player.id === 0 ? 52 : -52, -51);
      ctx.lineTo(2, -34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f8d66d";
      ctx.beginPath();
      ctx.arc(player.id === 0 ? 22 : -22, -50, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawCatapult(ctx, owner) {
      const direction = owner === 0 ? 1 : -1;
      const x = owner === 0 ? 405 : 1195;
      const y = GROUND_Y - 17;
      const recoil = this.recoil[owner];
      const active = this.state === "playing" && this.currentPlayer === owner;
      ctx.save();
      ctx.translate(x - recoil * direction, y);
      ctx.scale(direction, 1);
      if (active) {
        ctx.fillStyle = "rgba(246, 189, 60, 0.3)";
        ctx.beginPath();
        ctx.ellipse(12, 6, 80, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#4b321f";
      ctx.fillStyle = "#7a4b29";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-38, -11);
      ctx.lineTo(46, -11);
      ctx.moveTo(-20, -12);
      ctx.lineTo(6, -58);
      ctx.lineTo(31, -12);
      ctx.stroke();
      ctx.strokeStyle = "#85532c";
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(7, -48);
      ctx.lineTo(46, -103 + recoil * 1.3);
      ctx.stroke();
      ctx.strokeStyle = "#cf9b55";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(45, -101 + recoil * 1.3);
      ctx.quadraticCurveTo(66, -89, 62, -69);
      ctx.stroke();
      ctx.fillStyle = "#535e66";
      ctx.beginPath();
      ctx.arc(58, -66, 12, 0, Math.PI * 2);
      ctx.fill();
      [-29, 34].forEach((wheelX) => {
        ctx.fillStyle = "#4a3525";
        ctx.beginPath();
        ctx.arc(wheelX, 0, 21, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#b58144";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(wheelX, 0, 13, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    drawTrajectory(ctx, player) {
      const direction = player.id === 0 ? 1 : -1;
      const angle = player.angle * Math.PI / 180;
      const speed = 8 + player.power * 0.09;
      const vx = Math.cos(angle) * speed * direction;
      const vy = -Math.sin(angle) * speed;
      const originX = player.id === 0 ? 442 : 1158;
      const originY = GROUND_Y - 78;
      ctx.save();
      for (let t = 0; t <= 70; t += 5) {
        const x = originX + vx * t + this.wind * 0.002 * t * t;
        const y = originY + vy * t + 0.1275 * t * t;
        if (y > GROUND_Y || x < 0 || x > WORLD_W) break;
        ctx.globalAlpha = 0.9 - t / 95;
        ctx.fillStyle = t % 10 === 0 ? "#fff" : player.color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawProjectile(ctx, projectile) {
      const weapon = WEAPONS[projectile.gameData.weapon];
      ctx.save();
      ctx.translate(projectile.position.x, projectile.position.y);
      ctx.rotate(projectile.angle);
      ctx.fillStyle = "rgba(34, 43, 49, 0.2)";
      ctx.beginPath();
      ctx.arc(4, 6, weapon.radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = weapon.color;
      ctx.strokeStyle = "#2c373e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, weapon.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
      ctx.beginPath();
      ctx.arc(-weapon.radius * 0.3, -weapon.radius * 0.35, weapon.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawParticles(ctx) {
      this.particles.forEach((particle) => {
        ctx.globalAlpha = clamp(particle.life / 35, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      });
      ctx.globalAlpha = 1;
    }

    drawForeground(ctx) {
      ctx.strokeStyle = "rgba(33, 104, 43, 0.45)";
      ctx.lineWidth = 3;
      for (let x = 14; x < WORLD_W; x += 31) {
        const height = 7 + (x % 13);
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 8);
        ctx.lineTo(x - 4, GROUND_Y + 8 - height);
        ctx.moveTo(x, GROUND_Y + 8);
        ctx.lineTo(x + 5, GROUND_Y + 5 - height);
        ctx.stroke();
      }
    }

    track(eventName, properties) {
      try {
        if (window.GameAnalytics?.track) window.GameAnalytics.track(eventName, properties);
        else if (window.gtag) window.gtag("event", eventName, properties);
      } catch (error) {
        // Analytics must never interrupt a match.
      }
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    if (!window.Matter) {
      document.body.innerHTML = '<main class="load-error"><h1>Catapult Clash</h1><p>The game engine could not load. Please refresh and try again.</p></main>';
      return;
    }
    window.__catapultGame = new CatapultClash();
  });
})();
