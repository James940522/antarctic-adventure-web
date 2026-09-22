import { GAME_SIZE, PLAYER_VIEW, RUN_CONFIG, SCENE_LAYOUT } from "../config/constants.ts";

export class PerspectiveSystem {
  readonly horizonY = GAME_SIZE.height * SCENE_LAYOUT.horizonRatio;
  readonly contactY = GAME_SIZE.height * SCENE_LAYOUT.playerYRatio + 34;
  readonly nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;

  project(courseX: number, relativeDistance: number) {
    const depth = Math.max(0, Math.min(1.25, 1 - relativeDistance / RUN_CONFIG.viewDistance));
    const scale = 0.08 + 0.92 * depth * depth;
    return {
      x: GAME_SIZE.width / 2 + courseX * this.nearHalfWidth * scale,
      y: this.horizonY + depth * depth * (this.contactY - this.horizonY),
      scale,
    };
  }
}
