import assert from "node:assert/strict";
import test from "node:test";

import { KeyboardInput } from "./KeyboardInput.ts";
import { GamepadInput, applyDeadzone, type GamepadSnapshot } from "./GamepadInput.ts";
import { InputManager } from "./InputManager.ts";
import { createDeviceInput, type DeviceInputState } from "./input.types.ts";

function source(values: Partial<DeviceInputState> = {}) {
  const state = { ...createDeviceInput(), ...values };
  return {
    state,
    read: () => state,
    reset: () => { Object.assign(state, createDeviceInput()); },
    destroy: () => { Object.assign(state, createDeviceInput()); },
  };
}

function pad(options: {
  axes?: number[];
  pressed?: number[];
  index?: number;
  mapping?: GamepadMappingType;
  connected?: boolean;
} = {}): GamepadSnapshot {
  return {
    index: options.index ?? 0,
    id: `Test controller ${options.index ?? 0}`,
    mapping: options.mapping ?? "standard",
    connected: options.connected ?? true,
    axes: options.axes ?? [0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: options.pressed?.includes(index) ?? false,
      value: options.pressed?.includes(index) ? 1 : 0,
    })),
  };
}

class FakeDocument extends EventTarget {
  activeElement: EventTarget | null = null;
  visibilityState = "visible";
  defaultView = new EventTarget();
  focused = true;
  hasFocus() { return this.focused; }
}

function keyboardFixture() {
  const document = new FakeDocument();
  const target = Object.assign(new EventTarget(), { ownerDocument: document });
  document.activeElement = target;
  const keyboard = new KeyboardInput(target as unknown as HTMLElement);
  const key = (
    type: "keydown" | "keyup",
    code: string,
    extra: Partial<Pick<KeyboardEvent, "repeat" | "altKey" | "ctrlKey" | "metaKey" | "isComposing">> = {},
  ) => {
    const event = Object.assign(new Event(type, { cancelable: true }), {
      code, repeat: false, altKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...extra,
    });
    target.dispatchEvent(event);
    return event;
  };
  return { document, target, keyboard, key };
}

test("short speed-key taps survive one frame and are cleared by blur", () => {
  const { keyboard, key, target } = keyboardFixture();
  key("keydown", "ArrowUp"); key("keyup", "ArrowUp");
  assert.equal(keyboard.read().up, true);
  assert.equal(keyboard.read().up, false);
  key("keydown", "KeyS"); key("keyup", "KeyS");
  assert.equal(keyboard.read().down, true);
  assert.equal(keyboard.read().down, false);
  key("keydown", "ArrowUp"); target.dispatchEvent(new Event("blur"));
  assert.equal(keyboard.read().up, false);
  keyboard.destroy();
});

test("Escape preserves short taps, ignores key repeat and clears stale pause input", () => {
  const { keyboard, key, target } = keyboardFixture();
  const manager = new InputManager(keyboard, source());
  key("keydown", "Escape"); key("keyup", "Escape");
  manager.update();
  assert.equal(manager.pausePressed, true);
  manager.reset();
  key("keydown", "Escape", { repeat: true });
  manager.update();
  assert.equal(manager.pausePressed, false);
  key("keydown", "Escape");
  manager.update();
  assert.equal(manager.pausePressed, true);
  manager.update();
  assert.equal(manager.pausePressed, false);
  target.dispatchEvent(new Event("blur"));
  manager.update(false);
  assert.equal(manager.pausePressed, false);
  manager.destroy();
});

test("standard Menu button pauses and resumes once per press even across pause resets", () => {
  let pads = [pad()];
  const gamepad = new GamepadInput(() => pads);
  const manager = new InputManager(source(), gamepad);
  manager.update();
  for (let cycle = 0; cycle < 3; cycle++) {
    pads = [pad({ pressed: [9] })];
    manager.update();
    assert.equal(manager.pausePressed, true);
    manager.reset();
    manager.update();
    assert.equal(manager.pausePressed, false);
    pads = [pad()];
    manager.update();
    assert.equal(manager.pausePressed, false);
  }
  manager.destroy();
  const fallback = new GamepadInput(() => [pad({ mapping: "", pressed: [9] })]);
  assert.equal(fallback.read().pause, false);
  fallback.destroy();
});

test("a held gamepad speed axis must return to neutral after reset", () => {
  const gamepad = source({ verticalAxis: -1 });
  const keyboard = source();
  const manager = new InputManager(keyboard, gamepad);
  assert.equal(manager.update().verticalAxis, -1);
  manager.reset();
  gamepad.state.verticalAxis = -1;
  assert.equal(manager.update().verticalAxis, 0);
  keyboard.state.up = true;
  assert.equal(manager.update().verticalAxis, -1);
  keyboard.state.up = false;
  gamepad.state.verticalAxis = 0;
  manager.update();
  gamepad.state.verticalAxis = -1;
  assert.equal(manager.update().verticalAxis, -1);
  manager.destroy();
});

test("deadzone removes drift, rescales continuously and clamps bad axes", () => {
  for (const value of [0, 0.17, -0.18, 0.18, NaN, Infinity]) assert.equal(applyDeadzone(value), 0);
  assert.ok(Math.abs(applyDeadzone(0.59) - 0.5) < 1e-10);
  assert.ok(Math.abs(applyDeadzone(-0.59) + 0.5) < 1e-10);
  assert.equal(applyDeadzone(2), 1);
  assert.equal(applyDeadzone(-2), -1);
});

test("standard sticks and D-pad expose independent analog and digital input", () => {
  const input = new GamepadInput(() => [pad({ axes: [0.59, -1], pressed: [0, 12, 14] })]);
  const state = input.read();
  assert.ok(Math.abs(state.horizontalAxis - 0.5) < 1e-10);
  assert.equal(state.verticalAxis, -1);
  assert.equal(state.left, true);
  assert.equal(state.up, true);
  assert.equal(state.jump, true);
});

test("polling discovers hotplug, replaces old snapshots and clears disconnected input", () => {
  let pads: (GamepadSnapshot | null)[] = [null];
  const input = new GamepadInput(() => pads);
  assert.equal(input.read().jump, false);
  pads = [null, pad({ index: 1, axes: [1, 0], pressed: [0] })];
  assert.equal(input.read().jump, true);
  assert.equal(input.status.connectedCount, 1);
  pads = [null, pad({ index: 1, axes: [-1, 0] })];
  assert.equal(input.read().horizontalAxis, -1);
  pads = [pad({ connected: false, pressed: [0] })];
  assert.deepEqual(input.read(), createDeviceInput());
  assert.equal(input.status.connectedCount, 0);
});

test("an idle controller does not block a second active controller", () => {
  let pads = [pad(), pad({ index: 1, axes: [-1, 0] })];
  const input = new GamepadInput(() => pads);
  assert.equal(input.read().horizontalAxis, -1);
  assert.equal(input.status.id, "Test controller 1");
  pads = [pad({ axes: [1, 0] }), pad({ index: 1 })];
  assert.equal(input.read().horizontalAxis, 1);
  assert.equal(input.status.id, "Test controller 0");
});

test("missing controls and nonstandard mappings use a conservative fallback", () => {
  const snapshot = { ...pad({ mapping: "", pressed: [14] }), axes: [], buttons: [] };
  const input = new GamepadInput(() => [snapshot]);
  assert.deepEqual(input.read(), createDeviceInput());
  assert.equal(input.status.mapping, "fallback");
  const fallback = new GamepadInput(() => [pad({ mapping: "", axes: [1, -1], pressed: [0, 14] })]);
  assert.equal(fallback.read().left, false);
  assert.equal(fallback.read().horizontalAxis, 1);
  assert.equal(fallback.read().jump, true);
});

test("unavailable or denied Gamepad API leaves keyboard controls working", () => {
  for (const provider of [() => null, () => { throw new Error("SecurityError"); }]) {
    const input = new GamepadInput(provider);
    const manager = new InputManager(source({ right: true }), input);
    assert.equal(manager.update().horizontalAxis, 1);
    assert.equal(input.status.available, false);
  }
});

test("digital input overrides analog per axis and opposite directions cancel", () => {
  const keyboard = source({ left: true });
  const controller = source({ horizontalAxis: 0.8, verticalAxis: -0.5 });
  const manager = new InputManager(keyboard, controller);
  assert.equal(manager.update().horizontalAxis, -1);
  assert.equal(manager.state.verticalAxis, -0.5);
  assert.equal(manager.state.accelerate, true);
  controller.state.right = true;
  assert.equal(manager.update().horizontalAxis, 0);
  assert.equal(manager.state.left, false);
  assert.equal(manager.state.right, false);
  keyboard.state.left = false;
  controller.state.right = false;
  assert.equal(manager.update().horizontalAxis, 0.8);
});

test("D-pad controls both axes, including simultaneous action and contradictory directions", () => {
  let current = pad({ axes: [-1, 1], pressed: [0, 12, 15] });
  const manager = new InputManager(source(), new GamepadInput(() => [current]));
  assert.equal(manager.update().horizontalAxis, 1);
  assert.equal(manager.state.verticalAxis, -1);
  assert.equal(manager.state.jumpPressed, true);
  current = pad({ axes: [1, -1], pressed: [12, 13, 14, 15] });
  assert.equal(manager.update().horizontalAxis, 0);
  assert.equal(manager.state.verticalAxis, 0);
});

test("jump edges are emitted once and overlapping devices do not retrigger", () => {
  const keyboard = source({ jump: true });
  const controller = source();
  const manager = new InputManager(keyboard, controller);
  assert.equal(manager.update().jumpPressed, true);
  assert.equal(manager.update().jumpPressed, false);
  controller.state.jump = true;
  keyboard.state.jump = false;
  assert.equal(manager.update().jumpPressed, false);
  assert.equal(manager.state.jump, true);
  controller.state.jump = false;
  assert.equal(manager.update().jumpReleased, true);
  assert.equal(manager.update().jumpReleased, false);
});

test("controller disconnection releases jump without discarding held keyboard input", () => {
  let connected = true;
  const keyboard = source({ left: true });
  const controller = new GamepadInput(() => connected ? [pad({ pressed: [0] })] : []);
  const manager = new InputManager(keyboard, controller);
  assert.equal(manager.update().jumpPressed, true);
  connected = false;
  assert.equal(manager.update().jumpReleased, true);
  assert.equal(manager.state.horizontalAxis, -1);
});

test("focus loss neutralizes state and a held gamepad must release before another jump", () => {
  let current = pad({ axes: [1, -1], pressed: [0] });
  const manager = new InputManager(source(), new GamepadInput(() => [current]));
  assert.equal(manager.update().jumpPressed, true);
  assert.equal(manager.update(false).horizontalAxis, 0);
  assert.equal(manager.state.jump, false);
  assert.equal(manager.update(true).jumpPressed, false);
  assert.equal(manager.state.jump, false);
  current = pad();
  manager.update();
  current = pad({ pressed: [0] });
  assert.equal(manager.update().jumpPressed, true);
});

test("arrow keys, WASD aliases and simultaneous actions share one state", () => {
  const { keyboard, key } = keyboardFixture();
  const manager = new InputManager(keyboard, source());
  assert.equal(key("keydown", "ArrowLeft").defaultPrevented, true);
  key("keydown", "KeyA");
  key("keyup", "ArrowLeft");
  key("keydown", "ArrowUp");
  key("keydown", "Space");
  assert.equal(manager.update().horizontalAxis, -1);
  assert.equal(manager.state.verticalAxis, -1);
  assert.equal(manager.state.jumpPressed, true);
  key("keydown", "Space", { repeat: true });
  assert.equal(manager.update().jumpPressed, false);
  key("keyup", "Space");
  assert.equal(manager.update().jumpReleased, true);
  keyboard.destroy();
});

test("short Space taps between frames are preserved exactly once, including after focus reset", () => {
  const { keyboard, key } = keyboardFixture();
  const manager = new InputManager(keyboard, source());
  manager.reset();
  key("keydown", "Space");
  key("keyup", "Space");
  assert.equal(manager.update().jumpPressed, true);
  assert.equal(manager.state.jumpReleased, true);
  assert.equal(manager.state.jump, false);
  assert.equal(manager.update().jumpPressed, false);
  assert.equal(manager.state.jumpReleased, false);
  manager.destroy();
});

test("unfocused games, form fields, shortcuts and composition keep browser behavior", () => {
  const { keyboard, key, document } = keyboardFixture();
  document.activeElement = new EventTarget();
  assert.equal(key("keydown", "Space").defaultPrevented, false);
  assert.equal(keyboard.read().jump, false);
  document.activeElement = null;
  assert.equal(key("keydown", "ArrowLeft").defaultPrevented, false);
  keyboard.destroy();
});

test("modifier shortcuts and composing input are ignored even with game focus", () => {
  const { keyboard, key } = keyboardFixture();
  for (const modifiers of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }, { isComposing: true }]) {
    assert.equal(key("keydown", "ArrowLeft", modifiers).defaultPrevented, false);
    assert.equal(keyboard.read().left, false);
  }
  assert.equal(key("keydown", "Tab").defaultPrevented, false);
  keyboard.destroy();
});

test("blur and hidden tabs clear held keys; destroy removes all keyboard listeners", () => {
  const { keyboard, key, target, document } = keyboardFixture();
  key("keydown", "ArrowLeft");
  target.dispatchEvent(new Event("blur"));
  assert.equal(keyboard.read().left, false);
  key("keydown", "ArrowLeft", { repeat: true });
  assert.equal(keyboard.read().left, false);
  key("keydown", "ArrowRight");
  document.defaultView.dispatchEvent(new Event("blur"));
  assert.equal(keyboard.read().right, false);
  key("keydown", "Space");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(keyboard.read().jumpPressed, false);
  document.visibilityState = "visible";
  keyboard.destroy();
  assert.equal(key("keydown", "Space").defaultPrevented, false);
  assert.equal(keyboard.read().jump, false);
});

test("connection events can be removed without leaving input handlers behind", () => {
  class Events extends EventTarget {
    listeners = 0;
    override addEventListener(...args: Parameters<EventTarget["addEventListener"]>) {
      this.listeners++;
      super.addEventListener(...args);
    }
    override removeEventListener(...args: Parameters<EventTarget["removeEventListener"]>) {
      this.listeners--;
      super.removeEventListener(...args);
    }
  }
  const events = new Events();
  const input = new GamepadInput(() => [], events);
  assert.equal(events.listeners, 2);
  input.destroy();
  assert.equal(events.listeners, 0);
});
