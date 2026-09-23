import assert from "node:assert/strict";
import test from "node:test";
import { RUN_CONFIG } from "../config/constants.ts";
import { GHOST_CONFIG, ITEM_CONFIG, ITEM_DEFINITIONS, type GameItem, type ItemDefinition, type ItemType, type ItemEffectType } from "../data/items.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "../data/obstacles.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { ghostCountdown, ghostOpacity, ItemEffectSystem } from "./ItemEffectSystem.ts";
import { ItemSystem } from "./ItemSystem.ts";
import { ObstacleSystem, type Obstacle } from "./ObstacleSystem.ts";
import { RunContactSystem } from "./RunContactSystem.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const state = (values: Partial<PlayerState> = {}): PlayerState => ({ ...new Player().state, ...values });
const item = (values: Partial<GameItem> = {}): GameItem => ({ id: 0, type: "ghost-penguin", courseX: 0, distance: 0, ...values });
const box = (values: Partial<Obstacle> = {}): Obstacle => ({ id: 0, type: "supply-crate", startLane: 3, courseX: 0, distance: 0, ...values });
function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}
function runWithoutRandomItems() {
  const run = new RunSystem(undefined, seeded(5));
  run.items.update = () => {};
  return run;
}

test("first and subsequent item intervals vary continuously within 3–4km", () => {
  const gaps = new Set<number>();
  for (let seed = 1; seed <= 80; seed++) {
    const items = new ItemSystem(seeded(seed));
    items.update(0, 0, []);
    assert.equal(items.items.length, 0);
    items.update(0, 8000 * RUN_CONFIG.unitsPerMeter - RUN_CONFIG.viewDistance, []);
    assert.equal(items.items.length, 2);
    const [first, second] = items.items.map(entry => entry.distance / RUN_CONFIG.unitsPerMeter);
    for (const gap of [first, second - first]) {
      assert.ok(gap >= 3000 && gap <= 4000, `unexpected gap: ${gap}`);
      gaps.add(gap);
    }
  }
  assert.ok(gaps.size > 100, "intervals vary instead of following fixed distance opportunities");
  assert.ok([...gaps].some(gap => gap % 100 !== 0));
});

test("rare items preserve safe lanes, landmark corridors and bounded live items over 110km", () => {
  const items = new ItemSystem(seeded(42));
  const obstacles = new ObstacleSystem(seeded(19));
  const seen = new Map<number, GameItem>();
  const clearance = ITEM_CONFIG.obstacleClearanceMeters * RUN_CONFIG.unitsPerMeter;
  for (let distance = 0; distance <= 110_000 * RUN_CONFIG.unitsPerMeter; distance += 500) {
    obstacles.update(distance);
    items.update(distance, distance, obstacles.items);
    assert.ok(items.items.length <= 1);
    for (const entry of items.items) {
      assert.ok(!isLandmarkClearDistance(entry.distance / RUN_CONFIG.unitsPerMeter));
      assert.ok(entry.distance >= ITEM_CONFIG.minSpawnGapMeters * RUN_CONFIG.unitsPerMeter);
      assert.ok(RUN_CONFIG.lanes.some(lane => lane === entry.courseX));
      assert.ok(!obstacles.items.some(obstacle =>
        Math.abs(obstacle.distance - entry.distance) <= clearance
        && Math.abs(obstacle.courseX - entry.courseX) <= OBSTACLE_DEFINITIONS[obstacle.type].collisionHalfWidth
          + ITEM_DEFINITIONS[entry.type].pickupHalfWidth,
      ));
      seen.set(entry.id, entry);
    }
  }
  const spawned = [...seen.values()];
  assert.ok(spawned.length >= 26 && spawned.length <= 36, "about one item per 3–4km");
  for (let i = 1; i < spawned.length; i++) {
    assert.ok(spawned[i].distance - spawned[i - 1].distance >= ITEM_CONFIG.minSpawnGapMeters * RUN_CONFIG.unitsPerMeter);
  }
});

test("spawn positions and lanes are independent of frame cadence, including high-speed sweeps", () => {
  const end = 45_000 * RUN_CONFIG.unitsPerMeter;
  const byCadence = [7, 47, 700, 55_000].map(step => {
    const items = new ItemSystem(seeded(71));
    const obstacles = new ObstacleSystem(seeded(19));
    const all = new Map<number, GameItem>();
    for (let distance = 0; distance < end; distance += step) {
      const travelEnd = Math.min(distance + step, end);
      obstacles.update(distance, travelEnd);
      items.update(distance, travelEnd, obstacles.items);
      for (const entry of items.items) all.set(entry.id, { ...entry });
    }
    return [...all.values()];
  });
  assert.ok(byCadence[0].length > 10);
  for (const sequence of byCadence.slice(1)) assert.deepEqual(sequence, byCadence[0]);
  const swept = new ItemSystem(() => 0);
  swept.update(0, 40_000, []);
  const pickup = swept.firstPickup(state({ courseX: -0.9 }), state({ courseX: -0.9, distanceTravelled: 40_000 }), null, [0, 1]);
  assert.equal(pickup?.item.distance, 30_000);
  assert.equal(pickup?.fraction, (30_000 - ITEM_CONFIG.pickupHalfDepth) / 40_000);
});

test("unsafe positions defer by distance without rerolling or waiting another 3–4km", () => {
  const firstDistance = ITEM_CONFIG.minSpawnGapMeters * RUN_CONFIG.unitsPerMeter;
  const firstVisibleDistance = firstDistance - RUN_CONFIG.viewDistance
    + ITEM_CONFIG.obstacleClearanceMeters * RUN_CONFIG.unitsPerMeter;
  const items = new ItemSystem(() => 0);
  items.update(firstVisibleDistance, firstVisibleDistance, [box({ type: "seal", courseX: -0.75, distance: firstDistance })]);
  assert.equal(items.items.length, 1);
  assert.ok(items.items[0].courseX >= -0.3);
  let randomCalls = 0;
  const blocked = new ItemSystem(() => { randomCalls++; return 0; });
  const blockers = RUN_CONFIG.lanes.map((courseX, id) => box({ id, courseX, distance: firstDistance }));
  blocked.update(firstVisibleDistance, firstVisibleDistance, blockers);
  assert.equal(blocked.items.length, 0);
  const callsBeforeWaiting = randomCalls;
  for (let frame = 0; frame < 100; frame++) blocked.update(firstVisibleDistance, firstVisibleDistance, blockers);
  assert.equal(randomCalls, callsBeforeWaiting);
  blocked.update(firstVisibleDistance, firstVisibleDistance + 200, blockers);
  assert.equal(blocked.items[0].distance, firstDistance + 200, "first safe retry is 20m beyond the obstacle");
  assert.equal(randomCalls, callsBeforeWaiting + 2, "only lane and next interval are sampled after retries");

  const nearLandmark = new ItemSystem(() => 0.3);
  nearLandmark.update(0, 14_000 * RUN_CONFIG.unitsPerMeter, []);
  assert.deepEqual(nearLandmark.items.map(entry => entry.distance / RUN_CONFIG.unitsPerMeter), [3300, 6600, 10_170, 13_470]);
  assert.ok(nearLandmark.items.every(entry => !isLandmarkClearDistance(entry.distance / RUN_CONFIG.unitsPerMeter)));
});

test("restart clears items and samples a fresh first interval from the starting line", () => {
  const items = new ItemSystem(seeded(91));
  items.update(0, 4000 * RUN_CONFIG.unitsPerMeter, []);
  const firstDistance = items.items[0].distance;
  items.reset();
  assert.equal(items.items.length, 0);
  items.update(0, 0, []);
  assert.equal(items.items.length, 0);
  items.update(0, 4000 * RUN_CONFIG.unitsPerMeter, []);
  assert.equal(items.items.length, 1);
  assert.equal(items.items[0].id, 0);
  assert.ok(items.items[0].distance >= 3000 * RUN_CONFIG.unitsPerMeter && items.items[0].distance <= 4000 * RUN_CONFIG.unitsPerMeter);
  assert.notEqual(items.items[0].distance, firstDistance);
});

test("pickup uses swept position and jump height; removal prevents collecting twice", () => {
  const items = new ItemSystem();
  items.items.push(item({ distance: 100 }));
  const pickup = items.firstPickup(state(), state({ distanceTravelled: 1000 }), null, [0, 1]);
  assert.equal(pickup?.fraction, 0.08);
  assert.equal(items.firstPickup(state({ courseX: 0.6 }), state({ courseX: 0.6, distanceTravelled: 1000 }), null, [0, 1]), null);
  assert.equal(items.firstPickup(state({ jumpHeight: 150 }), state({ jumpHeight: 150, distanceTravelled: 1000 }), null, [0, 1]), null);
  assert.ok(items.firstPickup(state({ jumpHeight: 40 }), state({ jumpHeight: 40, distanceTravelled: 1000 }), null, [0, 1]));
  assert.ok(items.firstPickup(state({ distanceTravelled: 100 }), state({ distanceTravelled: 100 }),
    { startProgress: 0.75, endProgress: 0.99, restartAtLanding: false }, [0, 1]));
  items.collect(pickup!.item);
  assert.equal(items.firstPickup(state(), state({ distanceTravelled: 1000 }), null, [0, 1]), null);
});

test("10-second effect, last-five countdown, accelerating blink and refresh share one clock at different FPS", () => {
  for (const fps of [30, 60, 144]) {
    const effects = new ItemEffectSystem();
    effects.apply("ghost-penguin");
    assert.equal(ghostOpacity(effects.ghostSeconds), GHOST_CONFIG.opacity);
    for (let frame = 0; frame < fps * 5; frame++) {
      assert.equal(ghostCountdown(effects.ghostSeconds), null);
      effects.advance(1 / fps);
    }
    for (let digit = 5; digit >= 1; digit--) {
      assert.equal(ghostCountdown(effects.ghostSeconds), digit);
      for (let frame = 0; frame < fps; frame++) effects.advance(1 / fps);
    }
    assert.equal(effects.ghostSeconds, 0);
    assert.equal(effects.ignoresObstacles, false);
    assert.equal(ghostCountdown(effects.ghostSeconds), null);
    assert.equal(ghostOpacity(effects.ghostSeconds), 1);
  }
  const effects = new ItemEffectSystem();
  effects.apply("ghost-penguin");
  effects.advance(7);
  effects.apply("ghost-penguin");
  assert.equal(effects.ghostSeconds, 10);
  assert.equal(ghostCountdown(effects.ghostSeconds), null);
  assert.equal(ghostOpacity(effects.ghostSeconds), GHOST_CONFIG.opacity);
  const switches = (from: number, to: number) => {
    let changes = 0;
    let last = ghostOpacity(from);
    for (let time = from; time > to; time -= 0.001) {
      const alpha = ghostOpacity(time);
      assert.ok(alpha === 1 || alpha === GHOST_CONFIG.opacity);
      if (alpha !== last) changes++;
      last = alpha;
    }
    return changes;
  };
  assert.ok(switches(1, 0) > switches(5, 4));
  assert.equal(ghostOpacity(1, true), GHOST_CONFIG.opacity);
});

test("all six hazards are bypassed while ghost is active, with no speed or score change", () => {
  for (const type of OBSTACLE_IDS) {
    const run = runWithoutRandomItems();
    run.items.items.push(item());
    run.obstacles.items.push(box({ type, distance: 50 }));
    run.update(neutral, 0);
    assert.equal(run.items.items.length, 0);
    for (let i = 0; i < 20; i++) run.update(neutral, 50);
    assert.equal(run.status, "running");
    assert.ok(Math.abs(run.effects.ghostSeconds - 9) < 1e-8);
    assert.equal(run.snapshot(false, true).speed, 14);
    assert.equal(run.snapshot(false, true).score, 14);
    assert.ok(Math.abs(run.averageSpeed - 14) < 1e-8);
  }
});

test("high-speed contacts respect pickup/hazard order and count duration only after the pickup", () => {
  const contacts = new RunContactSystem();
  const items = new ItemSystem();
  items.items.push(item({ distance: 120 }));
  assert.equal(contacts.resolve(state(), state({ distanceTravelled: 1000 }), null, 0.05, 1,
    [box({ distance: 200 })], items), null);
  assert.ok(Math.abs(contacts.effects.ghostSeconds - 9.955) < 1e-9);
  contacts.reset();
  items.items.push(item({ distance: 220 }));
  const hit = contacts.resolve(state(), state({ distanceTravelled: 1000 }), null, 0.05, 1,
    [box({ distance: 100 })], items);
  assert.equal(hit?.fraction, 0.084);
  assert.equal(items.items.length, 1, "a pickup after death is never applied");
  assert.equal(contacts.effects.ghostSeconds, 0);
});

test("refresh and other item pickups remain active while ghost is protecting the player", () => {
  const definitions = ITEM_DEFINITIONS as Record<string, ItemDefinition>;
  const companionType = "test-companion" as ItemType;
  definitions[companionType] = {
    ...ITEM_DEFINITIONS["ghost-penguin"], effect: { type: "test-effect" as ItemEffectType, durationSeconds: 2 },
  };
  try {
    const contacts = new RunContactSystem();
    contacts.effects.apply("ghost-penguin");
    contacts.effects.advance(7);
    const items = new ItemSystem();
    items.items.push(item({ type: companionType }), item({ id: 1, distance: 50 }));
    assert.equal(contacts.resolve(state(), state({ distanceTravelled: 100 }), null, 0.05, 1, [], items), null);
    assert.equal(items.items.length, 0);
    assert.ok(Math.abs(contacts.effects.ghostSeconds - 9.965) < 1e-9);
    assert.ok(Math.abs(contacts.effects.nextExpirationSeconds - 1.95) < 1e-9, "refresh preserves the other effect clock");
  } finally { delete definitions[companionType]; }
});

test("expiry grants grace only to actual overlaps and restores collision with later hazards in the same frame", () => {
  const contacts = new RunContactSystem();
  contacts.effects.apply("ghost-penguin");
  contacts.effects.advance(9.975);
  const obstacles = [box({ distance: 50 }), box({ id: 1, distance: 95 })];
  const hit = contacts.resolve(state(), state({ distanceTravelled: 100 }), null, 0.05, 1, obstacles, new ItemSystem());
  assert.equal(hit?.obstacle.id, 1);
  assert.equal(hit?.fraction, 0.79);
  assert.equal(contacts.effects.ghostSeconds, 0);
  assert.equal(contacts.resolve(state({ distanceTravelled: 50 }), state({ distanceTravelled: 65 }), null,
    0.05, 1, [obstacles[0]], new ItemSystem()), null, "grace persists across frames while inside");
  contacts.resolve(state({ distanceTravelled: 70 }), state({ distanceTravelled: 80 }), null, 0.05, 1, [], new ItemSystem());
  assert.ok(contacts.resolve(state(), state({ distanceTravelled: 100 }), null,
    0.05, 1, [obstacles[0]], new ItemSystem()), "passed obstacle IDs are reclaimed");
});

test("an obstacle outside the player at expiry receives no grace on later side entry or landing", () => {
  for (const airborne of [false, true]) {
    const contacts = new RunContactSystem();
    contacts.effects.apply("ghost-penguin");
    contacts.effects.advance(9.975);
    const start = state({ courseX: airborne ? 0 : 0.6, jumpHeight: airborne ? 150 : 0 });
    const end = { ...start, distanceTravelled: 100 };
    contacts.resolve(start, end, null, 0.05, 1, [box({ distance: 50 })], new ItemSystem());
    assert.ok(contacts.resolve(state({ distanceTravelled: 50 }), state({ distanceTravelled: 55 }), null,
      0.05, 1, [box({ distance: 50 })], new ItemSystem()));
  }
});

test("pause and landmark celebrations freeze effects; retry and gameover clear all item state", () => {
  const run = runWithoutRandomItems();
  run.items.items.push(item());
  run.update(neutral, 0);
  run.setPaused(true);
  for (let i = 0; i < 100; i++) run.update(neutral, 50);
  assert.equal(run.effects.ghostSeconds, 10);
  run.setPaused(false);
  run.landmarks.update(run.landmarks.next!.distance);
  run.update(neutral, 50);
  assert.equal(run.effects.remainingSeconds("ghost"), 10);
  assert.equal(run.effects.ghostSeconds, 0);
  run.restart();
  assert.equal(run.effects.ghostSeconds, 0);
  assert.equal(run.items.items.length, 0);
  run.items.items.push(item({ distance: 1000 }));
  run.obstacles.items.push(box());
  run.update(neutral, 50);
  assert.equal(run.status, "gameover");
  assert.equal(run.items.items.length, 0);
  assert.equal(run.effects.ghostSeconds, 0);
  run.update(neutral, 50);
  assert.equal(run.effects.ghostSeconds, 0);
});
