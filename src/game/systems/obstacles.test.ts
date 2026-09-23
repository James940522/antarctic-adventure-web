import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GAME_SIZE, PLAYER_CONFIG, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "../data/obstacles.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { Player, type PlayerState } from "../entities/Player.ts";
import { getJumpDurationSeconds } from "../entities/jump.ts";
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

test("all six PNGs have valid artwork frames, preserved aspect ratios and jumpable lower hitboxes", () => {
  const nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  for (const id of OBSTACLE_IDS) {
    const def = OBSTACLE_DEFINITIONS[id];
    const png = readFileSync(new URL(`../../../public${def.assetPath}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const [x, y, width, height] = def.assetFrame;
    assert.ok(x >= 0 && y >= 0 && x + width <= png.readUInt32BE(16) && y + height <= png.readUInt32BE(20));
    assert.ok(Math.abs(def.visualWidth / def.visualHeight - width / height) < 1e-9);
    assert.ok(def.collisionHalfWidth * 2 * nearHalfWidth < def.visualWidth);
    assert.ok(def.collisionHeight < def.visualHeight && def.collisionHeight < PLAYER_CONFIG.jumpHeight);
    assert.equal(def.jumpable, true);
  }
  assert.ok(OBSTACLE_DEFINITIONS['snow-drift'].collisionHeight < OBSTACLE_DEFINITIONS['supply-crate'].collisionHeight);
});

test("nothing appears for 50m, then the first row enters at the existing horizon", () => {
  const system = new ObstacleSystem();
  const clear = OBSTACLE_CONFIG.initialClearMeters * RUN_CONFIG.unitsPerMeter;
  for (const distance of [0, 1, clear - 0.01]) { system.update(distance); assert.equal(system.items.length, 0); }
  system.update(clear);
  assert.equal(system.items.length, 1);
  assert.equal(system.items[0].distance - clear, RUN_CONFIG.viewDistance);
  const first = structuredClone(system.items);
  for (let i = 0; i < 100; i++) system.update(clear);
  assert.deepEqual(system.items, first);
});

test("every six spawns contain all types once and sixty spawns contain ten of each, without boundary repeats", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const obstacles = course(seed).slice(0, 60);
    assert.equal(obstacles.length, 60);
    for (let start = 0; start < 60; start += 6) {
      assert.deepEqual(new Set(obstacles.slice(start, start + 6).map(item => item.type)), new Set(OBSTACLE_IDS));
    }
    for (const id of OBSTACLE_IDS) assert.equal(obstacles.filter(item => item.type === id).length, 10);
    for (let i = 1; i < obstacles.length; i++) assert.notEqual(obstacles[i].type, obstacles[i - 1].type);
  }
});

test("rows contain one obstacle, with 35–55m gaps or 45–65m after a wide obstacle", () => {
  for (let seed = 1; seed <= 80; seed++) {
    const obstacles = course(seed);
    assert.equal(new Set(obstacles.map(item => item.distance)).size, obstacles.length);
    for (let i = 1; i < obstacles.length; i++) {
      const extra = OBSTACLE_DEFINITIONS[obstacles[i - 1].type].laneSpan === 2 ? 10 : 0;
      const gap = (obstacles[i].distance - obstacles[i - 1].distance) / RUN_CONFIG.unitsPerMeter;
      assert.ok(gap >= 35 + extra - 1e-9 && gap <= 55 + extra + 1e-9);
    }
  }
});

test("single cells and adjacent pairs cover every legal placement with no central bias or track overflow", () => {
  const single = Array<number>(7).fill(0), wide = Array<number>(6).fill(0);
  const halfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  for (const obstacle of course(9876, 350_000)) {
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    const endLane = obstacle.startLane + definition.laneSpan - 1;
    assert.ok(obstacle.startLane >= 0 && endLane < RUN_CONFIG.lanes.length);
    assert.equal(obstacle.courseX, (RUN_CONFIG.lanes[obstacle.startLane] + RUN_CONFIG.lanes[endLane]) / 2);
    assert.ok(Math.abs(obstacle.courseX) + definition.visualWidth / (2 * halfWidth) <= 1.05 + 1e-9);
    (definition.laneSpan === 1 ? single : wide)[obstacle.startLane]++;
  }
  for (const counts of [single, wide]) {
    const mean = counts.reduce((sum, n) => sum + n, 0) / counts.length;
    for (const n of counts) assert.ok(n > mean * 0.8 && n < mean * 1.2, counts.toString());
  }
});

test("spawn sequence is independent of update cadence, and live objects are bounded", () => {
  const end = 4000 * RUN_CONFIG.unitsPerMeter;
  const expected = course(42);
  for (const step of [3, 7, 40, 137]) {
    const system = new ObstacleSystem(seeded(42));
    const seen = new Map<number, Obstacle>();
    for (let distance = 0; distance < end; distance += step) {
      system.update(distance);
      assert.ok(system.items.length <= 5);
      for (const obstacle of system.items) seen.set(obstacle.id, obstacle);
    }
    system.update(end);
    for (const obstacle of system.items) seen.set(obstacle.id, obstacle);
    assert.deepEqual([...seen.values()], expected);
  }
});

test("landmark clear zones never consume or break shuffle bag cycles", () => {
  const obstacles = course(123, 110_000);
  assert.ok(obstacles.every(item => !isLandmarkClearDistance(item.distance / RUN_CONFIG.unitsPerMeter)));
  for (let i = 0; i + 6 <= obstacles.length; i += 6) {
    assert.equal(new Set(obstacles.slice(i, i + 6).map(item => item.type)).size, 6);
  }
});

test("a reachable lateral escape remains at 30m/s through many mixed courses", () => {
  for (let seed = 1; seed <= 80; seed++) {
    let previousDistance = 0;
    let reachable = [0];
    for (const obstacle of course(seed)) {
      const width = OBSTACLE_DEFINITIONS[obstacle.type].collisionHalfWidth + PLAYER_CONFIG.collisionHalfWidth;
      const seconds = (obstacle.distance - previousDistance - 2 * RUN_CONFIG.collisionHalfDepth) / 300 - 0.35;
      const safe = RUN_CONFIG.lanes.filter(lane => Math.abs(lane - obstacle.courseX) > width);
      reachable = safe.filter(lane => reachable.some(previous => Math.abs(lane - previous) <= seconds * PLAYER_CONFIG.lateralSpeed));
      assert.ok(reachable.length > 0, `no route: ${seed}/${obstacle.id}`);
      previousDistance = obstacle.distance;
    }
  }
});

test("all six obstacles collide on the ground but clear with one jump through 1022m/s and 20/30/60/144 FPS", () => {
  for (const type of OBSTACLE_IDS) {
    const obstacle: Obstacle = { id: -1, type, startLane: 3, courseX: 0, distance: 56 };
    assert.notEqual(collisionFraction(state(), state({ distanceTravelled: 100 }), obstacle), null, type);
    for (const speed of [14, 22, 30, 62, 126, 254, 510, 1022]) for (const fps of [20, 30, 60, 144]) {
      const run = new RunSystem();
      Object.assign(run.player.state, { selectedSpeed: speed * RUN_CONFIG.unitsPerMeter });
      const duration = getJumpDurationSeconds(speed * RUN_CONFIG.unitsPerMeter);
      run.obstacles.items.push({ ...obstacle, distance: speed * RUN_CONFIG.unitsPerMeter * duration / 2 });
      run.update({ ...neutral, jumpPressed: true }, 0);
      for (let i = 0; i < Math.ceil(duration * fps); i++) run.update(neutral, 1000 / fps);
      assert.equal(run.status, 'running', `${type} at ${speed}m/s, ${fps} FPS`);
      assert.equal(run.player.state.jumpPhase, 'grounded');
    }
  }
});

test("a fresh jump can clear each of three close rows without carrying the previous jump into the next", () => {
  for (const type of OBSTACLE_IDS) for (const speed of [62, 126, 254, 510, 1022]) for (const fps of [20, 30, 60, 144]) {
    const run = new RunSystem();
    Object.assign(run.player.state, { selectedSpeed: speed * RUN_CONFIG.unitsPerMeter });
    // Use the shortest legal spacing, even for the normally more widely spaced types.
    run.obstacles.items.push(...[12, 47, 82].map((meters, id) => ({
      id: -id - 1, type, startLane: 3, courseX: 0, distance: meters * RUN_CONFIG.unitsPerMeter,
    })));
    for (let row = 0; row < 3; row++) {
      assert.equal(run.player.state.jumpPhase, "grounded", `${type}, ${speed}m/s, ${fps} FPS, row ${row}`);
      run.update({ ...neutral, jumpPressed: true }, 0);
      // Input at each row's approach; ordinary frames between those input instants.
      let remainingMs = 35 / speed * 1000;
      while (remainingMs > 1e-8) {
        const delta = Math.min(1000 / fps, remainingMs);
        run.update(neutral, delta);
        remainingMs -= delta;
      }
      assert.equal(run.status, "running", `${type}, ${speed}m/s, ${fps} FPS, row ${row}`);
    }
    assert.equal(run.player.state.jumpPhase, "grounded");
  }
});

test("subframe jumps still collide when too late, when landing inside a hole, or at the next unjumped row", () => {
  for (const scenario of [
    { type: "supply-crate" as const, distances: [2], contact: 0 },
    { type: "ice-hole" as const, distances: [24], contact: 24 },
    { type: "supply-crate" as const, distances: [24], contact: 22 },
    { type: "supply-crate" as const, distances: [12, 35], contact: 33 },
  ]) {
    const run = new RunSystem();
    Object.assign(run.player.state, { selectedSpeed: 10000 });
    run.obstacles.items.push(...scenario.distances.map((distance, id) => ({
      id: -id - 1, type: scenario.type, startLane: 3, courseX: 0, distance: distance * RUN_CONFIG.unitsPerMeter,
    })));
    assert.equal(run.update({ ...neutral, jumpPressed: true }, 50), true);
    assert.equal(run.status, "gameover");
    assert.ok(Math.abs(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter - scenario.contact) < 1e-8);
    assert.ok(Math.abs(run.elapsedSeconds - scenario.contact / 1000) < 1e-8);
    if (scenario.contact === 22) {
      assert.equal(run.player.state.jumpPhase, "falling");
      assert.ok(run.player.state.jumpHeight > 0);
      assert.ok(Math.abs(run.player.state.jumpElapsedSeconds - 0.022) < 1e-8);
    }
  }
});

test("ground hazards only catch ground contact, while solid heights differ and sprite edges are forgiving", () => {
  for (const type of OBSTACLE_IDS) {
    const definition = OBSTACLE_DEFINITIONS[type];
    const obstacle: Obstacle = { id: 0, type, startLane: 3, courseX: 0, distance: 100 };
    const outside = definition.collisionHalfWidth + PLAYER_CONFIG.collisionHalfWidth + 0.001;
    assert.equal(collisionFraction(state({ courseX: outside }), state({ courseX: outside, distanceTravelled: 200 }), obstacle), null);
    assert.notEqual(collisionFraction(state({ courseX: outside }), state({ distanceTravelled: 100 }), obstacle), null);
    const shallowJump = collisionFraction(state({ jumpHeight: 1 }), state({ jumpHeight: 1, distanceTravelled: 200 }), obstacle);
    if (definition.collisionType === 'groundHazard') {
      assert.equal(shallowJump, null);
      assert.notEqual(collisionFraction(state({ distanceTravelled: 100, jumpHeight: 1 }), state({ distanceTravelled: 100 }), obstacle), null);
    } else assert.notEqual(shallowJump, null);
  }
});
