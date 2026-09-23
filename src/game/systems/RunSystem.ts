import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { Player } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import type { RunRecord } from "../types/run-record.types.ts";
import { ObstacleSystem } from "./ObstacleSystem.ts";
import { ItemSystem } from "./ItemSystem.ts";
import { RunContactSystem } from "./RunContactSystem.ts";
import { LandmarkSystem } from "./LandmarkSystem.ts";
import { createUuid } from "../utils/uuid.ts";
import { calculateScore } from "./ScoreSystem.ts";

export type RunSnapshot = {
  runId: string;
  score: number;
  stage: number;
  playTime: number; // Whole seconds of actual driving, excluding pauses/celebrations.
  status: "running" | "celebrating" | "gameover";
  distance: number;
  bestDistance: number;
  averageSpeed: number; // Distance / active driving time, in m/s.
  bestAverageSpeed: number | null;
  speed: number; // Display meters / second.
  newRecord: boolean;
  paused: boolean;
  pauseMenuOpen: boolean;
  inputActive: boolean;
};

export class RunSystem {
  private runId = createUuid();
  player = new Player();
  obstacles: ObstacleSystem;
  readonly items: ItemSystem;
  private readonly contacts = new RunContactSystem();
  readonly landmarks: LandmarkSystem;
  private ended = false;
  private manualPause = false;
  bestRecord: RunRecord;
  newRecord = false;
  elapsedSeconds = 0;
  private readonly random: () => number;

  constructor(bestRecord: RunRecord = { distance: 0, averageSpeed: null }, random: () => number = Math.random,
    landmarks = new LandmarkSystem(), itemRandom: () => number = random) {
    this.bestRecord = { ...bestRecord };
    this.random = random;
    this.landmarks = landmarks;
    this.obstacles = new ObstacleSystem(random);
    this.items = new ItemSystem(itemRandom);
  }

  get effects() { return this.contacts.effects; }

  get status(): RunSnapshot["status"] {
    return this.ended ? "gameover" : this.landmarks.isCelebrating ? "celebrating" : "running";
  }

  get averageSpeed(): number {
    return this.elapsedSeconds > 0
      ? this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter / this.elapsedSeconds : 0;
  }

  get isPaused(): boolean { return this.manualPause; }

  setPaused(paused: boolean): boolean {
    if (this.ended || this.manualPause === paused) return false;
    this.manualPause = paused;
    this.player.clearBufferedJump();
    return true;
  }

  update(input: Readonly<GameInputState>, deltaMs: number): boolean {
    if (this.ended || this.manualPause || !Number.isFinite(deltaMs) || deltaMs < 0) return false;
    const delta = Math.min(deltaMs, PLAYER_CONFIG.maxDeltaMs);
    if (this.landmarks.isCelebrating) {
      this.effects.setSuspended(true);
      if (this.landmarks.advanceCelebration(delta / 1000)) {
        this.player.depart();
        this.effects.setSuspended(false);
      }
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
    // Generate those rows before collision, retaining every obstacle along the sweep.
    this.obstacles.update(previous.distanceTravelled, Math.min(destinationDistance, this.player.state.distanceTravelled));
    this.items.update(previous.distanceTravelled, Math.min(destinationDistance, this.player.state.distanceTravelled), this.obstacles.items);
    const hit = this.contacts.resolve(previous, this.player.state, this.player.jumpMotion,
      delta / 1000, Math.min(1, arrivalFraction), this.obstacles.items, this.items);
    if (hit && hit.fraction <= arrivalFraction) {
      this.player.stopAt(previous, hit.fraction);
      this.player.clearBufferedJump();
      this.elapsedSeconds += delta / 1000 * hit.fraction;
      this.ended = true;
      this.contacts.reset();
      this.items.reset();
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
      this.items.prune(destinationDistance);
      // Store all effect clocks while suppressing both abilities and visuals.
      // Do this before the arrival callback/render so the first celebration frame is clean.
      this.effects.setSuspended(true);
      this.landmarks.update(destinationDistance / RUN_CONFIG.unitsPerMeter);
      return false;
    }
    this.elapsedSeconds += delta / 1000;
    this.obstacles.update(this.player.state.distanceTravelled);
    this.items.prune(this.player.state.distanceTravelled);
    this.landmarks.update(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
    return false;
  }

  restart(): void {
    this.runId = createUuid();
    this.player = new Player();
    this.obstacles = new ObstacleSystem(this.random);
    this.items.reset();
    this.contacts.reset();
    this.ended = false;
    this.manualPause = false;
    this.landmarks.reset();
    this.newRecord = false;
    this.elapsedSeconds = 0;
  }

  snapshot(paused: boolean, inputActive: boolean): RunSnapshot {
    const distance = Math.floor(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
    const averageSpeed = this.averageSpeed;
    const best = distance > this.bestRecord.distance ? { distance, averageSpeed } : this.bestRecord;
    return {
      runId: this.runId, score: calculateScore(distance, averageSpeed), stage: this.landmarks.completedCount + 1,
      playTime: Math.floor(this.elapsedSeconds),
      status: this.status, distance, bestDistance: best.distance,
      averageSpeed, bestAverageSpeed: best.averageSpeed,
      speed: this.player.state.currentSpeed / RUN_CONFIG.unitsPerMeter,
      newRecord: this.newRecord, paused: paused || this.manualPause, pauseMenuOpen: this.manualPause, inputActive,
    };
  }
}
