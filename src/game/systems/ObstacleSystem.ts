import { RUN_CONFIG } from "../config/constants.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS, type ObstacleId } from "../data/obstacles.ts";

export type Obstacle = {
  id: number;
  type: ObstacleId;
  startLane: number;
  courseX: number;
  distance: number;
};

export class ObstacleSystem {
  readonly items: Obstacle[] = [];
  // A row enters the 120m view only after the player has travelled 50m.
  private nextRowDistance = OBSTACLE_CONFIG.initialClearMeters * RUN_CONFIG.unitsPerMeter + RUN_CONFIG.viewDistance;
  private nextId = 0;
  private readonly bag: ObstacleId[] = [];
  private lastType?: ObstacleId;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  update(distance: number, travelEnd = distance): void {
    // Preserve swept rows until collision resolves, then reclaim behind the player.
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].distance < distance - 160) this.items.splice(i, 1);
    }
    while (this.nextRowDistance <= travelEnd + RUN_CONFIG.viewDistance) {
      if (isLandmarkClearDistance(this.nextRowDistance / RUN_CONFIG.unitsPerMeter)) {
        // Safe corridors do not consume a type from the shuffle bag.
        this.nextRowDistance += OBSTACLE_CONFIG.minGapMeters * RUN_CONFIG.unitsPerMeter;
        continue;
      }
      const type = this.nextType();
      const definition = OBSTACLE_DEFINITIONS[type];
      const startLane = Math.floor(this.random() * (RUN_CONFIG.lanes.length - definition.laneSpan + 1));
      const lastLane = startLane + definition.laneSpan - 1;
      this.items.push({
        id: this.nextId++, type, startLane,
        courseX: (RUN_CONFIG.lanes[startLane] + RUN_CONFIG.lanes[lastLane]) / 2,
        distance: this.nextRowDistance,
      });
      const gap = OBSTACLE_CONFIG.minGapMeters + this.random() * (OBSTACLE_CONFIG.maxGapMeters - OBSTACLE_CONFIG.minGapMeters)
        + (definition.laneSpan === 2 ? OBSTACLE_CONFIG.wideExtraGapMeters : 0);
      this.nextRowDistance += gap * RUN_CONFIG.unitsPerMeter;
    }
  }

  private nextType(): ObstacleId {
    if (this.bag.length === 0) {
      this.bag.push(...OBSTACLE_IDS);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      // pop() consumes the end: avoid repeats across two complete bags.
      const last = this.bag.length - 1;
      if (this.bag[last] === this.lastType) [this.bag[last], this.bag[0]] = [this.bag[0], this.bag[last]];
    }
    this.lastType = this.bag.pop()!;
    return this.lastType;
  }
}
