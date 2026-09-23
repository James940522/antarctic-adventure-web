import type { Game } from "phaser";
import { GAME_EVENTS } from "../../game/config/constants.ts";
import type { createGame, GameCallbacks } from "../../game/create-game.ts";

type GameLoader = () => Promise<{ createGame: typeof createGame }>;
export type GameSession = ReturnType<typeof startGameSession>;

// Phaser destroys on its next frame. A replacement must wait for that event,
// including across React unmount/remount and Strict Mode effect replay.
let pendingTeardown: Promise<void> = Promise.resolve();

export function startGameSession(
  parent: HTMLElement,
  inputTarget: HTMLElement,
  callbacks: GameCallbacks,
  loadGame: GameLoader = () => import("../../game/create-game"),
) {
  let game: Game | undefined;
  let disposed = false;
  let failed = false;
  const active = () => !disposed && !failed;

  const retireGame = () => {
    if (!game) return;
    const retiring = game;
    game = undefined;
    pendingTeardown = new Promise<void>(resolve => {
      retiring.events.once("destroy", resolve);
      retiring.destroy(true, false);
    });
    retiring.canvas?.remove();
  };

  const fail = (error: unknown) => {
    if (!active()) return;
    failed = true;
    clearTimeout(timeout);
    retireGame();
    callbacks.onError(error);
  };

  // Cover module download and previous teardown as well as scene boot.
  const timeout = setTimeout(() => fail(new Error("Game initialization timed out.")), 15_000);

  const initialize = async () => {
    const { createGame } = await loadGame();
    await pendingTeardown;
    if (!active()) return;

    game = createGame(parent, {
      onReady: () => {
        if (!active()) return;
        clearTimeout(timeout);
        callbacks.onReady();
      },
      onError: fail,
      onSnapshot: snapshot => { if (active()) callbacks.onSnapshot(snapshot); },
      onRestarted: () => { if (active()) callbacks.onRestarted(); },
    }, inputTarget);
    // A factory can report a synchronous boot error before returning its game.
    if (!active()) retireGame();
  };
  void initialize().catch(fail);

  return {
    pause: (paused: boolean) => { if (active()) game?.events.emit(GAME_EVENTS.pause, paused); },
    restart: () => { if (active()) game?.events.emit(GAME_EVENTS.restart); },
    destroy: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      retireGame();
    },
  };
}
