import type { RankingEntry, RankingsResponse } from "../types/ranking.types.ts";
import { isUuid } from "../utils/uuid.ts";

function integer(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function isEntry(value: unknown): value is RankingEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return isUuid(row.playerId)
    && typeof row.nickname === "string" && row.nickname.trim().length > 0
    && integer(row.rank, 1) && integer(row.stage, 1)
    && integer(row.score, 0) && integer(row.distance, 0);
}

/** Validate before publishing API data to React, including the separate personal row. */
export function parseRankings(value: unknown): RankingsResponse {
  if (!value || typeof value !== "object") throw new Error("Invalid rankings.");
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.rankings) || data.rankings.length > 100
    || !data.rankings.every(isEntry) || !integer(data.totalPlayers, 0)
    || !(data.myRanking === null || isEntry(data.myRanking))) {
    throw new Error("Invalid rankings.");
  }
  return { rankings: data.rankings, totalPlayers: data.totalPlayers, myRanking: data.myRanking };
}
