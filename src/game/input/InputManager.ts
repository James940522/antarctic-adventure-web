import type { GameInputState, InputSource } from "./input.types.ts";

function strongestAxis(first: number, second: number): number {
  const value = Math.abs(first) >= Math.abs(second) ? first : second;
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

export class InputManager {
  private readonly keyboard: InputSource;
  private readonly gamepad: InputSource;
  private gamepadJumpBlocked = false;
  private readonly input: GameInputState = {
    left: false, right: false, accelerate: false, brake: false,
    horizontalAxis: 0, verticalAxis: 0,
    jump: false, jumpPressed: false, jumpReleased: false,
  };

  constructor(keyboard: InputSource, gamepad: InputSource) {
    this.keyboard = keyboard;
    this.gamepad = gamepad;
  }

  get state(): Readonly<GameInputState> {
    return this.input;
  }

  // Read once per game update. The returned state is reused, not a stored snapshot.
  update(active = true): Readonly<GameInputState> {
    const keyboard = this.keyboard.read();
    const gamepad = this.gamepad.read();
    if (!active) {
      this.reset();
      return this.input;
    }

    const left = keyboard.left || gamepad.left;
    const right = keyboard.right || gamepad.right;
    const up = keyboard.up || gamepad.up;
    const down = keyboard.down || gamepad.down;
    const x = left || right
      ? Number(right) - Number(left)
      : strongestAxis(keyboard.horizontalAxis, gamepad.horizontalAxis);
    const y = up || down
      ? Number(down) - Number(up)
      : strongestAxis(keyboard.verticalAxis, gamepad.verticalAxis);

    // Keyboard keys were cleared on blur; only a still-held gamepad needs re-arming.
    const blocked = this.gamepadJumpBlocked;
    if (!gamepad.jump) this.gamepadJumpBlocked = false;
    const held = keyboard.jump || (!blocked && gamepad.jump);
    const tap = keyboard.jumpPressed || (!blocked && gamepad.jumpPressed);
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
    this.gamepadJumpBlocked = true;
    this.input.left = this.input.right = this.input.accelerate = this.input.brake = false;
    this.input.horizontalAxis = this.input.verticalAxis = 0;
    this.input.jump = this.input.jumpPressed = this.input.jumpReleased = false;
  }

  destroy(): void {
    this.reset();
    this.keyboard.destroy();
    this.gamepad.destroy();
  }
}
