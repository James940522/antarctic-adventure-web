import assert from "node:assert/strict";
import test from "node:test";
import type { Scene } from "phaser";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "../data/obstacles.ts";
import { CourseView } from "./CourseView.ts";
import type { Obstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";

test("each type renders one preloaded image, keeps its aspect ratio, and reuses then releases its view", () => {
  const images: Array<{ key: string; frame: string; x: number; y: number; scale: number; originX: number; originY: number; destroyed: boolean }> = [];
  const graphics = {
    clear() { return this; }, setDepth() { return this; }, fillStyle() { return this; },
    fillTriangle() { return this; }, lineStyle() { return this; }, lineBetween() { return this; },
    fillRect() { return this; }, fillEllipse() { return this; },
  };
  const scene = { add: {
    graphics: () => graphics,
    image: (x: number, y: number, key: string, frame: string) => {
      const image = { x, y, key, frame, scale: 1, originX: 0, originY: 0, destroyed: false,
        setOrigin(x: number, y: number) { this.originX = x; this.originY = y; return this; },
        setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
        setScale(scale: number) { this.scale = scale; return this; },
        setDepth() { return this; }, destroy() { this.destroyed = true; },
      };
      images.push(image);
      return image;
    },
  } } as unknown as Scene;
  const projection = new PerspectiveSystem();
  const view = new CourseView(scene, projection);
  const obstacles: Obstacle[] = OBSTACLE_IDS.map((type, id) => ({ id, type, startLane: 3, courseX: 0, distance: 1000 + id * 500 }));
  for (let index = 0; index < obstacles.length; index++) {
    const obstacle = obstacles[index];
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    view.render(obstacle.distance - 600, [obstacle]);
    assert.equal(images.length, index + 1, "wide types still use exactly one image");
    const image = images[index];
    const farScale = image.scale;
    view.render(obstacle.distance, [obstacle]);
    view.render(obstacle.distance, [obstacle]);
    assert.equal(images.length, index + 1, "unchanged frames reuse the image");
    assert.equal(image.key, definition.assetKey);
    assert.equal(image.frame, OBSTACLE_CONFIG.frameName);
    assert.deepEqual([image.originX, image.originY], [0.5, 1]);
    assert.equal(image.y, projection.contactY);
    assert.ok(image.scale > farScale);
    assert.ok(Math.abs(image.scale * definition.assetFrame[2] - definition.visualWidth) < 1e-9);
    assert.ok(Math.abs(image.scale * definition.assetFrame[3] - definition.visualHeight) < 1e-9);
    if (index > 0) assert.equal(images[index - 1].destroyed, true);
  }
  view.reset();
  assert.ok(images.every(image => image.destroyed));
  view.render(0, []);
  assert.equal(images.length, 6);
});
