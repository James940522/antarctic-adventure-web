import { SCORE_CONFIG } from "../config/constants.ts";

/** Final/estimated score from whole meters and the unrounded, time-weighted average. */
export function calculateScore(distanceMeters: number, averageSpeed: number): number {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(averageSpeed)
    || distanceMeters <= 0 || averageSpeed <= 0) return 0;
  return Math.round(Math.floor(distanceMeters) * averageSpeed / SCORE_CONFIG.referenceSpeed);
}
