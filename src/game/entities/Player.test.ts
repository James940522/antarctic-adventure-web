import assert from "node:assert/strict";
import test from "node:test";

import { PLAYER_CONFIG } from "../config/constants.ts";
import { GamepadInput, type GamepadSnapshot } from "../input/GamepadInput.ts";
import { InputManager } from "../input/InputManager.ts";
import { createDeviceInput, type GameInputState } from "../input/input.types.ts";
import { Player } from "./Player.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false,
  horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};

function advance(player: Player, seconds: number, input = neutral, fps = 60) {
  let remainingMs = seconds * 1000;
  while (remainingMs > 1e-8) {
    const delta = Math.min(1000 / fps, remainingMs);
    player.update(input, delta);
    remainingMs -= delta;
  }
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
}

// Seed high-speed jump fixtures independently of the control scheme.
function accelerateTo(player: Player, speed: number) {
  Object.assign(player.state, { currentSpeed: speed * 10, selectedSpeed: speed * 10 });
}

test("neutral input starts at 14m/s and gradually gains 0.6m/s per driving minute at every FPS", () => {
  for (const fps of [20, 30, 60, 144]) {
    const player = new Player();
    close(player.state.currentSpeed, 140);
    advance(player, 60, neutral, fps);
    close(player.state.baseSpeed, 146);
    close(player.state.currentSpeed, 146);
    close(player.state.distanceTravelled, 8580);
    advance(player, 240, neutral, fps);
    close(player.state.baseSpeed, 170);
    close(player.state.currentSpeed, 170);
    close(player.state.distanceTravelled, 46500);
    assert.equal(player.state.courseX, 0);
  }
});

test("a partial-frame stop integrates both accelerations only until contact", () => {
  const player = new Player();
  const previous = { ...player.state };
  player.update({ ...neutral, verticalAxis: -1 }, 50);
  player.stopAt(previous, 0.25);
  close(player.state.baseSpeed, 140.00125);
  close(player.state.selectedSpeed, 141.00125);
  close(player.state.currentSpeed, 141.00125);
  close(player.state.distanceTravelled, 140 * 0.0125 + 80.1 * 0.0125 ** 2 / 2);
});

test("held directions stop at both course edges and reverse immediately", () => {
  const player = new Player();
  const right = { ...neutral, horizontalAxis: 1 };
  const left = { ...neutral, horizontalAxis: -1 };
  advance(player, 10, right);
  assert.equal(player.state.courseX, PLAYER_CONFIG.courseLimit);
  player.update(left, 20);
  assert.ok(player.state.courseX < PLAYER_CONFIG.courseLimit);
  advance(player, 10, left);
  assert.equal(player.state.courseX, -PLAYER_CONFIG.courseLimit);
  advance(player, 1);
  assert.equal(player.state.courseX, -PLAYER_CONFIG.courseLimit);
});

test("analog strength scales steering while the vertical axis adjusts speed", () => {
  const full = new Player();
  const half = new Player();
  advance(full, 0.25, { ...neutral, horizontalAxis: 1, verticalAxis: -1 });
  advance(half, 0.25, { ...neutral, horizontalAxis: 0.5, verticalAxis: -0.5 });
  close(half.state.courseX, full.state.courseX / 2);
  close(half.state.selectedSpeed, half.state.baseSpeed + (PLAYER_CONFIG.manualAcceleration * 0.25));
  close(full.state.selectedSpeed, full.state.baseSpeed + (PLAYER_CONFIG.manualAcceleration * 0.25));
});

test("held speed control is uncapped, retains its offset on release, and brakes to the growing minimum", () => {
  for (const fps of [20, 30, 60, 144]) {
    const player = new Player();
    const up = { ...neutral, verticalAxis: -1 };
    const down = { ...neutral, verticalAxis: 1 };
    advance(player, 1, up, fps);
    close(player.state.currentSpeed, 220.1);
    close(player.state.distanceTravelled, 180.05);
    advance(player, 1, neutral, fps);
    close(player.state.currentSpeed, 220.2);
    advance(player, 120, up, fps);
    close(player.state.currentSpeed, 9832.2);
    advance(player, 121.03, down, fps);
    close(player.state.currentSpeed, player.state.baseSpeed);
    close(player.state.baseSpeed, 164.303);
    advance(player, 1, down, fps);
    close(player.state.currentSpeed, 164.403);
  }
});

test("short taps and zero-time frames cannot create instantaneous speed steps", () => {
  const player = new Player();
  for (let i = 0; i < 100; i++) player.update({ ...neutral, verticalAxis: -1 }, 0);
  close(player.state.currentSpeed, 140);
  player.update({ ...neutral, verticalAxis: -1 }, 10);
  close(player.state.currentSpeed, 140.801);
  player.update(neutral, 10);
  close(player.state.currentSpeed, 140.802);
  player.update({ ...neutral, verticalAxis: 1 }, 10);
  close(player.state.currentSpeed, 140.003);
});

test("braking that reaches the floor partway through a frame integrates both time segments", () => {
  const player = new Player();
  Object.assign(player.state, { currentSpeed: 142, selectedSpeed: 142 });
  const previous = { ...player.state };
  player.update({ ...neutral, verticalAxis: 1 }, 50);
  close(player.state.currentSpeed, 140.005);
  close(player.state.distanceTravelled, 7.025125);
  player.stopAt(previous, 0.25);
  close(player.state.currentSpeed, 141.00125);
  close(player.state.distanceTravelled, 142 * 0.0125 - 79.9 * 0.0125 ** 2 / 2);
});

test("a short jump tap reaches the apex and lands while horizontal movement continues", () => {
  const player = new Player();
  player.update({ ...neutral, jumpPressed: true, jumpReleased: true }, 0);
  assert.equal(player.state.jumpPhase, "rising");
  advance(player, 0.4, { ...neutral, horizontalAxis: 0.5 });
  close(player.state.jumpHeight, PLAYER_CONFIG.jumpHeight);
  assert.equal(player.state.jumpPhase, "falling");
  close(player.state.courseX, 0.28);
  advance(player, 0.4);
  assert.equal(player.state.jumpPhase, "grounded");
  assert.equal(player.state.jumpHeight, 0);
});

test("presses before the landing buffer window are ignored without restarting the jump", () => {
  const player = new Player();
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 0.679);
  player.update({ ...neutral, jumpPressed: true }, 0);
  close(player.state.jumpElapsedSeconds, 0.679);
  advance(player, 0.121);
  assert.equal(player.state.jumpPhase, "grounded");
  advance(player, 0.1);
  assert.equal(player.state.jumpPhase, "grounded");
  player.update({ ...neutral, jumpPressed: true }, 0);
  assert.equal(player.state.jumpPhase, "rising");
});

test("jumps keep 0.8 seconds of airtime and 150 units of height at every speed and frame rate", () => {
  for (const speed of [14, 22, 30, 38, 62, 94, 134, 174, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
    const player = new Player();
    accelerateTo(player, speed);
    player.update({ ...neutral, jumpPressed: true }, 0);
    advance(player, 0.4, neutral, fps);
    close(player.state.jumpHeight, 150);
    assert.equal(player.state.jumpPhase, "falling");
    close(player.state.jumpElapsedSeconds, 0.4);
    advance(player, 0.399, neutral, fps);
    assert.equal(player.state.jumpPhase, "falling", `${speed}m/s at ${fps} FPS must stay airborne until 0.8s`);
    assert.ok(player.state.jumpHeight > 0);
    advance(player, 0.001, neutral, fps);
    assert.equal(player.state.jumpPhase, "grounded");
    close(player.state.distanceTravelled, speed * 0.8 * 10 + 0.5 * PLAYER_CONFIG.baseAcceleration * 0.8 ** 2);
    advance(player, 0.1, { ...neutral, jump: true }, fps);
    assert.equal(player.state.jumpPhase, "grounded", "holding must not auto-jump after landing");
    player.update({ ...neutral, jumpPressed: true }, 0);
    assert.equal(player.state.jumpPhase, "rising");
  }
});

test("accelerating or braking midair changes distance without changing the jump arc or airtime", () => {
  const player = new Player();
  accelerateTo(player, 174);
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 0.2);
  close(player.state.jumpHeight, 112.5);
  advance(player, 0.2, { ...neutral, verticalAxis: 1 });
  close(player.state.currentSpeed, 1724.04);
  close(player.state.jumpHeight, 150);
  advance(player, 0.2, { ...neutral, verticalAxis: -1 });
  close(player.state.currentSpeed, 1740.06);
  close(player.state.jumpHeight, 112.5);
  advance(player, 0.2);
  assert.equal(player.state.jumpPhase, "grounded");
  close(player.state.distanceTravelled, 1740 * 0.8 - 3.2 + 0.5 * PLAYER_CONFIG.baseAcceleration * 0.8 ** 2);
});

test("a fresh press in the final 0.12 seconds queues one jump without restarting the falling arc", () => {
  for (const speed of [94, 134, 174, 1022]) for (const fps of [20, 30, 60, 144]) {
    const player = new Player();
    accelerateTo(player, speed);
    player.update({ ...neutral, jumpPressed: true }, 0);
    advance(player, 0.68, neutral, fps);
    const beforePress = { ...player.state };
    player.update({ ...neutral, jumpPressed: true, jumpReleased: true }, 0);
    assert.deepEqual(player.state, beforePress, "buffering must leave the current arc unchanged");
    advance(player, 0.1, neutral, fps);
    close(player.state.jumpElapsedSeconds, 0.78);
    assert.equal(player.state.jumpPhase, "falling");
    player.update(neutral, 50);
    assert.equal(player.state.jumpPhase, "rising");
    close(player.state.jumpElapsedSeconds, 0.03);
    close(player.state.jumpHeight, 4 * 150 * (0.03 / 0.8) * (1 - 0.03 / 0.8));
    close(player.state.distanceTravelled, speed * 0.83 * 10 + 0.5 * PLAYER_CONFIG.baseAcceleration * 0.83 ** 2);
    advance(player, 1, { ...neutral, jump: true }, fps);
    assert.equal(player.state.jumpPhase, "grounded", "a queued tap must be consumed exactly once");
  }
});

test("holding through the landing buffer window never queues an automatic jump", () => {
  const player = new Player();
  accelerateTo(player, 174);
  player.update({ ...neutral, jump: true, jumpPressed: true }, 0);
  advance(player, 1.6, { ...neutral, jump: true });
  assert.equal(player.state.jumpPhase, "grounded");
  assert.equal(player.state.jumpHeight, 0);
});

test("clearing a queued jump preserves the current arc and prevents a later launch", () => {
  const player = new Player();
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 0.72);
  player.update({ ...neutral, jumpPressed: true }, 0);
  const beforeClear = { ...player.state };
  player.clearBufferedJump();
  assert.deepEqual(player.state, beforeClear);
  advance(player, 0.08);
  assert.equal(player.state.jumpPhase, "grounded");
  advance(player, 0.2);
  assert.equal(player.state.jumpPhase, "grounded");
});

test("arriving at a landmark clears the queued jump before departure", () => {
  const player = new Player();
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 0.72);
  player.update({ ...neutral, jumpPressed: true }, 0);
  player.arriveAt(1000);
  player.depart();
  advance(player, 1, { ...neutral, jump: true });
  assert.equal(player.state.jumpPhase, "grounded");
  assert.equal(player.state.jumpHeight, 0);
});

test("30, 60 and 144 FPS give the same movement, speed, distance and jump timing", () => {
  const results = [30, 60, 144].map((fps) => {
    const player = new Player();
    advance(player, 2.25, { ...neutral, verticalAxis: -1 }, fps);
    advance(player, 1.8, { ...neutral, verticalAxis: 1 }, fps);
    player.update({ ...neutral, jumpPressed: true }, 0);
    advance(player, 0.4, { ...neutral, horizontalAxis: -1 }, fps);
    const apex = { ...player.state };
    advance(player, 0.4, neutral, fps);
    return { apex, landing: { ...player.state } };
  });
  for (const result of results) {
    close(result.apex.jumpHeight, PLAYER_CONFIG.jumpHeight);
    close(result.apex.courseX, -0.56);
    close(result.apex.distanceTravelled, results[0].apex.distanceTravelled);
    close(result.apex.currentSpeed, results[0].apex.currentSpeed);
    assert.equal(result.landing.jumpPhase, "grounded");
  }
});

test("invalid deltas do nothing and a long frame advances all simulation by only 50 ms", () => {
  const player = new Player();
  const input = { ...neutral, horizontalAxis: 1, verticalAxis: -1, jumpPressed: true };
  const initial = { ...player.state };
  for (const delta of [-10, NaN, Infinity]) player.update(input, delta);
  assert.deepEqual(player.state, initial);
  player.update(input, 30_000);
  close(player.state.courseX, 0.07);
  close(player.state.baseSpeed, 140.005);
  close(player.state.currentSpeed, 144.005);
  close(player.state.distanceTravelled, 7.100125);
  close(player.state.jumpElapsedSeconds, 0.05);
});

test("digital input and a polled standard gamepad drive identical player behavior", () => {
  const keys = { ...createDeviceInput(), right: true, up: true, jump: true };
  const idle = { read: createDeviceInput, reset() {}, destroy() {} };
  const digital = new InputManager({ ...idle, read: () => keys }, idle);
  const snapshot: GamepadSnapshot = {
    index: 0, id: "Test gamepad", mapping: "standard", connected: true,
    axes: [1, -1], buttons: [{ pressed: true, value: 1 }],
  };
  const analog = new InputManager(idle, new GamepadInput(() => [snapshot]));
  const keyboardPlayer = new Player();
  const gamepadPlayer = new Player();
  for (let frame = 0; frame < 120; frame++) {
    keyboardPlayer.update(digital.update(), 1000 / 60);
    gamepadPlayer.update(analog.update(), 1000 / 60);
    assert.deepEqual(keyboardPlayer.state, gamepadPlayer.state);
  }
  // Still-held jump buttons must not launch a second jump after landing.
  assert.equal(keyboardPlayer.state.jumpPhase, "grounded");
  assert.equal(gamepadPlayer.state.jumpPhase, "grounded");
  digital.destroy();
  analog.destroy();
});
