import { INPUT_CONFIG } from "../config/constants.ts";
import { createDeviceInput, type InputSource } from "./input.types.ts";

export type GamepadSnapshot = Pick<Gamepad, "index" | "id" | "mapping" | "connected" | "axes"> & {
  buttons: ReadonlyArray<Pick<GamepadButton, "pressed" | "value">>;
};

export type GamepadProvider = () => ReadonlyArray<GamepadSnapshot | null> | null;

export function applyDeadzone(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const magnitude = Math.min(1, Math.abs(value));
  const deadzone = INPUT_CONFIG.gamepadDeadzone;
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * ((magnitude - deadzone) / (1 - deadzone));
}

function browserGamepads(): ReturnType<GamepadProvider> {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  return navigator.getGamepads();
}

function isPressed(pad: GamepadSnapshot, index: number): boolean {
  const button = pad.buttons[index];
  return button?.pressed === true || (button?.value ?? 0) > 0.5;
}

function hasInput(pad: GamepadSnapshot): boolean {
  return applyDeadzone(pad.axes[0] ?? 0) !== 0
    || applyDeadzone(pad.axes[1] ?? 0) !== 0
    || isPressed(pad, 0)
    || (pad.mapping === "standard" && (
      isPressed(pad, 9) || isPressed(pad, 12) || isPressed(pad, 13) || isPressed(pad, 14) || isPressed(pad, 15)
    ));
}

export class GamepadInput implements InputSource {
  private readonly provider: GamepadProvider;
  private readonly events?: EventTarget;
  private readonly state = createDeviceInput();
  private selectedIndex: number | null = null;
  readonly status = {
    available: true,
    connectedCount: 0,
    id: "",
    mapping: "none" as "none" | "standard" | "fallback",
  };

  constructor(
    provider: GamepadProvider = browserGamepads,
    events: EventTarget | undefined = typeof window === "undefined" ? undefined : window,
  ) {
    this.provider = provider;
    this.events = events;
    events?.addEventListener("gamepadconnected", this.onConnect);
    events?.addEventListener("gamepaddisconnected", this.onDisconnect);
  }

  private onConnect = (event: Event): void => {
    this.selectedIndex ??= (event as GamepadEvent).gamepad.index;
  };

  private onDisconnect = (event: Event): void => {
    if (this.selectedIndex === (event as GamepadEvent).gamepad.index) {
      this.selectedIndex = null;
      this.reset();
    }
  };

  read() {
    this.reset();
    let pads: ReturnType<GamepadProvider>;
    try {
      pads = this.provider();
    } catch {
      // Permissions Policy or browser support can deny this optional API.
      pads = null;
    }
    this.status.available = pads !== null;
    this.status.connectedCount = 0;

    let first: GamepadSnapshot | null = null;
    let active: GamepadSnapshot | null = null;
    let current: GamepadSnapshot | null = null;
    for (const pad of pads ?? []) {
      if (!pad?.connected) continue;
      this.status.connectedCount++;
      first ??= pad;
      if (pad.index === this.selectedIndex) current = pad;
      if (!active && hasInput(pad)) active = pad;
    }

    // Keep an active controller stable; an idle controller cannot block another.
    const selected = current && hasInput(current) ? current : active ?? current ?? first;
    this.selectedIndex = selected?.index ?? null;
    this.status.id = selected?.id ?? "";
    this.status.mapping = selected ? (selected.mapping === "standard" ? "standard" : "fallback") : "none";
    if (!selected) return this.state;

    this.state.horizontalAxis = applyDeadzone(selected.axes[0] ?? 0);
    this.state.verticalAxis = applyDeadzone(selected.axes[1] ?? 0);
    this.state.jump = isPressed(selected, 0);
    // Unmapped joysticks use only axes 0/1 and button 0 as an explicit fallback.
    if (selected.mapping === "standard") {
      this.state.pause = isPressed(selected, 9);
      this.state.up = isPressed(selected, 12);
      this.state.down = isPressed(selected, 13);
      this.state.left = isPressed(selected, 14);
      this.state.right = isPressed(selected, 15);
    }
    return this.state;
  }

  reset(): void {
    this.state.left = this.state.right = this.state.up = this.state.down = false;
    this.state.horizontalAxis = this.state.verticalAxis = 0;
    this.state.jump = this.state.jumpPressed = false;
    this.state.pause = this.state.pausePressed = false;
  }

  destroy(): void {
    this.events?.removeEventListener("gamepadconnected", this.onConnect);
    this.events?.removeEventListener("gamepaddisconnected", this.onDisconnect);
    this.reset();
  }
}
