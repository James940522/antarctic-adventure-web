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
  restarted: "antarctic:restarted",
  pause: "antarctic:pause",
  landmarkArrived: "antarctic:landmark-arrived",
} as const;

export const INPUT_CONFIG = {
  gamepadDeadzone: 0.18,
  debugRefreshMs: 100,
} as const;

export const PLAYER_CONFIG = {
  courseLimit: 1,
  lateralSpeed: 1.4, // Normalized course units / second.
  baseSpeed: 140, // Initial world units / second (14 m/s).
  baseAcceleration: 0.1, // World units / second²: +0.6 m/s per minute of active driving.
  manualAcceleration: 80, // Held up/down changes the manual offset by 8 m/s per second.
  speedAxisThreshold: 0.5,
  collisionHalfWidth: 0.06,
  jumpDurationSeconds: 0.8, // Keep the same readable arc at every running speed.
  jumpBufferSeconds: 0.12, // A fresh press just before landing starts the next jump.
  jumpHeight: 150,
  maxDeltaMs: 50,
} as const;

export const PLAYER_VIEW = {
  screenMargin: 64, // Includes flippers, shadow, and running sway at either edge.
  strideDistance: 60,
  turnSeconds: 0.35,
  centerSeconds: 0.5,
  cheerBounceHeight: 9,
  cheerBounceSeconds: 0.65,
} as const;

export const RUN_CONFIG = {
  unitsPerMeter: 10,
  viewDistance: 1200,
  lanes: [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9],
  collisionHalfDepth: 16, // 1.6m on each side, matching the smaller obstacle artwork.
  hudRefreshMs: 100,
  recordKey: "antarctic-adventure:best-run:v2",
  legacyRecordKey: "antarctic-adventure:best-distance:v1",
} as const;

export const SCORE_CONFIG = {
  referenceSpeed: 14, // m/s: 1m at the starting speed is worth 1 point.
} as const;

export const LANDMARK_CONFIG = {
  frameName: "artwork",
  celebrationSeconds: 2.5,
  fadeSeconds: 0.35,
  arrivalSetback: 46, // Artwork stands just behind the penguin's feet.
  clearLeadMeters: 20, // Clear old boxes before the centered artwork appears.
  departureClearMeters: 160, // Beyond the 120m view: no boxes peek through the destination.
  sizes: {
    small: { width: 440, maxHeight: 300 },
    medium: { width: 640, maxHeight: 320 },
    major: { width: 720, maxHeight: 340 },
  },
} as const;
