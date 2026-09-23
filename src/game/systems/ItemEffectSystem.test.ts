import assert from "node:assert/strict";
import test from "node:test";
import { LANDMARK_CONFIG, RUN_CONFIG } from "../config/constants.ts";
import { ITEM_DEFINITIONS, type ItemDefinition, type ItemEffectType, type ItemType } from "../data/items.ts";
import type { GameInputState } from "../input/input.types.ts";
import { ghostCountdown, ghostOpacity, ItemEffectSystem } from "./ItemEffectSystem.ts";
import { LandmarkSystem } from "./LandmarkSystem.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test("suspension retains every effect independently while suppressing time, abilities and visuals", () => {
  const definitions = ITEM_DEFINITIONS as Record<string, ItemDefinition>;
  const companion = "test-companion" as ItemType;
  const companionEffect = "test-effect" as ItemEffectType;
  definitions[companion] = { ...ITEM_DEFINITIONS["ghost-penguin"], effect: { type: companionEffect, durationSeconds: 8 } };
  try {
    const effects = new ItemEffectSystem();
    effects.apply("ghost-penguin");
    effects.apply(companion);
    effects.advance(6);
    const opacity = ghostOpacity(effects.ghostSeconds);
    effects.setSuspended(true);
    effects.setSuspended(true);
    effects.advance(100);
    assert.equal(effects.isSuspended, true);
    assert.equal(effects.remainingSeconds("ghost"), 4);
    assert.equal(effects.remainingSeconds(companionEffect), 2);
    assert.equal(effects.activeSeconds("ghost"), 0);
    assert.equal(effects.activeSeconds(companionEffect), 0);
    assert.equal(effects.ignoresObstacles, false);
    assert.equal(effects.nextExpirationSeconds, Infinity);
    assert.equal(ghostOpacity(effects.ghostSeconds), 1);
    assert.equal(ghostCountdown(effects.ghostSeconds), null);

    effects.setSuspended(false);
    effects.setSuspended(false);
    assert.equal(effects.activeSeconds("ghost"), 4);
    assert.equal(effects.activeSeconds(companionEffect), 2);
    assert.equal(ghostOpacity(effects.ghostSeconds), opacity, "blink resumes at the same phase");
    assert.equal(ghostCountdown(effects.ghostSeconds), 4);
    assert.equal(effects.ignoresObstacles, true);
    effects.advance(2);
    assert.equal(effects.activeSeconds(companionEffect), 0);
    assert.equal(effects.ghostSeconds, 2);
    effects.setSuspended(true);
    effects.reset();
    assert.equal(effects.isSuspended, false);
    assert.equal(effects.remainingSeconds("ghost"), 0);
    assert.equal(effects.remainingSeconds(companionEffect), 0);
    effects.setSuspended(false);
    assert.equal(effects.ghostSeconds, 0, "cleared effects cannot return after restart");
  } finally { delete definitions[companion]; }
});

test("arrival suspends effects in the contact frame and departure restores the exact remaining time at every FPS", () => {
  for (const fps of [30, 60, 144]) {
    let arrivalObserved = false;
    const landmarks = new LandmarkSystem(undefined, () => {
      arrivalObserved = true;
      assert.equal(run.effects.isSuspended, true, "arrival callbacks see suspension immediately");
      assert.equal(run.effects.ghostSeconds, 0);
    });
    const run = new RunSystem(undefined, () => 0.5, landmarks);
    run.obstacles.update = () => {};
    run.items.update = () => {};
    const deltaMs = 1000 / fps;
    const secondsToArrival = deltaMs / 2000;
    const arrivalDistance = landmarks.next!.distance * RUN_CONFIG.unitsPerMeter;
    Object.assign(run.player.state, { distanceTravelled: arrivalDistance - run.player.state.currentSpeed * secondsToArrival });
    run.effects.apply("ghost-penguin");
    run.effects.advance(6);
    run.update(neutral, deltaMs);
    assert.equal(arrivalObserved, true);
    assert.equal(run.status, "celebrating");
    assert.equal(run.player.state.currentSpeed, 0);
    const stored = 4 - secondsToArrival;
    near(run.effects.remainingSeconds("ghost"), stored);
    near(run.elapsedSeconds, secondsToArrival);
    assert.equal(ghostOpacity(run.effects.ghostSeconds), 1);
    assert.equal(ghostCountdown(run.effects.ghostSeconds), null);

    run.setPaused(true);
    run.update(neutral, 50);
    assert.equal(landmarks.celebrationElapsedSeconds, 0);
    near(run.effects.remainingSeconds("ghost"), stored);
    run.setPaused(false);
    for (let elapsed = 0; elapsed < LANDMARK_CONFIG.celebrationSeconds - 1e-9;) {
      const step = Math.min(deltaMs / 1000, LANDMARK_CONFIG.celebrationSeconds - elapsed);
      run.update(neutral, step * 1000);
      elapsed += step;
      near(run.effects.remainingSeconds("ghost"), stored);
      if (run.status === "celebrating") assert.equal(run.effects.ghostSeconds, 0);
    }
    assert.equal(run.status, "running");
    assert.equal(run.effects.isSuspended, false);
    near(run.effects.ghostSeconds, stored);
    assert.equal(ghostCountdown(run.effects.ghostSeconds), 4);
    assert.equal(ghostOpacity(run.effects.ghostSeconds), ghostOpacity(stored));
    assert.equal(run.effects.ignoresObstacles, true);
    assert.equal(run.player.state.currentSpeed, run.player.state.selectedSpeed);
    run.update(neutral, deltaMs);
    near(run.effects.ghostSeconds, stored - deltaMs / 1000);
  }
});

test("effects expiring at arrival stay expired, and restarting during celebration clears suspension", () => {
  for (const expireAtArrival of [true, false]) {
    const run = new RunSystem(undefined, () => 0.5);
    run.items.update = () => {};
    run.obstacles.update = () => {};
    const destination = run.landmarks.next!.distance * RUN_CONFIG.unitsPerMeter;
    Object.assign(run.player.state, { distanceTravelled: destination - 3.5 });
    run.effects.apply("ghost-penguin");
    if (expireAtArrival) run.effects.advance(9.975);
    run.update(neutral, 50);
    assert.equal(run.status, "celebrating");
    if (expireAtArrival) {
      assert.equal(run.effects.remainingSeconds("ghost"), 0);
      for (let i = 0; i < 50; i++) run.update(neutral, 50);
      assert.equal(run.effects.ghostSeconds, 0);
      assert.equal(run.effects.ignoresObstacles, false);
    } else {
      assert.ok(run.effects.remainingSeconds("ghost") > 0);
      run.restart();
      assert.equal(run.status, "running");
      assert.equal(run.effects.isSuspended, false);
      assert.equal(run.effects.remainingSeconds("ghost"), 0);
      assert.equal(run.effects.ghostSeconds, 0);
    }
  }
});
