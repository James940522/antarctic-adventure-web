import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { isLandmarkClearDistance } from "../data/landmarks.ts";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS, obstacleGeometry, occupiedLanesFor,
  type ObstacleId, type ObstacleLaneSpan } from "../data/obstacles.ts";

export type Obstacle = ReturnType<typeof createObstacle>;

/** Resolve occupancy once; every consumer uses the same immutable placement geometry. */
export function createObstacle(id: number, type: ObstacleId, startLane: number, distance: number,
  lanes: readonly number[] = RUN_CONFIG.lanes) {
  const occupiedLanes = occupiedLanesFor(OBSTACLE_DEFINITIONS[type].laneSpan, startLane, lanes.length);
  return { id, type, startLane, distance, occupiedLanes, ...obstacleGeometry(OBSTACLE_DEFINITIONS[type], occupiedLanes, lanes) };
}

export class ObstacleSystem {
  readonly items: Obstacle[] = [];
  viewDistance: number = RUN_CONFIG.viewDistance;
  // A group enters the 120m view only after the player has travelled 50m.
  private nextGroupDistance: number = OBSTACLE_CONFIG.initialClearMeters * RUN_CONFIG.unitsPerMeter + RUN_CONFIG.viewDistance;
  private nextId = 0;
  private readonly spanBag: ObstacleLaneSpan[] = [];
  private readonly bags: Record<1 | 2, ObstacleId[]> = { 1: [], 2: [] };
  private lastType?: ObstacleId;
  private pendingType?: ObstacleId;
  private otherSinceBarricade = 0;
  private previousGroupEnd = 0;
  private previousWasFull = false;
  private reachableLanes: number[] = [0];
  private readonly laneUses: Record<1 | 2, number[]> = {
    1: Array<number>(RUN_CONFIG.lanes.length).fill(0),
    2: Array<number>(RUN_CONFIG.lanes.length - 1).fill(0),
  };
  private readonly random: () => number;

  constructor(random: () => number = Math.random) { this.random = random; }

  update(distance: number, travelEnd = distance, currentSpeed: number = PLAYER_CONFIG.baseSpeed): void {
    const speed = Math.max(OBSTACLE_CONFIG.escapeSpeedMetersPerSecond * RUN_CONFIG.unitsPerMeter, currentSpeed);
    // At high speeds the horizon must give enough time to recognize a jump-only wall.
    this.viewDistance = Math.max(RUN_CONFIG.viewDistance,
      speed * (PLAYER_CONFIG.jumpDurationSeconds + OBSTACLE_CONFIG.escapeReactionSeconds + 0.5));
    if (this.nextId === 0) {
      this.nextGroupDistance = Math.max(this.nextGroupDistance,
        OBSTACLE_CONFIG.initialClearMeters * RUN_CONFIG.unitsPerMeter + this.viewDistance);
    }
    const lateralRecovery = speed * (OBSTACLE_CONFIG.escapeReactionSeconds
      + (RUN_CONFIG.lanes[1] - RUN_CONFIG.lanes[0]) / PLAYER_CONFIG.lateralSpeed) + 2 * RUN_CONFIG.collisionHalfDepth;
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].distance < distance - 160) this.items.splice(i, 1);
    }
    while (this.nextGroupDistance <= travelEnd + this.viewDistance) {
      if (this.previousGroupEnd > 0) this.nextGroupDistance = Math.max(this.nextGroupDistance, this.previousGroupEnd + lateralRecovery);
      // Keep a drawn type pending through safe zones; never discard bag entries.
      const first = this.pendingType ??= this.nextType();
      const full = OBSTACLE_DEFINITIONS[first].laneSpan === "full";
      const jumpRecovery = speed * (PLAYER_CONFIG.jumpDurationSeconds + OBSTACLE_CONFIG.escapeReactionSeconds)
        + 2 * RUN_CONFIG.collisionHalfDepth;
      if (this.previousGroupEnd > 0 && (full || this.previousWasFull)) {
        this.nextGroupDistance = Math.max(this.nextGroupDistance, this.previousGroupEnd + jumpRecovery,
          this.previousGroupEnd + (OBSTACLE_CONFIG.minGapMeters + OBSTACLE_CONFIG.barricadeExtraGapMeters) * RUN_CONFIG.unitsPerMeter);
      }
      if (this.nextGroupDistance > travelEnd + this.viewDistance) break;
      const meters = this.nextGroupDistance / RUN_CONFIG.unitsPerMeter;
      const count = full ? 1 : OBSTACLE_CONFIG.densityStages.findLast(stage => meters >= stage.fromMeters)!.maxObstacles;
      const endMeters = meters + (count - 1) * OBSTACLE_CONFIG.maxStaggerMeters;
      if (isLandmarkClearDistance(meters) || isLandmarkClearDistance(endMeters)) {
        this.nextGroupDistance += OBSTACLE_CONFIG.minGapMeters * RUN_CONFIG.unitsPerMeter;
        continue;
      }
      const types: ObstacleId[] = [];
      let occupiedCount = 0;
      while (types.length < count) {
        const type = this.pendingType ?? this.nextType();
        const span = OBSTACLE_DEFINITIONS[type].laneSpan;
        // Full barriers get their own group; all normal groups retain a common escape lane.
        if ((span === "full" && types.length > 0)
          || (span !== "full" && occupiedCount + span >= RUN_CONFIG.lanes.length)) {
          this.pendingType = type;
          break;
        }
        this.pendingType = undefined;
        types.push(type);
        if (span === "full") break;
        occupiedCount += span;
      }
      const lanes = full ? [0] : this.placeGroup(types, speed);
      let obstacleDistance = this.nextGroupDistance;
      types.forEach((type, index) => {
        const span = OBSTACLE_DEFINITIONS[type].laneSpan;
        const startLane = lanes[index];
        if (span !== "full") this.laneUses[span][startLane]++;
        this.items.push(createObstacle(this.nextId++, type, startLane, obstacleDistance));
        if (index < types.length - 1) {
          obstacleDistance += (OBSTACLE_CONFIG.minStaggerMeters
            + this.random() * (OBSTACLE_CONFIG.maxStaggerMeters - OBSTACLE_CONFIG.minStaggerMeters)) * RUN_CONFIG.unitsPerMeter;
        }
      });
      this.previousGroupEnd = obstacleDistance;
      this.previousWasFull = full;
      const extra = full ? OBSTACLE_CONFIG.barricadeExtraGapMeters
        : types.some(type => OBSTACLE_DEFINITIONS[type].laneSpan === 2) ? OBSTACLE_CONFIG.wideExtraGapMeters : 0;
      const gap = (OBSTACLE_CONFIG.minGapMeters + this.random() * (OBSTACLE_CONFIG.maxGapMeters - OBSTACLE_CONFIG.minGapMeters)
        + extra) * RUN_CONFIG.unitsPerMeter;
      this.nextGroupDistance = obstacleDistance + Math.max(gap, full ? jumpRecovery : lateralRecovery);
    }
  }

  private placeGroup(types: readonly ObstacleId[], speed: number): number[] {
    const candidates = types.map(type => {
      const span = OBSTACLE_DEFINITIONS[type].laneSpan;
      if (span === "full") throw new Error("A full barrier must be placed alone");
      return this.laneUses[span].map((uses, lane) => ({ uses, lane, tie: this.random() }))
        .sort((a, b) => a.uses - b.uses || a.tie - b.tie);
    });
    const lanes: number[] = [];
    const escapeSeconds = (this.nextGroupDistance - this.previousGroupEnd - 2 * RUN_CONFIG.collisionHalfDepth)
      / speed - OBSTACLE_CONFIG.escapeReactionSeconds;
    const lateralReach = Math.max(0, escapeSeconds * PLAYER_CONFIG.lateralSpeed);
    const place = (index: number, occupied: number): boolean => {
      if (index === types.length) {
        const reachable = RUN_CONFIG.lanes.filter((x, lane) => !(occupied & (1 << lane))
          && this.reachableLanes.some(previous => Math.abs(x - previous) <= lateralReach + 1e-9));
        if (reachable.length === 0) return false;
        this.reachableLanes = reachable;
        return true;
      }
      const span = OBSTACLE_DEFINITIONS[types[index]].laneSpan;
      if (span === "full") return false;
      for (const { lane } of candidates[index]) {
        const mask = ((1 << span) - 1) << lane;
        if (occupied & mask) continue;
        lanes[index] = lane;
        if (place(index + 1, occupied | mask)) return true;
      }
      return false;
    };
    if (!place(0, 0)) throw new Error("Obstacle group has no safe placement");
    return lanes;
  }

  private shuffle<T>(values: T[]): void {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  }

  private nextType(): ObstacleId {
    if (this.spanBag.length === 0) { this.spanBag.push(...OBSTACLE_CONFIG.spanBag); this.shuffle(this.spanBag); }
    // Move a premature full slot later without losing its weight. Across bag boundaries
    // more normal slots may be needed before either of two deferred barriers is eligible.
    let index = this.spanBag.findLastIndex(span => span !== "full"
      || this.otherSinceBarricade >= OBSTACLE_CONFIG.barricadeMinOtherObstacles);
    if (index < 0) {
      const refill: ObstacleLaneSpan[] = [...OBSTACLE_CONFIG.spanBag];
      this.shuffle(refill);
      this.spanBag.push(...refill);
      index = this.spanBag.findLastIndex(span => span !== "full");
    }
    const [span] = this.spanBag.splice(index, 1);
    if (span === "full") {
      this.otherSinceBarricade = 0;
      return this.lastType = "barricade";
    }
    this.otherSinceBarricade++;
    const bag = this.bags[span];
    if (bag.length === 0) {
      bag.push(...OBSTACLE_IDS.filter(id => OBSTACLE_DEFINITIONS[id].laneSpan === span));
      this.shuffle(bag);
    }
    const last = bag.length - 1;
    if (bag[last] === this.lastType && last > 0) [bag[last], bag[0]] = [bag[0], bag[last]];
    return this.lastType = bag.pop()!;
  }
}
