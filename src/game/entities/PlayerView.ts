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
  private readonly projection: PerspectiveSystem;
  private readonly groundY: number;

  constructor(scene: Scene, projection: PerspectiveSystem) {
    this.projection = projection;
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
    this.body.add([this.leftFoot, this.rightFoot, this.leftFlipper, this.rightFlipper, back]);
  }

  render(player: Readonly<PlayerState>): void {
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
}
