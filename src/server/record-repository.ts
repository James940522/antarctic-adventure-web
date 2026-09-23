import "server-only";
import { getSupabase } from "./supabase.ts";
import type { RecordsRepository, LeaderboardRow } from "./record-service.ts";

const columns = "player_id,nickname,score,stage,distance,play_time,created_at";
// Exact lexicographic counterpart of the top query, including its stable final tie.
export function aheadFilter(row: LeaderboardRow): string {
  const score = `score.eq.${row.score}`;
  const stage = `${score},stage.eq.${row.stage}`;
  const distance = `${stage},distance.eq.${row.distance}`;
  return [`score.gt.${row.score}`, `and(${score},stage.gt.${row.stage})`,
    `and(${stage},distance.gt.${row.distance})`, `and(${distance},created_at.lt.${row.created_at})`,
    `and(${distance},created_at.eq.${row.created_at},player_id.lt.${row.player_id})`].join(",");
}
export function createRecordsRepository(db = getSupabase()): RecordsRepository {
  return {
    async insert(record) {
      const { error } = await db.from("game_records").insert({ run_id: record.runId, player_id: record.playerId,
        nickname: record.nickname, score: record.score, stage: record.stage, distance: record.distance, play_time: record.playTime });
      if (error?.code === "23505") return "duplicate";
      if (error) throw new Error("Record insert failed.");
      return "inserted";
    },
    async findRun(runId) {
      const { data, error } = await db.from("game_records").select("*").eq("run_id", runId).maybeSingle();
      if (error) throw new Error("Record lookup failed.");
      return data;
    },
    async top() {
      const { data, error, count } = await db.from("leaderboard").select(columns, { count: "exact" })
        .order("score", { ascending: false }).order("stage", { ascending: false })
        .order("distance", { ascending: false }).order("created_at", { ascending: true })
        .order("player_id", { ascending: true }).limit(100);
      if (error || !data || count === null) throw new Error("Ranking lookup failed.");
      return { rows: data, total: count };
    },
    async findPlayer(playerId) {
      const { data, error } = await db.from("leaderboard").select(columns).eq("player_id", playerId).maybeSingle();
      if (error) throw new Error("Player ranking lookup failed.");
      return data;
    },
    async countAhead(row) {
      const { count, error } = await db.from("leaderboard").select("player_id", { count: "exact", head: true }).or(aheadFilter(row));
      if (error || count === null) throw new Error("Rank count failed.");
      return count;
    },
  };
}
