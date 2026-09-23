import type { LocalPlayer } from "../types/local-player.types.ts";
import { createUuid, isUuid } from "../utils/uuid.ts";

export const LOCAL_PLAYER_KEY = "antarctic-player";
type StorageAccess = () => Pick<Storage, "getItem" | "setItem"> | null;

export function normalizeNickname(value: string): string { return value.normalize("NFC").trim(); }
export function nicknameError(value: string): string | null {
  const name = normalizeNickname(value);
  const length = Array.from(name).length;
  if (length < 2 || length > 12) return "닉네임은 2~12자로 입력해주세요.";
  if (/\p{Cc}/u.test(name)) return "닉네임에는 줄바꿈이나 제어 문자를 사용할 수 없어요.";
  return null;
}

/** Browser-only lazy reads; no identity is created until the nickname is submitted. */
export class LocalPlayerStore {
  private player?: LocalPlayer | null;
  private recoveredId?: string;
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageAccess;
  private readonly createId: () => string;

  constructor(storage: StorageAccess = () => window.localStorage, createId = createUuid) {
    this.storage = storage;
    this.createId = createId;
  }

  getSnapshot = (): LocalPlayer | null => {
    if (this.player === undefined) {
      this.player = null;
      try {
        const raw: unknown = JSON.parse(this.storage()?.getItem(LOCAL_PLAYER_KEY) ?? "null");
        if (raw && typeof raw === "object" && "id" in raw && isUuid(raw.id)) {
          this.recoveredId = raw.id;
          if ("nickname" in raw && typeof raw.nickname === "string" && !nicknameError(raw.nickname)) {
            this.player = Object.freeze({ id: raw.id, nickname: normalizeNickname(raw.nickname) });
          }
        }
      } catch { /* Missing/invalid/blocked storage asks for a nickname and keeps a session identity. */ }
    }
    return this.player;
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  setNickname(value: string): LocalPlayer {
    const error = nicknameError(value);
    if (error) throw new Error(error);
    const id = this.getSnapshot()?.id ?? this.recoveredId ?? this.createId();
    this.player = Object.freeze({ id, nickname: normalizeNickname(value) });
    try { this.storage()?.setItem(LOCAL_PLAYER_KEY, JSON.stringify(this.player)); }
    catch { /* Persistence failure must not stop a run or change this session's ID. */ }
    for (const listener of this.listeners) listener();
    return this.player;
  }
}
