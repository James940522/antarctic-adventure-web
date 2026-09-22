import { PLAYER_CONFIG } from "../config/constants.ts";
import type { GameInputState } from "../input/input.types.ts";

export type PlayerState = {
  courseX: number;
  currentSpeed: number;
  distanceTravelled: number;
  jumpPhase: "grounded" | "rising" | "falling";
  jumpHeight: number;
  jumpElapsedSeconds: number;
};

// Simulation coordinates never depend on the canvas or CSS size.
export class Player {
  private readonly current: PlayerState = {
    courseX: 0,
    currentSpeed: PLAYER_CONFIG.initialSpeed,
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

    const acceleration = input.verticalAxis < 0
      ? -input.verticalAxis * PLAYER_CONFIG.acceleration
      : -input.verticalAxis * PLAYER_CONFIG.deceleration;
    const speed = state.currentSpeed;
    if (acceleration === 0) {
      state.distanceTravelled += speed * seconds;
    } else {
      const limit = acceleration > 0 ? PLAYER_CONFIG.maxSpeed : PLAYER_CONFIG.minSpeed;
      const acceleratingSeconds = Math.min(seconds, Math.max(0, (limit - speed) / acceleration));
      // Integrate up to the speed limit, then cruise for the rest of the frame.
      // A clamped trapezoid would lose distance differently at different frame rates.
      const nextSpeed = speed + acceleration * acceleratingSeconds;
      state.distanceTravelled += speed * acceleratingSeconds
        + acceleration * acceleratingSeconds ** 2 / 2
        + nextSpeed * (seconds - acceleratingSeconds);
      state.currentSpeed = Math.max(PLAYER_CONFIG.minSpeed, Math.min(PLAYER_CONFIG.maxSpeed, nextSpeed));
    }

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
}
