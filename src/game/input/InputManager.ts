import { createDeviceInput, type GameInputState, type InputSource } from "./input.types.ts";
import { PLAYER_CONFIG } from "../config/constants.ts";

function strongestAxis(first: number, second: number): number {
  const value = Math.abs(first) >= Math.abs(second) ? first : second;
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export class InputManager {
  private readonly keyboard: InputSource;
  private readonly gamepad: InputSource;
  private readonly touch?: InputSource;
  private readonly idleTouch = createDeviceInput();
  private gamepadJumpBlocked = false;
  private gamepadSpeedBlocked = false;
  private readonly input: GameInputState = {
    left: false, right: false, accelerate: false, brake: false,
    horizontalAxis: 0, verticalAxis: 0,
    jump: false, jumpPressed: false, jumpReleased: false,
  };

  constructor(keyboard: InputSource, gamepad: InputSource, touch?: InputSource) {
    this.keyboard = keyboard;
    this.gamepad = gamepad;
    this.touch = touch;
  }

  get state(): Readonly<GameInputState> {
    return this.input;
  }

  // Read once per game update. The returned state is reused, not a stored snapshot.
  update(active = true): Readonly<GameInputState> {
    const keyboard = this.keyboard.read();
    const gamepad = this.gamepad.read();
    const touch = this.touch?.read() ?? this.idleTouch;
    if (!active) {
      this.reset();
      return this.input;
    }

    const left = keyboard.left || gamepad.left || touch.left;
    const right = keyboard.right || gamepad.right || touch.right;
    const speedBlocked = this.gamepadSpeedBlocked;
    if (!gamepad.up && !gamepad.down && Math.abs(gamepad.verticalAxis) < PLAYER_CONFIG.speedAxisThreshold) this.gamepadSpeedBlocked = false;
    const up = keyboard.up || touch.up || (!speedBlocked && gamepad.up);
    const down = keyboard.down || touch.down || (!speedBlocked && gamepad.down);
    const x = left || right
      ? Number(right) - Number(left)
      : strongestAxis(keyboard.horizontalAxis, gamepad.horizontalAxis);
    const y = up || down
      ? Number(down) - Number(up)
      : strongestAxis(keyboard.verticalAxis, speedBlocked ? 0 : gamepad.verticalAxis);

    // Keyboard keys were cleared on blur; only a still-held gamepad needs re-arming.
    const blocked = this.gamepadJumpBlocked;
    if (!gamepad.jump) this.gamepadJumpBlocked = false;
    const held = keyboard.jump || touch.jump || (!blocked && gamepad.jump);
    const tap = keyboard.jumpPressed || touch.jumpPressed || (!blocked && gamepad.jumpPressed);
    const previousJump = this.input.jump;
    const jump = held;
    const pressed = !previousJump && (held || tap);

    this.input.horizontalAxis = x;
    this.input.verticalAxis = y;
    this.input.left = x < 0;
    this.input.right = x > 0;
    this.input.accelerate = y < 0;
    this.input.brake = y > 0;
    this.input.jump = jump;
    this.input.jumpPressed = pressed;
    this.input.jumpReleased = (previousJump || pressed) && !jump;
    return this.input;
  }

  reset(): void {
    this.keyboard.reset();
    this.gamepad.reset();
    this.touch?.reset();
    this.gamepadJumpBlocked = true;
    this.gamepadSpeedBlocked = true;
    this.input.left = this.input.right = this.input.accelerate = this.input.brake = false;
    this.input.horizontalAxis = this.input.verticalAxis = 0;
    this.input.jump = this.input.jumpPressed = this.input.jumpReleased = false;
  }

  destroy(): void {
    this.reset();
    this.keyboard.destroy();
    this.gamepad.destroy();
    this.touch?.destroy();
  }
}
