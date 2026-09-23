import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import type { PlayerState } from "../entities/Player.ts";
import { getFrameJumpProgress, getJumpHeight, type JumpMotion } from "../entities/jump.ts";
import { OBSTACLE_DEFINITIONS } from "../data/obstacles.ts";
import type { Obstacle } from "./ObstacleSystem.ts";

// Intersect a motion segment with each logical collision slab, including height.
// This catches both passing through a row and steering into one during a frame.
export function collisionFraction(from: Readonly<PlayerState>, to: Readonly<PlayerState>, obstacle: Obstacle, jump?: Readonly<JumpMotion> | null): number | null {
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
  const definition = OBSTACLE_DEFINITIONS[obstacle.type];
  const halfWidth = definition.collisionHalfWidth + PLAYER_CONFIG.collisionHalfWidth;
  if (!clip(from.distanceTravelled, to.distanceTravelled,
    obstacle.distance - RUN_CONFIG.collisionHalfDepth, obstacle.distance + RUN_CONFIG.collisionHalfDepth)) return null;
  if (!clip(from.courseX, to.courseX, obstacle.courseX - halfWidth, obstacle.courseX + halfWidth)) return null;
  if (jump) {
    // Solve the actual parabola inside the overlapping distance/X interval.
    // Endpoint interpolation would miss an entire short jump within one frame.
    const progressDelta = jump.endProgress - jump.startProgress;
    const progressAtEntry = getFrameJumpProgress(jump, enter);
    if (getJumpHeight(progressAtEntry) <= definition.collisionHeight) return enter;
    if (progressDelta <= 0) return null;
    const fallingProgress = (1 + Math.sqrt(1 - definition.collisionHeight / PLAYER_CONFIG.jumpHeight)) / 2;
    // If entry is in a buffered second arc, solve from that arc's progress.
    // An overlap spanning the landing still hits the first arc's ground contact.
    const landingContact = enter + (fallingProgress - progressAtEntry) / progressDelta;
    return landingContact <= leave ? landingContact : null;
  }
  if (!clip(from.jumpHeight, to.jumpHeight, -Infinity, definition.collisionHeight)) return null;
  return enter;
}

export function firstCollision(from: Readonly<PlayerState>, to: Readonly<PlayerState>, obstacles: readonly Obstacle[], jump?: Readonly<JumpMotion> | null) {
  let earliest: { fraction: number; obstacle: Obstacle } | null = null;
  for (const obstacle of obstacles) {
    const fraction = collisionFraction(from, to, obstacle, jump);
    if (fraction !== null && (!earliest || fraction < earliest.fraction)) earliest = { fraction, obstacle };
  }
  return earliest;
}
