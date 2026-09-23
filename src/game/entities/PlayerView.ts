import type { GameObjects, Scene } from "phaser";

import { PLAYER_CONFIG, PLAYER_VIEW } from "@/game/config/constants";
import type { PlayerState } from "@/game/entities/Player";
import { PerspectiveSystem } from "@/game/systems/PerspectiveSystem";

export class PlayerView {
  private readonly body: GameObjects.Container;
  private readonly shadow: GameObjects.Ellipse;
  private readonly leftFoot: GameObjects.Ellipse;
  private readonly rightFoot: GameObjects.Ellipse;
  private readonly leftFlipper: GameObjects.Ellipse;
  private readonly rightFlipper: GameObjects.Ellipse;
  private readonly back: GameObjects.Graphics;
  private readonly front: GameObjects.Graphics;
  private readonly sparkles: GameObjects.Graphics;
  private readonly reducedMotion: boolean;
  private readonly projection: PerspectiveSystem;
  private readonly groundY: number;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.projection = projection;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.groundY = projection.contactY - 34;

    this.shadow = scene.add.ellipse(0, 0, 76, 16, 0x86b5ca, 0.45);
    this.body = scene.add.container(0, 0);
    this.shadow.setDepth(projection.contactY - 1);
    this.body.setDepth(projection.contactY + 1);
    this.leftFoot = scene.add.ellipse(-13, 30, 23, 11, 0xf5a83d);
    this.rightFoot = scene.add.ellipse(13, 30, 23, 11, 0xf5a83d);
    this.leftFlipper = scene.add.ellipse(-25, 1, 14, 41, 0x183548);
    this.rightFlipper = scene.add.ellipse(25, 1, 14, 41, 0x183548);

    // Rear view: a dark back, nape, small tail, and orange heels. No face or belly.
    const back = scene.add.graphics();
    back.fillStyle(0x183548);
    back.fillEllipse(0, 0, 49, 65);
    back.fillCircle(0, -29, 22);
    back.fillStyle(0x244b60);
    back.fillEllipse(-7, -4, 15, 38);
    back.fillEllipse(-5, -34, 19, 10);
    back.fillStyle(0x112b3d);
    back.fillTriangle(-8, 23, 8, 23, 0, 39);
    this.back = back;

    const front = scene.add.graphics();
    front.fillStyle(0x183548);
    front.fillEllipse(0, 0, 49, 65);
    front.fillCircle(0, -29, 22);
    front.fillStyle(0xf5fbff);
    front.fillEllipse(0, 6, 35, 47);
    front.fillEllipse(-8, -25, 21, 26);
    front.fillEllipse(8, -25, 21, 26);
    front.lineStyle(3, 0x183548);
    front.lineBetween(-13, -29, -9, -33);
    front.lineBetween(-9, -33, -5, -29);
    front.lineBetween(5, -29, 9, -33);
    front.lineBetween(9, -33, 13, -29);
    front.fillStyle(0xf5a83d);
    front.fillTriangle(-7, -22, 7, -22, 0, -13);
    front.fillStyle(0xf4a4a4, 0.7);
    front.fillEllipse(-14, -21, 8, 5);
    front.fillEllipse(14, -21, 8, 5);
    this.front = front.setVisible(false);
    this.sparkles = scene.add.graphics().setVisible(false);
    this.sparkles.lineStyle(3, 0xf5bc42);
    for (const [x, y] of [[-43, -50], [43, -57], [0, -72]]) {
      this.sparkles.lineBetween(x - 5, y, x + 5, y);
      this.sparkles.lineBetween(x, y - 6, x, y + 6);
    }
    this.body.add([this.leftFoot, this.rightFoot, this.leftFlipper, this.rightFlipper, back, front, this.sparkles]);
  }

  render(player: Readonly<PlayerState>, celebrationSeconds: number | null = null): void {
    if (celebrationSeconds !== null) {
      this.renderCelebration(player, celebrationSeconds);
      return;
    }
    this.back.setVisible(true);
    this.front.setVisible(false);
    this.sparkles.setVisible(false);
    this.body.setScale(1);
    this.leftFlipper.setY(1);
    this.rightFlipper.setY(1);
    const { x } = this.projection.project(player.courseX, 0);
    const airborne = player.jumpPhase !== "grounded";
    const stride = Math.sin(player.distanceTravelled / PLAYER_VIEW.strideDistance * Math.PI * 2);
    const step = airborne ? 0 : stride;
    const heightRatio = player.jumpHeight / PLAYER_CONFIG.jumpHeight;

    this.body.setPosition(x, this.groundY - player.jumpHeight - Math.abs(step) * 2);
    this.body.setAngle(step * 4);
    this.leftFoot.setY(30 + step * 4 - (airborne ? 5 : 0));
    this.rightFoot.setY(30 - step * 4 - (airborne ? 5 : 0));
    this.leftFlipper.setAngle(airborne ? 55 : 15 + step * 12);
    this.rightFlipper.setAngle(airborne ? -55 : -15 + step * 12);
    this.shadow.setPosition(x, this.groundY + 34);
    this.shadow.setScale(1 - heightRatio * 0.35);
    this.shadow.setAlpha(0.45 - heightRatio * 0.2);
  }

  private renderCelebration(player: Readonly<PlayerState>, seconds: number): void {
    const turn = this.reducedMotion ? 1 : Math.min(1, seconds / PLAYER_VIEW.turnSeconds);
    const center = Math.min(1, seconds / PLAYER_VIEW.centerSeconds);
    const courseX = player.courseX * (1 - center) ** 2;
    const { x } = this.projection.project(courseX, 0);
    const cheer = Math.max(0, seconds - PLAYER_VIEW.turnSeconds);
    const bounce = this.reducedMotion ? 0 : Math.abs(Math.sin(cheer / PLAYER_VIEW.cheerBounceSeconds * Math.PI));
    this.back.setVisible(turn < 0.5);
    this.front.setVisible(turn >= 0.5);
    this.sparkles.setVisible(turn >= 1);
    this.body.setPosition(x, this.groundY - bounce * PLAYER_VIEW.cheerBounceHeight)
      .setScale(Math.max(0.18, Math.abs(Math.cos(turn * Math.PI))), 1)
      .setAngle(this.reducedMotion ? 0 : Math.sin(cheer * Math.PI * 2) * 4);
    this.leftFoot.setY(30);
    this.rightFoot.setY(30);
    this.leftFlipper.setY(-10).setAngle(65 + bounce * 15);
    this.rightFlipper.setY(-10).setAngle(-65 - bounce * 15);
    this.shadow.setPosition(x, this.groundY + 34).setScale(1 - bounce * 0.08).setAlpha(0.45);
  }
}
