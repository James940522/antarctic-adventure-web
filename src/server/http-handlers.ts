import { isUuid } from "../game/utils/uuid.ts";
import { validateRecord } from "./record-validation.ts";
import { readRankings, saveRecord, RecordConflictError, type RecordsRepository } from "./record-service.ts";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
class BodyTooLarge extends Error {}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0, body = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new BodyTooLarge(); }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}
export function createRecordHandlers(repository: () => RecordsRepository) {
  return {
    async POST(request: Request) {
      if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json({ error: "JSON 형식으로 전송해주세요." }, 415);
      const origin = request.headers.get("origin");
      if (origin) {
        // Next may normalize the internal request URL to localhost (or a proxy host).
        // Compare with the actual HTTP Host the browser addressed, including its port.
        let sameHost = false;
        try {
          const source = new URL(origin);
          const host = request.headers.get("host") ?? new URL(request.url).host;
          sameHost = ["http:", "https:"].includes(source.protocol) && source.host === host.toLowerCase();
        } catch { /* Malformed/null Origin is not a browser request from this app. */ }
        if (!sameHost) return json({ error: "허용되지 않은 요청입니다." }, 403);
      }
      let body: unknown;
      try { body = await readBody(request); }
      catch (error) { return json({ error: "기록 요청 형식이 올바르지 않습니다." }, error instanceof BodyTooLarge ? 413 : 400); }
      const record = validateRecord(body);
      if (!record) return json({ error: "닉네임 또는 기록 값이 올바르지 않습니다." }, 400);
      try {
        const result = await saveRecord(repository(), record);
        return json(result, result.alreadySaved ? 200 : 201);
      } catch (error) {
        if (error instanceof RecordConflictError) return json({ error: "이미 다른 기록으로 등록된 탐험입니다." }, 409);
        return json({ error: "기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요." }, 503);
      }
    },
    async GET(request: Request) {
      const playerId = new URL(request.url).searchParams.get("playerId");
      if (playerId !== null && !isUuid(playerId)) return json({ error: "플레이어 ID가 올바르지 않습니다." }, 400);
      try { return json(await readRankings(repository(), playerId?.toLowerCase())); }
      catch { return json({ error: "랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해주세요." }, 503); }
    },
  };
}
