import type { GameObjects, Scene } from "phaser";

import { GAME_SIZE, RUN_CONFIG } from "../config/constants.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS } from "../data/obstacles.ts";
import type { Obstacle } from "./ObstacleSystem.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";

export class CourseView {
  private readonly scene: Scene;
  private readonly projection: PerspectiveSystem;
  private readonly marks: GameObjects.Graphics;
  private readonly ground: GameObjects.Graphics;
  private readonly views = new Map<number, { body: GameObjects.Image; lastSeen: number }>();
  private readonly hitboxes?: GameObjects.Graphics;
  private renderTick = 0;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.scene = scene;
    this.projection = projection;
    if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("debugObstacles") === "1") {
      this.hitboxes = scene.add.graphics().setDepth(999);
    }
    this.ground = scene.add.graphics().setDepth(1);
    this.marks = scene.add.graphics().setDepth(2);
    this.resize();
  }

  resize(): void {
    const { ground, projection } = this;
    ground.clear();
    const farLeft = projection.project(-1.1, RUN_CONFIG.viewDistance);
    const farRight = projection.project(1.1, RUN_CONFIG.viewDistance);
    const bottomLeft = projection.project(-1.1, -160);
    const bottomRight = projection.project(1.1, -160);
    ground.fillStyle(0xe6f4fa);
    ground.fillTriangle(0, farLeft.y, farLeft.x, farLeft.y, 0, projection.height);
    ground.fillTriangle(farRight.x, farRight.y, GAME_SIZE.width, farRight.y, GAME_SIZE.width, projection.height);
    ground.lineStyle(2, 0x91cadd, 0.7);
    ground.lineBetween(farLeft.x, farLeft.y, bottomLeft.x, bottomLeft.y);
    ground.lineBetween(farRight.x, farRight.y, bottomRight.x, bottomRight.y);
  }

  render(distance: number, obstacles: readonly Obstacle[]): void {
    this.marks.clear();
    const spacing = 120;
    for (let world = Math.floor(distance / spacing) * spacing; world <= distance + RUN_CONFIG.viewDistance; world += spacing) {
      const relative = world - distance;
      for (let x = -1.08; x <= 1.08; x += 2.16) {
        const point = this.projection.project(x, relative);
        this.marks.fillStyle(0x4999b4, 0.7);
        this.marks.fillRect(point.x - 5 * point.scale, point.y, 10 * point.scale, 15 * point.scale);
      }
      const snow = this.projection.project(0, relative);
      this.marks.fillStyle(0xc9e5f0, 0.65);
      this.marks.fillEllipse(snow.x, snow.y, 12 * snow.scale, 3 * snow.scale);
    }

    this.renderTick++;
    this.hitboxes?.clear();
    for (const obstacle of obstacles) {
      const definition = OBSTACLE_DEFINITIONS[obstacle.type];
      let view = this.views.get(obstacle.id);
      if (!view) {
        const body = this.scene.add.image(0, 0, definition.assetKey, OBSTACLE_CONFIG.frameName).setOrigin(0.5, 1);
        view = { body, lastSeen: this.renderTick };
        this.views.set(obstacle.id, view);
      }
      view.lastSeen = this.renderTick;
      const point = this.projection.project(obstacle.courseX, obstacle.distance - distance);
      view.body.setPosition(point.x, point.y)
        .setScale(point.scale * definition.visualWidth / definition.assetFrame[2]).setDepth(point.y);
      if (this.hitboxes) this.drawHitbox(obstacle, distance);
    }
    for (const [id, view] of this.views) {
      if (view.lastSeen !== this.renderTick) { view.body.destroy(); this.views.delete(id); }
    }
  }

  private drawHitbox(obstacle: Obstacle, distance: number): void {
    const graphics = this.hitboxes!;
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    const left = obstacle.courseX - definition.collisionHalfWidth;
    const right = obstacle.courseX + definition.collisionHalfWidth;
    const relative = obstacle.distance - distance;
    const farLeft = this.projection.project(left, relative + RUN_CONFIG.collisionHalfDepth);
    const farRight = this.projection.project(right, relative + RUN_CONFIG.collisionHalfDepth);
    const nearLeft = this.projection.project(left, relative - RUN_CONFIG.collisionHalfDepth);
    const nearRight = this.projection.project(right, relative - RUN_CONFIG.collisionHalfDepth);
    graphics.lineStyle(2, definition.collisionType === "groundHazard" ? 0xffb347 : 0xe03569, 0.9);
    graphics.beginPath();
    graphics.moveTo(farLeft.x, farLeft.y);
    graphics.lineTo(farRight.x, farRight.y);
    graphics.lineTo(nearRight.x, nearRight.y);
    graphics.lineTo(nearLeft.x, nearLeft.y);
    graphics.closePath();
    graphics.strokePath();
    const height = definition.collisionHeight * nearLeft.scale;
    if (height > 0) graphics.strokeRect(nearLeft.x, nearLeft.y - height, nearRight.x - nearLeft.x, height);
  }

  reset(): void {
    for (const view of this.views.values()) view.body.destroy();
    this.views.clear();
    this.hitboxes?.clear();
  }
}
