import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import type { PlayerState } from "../entities/Player.ts";
import type { BoxObstacle } from "./ObstacleSystem.ts";

// Intersect a motion segment with each logical collision slab, including height.
// This catches both passing through a row and steering into one during a frame.
export function collisionFraction(from: Readonly<PlayerState>, to: Readonly<PlayerState>, box: BoxObstacle): number | null {
  let enter = 0;
  let leave = 1;
  const clip = (start: number, end: number, min: number, max: number): boolean => {
    const change = end - start;
    if (change === 0) return start >= min && start <= max;
    const a = (min - start) / change;
    const b = (max - start) / change;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    return enter <= leave;
  };
  const halfWidth = RUN_CONFIG.boxHalfWidth + PLAYER_CONFIG.collisionHalfWidth;
  if (!clip(from.distanceTravelled, to.distanceTravelled,
    box.distance - RUN_CONFIG.collisionHalfDepth, box.distance + RUN_CONFIG.collisionHalfDepth)) return null;
  if (!clip(from.courseX, to.courseX, box.courseX - halfWidth, box.courseX + halfWidth)) return null;
  if (!clip(from.jumpHeight, to.jumpHeight, -Infinity, RUN_CONFIG.boxSize)) return null;
  return enter;
}

export function firstCollision(from: Readonly<PlayerState>, to: Readonly<PlayerState>, boxes: readonly BoxObstacle[]) {
  let earliest: { fraction: number; box: BoxObstacle } | null = null;
  for (const box of boxes) {
    const fraction = collisionFraction(from, to, box);
    if (fraction !== null && (!earliest || fraction < earliest.fraction)) earliest = { fraction, box };
  }
  return earliest;
}
