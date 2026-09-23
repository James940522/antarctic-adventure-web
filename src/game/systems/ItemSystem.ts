import { RUN_CONFIG } from "../config/constants.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { ITEM_CONFIG, ITEM_DEFINITIONS, ITEM_TYPES, type GameItem, type ItemType } from "../data/items.ts";
import { OBSTACLE_DEFINITIONS } from "../data/obstacles.ts";
import type { PlayerState } from "../entities/Player.ts";
import type { JumpMotion } from "../entities/jump.ts";
import { contactFraction, type ContactRange } from "./CollisionSystem.ts";
import type { Obstacle } from "./ObstacleSystem.ts";

export class ItemSystem {
  readonly items: GameItem[] = [];
  private nextDistance: number;
  private pendingType: ItemType | null = null;
  private nextId = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
    this.nextDistance = this.nextGap();
  }

  update(distance: number, travelEnd: number, obstacles: readonly Obstacle[]): void {
    this.prune(distance);
    const clearance = ITEM_CONFIG.obstacleClearanceMeters * RUN_CONFIG.unitsPerMeter;
    // Obstacles are generated first. This small lookahead margin lets us inspect
    // both sides of a candidate, including hazards just beyond its distance.
    while (this.nextDistance <= travelEnd + RUN_CONFIG.viewDistance - clearance) {
      const candidate = this.nextDistance;
      // An unsafe candidate is postponed by distance, never rerolled per frame
      // or charged another full 3–4km interval.
      this.nextDistance += ITEM_CONFIG.unsafeRetryGapMeters * RUN_CONFIG.unitsPerMeter;
      if (isLandmarkClearDistance(candidate / RUN_CONFIG.unitsPerMeter)) continue;
      const type = this.pendingType ??= ITEM_TYPES[Math.floor(this.random() * ITEM_TYPES.length)];
      const definition = ITEM_DEFINITIONS[type];
      const lanes = RUN_CONFIG.lanes.filter(courseX => !obstacles.some(obstacle =>
        Math.abs(obstacle.distance - candidate) <= clearance
        && Math.abs(obstacle.courseX - courseX) <= OBSTACLE_DEFINITIONS[obstacle.type].collisionHalfWidth + definition.pickupHalfWidth,
      ));
      if (lanes.length === 0) continue;
      this.items.push({ id: this.nextId++, type, courseX: lanes[Math.floor(this.random() * lanes.length)], distance: candidate });
      this.pendingType = null;
      this.nextDistance = candidate + this.nextGap();
    }
  }

  firstPickup(from: Readonly<PlayerState>, to: Readonly<PlayerState>, jump: Readonly<JumpMotion> | null, range: ContactRange) {
    let first: { item: GameItem; fraction: number } | null = null;
    for (const item of this.items) {
      const definition = ITEM_DEFINITIONS[item.type];
      const fraction = contactFraction(from, to, {
        courseX: item.courseX, distance: item.distance,
        halfWidth: definition.pickupHalfWidth, halfDepth: ITEM_CONFIG.pickupHalfDepth, height: definition.pickupHeight,
      }, jump, range);
      if (fraction !== null && (!first || fraction < first.fraction)) first = { item, fraction };
    }
    return first;
  }

  collect(item: GameItem): void {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  prune(distance: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].distance < distance - 160) this.items.splice(i, 1);
    }
  }

  reset(): void {
    this.items.length = 0;
    this.nextDistance = this.nextGap();
    this.pendingType = null;
    this.nextId = 0;
  }

  private nextGap(): number {
    return (ITEM_CONFIG.minSpawnGapMeters
      + this.random() * (ITEM_CONFIG.maxSpawnGapMeters - ITEM_CONFIG.minSpawnGapMeters)) * RUN_CONFIG.unitsPerMeter;
  }
}
