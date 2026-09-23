import { GAME_SIZE, PLAYER_VIEW, RUN_CONFIG } from "../config/constants.ts";

export const OBSTACLE_IDS = ["snow-drift", "supply-crate", "ice-rock", "ice-hole", "crevasse", "seal"] as const;
export type ObstacleId = typeof OBSTACLE_IDS[number];
export type ObstacleDefinition = {
  id: ObstacleId;
  name: string;
  assetKey: string;
  assetPath: string;
  /** Main artwork, excluding transparent padding and faint stray pixels. */
  assetFrame: readonly [x: number, y: number, width: number, height: number];
  laneSpan: 1 | 2;
  collisionType: "solid" | "groundHazard";
  jumpable: true;
  visualScale: number;
  hitbox: { widthRatio: number; heightRatio: number };
  /** Contact-plane pixels and normalized course units, independent of viewport size. */
  visualWidth: number;
  visualHeight: number;
  collisionHalfWidth: number;
  collisionHeight: number;
};

export const OBSTACLE_CONFIG = {
  frameName: "artwork",
  initialClearMeters: 50,
  minGapMeters: 35,
  maxGapMeters: 55,
  wideExtraGapMeters: 10,
} as const;

const nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
const cellWidth = (RUN_CONFIG.lanes[1] - RUN_CONFIG.lanes[0]) * nearHalfWidth;
function defineObstacle(definition: Omit<ObstacleDefinition, "visualWidth" | "visualHeight" | "collisionHalfWidth" | "collisionHeight">): ObstacleDefinition {
  const visualWidth = cellWidth * definition.laneSpan * definition.visualScale;
  const visualHeight = visualWidth * definition.assetFrame[3] / definition.assetFrame[2];
  return {
    ...definition, visualWidth, visualHeight,
    collisionHalfWidth: visualWidth * definition.hitbox.widthRatio / (2 * nearHalfWidth),
    collisionHeight: definition.collisionType === "groundHazard" ? 0 : visualHeight * definition.hitbox.heightRatio,
  };
}

export const OBSTACLE_DEFINITIONS: Readonly<Record<ObstacleId, ObstacleDefinition>> = {
  "snow-drift": defineObstacle({
    id: "snow-drift", name: "눈더미", assetKey: "obstacle-snow-drift",
    assetPath: "/asset/img/obstacle/snow-drift.png", assetFrame: [47, 437, 1161, 502],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.72,
    hitbox: { widthRatio: 0.72, heightRatio: 0.5 },
  }),
  "supply-crate": defineObstacle({
    id: "supply-crate", name: "보급 상자", assetKey: "obstacle-supply-crate",
    assetPath: "/asset/img/obstacle/supply-crate.png", assetFrame: [89, 352, 1073, 797],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.72,
    hitbox: { widthRatio: 0.8, heightRatio: 0.75 },
  }),
  "ice-rock": defineObstacle({
    id: "ice-rock", name: "빙설 바위", assetKey: "obstacle-ice-rock",
    assetPath: "/asset/img/obstacle/ice-rock.png", assetFrame: [88, 275, 1081, 797],
    laneSpan: 1, collisionType: "solid", jumpable: true, visualScale: 0.76,
    hitbox: { widthRatio: 0.72, heightRatio: 0.68 },
  }),
  "ice-hole": defineObstacle({
    id: "ice-hole", name: "해빙 구멍", assetKey: "obstacle-ice-hole",
    assetPath: "/asset/img/obstacle/ice-hole.png", assetFrame: [95, 343, 1073, 736],
    laneSpan: 1, collisionType: "groundHazard", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.58, heightRatio: 0 },
  }),
  crevasse: defineObstacle({
    id: "crevasse", name: "크레바스", assetKey: "obstacle-crevasse",
    assetPath: "/asset/img/obstacle/crevasse.png", assetFrame: [123, 184, 1008, 923],
    laneSpan: 2, collisionType: "groundHazard", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.66, heightRatio: 0 },
  }),
  seal: defineObstacle({
    id: "seal", name: "잠자는 물개", assetKey: "obstacle-seal",
    assetPath: "/asset/img/obstacle/seal.png", assetFrame: [19, 391, 1215, 609],
    laneSpan: 2, collisionType: "solid", jumpable: true, visualScale: 0.8,
    hitbox: { widthRatio: 0.82, heightRatio: 0.58 },
  }),
};
