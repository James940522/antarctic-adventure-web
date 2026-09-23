import { GAME_SIZE, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";

export const OBSTACLE_IDS = [
  "snow-drift", "supply-crate", "ice-rock", "ice-hole", "crevasse", "seal",
  "ice-spikes", "fuel-drums", "broken-sled", "fallen-antenna", "ice-patch", "snow-fence", "barricade",
] as const;
export type ObstacleLaneSpan = 1 | 2 | "full";
export type ObstacleId = typeof OBSTACLE_IDS[number];
export type ObstacleDefinition = {
  id: ObstacleId;
  name: string;
  assetKey: string;
  assetPath: string;
  /** Main artwork, excluding transparent padding and faint stray pixels. */
  assetFrame: readonly [x: number, y: number, width: number, height: number];
  laneSpan: ObstacleLaneSpan;
  collisionType: "solid" | "groundHazard";
  jumpable: true;
  visualScale: number;
  hitbox: { widthRatio: number; heightRatio: number };
  /** Optional clearance independent of tall decorative artwork. */
  requiredJumpHeight?: number;
};

export const OBSTACLE_CONFIG = {
  frameName: "artwork",
  initialClearMeters: 50,
  minGapMeters: 35,
  maxGapMeters: 55,
  wideExtraGapMeters: 10,
  barricadeExtraGapMeters: 20,
  barricadeMinOtherObstacles: 3,
  maxCollisionHeight: 80, // Also keeps wider lanes jumpable when lane count changes.
  // 18 / 10 / 2 slots: 60% single, 33.3% wide, 6.7% full.
  spanBag: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, "full", "full"],
  minStaggerMeters: 6,
  maxStaggerMeters: 12,
  escapeSpeedMetersPerSecond: 30,
  escapeReactionSeconds: 0.35,
  densityStages: [
    { fromMeters: 0, maxObstacles: 2 },
    { fromMeters: 2000, maxObstacles: 3 },
    { fromMeters: 5000, maxObstacles: 4 },
  ],
} as const;

export function occupiedLanesFor(span: ObstacleLaneSpan, startLane: number, laneCount: number = RUN_CONFIG.lanes.length): readonly number[] {
  const count = span === "full" ? laneCount : span;
  if (!Number.isInteger(startLane) || count < 1 || startLane < 0 || startLane + count > laneCount
    || (span === "full" && startLane !== 0)) throw new RangeError("Invalid obstacle lane placement");
  return Array.from({ length: count }, (_, index) => startLane + index);
}

/** One geometry source for spawning, sprites, contact volumes, items and debug. */
export function obstacleGeometry(definition: ObstacleDefinition, occupiedLanes: readonly number[], lanes: readonly number[] = RUN_CONFIG.lanes) {
  const first = occupiedLanes[0], last = occupiedLanes.at(-1)!;
  if (first === undefined || last >= lanes.length || first < 0
    || occupiedLanes.some((lane, index) => lane !== first + index)) throw new RangeError("Expected adjacent occupied lanes");
  const laneWidth = lanes.length > 1 ? lanes[1] - lanes[0] : 2;
  const occupiedWidth = lanes[last] - lanes[first] + laneWidth;
  const courseX = (lanes[first] + lanes[last]) / 2;
  const nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
  const visualWidth = occupiedWidth * nearHalfWidth * definition.visualScale;
  const visualHeight = visualWidth * definition.assetFrame[3] / definition.assetFrame[2];
  return {
    courseX, occupiedWidth, visualWidth, visualHeight,
    // Full barriers cover the complete track, including the player's ±1 edge positions.
    collisionHalfWidth: definition.laneSpan === "full" ? occupiedWidth / 2
      : occupiedWidth * definition.visualScale * definition.hitbox.widthRatio / 2,
    collisionHeight: definition.collisionType === "groundHazard" ? 0
      : Math.min(OBSTACLE_CONFIG.maxCollisionHeight, definition.requiredJumpHeight ?? visualHeight * definition.hitbox.heightRatio),
  };
}

export const OBSTACLE_DEFINITIONS: Readonly<Record<ObstacleId, ObstacleDefinition>> = {
  "snow-drift": {
    id: "snow-drift", name: "눈더미", assetKey: "obstacle-snow-drift",
    assetPath: "/asset/img/obstacle/snow-drift.png", assetFrame: [47, 437, 1161, 502],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.72,
    hitbox: { widthRatio: 0.72, heightRatio: 0.5 },
  },
  "supply-crate": {
    id: "supply-crate", name: "보급 상자", assetKey: "obstacle-supply-crate",
    assetPath: "/asset/img/obstacle/supply-crate.png", assetFrame: [89, 352, 1073, 797],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.72,
    hitbox: { widthRatio: 0.8, heightRatio: 0.75 },
  },
  "ice-rock": {
    id: "ice-rock", name: "빙설 바위", assetKey: "obstacle-ice-rock",
    assetPath: "/asset/img/obstacle/ice-rock.png", assetFrame: [88, 275, 1081, 797],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.76,
    hitbox: { widthRatio: 0.72, heightRatio: 0.68 },
  },
  "ice-hole": {
    id: "ice-hole", name: "해빙 구멍", assetKey: "obstacle-ice-hole",
    assetPath: "/asset/img/obstacle/ice-hole.png", assetFrame: [95, 343, 1073, 736],
    laneSpan: 1, collisionType: "groundHazard", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.58, heightRatio: 0 },
  },
  crevasse: {
    id: "crevasse", name: "크레바스", assetKey: "obstacle-crevasse",
    assetPath: "/asset/img/obstacle/crevasse.png", assetFrame: [123, 184, 1008, 923],
    laneSpan: 2, collisionType: "groundHazard", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.66, heightRatio: 0 },
  },
  seal: {
    id: "seal", name: "잠자는 물개", assetKey: "obstacle-seal",
    assetPath: "/asset/img/obstacle/seal.png", assetFrame: [19, 391, 1215, 609],
    laneSpan: 2, collisionType: "solid", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.82, heightRatio: 0.58 },
  },
  "ice-spikes": {
    id: "ice-spikes", name: "얼음 송곳", assetKey: "obstacle-ice-spikes",
    assetPath: "/asset/img/obstacle/ice-spikes.png", assetFrame: [117, 241, 1053, 901],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.76,
    hitbox: { widthRatio: 0.68, heightRatio: 0.65 },
  },
  "fuel-drums": {
    id: "fuel-drums", name: "연료 드럼통", assetKey: "obstacle-fuel-drums",
    assetPath: "/asset/img/obstacle/fuel-drums.png", assetFrame: [59, 263, 1135, 868],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.82, heightRatio: 0.75 },
  },
  "broken-sled": {
    id: "broken-sled", name: "부서진 원정 썰매", assetKey: "obstacle-broken-sled",
    assetPath: "/asset/img/obstacle/broken-sled.png", assetFrame: [19, 522, 1219, 514],
    laneSpan: 2, collisionType: "solid", jumpable: true, visualScale: 0.88,
    hitbox: { widthRatio: 0.78, heightRatio: 0.62 },
  },
  "fallen-antenna": {
    id: "fallen-antenna", name: "추락 통신 안테나", assetKey: "obstacle-fallen-antenna",
    assetPath: "/asset/img/obstacle/fallen-antenna.png", assetFrame: [19, 423, 1216, 567],
    laneSpan: 2, collisionType: "solid", jumpable: true, visualScale: 0.88,
    hitbox: { widthRatio: 0.78, heightRatio: 0.6 },
  },
  "ice-patch": {
    id: "ice-patch", name: "미끄러운 빙판", assetKey: "obstacle-ice-patch",
    assetPath: "/asset/img/obstacle/ice-patch.png", assetFrame: [35, 614, 1184, 375],
    laneSpan: 1, collisionType: "groundHazard", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.66, heightRatio: 0 },
  },
  "snow-fence": {
    id: "snow-fence", name: "방풍 울타리", assetKey: "obstacle-snow-fence",
    assetPath: "/asset/img/obstacle/snow-fence.png", assetFrame: [29, 489, 1205, 467],
    laneSpan: 2, collisionType: "solid", jumpable: true, visualScale: 0.88,
    hitbox: { widthRatio: 0.9, heightRatio: 0.65 },
  },
  "barricade": {
    id: "barricade", name: "바리케이드", assetKey: "obstacle-barricade",
    assetPath: "/asset/img/obstacle/barricade.png", assetFrame: [3, 512, 1248, 458],
    laneSpan: "full", collisionType: "solid", jumpable: true, visualScale: 1.04,
    hitbox: { widthRatio: 1, heightRatio: 0.22 }, requiredJumpHeight: 72,
  },
};
