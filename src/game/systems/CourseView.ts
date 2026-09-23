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
  private readonly views = new Map<number, { body: GameObjects.Image; label?: GameObjects.Text; lastSeen: number }>();
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
    const farLeft = projection.project(-1.1, this.projection.viewDistance);
    const farRight = projection.project(1.1, this.projection.viewDistance);
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
    const spacing = Math.max(120, this.projection.viewDistance / 64);
    for (let world = Math.floor(distance / spacing) * spacing; world <= distance + this.projection.viewDistance; world += spacing) {
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
      if (obstacle.distance - distance > this.projection.viewDistance) continue;
      const definition = OBSTACLE_DEFINITIONS[obstacle.type];
      let view = this.views.get(obstacle.id);
      if (!view) {
        const body = this.scene.add.image(0, 0, definition.assetKey, OBSTACLE_CONFIG.frameName).setOrigin(0.5, 1);
        const label = this.hitboxes ? this.scene.add.text(0, 0,
          `${obstacle.type} · span ${definition.laneSpan} · lanes [${obstacle.occupiedLanes.join(",")}]`,
          { fontSize: "11px", color: "#ffffff", backgroundColor: "#173b51", padding: { x: 3, y: 2 } })
          .setOrigin(0.5, 1).setDepth(1000) : undefined;
        view = { body, label, lastSeen: this.renderTick };
        this.views.set(obstacle.id, view);
      }
      view.lastSeen = this.renderTick;
      const point = this.projection.project(obstacle.courseX, obstacle.distance - distance);
      view.body.setPosition(point.x, point.y)
        .setScale(point.scale * obstacle.visualWidth / definition.assetFrame[2],
          point.scale * obstacle.visualHeight / definition.assetFrame[3]).setDepth(point.y);
      view.label?.setPosition(point.x, point.y - point.scale * obstacle.visualHeight - 4);
      if (this.hitboxes) this.drawHitbox(obstacle, distance);
    }
    for (const [id, view] of this.views) {
      if (view.lastSeen !== this.renderTick) { view.body.destroy(); view.label?.destroy(); this.views.delete(id); }
    }
  }

  private drawHitbox(obstacle: Obstacle, distance: number): void {
    const graphics = this.hitboxes!;
    const definition = OBSTACLE_DEFINITIONS[obstacle.type];
    const left = obstacle.courseX - obstacle.collisionHalfWidth;
    const right = obstacle.courseX + obstacle.collisionHalfWidth;
    const relative = obstacle.distance - distance;
    const point = this.projection.project(obstacle.courseX, relative);
    graphics.lineStyle(1, 0x28c6ef, 0.9);
    graphics.strokeRect(point.x - obstacle.visualWidth * point.scale / 2, point.y - obstacle.visualHeight * point.scale,
      obstacle.visualWidth * point.scale, obstacle.visualHeight * point.scale);
    const laneWidth = obstacle.occupiedWidth / obstacle.occupiedLanes.length;
    graphics.lineStyle(1, 0xa9d948, 0.9);
    for (let index = 0; index <= obstacle.occupiedLanes.length; index++) {
      const x = obstacle.courseX - obstacle.occupiedWidth / 2 + index * laneWidth;
      const far = this.projection.project(x, relative + RUN_CONFIG.collisionHalfDepth);
      const near = this.projection.project(x, relative - RUN_CONFIG.collisionHalfDepth);
      graphics.lineBetween(far.x, far.y, near.x, near.y);
      if (index < obstacle.occupiedLanes.length) {
        const next = this.projection.project(x + laneWidth, relative);
        const start = this.projection.project(x, relative);
        graphics.lineBetween(start.x, start.y, next.x, next.y);
      }
    }
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
    const height = obstacle.collisionHeight * nearLeft.scale;
    if (height > 0) graphics.strokeRect(nearLeft.x, nearLeft.y - height, nearRight.x - nearLeft.x, height);
  }

  reset(): void {
    for (const view of this.views.values()) { view.body.destroy(); view.label?.destroy(); }
    this.views.clear();
    this.hitboxes?.clear();
  }
}
