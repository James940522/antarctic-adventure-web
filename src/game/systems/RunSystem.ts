import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { Player } from "../entities/Player.ts";
import type { GameInputState } from "../input/input.types.ts";
import { firstCollision } from "./CollisionSystem.ts";
import { boxesPerRow, ObstacleSystem } from "./ObstacleSystem.ts";

export type RunSnapshot = {
  status: "running" | "gameover";
  distance: number;
  bestDistance: number;
  speedLevel: number;
  boxesPerRow: number;
  newRecord: boolean;
  paused: boolean;
  inputActive: boolean;
};

export class RunSystem {
  player = new Player();
  obstacles: ObstacleSystem;
  status: "running" | "gameover" = "running";
  bestDistance: number;
  newRecord = false;
  elapsedSeconds = 0;
  private readonly random: () => number;

  constructor(bestDistance = 0, random: () => number = Math.random) {
    this.bestDistance = bestDistance;
    this.random = random;
    this.obstacles = new ObstacleSystem(random);
  }

  update(input: Readonly<GameInputState>, deltaMs: number): boolean {
    if (this.status !== "running" || !Number.isFinite(deltaMs) || deltaMs < 0) return false;
    const delta = Math.min(deltaMs, PLAYER_CONFIG.maxDeltaMs);
    const previous = { ...this.player.state };
    this.player.update(input, delta);
    const hit = firstCollision(previous, this.player.state, this.obstacles.boxes);
    if (hit) {
      this.player.stopAt(previous, hit.fraction);
      this.elapsedSeconds += delta / 1000 * hit.fraction;
      this.status = "gameover";
      const distance = Math.floor(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
      this.newRecord = distance > this.bestDistance;
      this.bestDistance = Math.max(this.bestDistance, distance);
      return true;
    }
    this.elapsedSeconds += delta / 1000;
    this.obstacles.update(this.player.state.distanceTravelled);
    return false;
  }

  restart(): void {
    this.player = new Player();
    this.obstacles = new ObstacleSystem(this.random);
    this.status = "running";
    this.newRecord = false;
    this.elapsedSeconds = 0;
  }

  snapshot(paused: boolean, inputActive: boolean): RunSnapshot {
    const distance = Math.floor(this.player.state.distanceTravelled / RUN_CONFIG.unitsPerMeter);
    return {
      status: this.status, distance, bestDistance: Math.max(this.bestDistance, distance),
      speedLevel: this.player.state.speedLevel,
      boxesPerRow: boxesPerRow(this.player.state.distanceTravelled),
      newRecord: this.newRecord, paused, inputActive,
    };
  }
}
