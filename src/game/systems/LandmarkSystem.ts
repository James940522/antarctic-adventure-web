import { LANDMARK_CONFIG } from "../config/constants.ts";
import { LANDMARKS, type LandmarkDefinition } from "../data/landmarks.ts";

export type LandmarkSnapshot = {
  next: { name: string; distanceRemaining: number } | null;
  arrival: Pick<LandmarkDefinition, "id" | "name" | "nameEn" | "distance"> | null;
};

export type LandmarkRenderer = {
  render: (landmark: LandmarkDefinition, remainingMeters: number, alpha?: number) => void;
  clear: () => void;
};

/** Arrival lifecycle; RunSystem owns exact stopping and advances this clock only while active. */
export class LandmarkSystem {
  private readonly view?: LandmarkRenderer;
  private readonly onArrived?: (landmark: LandmarkDefinition) => void;
  private nextIndex = 0;
  private distance = 0;
  private active: LandmarkDefinition | null = null;
  private celebrationTime: number | null = null;

  constructor(view?: LandmarkRenderer, onArrived?: (landmark: LandmarkDefinition) => void) {
    this.view = view;
    this.onArrived = onArrived;
  }

  get next(): LandmarkDefinition | null { return LANDMARKS[this.nextIndex] ?? null; }
  get completedCount(): number { return this.nextIndex; }
  get activeLandmark(): LandmarkDefinition | null { return this.active; }
  get celebrationElapsedSeconds(): number | null { return this.celebrationTime; }
  get isCelebrating(): boolean { return this.celebrationTime !== null; }
  get progress(): number | null {
    return this.active ? Math.min(1, 1 - (this.active.distance - this.distance) / this.active.approachDistance) : null;
  }

  update(distanceMeters: number): void {
    if (!Number.isFinite(distanceMeters) || this.isCelebrating) return;
    this.distance = Math.max(this.distance, distanceMeters);
    const next = this.next;
    if (!next) return;
    if (this.distance >= next.distance) {
      this.distance = next.distance;
      this.active = next;
      this.celebrationTime = 0;
      this.onArrived?.(next);
    } else if (next.distance - this.distance <= next.approachDistance) {
      this.active = next;
    }
    this.render();
  }

  advanceCelebration(seconds: number): boolean {
    if (this.celebrationTime === null || !Number.isFinite(seconds) || seconds < 0) return false;
    this.celebrationTime += seconds;
    if (this.celebrationTime >= LANDMARK_CONFIG.celebrationSeconds - 1e-9) {
      this.view?.clear();
      this.active = null;
      this.celebrationTime = null;
      this.nextIndex++;
      return true;
    }
    this.render();
    return false;
  }

  snapshot(): LandmarkSnapshot {
    const arrived = this.isCelebrating ? this.active : null;
    return {
      next: this.next ? { name: this.next.name, distanceRemaining: Math.max(0, Math.ceil(this.next.distance - this.distance)) } : null,
      arrival: arrived ? { id: arrived.id, name: arrived.name, nameEn: arrived.nameEn, distance: arrived.distance } : null,
    };
  }

  reset(): void {
    this.view?.clear();
    this.nextIndex = 0;
    this.distance = 0;
    this.active = null;
    this.celebrationTime = null;
  }

  // Redraw the current state after resizing, without advancing arrival timers.
  render(): void {
    if (!this.active) return;
    const alpha = this.celebrationTime === null ? 1
      : Math.min(1, (LANDMARK_CONFIG.celebrationSeconds - this.celebrationTime) / LANDMARK_CONFIG.fadeSeconds);
    this.view?.render(this.active, Math.max(0, this.active.distance - this.distance), alpha);
  }
}
