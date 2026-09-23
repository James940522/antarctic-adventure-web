import { PLAYER_CONFIG } from "../config/constants.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { TouchInput } from "./TouchInput.ts";
import { InputManager } from "./InputManager.ts";
import { createDeviceInput } from "./input.types.ts";
import { Player } from "../entities/Player.ts";

const idle = () => ({ read: createDeviceInput, reset() {}, destroy() {} });

test("two fingers can hold movement and jump through the real player model", () => {
  const touch = new TouchInput();
  const manager = new InputManager(idle(), idle(), touch);
  const player = new Player();
  touch.press(1, "left"); touch.press(2, "jump");
  for (let i = 0; i < 10; i++) player.update(manager.update(), 20);
  assert.ok(player.state.courseX < 0);
  assert.ok(player.state.jumpHeight > 0);
  touch.release(2);
  player.update(manager.update(), 20);
  assert.equal(manager.state.left, true);
  assert.equal(manager.state.jumpReleased, true);
  touch.release(1);
  assert.equal(manager.update().horizontalAxis, 0);
});

test("the last finger owns a held action and opposing arrows cancel", () => {
  const touch = new TouchInput();
  const manager = new InputManager(idle(), idle(), touch);
  touch.press(1, "right"); touch.press(2, "right");
  manager.update();
  touch.release(1);
  assert.equal(manager.update().horizontalAxis, 1);
  touch.press(3, "left");
  assert.equal(manager.update().horizontalAxis, 0);
  touch.release(2);
  assert.equal(manager.update().horizontalAxis, -1);
});

test("a short touch jump is preserved once and held touches never repeat jump", () => {
  const touch = new TouchInput();
  const manager = new InputManager(idle(), idle(), touch);
  touch.press(1, "jump"); touch.release(1);
  assert.equal(manager.update().jumpPressed, true);
  assert.equal(manager.update().jumpPressed, false);
  touch.press(2, "jump");
  assert.equal(manager.update().jumpPressed, true);
  touch.press(3, "jump");
  assert.equal(manager.update().jumpPressed, false);
  touch.release(2);
  assert.equal(manager.update().jump, true);
  touch.release(3);
  assert.equal(manager.update().jumpReleased, true);
});

test("touch and keyboard merge without duplicate jump or losing digital priority", () => {
  const keyboard = { ...createDeviceInput(), jump: true, left: true };
  const pad = { ...createDeviceInput(), horizontalAxis: 0.5 };
  const touch = new TouchInput();
  const manager = new InputManager({ ...idle(), read: () => keyboard }, { ...idle(), read: () => pad }, touch);
  assert.equal(manager.update().jumpPressed, true);
  touch.press(7, "jump"); touch.press(8, "right");
  assert.equal(manager.update().jumpPressed, false);
  assert.equal(manager.state.horizontalAxis, 0);
  keyboard.jump = false;
  assert.equal(manager.update().jump, true);
});

test("speed taps change speed once, while holding does not auto-repeat", () => {
  const touch = new TouchInput();
  const manager = new InputManager(idle(), idle(), touch);
  const player = new Player();
  touch.press(1, "up");
  for (let i = 0; i < 30; i++) player.update(manager.update(), 20);
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.speedStep);
  touch.release(1); player.update(manager.update(), 20);
  touch.press(2, "up"); touch.release(2);
  player.update(manager.update(), 20);
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + 2 * PLAYER_CONFIG.speedStep);
  player.update(manager.update(), 20);
  touch.press(3, "down"); touch.release(3);
  player.update(manager.update(), 20);
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.speedStep);
});

test("either hand can accelerate repeatedly, while simultaneous duplicate buttons count once", () => {
  const touch = new TouchInput();
  const manager = new InputManager(idle(), idle(), touch);
  const player = new Player();
  touch.press(1, "up"); touch.press(2, "up");
  player.update(manager.update(), 0);
  touch.release(1);
  player.update(manager.update(), 0);
  assert.equal(player.state.selectedSpeed, 220);
  touch.release(2);
  player.update(manager.update(), 0);
  for (let i = 0; i < 10; i++) {
    touch.press(i % 2 + 1, "up"); touch.release(i % 2 + 1);
    player.update(manager.update(), 0);
    player.update(manager.update(), 0);
  }
  assert.equal(player.state.selectedSpeed, 1020);
  touch.press(3, "up"); touch.press(4, "down");
  player.update(manager.update(), 0);
  assert.equal(player.state.selectedSpeed, 1020);
  manager.reset();
  player.update(manager.update(), 0);
  assert.equal(manager.state.verticalAxis, 0);
  assert.equal(player.state.selectedSpeed, 1020);
});

function fixture() {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: window, visibilityState: "visible" });
  const captures = new Set<number>();
  const button = {
    disabled: false, dataset: { gameAction: "left", pressed: "false" },
    closest: () => button,
    setPointerCapture: (id: number) => captures.add(id),
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => captures.delete(id),
  };
  let focused = false;
  const target = Object.assign(new EventTarget(), {
    ownerDocument: document, contains: (element: unknown) => element === button,
    focus: () => { focused = true; }, querySelectorAll: () => [button],
  });
  const input = new TouchInput(target as unknown as HTMLElement);
  function dispatch(to: EventTarget, type: string, id = 1) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, "target", { value: button });
    Object.assign(event, { pointerId: id, pointerType: "touch", button: 0 });
    to.dispatchEvent(event);
    return event;
  }
  return { target, window, document, input, dispatch, captures, button, focused: () => focused };
}

test("pointer capture supports holding off-button and cancel releases only that finger", () => {
  const f = fixture();
  const down = f.dispatch(f.target, "pointerdown");
  assert.equal(down.defaultPrevented, true);
  assert.equal(f.focused(), true);
  assert.ok(f.captures.has(1));
  assert.equal(f.input.read().left, true);
  f.dispatch(f.window, "pointercancel");
  assert.equal(f.input.read().left, false);
  assert.equal(f.button.dataset.pressed, "false");
  assert.equal(f.captures.size, 0);
  f.input.destroy();
});

test("a quick pointer jump survives release and lost capture while another finger keeps steering", () => {
  const f = fixture();
  const manager = new InputManager(idle(), idle(), f.input);
  const player = new Player();
  f.input.press(2, "left");
  f.button.dataset.gameAction = "jump";
  f.dispatch(f.target, "pointerdown", 1);
  f.dispatch(f.window, "pointerup", 1);
  f.dispatch(f.target, "lostpointercapture", 1);
  player.update(manager.update(), 20);
  assert.ok(player.state.jumpHeight > 0);
  assert.ok(player.state.courseX < 0);
  assert.equal(manager.state.jumpPressed, true);
  assert.equal(manager.update().jumpPressed, false);
  assert.equal(manager.state.left, true);
  manager.destroy();
});

test("lost capture, resize, hidden document and blur leave no held input", () => {
  const f = fixture();
  for (const [target, event] of [[f.target, "lostpointercapture"], [f.window, "resize"], [f.window, "blur"], [f.document, "visibilitychange"]] as const) {
    f.dispatch(f.target, "pointerdown");
    f.input.read();
    if (event === "visibilitychange") f.document.visibilityState = "hidden";
    f.dispatch(target, event);
    assert.deepEqual(f.input.read(), createDeviceInput());
    assert.equal(f.captures.size, 0);
  }
  f.input.destroy();
});

test("a canceled tap before the next frame cannot trigger movement or jump", () => {
  const f = fixture();
  for (const action of ["left", "jump"]) {
    f.button.dataset.gameAction = action;
    f.dispatch(f.target, "pointerdown");
    f.dispatch(f.window, "pointercancel");
    assert.deepEqual(f.input.read(), createDeviceInput());
  }
  f.input.destroy();
});

test("restart reset and unmount destroy clear touch state and detach listeners", () => {
  const f = fixture();
  const manager = new InputManager(idle(), idle(), f.input);
  f.dispatch(f.target, "pointerdown");
  manager.update();
  manager.reset();
  assert.equal(f.input.isActive, false);
  assert.equal(manager.update().horizontalAxis, 0);
  manager.destroy();
  f.dispatch(f.target, "pointerdown");
  assert.equal(f.input.isActive, false);
  assert.equal(f.button.dataset.pressed, "false");
});
