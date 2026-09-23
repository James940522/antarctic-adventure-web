import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import type { PlayerState } from "../entities/Player.ts";
import { getFrameJumpProgress, getJumpHeight, type JumpMotion } from "../entities/jump.ts";
import type { Obstacle } from "./ObstacleSystem.ts";

export type ContactVolume = {
  courseX: number;
  distance: number;
  halfWidth: number;
  halfDepth: number;
  height: number;
};
export type ContactRange = readonly [start: number, end: number];

// Shared geometry for pickups and hazards; each caller decides what contact does.
// A range preserves the original jump arc when an effect changes mid-frame.
export function contactFraction(from: Readonly<PlayerState>, to: Readonly<PlayerState>, target: ContactVolume,
  jump?: Readonly<JumpMotion> | null, range: ContactRange = [0, 1]): number | null {
  let [enter, leave] = range;
  const clip = (start: number, end: number, min: number, max: number): boolean => {
    const change = end - start;
    if (change === 0) return start >= min && start <= max;
    const a = (min - start) / change;
    const b = (max - start) / change;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    return enter <= leave;
  };
  const halfWidth = target.halfWidth + PLAYER_CONFIG.collisionHalfWidth;
  if (!clip(from.distanceTravelled, to.distanceTravelled,
    target.distance - target.halfDepth, target.distance + target.halfDepth)) return null;
  if (!clip(from.courseX, to.courseX, target.courseX - halfWidth, target.courseX + halfWidth)) return null;
  if (jump) {
    // Solve the actual parabola inside the overlapping distance/X interval.
    // Endpoint interpolation would miss an entire short jump within one frame.
    const progressDelta = jump.endProgress - jump.startProgress;
    const progressAtEntry = getFrameJumpProgress(jump, enter);
    if (getJumpHeight(progressAtEntry) <= target.height) return enter;
    if (progressDelta <= 0) return null;
    const fallingProgress = (1 + Math.sqrt(1 - target.height / PLAYER_CONFIG.jumpHeight)) / 2;
    // If entry is in a buffered second arc, solve from that arc's progress.
    // An overlap spanning the landing still hits the first arc's ground contact.
    const landingContact = enter + (fallingProgress - progressAtEntry) / progressDelta;
    return landingContact <= leave ? landingContact : null;
  }
  if (!clip(from.jumpHeight, to.jumpHeight, -Infinity, target.height)) return null;
  return enter;
}

export function collisionFraction(from: Readonly<PlayerState>, to: Readonly<PlayerState>, obstacle: Obstacle,
  jump?: Readonly<JumpMotion> | null, range?: ContactRange): number | null {
  return contactFraction(from, to, {
    courseX: obstacle.courseX, distance: obstacle.distance,
    halfWidth: obstacle.collisionHalfWidth, halfDepth: RUN_CONFIG.collisionHalfDepth, height: obstacle.collisionHeight,
  }, jump, range);
}

export function firstCollision(from: Readonly<PlayerState>, to: Readonly<PlayerState>, obstacles: readonly Obstacle[],
  jump?: Readonly<JumpMotion> | null, range?: ContactRange, ignored?: ReadonlySet<number>) {
  let earliest: { fraction: number; obstacle: Obstacle } | null = null;
  for (const obstacle of obstacles) {
    if (ignored?.has(obstacle.id)) continue;
    const fraction = collisionFraction(from, to, obstacle, jump, range);
    if (fraction !== null && (!earliest || fraction < earliest.fraction)) earliest = { fraction, obstacle };
  }
  return earliest;
}
