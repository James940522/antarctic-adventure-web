import { RUN_CONFIG } from "../config/constants.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";

export type BoxObstacle = {
  id: number;
  courseX: number;
  distance: number;
  color: number;
};

export function boxesPerRow(distance: number): number {
  return Math.min(RUN_CONFIG.lanes.length - 1, 1 + Math.floor(distance / RUN_CONFIG.difficultyDistance));
}

export class ObstacleSystem {
  readonly boxes: BoxObstacle[] = [];
  private nextRowDistance: number = RUN_CONFIG.firstRowDistance;
  private nextId = 0;
  private safeLane = Math.floor(RUN_CONFIG.lanes.length / 2);
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.update(0);
  }

  update(distance: number, travelEnd = distance): void {
    // Reuse the array, and bound live objects by the visible distance.
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      if (this.boxes[i].distance < distance - 160) this.boxes.splice(i, 1);
    }
    while (this.nextRowDistance <= travelEnd + RUN_CONFIG.viewDistance) {
      // Filter by placement distance, including rows generated before arrival.
      if (!isLandmarkClearDistance(this.nextRowDistance / RUN_CONFIG.unitsPerMeter)) this.spawnRow();
      this.nextRowDistance += RUN_CONFIG.rowSpacing;
    }
  }

  private spawnRow(): void {
    // The reserved route moves at most one lane per row. Raising the chosen
    // speed reduces the time to reach that gap; players can brake as needed.
    const nextSafe = [this.safeLane - 1, this.safeLane, this.safeLane + 1]
      .filter((index) => index >= 0 && index < RUN_CONFIG.lanes.length);
    this.safeLane = nextSafe[Math.floor(this.random() * nextSafe.length)];
    const candidates = RUN_CONFIG.lanes.map((_, index) => index).filter((index) => index !== this.safeLane);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const lane of candidates.slice(0, boxesPerRow(this.nextRowDistance))) {
      this.boxes.push({
        id: this.nextId++,
        courseX: RUN_CONFIG.lanes[lane] + (this.random() * 2 - 1) * RUN_CONFIG.laneJitter,
        distance: this.nextRowDistance,
        color: RUN_CONFIG.colors[Math.floor(this.random() * RUN_CONFIG.colors.length)],
      });
    }
  }
}
