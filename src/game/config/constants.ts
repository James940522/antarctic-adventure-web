export const GAME_SIZE = {
  width: 960,
  height: 540,
} as const;

export const SCENE_LAYOUT = {
  horizonRatio: 0.34,
  playerYRatio: 0.82,
} as const;

export const GAME_EVENTS = {
  ready: "antarctic:ready",
  error: "antarctic:error",
} as const;

export const INPUT_CONFIG = {
  gamepadDeadzone: 0.18,
  debugRefreshMs: 100,
} as const;

export const PLAYER_CONFIG = {
  courseLimit: 1,
  lateralSpeed: 1.4, // Normalized course units / second.
  minSpeed: 40,
  initialSpeed: 140,
  maxSpeed: 320,
  acceleration: 100,
  deceleration: 160,
  jumpDurationSeconds: 0.8,
  jumpHeight: 100,
  maxDeltaMs: 50,
} as const;

export const PLAYER_VIEW = {
  screenMargin: 64, // Includes flippers, shadow, and running sway at either edge.
  strideDistance: 60,
} as const;
