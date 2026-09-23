import { AUDIO_MUTED_KEY } from "../config/audio.ts";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem"> | null;

/** Lazy browser read; session state still works when storage is unavailable. */
export class AudioPreferences {
  private muted?: boolean | null;
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageAccess;

  constructor(storage: StorageAccess = () => window.localStorage) {
    this.storage = storage;
  }

  getSnapshot = (): boolean | null => {
    if (this.muted === undefined) {
      try {
        const saved = this.storage()?.getItem(AUDIO_MUTED_KEY);
        this.muted = saved === "true" ? true : saved === "false" ? false : null;
      } catch { this.muted = null; }
    }
    return this.muted;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  setMuted(muted: boolean): void {
    this.muted = muted;
    try { this.storage()?.setItem(AUDIO_MUTED_KEY, String(muted)); }
    catch { /* Keep this session's choice even if persistence is blocked. */ }
    for (const listener of this.listeners) listener();
  }
}
