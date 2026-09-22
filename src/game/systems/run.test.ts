import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SIZE, PLAYER_CONFIG, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { collisionFraction } from "./CollisionSystem.ts";
import { boxesPerRow, ObstacleSystem, type BoxObstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import { RecordStore } from "./RecordStore.ts";
import { RunSystem } from "./RunSystem.ts";

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

test("the same obstacle approaches faster in third gear than first", () => {
  const slow = new Player();
  const fast = new Player();
  fast.update({ ...neutral, verticalAxis: -1 }, 0);
  fast.update(neutral, 0);
  fast.update({ ...neutral, verticalAxis: -1 }, 0);
  for (let i = 0; i < 60; i++) { slow.update(neutral, 1000 / 60); fast.update(neutral, 1000 / 60); }
  const projection = new PerspectiveSystem();
  assert.ok(projection.project(0, 900 - fast.state.distanceTravelled).y
    > projection.project(0, 900 - slow.state.distanceTravelled).y);
});

test("difficulty rises from one to six boxes and never fills all seven lanes", () => {
  assert.deepEqual([0, 1200, 2400, 3600, 4800, 6000, 100000].map(boxesPerRow), [1, 2, 3, 4, 5, 6, 6]);
});

test("many random courses retain a reachable gap at maximum speed, with bounded live objects", () => {
  const halfWidth = RUN_CONFIG.boxHalfWidth + PLAYER_CONFIG.collisionHalfWidth;
  const availableTime = (RUN_CONFIG.rowSpacing - 2 * RUN_CONFIG.collisionHalfDepth) / PLAYER_CONFIG.speeds[2]
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
      assert.equal(boxes.length, boxesPerRow(distance));
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
    const run = new RunSystem(0, seeded(2));
    run.obstacles.boxes.splice(0, run.obstacles.boxes.length, box);
    let transitions = 0;
    for (let frame = 0; frame < fps * 2; frame++) transitions += Number(run.update(neutral, 1000 / fps));
    assert.equal(transitions, 1);
    assert.equal(run.status, "gameover");
    assert.ok(Math.abs(run.player.state.distanceTravelled - 80) < 1e-8);
    assert.equal(run.bestDistance, 8);
    assert.equal(run.newRecord, true);
    const frozen = { ...run.player.state };
    run.update({ ...neutral, horizontalAxis: 1, jumpPressed: true }, 50);
    assert.deepEqual(run.player.state, frozen);
  }
});

test("a timed jump actually clears a box through the shared run simulation", () => {
  const run = new RunSystem(0, seeded(2));
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, { ...box, distance: 56 });
  run.update({ ...neutral, jumpPressed: true }, 0);
  for (let i = 0; i < 60; i++) run.update(neutral, 1000 / 60);
  assert.equal(run.status, "running");
  assert.equal(run.player.state.jumpPhase, "grounded");
});

test("restart clears distance, speed, jump and old obstacles while retaining the record", () => {
  const run = new RunSystem(50, seeded(4));
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, box);
  for (let i = 0; i < 60; i++) run.update({ ...neutral, verticalAxis: -1 }, 1000 / 60);
  assert.equal(run.status, "gameover");
  assert.equal(run.bestDistance, 50);
  const oldBoxes = run.obstacles;
  run.restart();
  assert.equal(run.status, "running");
  assert.deepEqual(run.player.state, new Player().state);
  assert.notEqual(run.obstacles, oldBoxes);
  assert.equal(run.bestDistance, 50);
  assert.equal(run.newRecord, false);
  assert.equal(run.elapsedSeconds, 0);
});

test("record persists across instances and ignores corrupted data or denied storage", () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const records = new RecordStore(() => storage);
  records.save(123); records.save(12); records.save(NaN);
  assert.equal(new RecordStore(() => storage).value, 123);
  for (const value of ["oops", "-2", "Infinity", "2.3"]) {
    data.set(RUN_CONFIG.recordKey, value);
    assert.equal(new RecordStore(() => storage).value, 0);
  }
  const unavailable = new RecordStore(() => { throw new Error("Denied"); });
  unavailable.save(42);
  assert.equal(unavailable.value, 42);
});
