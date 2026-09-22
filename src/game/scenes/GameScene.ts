import { Scene, Scenes, type GameObjects } from "phaser";

import { GAME_EVENTS, SCENE_LAYOUT } from "@/game/config/constants";
import { Player } from "@/game/entities/Player";
import { PlayerView } from "@/game/entities/PlayerView";
import { KeyboardInput } from "@/game/input/KeyboardInput";
import { GamepadInput } from "@/game/input/GamepadInput";
import { InputManager } from "@/game/input/InputManager";
import { InputDebugOverlay } from "@/game/input/InputDebugOverlay";

export class GameScene extends Scene {
  static readonly KEY = "GameScene";
  private readonly inputTarget: HTMLElement;
  private controls?: InputManager;
  private keyboard?: KeyboardInput;
  private gamepad?: GamepadInput;
  private inputDebug?: InputDebugOverlay;
  private player?: Player;
  private playerView?: PlayerView;
  private instructions?: GameObjects.Text;
  private skipNextDelta = true;

  constructor(inputTarget: HTMLElement) {
    super(GameScene.KEY);
    this.inputTarget = inputTarget;
  }

  create(): void {
    try {
      this.setupInput();
      this.drawLandscape();
      this.player = new Player();
      this.playerView = new PlayerView(this);
      this.playerView.render(this.player.state);
      this.instructions = this.add.text(this.scale.width / 2, this.scale.height - 24, "", {
        fontFamily: "sans-serif", fontSize: "16px", color: "#34566c",
      }).setOrigin(0.5);
      const debug = new URLSearchParams(window.location.search).get("debugInput");
      if (debug === "1" || (process.env.NODE_ENV === "development" && debug !== "0")) {
        this.inputDebug = new InputDebugOverlay(this);
      }
      this.game.events.emit(GAME_EVENTS.ready);
    } catch (error) {
      this.game.events.emit(GAME_EVENTS.error, error);
    }
  }

  update(time: number, delta: number): void {
    if (!this.controls || !this.keyboard || !this.gamepad || !this.player) return;
    const active = this.keyboard.isActive;
    const input = this.controls.update(active);
    if (active) {
      this.player.update(input, this.skipNextDelta ? 0 : delta);
      this.skipNextDelta = false;
    } else {
      this.skipNextDelta = true;
    }
    this.playerView?.render(this.player.state);
    this.instructions?.setText(active
      ? "← → 이동 · ↑ ↓ 가감속 · SPACE 점프  /  패드: 왼쪽 스틱 · 남쪽 버튼"
      : "일시정지 · 화면을 클릭하거나 Tab으로 선택해 출발하세요");
    this.inputDebug?.update(time, input, active, this.gamepad.status, this.player.state);
  }

  private setupInput(): void {
    const keyboard = new KeyboardInput(this.inputTarget);
    const gamepad = new GamepadInput();
    const controls = new InputManager(keyboard, gamepad);
    this.keyboard = keyboard;
    this.gamepad = gamepad;
    this.controls = controls;

    // Reset synchronously even if the hidden tab's game loop stops updating.
    const document = this.inputTarget.ownerDocument;
    const window = document.defaultView;
    const reset = () => {
      controls.reset();
      // Discard the first delta after refocusing, including a whole hidden interval.
      this.skipNextDelta = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") reset();
    };
    this.inputTarget.addEventListener("blur", reset);
    window?.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", onVisibility);

    const cleanup = () => {
      this.inputTarget.removeEventListener("blur", reset);
      window?.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibility);
      controls.destroy();
      this.controls = this.keyboard = this.gamepad = this.inputDebug = undefined;
      this.player = this.playerView = this.instructions = undefined;
      this.skipNextDelta = true;
      this.events.off(Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Scenes.Events.DESTROY, cleanup);
    };
    this.events.once(Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Scenes.Events.DESTROY, cleanup);
  }

  private drawLandscape(): void {
    const { width, height } = this.scale;
    const horizonY = Math.round(height * SCENE_LAYOUT.horizonRatio);
    const scenery = this.add.graphics();

    scenery.fillStyle(0x62c1ec);
    scenery.fillRect(0, 0, width, height);

    // Original placeholder geometry; no external assets are needed to boot.
    scenery.fillStyle(0xd8f2fa);
    scenery.fillTriangle(0, horizonY, 150, horizonY - 70, 310, horizonY);
    scenery.fillTriangle(200, horizonY, 360, horizonY - 40, 510, horizonY);
    scenery.fillTriangle(570, horizonY, 730, horizonY - 62, 960, horizonY);
    scenery.fillStyle(0xb5e3f2);
    scenery.fillTriangle(150, horizonY - 70, 190, horizonY, 310, horizonY);
    scenery.fillTriangle(730, horizonY - 62, 785, horizonY, 960, horizonY);

    scenery.fillStyle(0xf5fbff);
    scenery.fillRect(0, horizonY, width, height - horizonY);
    scenery.fillStyle(0xe0f1f9);
    scenery.fillRect(0, horizonY, width, 5);
  }

}
