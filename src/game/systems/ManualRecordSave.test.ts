import assert from "node:assert/strict";
import test from "node:test";
import { LANDMARK_CONFIG } from "../config/constants.ts";
import type { GameInputState } from "../input/input.types.ts";
import type { GameRecordPayload } from "../types/game-record.types.ts";
import { isUuid } from "../utils/uuid.ts";
import { createGameRecord, createRecordSubmitter, ManualRecordSave } from "./ManualRecordSave.ts";
import { RunSystem } from "./RunSystem.ts";

const neutral: GameInputState = {
  left: false, right: false, accelerate: false, brake: false, horizontalAxis: 0, verticalAxis: 0,
  jump: false, jumpPressed: false, jumpReleased: false,
};
const player = { id: "550e8400-e29b-41d4-a716-446655440000", nickname: "James" };
function finishedRun() {
  const run = new RunSystem();
  run.obstacles.items.splice(0, run.obstacles.items.length, { id: 1, type: "supply-crate", startLane: 3, courseX: 0, distance: 100 });
  for (let i = 0; i < 20; i++) run.update(neutral, 50);
  assert.equal(run.status, "gameover");
  return run;
}

test("run identity survives movement, pause and game over; retry and new games get new identities", () => {
  const run = new RunSystem();
  const id = run.snapshot(false, true).runId;
  assert.ok(isUuid(id));
  run.update(neutral, 50);
  run.setPaused(true);
  run.update(neutral, 50);
  assert.equal(run.snapshot(true, false).runId, id);
  run.setPaused(false);
  run.obstacles.items.splice(0, run.obstacles.items.length, { id: 1, type: "supply-crate", startLane: 3, courseX: 0, distance: 100 });
  for (let i = 0; i < 20; i++) run.update(neutral, 50);
  assert.equal(run.status, "gameover");
  assert.equal(run.snapshot(false, true).runId, id);
  run.restart();
  const restarted = run.snapshot(false, true);
  assert.ok(isUuid(restarted.runId));
  assert.notEqual(restarted.runId, id);
  assert.notEqual(new RunSystem().snapshot(false, true).runId, restarted.runId);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.stage, 1);
  assert.equal(restarted.playTime, 0);
});

test("record metrics use distance, completed landmarks and active whole seconds without changing gameplay", () => {
  const run = new RunSystem();
  for (let i = 0; i < 25; i++) run.update(neutral, 50);
  const snapshot = run.snapshot(false, true);
  assert.equal(snapshot.score, snapshot.distance);
  assert.equal(snapshot.playTime, 1);
  run.setPaused(true);
  for (let i = 0; i < 50; i++) run.update(neutral, 50);
  assert.equal(run.snapshot(true, false).playTime, 1);
  let completed = 0;
  while (run.landmarks.next) {
    run.landmarks.update(run.landmarks.next.distance);
    assert.equal(run.snapshot(false, false).stage, completed + 1);
    run.landmarks.advanceCelebration(LANDMARK_CONFIG.celebrationSeconds);
    assert.equal(run.snapshot(false, false).stage, ++completed + 1);
  }
  assert.equal(run.snapshot(false, false).playTime, 1);
  run.restart();
  assert.equal(run.snapshot(false, true).stage, 1);
});

test("only a finished run becomes an immutable payload; later retry and nickname changes cannot alter it", () => {
  assert.throws(() => createGameRecord(new RunSystem().snapshot(false, true), player));
  const run = finishedRun();
  const profile = { ...player };
  const snapshot = run.snapshot(false, true);
  const record = createGameRecord(snapshot, profile);
  assert.deepEqual(record, {
    runId: snapshot.runId, playerId: player.id, nickname: "James", score: 8, stage: 1, distance: 8, playTime: 0,
  });
  assert.ok(Object.isFrozen(record));
  profile.nickname = "Penguin";
  run.restart();
  assert.equal(record.nickname, "James");
  assert.notEqual(record.runId, run.snapshot(false, true).runId);
});

test("saving is explicit and double clicks plus saved clicks submit a run only once", async () => {
  const record = createGameRecord(finishedRun().snapshot(false, true), player);
  const requests: GameRecordPayload[] = [];
  let resolve!: (value: { success: true }) => void;
  const save = new ManualRecordSave(record, payload => {
    requests.push(payload);
    return new Promise(done => { resolve = done; });
  });
  const states: string[] = [];
  const unsubscribe = save.subscribe(() => states.push(save.getSnapshot().status));
  assert.equal(save.getSnapshot().status, "idle");
  assert.equal(requests.length, 0);
  const pending = save.save();
  await save.save();
  assert.equal(save.getSnapshot().status, "saving");
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0], record);
  resolve({ success: true });
  await pending;
  await save.save();
  assert.equal(requests.length, 1);
  assert.deepEqual(states, ["saving", "saved"]);
  unsubscribe();
});

test("failed saves can retry the same run, including an already-saved acknowledgement", async () => {
  const record = createGameRecord(finishedRun().snapshot(false, true), player);
  const requests: GameRecordPayload[] = [];
  const save = new ManualRecordSave(record, async payload => {
    requests.push(payload);
    if (requests.length === 1) throw new Error("offline");
    return { success: true, alreadySaved: true };
  });
  await save.save();
  assert.equal(save.getSnapshot().status, "error");
  await save.save();
  assert.equal(save.getSnapshot().status, "saved");
  assert.match(save.getSnapshot().message!, /이미 저장/);
  assert.equal(requests[0].runId, requests[1].runId);
});

test("a previous pending save cannot mark the next run saved, and a rejected service never reports success", async () => {
  const run = finishedRun();
  let resolve!: (value: { success: true }) => void;
  const previous = new ManualRecordSave(createGameRecord(run.snapshot(false, true), player), () => new Promise(done => { resolve = done; }));
  const pending = previous.save();
  const next = new ManualRecordSave(createGameRecord(finishedRun().snapshot(false, true), player), async () => { throw new Error("offline"); });
  resolve({ success: true });
  await pending;
  assert.equal(next.getSnapshot().status, "idle");
  await next.save();
  assert.equal(next.getSnapshot().status, "error");
});

test("manual transport calls only the Next API and requires a successful acknowledgement", async () => {
  const payload = createGameRecord(finishedRun().snapshot(false, true), player);
  const submit = createRecordSubmitter(async (url, options) => {
    assert.equal(url, "/api/records");
    assert.equal(options?.method, "POST");
    assert.deepEqual(JSON.parse(String(options?.body)), payload);
    return Response.json({ success: true, alreadySaved: true });
  });
  assert.deepEqual(await submit(payload), { success: true, alreadySaved: true });
  for (const response of [Response.json({ success: false }), new Response("bad", { status: 502 }), Response.json({ error: "오류" }, { status: 400 })]) {
    const save = new ManualRecordSave(payload, createRecordSubmitter(async () => response));
    await save.save();
    assert.equal(save.getSnapshot().status, "error");
  }
});
