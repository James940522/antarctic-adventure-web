import { PLAYER_CONFIG } from "../config/constants.ts";
import type { GameInputState } from "../input/input.types.ts";
import { getFrameJumpProgress, getJumpHeight, type JumpMotion } from "./jump.ts";
import { sampleSpeed, type SpeedMotion } from "./speed-motion.ts";

export type PlayerState = {
  courseX: number;
  baseSpeed: number;
  currentSpeed: number;
  selectedSpeed: number;
  distanceTravelled: number;
  jumpPhase: "grounded" | "rising" | "falling";
  jumpHeight: number;
  jumpElapsedSeconds: number;
};

// Simulation coordinates never depend on the canvas or CSS size.
export class Player {
  private frameSpeed: SpeedMotion | null = null;
  private jumpProgress = 0;
  private bufferedJump = false;
  private frameJump: JumpMotion | null = null;
  private readonly current: PlayerState = {
    courseX: 0,
    baseSpeed: PLAYER_CONFIG.baseSpeed,
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

  get jumpMotion(): Readonly<JumpMotion> | null { return this.frameJump; }
  get speedMotion(): Readonly<SpeedMotion> | null { return this.frameSpeed; }

  update(input: Readonly<GameInputState>, deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return;
    const seconds = Math.min(deltaMs, PLAYER_CONFIG.maxDeltaMs) / 1000;
    this.frameJump = null;
    const state = this.current;
    state.courseX = Math.max(-PLAYER_CONFIG.courseLimit, Math.min(
      PLAYER_CONFIG.courseLimit,
      state.courseX + input.horizontalAxis * PLAYER_CONFIG.lateralSpeed * seconds,
    ));

    const speedDirection = Math.abs(input.verticalAxis) >= PLAYER_CONFIG.speedAxisThreshold
      ? -Math.sign(input.verticalAxis) : 0;
    this.frameSpeed = {
      baseSpeed: state.baseSpeed,
      extraSpeed: Math.max(0, state.selectedSpeed - state.baseSpeed),
      manualAcceleration: speedDirection * PLAYER_CONFIG.manualAcceleration,
      seconds,
    };
    const speed = sampleSpeed(this.frameSpeed);
    state.distanceTravelled += speed.distance;
    state.baseSpeed = speed.baseSpeed;
    state.currentSpeed = state.selectedSpeed = speed.speed;

    // Buffer only a fresh press near landing, never a held button or an early tap.
    if (input.jumpPressed) {
      if (state.jumpPhase === "grounded") {
        state.jumpPhase = "rising";
        this.jumpProgress = 0;
        this.bufferedJump = false;
      } else if ((1 - this.jumpProgress) * PLAYER_CONFIG.jumpDurationSeconds <= PLAYER_CONFIG.jumpBufferSeconds + 1e-9) {
        this.bufferedJump = true;
      }
    }
    if (state.jumpPhase === "grounded") return;

    let progress = this.jumpProgress + seconds / PLAYER_CONFIG.jumpDurationSeconds;
    // Snap roundoff at landing so collision and rendering share the exact ground contact.
    if (Math.abs(progress - 1) < 1e-9) progress = 1;
    const restartAtLanding = progress >= 1 && this.bufferedJump;
    this.frameJump = { startProgress: this.jumpProgress, endProgress: progress, restartAtLanding };
    if (restartAtLanding) this.bufferedJump = false;
    this.applyJumpProgress(getFrameJumpProgress(this.frameJump, 1));
  }

  clearBufferedJump(): void { this.bufferedJump = false; }

  private applyJumpProgress(progress: number): void {
    const state = this.current;
    this.jumpProgress = progress;
    if (progress >= 1 - 1e-9) {
      state.jumpPhase = "grounded";
      state.jumpElapsedSeconds = 0;
      state.jumpHeight = 0;
      return;
    }
    state.jumpPhase = progress < 0.5 - 1e-9 ? "rising" : "falling";
    state.jumpHeight = getJumpHeight(progress);
    state.jumpElapsedSeconds = progress * PLAYER_CONFIG.jumpDurationSeconds;
  }

  stopAt(previous: Readonly<PlayerState>, fraction: number): void {
    const state = this.current;
    // Integrate both accelerations only until contact, including a mid-frame floor crossing.
    if (this.frameSpeed) {
      const speed = sampleSpeed(this.frameSpeed, fraction);
      state.baseSpeed = speed.baseSpeed;
      state.currentSpeed = state.selectedSpeed = speed.speed;
      state.distanceTravelled = previous.distanceTravelled + speed.distance;
    }
    state.courseX = previous.courseX + (state.courseX - previous.courseX) * fraction;
    if (this.frameJump) {
      this.applyJumpProgress(getFrameJumpProgress(this.frameJump, fraction));
    } else {
      state.jumpHeight = previous.jumpHeight + (state.jumpHeight - previous.jumpHeight) * fraction;
    }
  }

  arriveAt(distance: number): void {
    this.current.distanceTravelled = distance;
    this.current.currentSpeed = 0;
    this.current.jumpPhase = "grounded";
    this.current.jumpHeight = this.current.jumpElapsedSeconds = 0;
    this.jumpProgress = 0;
    this.clearBufferedJump();
    this.frameJump = null;
    this.frameSpeed = null;
  }

  depart(): void {
    // The celebration view moves to the center before handing steering back.
    this.current.courseX = 0;
    this.current.currentSpeed = this.current.selectedSpeed;
  }
}
