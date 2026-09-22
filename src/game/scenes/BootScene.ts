import { Scene } from "phaser";

import { GameScene } from "@/game/scenes/GameScene";

export class BootScene extends Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    this.scene.start(GameScene.KEY);
  }
}
