import { Scene } from "phaser";

import { GameScene } from "@/game/scenes/GameScene";
import { LANDMARKS } from "@/game/data/landmarks";
import { OBSTACLE_CONFIG, OBSTACLE_DEFINITIONS, OBSTACLE_IDS } from "@/game/data/obstacles";
import { GAME_EVENTS, LANDMARK_CONFIG } from "@/game/config/constants";
import { ITEM_CONFIG, ITEM_DEFINITIONS, ITEM_TYPES } from "@/game/data/items";

export class BootScene extends Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (const type of ITEM_TYPES) {
      const item = ITEM_DEFINITIONS[type];
      this.load.image(item.assetKey, item.assetPath);
    }
    for (const landmark of LANDMARKS) this.load.image(landmark.assetKey, landmark.assetPath);
    for (const id of OBSTACLE_IDS) {
      const obstacle = OBSTACLE_DEFINITIONS[id];
      this.load.image(obstacle.assetKey, obstacle.assetPath);
    }
  }

  create(): void {
    for (const type of ITEM_TYPES) {
      const item = ITEM_DEFINITIONS[type];
      if (!this.textures.exists(item.assetKey)) {
        this.game.events.emit(GAME_EVENTS.error, new Error(`Failed to load item: ${item.assetPath}`));
        return;
      }
      this.textures.get(item.assetKey).add(ITEM_CONFIG.frameName, 0, ...item.assetFrame);
    }
    for (const id of OBSTACLE_IDS) {
      const obstacle = OBSTACLE_DEFINITIONS[id];
      if (!this.textures.exists(obstacle.assetKey)) {
        this.game.events.emit(GAME_EVENTS.error, new Error(`Failed to load obstacle: ${obstacle.assetPath}`));
        return; // Never start a run with invisible hazards.
      }
      this.textures.get(obstacle.assetKey).add(OBSTACLE_CONFIG.frameName, 0, ...obstacle.assetFrame);
    }
    for (const landmark of LANDMARKS) {
      if (this.textures.exists(landmark.assetKey)) {
        this.textures.get(landmark.assetKey).add(LANDMARK_CONFIG.frameName, 0, ...landmark.assetFrame);
      }
    }
    this.scene.start(GameScene.KEY);
  }
}
