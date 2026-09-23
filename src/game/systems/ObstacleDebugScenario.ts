import { PLAYER_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { OBSTACLE_DEFINITIONS, OBSTACLE_IDS, type ObstacleId } from "../data/obstacles.ts";
import type { GameInputState } from "../input/input.types.ts";
import { createObstacle } from "./ObstacleSystem.ts";
import type { RunSystem } from "./RunSystem.ts";

/** Opt-in development fixture. Exercises the real scene, input, jump and collision loop. */
export class ObstacleDebugScenario {
  private jumped = false;
  readonly obstacle;
  readonly playerX: number;
  readonly autoJump: boolean;

  constructor(type: ObstacleId, startLane: number, playerX: number, autoJump: boolean) {
    this.obstacle = createObstacle(-1, type, startLane, 600);
    this.playerX = playerX;
    this.autoJump = autoJump;
  }

  static fromSearch(search: string): ObstacleDebugScenario | undefined {
    const query = new URLSearchParams(search);
    const type = query.get("debugObstacle") as ObstacleId;
    if (!OBSTACLE_IDS.includes(type)) return;
    const span = OBSTACLE_DEFINITIONS[type].laneSpan;
    const start = span === "full" ? 0 : Number(query.get("debugStartLane") ?? 0);
    if (!Number.isInteger(start) || start < 0 || start > RUN_CONFIG.lanes.length - (span === "full" ? RUN_CONFIG.lanes.length : span)) return;
    const playerX = Number(query.get("debugPlayerX") ?? 0);
    if (!Number.isFinite(playerX) || Math.abs(playerX) > PLAYER_CONFIG.courseLimit) return;
    return new ObstacleDebugScenario(type, start, playerX, query.get("debugJump") === "1");
  }

  reset(run: RunSystem): void {
    this.jumped = false;
    run.obstacles.update = distance => {
      if (distance > this.obstacle.distance + 160) run.obstacles.items.length = 0;
    };
    run.items.update = () => {};
    run.obstacles.items.push(this.obstacle);
    Object.assign(run.player.state, { courseX: this.playerX });
  }

  input(run: RunSystem, input: Readonly<GameInputState>): Readonly<GameInputState> {
    if (!this.autoJump || this.jumped || run.isPaused || run.status !== "running") return input;
    const remaining = this.obstacle.distance - run.player.state.distanceTravelled;
    if (remaining > run.player.state.currentSpeed * 0.4) return input;
    this.jumped = true;
    return { ...input, jump: true, jumpPressed: true };
  }

  label(run: RunSystem): string {
    const passed = run.player.state.distanceTravelled > this.obstacle.distance + 100;
    return `OBSTACLE QA · ${this.obstacle.type} · x ${this.playerX} · ${this.autoJump ? "AUTO JUMP" : "MANUAL"}\n`
      + (run.status === "gameover" ? "COLLISION" : passed ? "CLEARED" : "APPROACHING");
  }
}
