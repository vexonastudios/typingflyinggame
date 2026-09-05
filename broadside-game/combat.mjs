import { World, Vec2, Polygon, Circle } from './vendor/planck.mjs';

export const SIDES = ['port', 'starboard'];
export const BATTERY = Object.freeze({
  guns: 5,
  reload: 9.6,
  stagger: 0.085,
  range: 48,
  speed: 38,
  halfArc: 0.15,
  damage: 10,
});
export const SIDE_SIGN = Object.freeze({ port: -1, starboard: 1 });
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const headingTo = (a, b) => Math.atan2(b.x - a.x, a.y - b.y);
export const forward = (h) => ({ x: Math.sin(h), y: -Math.cos(h) });

export const MISSIONS = [
  {
    name: 'First Broadside',
    location: 'THE OUTER REEF',
    description: 'Clear the raider guarding the bay.',
    wind: 1.15,
    spawn: { x: -18, y: 21, h: -0.22 },
    enemies: [{ x: 20, y: -8, h: 0.1, name: 'Red Kestrel', hp: 100 }],
    islands: [
      { x: -68, y: -40, r: 18 },
      { x: 66, y: 31, r: 16 },
      { x: 45, y: -73, r: 12 },
      { x: -48, y: 73, r: 10 },
    ],
    seed: 14,
  },
  {
    name: 'The Crossfire',
    location: 'NEEDLE PASS',
    description: 'Break the blockade. Two raiders hold the passage.',
    wind: -0.45,
    spawn: { x: 0, y: 42, h: 0 },
    enemies: [
      { x: -32, y: -5, h: 0.8, name: 'Copper Finch', hp: 100 },
      { x: 42, y: -26, h: -0.6, name: 'Red Kestrel', hp: 100 },
    ],
    islands: [
      { x: -64, y: 20, r: 18 },
      { x: 67, y: 18, r: 17 },
      { x: -10, y: -58, r: 13 },
      { x: -65, y: -70, r: 15 },
      { x: 60, y: 84, r: 11 },
    ],
    seed: 23,
  },
  {
    name: 'The Iron Admiral',
    location: 'CROWN ANCHORAGE',
    description: 'Defeat the flagship and its escort to reopen the harbor.',
    wind: 2.2,
    spawn: { x: -15, y: 46, h: 0.2 },
    enemies: [
      { x: 26, y: -7, h: -0.25, name: 'Iron Admiral', hp: 200, flagship: true },
      { x: -40, y: -34, h: 1, name: 'Copper Finch', hp: 90 },
    ],
    islands: [
      { x: 68, y: -44, r: 20 },
      { x: -69, y: 14, r: 17 },
      { x: -27, y: -82, r: 18 },
      { x: 75, y: 65, r: 12 },
      { x: -48, y: 87, r: 10 },
    ],
    seed: 31,
  },
];

export function createBattery() {
  return {
    remaining: 0,
    volley: 0,
    guns: Array.from({ length: BATTERY.guns }, () => ({
      state: 'ready',
      cooldown: 0,
      delay: 0,
      recoil: 0,
    })),
  };
}

export function windPower(heading, wind) {
  const following = Math.cos(heading - wind);
  return 0.32 + 0.64 * Math.pow((following + 1) / 2, 0.55) + 0.14 * (1 - Math.abs(following));
}

export function batteryBearing(ship, side) {
  return ship.heading + (SIDE_SIGN[side] * Math.PI) / 2;
}

export function inFiringArc(ship, target, side, padding = 0) {
  if (!SIDES.includes(side)) return false;
  const d = Math.hypot(target.x - ship.x, target.y - ship.y);
  return (
    d > 3 &&
    d <= BATTERY.range &&
    Math.abs(angleDelta(headingTo(ship, target), batteryBearing(ship, side))) <=
      BATTERY.halfArc + padding
  );
}

export class SeaBattle {
  constructor(missionIndex = 0, difficulty = 'captain') {
    this.reset(missionIndex, difficulty);
  }

  reset(missionIndex = this.missionIndex, difficulty = this.difficulty) {
    this.missionIndex = clamp(missionIndex, 0, MISSIONS.length - 1);
    this.mission = MISSIONS[this.missionIndex];
    this.difficulty = difficulty;
    this.world = new World(Vec2(0, 0));
    this.time = 0;
    this.result = null;
    this.events = [];
    this.projectiles = [];
    this.salvos = 0;
    this.hits = 0;
    this.alternations = 0;
    this.lastPlayerSide = null;
    this.lastPlayerFire = -100;
    this.islands = this.mission.islands.map((island) => ({ ...island }));
    this.ships = [];
    this.nextShotId = 0;
    this.wind = this.mission.wind;
    for (const island of this.islands) {
      const body = this.world.createBody(Vec2(island.x, island.y));
      body.createFixture(Circle(island.r * 0.81), {
        friction: 0.3,
        restitution: 0.15,
        filterCategoryBits: 16,
      });
      body.setUserData({ type: 'island', island });
    }
    this.player = this.addShip({
      ...this.mission.spawn,
      name: 'Resolute',
      hp: difficulty === 'cadet' ? 210 : 150,
      team: 'player',
    });
    this.mission.enemies.forEach((enemy) => this.addShip({ ...enemy, team: 'enemy' }));
    this.world.on('begin-contact', (contact) => this.contact(contact));
  }

  addShip({ x, y, h, name, hp, team, flagship = false }) {
    const ship = {
      id: this.ships.length,
      x,
      y,
      heading: h,
      name,
      team,
      flagship,
      hp,
      maxHp: hp,
      sails: team === 'player' ? 2 : 3,
      rudder: 0,
      speed: 0,
      alive: true,
      sunkAt: null,
      batteries: { port: createBattery(), starboard: createBattery() },
      aiSide: 'port',
      aiDecision: 0,
      aiReconsider: 0,
      aiMode: 'Closing',
      immunity: 0,
      lastSalvo: null,
      lastHit: -10,
    };
    const scale = flagship ? 1.18 : 1;
    ship.body = this.world.createDynamicBody({
      position: Vec2(x, y),
      angle: h,
      angularDamping: 0.3,
      linearDamping: 0.1,
    });
    ship.body.createFixture(
      Polygon([
        Vec2(-2.1 * scale, 5.9 * scale),
        Vec2(-2.65 * scale, -2.6 * scale),
        Vec2(0, -7.2 * scale),
        Vec2(2.65 * scale, -2.6 * scale),
        Vec2(2.1 * scale, 5.9 * scale),
      ]),
      {
        density: 1.8,
        friction: 0.12,
        restitution: 0.2,
        filterCategoryBits: team === 'player' ? 1 : 2,
        filterMaskBits: team === 'player' ? 27 : 23,
      },
    );
    ship.body.setUserData({ type: 'ship', ship });
    this.ships.push(ship);
    return ship;
  }

  fire(ship, side) {
    if (this.result || !ship.alive || !SIDES.includes(side)) return false;
    const battery = ship.batteries[side];
    if (battery.remaining > 0 || battery.guns.some((gun) => gun.state !== 'ready')) return false;
    battery.remaining = BATTERY.reload + (BATTERY.guns - 1) * BATTERY.stagger;
    battery.volley += 1;
    battery.guns.forEach((gun, index) => {
      gun.state = 'firing';
      gun.delay = index * BATTERY.stagger;
      gun.cooldown = BATTERY.reload;
    });
    ship.lastSalvo = side;
    if (ship.team === 'player') {
      this.salvos++;
      if (
        this.lastPlayerSide &&
        this.lastPlayerSide !== side &&
        this.time - this.lastPlayerFire < BATTERY.reload
      ) {
        this.alternations++;
        this.emit('alternating', { ship, side });
      }
      this.lastPlayerSide = side;
      this.lastPlayerFire = this.time;
    }
    this.emit('broadside', { ship, side });
    return true;
  }

  emit(type, data = {}) {
    this.events.push({ type, time: this.time, ...data });
  }
  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  launch(ship, side, index) {
    const sign = SIDE_SIGN[side];
    const origin = ship.body.getWorldPoint(
      Vec2(sign * (ship.flagship ? 3.7 : 3.2), (index - 2) * 1.7),
    );
    const heading = batteryBearing(ship, side) + (sign * (index - 2) * BATTERY.halfArc) / 2;
    const direction = forward(heading);
    const shot = {
      id: ++this.nextShotId,
      owner: ship,
      side,
      index,
      x: origin.x,
      y: origin.y,
      age: 0,
      dead: false,
      distance: 0,
      lastX: origin.x,
      lastY: origin.y,
    };
    // Bullet bodies enable Box2D continuous collision detection for fast cannonballs.
    shot.body = this.world.createDynamicBody({
      position: origin,
      bullet: true,
      linearVelocity: Vec2(direction.x * BATTERY.speed, direction.y * BATTERY.speed),
    });
    shot.body.createFixture(Circle(0.28), {
      density: 0.02,
      filterCategoryBits: ship.team === 'player' ? 4 : 8,
      filterMaskBits: ship.team === 'player' ? 18 : 17,
    });
    shot.body.setUserData({ type: 'shot', shot });
    this.projectiles.push(shot);
    this.emit('cannon', { ship, side, index, x: origin.x, y: origin.y, heading });
  }

  contact(contact) {
    const a = contact.getFixtureA().getBody().getUserData();
    const b = contact.getFixtureB().getBody().getUserData();
    const projectile = a?.type === 'shot' ? a : b?.type === 'shot' ? b : null;
    const other = projectile === a ? b : a;
    if (projectile && other) {
      const shot = projectile.shot;
      if (shot.dead) return;
      shot.dead = true;
      const p = shot.body.getPosition();
      if (other.type === 'ship' && other.ship.alive) {
        this.damage(other.ship, BATTERY.damage, shot.owner);
        if (shot.owner.team === 'player') this.hits++;
        this.emit('hit', { x: p.x, y: p.y, ship: other.ship, owner: shot.owner });
      } else this.emit('splash', { x: p.x, y: p.y });
    } else if (a?.type === 'ship' || b?.type === 'ship') {
      for (const item of [a, b]) {
        if (item?.type === 'ship' && item.ship.alive && item.ship.immunity <= 0) {
          const ship = item.ship;
          const speed = ship.body.getLinearVelocity().length();
          if (speed > 2) {
            this.damage(ship, Math.min(12, speed), null);
            ship.immunity = 1.8;
            this.emit('collision', { ship });
          }
        }
      }
    }
  }

  damage(ship, damage, owner) {
    ship.hp = Math.max(0, ship.hp - damage);
    ship.lastHit = this.time;
    if (ship.hp <= 0 && ship.alive) {
      ship.alive = false;
      ship.sunkAt = this.time;
      this.emit('sunk', { ship, owner });
    }
  }

  canSee(from, to) {
    let clear = true;
    this.world.rayCast(Vec2(from.x, from.y), Vec2(to.x, to.y), (fixture) => {
      if (fixture.getBody().getUserData()?.type === 'island') {
        clear = false;
        return 0;
      }
      return -1;
    });
    return clear;
  }

  updateAi(ship, dt) {
    const target = this.player;
    if (!target.alive) {
      ship.sails = 1;
      return;
    }
    const distance = Math.hypot(target.x - ship.x, target.y - ship.y);
    const velocity = target.body.getLinearVelocity();
    const leadTime = clamp(distance / BATTERY.speed, 0, 1.3);
    const lead = { x: target.x + velocity.x * leadTime, y: target.y + velocity.y * leadTime };
    const bearing = headingTo(ship, lead);
    ship.aiReconsider -= dt;
    if (ship.aiReconsider <= 0) {
      const cost = (side) =>
        ship.batteries[side].remaining * 0.35 +
        Math.abs(angleDelta(bearing, batteryBearing(ship, side)));
      const other = ship.aiSide === 'port' ? 'starboard' : 'port';
      if (cost(other) + 0.32 < cost(ship.aiSide)) ship.aiSide = other;
      ship.aiReconsider = 0.45;
    }
    const preferred = ship.batteries[ship.aiSide];
    let desired = bearing - (SIDE_SIGN[ship.aiSide] * Math.PI) / 2;
    if (distance > 39) {
      desired = bearing - SIDE_SIGN[ship.aiSide] * clamp(1 - (distance - 39) / 45, 0, 1) * 0.95;
      ship.aiMode = 'Closing';
    } else if (distance < 15) {
      desired = bearing + Math.PI * 0.8 * SIDE_SIGN[ship.aiSide];
      ship.aiMode = 'Repositioning';
    } else
      ship.aiMode = preferred.remaining > 1 ? 'Turning to loaded guns' : 'Presenting broadside';
    ship.sails = distance < 43 && Math.abs(angleDelta(desired, ship.heading)) < 0.35 ? 1 : 3;
    // Avoid shores and other hulls before choosing a firing heading.
    let avoidance = { x: 0, y: 0 };
    const ahead = forward(ship.heading);
    const look = { x: ship.x + ahead.x * 13, y: ship.y + ahead.y * 13 };
    for (const obstacle of [
      ...this.islands,
      ...this.ships.filter((s) => s !== ship && s.alive).map((s) => ({ x: s.x, y: s.y, r: 7 })),
    ]) {
      const dx = look.x - obstacle.x,
        dy = look.y - obstacle.y;
      const d = Math.hypot(dx, dy),
        safe = obstacle.r + 13;
      if (d < safe) {
        avoidance.x += ((dx / Math.max(0.1, d)) * (safe - d)) / safe;
        avoidance.y += ((dy / Math.max(0.1, d)) * (safe - d)) / safe;
      }
    }
    if (Math.hypot(ship.x, ship.y) > 115) {
      avoidance.x -= ship.x / 100;
      avoidance.y -= ship.y / 100;
    }
    if (Math.hypot(avoidance.x, avoidance.y) > 0.1) {
      const v = forward(desired);
      desired = Math.atan2(v.x + avoidance.x * 4, -v.y - avoidance.y * 4);
      ship.aiMode = 'Clearing obstacles';
      ship.sails = 2;
    }
    ship.rudder = clamp(angleDelta(desired, ship.heading) * 2.8, -1, 1);
    ship.aiDecision -= dt;
    if (ship.aiDecision <= 0) {
      ship.aiDecision = this.difficulty === 'cadet' ? 0.55 : 0.24;
      // The same public fire() path checks each battery. There is no AI forward-fire path.
      for (const side of [ship.aiSide, ship.aiSide === 'port' ? 'starboard' : 'port']) {
        if (
          ship.batteries[side].remaining === 0 &&
          inFiringArc(ship, lead, side) &&
          this.canSee(ship, lead)
        ) {
          this.fire(ship, side);
          break;
        }
      }
    }
  }

  step(dt, controls = {}, ai = true) {
    if (this.result) return;
    this.time += dt;
    for (const ship of this.ships) {
      if (!ship.alive) {
        if (ship.body.isActive()) ship.body.setActive(false);
        continue;
      }
      if (ship.team === 'player') {
        ship.rudder = clamp(controls.rudder || 0, -1, 1);
        if (controls.sails != null) ship.sails = clamp(controls.sails, 0, 3);
      } else if (ai) this.updateAi(ship, dt);
      ship.immunity = Math.max(0, ship.immunity - dt);
      for (const side of SIDES) {
        const battery = ship.batteries[side];
        for (let i = 0; i < battery.guns.length; i++) {
          const gun = battery.guns[i];
          gun.recoil = Math.max(0, gun.recoil - dt * 3.5);
          if (gun.state === 'firing') {
            gun.delay -= dt;
            if (gun.delay <= 0) {
              this.launch(ship, side, i);
              gun.state = 'reloading';
              gun.recoil = 1;
            }
          } else if (gun.state === 'reloading') {
            gun.cooldown = Math.max(0, gun.cooldown - dt);
            if (gun.cooldown === 0) gun.state = 'ready';
          }
        }
        const wasReloading = battery.remaining > 0;
        battery.remaining = Math.max(
          ...battery.guns.map((gun) =>
            gun.state === 'firing' ? BATTERY.reload + Math.max(0, gun.delay) : gun.cooldown,
          ),
        );
        if (wasReloading && battery.remaining === 0) this.emit('ready', { ship, side });
      }
      const f = forward(ship.heading);
      const v = ship.body.getLinearVelocity();
      const speed = v.x * f.x + v.y * f.y;
      const desired =
        (((ship.flagship ? 6.6 : 9.2) * ship.sails) / 3) * windPower(ship.heading, this.wind);
      const mass = ship.body.getMass();
      ship.body.applyForceToCenter(
        Vec2((f.x * desired - v.x) * mass * 0.85, (f.y * desired - v.y) * mass * 0.85),
      );
      const turnSpeed =
        (ship.flagship ? 0.4 : 0.55) * (0.22 + 0.78 * clamp(Math.abs(speed) / 3, 0, 1));
      const angular = ship.rudder * turnSpeed;
      ship.body.setAngularVelocity(
        ship.body.getAngularVelocity() +
          (angular - ship.body.getAngularVelocity()) * Math.min(1, dt * 5),
      );
      if (Math.hypot(ship.x, ship.y) > 139) {
        ship.body.applyForceToCenter(Vec2(-ship.x * mass * 0.18, -ship.y * mass * 0.18));
      }
    }
    this.world.step(dt, 8, 3);
    for (const ship of this.ships) {
      const p = ship.body.getPosition();
      ship.x = p.x;
      ship.y = p.y;
      ship.heading = ship.body.getAngle();
      ship.speed = ship.body.getLinearVelocity().length();
    }
    for (const shot of this.projectiles) {
      const p = shot.body.getPosition();
      shot.lastX = shot.x;
      shot.lastY = shot.y;
      shot.distance += Math.hypot(p.x - shot.x, p.y - shot.y);
      shot.x = p.x;
      shot.y = p.y;
      shot.age += dt;
      if (!shot.dead && (shot.distance >= BATTERY.range || shot.age > 2)) {
        shot.dead = true;
        this.emit('splash', { x: shot.x, y: shot.y });
      }
      if (shot.dead) this.world.destroyBody(shot.body);
    }
    this.projectiles = this.projectiles.filter((shot) => !shot.dead);
    if (!this.player.alive) this.result = 'defeat';
    else if (this.ships.filter((ship) => ship.team === 'enemy').every((ship) => !ship.alive))
      this.result = 'victory';
    if (this.result) this.emit('result', { result: this.result });
  }
}
