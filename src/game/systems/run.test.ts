import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SIZE, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";
import { getViewportHeight } from "../config/viewport.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { collisionFraction } from "./CollisionSystem.ts";
import { ObstacleSystem, type Obstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import { RecordStore } from "./RecordStore.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const state = (values: Partial<PlayerState> = {}): PlayerState => ({ ...new Player().state, ...values });
const box: Obstacle = { id: 0, type: "supply-crate", startLane: 3, courseX: 0, distance: 100 };
function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

test("projection grows and accelerates toward the player, sharing the player bounds", () => {
  const perspective = new PerspectiveSystem();
  const far = perspective.project(1, 1000);
  const middle = perspective.project(1, 600);
  const near = perspective.project(1, 200);
  assert.ok(far.scale < middle.scale && middle.scale < near.scale);
  assert.ok(near.y - middle.y > middle.y - far.y);
  assert.equal(perspective.project(-1, 0).x, PLAYER_VIEW.screenMargin);
  assert.equal(perspective.project(1, 0).x, GAME_SIZE.width - PLAYER_VIEW.screenMargin);
  assert.equal(perspective.project(0, 0).scale, 1);
});

test("full-screen aspect changes preserve object proportions and horizontal collision geometry", () => {
  const projection = new PerspectiveSystem();
  const reference = [-1, 0, 1].flatMap(x => [0, 600, 1200].map(distance => ({ x, distance, point: projection.project(x, distance) })));
  for (const [width, height] of [[844, 390], [932, 430], [1024, 320], [768, 1024], [320, 360], [960, 540]]) {
    projection.height = getViewportHeight(width, height);
    // Rounding the render buffer can differ by at most half a display-scaled pixel.
    assert.ok(Math.abs(projection.height * width / GAME_SIZE.width - height) <= width / GAME_SIZE.width / 2);
    assert.ok(projection.contactY < projection.height);
    for (const { x, distance, point } of reference) {
      const resized = projection.project(x, distance);
      assert.equal(resized.x, point.x);
      assert.equal(resized.scale, point.scale);
      assert.ok(resized.y >= projection.horizonY && resized.y <= projection.contactY);
    }
    assert.equal(projection.project(-1, 0).x, PLAYER_VIEW.screenMargin);
    assert.equal(projection.project(1, 0).x, GAME_SIZE.width - PLAYER_VIEW.screenMargin);
  }
});

test("a hidden or unmeasured viewport uses the default render size", () => {
  for (const [width, height] of [[0, 0], [844, 0], [0, 390], [NaN, 390], [844, Infinity], [-1, 390]]) {
    assert.equal(getViewportHeight(width, height), GAME_SIZE.height);
  }
});

test("the same obstacle approaches faster after accelerating beyond the former speed cap", () => {
  const slow = new Player();
  const fast = new Player();
  for (let i = 0; i < 6; i++) {
    fast.update(neutral, 0);
    fast.update({ ...neutral, verticalAxis: -1 }, 0);
  }
  for (let i = 0; i < 60; i++) { slow.update(neutral, 1000 / 60); fast.update(neutral, 1000 / 60); }
  const projection = new PerspectiveSystem();
  assert.ok(projection.project(0, 900 - fast.state.distanceTravelled).y
    > projection.project(0, 900 - slow.state.distanceTravelled).y);
});

test("swept contact catches crossing, side entry and landing without distant false hits", () => {
  assert.equal(collisionFraction(state(), state({ distanceTravelled: 200 }), box), 0.42);
  assert.equal(collisionFraction(state({ courseX: 0.5 }), state({ courseX: 0.5, distanceTravelled: 200 }), box), null);
  assert.equal(collisionFraction(state(), state({ distanceTravelled: 70 }), box), null);
  assert.notEqual(collisionFraction(state({ courseX: 0.5, distanceTravelled: 100 }), state({ distanceTravelled: 100 }), box), null);
  assert.equal(collisionFraction(state({ jumpHeight: 90 }), state({ jumpHeight: 90, distanceTravelled: 200 }), box), null);
  assert.notEqual(collisionFraction(state({ distanceTravelled: 100, jumpHeight: 90 }), state({ distanceTravelled: 110, jumpHeight: 30 }), box), null);
});

test("collision freezes the exact contact distance and records it only once at different FPS", () => {
  for (const fps of [30, 60, 144]) {
    const run = new RunSystem(undefined, seeded(2));
    run.obstacles.items.splice(0, run.obstacles.items.length, box);
    let transitions = 0;
    for (let frame = 0; frame < fps * 2; frame++) transitions += Number(run.update(neutral, 1000 / fps));
    assert.equal(transitions, 1);
    assert.equal(run.status, "gameover");
    assert.ok(Math.abs(run.player.state.distanceTravelled - 84) < 1e-8);
    assert.equal(run.bestRecord.distance, 8);
    assert.ok(Math.abs(run.averageSpeed - 14) < 1e-8);
    assert.equal(run.bestRecord.averageSpeed, run.averageSpeed);
    assert.equal(run.newRecord, true);
    const frozen = { ...run.player.state };
    const frozenAverage = run.averageSpeed;
    run.update({ ...neutral, horizontalAxis: 1, jumpPressed: true }, 50);
    assert.deepEqual(run.player.state, frozen);
    assert.equal(run.averageSpeed, frozenAverage);
  }
});

test("average speed uses unrounded distance and time weighting, independent of FPS", () => {
  for (const fps of [30, 60, 144]) {
    const run = new RunSystem();
    assert.equal(run.averageSpeed, 0);
    run.update(neutral, 1);
    assert.equal(run.snapshot(false, true).distance, 0);
    assert.ok(Math.abs(run.averageSpeed - 14) < 1e-8);
    run.restart();
    for (let i = 0; i < fps; i++) run.update(neutral, 1000 / fps);
    run.update({ ...neutral, verticalAxis: -1 }, 0);
    for (let i = 0; i < fps * 3; i++) run.update(neutral, 1000 / fps);
    // 1s at 14m/s + 3s at 22m/s = 80m / 4s = 20m/s.
    assert.ok(Math.abs(run.averageSpeed - 20) < 1e-8);
    const average = run.averageSpeed;
    run.update({ ...neutral, verticalAxis: -1 }, 0);
    assert.equal(run.snapshot(false, true).speed, 30);
    assert.equal(run.averageSpeed, average);
    assert.equal(run.snapshot(true, false).averageSpeed, average);
    assert.equal(run.snapshot(false, true).bestAverageSpeed, average);
    assert.deepEqual(run.bestRecord, { distance: 0, averageSpeed: null });
  }
});

test("a timed jump actually clears a box through the shared run simulation", () => {
  const run = new RunSystem(undefined, seeded(2));
  run.obstacles.items.splice(0, run.obstacles.items.length, { ...box, distance: 56 });
  run.update({ ...neutral, jumpPressed: true }, 0);
  for (let i = 0; i < 60; i++) run.update(neutral, 1000 / 60);
  assert.equal(run.status, "running");
  assert.equal(run.player.state.jumpPhase, "grounded");
});

test("manual pause freezes player, distance, obstacles, elapsed time and averages until resume", () => {
  const run = new RunSystem();
  run.update(neutral, 50);
  const player = { ...run.player.state };
  const boxes = structuredClone(run.obstacles.items);
  const elapsed = run.elapsedSeconds;
  const average = run.averageSpeed;
  assert.equal(run.setPaused(true), true);
  for (let i = 0; i < 100; i++) run.update({ ...neutral, horizontalAxis: 1, verticalAxis: -1, jumpPressed: true }, 50);
  assert.deepEqual(run.player.state, player);
  assert.deepEqual(run.obstacles.items, boxes);
  assert.equal(run.elapsedSeconds, elapsed);
  assert.equal(run.averageSpeed, average);
  assert.equal(run.snapshot(false, false).pauseMenuOpen, true);
  run.setPaused(false);
  run.update(neutral, 50);
  assert.ok(run.player.state.distanceTravelled > player.distanceTravelled);
  run.setPaused(true);
  run.restart();
  assert.equal(run.isPaused, false);
  assert.equal(run.elapsedSeconds, 0);
});

test("pausing clears a landing-buffered jump without interrupting the current arc", () => {
  const run = new RunSystem();
  run.update({ ...neutral, jumpPressed: true }, 0);
  for (let i = 0; i < 14; i++) run.update(neutral, 50);
  run.update({ ...neutral, jumpPressed: true }, 0);
  const falling = { ...run.player.state };
  run.setPaused(true);
  run.update(neutral, 50);
  assert.deepEqual(run.player.state, falling);
  run.setPaused(false);
  for (let i = 0; i < 4; i++) run.update(neutral, 50);
  assert.equal(run.player.state.jumpPhase, "grounded");
  assert.equal(run.player.state.jumpHeight, 0);
});

test("uncapped speed cannot tunnel through rows generated beyond the previous view", () => {
  for (const fps of [30, 60, 144]) {
    const run = new RunSystem(undefined, () => 0.5);
    const expected = new ObstacleSystem(() => 0.5);
    expected.update(0, 2500);
    const unseenBox = expected.items.find(item => item.distance > RUN_CONFIG.viewDistance)!;
    assert.ok(unseenBox);
    Object.assign(run.player.state, {
      courseX: unseenBox.courseX,
      selectedSpeed: 2500 * fps,
    });
    // Ignore the already visible row, isolating one first generated this frame.
    run.obstacles.items.length = 0;
    assert.equal(run.update(neutral, 1000 / fps), true);
    assert.equal(run.status, "gameover");
    assert.ok(Math.abs(run.player.state.distanceTravelled - (unseenBox.distance - RUN_CONFIG.collisionHalfDepth)) < 1e-8);
    assert.equal(run.bestRecord.distance, Math.floor(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter));
    assert.ok(Math.abs(run.averageSpeed - 2500 * fps / RUN_CONFIG.unitsPerMeter) < 1e-8);
  }
});

test("fast motion retains existing crossed boxes until collision has been resolved", () => {
  const run = new RunSystem();
  Object.assign(run.player.state, { selectedSpeed: 50000 });
  run.obstacles.items.splice(0, run.obstacles.items.length, box);
  assert.equal(run.update(neutral, 50), true);
  assert.equal(run.player.state.distanceTravelled, 84);
});

test("restart clears distance, speed, jump and old obstacles while retaining the record", () => {
  const run = new RunSystem({ distance: 50, averageSpeed: 27.4 }, seeded(4));
  run.obstacles.items.splice(0, run.obstacles.items.length, box);
  for (let i = 0; i < 60; i++) run.update({ ...neutral, verticalAxis: -1 }, 1000 / 60);
  assert.equal(run.status, "gameover");
  assert.equal(run.bestRecord.distance, 50);
  assert.equal(run.bestRecord.averageSpeed, 27.4);
  assert.ok(Math.abs(run.snapshot(false, true).averageSpeed - 22) < 1e-8);
  assert.equal(run.snapshot(false, true).bestAverageSpeed, 27.4);
  const oldBoxes = run.obstacles;
  run.restart();
  assert.equal(run.status, "running");
  assert.deepEqual(run.player.state, new Player().state);
  assert.notEqual(run.obstacles, oldBoxes);
  assert.equal(run.bestRecord.distance, 50);
  assert.equal(run.newRecord, false);
  assert.equal(run.elapsedSeconds, 0);
  assert.equal(run.averageSpeed, 0);
  assert.equal(run.bestRecord.averageSpeed, 27.4);
});

test("record persists distance and its average together, without replacing it on a shorter or tied run", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const records = new RecordStore(() => storage);
  records.save({ distance: 123, averageSpeed: 22.5 });
  records.save({ distance: 12, averageSpeed: 90 });
  records.save({ distance: 123, averageSpeed: 100 });
  records.save({ distance: NaN, averageSpeed: 20 });
  records.save({ distance: 200, averageSpeed: Infinity });
  assert.deepEqual(new RecordStore(() => storage).value, { distance: 123, averageSpeed: 22.5 });
  records.save({ distance: 124, averageSpeed: 14 });
  assert.deepEqual(new RecordStore(() => storage).value, { distance: 124, averageSpeed: 14 });
});

test("legacy distance records survive without inventing an average, then upgrade on a longer run", () => {
  const data = new Map<string, string>([[RUN_CONFIG.legacyRecordKey, "500"]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const records = new RecordStore(() => storage);
  assert.deepEqual(records.value, { distance: 500, averageSpeed: null });
  records.save({ distance: 499, averageSpeed: 100 });
  assert.deepEqual(new RecordStore(() => storage).value, { distance: 500, averageSpeed: null });
  records.save({ distance: 501, averageSpeed: 46 });
  assert.deepEqual(new RecordStore(() => storage).value, { distance: 501, averageSpeed: 46 });
  assert.equal(data.get(RUN_CONFIG.legacyRecordKey), "500");
  data.set(RUN_CONFIG.recordKey, "broken");
  assert.deepEqual(new RecordStore(() => storage).value, { distance: 500, averageSpeed: null });
});

test("a stale tab cannot replace an already saved longer run or report a false new record", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const firstTab = new RecordStore(() => storage);
  const secondTab = new RecordStore(() => storage);
  assert.equal(secondTab.save({ distance: 1000, averageSpeed: 30 }), true);
  assert.equal(firstTab.save({ distance: 800, averageSpeed: 90 }), false);
  assert.deepEqual(firstTab.value, { distance: 1000, averageSpeed: 30 });
  assert.deepEqual(new RecordStore(() => storage).value, firstTab.value);
  assert.equal(firstTab.save({ distance: 1000, averageSpeed: 95 }), false);
  assert.equal(firstTab.save({ distance: 1200, averageSpeed: 22 }), true);
  assert.equal(secondTab.save({ distance: 1100, averageSpeed: 100 }), false);
  assert.deepEqual(secondTab.value, { distance: 1200, averageSpeed: 22 });
});

test("corrupted data and denied storage cannot break records in memory", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  for (const value of ["oops", "null", "[]", "-2", "Infinity", "2.3", '{"distance":3}', '{"distance":-1,"averageSpeed":14}', '{"distance":3,"averageSpeed":-2}', '{"distance":3,"averageSpeed":1e309}']) {
    data.set(RUN_CONFIG.recordKey, value);
    assert.deepEqual(new RecordStore(() => storage).value, { distance: 0, averageSpeed: null });
  }
  for (const value of ["oops", "-2", "Infinity", "2.3"]) {
    data.set(RUN_CONFIG.legacyRecordKey, value);
    assert.equal(new RecordStore(() => storage).value.distance, 0);
  }
  const unavailable = new RecordStore(() => { throw new Error("Denied"); });
  unavailable.save({ distance: 42, averageSpeed: 14 });
  assert.deepEqual(unavailable.value, { distance: 42, averageSpeed: 14 });
  const quotaFull = new RecordStore(() => ({ getItem: () => null, setItem: () => { throw new Error("Quota"); } }));
  quotaFull.save({ distance: 80, averageSpeed: 30 });
  assert.deepEqual(quotaFull.value, { distance: 80, averageSpeed: 30 });
});
