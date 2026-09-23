import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SIZE, PLAYER_CONFIG, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";
import { getViewportHeight } from "../config/viewport.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { collisionFraction } from "./CollisionSystem.ts";
import { boxesPerRow, ObstacleSystem, type BoxObstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import { RecordStore } from "./RecordStore.ts";
import { RunSystem } from "./RunSystem.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const state = (values: Partial<PlayerState> = {}): PlayerState => ({ ...new Player().state, ...values });
const box: BoxObstacle = { id: 0, courseX: 0, distance: 100, color: 0xff3ab4 };
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

test("difficulty rises from one to six boxes and never fills all seven lanes", () => {
  assert.deepEqual([0, 1200, 2400, 3600, 4800, 6000, 100000].map(boxesPerRow), [1, 2, 3, 4, 5, 6, 6]);
});

test("many random courses retain a reachable gap at 30 m/s, with bounded live objects", () => {
  const halfWidth = RUN_CONFIG.boxHalfWidth + PLAYER_CONFIG.collisionHalfWidth;
  const availableTime = (RUN_CONFIG.rowSpacing - 2 * RUN_CONFIG.collisionHalfDepth) / (30 * RUN_CONFIG.unitsPerMeter)
    - RUN_CONFIG.reactionSeconds;
  const reach = availableTime * PLAYER_CONFIG.lateralSpeed;
  const seenFirstX = new Set<number>();
  for (let seed = 1; seed <= 80; seed++) {
    const obstacles = new ObstacleSystem(seeded(seed));
    seenFirstX.add(obstacles.boxes[0].courseX);
    let reachable: number[] = [0];
    for (let row = 0; row < 100; row++) {
      const distance = RUN_CONFIG.firstRowDistance + row * RUN_CONFIG.rowSpacing;
      obstacles.update(Math.max(0, distance - RUN_CONFIG.viewDistance));
      const boxes = obstacles.boxes.filter((item) => item.distance === distance);
      assert.equal(boxes.length, isLandmarkClearDistance(distance / RUN_CONFIG.unitsPerMeter) ? 0 : boxesPerRow(distance));
      assert.ok(obstacles.boxes.length <= 36);
      for (const item of boxes) assert.ok(Math.abs(item.courseX) <= PLAYER_CONFIG.courseLimit);
      const safe = RUN_CONFIG.lanes.filter((lane) => boxes.every((item) => Math.abs(item.courseX - lane) > halfWidth));
      reachable = safe.filter((lane) => reachable.some((previous) => Math.abs(previous - lane) <= reach));
      assert.ok(reachable.length > 0, `no path: seed ${seed}, row ${row}`);
      const sorted = [...boxes].sort((a, b) => a.courseX - b.courseX);
      for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].courseX - sorted[i - 1].courseX > RUN_CONFIG.boxHalfWidth * 2);
    }
  }
  assert.ok(seenFirstX.size > 50);
});

test("swept contact catches crossing, side entry and landing without distant false hits", () => {
  assert.equal(collisionFraction(state(), state({ distanceTravelled: 200 }), box), 0.4);
  assert.equal(collisionFraction(state({ courseX: 0.5 }), state({ courseX: 0.5, distanceTravelled: 200 }), box), null);
  assert.equal(collisionFraction(state(), state({ distanceTravelled: 70 }), box), null);
  assert.notEqual(collisionFraction(state({ courseX: 0.5, distanceTravelled: 100 }), state({ distanceTravelled: 100 }), box), null);
  assert.equal(collisionFraction(state({ jumpHeight: 90 }), state({ jumpHeight: 90, distanceTravelled: 200 }), box), null);
  assert.notEqual(collisionFraction(state({ distanceTravelled: 100, jumpHeight: 90 }), state({ distanceTravelled: 110, jumpHeight: 60 }), box), null);
});

test("collision freezes the exact contact distance and records it only once at different FPS", () => {
  for (const fps of [30, 60, 144]) {
    const run = new RunSystem(undefined, seeded(2));
    run.obstacles.boxes.splice(0, run.obstacles.boxes.length, box);
    let transitions = 0;
    for (let frame = 0; frame < fps * 2; frame++) transitions += Number(run.update(neutral, 1000 / fps));
    assert.equal(transitions, 1);
    assert.equal(run.status, "gameover");
    assert.ok(Math.abs(run.player.state.distanceTravelled - 80) < 1e-8);
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
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, { ...box, distance: 56 });
  run.update({ ...neutral, jumpPressed: true }, 0);
  for (let i = 0; i < 60; i++) run.update(neutral, 1000 / 60);
  assert.equal(run.status, "running");
  assert.equal(run.player.state.jumpPhase, "grounded");
});

test("uncapped speed cannot tunnel through rows generated beyond the previous view", () => {
  for (const fps of [30, 60, 144]) {
    const run = new RunSystem(undefined, () => 0.5);
    const expected = new ObstacleSystem(() => 0.5);
    expected.update(0, 2500);
    const unseenBox = expected.boxes.find(item => item.distance > RUN_CONFIG.viewDistance)!;
    assert.ok(unseenBox);
    Object.assign(run.player.state, {
      courseX: unseenBox.courseX,
      selectedSpeed: 2500 * fps,
    });
    // Ignore the already visible row, isolating one first generated this frame.
    run.obstacles.boxes.length = 0;
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
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, box);
  assert.equal(run.update(neutral, 50), true);
  assert.equal(run.player.state.distanceTravelled, 80);
});

test("restart clears distance, speed, jump and old obstacles while retaining the record", () => {
  const run = new RunSystem({ distance: 50, averageSpeed: 27.4 }, seeded(4));
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, box);
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
