import assert from "node:assert/strict";
import test from "node:test";
import type { GameInputState } from "../input/input.types.ts";
import { formatKilometers } from "../utils/formatDistance.ts";
import { calculateScore } from "./ScoreSystem.ts";
import { RunSystem } from "./RunSystem.ts";
import { createGameRecord } from "./ManualRecordSave.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};

test("distance and average speed both affect points, with 1km at 14m/s worth 1000", () => {
  for (const [distance, average, score] of [
    [1000, 14, 1000], [1000, 28, 2000], [1000, 42, 3000], [2000, 28, 4000],
    [10000, 70, 50000], [1000, 1022, 73000], [408, 19.1, 557],
  ]) assert.equal(calculateScore(distance, average), score);
  assert.equal(calculateScore(1000.9, 14), 1000); // Same whole meters as the record.
  for (const invalid of [NaN, Infinity, -1, 0]) {
    assert.equal(calculateScore(invalid, 14), 0);
    assert.equal(calculateScore(1000, invalid), 0);
  }
});

test("time-weighted speed, not the last selected speed, determines score; pause adds nothing", () => {
  const run = new RunSystem();
  for (let i = 0; i < 20; i++) run.update(neutral, 50);
  run.update({ ...neutral, verticalAxis: -1 }, 0);
  for (let i = 0; i < 60; i++) run.update(neutral, 50);
  const before = run.snapshot(false, true);
  assert.ok(Math.abs(before.averageSpeed - 20) < 1e-8);
  assert.equal(before.score, Math.round(before.distance * 20 / 14));
  // Raising the selected speed with no elapsed movement cannot inflate a record.
  run.update({ ...neutral, verticalAxis: -1 }, 0);
  assert.equal(run.snapshot(false, true).score, before.score);
  run.setPaused(true);
  for (let i = 0; i < 100; i++) run.update(neutral, 50);
  assert.equal(run.snapshot(true, false).score, before.score);
});

test("collision finalizes one score at every frame rate and the payload uses that score", () => {
  for (const fps of [20, 30, 60, 144]) {
    const run = new RunSystem();
    for (let i = 0; i < 2; i++) {
      run.update(neutral, 0);
      run.update({ ...neutral, verticalAxis: -1 }, 0);
    }
    run.obstacles.items.splice(0, run.obstacles.items.length, { id: 1, type: "supply-crate", startLane: 3, courseX: 0, distance: 1000 });
    for (let i = 0; i < fps * 4; i++) run.update(neutral, 1000 / fps);
    const result = run.snapshot(false, true);
    assert.equal(result.status, "gameover");
    assert.equal(result.distance, 98);
    assert.equal(result.score, 210);
    const record = createGameRecord(result, { id: "550e8400-e29b-41d4-a716-446655440000", nickname: "Penguin" });
    assert.equal(record.score, 210);
    assert.equal(record.distance, 98);
    assert.equal(formatKilometers(result.distance), "0.098 km");
    run.update({ ...neutral, verticalAxis: -1 }, 50);
    assert.equal(run.snapshot(false, true).score, 210);
    run.restart();
    assert.equal(run.snapshot(false, true).score, 0);
  }
});

test("kilometers preserve the same meter precision below and above 1km", () => {
  for (const [meters, expected] of [
    [0, "0.000 km"], [1, "0.001 km"], [408, "0.408 km"], [999, "0.999 km"],
    [1000, "1.000 km"], [1234, "1.234 km"], [10000, "10.000 km"], [100001, "100.001 km"],
  ] as const) assert.equal(formatKilometers(meters), expected);
});
