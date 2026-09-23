import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_PLAYER_KEY, LocalPlayerStore, nicknameError } from "./LocalPlayerStore.ts";
import { isUuid } from "../utils/uuid.ts";

test("nickname submission creates one persisted UUID; renaming and reloading keep the identity", () => {
  const data = new Map<string, string>();
  let reads = 0, notifications = 0;
  const storage = () => ({ getItem: (key: string) => { reads++; return data.get(key) ?? null; }, setItem: (key: string, value: string) => { data.set(key, value); } });
  const store = new LocalPlayerStore(storage);
  assert.equal(reads, 0, "SSR construction must not access storage");
  assert.equal(store.getSnapshot(), null);
  assert.equal(data.size, 0, "do not create a player before nickname submission");
  const unsubscribe = store.subscribe(() => notifications++);
  const first = store.setNickname("  James  ");
  assert.equal(isUuid(first.id), true);
  assert.equal(first.nickname, "James");
  assert.deepEqual(JSON.parse(data.get(LOCAL_PLAYER_KEY)!), first);
  const renamed = store.setNickname("펭귄탐험가");
  assert.equal(renamed.id, first.id);
  assert.equal(notifications, 2);
  assert.deepEqual(new LocalPlayerStore(storage).getSnapshot(), renamed);
  unsubscribe();
  store.setNickname("White");
  assert.equal(notifications, 2);
});

test("missing or corrupted profiles ask again and valid IDs survive a damaged nickname", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  for (const raw of [null, "bad json", "[]", "null", "{}", '{"nickname":"James"}', '{"id":"bad","nickname":"James"}']) {
    const store = new LocalPlayerStore(() => ({ getItem: () => raw, setItem() {} }));
    assert.equal(store.getSnapshot(), null);
    assert.ok(isUuid(store.setNickname("James").id));
  }
  const recover = new LocalPlayerStore(() => ({ getItem: () => JSON.stringify({ id }), setItem() {} }));
  assert.equal(recover.getSnapshot(), null);
  assert.equal(recover.setNickname("Penguin").id, id);
});

test("nickname validation trims, counts Unicode characters and never writes invalid names", () => {
  let writes = 0;
  const store = new LocalPlayerStore(() => ({ getItem: () => null, setItem() { writes++; } }));
  for (const name of ["", "   ", "a", "1234567890123", "ab\nc"]) {
    assert.ok(nicknameError(name));
    assert.throws(() => store.setNickname(name));
  }
  assert.equal(writes, 0);
  assert.equal(store.setNickname("  남극펭귄  ").nickname, "남극펭귄");
  assert.equal(nicknameError("🐧".repeat(12)), null);
  assert.ok(nicknameError("🐧".repeat(13)));
});

test("blocked or full storage retains the player ID for the current session", () => {
  for (const storage of [
    () => null,
    () => { throw new Error("Denied"); },
    () => ({ getItem: () => null, setItem() { throw new Error("Quota"); } }),
  ]) {
    const store = new LocalPlayerStore(storage);
    const player = store.setNickname("James");
    assert.equal(store.setNickname("Penguin").id, player.id);
  }
});
