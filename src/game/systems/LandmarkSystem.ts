import { LANDMARK_CONFIG } from "../config/constants.ts";
import { LANDMARKS, type LandmarkDefinition } from "../data/landmarks.ts";

export type LandmarkSnapshot = {
  next: { name: string; distanceRemaining: number } | null;
  message: Pick<LandmarkDefinition, "id" | "name" | "nameEn" | "distance"> | null;
};

export type LandmarkRenderer = {
  render: (landmark: LandmarkDefinition, remainingMeters: number) => void;
  clear: () => void;
};

/** Observes the run's final distance; never owns movement, difficulty or collision. */
export class LandmarkSystem {
  private readonly view?: LandmarkRenderer;
  private readonly onPassed?: (landmark: LandmarkDefinition) => void;
  private nextIndex = 0;
  private distance = 0;
  private active: LandmarkDefinition | null = null;
  private message: LandmarkSnapshot["message"] = null;
  private messageUntil = 0;

  constructor(view?: LandmarkRenderer, onPassed?: (landmark: LandmarkDefinition) => void) {
    this.view = view;
    this.onPassed = onPassed;
  }

  get next(): LandmarkDefinition | null { return LANDMARKS[this.nextIndex] ?? null; }
  get activeLandmark(): LandmarkDefinition | null { return this.active; }
  get progress(): number | null {
    return this.active ? 1 - (this.active.distance - this.distance) / this.active.approachDistance : null;
  }

  update(distanceMeters: number, elapsedSeconds: number): void {
    if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedSeconds)) return;
    this.distance = Math.max(this.distance, distanceMeters);
    if (elapsedSeconds >= this.messageUntil) this.message = null;

    while (this.next && this.distance >= this.next.distance) {
      const passed = this.next;
      this.nextIndex++;
      if (passed.showPassMessage) {
        this.message = { id: passed.id, name: passed.name, nameEn: passed.nameEn, distance: passed.distance };
        this.messageUntil = elapsedSeconds + LANDMARK_CONFIG.sizes[passed.size].messageSeconds;
      }
      this.onPassed?.(passed);
    }

    if (this.active && this.distance >= this.active.distance + LANDMARK_CONFIG.exitDistance) {
      this.view?.clear();
      this.active = null;
    }
    if (!this.active && this.next && this.next.distance - this.distance <= this.next.approachDistance) {
      this.active = this.next;
    }
    if (this.active) this.view?.render(this.active, this.active.distance - this.distance);
  }

  snapshot(): LandmarkSnapshot {
    return {
      next: this.next ? {
        name: this.next.name,
        // Do not show 0 m before the exact crossing, or round current distance upward.
        distanceRemaining: Math.ceil(this.next.distance - this.distance),
      } : null,
      message: this.message,
    };
  }

  reset(): void {
    this.view?.clear();
    this.nextIndex = 0;
    this.distance = 0;
    this.active = this.message = null;
    this.messageUntil = 0;
  }
}
