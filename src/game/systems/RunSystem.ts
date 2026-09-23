import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { Player } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import type { RunRecord } from "../types/run-record.types.ts";
import { firstCollision } from "./CollisionSystem.ts";
import { boxesPerRow, ObstacleSystem } from "./ObstacleSystem.ts";
import { LandmarkSystem } from "./LandmarkSystem.ts";

export type RunSnapshot = {
  status: "running" | "celebrating" | "gameover";
  distance: number;
  bestDistance: number;
  averageSpeed: number; // Distance / active driving time, in m/s.
  bestAverageSpeed: number | null;
  speed: number; // Display meters / second.
  boxesPerRow: number;
  newRecord: boolean;
  paused: boolean;
  inputActive: boolean;
};

export class RunSystem {
  player = new Player();
  obstacles: ObstacleSystem;
  readonly landmarks: LandmarkSystem;
  private ended = false;
  bestRecord: RunRecord;
  newRecord = false;
  elapsedSeconds = 0;
  private readonly random: () => number;

  constructor(bestRecord: RunRecord = { distance: 0, averageSpeed: null }, random: () => number = Math.random, landmarks = new LandmarkSystem()) {
    this.bestRecord = { ...bestRecord };
    this.random = random;
    this.landmarks = landmarks;
    this.obstacles = new ObstacleSystem(random);
  }

  get status(): RunSnapshot["status"] {
    return this.ended ? "gameover" : this.landmarks.isCelebrating ? "celebrating" : "running";
  }

  get averageSpeed(): number {
    return this.elapsedSeconds > 0
      ? this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter / this.elapsedSeconds : 0;
  }

  update(input: Readonly<GameInputState>, deltaMs: number): boolean {
    if (this.ended || !Number.isFinite(deltaMs) || deltaMs < 0) return false;
    const delta = Math.min(deltaMs, PLAYER_CONFIG.maxDeltaMs);
    if (this.landmarks.isCelebrating) {
      if (this.landmarks.advanceCelebration(delta / 1000)) this.player.depart();
      return false;
    }
    const previous = { ...this.player.state };
    this.player.update(input, delta);
    const destination = this.landmarks.next;
    const destinationDistance = destination ? destination.distance * RUN_CONFIG.unitsPerMeter : Infinity;
    const travelled = this.player.state.distanceTravelled - previous.distanceTravelled;
    const arrivalFraction = destinationDistance <= this.player.state.distanceTravelled
      ? Math.max(0, travelled > 0 ? (destinationDistance - previous.distanceTravelled) / travelled : 0) : Infinity;
    // At uncapped speeds one frame can cross rows outside the previous view.
    // Generate those rows before collision, retaining every box along the sweep.
    this.obstacles.update(previous.distanceTravelled, Math.min(destinationDistance, this.player.state.distanceTravelled));
    const hit = firstCollision(previous, this.player.state, this.obstacles.boxes);
    if (hit && hit.fraction <= arrivalFraction) {
      this.player.stopAt(previous, hit.fraction);
      this.elapsedSeconds += delta / 1000 * hit.fraction;
      this.ended = true;
      const distance = Math.floor(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
      this.newRecord = distance > this.bestRecord.distance;
      if (this.newRecord) this.bestRecord = { distance, averageSpeed: this.averageSpeed };
      return true;
    }
    if (arrivalFraction <= 1) {
      this.player.stopAt(previous, arrivalFraction);
      this.player.arriveAt(destinationDistance);
      this.elapsedSeconds += delta / 1000 * arrivalFraction;
      this.obstacles.update(destinationDistance);
      this.landmarks.update(destinationDistance / RUN_CONFIG.unitsPerMeter);
      return false;
    }
    this.elapsedSeconds += delta / 1000;
    this.obstacles.update(this.player.state.distanceTravelled);
    this.landmarks.update(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
    return false;
  }

  restart(): void {
    this.player = new Player();
    this.obstacles = new ObstacleSystem(this.random);
    this.ended = false;
    this.landmarks.reset();
    this.newRecord = false;
    this.elapsedSeconds = 0;
  }

  snapshot(paused: boolean, inputActive: boolean): RunSnapshot {
    const distance = Math.floor(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
    const averageSpeed = this.averageSpeed;
    const best = distance > this.bestRecord.distance ? { distance, averageSpeed } : this.bestRecord;
    return {
      status: this.status, distance, bestDistance: best.distance,
      averageSpeed, bestAverageSpeed: best.averageSpeed,
      speed: this.player.state.currentSpeed / RUN_CONFIG.unitsPerMeter,
      boxesPerRow: boxesPerRow(this.player.state.distanceTravelled),
      newRecord: this.newRecord, paused, inputActive,
    };
  }
}
