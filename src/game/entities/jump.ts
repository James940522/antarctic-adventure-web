import { PLAYER_CONFIG } from "../config/constants.ts";

/** Unclamped progress; a buffered jump may begin at progress 1 within this frame. */
export type JumpMotion = {
  startProgress: number;
  endProgress: number;
  restartAtLanding: boolean;
};

export function getFrameJumpProgress(motion: Readonly<JumpMotion>, fraction: number): number {
  const progress = motion.startProgress + (motion.endProgress - motion.startProgress) * fraction;
  return motion.restartAtLanding && progress >= 1 ? progress - 1 : progress;
}

export function getJumpHeight(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  return 4 * PLAYER_CONFIG.jumpHeight * progress * (1 - progress);
}
