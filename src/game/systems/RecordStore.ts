import { RUN_CONFIG } from "../config/constants.ts";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem"> | null;

export class RecordStore {
  private best = 0;
  private readonly storage: StorageAccess;

  constructor(storage: StorageAccess = () => window.localStorage) {
    this.storage = storage;
    try {
      const saved = Number(storage()?.getItem(RUN_CONFIG.recordKey));
      if (Number.isFinite(saved) && saved >= 0 && Number.isSafeInteger(saved)) this.best = saved;
    } catch { /* Private browsing or storage policy: keep an in-memory record. */ }
  }

  get value(): number { return this.best; }

  save(distance: number): void {
    if (!Number.isFinite(distance) || distance <= this.best) return;
    this.best = Math.floor(distance);
    try { this.storage()?.setItem(RUN_CONFIG.recordKey, String(this.best)); }
    catch { /* A denied/quota-full store must not interrupt gameplay. */ }
  }
}
