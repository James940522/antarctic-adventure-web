import type { GameObjects, Scene } from "phaser";

import { LANDMARK_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import type { LandmarkDefinition } from "../data/landmarks.ts";
import { PerspectiveSystem } from "./PerspectiveSystem.ts";
import type { LandmarkRenderer } from "./LandmarkSystem.ts";

export function projectLandmark(projection: PerspectiveSystem, landmark: LandmarkDefinition, remainingMeters: number) {
  const point = projection.project(
    landmark.lateralPosition * LANDMARK_CONFIG.shoulderPosition,
    remainingMeters / landmark.approachDistance * RUN_CONFIG.viewDistance,
  );
  const size = LANDMARK_CONFIG.sizes[landmark.size];
  const [, , width, height] = landmark.assetFrame;
  return {
    ...point,
    scale: point.scale * Math.min(size.width / width, size.maxHeight / height),
    alpha: Math.max(0, Math.min(1, 1 + remainingMeters / LANDMARK_CONFIG.exitDistance)),
    originX: landmark.lateralPosition < 0 ? 1 : 0,
  };
}

export class LandmarkView implements LandmarkRenderer {
  private readonly scene: Scene;
  private readonly projection: PerspectiveSystem;
  private sprite?: GameObjects.Image;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.scene = scene;
    this.projection = projection;
  }

  render(landmark: LandmarkDefinition, remainingMeters: number): void {
    if (!this.scene.textures.exists(landmark.assetKey)) return; // Optional art failure cannot end a run.
    const point = projectLandmark(this.projection, landmark, remainingMeters);
    this.sprite ??= this.scene.add.image(0, 0, landmark.assetKey, LANDMARK_CONFIG.frameName);
    this.sprite.setPosition(point.x, point.y)
      .setOrigin(point.originX, 1).setScale(point.scale).setAlpha(point.alpha)
      .setDepth(point.y);
  }

  clear(): void {
    this.sprite?.destroy();
    this.sprite = undefined;
  }
}
