import { AUTO, Scale, type Types } from "phaser";

import { BootScene } from "@/game/scenes/BootScene";
import { GameScene } from "@/game/scenes/GameScene";
import { GAME_SIZE } from "@/game/config/constants";

export function createGameConfig(
  parent: HTMLElement,
  callbacks: Types.Core.CallbacksConfig,
  inputTarget: HTMLElement,
): Types.Core.GameConfig {
  return {
    type: AUTO,
    parent,
    ...GAME_SIZE,
    backgroundColor: "#62c1ec",
    banner: false,
    autoFocus: false,
    audio: { noAudio: true },
    // Our adapters own input; keep Phaser's global keyboard capture disabled.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: {
      mode: Scale.FIT,
      autoCenter: Scale.CENTER_BOTH,
    },
    scene: [BootScene, new GameScene(inputTarget)],
    callbacks,
  };
}
