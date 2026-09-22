import { Game } from "phaser";

import { GAME_EVENTS } from "@/game/config/constants";
import { createGameConfig } from "@/game/config/game-config";

type GameCallbacks = {
  onReady: () => void;
  onError: (error: unknown) => void;
};

// This entry point must only be imported after the React host mounts.
export function createGame(parent: HTMLElement, callbacks: GameCallbacks, inputTarget: HTMLElement): Game {
  return new Game(
    createGameConfig(parent, {
      preBoot(game) {
        game.events.once(GAME_EVENTS.ready, callbacks.onReady);
        game.events.once(GAME_EVENTS.error, callbacks.onError);
      },
      postBoot(game) {
        game.canvas.setAttribute("role", "img");
        game.canvas.setAttribute(
          "aria-label",
          "눈 덮인 남극의 지평선을 향해 달리는 펭귄의 뒷모습",
        );
      },
    }, inputTarget),
  );
}
