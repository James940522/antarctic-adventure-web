import type { GameObjects, Scene } from "phaser";
import { GAME_SIZE } from "../config/constants.ts";
import { GHOST_CONFIG, ITEM_CONFIG, ITEM_DEFINITIONS, ITEM_VIEW_CONFIG, type GameItem } from "../data/items.ts";
import { ghostCountdown } from "./ItemEffectSystem.ts";
import type { PerspectiveSystem } from "./PerspectiveSystem.ts";

export class ItemView {
  private readonly scene: Scene;
  private readonly projection: PerspectiveSystem;
  private readonly reducedMotion: boolean;
  private readonly views = new Map<number, { image: GameObjects.Image; glow: GameObjects.Graphics }>();
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

  render(distance: number, items: readonly GameItem[], ghostSeconds: number, elapsedSeconds: number): void {
    for (const item of items) {
      const relative = item.distance - distance;
      let view = this.views.get(item.id);
      // Visibility follows spawning; projected position depends only on distance.
      const visible = relative <= this.projection.viewDistance;
      view?.image.setVisible(visible);
      view?.glow.setVisible(visible);
      if (!visible) continue;
      const definition = ITEM_DEFINITIONS[item.type];
      if (!view) {
        view = {
          image: this.scene.add.image(0, 0, definition.assetKey, ITEM_CONFIG.frameName).setOrigin(0.5, 1),
          glow: this.scene.add.graphics(),
        };
        this.views.set(item.id, view);
      }
      const point = this.projection.project(item.courseX, relative);
      const width = Math.max(ITEM_VIEW_CONFIG.minWidth, point.scale * definition.visualWidth);
      const height = width * definition.assetFrame[3] / definition.assetFrame[2];
      view.image.setPosition(point.x, point.y).setDepth(point.y)
        .setScale(width / definition.assetFrame[2]);
      // Simulation time freezes the shimmer on pause, blur and landmark arrival.
      const phase = this.reducedMotion ? 0 : elapsedSeconds / ITEM_VIEW_CONFIG.pulseSeconds * Math.PI * 2;
      this.drawGlow(view.glow, point.x, point.y, width, height, phase);
    }
    for (const [id, view] of this.views) {
      if (!items.some(item => item.id === id)) {
        view.image.destroy();
        view.glow.destroy();
        this.views.delete(id);
      }
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

  private drawGlow(glow: GameObjects.Graphics, x: number, y: number, width: number, height: number, phase: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(phase);
    glow.clear().setPosition(x, y).setDepth(y - 0.1);
    // Keep the glow close to the artwork; the separate glints draw attention.
    glow.fillStyle(ITEM_VIEW_CONFIG.haloColor, 0.06 + pulse * 0.06);
    glow.fillRoundedRect(-width / 2 - 4, -height - 4, width + 8, height + 8, width * 0.16);
    // A dark backing keeps the pale transparent artwork legible against snow.
    glow.fillStyle(ITEM_VIEW_CONFIG.backingColor, 0.7);
    glow.fillRoundedRect(-width / 2, -height, width, height, width * 0.16);
    glow.lineStyle(ITEM_VIEW_CONFIG.borderWidth, ITEM_VIEW_CONFIG.haloColor, 0.45 + pulse * 0.25);
    glow.strokeRoundedRect(-width / 2 - 1, -height - 1, width + 2, height + 2, width * 0.16);

    for (let i = 0; i < 3; i++) {
      // Staggered smooth peaks make each star twinkle instead of pulsing as a block.
      const shimmer = (0.5 + 0.5 * Math.sin(phase + i * Math.PI * 2 / 3)) ** 3;
      const starX = (i === 0 ? -0.72 : i === 1 ? 0.62 : 0.76) * width;
      const starY = (i === 0 ? -0.72 : i === 1 ? -1.12 : -0.28) * height;
      const radius = Math.max(ITEM_VIEW_CONFIG.minSparkleRadius, width * 0.12) * (0.5 + shimmer * 0.8);
      glow.fillStyle(ITEM_VIEW_CONFIG.haloColor, shimmer * 0.16);
      glow.fillEllipse(starX, starY, radius * 2.5, radius * 2.5);
      glow.lineStyle(0.75, ITEM_VIEW_CONFIG.backingColor, 0.15 + shimmer * 0.55);
      glow.fillStyle(ITEM_VIEW_CONFIG.sparkleColor, 0.1 + shimmer * 0.9);
      glow.beginPath();
      glow.moveTo(starX, starY - radius);
      glow.lineTo(starX + radius * 0.25, starY - radius * 0.25);
      glow.lineTo(starX + radius, starY);
      glow.lineTo(starX + radius * 0.25, starY + radius * 0.25);
      glow.lineTo(starX, starY + radius);
      glow.lineTo(starX - radius * 0.25, starY + radius * 0.25);
      glow.lineTo(starX - radius, starY);
      glow.lineTo(starX - radius * 0.25, starY - radius * 0.25);
      glow.closePath();
      glow.fillPath();
      glow.strokePath();
      glow.fillStyle(0xffffff, shimmer * 0.95);
      glow.fillEllipse(starX, starY, radius * 0.5, radius * 0.5);
    }
  }

  reset(): void {
    for (const view of this.views.values()) { view.image.destroy(); view.glow.destroy(); }
    this.views.clear();
    this.countdown.setVisible(false);
    this.lastCount = null;
  }

  destroy(): void {
    this.reset();
    this.countdown.destroy();
  }
}
