import { Scene } from "phaser";

import { GameScene } from "@/game/scenes/GameScene";
import { LANDMARKS } from "@/game/data/landmarks";
import { LANDMARK_CONFIG } from "@/game/config/constants";

export class BootScene extends Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (const landmark of LANDMARKS) this.load.image(landmark.assetKey, landmark.assetPath);
  }

  create(): void {
    for (const landmark of LANDMARKS) {
      if (this.textures.exists(landmark.assetKey)) {
        this.textures.get(landmark.assetKey).add(LANDMARK_CONFIG.frameName, 0, ...landmark.assetFrame);
      }
    }
    this.scene.start(GameScene.KEY);
  }
}
