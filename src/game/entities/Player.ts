import { PLAYER_CONFIG } from "../config/constants.ts";
import type { GameInputState } from "../input/input.types.ts";

export type PlayerState = {
  courseX: number;
  currentSpeed: number;
  selectedSpeed: number;
  distanceTravelled: number;
  jumpPhase: "grounded" | "rising" | "falling";
  jumpHeight: number;
  jumpElapsedSeconds: number;
};

// Simulation coordinates never depend on the canvas or CSS size.
export class Player {
  private previousSpeedDirection = 0;
  private readonly current: PlayerState = {
    courseX: 0,
    currentSpeed: PLAYER_CONFIG.baseSpeed,
    selectedSpeed: PLAYER_CONFIG.baseSpeed,
    distanceTravelled: 0,
    jumpPhase: "grounded",
    jumpHeight: 0,
    jumpElapsedSeconds: 0,
  };

  get state(): Readonly<PlayerState> {
    return this.current;
  }

  update(input: Readonly<GameInputState>, deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
    const seconds = Math.min(deltaMs, PLAYER_CONFIG.maxDeltaMs) / 1000;
    const state = this.current;
    state.courseX = Math.max(-PLAYER_CONFIG.courseLimit, Math.min(
      PLAYER_CONFIG.courseLimit,
      state.courseX + input.horizontalAxis * PLAYER_CONFIG.lateralSpeed * seconds,
    ));

    const speedDirection = Math.abs(input.verticalAxis) >= PLAYER_CONFIG.speedAxisThreshold
      ? -Math.sign(input.verticalAxis) : 0;
    if (speedDirection !== 0 && speedDirection !== this.previousSpeedDirection) {
      state.selectedSpeed = Math.max(PLAYER_CONFIG.baseSpeed, state.selectedSpeed + speedDirection * PLAYER_CONFIG.speedStep);
    }
    this.previousSpeedDirection = speedDirection;
    state.currentSpeed = state.selectedSpeed;
    state.distanceTravelled += state.currentSpeed * seconds;

    // Only a fresh press on the ground starts a jump. Midair presses are not queued.
    if (input.jumpPressed && state.jumpPhase === "grounded") {
      state.jumpPhase = "rising";
      state.jumpElapsedSeconds = 0;
    }
    if (state.jumpPhase === "grounded") return;

    state.jumpElapsedSeconds += seconds;
    const progress = state.jumpElapsedSeconds / PLAYER_CONFIG.jumpDurationSeconds;
    if (progress >= 1 - 1e-9) {
      state.jumpPhase = "grounded";
      state.jumpElapsedSeconds = 0;
      state.jumpHeight = 0;
      return;
    }
    state.jumpPhase = progress < 0.5 - 1e-9 ? "rising" : "falling";
    state.jumpHeight = 4 * PLAYER_CONFIG.jumpHeight * progress * (1 - progress);
  }

  stopAt(previous: Readonly<PlayerState>, fraction: number): void {
    const state = this.current;
    state.courseX = previous.courseX + (state.courseX - previous.courseX) * fraction;
    state.distanceTravelled = previous.distanceTravelled + (state.distanceTravelled - previous.distanceTravelled) * fraction;
    state.jumpHeight = previous.jumpHeight + (state.jumpHeight - previous.jumpHeight) * fraction;
  }

  arriveAt(distance: number): void {
    this.current.distanceTravelled = distance;
    this.current.currentSpeed = 0;
    this.current.jumpPhase = "grounded";
    this.current.jumpHeight = this.current.jumpElapsedSeconds = 0;
    this.previousSpeedDirection = 0;
  }

  depart(): void {
    // The celebration view moves to the center before handing steering back.
    this.current.courseX = 0;
    this.current.currentSpeed = this.current.selectedSpeed;
    this.previousSpeedDirection = 0;
  }
}
