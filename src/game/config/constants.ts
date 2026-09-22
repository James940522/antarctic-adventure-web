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
  snapshot: "antarctic:snapshot",
  restart: "antarctic:restart",
} as const;

export const INPUT_CONFIG = {
  gamepadDeadzone: 0.18,
  debugRefreshMs: 100,
} as const;

export const PLAYER_CONFIG = {
  courseLimit: 1,
  lateralSpeed: 1.4, // Normalized course units / second.
  speeds: [140, 220, 320],
  gearAxisThreshold: 0.5,
  collisionHalfWidth: 0.06,
  jumpDurationSeconds: 0.8,
  jumpHeight: 100,
  maxDeltaMs: 50,
} as const;

export const PLAYER_VIEW = {
  screenMargin: 64, // Includes flippers, shadow, and running sway at either edge.
  strideDistance: 60,
} as const;

export const RUN_CONFIG = {
  unitsPerMeter: 10,
  viewDistance: 1200,
  firstRowDistance: 900,
  rowSpacing: 320,
  difficultyDistance: 1200,
  lanes: [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9],
  laneJitter: 0.025,
  boxSize: 72,
  boxHalfWidth: 72 / (2 * (GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin)),
  collisionHalfDepth: 20,
  reactionSeconds: 0.35,
  colors: [0xff3ab4, 0xdfff00, 0x00efd5, 0xb18aff, 0xff982f],
  hudRefreshMs: 100,
  recordKey: "antarctic-adventure:best-distance:v1",
} as const;
