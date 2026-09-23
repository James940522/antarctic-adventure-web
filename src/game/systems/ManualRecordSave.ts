import type { GameRecordPayload } from "../types/game-record.types.ts";
import type { LocalPlayer } from "../types/local-player.types.ts";
import type { RunSnapshot } from "./RunSystem.ts";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type SaveSnapshot = Readonly<{ status: SaveState; message: string | null }>;
export type RecordSubmitter = (payload: GameRecordPayload) => Promise<{ success: true; alreadySaved?: boolean }>;

export function createGameRecord(run: RunSnapshot, player: LocalPlayer): GameRecordPayload {
  if (run.status !== "gameover") throw new Error("Only finished runs can be submitted.");
  return Object.freeze({
    runId: run.runId, playerId: player.id, nickname: player.nickname,
    score: run.score, stage: run.stage, distance: run.distance, playTime: run.playTime,
  });
}

class RecordSaveError extends Error {}
export function createRecordSubmitter(request: typeof fetch = fetch): RecordSubmitter {
  return async payload => {
    const response = await request("/api/records", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new RecordSaveError(result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error : "기록을 저장하지 못했습니다. 다시 시도해주세요.");
    }
    if (!result || typeof result !== "object" || !("success" in result) || result.success !== true) throw new Error("Save was not acknowledged.");
    return { success: true, alreadySaved: "alreadySaved" in result && result.alreadySaved === true };
  };
}
export const submitGameRecord = createRecordSubmitter();

/** One finished run; construction and subscriptions never submit anything. */
export class ManualRecordSave {
  private snapshot: SaveSnapshot = { status: "idle", message: null };
  private readonly listeners = new Set<() => void>();
  private readonly record: GameRecordPayload;
  private readonly submit: RecordSubmitter;

  constructor(record: GameRecordPayload, submit: RecordSubmitter = submitGameRecord) {
    this.record = Object.freeze({ ...record });
    this.submit = submit;
  }

  getSnapshot = (): SaveSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private setState(status: SaveState, message: string | null = null): void {
    this.snapshot = { status, message };
    for (const listener of this.listeners) listener();
  }

  async save(): Promise<void> {
    if (this.snapshot.status === "saving" || this.snapshot.status === "saved") return;
    this.setState("saving"); // Synchronous guard also prevents double clicks before React rerenders.
    try {
      const result = await this.submit(this.record);
      if (result?.success !== true) throw new Error("Save was not acknowledged.");
      this.setState("saved", result.alreadySaved ? "이미 저장된 기록입니다." : "기록이 저장되었습니다.");
    } catch (error) {
      this.setState("error", error instanceof RecordSaveError
        ? error.message
        : "기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }
}
