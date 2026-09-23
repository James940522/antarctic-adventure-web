import assert from "node:assert/strict";
import test from "node:test";
import { RankingStore } from "./RankingStore.ts";

test("rankings load only when opened, support error retry and never post records", async () => {
  let calls = 0;
  const store = new RankingStore("player", async (url, options) => {
    calls++;
    assert.equal(url, "/api/rankings?playerId=player");
    assert.notEqual(options?.method, "POST");
    if (calls === 1) return Response.json({}, { status: 503 });
    return Response.json({ rankings: [], totalPlayers: 0, myRanking: null });
  });
  assert.equal(calls, 0);
  await store.load(); assert.equal(store.getSnapshot().status, "error");
  await store.load(); assert.equal(store.getSnapshot().status, "ready");
  store.dispose();
});

test("late or aborted ranking responses never replace a newer request", async () => {
  const pending: ((r: Response) => void)[] = [];
  const store = new RankingStore("player", () => new Promise(resolve => pending.push(resolve)));
  const old = store.load(), latest = store.load();
  pending[1](Response.json({ rankings: [], totalPlayers: 2, myRanking: null })); await latest;
  pending[0](Response.json({ rankings: [], totalPlayers: 1, myRanking: null })); await old;
  assert.equal(store.getSnapshot().data?.totalPlayers, 2);
  const disposed = store.load(); store.dispose();
  pending[2](Response.json({ rankings: [], totalPlayers: 3, myRanking: null })); await disposed;
  assert.notEqual(store.getSnapshot().data?.totalPlayers, 3);
});

test("native fetch is invoked without binding it to the ranking store", async () => {
  const store = new RankingStore("player", async function (this: unknown) {
    assert.equal(this, undefined);
    return Response.json({ rankings: [], totalPlayers: 0, myRanking: null });
  });
  await store.load();
  assert.equal(store.getSnapshot().status, "ready");
  store.dispose();
});

const entry = {
  playerId: "550e8400-e29b-41d4-a716-446655440000", nickname: "펭귄",
  rank: 1, stage: 1, score: 1000, distance: 1000,
};

test("malformed top and personal rows become a retryable error instead of reaching the view", async () => {
  const invalid = [
    null, {}, { rankings: [], totalPlayers: 0 },
    { rankings: [null], totalPlayers: 1, myRanking: null },
    ...[
      { score: null }, { score: "1000" }, { distance: -1 }, { stage: 0 },
      { rank: 1.5 }, { rank: Number.MAX_SAFE_INTEGER + 1 },
      { playerId: "invalid" }, { nickname: {} }, { nickname: " " },
    ].flatMap(fields => [
      { rankings: [{ ...entry, ...fields }], totalPlayers: 1, myRanking: null },
      { rankings: [], totalPlayers: 1, myRanking: { ...entry, ...fields } },
    ]),
    { rankings: Array(101).fill(entry), totalPlayers: 101, myRanking: null },
  ];
  for (const data of invalid) {
    let retry = false;
    const store = new RankingStore(entry.playerId, async () => Response.json(retry
      ? { rankings: [entry], totalPlayers: 1, myRanking: entry } : data));
    await store.load();
    assert.deepEqual(store.getSnapshot(), { status: "error", data: null }, JSON.stringify(data));
    retry = true;
    await store.load();
    assert.equal(store.getSnapshot().status, "ready");
    assert.deepEqual(store.getSnapshot().data?.myRanking, entry);
    store.dispose();
  }
});

test("personal ranks beyond the top 100 and zero-score records remain valid", async () => {
  const mine = { ...entry, score: 0, distance: 0, rank: 125 };
  const store = new RankingStore(entry.playerId, async () => Response.json({
    rankings: [entry], totalPlayers: 200, myRanking: mine,
  }));
  await store.load();
  assert.equal(store.getSnapshot().status, "ready");
  assert.deepEqual(store.getSnapshot().data?.myRanking, mine);
  store.dispose();
});

test("timeout exposes retry immediately and ignores a late response even when transport ignores abort", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve!: (response: Response) => void;
  const store = new RankingStore(entry.playerId, () => new Promise(done => { resolve = done; }));
  const pending = store.load();
  t.mock.timers.tick(15_000);
  assert.deepEqual(store.getSnapshot(), { status: "error", data: null });
  resolve(Response.json({ rankings: [entry], totalPlayers: 1, myRanking: entry }));
  await pending;
  assert.equal(store.getSnapshot().status, "error");
  store.dispose();
});
