import type { GameObjects, Scene } from "phaser";

import { GAME_SIZE, RUN_CONFIG } from "@/game/config/constants";
import type { BoxObstacle } from "@/game/systems/ObstacleSystem";
import { PerspectiveSystem } from "@/game/systems/PerspectiveSystem";

export class CourseView {
  private readonly scene: Scene;
  private readonly projection: PerspectiveSystem;
  private readonly marks: GameObjects.Graphics;
  private readonly ground: GameObjects.Graphics;
  private readonly views = new Map<number, { body: GameObjects.Container; border: GameObjects.Graphics }>();
  private readonly reducedMotion: boolean;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.scene = scene;
    this.projection = projection;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  render(distance: number, elapsedSeconds: number, boxes: readonly BoxObstacle[]): void {
    this.marks.clear();
    const spacing = 120;
    for (let world = Math.floor(distance / spacing) * spacing; world <= distance + RUN_CONFIG.viewDistance; world += spacing) {
      const relative = world - distance;
      for (const x of [-1.08, 1.08]) {
        const point = this.projection.project(x, relative);
        this.marks.fillStyle(0x4999b4, 0.7);
        this.marks.fillRect(point.x - 5 * point.scale, point.y, 10 * point.scale, 15 * point.scale);
      }
      const snow = this.projection.project(0, relative);
      this.marks.fillStyle(0xc9e5f0, 0.65);
      this.marks.fillEllipse(snow.x, snow.y, 12 * snow.scale, 3 * snow.scale);
    }

    const live = new Set<number>();
    for (const box of boxes) {
      live.add(box.id);
      let view = this.views.get(box.id);
      if (!view) {
        const size = RUN_CONFIG.boxSize;
        const art = this.scene.add.graphics();
        art.fillStyle(0x173b51, 0.2);
        art.fillEllipse(0, 4, size * 1.1, 15);
        art.fillStyle(box.color);
        art.fillRect(-size / 2, -size, size, size);
        art.lineStyle(4, 0x142a40);
        art.strokeRect(-size / 2, -size, size, size);
        art.lineStyle(5, 0x142a40, 0.85);
        art.lineBetween(-size / 2 + 15, -size + 17, size / 2 - 15, -17);
        art.lineBetween(size / 2 - 15, -size + 17, -size / 2 + 15, -17);
        const border = this.scene.add.graphics();
        border.lineStyle(2, 0xffffff);
        border.strokeRect(-size / 2 + 6, -size + 6, size - 12, size - 12);
        const body = this.scene.add.container(0, 0, [art, border]);
        view = { body, border };
        this.views.set(box.id, view);
      }
      const point = this.projection.project(box.courseX, box.distance - distance);
      view.body.setPosition(point.x, point.y).setScale(point.scale).setDepth(point.y);
      // Only the thin border breathes gently over four seconds; no color cycling.
      view.border.setAlpha(this.reducedMotion ? 0.9 : 0.85 + Math.sin(elapsedSeconds * Math.PI / 2) * 0.1);
    }
    for (const [id, view] of this.views) {
      if (!live.has(id)) { view.body.destroy(); this.views.delete(id); }
    }
  }

  reset(): void {
    for (const view of this.views.values()) view.body.destroy();
    this.views.clear();
  }
}
