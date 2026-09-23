import assert from "node:assert/strict";
import test from "node:test";
import { RUN_CONFIG } from "../config/constants.ts";
import { LANDMARKS } from "../data/landmarks.ts";
import { Player } from "../entities/Player.ts";
import { projectLandmark } from "./LandmarkView.ts";
import { ObstacleSystem } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";

test("changing high-speed lookahead never moves or resizes existing objects or landmarks", () => {
  const projection = new PerspectiveSystem();
  const distances = [0, 50, 600, 960, 1200, 3000, 50_000];
  const before = distances.map(distance => projection.project(0.6, distance));
  const landmark = projectLandmark(projection, LANDMARKS[0], 100);
  for (const lookahead of [4000, 16000, 1200]) {
    projection.viewDistance = lookahead;
    assert.deepEqual(distances.map(distance => projection.project(0.6, distance)), before);
    assert.deepEqual(projectLandmark(projection, LANDMARKS[0], 100), landmark);
  }
});

test("extended perspective has a continuous approach rate at the far-field transition", () => {
  const projection = new PerspectiveSystem();
  const join = RUN_CONFIG.viewDistance * 0.8;
  const before = projection.project(0.6, join - 0.001);
  const at = projection.project(0.6, join);
  const after = projection.project(0.6, join + 0.001);
  assert.ok(before.y > at.y && at.y > after.y);
  assert.ok(Math.abs((before.y - at.y) - (at.y - after.y)) < 1e-8);
  const distant = projection.project(0.6, 50000);
  assert.ok(distant.y > projection.horizonY && distant.y < after.y);
});

test("holding acceleration and braking across the lookahead threshold never reverses approaching objects", () => {
  const player = new Player();
  const projection = new PerspectiveSystem();
  const obstacles = new ObstacleSystem(() => 0.5);
  const input = { left: false, right: false, accelerate: true, brake: false, horizontalAxis: 0, verticalAxis: -1,
    jump: false, jumpPressed: false, jumpReleased: false };
  Object.assign(player.state, { selectedSpeed: 700, currentSpeed: 700 });
  let previousY = projection.project(0.6, 4000).y;
  let previousHorizon = RUN_CONFIG.viewDistance as number;
  for (let frame = 0; frame < 120; frame++) {
    player.update({ ...input, verticalAxis: frame < 60 ? -1 : 1 }, 1000 / 60);
    const distance = player.state.distanceTravelled;
    obstacles.update(distance, distance, player.state.currentSpeed);
    projection.viewDistance = obstacles.viewDistance;
    const point = projection.project(0.6, 4000 - distance);
    assert.ok(point.y > previousY);
    assert.ok(obstacles.viewDistance >= previousHorizon, "braking must not hide an already visible row");
    previousY = point.y;
    previousHorizon = obstacles.viewDistance;
  }
});
