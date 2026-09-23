import { PLAYER_CONFIG } from "../config/constants.ts";

/** Unclamped progress across one frame, including any time after landing. */
export type JumpMotion = { startProgress: number; endProgress: number };

export function getJumpDurationSeconds(speed: number): number {
  return Math.min(PLAYER_CONFIG.jumpDurationSeconds, PLAYER_CONFIG.jumpMaxDistance / speed);
}

export function getJumpHeight(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  return 4 * PLAYER_CONFIG.jumpHeight * progress * (1 - progress);
}
