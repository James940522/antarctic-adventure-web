import { GAME_SIZE, PLAYER_VIEW, RUN_CONFIG, SCENE_LAYOUT } from "../config/constants.ts";

export class PerspectiveSystem {
  readonly nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  height: number;
  // Visibility/spawn horizon only. Speed must never rescale the existing world.
  viewDistance: number = RUN_CONFIG.viewDistance;

  constructor(height: number = GAME_SIZE.height) {
    this.height = height;
  }

  get horizonY(): number { return this.height * SCENE_LAYOUT.horizonRatio; }
  get contactY(): number { return this.height * SCENE_LAYOUT.playerYRatio + 34; }

  project(courseX: number, relativeDistance: number) {
    const linearDepth = 1 - relativeDistance / RUN_CONFIG.viewDistance;
    // Keep the familiar near-field curve. A tangent-matched reciprocal tail lets
    // high-speed lookahead extend beyond 120m without moving visible objects.
    const tailDepth = 0.2;
    const depth = Math.min(1.25, linearDepth >= tailDepth ? linearDepth
      : tailDepth * tailDepth / (2 * tailDepth - linearDepth));
    const scale = 0.08 + 0.92 * depth * depth;
    return {
      x: GAME_SIZE.width / 2 + courseX * this.nearHalfWidth * scale,
      y: this.horizonY + depth * depth * (this.contactY - this.horizonY),
      scale,
    };
  }
}
