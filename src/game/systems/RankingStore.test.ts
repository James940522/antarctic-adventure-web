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
