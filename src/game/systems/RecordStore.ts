import { RUN_CONFIG } from "../config/constants.ts";
import type { RunRecord } from "../types/run-record.types.ts";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem"> | null;

function isRecord(value: unknown): value is RunRecord {
  if (!value || typeof value !== "object" || !("distance" in value) || !("averageSpeed" in value)) return false;
  return typeof value.distance === "number" && Number.isSafeInteger(value.distance) && value.distance >= 0
    && (value.averageSpeed === null || (typeof value.averageSpeed === "number"
      && Number.isFinite(value.averageSpeed) && value.averageSpeed > 0));
}

function readRecord(raw: string | null): RunRecord | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    return isRecord(value) ? { distance: value.distance, averageSpeed: value.averageSpeed } : null;
  } catch { return null; }
}

export class RecordStore {
  private best: RunRecord = { distance: 0, averageSpeed: null };
  private readonly storage: StorageAccess;

  constructor(storage: StorageAccess = () => window.localStorage) {
    this.storage = storage;
    this.refresh();
  }

  private refresh(): void {
    try {
      const store = this.storage();
      const saved = readRecord(store?.getItem(RUN_CONFIG.recordKey) ?? null);
      if (saved && saved.distance > this.best.distance) this.best = saved;
      const distance = Number(store?.getItem(RUN_CONFIG.legacyRecordKey));
      if (Number.isSafeInteger(distance) && distance > this.best.distance) this.best = { distance, averageSpeed: null };
    } catch { /* Private browsing or storage policy: keep an in-memory record. */ }
  }

  get value(): RunRecord { return this.best; }

  save(record: RunRecord): boolean {
    if (!isRecord(record)) return false;
    // Another open tab may have finished a longer run since this game started.
    this.refresh();
    if (record.distance <= this.best.distance) return false;
    this.best = { ...record };
    try { this.storage()?.setItem(RUN_CONFIG.recordKey, JSON.stringify(this.best)); }
    catch { /* A denied/quota-full store must not interrupt gameplay. */ }
    return true;
  }
}
