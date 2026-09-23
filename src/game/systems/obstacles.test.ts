import { createObstacle } from "./ObstacleSystem.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GAME_SIZE, PLAYER_CONFIG, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "../data/obstacles.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { collisionFraction } from "./CollisionSystem.ts";
import { ObstacleSystem, type Obstacle } from "./ObstacleSystem.ts";
import { RunSystem } from "./RunSystem.ts";

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}
const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const state = (values: Partial<PlayerState> = {}): PlayerState => ({ ...new Player().state, ...values });
function course(seed: number, endMeters = 4000): Obstacle[] {
  const system = new ObstacleSystem(seeded(seed));
  system.update(0, endMeters * RUN_CONFIG.unitsPerMeter);
  return system.items;
}

function groups(obstacles: readonly Obstacle[]): Obstacle[][] {
  const result: Obstacle[][] = [];
  for (const obstacle of obstacles) {
    const previous = result.at(-1)?.at(-1);
    if (!previous || obstacle.distance - previous.distance > OBSTACLE_CONFIG.maxStaggerMeters * RUN_CONFIG.unitsPerMeter + 1e-8) {
      result.push([]);
    }
    result.at(-1)!.push(obstacle);
  }
  return result;
}

function isolatedRun(speed: number): RunSystem {
  const run = new RunSystem();
  Object.assign(run.player.state, { selectedSpeed: speed * RUN_CONFIG.unitsPerMeter });
  // These collision fixtures control every row, including beyond the initial view.
  run.obstacles.update = () => {};
  run.items.update = () => {};
  return run;
}

function advance(run: RunSystem, milliseconds: number, fps = 60): void {
  let remaining = milliseconds;
  while (remaining > 1e-8 && run.status === "running") {
    const delta = Math.min(1000 / fps, remaining);
    run.update(neutral, delta);
    remaining -= delta;
  }
}

function near(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
}

function distanceAt(speed: number, seconds: number): number {
  return speed * seconds + 0.5 * PLAYER_CONFIG.baseAcceleration / RUN_CONFIG.unitsPerMeter * seconds ** 2;
}

test("all thirteen PNGs have valid artwork frames, preserved aspect ratios and jumpable lower hitboxes", () => {
  const nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  for (const id of OBSTACLE_IDS) {
    const def = { ...OBSTACLE_DEFINITIONS[id], ...createObstacle(0, id, 0, 0) };
    const png = readFileSync(new URL(`../../../public${def.assetPath}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const [x, y, width, height] = def.assetFrame;
    assert.ok(x >= 0 && y >= 0 && x + width <= png.readUInt32BE(16) && y + height <= png.readUInt32BE(20));
    assert.ok(Math.abs(def.visualWidth / def.visualHeight - width / height) < 1e-9);
    assert.ok(def.collisionHalfWidth * 2 * nearHalfWidth < def.visualWidth);
    assert.ok(def.collisionHeight < def.visualHeight && def.collisionHeight < PLAYER_CONFIG.jumpHeight);
    assert.equal(def.jumpable, true);
  }
  assert.ok(createObstacle(0, "snow-drift", 0, 0).collisionHeight < createObstacle(0, "supply-crate", 0, 0).collisionHeight);
});

test("nothing appears for 50m, then the first row enters at the existing horizon", () => {
  const system = new ObstacleSystem();
  const clear = OBSTACLE_CONFIG.initialClearMeters * RUN_CONFIG.unitsPerMeter;
  for (const distance of [0, 1, clear - 0.01]) { system.update(distance); assert.equal(system.items.length, 0); }
  system.update(clear);
  assert.equal(system.items.length, 2);
  assert.equal(system.items[0].distance - clear, RUN_CONFIG.viewDistance);
  const first = structuredClone(system.items);
  for (let i = 0; i < 100; i++) system.update(clear);
  assert.deepEqual(system.items, first);
});

test("weighted shuffle bags cover all thirteen types without repeats or frequent barriers", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const obstacles = course(seed, 45_000).slice(0, 1000);
    assert.equal(obstacles.length, 1000);
    assert.deepEqual(new Set(obstacles.map(item => item.type)), new Set(OBSTACLE_IDS));
    for (let i = 1; i < obstacles.length; i++) assert.notEqual(obstacles[i].type, obstacles[i - 1].type);
    const counts = { 1: 0, 2: 0, full: 0 };
    let previousBarrier = -4;
    for (const [index, obstacle] of obstacles.entries()) {
      counts[OBSTACLE_DEFINITIONS[obstacle.type].laneSpan]++;
      if (obstacle.type === "barricade") { assert.ok(index - previousBarrier >= 4); previousBarrier = index; }
    }
    assert.ok(counts[1] >= 580 && counts[1] <= 620);
    assert.ok(counts[2] >= 310 && counts[2] <= 350);
    assert.ok(counts.full >= 50 && counts.full <= 80);
    for (const span of [1, 2] as const) {
      const ids = OBSTACLE_IDS.filter(id => OBSTACLE_DEFINITIONS[id].laneSpan === span);
      const types = obstacles.filter(item => OBSTACLE_DEFINITIONS[item.type].laneSpan === span).map(item => item.type);
      for (let index = 0; index + ids.length <= types.length; index += ids.length) {
        assert.deepEqual(new Set(types.slice(index, index + ids.length)), new Set(ids));
      }
    }
  }
});

test("normal groups retain staggered safe lanes; full groups are isolated with recovery gaps", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const obstacles = course(seed, 8000);
    assert.equal(new Set(obstacles.map(item => item.distance)).size, obstacles.length);
    let previous: Obstacle[] | undefined;
    for (const group of groups(obstacles)) {
      const meters = group[0].distance / RUN_CONFIG.unitsPerMeter;
      const maxCount = meters < 2000 ? 2 : meters < 5000 ? 3 : 4;
      assert.ok(group.length >= 1 && group.length <= maxCount);
      const full = group[0].type === "barricade";
      if (full) assert.equal(group.length, 1);
      const occupied = new Set<number>();
      group.forEach((obstacle, index) => {
        for (const lane of obstacle.occupiedLanes) {
          assert.ok(!occupied.has(lane), `overlap: ${seed}/${obstacle.id}`);
          occupied.add(lane);
        }
        if (index > 0) {
          const stagger = (obstacle.distance - group[index - 1].distance) / RUN_CONFIG.unitsPerMeter;
          assert.ok(stagger >= 6 - 1e-9 && stagger <= 12 + 1e-9);
        }
      });
      assert.equal(full ? occupied.size === RUN_CONFIG.lanes.length : occupied.size < RUN_CONFIG.lanes.length, true);
      if (previous) {
        const extra = previous[0].type === "barricade" ? 20 : previous.some(item => OBSTACLE_DEFINITIONS[item.type].laneSpan === 2) ? 10 : 0;
        const gap = (group[0].distance - previous.at(-1)!.distance) / RUN_CONFIG.unitsPerMeter;
        assert.ok(gap >= Math.max(35 + extra, full ? 55 : 0) - 1e-9 && gap <= Math.max(55 + extra, full ? 55 : 0) + 1e-9);
      }
      previous = group;
    }
    assert.ok(groups(obstacles).some(group => group.length === 3 && group[0].distance < 5000 * RUN_CONFIG.unitsPerMeter));
    assert.ok(groups(obstacles).some(group => group.length === 4));
  }
});

test("single cells and adjacent pairs cover every legal placement with no central bias or track overflow", () => {
  const single = Array<number>(7).fill(0), wide = Array<number>(6).fill(0);
  const halfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  for (const obstacle of course(9876, 350_000)) {
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    const endLane = obstacle.occupiedLanes.at(-1)!;
    assert.ok(obstacle.startLane >= 0 && endLane < RUN_CONFIG.lanes.length);
    assert.equal(obstacle.courseX, (RUN_CONFIG.lanes[obstacle.startLane] + RUN_CONFIG.lanes[endLane]) / 2);
    assert.ok(Math.abs(obstacle.courseX) + obstacle.visualWidth / (2 * halfWidth) <= (definition.laneSpan === "full" ? 1.1 : 1.05) + 1e-9);
    if (definition.laneSpan !== "full") (definition.laneSpan === 1 ? single : wide)[obstacle.startLane]++;
  }
  for (const counts of [single, wide]) {
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 6, counts.toString());
  }
});

test("short runs spread each obstacle width across the track even as groups get denser", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const counts = { 1: Array<number>(7).fill(0), 2: Array<number>(6).fill(0) };
    for (const obstacle of course(seed, 8000)) {
      const span = OBSTACLE_DEFINITIONS[obstacle.type].laneSpan;
      if (span === "full") continue;
      const placements = counts[span];
      placements[obstacle.startLane]++;
      assert.ok(Math.max(...placements) - Math.min(...placements) <= 6, `${seed}: ${placements}`);
    }
  }
});

test("spawn sequence is independent of update cadence, and live objects are bounded", () => {
  const end = 8000 * RUN_CONFIG.unitsPerMeter;
  const expected = course(42, 8000);
  for (const step of [3, 7, 40, 137]) {
    const system = new ObstacleSystem(seeded(42));
    const seen = new Map<number, Obstacle>();
    for (let distance = 0; distance < end; distance += step) {
      system.update(distance);
      assert.ok(system.items.length <= 16);
      for (const obstacle of system.items) seen.set(obstacle.id, obstacle);
    }
    system.update(end);
    for (const obstacle of system.items) seen.set(obstacle.id, obstacle);
    assert.deepEqual([...seen.values()], expected);
  }
});

test("landmark clear zones never consume types from each width's shuffle bag", () => {
  const obstacles = course(123, 110_000);
  assert.ok(obstacles.every(item => !isLandmarkClearDistance(item.distance / RUN_CONFIG.unitsPerMeter)));
  for (const span of [1, 2] as const) {
    const ids = OBSTACLE_IDS.filter(id => OBSTACLE_DEFINITIONS[id].laneSpan === span);
    const types = obstacles.filter(item => OBSTACLE_DEFINITIONS[item.type].laneSpan === span).map(item => item.type);
    for (let i = 0; i + ids.length <= types.length; i += ids.length) {
      assert.deepEqual(new Set(types.slice(i, i + ids.length)), new Set(ids));
    }
  }
});

test("a reachable lateral escape remains at 30m/s through every density stage", () => {
  for (let seed = 1; seed <= 80; seed++) {
    let previousDistance = 0;
    let reachable = [0];
    for (const group of groups(course(seed, 8000))) {
      if (group[0].type === "barricade") { previousDistance = group[0].distance; continue; }
      const seconds = (group[0].distance - previousDistance - 2 * RUN_CONFIG.collisionHalfDepth) / 300 - 0.35;
      const safe = RUN_CONFIG.lanes.filter(lane => group.every(obstacle => Math.abs(lane - obstacle.courseX)
        > obstacle.collisionHalfWidth + PLAYER_CONFIG.collisionHalfWidth));
      reachable = safe.filter(lane => reachable.some(previous => Math.abs(lane - previous) <= seconds * PLAYER_CONFIG.lateralSpeed));
      assert.ok(reachable.length > 0, `no route: ${seed}/${group[0].id}`);
      previousDistance = group.at(-1)!.distance;
    }
  }
});

test("all thirteen obstacles collide on the ground but clear with a 0.8s jump at every tested speed and frame rate", () => {
  for (const type of OBSTACLE_IDS) {
    const obstacle: Obstacle = createObstacle(-1, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, 56);
    assert.notEqual(collisionFraction(state(), state({ distanceTravelled: 100 }), obstacle), null, type);
    for (const speed of [14, 22, 30, 94, 134, 174, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
      const run = isolatedRun(speed);
      run.obstacles.items.push({ ...obstacle, distance: speed * RUN_CONFIG.unitsPerMeter * 0.4 });
      run.update({ ...neutral, jumpPressed: true }, 0);
      advance(run, 400, fps);
      near(run.player.state.jumpHeight, 150);
      advance(run, 399, fps);
      assert.equal(run.status, 'running', `${type} at ${speed}m/s, ${fps} FPS`);
      assert.equal(run.player.state.jumpPhase, 'falling');
      assert.ok(run.player.state.jumpHeight > 0);
      advance(run, 1, fps);
      assert.equal(run.player.state.jumpPhase, 'grounded');
      near(run.elapsedSeconds, 0.8);
      near(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, distanceAt(speed, 0.8));
    }
  }
});

test("jump timing has a useful time window instead of a shrinking distance window at high speeds", () => {
  for (const type of OBSTACLE_IDS) for (const speed of [14, 22, 30, 94, 134, 174, 254, 1022]) {
    // At low speed the obstacle's 3.2m depth takes longer to pass underneath.
    const leadSeconds = speed < 94 ? [0.25, 0.4, 0.55] : [0.2, 0.4, 0.6];
    for (const lead of leadSeconds) for (const fps of [20, 30, 60, 144]) {
      const run = isolatedRun(speed);
      run.obstacles.items.push(createObstacle(-1, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, lead * speed * RUN_CONFIG.unitsPerMeter));
      run.update({ ...neutral, jumpPressed: true }, 0);
      advance(run, 850, fps);
      assert.equal(run.status, "running", `${type}, lead ${lead}s, ${speed}m/s, ${fps} FPS`);
      assert.equal(run.player.state.jumpPhase, "grounded");
    }
  }
});

test("one high-speed jump can clear multiple rows spaced 35m apart", () => {
  for (const type of OBSTACLE_IDS) for (const speed of [94, 134, 174, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
    const run = isolatedRun(speed);
    // Stress even wide types with the shortest single-cell row spacing.
    for (let meters = speed * 0.2; meters <= speed * 0.6; meters += 35) {
      run.obstacles.items.push(createObstacle(-run.obstacles.items.length - 1, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, meters * RUN_CONFIG.unitsPerMeter));
    }
    assert.ok(run.obstacles.items.length >= 2);
    run.update({ ...neutral, jumpPressed: true }, 0);
    advance(run, 850, fps);
    assert.equal(run.status, "running", `${type}, ${speed}m/s, ${fps} FPS`);
    assert.equal(run.player.state.jumpPhase, "grounded");
  }
});

test("jumping too late and landing inside a ground hazard still collide at the exact contact time", () => {
  for (const speed of [94, 134, 174, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
    for (const type of ["supply-crate", "ice-hole"] as const) {
      const run = isolatedRun(speed);
      const contactSeconds = type === "supply-crate" ? 0 : 0.8;
      run.obstacles.items.push(createObstacle(-1, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, type === "supply-crate" ? RUN_CONFIG.collisionHalfDepth : speed * 0.8 * RUN_CONFIG.unitsPerMeter));
      run.update({ ...neutral, jumpPressed: true }, 0);
      advance(run, 850, fps);
      assert.equal(run.status, "gameover", `${type}, ${speed}m/s, ${fps} FPS`);
      near(run.elapsedSeconds, contactSeconds);
      near(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, distanceAt(speed, contactSeconds), 1e-5);
    }
  }
});

test("a buffered jump carries the remainder of an irregular landing frame into the next arc", () => {
  const run = isolatedRun(174);
  run.update({ ...neutral, jumpPressed: true }, 0);
  advance(run, 775);
  run.update({ ...neutral, jumpPressed: true }, 50);
  assert.equal(run.status, "running");
  assert.equal(run.player.state.jumpPhase, "rising");
  near(run.player.state.jumpElapsedSeconds, 0.025);
  assert.ok(run.player.state.jumpHeight > 0);
  near(run.elapsedSeconds, 0.825);
  near(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, distanceAt(174, 0.825));
  advance(run, 375);
  near(run.player.state.jumpHeight, 150);
  advance(run, 400);
  assert.equal(run.player.state.jumpPhase, "grounded");
  near(run.elapsedSeconds, 1.6);
});

test("buffering never skips a falling or landing collision in favor of the second jump", () => {
  for (const type of ["supply-crate", "ice-hole"] as const) {
    const run = isolatedRun(174);
    const contactSeconds = type === "supply-crate" ? 0.79 : 0.8;
    run.obstacles.items.push(
      // Deliberately place a later obstacle first to check earliest-contact ordering.
      createObstacle(-1, "supply-crate", 3, distanceAt(174, 0.812) * RUN_CONFIG.unitsPerMeter + RUN_CONFIG.collisionHalfDepth),
      createObstacle(-2, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, distanceAt(174, contactSeconds) * RUN_CONFIG.unitsPerMeter + (type === "supply-crate" ? RUN_CONFIG.collisionHalfDepth : 0)),
    );
    run.update({ ...neutral, jumpPressed: true }, 0);
    advance(run, 775);
    assert.equal(run.status, "running");
    assert.equal(run.update({ ...neutral, jumpPressed: true }, 50), true);
    assert.equal(run.status, "gameover");
    // Sweeps linearly interpolate within a <=50ms frame; compare to the analytic arc.
    near(run.elapsedSeconds, contactSeconds, 1e-7);
    near(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, distanceAt(174, contactSeconds), 1e-5);
    near(run.averageSpeed, distanceAt(174, contactSeconds) / contactSeconds, 1e-5);
    if (type === "supply-crate") {
      assert.equal(run.player.state.jumpPhase, "falling");
      near(run.player.state.jumpElapsedSeconds, 0.79, 1e-7);
      assert.ok(run.player.state.jumpHeight > 0);
    } else near(run.player.state.jumpHeight, 0);
  }
});

test("the second rising arc still hits a solid obstacle before reaching its clearance height", () => {
  const run = isolatedRun(174);
  const contactSeconds = 0.812;
  run.obstacles.items.push(createObstacle(-1, "supply-crate", 3, distanceAt(174, contactSeconds) * RUN_CONFIG.unitsPerMeter + RUN_CONFIG.collisionHalfDepth));
  run.update({ ...neutral, jumpPressed: true }, 0);
  advance(run, 775);
  assert.equal(run.update({ ...neutral, jumpPressed: true }, 50), true);
  assert.equal(run.status, "gameover");
  assert.equal(run.player.state.jumpPhase, "rising");
  near(run.elapsedSeconds, contactSeconds, 1e-7);
  near(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, distanceAt(174, contactSeconds));
  near(run.player.state.jumpElapsedSeconds, 0.012, 1e-7);
  near(run.averageSpeed, distanceAt(174, contactSeconds) / contactSeconds, 1e-5);
  assert.ok(run.player.state.jumpHeight > 0 && run.player.state.jumpHeight < createObstacle(0, "supply-crate", 3, 0).collisionHeight);
});

test("ground hazards only catch ground contact, while solid heights differ and sprite edges are forgiving", () => {
  for (const type of OBSTACLE_IDS) {
    const definition = OBSTACLE_DEFINITIONS[type];
    const obstacle: Obstacle = createObstacle(0, type, OBSTACLE_DEFINITIONS[type].laneSpan === "full" ? 0 : 3, 100);
    const outside = obstacle.courseX + obstacle.collisionHalfWidth + PLAYER_CONFIG.collisionHalfWidth + 0.001;
    assert.equal(collisionFraction(state({ courseX: outside }), state({ courseX: outside, distanceTravelled: 200 }), obstacle), null);
    assert.notEqual(collisionFraction(state({ courseX: outside }), state({ distanceTravelled: 100 }), obstacle), null);
    const shallowJump = collisionFraction(state({ jumpHeight: 1 }), state({ jumpHeight: 1, distanceTravelled: 200 }), obstacle);
    if (definition.collisionType === 'groundHazard') {
      assert.equal(shallowJump, null);
      assert.notEqual(collisionFraction(state({ distanceTravelled: 100, jumpHeight: 1 }), state({ distanceTravelled: 100 }), obstacle), null);
    } else assert.notEqual(shallowJump, null);
  }
});
