import { PLAYER_CONFIG } from "../config/constants.ts";

/** One frame of acceleration, including the instant braking reaches the rising floor. */
export type SpeedMotion = {
  baseSpeed: number;
  extraSpeed: number;
  manualAcceleration: number;
  seconds: number;
};

export function sampleSpeed(motion: Readonly<SpeedMotion>, fraction = 1) {
  const seconds = motion.seconds * fraction;
  const manualSeconds = motion.manualAcceleration < 0
    ? Math.min(seconds, motion.extraSpeed / -motion.manualAcceleration) : seconds;
  const extraSpeed = Math.max(0, motion.extraSpeed + motion.manualAcceleration * manualSeconds);
  const baseSpeed = motion.baseSpeed + PLAYER_CONFIG.baseAcceleration * seconds;
  return {
    baseSpeed,
    speed: baseSpeed + extraSpeed,
    distance: motion.baseSpeed * seconds + PLAYER_CONFIG.baseAcceleration * seconds * seconds / 2
      + motion.extraSpeed * manualSeconds + motion.manualAcceleration * manualSeconds * manualSeconds / 2
      + extraSpeed * (seconds - manualSeconds),
  };
}

/** Convert swept distance to elapsed time, so collisions, pickups and jumps share one clock. */
export function speedTimeFraction(motion: Readonly<SpeedMotion>, distance: number): number {
  if (distance <= 0 || motion.seconds === 0) return 0;
  if (distance >= sampleSpeed(motion).distance) return 1;
  const manualSeconds = motion.manualAcceleration < 0
    ? Math.min(motion.seconds, motion.extraSpeed / -motion.manualAcceleration) : motion.seconds;
  const acceleration = PLAYER_CONFIG.baseAcceleration + motion.manualAcceleration;
  const startSpeed = motion.baseSpeed + motion.extraSpeed;
  const manualDistance = startSpeed * manualSeconds + acceleration * manualSeconds * manualSeconds / 2;
  // The stable quadratic form avoids subtracting nearly equal values at high speed.
  const travelTime = (speed: number, a: number, d: number) =>
    2 * d / (speed + Math.sqrt(Math.max(0, speed * speed + 2 * a * d)));
  const seconds = distance <= manualDistance
    ? travelTime(startSpeed, acceleration, distance)
    : manualSeconds + travelTime(motion.baseSpeed + PLAYER_CONFIG.baseAcceleration * manualSeconds,
      PLAYER_CONFIG.baseAcceleration, distance - manualDistance);
  return Math.min(1, seconds / motion.seconds);
}
