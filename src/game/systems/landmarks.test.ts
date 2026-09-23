import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { LANDMARK_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { LANDMARKS } from "../data/landmarks.ts";
import type { GameInputState } from "../input/input.types.ts";
import { formatDistance } from "../utils/formatDistance.ts";
import { LandmarkSystem, type LandmarkRenderer } from "./LandmarkSystem.ts";
import { projectLandmark } from "./LandmarkView.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};

function harness() {
  let visible: string | null = null;
  let clears = 0;
  const passed: string[] = [];
  const view: LandmarkRenderer = {
    render: (landmark) => {
      assert.ok(visible === null || visible === landmark.id, "only one live sprite");
      visible = landmark.id;
    },
    clear: () => { visible = null; clears++; },
  };
  const system = new LandmarkSystem(view, (landmark) => passed.push(landmark.id));
  return { system, passed, get visible() { return visible; }, get clears() { return clears; } };
}

test("all ten configured landmarks reference existing PNGs and valid artwork bounds", () => {
  assert.deepEqual(LANDMARKS.map((item) => item.distance), [300, 700, 1200, 2000, 3000, 4000, 5000, 6500, 8000, 10000]);
  assert.deepEqual(LANDMARKS.map((item) => item.approachDistance), [100, 120, 200, 200, 300, 250, 300, 250, 300, 400]);
  assert.equal(new Set(LANDMARKS.map((item) => item.assetKey)).size, 10);
  for (const landmark of LANDMARKS) {
    const png = readFileSync(new URL(`../../../public${landmark.assetPath}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    const [x, y, width, height] = landmark.assetFrame;
    assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
    assert.ok(x + width <= png.readUInt32BE(16) && y + height <= png.readUInt32BE(20));
  }
});

test("NEXT starts at 300 m, counts down without an early 0, then switches exactly at crossing", () => {
  const { system, passed } = harness();
  assert.deepEqual(system.snapshot(), { next: { name: "기상 관측 표지", distanceRemaining: 300 }, message: null });
  system.update(50, 1);
  assert.equal(system.snapshot().next?.distanceRemaining, 250);
  system.update(299.99, 2);
  assert.equal(system.snapshot().next?.distanceRemaining, 1);
  assert.equal(passed.length, 0);
  system.update(300, 3);
  assert.deepEqual(passed, ["weather-marker"]);
  assert.deepEqual(system.snapshot().next, { name: "펭귄 군락", distanceRemaining: 400 });
  assert.equal(system.snapshot().message, null);
  system.update(299, 4);
  system.update(300, 5);
  assert.deepEqual(passed, ["weather-marker"]);
});

test("every landmark appears at its approach boundary, grows, passes once and exits", () => {
  const h = harness();
  const projection = new PerspectiveSystem();
  for (const landmark of LANDMARKS) {
    const start = landmark.distance - landmark.approachDistance;
    h.system.update(start - 0.001, start);
    assert.equal(h.visible, null);
    h.system.update(start, start);
    assert.equal(h.visible, landmark.id);
    assert.equal(h.system.progress, 0);
    let previousScale = 0;
    let previousY = 0;
    for (const progress of [0, 0.25, 0.5, 0.95, 1]) {
      const point = projectLandmark(projection, landmark, landmark.approachDistance * (1 - progress));
      assert.ok(point.scale > previousScale && point.y > previousY);
      const edge = projection.project(landmark.lateralPosition, landmark.approachDistance * (1 - progress) / landmark.approachDistance * RUN_CONFIG.viewDistance);
      assert.ok(landmark.lateralPosition < 0 ? point.x < edge.x : point.x > edge.x);
      previousScale = point.scale;
      previousY = point.y;
    }
    h.system.update(landmark.distance - 0.001, landmark.distance);
    assert.equal(h.system.next?.id, landmark.id);
    h.system.update(landmark.distance, landmark.distance);
    assert.notEqual(h.system.next?.id, landmark.id);
    assert.equal(h.visible, landmark.id);
    h.system.update(landmark.distance + LANDMARK_CONFIG.exitDistance, landmark.distance + 2);
    assert.equal(h.visible, null);
    assert.equal(h.system.activeLandmark, null);
    assert.equal(h.system.snapshot().message, null);
  }
  assert.deepEqual(h.passed, LANDMARKS.map((item) => item.id));
  h.system.update(50000, 20000);
  assert.deepEqual(h.system.snapshot(), { next: null, message: null });
  assert.equal(h.passed.length, 10);
});

test("medium and major messages expire with simulation time and remain steady while paused", () => {
  for (const landmark of LANDMARKS.filter((item) => item.showPassMessage)) {
    const system = new LandmarkSystem();
    system.update(landmark.distance, 50);
    assert.equal(system.snapshot().message?.id, landmark.id);
    system.update(landmark.distance, 50); // No elapsed simulation time during a pause.
    assert.equal(system.snapshot().message?.id, landmark.id);
    const duration = LANDMARK_CONFIG.sizes[landmark.size].messageSeconds;
    system.update(landmark.distance + 1, 50 + duration - 0.001);
    assert.equal(system.snapshot().message?.id, landmark.id);
    system.update(landmark.distance + 2, 50 + duration);
    assert.equal(system.snapshot().message, null);
  }
});

test("restart clears an approaching or exiting sprite, messages and passed history", () => {
  for (const distance of [250, 3005, 10005]) {
    const h = harness();
    h.system.update(distance - 10, 10);
    h.system.update(distance, 11);
    assert.notEqual(h.visible, null);
    h.system.reset();
    assert.equal(h.visible, null);
    assert.equal(h.system.progress, null);
    assert.equal(h.system.next?.distance, 300);
    assert.equal(h.system.snapshot().next?.distanceRemaining, 300);
    assert.equal(h.system.snapshot().message, null);
    h.system.update(300, 20);
    assert.equal(h.passed.filter((id) => id === "weather-marker").length, distance < 300 ? 1 : 2);
  }
});

test("landmark observation does not change speed, input, difficulty, collisions or distance", () => {
  const observed = new RunSystem(0, () => 0.5);
  const control = new RunSystem(0, () => 0.5);
  const landmarks = new LandmarkSystem();
  // Empty test course: isolate milestone crossings while retaining real movement and spawning.
  for (let frame = 0; frame < 15000; frame++) {
    observed.obstacles.boxes.length = control.obstacles.boxes.length = 0;
    const input = { ...neutral, horizontalAxis: Math.sin(frame / 100), verticalAxis: frame % 100 === 0 ? -1 : 0, jumpPressed: frame % 30 === 0 };
    observed.update(input, 50);
    landmarks.update(observed.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, observed.elapsedSeconds);
    control.update(input, 50);
  }
  assert.ok(observed.snapshot(false, true).distance > 10000);
  assert.deepEqual(observed.player.state, control.player.state);
  assert.deepEqual(observed.snapshot(false, true), control.snapshot(false, true));
  assert.deepEqual(observed.obstacles.boxes, control.obstacles.boxes);
  assert.equal(observed.status, "running");
  assert.equal(landmarks.next, null);

  // A box just before 300 m must stop the player before the milestone is counted.
  const run = new RunSystem();
  const finalLandmarks = new LandmarkSystem();
  while (run.player.state.distanceTravelled < 2980) {
    run.obstacles.boxes.length = 0;
    run.update(neutral, 50);
  }
  run.obstacles.boxes.splice(0, run.obstacles.boxes.length, { id: 1, courseX: 0, distance: 3015, color: 0 });
  for (let frame = 0; frame < 10; frame++) {
    run.update(neutral, 50);
    finalLandmarks.update(run.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter, run.elapsedSeconds);
  }
  assert.equal(run.status, "gameover");
  assert.equal(run.player.state.distanceTravelled, 2995);
  assert.equal(finalLandmarks.next?.distance, 300);
});

test("total distance formatting changes at 1000 m while preserving two km decimals", () => {
  for (const [meters, expected] of [[0, "0 m"], [50, "50 m"], [950, "950 m"], [999.9, "999 m"], [1000, "1.00 km"], [1250, "1.25 km"], [3420, "3.42 km"], [10000, "10.00 km"]] as const) {
    assert.equal(formatDistance(meters), expected);
  }
});
