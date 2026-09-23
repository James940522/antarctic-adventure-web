import assert from "node:assert/strict";
import test from "node:test";
import { sampleSpeed, speedTimeFraction, type SpeedMotion } from "./speed-motion.ts";

test("distance/time conversion stays consistent across acceleration, braking, and the rising floor", () => {
  for (const extraSpeed of [0, 0.001, 2, 80, 10_000_000]) {
    for (const manualAcceleration of [-80, 0, 80]) {
      const motion: SpeedMotion = { baseSpeed: 146, extraSpeed, manualAcceleration, seconds: 0.05 };
      for (const fraction of [0, 0.001, 0.25, 0.5, 0.8, 0.999, 1]) {
        const sample = sampleSpeed(motion, fraction);
        assert.ok(sample.speed >= sample.baseSpeed);
        assert.ok(Math.abs(speedTimeFraction(motion, sample.distance) - fraction) < 1e-9);
      }
    }
  }
});

test("irregular frame durations preserve held-control speed and integrated distance", () => {
  let baseSpeed = 140;
  let speed = 140;
  let distance = 0;
  for (const seconds of [0.008, 0.04, 0.012, 0.007, 0.033]) {
    const sample = sampleSpeed({ baseSpeed, extraSpeed: speed - baseSpeed, manualAcceleration: 80, seconds });
    baseSpeed = sample.baseSpeed;
    speed = sample.speed;
    distance += sample.distance;
  }
  assert.ok(Math.abs(speed - 148.01) < 1e-9);
  assert.ok(Math.abs(distance - 14.4005) < 1e-9);
});
