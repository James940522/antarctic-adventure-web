import { LANDMARK_CONFIG } from "../config/constants.ts";

export type LandmarkSize = "small" | "medium" | "major";

export type LandmarkDefinition = {
  id: string;
  name: string;
  nameEn: string;
  size: LandmarkSize;
  /** Absolute distance from the start, in meters (not world units). */
  distance: number;
  approachDistance: number;
  assetKey: string;
  assetPath: string;
  /** Visible artwork bounds; Phaser trims transparent padding without editing the PNG. */
  assetFrame: readonly [x: number, y: number, width: number, height: number];
};

export const LANDMARKS: readonly LandmarkDefinition[] = [
  {
    id: "weather-marker", name: "기상 관측 표지", nameEn: "Weather Marker",
    size: "small", distance: 10_000, approachDistance: 300,
    assetKey: "landmark-weather-marker",
    assetPath: "/asset/img/landmark-weather-marker.png",
    assetFrame: [295, 139, 665, 979],
  },
  {
    id: "penguin-colony", name: "펭귄 군락", nameEn: "Penguin Colony",
    size: "small", distance: 20_000, approachDistance: 360,
    assetKey: "landmark-penguin-colony",
    assetPath: "/asset/img/landmark-penguin-colony.png",
    assetFrame: [79, 418, 1094, 531],
  },
  {
    id: "weather-station", name: "무인 기상 관측소", nameEn: "Weather Station",
    size: "medium", distance: 30_000, approachDistance: 420,
    assetKey: "landmark-weather-station",
    assetPath: "/asset/img/landmark-weather-station.png",
    assetFrame: [201, 189, 853, 900],
  },
  {
    id: "ice-cave", name: "얼음 동굴", nameEn: "Ice Cave",
    size: "medium", distance: 40_000, approachDistance: 450,
    assetKey: "landmark-ice-cave",
    assetPath: "/asset/img/landmark-ice-cave.png",
    assetFrame: [55, 298, 1146, 666],
  },
  {
    id: "supply-camp", name: "보급 캠프", nameEn: "Supply Camp",
    size: "major", distance: 50_000, approachDistance: 500,
    assetKey: "landmark-supply-camp",
    assetPath: "/asset/img/landmark-supply-camp.png",
    assetFrame: [71, 301, 1111, 657],
  },
  {
    id: "iceberg-field", name: "거대 빙산 지대", nameEn: "Iceberg Field",
    size: "medium", distance: 60_000, approachDistance: 500,
    assetKey: "landmark-iceberg-field",
    assetPath: "/asset/img/landmark-iceberg-field.png",
    assetFrame: [16, 328, 1228, 591],
  },
  {
    id: "radio-outpost", name: "통신 중계소", nameEn: "Radio Outpost",
    size: "major", distance: 70_000, approachDistance: 550,
    assetKey: "landmark-radio-outpost",
    assetPath: "/asset/img/landmark-radio-outpost.png",
    assetFrame: [81, 145, 1092, 959],
  },
  {
    id: "abandoned-camp", name: "버려진 탐험 캠프", nameEn: "Abandoned Camp",
    size: "medium", distance: 80_000, approachDistance: 600,
    assetKey: "landmark-abandoned-camp",
    assetPath: "/asset/img/landmark-abandoned-camp.png",
    assetFrame: [34, 301, 1187, 639],
  },
  {
    id: "ice-wall", name: "대빙벽", nameEn: "Ice Wall",
    size: "medium", distance: 90_000, approachDistance: 650,
    assetKey: "landmark-ice-wall",
    assetPath: "/asset/img/landmark-ice-wall.png",
    assetFrame: [30, 323, 1195, 595],
  },
  {
    id: "antarctic-base", name: "남극 전진기지", nameEn: "Antarctic Base",
    size: "major", distance: 100_000, approachDistance: 700,
    assetKey: "landmark-antarctic-base",
    assetPath: "/asset/img/landmark-antarctic-base.png",
    assetFrame: [31, 304, 1192, 638],
  },
];

/** Spatial safe corridors, independent of obstacle difficulty and spawn timing. */
export function isLandmarkClearDistance(distanceMeters: number): boolean {
  return LANDMARKS.some(landmark =>
    distanceMeters >= landmark.distance - landmark.approachDistance - LANDMARK_CONFIG.clearLeadMeters
    && distanceMeters <= landmark.distance + LANDMARK_CONFIG.departureClearMeters,
  );
}
