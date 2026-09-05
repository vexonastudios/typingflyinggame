import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SeaBattle,
  SIDES,
  BATTERY,
  inFiringArc,
  windPower,
  angleDelta,
  batteryBearing,
  headingTo,
} from '../broadside-game/combat.mjs';

const advance = (battle, seconds, controls = { sails: 0 }, ai = false) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) battle.step(1 / 60, controls, ai);
};
const place = (ship, x, y, heading = 0) => {
  ship.body.setTransform({ x, y }, heading);
  ship.body.setLinearVelocity({ x: 0, y: 0 });
  ship.body.setAngularVelocity(0);
  ship.x = x;
  ship.y = y;
  ship.heading = heading;
  ship.sails = 0;
};

test('starboard fires and reloads without spending or delaying port', () => {
  const battle = new SeaBattle();
  const p = battle.player;
  assert.notEqual(p.batteries.port, p.batteries.starboard);
  assert.notEqual(p.batteries.port.guns[0], p.batteries.starboard.guns[0]);
  assert.equal(battle.fire(p, 'starboard'), true);
  advance(battle, 0.5);
  assert.ok(p.batteries.starboard.remaining > 9);
  assert.equal(p.batteries.port.remaining, 0);
  assert.ok(p.batteries.port.guns.every((g) => g.state === 'ready'));
  assert.equal(battle.fire(p, 'starboard'), false);
  assert.equal(battle.fire(p, 'port'), true);
  assert.equal(battle.alternations, 1);
  advance(battle, 9.5);
  assert.equal(p.batteries.starboard.remaining, 0);
  assert.ok(p.batteries.port.remaining > 0);
  advance(battle, 0.5);
  assert.equal(p.batteries.port.remaining, 0);
});

test('bow and stern are outside both broadside arcs at every heading', () => {
  const battle = new SeaBattle();
  const p = battle.player;
  for (const h of [0, 0.4, Math.PI / 2, Math.PI, -2, 9]) {
    p.heading = h;
    p.x = 0;
    p.y = 0;
    for (const direction of [h, h + Math.PI]) {
      const target = { x: Math.sin(direction) * 25, y: -Math.cos(direction) * 25 };
      for (const side of SIDES) assert.equal(inFiringArc(p, target, side), false);
    }
    for (const side of SIDES) {
      const bearing = batteryBearing(p, side);
      const target = { x: Math.sin(bearing) * 25, y: -Math.cos(bearing) * 25 };
      assert.equal(inFiringArc(p, target, side), true);
      assert.equal(inFiringArc(p, target, side === 'port' ? 'starboard' : 'port'), false);
    }
  }
});

test('a broadside launches all five physical balls from the selected side only', () => {
  const battle = new SeaBattle();
  const p = battle.player;
  place(p, 0, 0);
  place(battle.ships[1], 95, 80);
  battle.fire(p, 'starboard');
  advance(battle, 0.4);
  const events = battle.drainEvents().filter((e) => e.type === 'cannon');
  assert.equal(events.length, 5);
  assert.ok(events.every((e) => e.side === 'starboard' && e.x > 0));
  assert.equal(new Set(events.map((e) => e.index)).size, 5);
  assert.ok(battle.projectiles.every((shot) => shot.body.isBullet()));
  assert.ok(
    events.every((e) => Math.abs(angleDelta(e.heading, Math.PI / 2)) <= BATTERY.halfArc + 1e-10),
  );
});

test('a loaded port side can be brought around and fired while starboard reloads', () => {
  const battle = new SeaBattle();
  const p = battle.player;
  place(p, 0, 0);
  place(battle.ships[1], 90, 80);
  battle.fire(p, 'starboard');
  advance(battle, 7, { sails: 3, rudder: 1 });
  assert.ok(p.heading > 2.8, `heading ${p.heading}`);
  assert.ok(p.batteries.starboard.remaining > 1);
  assert.equal(p.batteries.port.remaining, 0);
  assert.equal(battle.fire(p, 'port'), true);
  assert.equal(battle.alternations, 1);
});

test('broadside balls damage an exposed target, but bow-on shots cannot aim forward', () => {
  const battle = new SeaBattle();
  const p = battle.player,
    enemy = battle.ships[1];
  place(p, 0, 0);
  place(enemy, 25, 0);
  battle.fire(p, 'starboard');
  advance(battle, 1.5);
  assert.ok(enemy.hp < enemy.maxHp, `target hp ${enemy.hp}`);
  assert.ok(battle.hits >= 3);
  const bowBattle = new SeaBattle();
  place(bowBattle.player, 0, 0);
  place(bowBattle.ships[1], 0, -25);
  bowBattle.fire(bowBattle.player, 'port');
  bowBattle.fire(bowBattle.player, 'starboard');
  advance(bowBattle, 2);
  assert.equal(bowBattle.ships[1].hp, bowBattle.ships[1].maxHp);
});

test('land blocks cannonballs and the AI line of sight', () => {
  const battle = new SeaBattle(0);
  const island = battle.islands[1];
  place(battle.player, island.x - island.r - 12, island.y);
  place(battle.ships[1], island.x + island.r + 12, island.y);
  assert.equal(battle.canSee(battle.player, battle.ships[1]), false);
  battle.fire(battle.player, 'starboard');
  advance(battle, 2);
  assert.equal(battle.ships[1].hp, battle.ships[1].maxHp);
  assert.equal(battle.projectiles.length, 0);
});

test('port and starboard spread symmetrically and empty shots expire', () => {
  const battle = new SeaBattle();
  place(battle.player, 0, 0);
  place(battle.ships[1], 0, -90);
  const bodyCount = battle.world.getBodyCount();
  battle.fire(battle.player, 'port');
  battle.fire(battle.player, 'starboard');
  advance(battle, 0.4);
  for (let i = 0; i < BATTERY.guns; i++) {
    const port = battle.projectiles.find((shot) => shot.side === 'port' && shot.index === i);
    const starboard = battle.projectiles.find(
      (shot) => shot.side === 'starboard' && shot.index === i,
    );
    assert.ok(Math.abs(port.x + starboard.x) < 0.001);
    assert.ok(Math.abs(port.y - starboard.y) < 0.001);
  }
  advance(battle, 2);
  assert.equal(battle.projectiles.length, 0);
  assert.equal(battle.world.getBodyCount(), bodyCount);
});

test('AI must maneuver and uses the same independent battery reloads and arcs', () => {
  const battle = new SeaBattle();
  const p = battle.player,
    enemy = battle.ships[1];
  p.hp = p.maxHp = 10000;
  place(p, 0, 0);
  place(enemy, 0, 32, 0);
  let salvos = 0;
  const lastShots = { port: -Infinity, starboard: -Infinity };
  const sidesUsed = new Set();
  for (let frame = 0; frame < 100 * 60; frame++) {
    battle.step(1 / 60, { sails: 0 }, true);
    for (const event of battle.drainEvents())
      if (event.type === 'broadside' && event.ship === enemy) {
        assert.ok(
          event.time - lastShots[event.side] >= BATTERY.reload,
          'AI fired an unloaded battery',
        );
        assert.ok(
          Math.abs(angleDelta(headingTo(enemy, p), batteryBearing(enemy, event.side))) <
            BATTERY.halfArc + 0.03,
          'AI fired without exposing its side',
        );
        lastShots[event.side] = event.time;
        sidesUsed.add(event.side);
        salvos++;
      }
  }
  assert.ok(salvos >= 4, `AI only fired ${salvos} salvos`);
  assert.equal(sidesUsed.size, 2, 'AI must use both sides');
  assert.ok(p.hp < p.maxHp, 'AI should land hits');
});

test('wind changes sailing power and a stopped ship turns more slowly', () => {
  assert.ok(windPower(0, 0) > windPower(Math.PI, 0) * 2);
  const stopped = new SeaBattle(),
    moving = new SeaBattle();
  advance(stopped, 4, { sails: 0, rudder: 1 });
  advance(moving, 4, { sails: 3, rudder: 1 });
  assert.ok(moving.player.heading - stopped.player.heading > 0.6);
});

test('reset clears both batteries, pending shots, defeat and score', () => {
  const battle = new SeaBattle();
  battle.fire(battle.player, 'port');
  advance(battle, 0.5);
  battle.damage(battle.player, 1000, null);
  advance(battle, 0.1);
  assert.equal(battle.result, 'defeat');
  battle.reset(1);
  assert.equal(battle.result, null);
  assert.equal(battle.salvos, 0);
  assert.equal(battle.time, 0);
  assert.equal(battle.projectiles.length, 0);
  assert.equal(battle.ships.length, 3);
  for (const side of SIDES)
    assert.ok(battle.player.batteries[side].guns.every((g) => g.state === 'ready'));
});

test('a sunk ship cannot shoot or finish its queued salvo', () => {
  const battle = new SeaBattle();
  const enemy = battle.ships[1];
  battle.fire(enemy, 'port');
  battle.damage(enemy, 1000, battle.player);
  advance(battle, 0.5);
  assert.equal(battle.fire(enemy, 'starboard'), false);
  assert.equal(battle.projectiles.filter((p) => p.owner === enemy).length, 0);
});
