import type { GameObjects, Scene } from "phaser";
import { GAME_SIZE, RUN_CONFIG } from "../config/constants.ts";
import { GHOST_CONFIG, ITEM_CONFIG, ITEM_DEFINITIONS, type GameItem } from "../data/items.ts";
import { ghostCountdown } from "./ItemEffectSystem.ts";
import type { PerspectiveSystem } from "./PerspectiveSystem.ts";

export class ItemView {
  private readonly scene: Scene;
  private readonly projection: PerspectiveSystem;
  private readonly reducedMotion: boolean;
  private readonly images = new Map<number, GameObjects.Image>();
  private readonly countdown: GameObjects.Text;
  private lastCount: number | null = null;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.scene = scene;
    this.projection = projection;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.countdown = scene.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "48px", fontStyle: "bold",
      color: "#f0fcff", stroke: "#164e63", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(1000).setVisible(false);
  }

  render(distance: number, items: readonly GameItem[], ghostSeconds: number): void {
    for (const item of items) {
      const relative = item.distance - distance;
      if (relative > RUN_CONFIG.viewDistance) continue;
      const definition = ITEM_DEFINITIONS[item.type];
      let image = this.images.get(item.id);
      if (!image) {
        image = this.scene.add.image(0, 0, definition.assetKey, ITEM_CONFIG.frameName).setOrigin(0.5, 1);
        this.images.set(item.id, image);
      }
      const point = this.projection.project(item.courseX, relative);
      image.setPosition(point.x, point.y).setDepth(point.y)
        .setScale(point.scale * definition.visualWidth / definition.assetFrame[2]);
    }
    for (const [id, image] of this.images) {
      if (!items.some(item => item.id === id)) { image.destroy(); this.images.delete(id); }
    }
    const count = ghostCountdown(ghostSeconds);
    this.countdown.setVisible(count !== null);
    if (count !== null) {
      if (count !== this.lastCount) this.countdown.setText(String(count));
      const elapsed = Math.max(0, GHOST_CONFIG.warningSeconds - ghostSeconds);
      const progress = Math.min(1, elapsed / GHOST_CONFIG.countdownPopSeconds);
      const scale = this.reducedMotion ? 1 : progress < 0.5 ? 0.8 + 0.7 * progress : 1.3 - 0.3 * progress;
      this.countdown.setPosition(GAME_SIZE.width / 2, this.projection.height * GHOST_CONFIG.countdownYRatio).setScale(scale);
    }
    this.lastCount = count;
  }

  reset(): void {
    for (const image of this.images.values()) image.destroy();
    this.images.clear();
    this.countdown.setVisible(false);
    this.lastCount = null;
  }

  destroy(): void {
    this.reset();
    this.countdown.destroy();
  }
}
