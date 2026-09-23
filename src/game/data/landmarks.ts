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
  lateralPosition: -1 | 1;
  showPassMessage: boolean;
};

export const LANDMARKS: readonly LandmarkDefinition[] = [
  {
    id: "weather-marker", name: "기상 관측 표지", nameEn: "Weather Marker",
    size: "small", distance: 300, approachDistance: 100,
    assetKey: "landmark-weather-marker",
    assetPath: "/asset/landmark-weather-marker.png",
    assetFrame: [295, 139, 665, 979],
    lateralPosition: -1, showPassMessage: false,
  },
  {
    id: "penguin-colony", name: "펭귄 군락", nameEn: "Penguin Colony",
    size: "small", distance: 700, approachDistance: 120,
    assetKey: "landmark-penguin-colony",
    assetPath: "/asset/landmark-penguin-colony.png",
    assetFrame: [79, 418, 1094, 531],
    lateralPosition: 1, showPassMessage: false,
  },
  {
    id: "weather-station", name: "무인 기상 관측소", nameEn: "Weather Station",
    size: "medium", distance: 1200, approachDistance: 200,
    assetKey: "landmark-weather-station",
    assetPath: "/asset/landmark-weather-station.png",
    assetFrame: [201, 189, 853, 900],
    lateralPosition: -1, showPassMessage: true,
  },
  {
    id: "ice-cave", name: "얼음 동굴", nameEn: "Ice Cave",
    size: "medium", distance: 2000, approachDistance: 200,
    assetKey: "landmark-ice-cave",
    assetPath: "/asset/landmark-ice-cave.png",
    assetFrame: [55, 298, 1146, 666],
    lateralPosition: 1, showPassMessage: true,
  },
  {
    id: "supply-camp", name: "보급 캠프", nameEn: "Supply Camp",
    size: "major", distance: 3000, approachDistance: 300,
    assetKey: "landmark-supply-camp",
    assetPath: "/asset/landmark-supply-camp.png",
    assetFrame: [71, 301, 1111, 657],
    lateralPosition: -1, showPassMessage: true,
  },
  {
    id: "iceberg-field", name: "거대 빙산 지대", nameEn: "Iceberg Field",
    size: "medium", distance: 4000, approachDistance: 250,
    assetKey: "landmark-iceberg-field",
    assetPath: "/asset/landmark-iceberg-field.png",
    assetFrame: [16, 328, 1228, 591],
    lateralPosition: 1, showPassMessage: true,
  },
  {
    id: "radio-outpost", name: "통신 중계소", nameEn: "Radio Outpost",
    size: "major", distance: 5000, approachDistance: 300,
    assetKey: "landmark-radio-outpost",
    assetPath: "/asset/landmark-radio-outpost.png",
    assetFrame: [81, 145, 1092, 959],
    lateralPosition: -1, showPassMessage: true,
  },
  {
    id: "abandoned-camp", name: "버려진 탐험 캠프", nameEn: "Abandoned Camp",
    size: "medium", distance: 6500, approachDistance: 250,
    assetKey: "landmark-abandoned-camp",
    assetPath: "/asset/landmark-abandoned-camp.png",
    assetFrame: [34, 301, 1187, 639],
    lateralPosition: 1, showPassMessage: true,
  },
  {
    id: "ice-wall", name: "대빙벽", nameEn: "Ice Wall",
    size: "medium", distance: 8000, approachDistance: 300,
    assetKey: "landmark-ice-wall",
    assetPath: "/asset/landmark-ice-wall.png",
    assetFrame: [30, 323, 1195, 595],
    lateralPosition: -1, showPassMessage: true,
  },
  {
    id: "antarctic-base", name: "남극 전진기지", nameEn: "Antarctic Base",
    size: "major", distance: 10000, approachDistance: 400,
    assetKey: "landmark-antarctic-base",
    assetPath: "/asset/landmark-antarctic-base.png",
    assetFrame: [31, 304, 1192, 638],
    lateralPosition: 1, showPassMessage: true,
  },
];
