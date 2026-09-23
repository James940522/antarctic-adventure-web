import { GHOST_CONFIG, ITEM_DEFINITIONS, type ItemEffectType, type ItemType } from "../data/items.ts";

/** Independent effect clocks; acquiring an item never locks out another pickup. */
export class ItemEffectSystem {
  private readonly remaining = new Map<ItemEffectType, number>();

  apply(type: ItemType): void {
    const effect = ITEM_DEFINITIONS[type].effect;
    // Refresh this effect alone, without stacking time or clearing other effects.
    this.remaining.set(effect.type, effect.durationSeconds);
  }

  get ghostSeconds(): number { return this.remaining.get("ghost") ?? 0; }
  get ignoresObstacles(): boolean { return this.ghostSeconds > 0; }
  get nextExpirationSeconds(): number {
    let next = Infinity;
    for (const seconds of this.remaining.values()) next = Math.min(next, seconds);
    return next;
  }

  advance(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    for (const [type, remaining] of this.remaining) {
      const next = remaining - seconds;
      if (next <= 1e-9) this.remaining.delete(type);
      else this.remaining.set(type, next);
    }
  }

  reset(): void { this.remaining.clear(); }
}

export function ghostCountdown(remaining: number): number | null {
  return remaining > 0 && remaining <= GHOST_CONFIG.warningSeconds + 1e-9
    ? Math.max(1, Math.ceil(remaining - 1e-9)) : null;
}

export function ghostOpacity(remaining: number, reducedMotion = false): number {
  if (remaining <= 0) return 1;
  if (ghostCountdown(remaining) === null || reducedMotion) return GHOST_CONFIG.opacity;
  const elapsed = Math.max(0, GHOST_CONFIG.warningSeconds - remaining);
  const slow = GHOST_CONFIG.blinkSlowIntervalSeconds;
  const rate = (slow - GHOST_CONFIG.blinkFastIntervalSeconds) / GHOST_CONFIG.warningSeconds;
  // Integral of 1 / interval(t): continuous phase while the blink accelerates.
  const phase = Math.log(slow / (slow - rate * elapsed)) / rate;
  return Math.floor(phase) % 2 === 0 ? GHOST_CONFIG.opacity : 1;
}
