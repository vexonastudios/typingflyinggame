import { SeaBattle, MISSIONS, SIDES, BATTERY, forward, windPower, headingTo } from './combat.mjs';
import { SeaView } from './scene.mjs';

const $ = (id) => document.getElementById(id);
const icons = () => window.lucide?.createIcons();
const storageKey = (key) =>
  typeof ProfileManager !== 'undefined'
    ? ProfileManager.getKey(`broadside-${key}`)
    : `broadside-${key}`;
const readRecord = () => {
  try {
    return JSON.parse(localStorage.getItem(storageKey('career')) || '{}');
  } catch {
    return {};
  }
};

class SeaAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }
  resume() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? 0.38 : 0;
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.ratio.value = 6;
        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      void this.ctx.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.ctx)
      this.master.gain.setTargetAtTime(this.enabled ? 0.38 : 0, this.ctx.currentTime, 0.03);
  }
  tone(frequency, duration, volume, pan = 0, end = frequency) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime,
      osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain(),
      stereo = this.ctx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    stereo.pan.value = pan;
    osc.connect(gain);
    gain.connect(stereo);
    stereo.connect(this.master);
    osc.start();
    osc.stop(now + duration);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
  }
  noise(duration, frequency, volume, pan = 0) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime,
      source = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      gain = this.ctx.createGain(),
      stereo = this.ctx.createStereoPanner();
    source.buffer = this.noiseBuffer;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    stereo.pan.value = pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(stereo);
    stereo.connect(this.master);
    source.start();
    source.stop(now + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
  }
  event(event, player) {
    const pan = event.side === 'port' ? -0.55 : 0.55;
    if (event.type === 'cannon') {
      const volume =
        event.ship.team === 'player'
          ? 0.9
          : Math.max(0.08, 0.5 - Math.hypot(event.x - player.x, event.y - player.y) / 180);
      this.tone(110, 0.42, volume, pan, 30);
      this.noise(0.4, 950, volume * 0.8, pan);
    }
    if (event.type === 'hit') {
      this.noise(0.18, 1800, 0.55);
      this.tone(150, 0.16, 0.35, 0, 50);
    }
    if (event.type === 'splash') this.noise(0.24, 3000, 0.08);
    if (event.type === 'sunk') {
      this.noise(1.1, 450, 0.7);
      this.tone(70, 0.9, 0.7, 0, 26);
    }
    if (event.type === 'ready' && event.ship.team === 'player') {
      this.tone(620, 0.23, 0.25, pan);
      this.tone(930, 0.4, 0.1, pan);
    }
  }
}

class BroadsideGame {
  constructor() {
    this.view = new SeaView($('sea'));
    this.audio = new SeaAudio();
    this.battle = new SeaBattle();
    this.view.load(this.battle);
    this.state = 'harbor';
    this.paused = false;
    this.keys = new Set();
    this.touch = new Set();
    this.sails = 2;
    this.accumulator = 0;
    this.lastTime = 0;
    this.uiTime = 0;
    this.toastUntil = 0;
    this.resultAt = null;
    this.logEntries = [];
    this.labels = new Map();
    this.savedResult = false;
    this.timerPaused = false;
    this.bind();
    this.makeLabels();
    this.updateHud();
    this.career();
    icons();
    $('start').disabled = false;
    $('start').querySelector('span').textContent = 'Set sail';
    requestAnimationFrame((time) => this.loop(time));
    if (['localhost', '127.0.0.1'].includes(location.hostname)) window.__broadside = this;
  }

  bind() {
    $('start').addEventListener('click', () => this.start());
    $('mission').addEventListener('change', () => this.preview());
    document
      .querySelectorAll('[name="difficulty"]')
      .forEach((input) => input.addEventListener('change', () => this.preview()));
    for (const side of SIDES) $(side).addEventListener('click', () => this.fire(side));
    $('sails').addEventListener('input', (event) => {
      this.sails = Number(event.target.value);
    });
    for (const id of ['left', 'right']) {
      const button = $(id);
      button.addEventListener('pointerdown', (event) => {
        if (this.state !== 'playing' || this.paused) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.touch.add(id);
        button.classList.add('held');
      });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
        button.addEventListener(name, () => {
          this.touch.delete(id);
          button.classList.remove('held');
        });
    }
    $('pause').addEventListener('click', () => this.pause());
    $('resume').addEventListener('click', () => this.resume());
    $('restart').addEventListener('click', () => this.start());
    $('retry').addEventListener('click', () => this.start());
    $('returnHarbor').addEventListener('click', () => this.harbor());
    $('resultHarbor').addEventListener('click', () => this.harbor());
    $('next').addEventListener('click', () => {
      if (this.battle.result === 'victory' && this.battle.missionIndex < 2)
        $('mission').value = String(this.battle.missionIndex + 1);
      this.start();
    });
    $('fullscreen').addEventListener('click', () => this.fullscreen());
    document.addEventListener('fullscreenchange', () => {
      const full = !!document.fullscreenElement;
      $('fullscreen').setAttribute('aria-label', full ? 'Exit fullscreen' : 'Enter fullscreen');
      $('fullscreen').innerHTML = `<i data-lucide="${full ? 'minimize' : 'maximize'}"></i>`;
      icons();
      this.view.resize();
    });
    $('sound').addEventListener('click', () => {
      this.audio.resume();
      this.audio.toggle();
      $('sound').setAttribute('aria-label', this.audio.enabled ? 'Mute sound' : 'Enable sound');
      $('sound').setAttribute('title', this.audio.enabled ? 'Mute sound' : 'Enable sound');
      $('sound').innerHTML =
        `<i data-lucide="${this.audio.enabled ? 'volume-2' : 'volume-x'}"></i>`;
      icons();
    });
    $('timer').addEventListener('click', () => $('kid-timer-btn')?.click());
    $('help').addEventListener('click', () => {
      this.helpWasPlaying = this.state === 'playing' && !this.paused;
      this.paused = this.state === 'playing';
      this.clearInput();
      $('helpDialog').showModal();
    });
    const closeHelp = () => {
      $('helpDialog').close();
      if (this.helpWasPlaying) this.resume();
      this.helpWasPlaying = false;
    };
    $('closeHelp').addEventListener('click', closeHelp);
    $('helpReady').addEventListener('click', closeHelp);
    $('helpDialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      closeHelp();
    });
    $('pauseDialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      this.resume();
    });
    $('resultDialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      this.harbor();
    });
    window.addEventListener('keydown', (event) => this.keydown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      if (this.state === 'playing' && !this.paused) this.pause();
      this.clearInput();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && !this.paused) this.pause();
    });
    window.addEventListener('resize', () => this.view.resize());
    $('sea').addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.pause();
      this.fail('The graphics connection was interrupted. Reload to return to the harbor.');
    });
  }

  keydown(event) {
    const editing = document.activeElement?.matches(
      'select, textarea, input:not([type="range"]):not([type="radio"])',
    );
    if (event.code === 'KeyF' && !editing && !event.repeat) {
      event.preventDefault();
      void this.fullscreen();
      return;
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (
        document.querySelector('dialog[open]') ||
        $('timer-main-overlay')?.classList.contains('active')
      )
        return;
      if (this.state === 'playing') {
        event.preventDefault();
        this.paused ? this.resume() : this.pause();
      }
      return;
    }
    if (
      this.state !== 'playing' ||
      this.paused ||
      document.querySelector('dialog[open]') ||
      editing ||
      this.timerPaused
    )
      return;
    if (
      ![
        'KeyA',
        'KeyD',
        'ArrowLeft',
        'ArrowRight',
        'KeyW',
        'KeyS',
        'ArrowUp',
        'ArrowDown',
        'KeyQ',
        'KeyE',
      ].includes(event.code)
    )
      return;
    event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyQ') this.fire('port');
    if (event.code === 'KeyE') this.fire('starboard');
    if (['KeyW', 'ArrowUp'].includes(event.code)) this.sails = Math.min(3, this.sails + 1);
    if (['KeyS', 'ArrowDown'].includes(event.code)) this.sails = Math.max(0, this.sails - 1);
    $('sails').value = String(this.sails);
  }

  clearInput() {
    this.keys.clear();
    this.touch.clear();
    $('left').classList.remove('held');
    $('right').classList.remove('held');
  }

  preview() {
    if (this.state !== 'harbor') return;
    const difficulty = document.querySelector('[name="difficulty"]:checked').value;
    this.battle.reset(Number($('mission').value), difficulty);
    this.view.load(this.battle);
    this.makeLabels();
    this.updateHud();
    $('orders').textContent = this.battle.mission.description;
    this.career();
  }

  start() {
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    this.clearInput();
    const difficulty = document.querySelector('[name="difficulty"]:checked').value;
    this.battle.reset(Number($('mission').value), difficulty);
    this.view.load(this.battle);
    this.makeLabels();
    this.state = 'playing';
    this.paused = false;
    this.accumulator = 0;
    this.sails = 2;
    this.resultAt = null;
    this.savedResult = false;
    this.logEntries = [];
    $('battleLog').replaceChildren();
    $('sails').value = '2';
    $('harbor').hidden = true;
    $('helm').hidden = false;
    $('pause').disabled = false;
    this.audio.resume();
    this.toast(this.battle.mission.description, 4);
    this.updateHud();
    document.activeElement?.blur();
  }

  harbor() {
    document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
    this.state = 'harbor';
    this.paused = false;
    this.resultAt = null;
    this.clearInput();
    $('harbor').hidden = false;
    $('helm').hidden = true;
    $('pause').disabled = true;
    $('toast').hidden = true;
    $('battleLog').replaceChildren();
    this.logEntries = [];
    this.preview();
  }

  pause() {
    if (this.state !== 'playing' || this.battle.result || this.paused) return;
    this.paused = true;
    this.clearInput();
    $('pauseDialog').showModal();
  }
  resume() {
    $('pauseDialog').close();
    this.paused = false;
    this.accumulator = 0;
    this.clearInput();
    this.audio.resume();
    document.activeElement?.blur();
  }
  async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else this.toast('This browser does not support fullscreen.');
    } catch {
      this.toast('Fullscreen was unavailable. Try the fullscreen button.');
    }
  }

  fire(side) {
    if (
      this.state !== 'playing' ||
      this.paused ||
      this.timerPaused ||
      document.querySelector('dialog[open]')
    )
      return;
    this.audio.resume();
    if (!this.battle.fire(this.battle.player, side)) {
      const remaining = this.battle.player.batteries[side].remaining;
      if (remaining > 0)
        this.toast(
          `${side === 'port' ? 'Port' : 'Starboard'} still reloading / ${remaining.toFixed(1)}s`,
          1.3,
        );
    }
    this.updateHud();
  }

  toast(message, duration = 2.7) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    this.toastUntil = performance.now() + duration * 1000;
  }
  log(message, side) {
    const entry = document.createElement('div');
    entry.textContent = message;
    if (side) entry.className = side;
    $('battleLog').appendChild(entry);
    this.logEntries.push({ element: entry, until: this.battle.time + 7 });
    while (this.logEntries.length > 3) this.logEntries.shift().element.remove();
  }

  events(events) {
    this.view.events(events);
    for (const event of events) {
      this.audio.event(event, this.battle.player);
      if (event.type === 'broadside') {
        if (event.ship.team === 'player')
          this.log(`${event.side === 'port' ? 'Port' : 'Starboard'} broadside away`, event.side);
        else this.log(`${event.ship.name}: ${event.side} salvo`);
      }
      if (event.type === 'ready' && event.ship.team === 'player')
        this.log(`${event.side === 'port' ? 'Port' : 'Starboard'} battery ready`, event.side);
      if (event.type === 'alternating')
        this.toast('Both sides brought to bear. Well sailed, Captain.', 3);
      if (event.type === 'sunk' && event.ship.team === 'enemy')
        this.toast(`${event.ship.name} defeated`, 3);
      if (event.type === 'collision' && event.ship.team === 'player')
        this.toast('Hull collision / steer clear', 1.5);
      if (event.type === 'result' && this.resultAt == null)
        this.resultAt = performance.now() + 2000;
    }
  }

  makeLabels() {
    $('shipLabels').replaceChildren();
    this.labels.clear();
    this.battle.ships
      .filter((s) => s.team === 'enemy')
      .forEach((ship) => {
        const label = document.createElement('div');
        label.className = 'ship-label';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = ship.name;
        label.appendChild(name);
        const hull = document.createElement('div');
        hull.className = 'enemy-hull';
        hull.innerHTML = '<i></i>';
        label.appendChild(hull);
        const batteries = document.createElement('div');
        batteries.className = 'enemy-batteries';
        batteries.innerHTML = '<span></span><span></span>';
        label.appendChild(batteries);
        const intent = document.createElement('div');
        intent.className = 'intent';
        label.appendChild(intent);
        $('shipLabels').appendChild(label);
        this.labels.set(ship.id, {
          label,
          hull: hull.firstChild,
          sides: [...batteries.children],
          intent,
        });
      });
  }

  updateHud() {
    const player = this.battle.player;
    $('objective').textContent = this.battle.mission.name;
    $('location').textContent = this.battle.mission.location;
    $('hullText').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    $('hullFill').style.width = `${(player.hp / player.maxHp) * 100}%`;
    $('hullFill').style.background =
      player.hp < player.maxHp * 0.3 ? 'var(--port)' : 'var(--starboard)';
    $('hullMeter').setAttribute('aria-valuenow', String(Math.ceil(player.hp)));
    $('hullMeter').setAttribute('aria-valuemax', String(player.maxHp));
    $('speed').textContent = (player.speed * 1.4).toFixed(1);
    const bearing = (Math.round((player.heading * 180) / Math.PI) + 36000) % 360;
    const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
    $('heading').textContent = `${String(bearing).padStart(3, '0')} ${cardinal}`;
    $('sailName').textContent = ['Furled', 'Half sail', 'Battle sail', 'Full sail'][this.sails];
    $('sails').setAttribute(
      'aria-valuetext',
      ['Furled', 'Half sail', 'Battle sail', 'Full sail'][this.sails],
    );
    const power = windPower(player.heading, this.battle.wind);
    $('windPower').textContent = `${Math.round(power * 100)}% sail power`;
    const following = Math.cos(player.heading - this.battle.wind);
    $('windState').textContent =
      following < -0.65 ? 'Headwind' : following > 0.65 ? 'Following wind' : 'Crosswind';
    for (const side of SIDES) {
      const battery = player.batteries[side],
        reloading = battery.remaining > 0;
      $(side).disabled = reloading || !player.alive || !!this.battle.result;
      $(side).setAttribute(
        'aria-label',
        reloading
          ? `${side} cannons reloading, ${battery.remaining.toFixed(1)} seconds`
          : `Fire ${side} broadside`,
      );
      $(`${side}State`).textContent = reloading ? `${battery.remaining.toFixed(1)}s` : 'READY';
      $(`${side}Detail`).textContent = battery.guns.some((g) => g.state === 'firing')
        ? 'FIRING SALVO'
        : reloading
          ? 'RELOADING'
          : '5 GUNS LOADED';
      $(`${side}Progress`).style.transform =
        `scaleX(${1 - battery.remaining / (BATTERY.reload + BATTERY.stagger * 4)})`;
      [...$(`${side}Guns`).children].forEach((gun, i) => {
        gun.className = battery.guns[i].state;
      });
    }
    const enemies = this.battle.ships.filter((ship) => ship.team === 'enemy' && ship.alive);
    $('remaining').textContent = `${enemies.length} ${enemies.length === 1 ? 'raider' : 'raiders'}`;
    if (enemies.length > 0 && this.state === 'playing') {
      const nearest = enemies.reduce((a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) < Math.hypot(b.x - player.x, b.y - player.y)
          ? a
          : b,
      );
      const screen = this.view.project(nearest.x, nearest.y, 8);
      $('bearingNotice').hidden = screen.visible;
      $('bearingNotice').querySelector('span').textContent =
        `${nearest.name} / ${Math.round(Math.hypot(nearest.x - player.x, nearest.y - player.y))}m`;
      const angle = headingTo(player, nearest);
      $('bearingNotice')
        .querySelector('svg')
        ?.style.setProperty('transform', `rotate(${angle + Math.PI / 4}rad)`);
    } else $('bearingNotice').hidden = true;
    const timerText = $('kid-timer-text')?.textContent || '';
    $('timerValue').textContent = timerText.includes(':') ? timerText : '';
    this.drawChart();
  }

  updateLabels() {
    const obstructions = [...document.querySelectorAll('.topbar, .ship-status, .chart-panel')].map(
      (element) => element.getBoundingClientRect(),
    );
    for (const ship of this.battle.ships.filter((s) => s.team === 'enemy')) {
      const label = this.labels.get(ship.id),
        screen = this.view.project(ship.x, ship.y, ship.flagship ? 17 : 15);
      const left = screen.x - 55,
        right = screen.x + 55,
        top = screen.y - 54;
      const obstructed = obstructions.some(
        (r) => left < r.right && right > r.left && top < r.bottom && screen.y > r.top,
      );
      label.label.hidden = !ship.alive || !screen.visible || obstructed;
      label.label.style.left = `${screen.x}px`;
      label.label.style.top = `${screen.y}px`;
      label.hull.style.width = `${(ship.hp / ship.maxHp) * 100}%`;
      SIDES.forEach((side, i) => {
        const ready = ship.batteries[side].remaining <= 0;
        label.sides[i].textContent =
          `${i === 0 ? 'P' : 'S'} ${ready ? 'READY' : ship.batteries[side].remaining.toFixed(1) + 's'}`;
        label.sides[i].className = ready ? 'loaded' : '';
      });
      label.intent.textContent = this.state === 'playing' ? ship.aiMode : '';
    }
  }

  drawChart() {
    const ctx = $('chart').getContext('2d');
    const s = 0.96,
      cx = 150;
    ctx.clearRect(0, 0, 300, 300);
    ctx.strokeStyle = '#6d9f9b33';
    ctx.lineWidth = 1;
    for (let n = 30; n < 300; n += 40) {
      ctx.beginPath();
      ctx.moveTo(n, 0);
      ctx.lineTo(n, 300);
      ctx.moveTo(0, n);
      ctx.lineTo(300, n);
      ctx.stroke();
    }
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = '#c8c39844';
    ctx.beginPath();
    ctx.arc(cx, cx, 137 * s, 0, 6.284);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const island of this.battle.islands) {
      ctx.fillStyle = '#b1b487';
      ctx.beginPath();
      ctx.arc(cx + island.x * s, cx + island.y * s, island.r * s, 0, 6.284);
      ctx.fill();
      ctx.fillStyle = '#59876d';
      ctx.beginPath();
      ctx.arc(cx + island.x * s, cx + island.y * s, island.r * 0.7 * s, 0, 6.284);
      ctx.fill();
    }
    for (const ship of this.battle.ships.filter((s) => s.alive)) {
      ctx.save();
      ctx.translate(cx + ship.x * s, cx + ship.y * s);
      ctx.rotate(ship.heading);
      ctx.fillStyle = ship.team === 'player' ? '#aaf8cc' : '#fb997c';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(263, 34);
    ctx.rotate(this.battle.wind);
    ctx.strokeStyle = '#ebd699';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(0, -12);
    ctx.moveTo(-5, -6);
    ctx.lineTo(0, -12);
    ctx.lineTo(5, -6);
    ctx.stroke();
    ctx.restore();
  }

  result() {
    if (this.savedResult) return;
    this.savedResult = true;
    this.state = 'result';
    this.clearInput();
    $('pause').disabled = true;
    const won = this.battle.result === 'victory',
      player = this.battle.player;
    const accuracy = this.battle.salvos
      ? Math.round((this.battle.hits / (this.battle.salvos * BATTERY.guns)) * 100)
      : 0;
    $('resultEyebrow').textContent = won ? 'BAY SECURED' : 'SHIP LOST';
    $('resultTitle').textContent = won
      ? this.battle.missionIndex === 2
        ? 'The harbor is yours'
        : 'Well sailed, Captain'
      : 'A course to reconsider';
    $('resultDescription').textContent = won
      ? `${this.battle.mission.name} completed in ${Math.floor(this.battle.time / 60)}:${String(Math.floor(this.battle.time % 60)).padStart(2, '0')}.`
      : 'The raiders still hold these waters. Return with a new approach.';
    $('resultAccuracy').textContent = `${accuracy}%`;
    $('resultAlternations').textContent = String(this.battle.alternations);
    $('resultHull').textContent = `${Math.ceil((player.hp / player.maxHp) * 100)}%`;
    $('next').querySelector('span').textContent =
      won && this.battle.missionIndex < 2 ? 'Next encounter' : 'Set sail again';
    if (won) {
      const record = readRecord();
      record.wins = (record.wins || 0) + 1;
      record.completed = [...new Set([...(record.completed || []), this.battle.missionIndex])];
      record.bestAccuracy = Math.max(accuracy, record.bestAccuracy || 0);
      try {
        localStorage.setItem(storageKey('career'), JSON.stringify(record));
      } catch {
        /* Records are optional in private sessions. */
      }
    }
    $('resultDialog').showModal();
  }

  career() {
    const record = readRecord();
    $('career').textContent = record.wins
      ? `${record.wins} victories / ${record.completed?.length || 0} of 3 waters secured`
      : '10 cannons. Two broadsides. One captain.';
  }
  fail(message) {
    $('loadError').hidden = false;
    $('errorDetail').textContent = message;
  }

  loop(time) {
    const dt = Math.min(0.08, (time - (this.lastTime || time)) / 1000);
    this.lastTime = time;
    this.timerPaused = !!$('timer-main-overlay')?.classList.contains('active');
    const active = this.state === 'playing' && !this.paused && !this.timerPaused;
    if (active && !this.battle.result) {
      this.accumulator += dt;
      const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.has('left');
      const right = this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.has('right');
      while (this.accumulator >= 1 / 60) {
        this.battle.step(1 / 60, { rudder: Number(right) - Number(left), sails: this.sails });
        this.accumulator -= 1 / 60;
      }
    } else this.accumulator = 0;
    this.events(this.battle.drainEvents());
    this.view.render(dt, this.state !== 'harbor', this.paused || this.timerPaused);
    this.updateLabels();
    this.uiTime += dt;
    if (this.uiTime >= 0.08) {
      this.updateHud();
      this.uiTime = 0;
    }
    if (time > this.toastUntil) $('toast').hidden = true;
    for (const entry of this.logEntries) if (entry.until < this.battle.time) entry.element.remove();
    this.logEntries = this.logEntries.filter((entry) => entry.until >= this.battle.time);
    if (this.resultAt != null && time >= this.resultAt && !this.timerPaused) this.result();
    requestAnimationFrame((next) => this.loop(next));
  }
}

try {
  new BroadsideGame();
} catch (error) {
  console.error('Broadside Bay could not start:', error);
  $('loadError').hidden = false;
  $('errorDetail').textContent =
    'This game needs WebGL graphics. Try reloading or enabling hardware acceleration in your browser.';
}
