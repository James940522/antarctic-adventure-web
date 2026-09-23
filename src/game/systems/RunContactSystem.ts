import { RUN_CONFIG } from "../config/constants.ts";
import type { PlayerState } from "../entities/Player.ts";
import type { JumpMotion } from "../entities/jump.ts";
import { collisionFraction, firstCollision } from "./CollisionSystem.ts";
import { ItemEffectSystem } from "./ItemEffectSystem.ts";
import type { ItemSystem } from "./ItemSystem.ts";
import type { Obstacle } from "./ObstacleSystem.ts";

/** Resolve pickup, expiry and hazard contacts in time order, even at uncapped speed. */
export class RunContactSystem {
  readonly effects = new ItemEffectSystem();
  private readonly exitGrace = new Set<number>();

  resolve(from: Readonly<PlayerState>, to: Readonly<PlayerState>, jump: Readonly<JumpMotion> | null,
    seconds: number, endFraction: number, obstacles: readonly Obstacle[], items: ItemSystem) {
    for (const id of this.exitGrace) {
      if (!obstacles.some(obstacle => obstacle.id === id && obstacle.distance + RUN_CONFIG.collisionHalfDepth >= from.distanceTravelled)) {
        this.exitGrace.delete(id);
      }
    }
    let cursor = 0;
    while (cursor <= endFraction) {
      const pickup = items.firstPickup(from, to, jump, [cursor, endFraction]);
      const expiry = seconds > 0 ? cursor + this.effects.nextExpirationSeconds / seconds : Infinity;
      const boundary = Math.min(endFraction, pickup?.fraction ?? Infinity, expiry);
      const hit = this.effects.ignoresObstacles ? null
        : firstCollision(from, to, obstacles, jump, [cursor, boundary], this.exitGrace);
      // A pickup at the exact same instant wins; earlier hazards still end the run.
      if (hit && (!pickup || hit.fraction < pickup.fraction)) {
        this.effects.advance((hit.fraction - cursor) * seconds);
        return hit;
      }
      const wasIgnoring = this.effects.ignoresObstacles;
      this.effects.advance((boundary - cursor) * seconds);
      if (wasIgnoring && !this.effects.ignoresObstacles) {
        for (const obstacle of obstacles) {
          if (collisionFraction(from, to, obstacle, jump, [boundary, boundary]) !== null) this.exitGrace.add(obstacle.id);
        }
      }
      cursor = boundary;
      if (pickup && pickup.fraction === boundary) {
        items.collect(pickup.item);
        this.effects.apply(pickup.item.type);
        // Check the same instant again: another item may share it, and future
        // non-protective effects must not accidentally suppress a tied hazard.
        continue;
      }
      if (cursor === endFraction) break;
    }
    return null;
  }

  reset(): void {
    this.effects.reset();
    this.exitGrace.clear();
  }
}
