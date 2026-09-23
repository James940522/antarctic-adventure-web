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
  close(player.state.distanceTravelled, PLAYER_CONFIG.baseSpeed);
  assert.equal(player.state.currentSpeed, PLAYER_CONFIG.baseSpeed);
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

test("analog strength scales steering while the vertical axis adjusts speed", () => {
  const full = new Player();
  const half = new Player();
  advance(full, 0.25, { ...neutral, horizontalAxis: 1, verticalAxis: -1 });
  advance(half, 0.25, { ...neutral, horizontalAxis: 0.5, verticalAxis: -0.5 });
  close(half.state.courseX, full.state.courseX / 2);
  assert.equal(half.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.speedStep);
  assert.equal(full.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.speedStep);
});

test("speed increases without a gear cap, holds on release, and brakes to the automatic minimum", () => {
  const player = new Player();
  const up = { ...neutral, verticalAxis: -1 };
  const down = { ...neutral, verticalAxis: 1 };
  advance(player, 1, up);
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + PLAYER_CONFIG.speedStep);
  close(player.state.distanceTravelled, 220);
  player.update(neutral, 0);
  player.update(up, 0);
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed + 2 * PLAYER_CONFIG.speedStep);
  for (let i = 0; i < 1000; i++) { player.update(neutral, 0); player.update(up, 0); }
  const selected = PLAYER_CONFIG.baseSpeed + 1002 * PLAYER_CONFIG.speedStep;
  assert.equal(player.state.currentSpeed, selected);
  advance(player, 1);
  assert.equal(player.state.currentSpeed, selected);
  for (let i = 0; i < 1010; i++) { player.update(neutral, 0); player.update(down, 0); }
  assert.equal(player.state.selectedSpeed, PLAYER_CONFIG.baseSpeed);
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

test("high-speed jumps keep their full height but land within 24m at different frame rates", () => {
  for (const speed of [14, 22, 30, 62, 126, 254, 1022]) for (const fps of [20, 30, 60, 144]) {
    const player = new Player();
    for (let current = 14; current < speed; current += 8) {
      player.update({ ...neutral, verticalAxis: -1 }, 0);
      player.update(neutral, 0);
    }
    const duration = speed <= 30 ? 0.8 : 24 / speed;
    player.update({ ...neutral, jumpPressed: true }, 0);
    advance(player, duration / 2, neutral, fps);
    close(player.state.jumpHeight, 100);
    assert.equal(player.state.jumpPhase, "falling");
    advance(player, duration / 2, neutral, fps);
    assert.equal(player.state.jumpPhase, "grounded");
    close(player.state.distanceTravelled, Math.min(speed * 0.8, 24) * 10);
    advance(player, 0.1, { ...neutral, jump: true }, fps);
    assert.equal(player.state.jumpPhase, "grounded", "holding must not auto-jump after an early landing");
    player.update({ ...neutral, jumpPressed: true }, 0);
    assert.equal(player.state.jumpPhase, "rising");
  }
});

test("accelerating or braking midair changes the remaining duration without resetting the arc", () => {
  const player = new Player();
  for (let i = 0; i < 6; i++) {
    player.update({ ...neutral, verticalAxis: -1 }, 0);
    player.update(neutral, 0);
  }
  player.update({ ...neutral, jumpPressed: true }, 0);
  advance(player, 24 / 62 / 4);
  close(player.state.jumpHeight, 75);
  player.update({ ...neutral, verticalAxis: 1 }, 0);
  close(player.state.jumpHeight, 75);
  advance(player, 24 / 54 / 4);
  close(player.state.jumpHeight, 100);
  player.update({ ...neutral, verticalAxis: -1 }, 0);
  close(player.state.jumpHeight, 100);
  advance(player, 24 / 62 / 2);
  assert.equal(player.state.jumpPhase, "grounded");
  close(player.state.distanceTravelled, 240);
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
