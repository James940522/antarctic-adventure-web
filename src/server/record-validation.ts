import type { GameRecordPayload } from "../game/types/game-record.types.ts";
import { nicknameError, normalizeNickname } from "../game/systems/LocalPlayerStore.ts";
import { isUuid } from "../game/utils/uuid.ts";
import { LANDMARKS } from "../game/data/landmarks.ts";

// PostgreSQL integer column bounds, not an invented gameplay/speed cap.
const PG_INTEGER_MAX = 2147483647;
export function validateRecord(value: unknown): GameRecordPayload | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!isUuid(v.runId) || !isUuid(v.playerId) || typeof v.nickname !== "string" || nicknameError(v.nickname)) return null;
  const integer = (n: unknown, min = 0, max = PG_INTEGER_MAX): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
  if (!integer(v.score) || !integer(v.distance) || !integer(v.playTime) || !integer(v.stage, 1, LANDMARKS.length + 1)) return null;
  return { runId: v.runId.toLowerCase(), playerId: v.playerId.toLowerCase(), nickname: normalizeNickname(v.nickname),
    score: v.score, stage: v.stage, distance: v.distance, playTime: v.playTime };
}
