import assert from "node:assert/strict";
import test from "node:test";
import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS, occupiedLanesFor } from "../data/obstacles.ts";
import { Player } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { collisionFraction } from "./CollisionSystem.ts";
import { createObstacle, ObstacleSystem } from "./ObstacleSystem.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function hitAt(type: typeof OBSTACLE_IDS[number], startLane: number, x: number, jumpHeight: number, lanes: readonly number[] = RUN_CONFIG.lanes) {
  const obstacle = createObstacle(0, type, startLane, 100, lanes);
  const from = { ...new Player().state, courseX: x, jumpHeight };
  return collisionFraction(from, { ...from, distanceTravelled: 200 }, obstacle);
}

test("1/2/full placements generalize to 3, 5 and 7 lanes without gaps or invalid starts", () => {
  for (const count of [3, 5, 7]) {
    const lanes = Array.from({ length: count }, (_, i) => -1.05 + (i + 0.5) * 2.1 / count);
    for (const type of OBSTACLE_IDS) {
      const span = OBSTACLE_DEFINITIONS[type].laneSpan;
      const width = span === "full" ? count : span;
      for (let start = 0; start <= count - width; start++) {
        const obstacle = createObstacle(0, type, start, 100, lanes);
        assert.deepEqual(obstacle.occupiedLanes, Array.from({ length: width }, (_, i) => start + i));
        assert.equal(obstacle.courseX, (lanes[start] + lanes[start + width - 1]) / 2);
        for (let lane = 0; lane < count; lane++) {
          const hit = hitAt(type, start, lanes[lane], 0, lanes);
          assert.equal(hit !== null, obstacle.occupiedLanes.includes(lane), `${count} lanes / ${type} / start ${start} / lane ${lane}`);
          assert.equal(hitAt(type, start, lanes[lane], PLAYER_CONFIG.jumpHeight, lanes), null);
        }
        assert.ok(obstacle.collisionHeight < PLAYER_CONFIG.jumpHeight);
        if (span === "full") {
          assert.ok(Math.abs(obstacle.courseX) < 1e-9);
          assert.ok(obstacle.collisionHalfWidth >= PLAYER_CONFIG.courseLimit);
        }
      }
      assert.throws(() => createObstacle(0, type, count - width + 1, 100, lanes), RangeError);
    }
  }
  assert.throws(() => occupiedLanesFor(2, -1), RangeError);
  assert.throws(() => occupiedLanesFor(2, 0.5), RangeError);
});

test("barricade blocks every course position and cannot be bypassed by lateral sweeping or starting a jump late", () => {
  for (let step = -20; step <= 20; step++) {
    assert.notEqual(hitAt("barricade", 0, step / 20, 0), null);
    assert.notEqual(hitAt("barricade", 0, step / 20, 1), null);
    assert.equal(hitAt("barricade", 0, step / 20, 73), null);
  }
  const wall = createObstacle(0, "barricade", 0, 100);
  const from = { ...new Player().state, courseX: -1 };
  assert.notEqual(collisionFraction(from, { ...from, courseX: 1, distanceTravelled: 200 }, wall), null);
});

test("six barricade cases through the real run: left/center/right collide, each clears with one timed jump", () => {
  for (const courseX of [-1, 0, 1]) for (const jump of [false, true]) {
    for (const speed of [14, 30, 94, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
      const run = new RunSystem();
      Object.assign(run.player.state, { courseX, selectedSpeed: speed * RUN_CONFIG.unitsPerMeter });
      run.obstacles.update = () => {};
      run.items.update = () => {};
      run.obstacles.items.push(createObstacle(0, "barricade", 0, speed * RUN_CONFIG.unitsPerMeter * 0.4));
      run.update({ ...neutral, jumpPressed: jump }, 0);
      for (let frame = 0; frame < fps; frame++) run.update(neutral, 1000 / fps);
      assert.equal(run.status, jump ? "running" : "gameover", `${courseX}/${jump}/${speed}/${fps}`);
      assert.equal(run.player.state.jumpPhase, "grounded");
    }
  }
});

test("high-speed barricades retain recognition, landing and reaction time on both sides", () => {
  for (const speed of [14, 30, 94, 254, 1022]) for (const seed of [1, 42, 9876]) {
    const system = new ObstacleSystem(seeded(seed));
    system.update(0, 80_000 * RUN_CONFIG.unitsPerMeter, speed * RUN_CONFIG.unitsPerMeter);
    const minimum = (PLAYER_CONFIG.jumpDurationSeconds + OBSTACLE_CONFIG.escapeReactionSeconds) * speed;
    assert.ok(system.viewDistance / RUN_CONFIG.unitsPerMeter >= minimum);
    for (let i = 1; i < system.items.length - 1; i++) {
      const wall = system.items[i];
      if (wall.type !== "barricade") continue;
      const before = (wall.distance - system.items[i - 1].distance - 2 * RUN_CONFIG.collisionHalfDepth) / RUN_CONFIG.unitsPerMeter;
      const after = (system.items[i + 1].distance - wall.distance - 2 * RUN_CONFIG.collisionHalfDepth) / RUN_CONFIG.unitsPerMeter;
      assert.ok(before >= minimum - 1e-8 && after >= minimum - 1e-8, `${speed}: ${before}/${after}`);
    }
  }
});
