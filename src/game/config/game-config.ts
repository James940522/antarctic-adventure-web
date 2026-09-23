import { AUTO, Scale, type Types } from "phaser";

import { BootScene } from "@/game/scenes/BootScene";
import { GameScene } from "@/game/scenes/GameScene";
import { GAME_SIZE } from "@/game/config/constants";
import { getViewportHeight } from "@/game/config/viewport";

export function createGameConfig(
  parent: HTMLElement,
  callbacks: Types.Core.CallbacksConfig,
  inputTarget: HTMLElement,
): Types.Core.GameConfig {
  return {
    type: AUTO,
    parent,
    ...GAME_SIZE,
    height: getViewportHeight(parent.clientWidth, parent.clientHeight),
    backgroundColor: "#62c1ec",
    banner: false,
    autoFocus: false,
    audio: { noAudio: true },
    // Our adapters own input; keep Phaser's global keyboard capture disabled.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: {
      // Fixed course width, responsive scene height. CSS owns sizing and rotation.
      mode: Scale.NONE,
      autoCenter: Scale.NO_CENTER,
    },
    scene: [BootScene, new GameScene(inputTarget)],
    callbacks,
  };
}
