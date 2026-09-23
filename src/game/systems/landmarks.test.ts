import { createObstacle } from "./ObstacleSystem.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { GAME_SIZE, LANDMARK_CONFIG, PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { getViewportHeight } from "../config/viewport.ts";
import { LANDMARKS, isLandmarkClearDistance } from "../data/landmarks.ts";
import type { GameInputState } from "../input/input.types.ts";
import { formatDistance } from "../utils/formatDistance.ts";
import { LandmarkSystem, type LandmarkRenderer } from "./LandmarkSystem.ts";
import { projectLandmark } from "./LandmarkView.ts";
import { ObstacleSystem } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const firstDestination = LANDMARKS[0];
const firstDestinationWorld = firstDestination.distance * RUN_CONFIG.unitsPerMeter;
const finalDestination = LANDMARKS[LANDMARKS.length - 1];

function harness() {
  let visible: string | null = null;
  let alpha = 1;
  const arrived: string[] = [];
  const view: LandmarkRenderer = {
    render: (landmark, _remaining, opacity = 1) => {
      assert.ok(visible === null || visible === landmark.id, "only one live sprite");
      visible = landmark.id;
      alpha = opacity;
    },
    clear: () => { visible = null; },
  };
  const system = new LandmarkSystem(view, (landmark) => arrived.push(landmark.id));
  return { system, arrived, get visible() { return visible; }, get alpha() { return alpha; } };
}

function approachFirst(run: RunSystem, fps: number, targetWorld = firstDestinationWorld - 10) {
  const frameLimit = Math.ceil(targetWorld / run.player.state.currentSpeed * fps) + fps;
  for (let frame = 0; frame < frameLimit && run.player.state.distanceTravelled < targetWorld; frame++) {
    // Isolate the arrival from earlier obstacles, while retaining real movement/spawning.
    run.obstacles.items.length = 0;
    run.update(neutral, 1000 / fps);
  }
}

test("ten destinations are spaced every 10km through 100km with valid unchanged PNG artwork frames", () => {
  assert.deepEqual(LANDMARKS.map(item => item.distance), [10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000]);
  assert.equal(new Set(LANDMARKS.map(item => item.assetKey)).size, 10);
  for (const landmark of LANDMARKS) {
    assert.ok(landmark.approachDistance >= 300);
    const png = readFileSync(new URL(`../../../public${landmark.assetPath}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const [x, y, width, height] = landmark.assetFrame;
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(x + width <= png.readUInt32BE(16) && y + height <= png.readUInt32BE(20));
  }
});

test("every destination approaches centrally, remains for celebration, then clears once", () => {
  const h = harness();
  const projection = new PerspectiveSystem();
  assert.deepEqual(h.system.snapshot(), { next: { name: firstDestination.name, distanceRemaining: firstDestination.distance }, arrival: null });
  h.system.update(50);
  assert.equal(h.system.snapshot().next?.distanceRemaining, firstDestination.distance - 50);
  for (const landmark of LANDMARKS) {
    const start = landmark.distance - landmark.approachDistance;
    h.system.update(start - 0.001);
    assert.equal(h.visible, null);
    h.system.update(start);
    assert.equal(h.visible, landmark.id);
    assert.equal(h.system.progress, 0);
    let previousScale = 0;
    let previousY = 0;
    for (const progress of [0, 0.25, 0.5, 0.95, 1]) {
      const point = projectLandmark(projection, landmark, landmark.approachDistance * (1 - progress));
      assert.equal(point.x, GAME_SIZE.width / 2);
      assert.ok(point.scale > previousScale && point.y > previousY);
      const width = point.scale * landmark.assetFrame[2];
      const height = point.scale * landmark.assetFrame[3];
      assert.ok(point.x - width / 2 >= 0 && point.x + width / 2 <= GAME_SIZE.width);
      assert.ok(point.y - height >= 80, "keep art below HUD");
      assert.ok(point.y < projection.contactY, "destination behind penguin");
      previousScale = point.scale;
      previousY = point.y;
    }
    h.system.update(landmark.distance - 0.001);
    assert.equal(h.system.snapshot().next?.distanceRemaining, 1);
    h.system.update(landmark.distance);
    assert.equal(h.system.isCelebrating, true);
    assert.equal(h.system.snapshot().arrival?.id, landmark.id);
    assert.equal(h.system.next?.id, landmark.id);
    assert.equal(h.system.snapshot().next?.distanceRemaining, 0);
    const arrivals = h.arrived.length;
    h.system.update(landmark.distance + 100);
    h.system.advanceCelebration(0);
    assert.equal(h.arrived.length, arrivals);
    assert.equal(h.system.celebrationElapsedSeconds, 0);
    assert.equal(h.system.advanceCelebration(2.25), false);
    assert.ok(h.alpha > 0 && h.alpha < 1);
    assert.equal(h.visible, landmark.id);
    assert.equal(h.system.advanceCelebration(0.25), true);
    assert.equal(h.visible, null);
    assert.equal(h.system.snapshot().arrival, null);
    assert.notEqual(h.system.next?.id, landmark.id);
    h.system.update(landmark.distance);
    assert.equal(h.arrived.length, arrivals);
  }
  assert.deepEqual(h.arrived, LANDMARKS.map(item => item.id));
  h.system.update(finalDestination.distance + 5000);
  assert.deepEqual(h.system.snapshot(), { next: null, arrival: null });
});

test("pre-spawned rows leave the approach and departure corridor empty for all destinations", () => {
  const obstacles = new ObstacleSystem(() => 0.5);
  const endWorld = (finalDestination.distance + 300) * RUN_CONFIG.unitsPerMeter;
  for (let distance = 0; distance <= endWorld; distance += 80) {
    obstacles.update(distance);
    assert.ok(obstacles.items.every(box => !isLandmarkClearDistance(box.distance / RUN_CONFIG.unitsPerMeter)));
    for (const landmark of LANDMARKS) {
      if (distance >= (landmark.distance - landmark.approachDistance) * RUN_CONFIG.unitsPerMeter
        && distance <= landmark.distance * RUN_CONFIG.unitsPerMeter) {
        assert.equal(obstacles.items.length, 0, `${landmark.id}: image must not hide any obstacle`);
      }
    }
  }
  for (const landmark of LANDMARKS) {
    const after = (landmark.distance + LANDMARK_CONFIG.departureClearMeters + 40) * RUN_CONFIG.unitsPerMeter;
    const afterObstacles = new ObstacleSystem(() => 0.5);
    afterObstacles.update(after);
    assert.ok(afterObstacles.items.some(box => box.distance > after), "obstacles resume after the safe corridor");
  }
});

test("landmark art stays below the HUD and inside the scene at mobile aspect ratios", () => {
  for (const [width, height] of [[844, 390], [1024, 320], [768, 1024], [320, 360]]) {
    const projection = new PerspectiveSystem(getViewportHeight(width, height));
    for (const landmark of LANDMARKS) {
      for (const remaining of [landmark.approachDistance, landmark.approachDistance / 2, 0]) {
        const point = projectLandmark(projection, landmark, remaining);
        assert.ok(point.y - point.scale * landmark.assetFrame[3] >= 80 - 1e-9);
        assert.ok(point.y < projection.contactY);
        assert.ok(point.x - point.scale * landmark.assetFrame[2] / 2 >= 0);
        assert.ok(point.x + point.scale * landmark.assetFrame[2] / 2 <= GAME_SIZE.width);
      }
    }
  }
});

test("30/60/144 FPS stop at exact meters, suppress gameplay for 2.5s, and resume the selected speed", () => {
  const selectedSpeed = 940;
  for (const fps of [30, 60, 144]) {
    const h = harness();
    const run = new RunSystem({ distance: 900, averageSpeed: null }, () => 0.5, h.system);
    Object.assign(run.player.state, { selectedSpeed, currentSpeed: selectedSpeed });
    approachFirst(run, fps);
    for (let frame = 0; frame < fps && run.status === "running"; frame++) {
      run.update({ ...neutral, horizontalAxis: 1, jumpPressed: true }, 1000 / fps);
    }
    assert.equal(run.status, "celebrating");
    assert.equal(run.player.state.distanceTravelled, firstDestinationWorld);
    assert.equal(run.player.state.currentSpeed, 0);
    assert.equal(run.player.state.jumpPhase, "grounded");
    const arrivalSpeed = run.player.state.selectedSpeed;
    assert.ok(Math.abs(arrivalSpeed - (selectedSpeed + PLAYER_CONFIG.baseAcceleration * run.elapsedSeconds)) < 1e-8);
    assert.ok(Math.abs(run.player.state.baseSpeed - (PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.baseAcceleration * run.elapsedSeconds)) < 1e-8);
    assert.equal(run.snapshot(false, true).speed, 0);
    const expectedEndSpeed = Math.sqrt(selectedSpeed ** 2 + 2 * PLAYER_CONFIG.baseAcceleration * firstDestinationWorld);
    const expectedTime = 2 * firstDestinationWorld / (selectedSpeed + expectedEndSpeed);
    assert.ok(Math.abs(run.elapsedSeconds - expectedTime) < 1e-6);
    const frozen = { ...run.player.state };
    const frozenTime = run.elapsedSeconds;
    const frozenAverage = run.averageSpeed;
    assert.ok(Math.abs(frozenAverage - (selectedSpeed + expectedEndSpeed) / 2 / RUN_CONFIG.unitsPerMeter) < 1e-6);
    const ticks = Math.round(fps * LANDMARK_CONFIG.celebrationSeconds);
    for (let i = 0; i < ticks - 1; i++) {
      run.update({ ...neutral, horizontalAxis: -1, verticalAxis: 1, jumpPressed: true }, 1000 / fps);
      assert.deepEqual(run.player.state, frozen);
      assert.equal(run.elapsedSeconds, frozenTime);
      assert.equal(run.averageSpeed, frozenAverage);
      assert.equal(run.status, "celebrating");
    }
    run.update(neutral, 1000 / fps);
    assert.equal(run.status, "running");
    assert.equal(run.player.state.distanceTravelled, firstDestinationWorld);
    assert.equal(run.player.state.currentSpeed, arrivalSpeed);
    assert.equal(run.snapshot(false, true).speed, arrivalSpeed / RUN_CONFIG.unitsPerMeter);
    assert.equal(run.averageSpeed, frozenAverage);
    assert.equal(run.player.state.courseX, 0);
    assert.equal(h.visible, null);
    assert.equal(h.system.next?.distance, LANDMARKS[1].distance);
    assert.equal(run.bestRecord.distance, 900);
    run.update(neutral, 1000 / fps);
    assert.ok(run.player.state.distanceTravelled > firstDestinationWorld);
    assert.ok(Math.abs(run.player.state.baseSpeed - frozen.baseSpeed - PLAYER_CONFIG.baseAcceleration / fps) < 1e-8);
    assert.deepEqual(h.arrived, ["weather-marker"]);
  }
});

test("pause, invalid time and long frame gaps cannot skip the celebration", () => {
  const run = new RunSystem();
  approachFirst(run, 60, firstDestinationWorld);
  const frozen = { ...run.player.state };
  run.setPaused(true);
  for (let i = 0; i < 100; i++) run.update(neutral, 50);
  assert.equal(run.landmarks.celebrationElapsedSeconds, 0);
  assert.deepEqual(run.player.state, frozen);
  run.setPaused(false);
  for (const delta of [0, NaN, Infinity, -1]) run.update(neutral, delta);
  assert.equal(run.landmarks.celebrationElapsedSeconds, 0);
  run.update(neutral, 60000);
  assert.equal(run.landmarks.celebrationElapsedSeconds, PLAYER_CONFIG.maxDeltaMs / 1000);
  assert.deepEqual(run.player.state, frozen);
  assert.equal(run.status, "celebrating");
});

test("collision before or exactly at arrival wins, without an arrival callback or record inflation", () => {
  for (const contactWorld of [firstDestinationWorld - 5, firstDestinationWorld]) {
    const h = harness();
    const run = new RunSystem(undefined, () => 0.5, h.system);
    approachFirst(run, 60);
    run.obstacles.items.push(createObstacle(-1, "supply-crate", 3, contactWorld + RUN_CONFIG.collisionHalfDepth));
    for (let frame = 0; frame < 60; frame++) run.update(neutral, 1000 / 60);
    assert.equal(run.status, "gameover");
    assert.equal(run.player.state.distanceTravelled, contactWorld);
    assert.equal(run.bestRecord.distance, Math.floor(contactWorld / RUN_CONFIG.unitsPerMeter));
    assert.equal(h.arrived.length, 0);
    assert.equal(h.system.isCelebrating, false);
  }
});

test("restart clears approaching and celebrating art and starts from the first destination", () => {
  for (const distance of [firstDestination.distance - firstDestination.approachDistance / 2, firstDestination.distance]) {
    const h = harness();
    const run = new RunSystem({ distance: 750, averageSpeed: null }, () => 0.5, h.system);
    approachFirst(run, 60, distance * RUN_CONFIG.unitsPerMeter);
    assert.notEqual(h.visible, null);
    run.restart();
    assert.equal(h.visible, null);
    assert.equal(run.status, "running");
    assert.equal(run.player.state.distanceTravelled, 0);
    assert.equal(run.player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed);
    assert.equal(run.landmarks.celebrationElapsedSeconds, null);
    assert.equal(run.landmarks.next?.distance, firstDestination.distance);
    assert.equal(run.landmarks.snapshot().next?.distanceRemaining, firstDestination.distance);
    assert.equal(run.bestRecord.distance, 750);
  }
});

test("all ten stops occur once and the run continues past the final 100km destination", () => {
  const h = harness();
  const run = new RunSystem(undefined, () => 0.5, h.system);
  run.player.update({ ...neutral, verticalAxis: -1 }, 0);
  run.player.update(neutral, 0);
  run.player.update({ ...neutral, verticalAxis: -1 }, 0);
  const finishWorld = (finalDestination.distance + 1000) * RUN_CONFIG.unitsPerMeter;
  const frameLimit = Math.ceil((finishWorld / run.player.state.currentSpeed + LANDMARKS.length * LANDMARK_CONFIG.celebrationSeconds) / 0.05) + LANDMARKS.length;
  for (let frame = 0; frame < frameLimit && run.player.state.distanceTravelled < finishWorld; frame++) {
    run.obstacles.items.length = 0;
    run.update(neutral, 50);
  }
  assert.ok(run.player.state.distanceTravelled >= finishWorld);
  assert.equal(run.status, "running");
  assert.equal(run.landmarks.next, null);
  assert.equal(h.visible, null);
  assert.deepEqual(h.arrived, LANDMARKS.map(item => item.id));
});

test("total distance formatting stays in whole meters past 1000 m", () => {
  for (const [meters, expected] of [[0, "0 m"], [50, "50 m"], [950, "950 m"], [999.9, "999 m"], [1000, "1,000 m"], [1250, "1,250 m"], [3420, "3,420 m"], [20000, "20,000 m"]] as const) {
    assert.equal(formatDistance(meters), expected);
  }
});
