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

test("neutral input advances automatically at the initial speed", () => {
  const player = new Player();
  advance(player, 1);
  close(player.state.distanceTravelled, PLAYER_CONFIG.speeds[0]);
  assert.equal(player.state.currentSpeed, PLAYER_CONFIG.speeds[0]);
  assert.equal(player.state.courseX, 0);
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

test("analog strength scales steering while the vertical axis selects a gear", () => {
  const full = new Player();
  const half = new Player();
  advance(full, 0.25, { ...neutral, horizontalAxis: 1, verticalAxis: -1 });
  advance(half, 0.25, { ...neutral, horizontalAxis: 0.5, verticalAxis: -0.5 });
  close(half.state.courseX, full.state.courseX / 2);
  assert.equal(half.state.speedLevel, 2);
  assert.equal(full.state.speedLevel, 2);
});

test("speed changes once per press, holds on release, and stays in gears 1 through 3", () => {
  const player = new Player();
  const up = { ...neutral, verticalAxis: -1 };
  const down = { ...neutral, verticalAxis: 1 };
  advance(player, 1, up);
  assert.equal(player.state.speedLevel, 2);
  close(player.state.distanceTravelled, 220);
  player.update(neutral, 0);
  player.update(up, 0);
  assert.equal(player.state.speedLevel, 3);
  player.update(neutral, 0);
  advance(player, 1, up);
  assert.equal(player.state.currentSpeed, 320);
  for (let i = 0; i < 4; i++) { player.update(neutral, 0); player.update(down, 0); }
  assert.equal(player.state.speedLevel, 1);
  assert.equal(player.state.currentSpeed, 140);
  advance(player, 1);
  assert.equal(player.state.currentSpeed, 140);
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

test("midair presses are ignored instead of restarting or buffering a jump", () => {
  const player = new Player();
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 0.5);
  player.update({ ...neutral, jumpPressed: true }, 0);
  close(player.state.jumpElapsedSeconds, 0.5);
  advance(player, 0.3);
  assert.equal(player.state.jumpPhase, "grounded");
  advance(player, 0.1);
  assert.equal(player.state.jumpPhase, "grounded");
  player.update({ ...neutral, jumpPressed: true }, 0);
  assert.equal(player.state.jumpPhase, "rising");
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
  close(player.state.currentSpeed, 220);
  close(player.state.distanceTravelled, 11);
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
