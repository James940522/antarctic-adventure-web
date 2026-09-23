import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.ts";
import type { GameRecordPayload } from "../game/types/game-record.types.ts";
import { validateRecord } from "./record-validation.ts";
import { createRecordHandlers } from "./http-handlers.ts";
import { readRankings, type RecordsRepository, type StoredRecord, type LeaderboardRow } from "./record-service.ts";
import { createRecordsRepository, aheadFilter } from "./record-repository.ts";

const playerId = "550e8400-e29b-41d4-a716-446655440000";
const payload: GameRecordPayload = { runId: "550e8400-e29b-41d4-a716-446655440001", playerId, nickname: "James", score: 2000, stage: 1, distance: 1000, playTime: 36 };
const row: LeaderboardRow = { player_id: playerId, nickname: "James", score: 2000, stage: 1, distance: 1000, play_time: 36, created_at: "2026-09-23T00:00:00.123456+00:00" };
function repository(): RecordsRepository & { records: Map<string, StoredRecord> } {
  const records = new Map<string, StoredRecord>();
  return {
    records,
    async insert(p) {
      if (records.has(p.runId)) return "duplicate";
      records.set(p.runId, { id: p.runId, run_id: p.runId, player_id: p.playerId, nickname: p.nickname,
        score: p.score, stage: p.stage, distance: p.distance, play_time: p.playTime, created_at: row.created_at });
      return "inserted";
    },
    async findRun(id) { return records.get(id) ?? null; },
    async top() { return { rows: [], total: 0 }; },
    async findPlayer() { return null; }, async countAhead() { return 0; },
  };
}
function request(body: unknown) { return new Request("https://game.test/api/records", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://game.test" }, body: JSON.stringify(body) }); }

test("server validates UUIDs, Unicode nickname and database numeric bounds without coercion", () => {
  assert.deepEqual(validateRecord({ ...payload, nickname: "  펭귄🐧  ", playerId: playerId.toUpperCase() }), { ...payload, nickname: "펭귄🐧" });
  for (const field of ["runId", "playerId"]) for (const value of [null, "", "bad", 123]) assert.equal(validateRecord({ ...payload, [field]: value }), null);
  for (const value of ["", " ", "x", "x".repeat(13), "ab\nc", null]) assert.equal(validateRecord({ ...payload, nickname: value }), null);
  assert.ok(validateRecord({ ...payload, nickname: "🐧".repeat(12) }));
  for (const field of ["score", "distance", "playTime", "stage"]) for (const value of [-1, 1.5, "1", null, NaN, Infinity, 2147483648]) assert.equal(validateRecord({ ...payload, [field]: value }), null);
  assert.ok(validateRecord({ ...payload, score: 2147483647, stage: 11 }));
  assert.equal(validateRecord({ ...payload, stage: 12 }), null);
  assert.equal(validateRecord({ ...payload, stage: 0 }), null);
});

test("POST rejects malformed, oversized and cross-origin requests before touching the DB", async () => {
  const api = createRecordHandlers(() => { throw new Error("Must not touch DB"); });
  assert.equal((await api.POST(request({ ...payload, score: -1 }))).status, 400);
  assert.equal((await api.POST(new Request("https://game.test/api/records", { method: "POST", body: "plain" }))).status, 415);
  assert.equal((await api.POST(new Request("https://game.test/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await api.POST(request({ ...payload, padding: "x".repeat(4096) }))).status, 413);
  assert.equal((await api.POST(new Request("https://game.test/api/records", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.test" }, body: JSON.stringify(payload) }))).status, 403);
  assert.equal((await api.GET(new Request("https://game.test/api/rankings?playerId=invalid"))).status, 400);
  assert.equal((await api.POST(new Request("http://localhost:3104/api/records", { method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:3104", Host: "127.0.0.1:3104" }, body: "{}" }))).status, 400);
});

test("concurrent identical saves create one run; conflicting payloads cannot overwrite it", async () => {
  const repo = repository(), api = createRecordHandlers(() => repo);
  assert.equal(repo.records.size, 0);
  const results = await Promise.all([api.POST(request(payload)), api.POST(request(payload))]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  assert.equal(repo.records.size, 1);
  assert.equal((await results.find(r => r.status === 200)!.json()).alreadySaved, true);
  assert.equal((await api.POST(request({ ...payload, score: 9000 }))).status, 409);
  assert.equal((await api.POST(request({ ...payload, playerId: payload.runId }))).status, 409);
  assert.equal(repo.records.get(payload.runId)!.score, 2000);
  assert.equal((await api.POST(request({ ...payload, runId: "550e8400-e29b-41d4-a716-446655440002" }))).status, 201);
  assert.equal(repo.records.size, 2);
});

test("ranking empty, top-100 and outside-top-100 responses retain exact personal rank", async () => {
  const repo = repository();
  assert.deepEqual(await readRankings(repo, playerId), { rankings: [], totalPlayers: 0, myRanking: null });
  repo.top = async () => ({ rows: [{ ...row }], total: 1 });
  assert.equal((await readRankings(repo, playerId)).myRanking?.rank, 1);
  const rows = Array.from({ length: 100 }, (_, i) => ({ ...row, player_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, score: 3000 - i }));
  repo.top = async () => ({ rows, total: 324 });
  repo.findPlayer = async () => row;
  repo.countAhead = async mine => { assert.deepEqual(mine, row); return 323; };
  const data = await readRankings(repo, playerId);
  assert.equal(data.rankings.length, 100);
  assert.equal(data.rankings[99].rank, 100);
  assert.equal(data.myRanking?.rank, 324);
  assert.equal(data.totalPlayers, 324);
  assert.equal(data.myRanking?.nickname, "James");
});

test("DB failures never leak credentials/details into API responses", async () => {
  const api = createRecordHandlers(() => { throw new Error("private server configuration"); });
  for (const response of [await api.POST(request(payload)), await api.GET(new Request("https://game.test/api/rankings"))]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(!(await response.text()).includes("private"));
  }
});

test("Supabase adapter queries the best-record view with the same complete order for top and personal rank", async () => {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const db = createClient<Database>("https://example.supabase.co", "test-server-key", { auth: { persistSession: false }, global: {
    fetch: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (init?.method === "POST") return new Response(null, { status: 201 });
      if (init?.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/123" } });
      return Response.json(url.searchParams.has("player_id") ? row : [row], { headers: { "Content-Range": "0-0/124" } });
    },
  } });
  const repo = createRecordsRepository(db);
  assert.equal((await repo.top()).total, 124);
  assert.match(calls[0].url.pathname, /leaderboard$/);
  assert.equal(calls[0].url.searchParams.get("limit"), "100");
  assert.equal(calls[0].url.searchParams.get("order"), "score.desc,stage.desc,distance.desc,created_at.asc,player_id.asc");
  assert.deepEqual(await repo.findPlayer(playerId), row);
  assert.equal(calls[1].url.searchParams.get("player_id"), `eq.${playerId}`);
  assert.equal(await repo.countAhead(row), 123);
  assert.equal(calls[2].url.searchParams.get("or"), `(${aheadFilter(row)})`);
  assert.match(aheadFilter(row), /created_at\.lt\.2026-09-23T00:00:00\.123456\+00:00/);
  assert.equal(await repo.insert(payload), "inserted");
  assert.deepEqual(calls[3].body, { run_id: payload.runId, player_id: playerId, nickname: "James", score: 2000, stage: 1, distance: 1000, play_time: 36 });
});
