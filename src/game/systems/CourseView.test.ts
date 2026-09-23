import { createObstacle } from "./ObstacleSystem.ts";
import assert from "node:assert/strict";
import test from "node:test";
import type { Scene } from "phaser";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "../data/obstacles.ts";
import { CourseView } from "./CourseView.ts";
import type { Obstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";

test("every legal 3/5/7-lane placement renders one centered image at its configured dimensions and reuses then releases its view", () => {
  const images: Array<{ key: string; frame: string; x: number; y: number; scaleX: number; scaleY: number; originX: number; originY: number; destroyed: boolean }> = [];
  const graphics = {
    clear() { return this; }, setDepth() { return this; }, fillStyle() { return this; },
    fillTriangle() { return this; }, lineStyle() { return this; }, lineBetween() { return this; },
    fillRect() { return this; }, fillEllipse() { return this; },
  };
  const scene = { add: {
    graphics: () => graphics,
    image: (x: number, y: number, key: string, frame: string) => {
      const image = { x, y, key, frame, scaleX: 1, scaleY: 1, originX: 0, originY: 0, destroyed: false,
        setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
        setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
        setScale(x: number, y = x) { this.scaleX = x; this.scaleY = y; return this; },
        setDepth() { return this; }, destroy() { this.destroyed = true; },
      };
      images.push(image);
      return image;
    },
  } } as unknown as Scene;
  const projection = new PerspectiveSystem();
  const view = new CourseView(scene, projection);
  const obstacles: Obstacle[] = [];
  for (const count of [3, 5, 7]) {
    const lanes = Array.from({ length: count }, (_, i) => -1.05 + (i + 0.5) * 2.1 / count);
    for (const type of OBSTACLE_IDS) {
      const span = OBSTACLE_DEFINITIONS[type].laneSpan;
      const width = span === "full" ? count : span;
      for (let start = 0; start <= count - width; start++) {
        const id = obstacles.length;
        obstacles.push(createObstacle(id, type, start, 1000 + id * 500, lanes));
      }
    }
  }
  for (let index = 0; index < obstacles.length; index++) {
    const obstacle = obstacles[index];
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    view.render(obstacle.distance - 600, [obstacle]);
    assert.equal(images.length, index + 1, "wide types still use exactly one image");
    const image = images[index];
    const farScale = image.scaleX;
    assert.equal(image.x, projection.project(obstacle.courseX, 600).x);
    view.render(obstacle.distance, [obstacle]);
    view.render(obstacle.distance, [obstacle]);
    assert.equal(images.length, index + 1, "unchanged frames reuse the image");
    assert.equal(image.key, definition.assetKey);
    assert.equal(image.frame, OBSTACLE_CONFIG.frameName);
    assert.deepEqual([image.originX, image.originY], [0.5, 1]);
    assert.equal(image.x, projection.project(obstacle.courseX, 0).x);
    assert.equal(image.y, projection.contactY);
    assert.ok(image.scaleX > farScale);
    assert.ok(Math.abs(image.scaleX * definition.assetFrame[2] - obstacle.visualWidth) < 1e-9);
    assert.ok(Math.abs(image.scaleY * definition.assetFrame[3] - obstacle.visualHeight) < 1e-9);
    if (index > 0) assert.equal(images[index - 1].destroyed, true);
  }
  view.reset();
  assert.ok(images.every(image => image.destroyed));
  view.render(0, []);
  assert.equal(images.length, obstacles.length);
});
