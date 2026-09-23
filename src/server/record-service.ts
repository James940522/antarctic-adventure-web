import type { GameRecordPayload } from "../game/types/game-record.types.ts";
import type { RankingEntry, RankingsResponse } from "../game/types/ranking.types.ts";

export type LeaderboardRow = {
  player_id: string; nickname: string; score: number; stage: number;
  distance: number; play_time: number; created_at: string;
};
export type StoredRecord = LeaderboardRow & { id: string; run_id: string };
export interface RecordsRepository {
  insert(record: GameRecordPayload): Promise<"inserted" | "duplicate">;
  findRun(runId: string): Promise<StoredRecord | null>;
  top(): Promise<{ rows: LeaderboardRow[]; total: number }>;
  findPlayer(playerId: string): Promise<LeaderboardRow | null>;
  countAhead(row: LeaderboardRow): Promise<number>;
}
export class RecordConflictError extends Error {}

export async function saveRecord(repo: RecordsRepository, payload: GameRecordPayload) {
  if (await repo.insert(payload) === "inserted") return { success: true as const, alreadySaved: false };
  const existing = await repo.findRun(payload.runId);
  if (!existing || existing.player_id !== payload.playerId || existing.nickname !== payload.nickname
    || existing.score !== payload.score || existing.stage !== payload.stage
    || existing.distance !== payload.distance || existing.play_time !== payload.playTime) {
    throw new RecordConflictError("Run ID belongs to a different result.");
  }
  return { success: true as const, alreadySaved: true };
}
function entry(row: LeaderboardRow, rank: number): RankingEntry {
  return { rank, playerId: row.player_id, nickname: row.nickname, score: row.score, stage: row.stage, distance: row.distance };
}
export async function readRankings(repo: RecordsRepository, playerId?: string): Promise<RankingsResponse> {
  const { rows, total } = await repo.top();
  const rankings = rows.map((row, index) => entry(row, index + 1));
  let myRanking = rankings.find(row => row.playerId === playerId) ?? null;
  if (playerId && !myRanking) {
    const mine = await repo.findPlayer(playerId);
    if (mine) myRanking = entry(mine, (await repo.countAhead(mine)) + 1);
  }
  return { rankings, totalPlayers: total, myRanking };
}
