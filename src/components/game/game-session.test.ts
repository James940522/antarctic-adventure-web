import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import type { Game } from "phaser";
import type { GameCallbacks } from "../../game/create-game.ts";
import type { GameSnapshot } from "../../game/types/game.types.ts";
import { GAME_EVENTS } from "../../game/config/constants.ts";
import { startGameSession } from "./game-session.ts";

const element = {} as HTMLElement;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(onCreate?: (callbacks: GameCallbacks) => void) {
  const events = new EventEmitter();
  const errors: unknown[] = [];
  let created = 0, destroyed = 0, removed = 0, ready = 0, restarted = 0, snapshots = 0;
  let bridge!: GameCallbacks;
  const game = {
    events,
    destroy(removeCanvas: boolean, noReturn: boolean) {
      assert.equal(removeCanvas, true);
      assert.equal(noReturn, false);
      destroyed++;
    },
    canvas: { remove: () => { removed++; } },
  } as unknown as Game;
  const gameModule = { createGame: (_parent: HTMLElement, callbacks: GameCallbacks) => {
    created++;
    bridge = callbacks;
    onCreate?.(callbacks);
    return game;
  } };
  const callbacks: GameCallbacks = {
    onReady: () => { ready++; }, onError: error => errors.push(error),
    onSnapshot: () => { snapshots++; }, onRestarted: () => { restarted++; },
  };
  return {
    gameModule, callbacks, errors, events,
    bridge: () => bridge,
    counts: () => ({ created, destroyed, removed, ready, restarted, snapshots }),
    finishDestroy: () => events.emit("destroy"),
  };
}

test("unmount during import never creates a late game or reports an error", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(), loading = deferred<typeof f.gameModule>();
  const session = startGameSession(element, element, f.callbacks, () => loading.promise);
  session.destroy();
  loading.resolve(f.gameModule);
  await setImmediate();
  t.mock.timers.tick(15_000);
  assert.equal(f.counts().created, 0);
  assert.deepEqual(f.errors, []);
});

test("timeout includes module download and late resolution cannot start a failed session", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture(), loading = deferred<typeof f.gameModule>();
  const session = startGameSession(element, element, f.callbacks, () => loading.promise);
  t.mock.timers.tick(15_000);
  assert.equal(f.errors.length, 1);
  loading.resolve(f.gameModule);
  await setImmediate();
  assert.equal(f.counts().created, 0);
  session.destroy();
});

test("import failures are reported once and a later attempt can start normally", async () => {
  const f = fixture();
  const session = startGameSession(element, element, f.callbacks, async () => { throw new Error("offline"); });
  await setImmediate();
  assert.equal(f.errors.length, 1);
  session.destroy();
  const retry = startGameSession(element, element, f.callbacks, async () => f.gameModule);
  await setImmediate();
  assert.equal(f.counts().created, 1);
  f.bridge().onReady();
  assert.equal(f.counts().ready, 1);
  retry.destroy(); f.finishDestroy();
});

test("ready clears the deadline, and dispose stops commands and callbacks with one teardown", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const session = startGameSession(element, element, f.callbacks, async () => f.gameModule);
  await setImmediate();
  f.bridge().onReady();
  t.mock.timers.tick(20_000);
  const commands: unknown[] = [];
  f.events.on(GAME_EVENTS.pause, paused => commands.push(paused));
  f.events.on(GAME_EVENTS.restart, () => commands.push("restart"));
  session.pause(true); session.pause(false); session.restart();
  assert.deepEqual(commands, [true, false, "restart"]);
  f.bridge().onRestarted();
  f.bridge().onSnapshot({} as GameSnapshot);
  session.destroy(); session.destroy();
  session.restart(); session.pause(true);
  f.bridge().onReady(); f.bridge().onRestarted();
  f.bridge().onSnapshot({} as GameSnapshot);
  f.bridge().onError(new Error("late"));
  assert.deepEqual(f.counts(), { created: 1, destroyed: 1, removed: 1, ready: 1, restarted: 1, snapshots: 1 });
  assert.deepEqual(f.errors, []);
  assert.equal(commands.length, 3);
  f.finishDestroy();
});

test("quick remount waits for the previous Phaser destroy event", async () => {
  const old = fixture(), next = fixture();
  const first = startGameSession(element, element, old.callbacks, async () => old.gameModule);
  await setImmediate();
  first.destroy();
  const second = startGameSession(element, element, next.callbacks, async () => next.gameModule);
  await setImmediate();
  assert.equal(next.counts().created, 0);
  old.finishDestroy();
  await setImmediate();
  assert.equal(next.counts().created, 1);
  second.destroy(); next.finishDestroy();
});

test("stalled teardown shows a timeout and cannot later create a duplicate game", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const old = fixture(), next = fixture();
  const first = startGameSession(element, element, old.callbacks, async () => old.gameModule);
  await setImmediate(); first.destroy();
  const second = startGameSession(element, element, next.callbacks, async () => next.gameModule);
  await setImmediate();
  t.mock.timers.tick(15_000);
  assert.equal(next.errors.length, 1);
  old.finishDestroy(); await setImmediate();
  assert.equal(next.counts().created, 0);
  second.destroy();
});

test("scene boot errors before factory return still destroy the returned game", async () => {
  const f = fixture(callbacks => callbacks.onError(new Error("missing asset")));
  const session = startGameSession(element, element, f.callbacks, async () => f.gameModule);
  await setImmediate();
  assert.equal(f.errors.length, 1);
  assert.equal(f.counts().destroyed, 1);
  f.bridge().onReady();
  assert.equal(f.counts().ready, 0);
  session.destroy(); f.finishDestroy();
});

test("a scene that never becomes ready is destroyed when its deadline expires", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const session = startGameSession(element, element, f.callbacks, async () => f.gameModule);
  await setImmediate();
  t.mock.timers.tick(15_000);
  assert.equal(f.errors.length, 1);
  assert.equal(f.counts().destroyed, 1);
  f.bridge().onReady();
  assert.equal(f.counts().ready, 0);
  session.destroy(); f.finishDestroy();
});
