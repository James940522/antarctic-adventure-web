import { Scene, Scenes } from "phaser";

import { GAME_EVENTS, RUN_CONFIG, SCENE_LAYOUT } from "@/game/config/constants";
import { PlayerView } from "@/game/entities/PlayerView";
import { KeyboardInput } from "@/game/input/KeyboardInput";
import { GamepadInput } from "@/game/input/GamepadInput";
import { InputManager } from "@/game/input/InputManager";
import { InputDebugOverlay } from "@/game/input/InputDebugOverlay";
import { TouchInput } from "@/game/input/TouchInput";
import { RunSystem } from "@/game/systems/RunSystem";
import { RecordStore } from "@/game/systems/RecordStore";
import { PerspectiveSystem } from "@/game/systems/PerspectiveSystem";
import { CourseView } from "@/game/systems/CourseView";

export class GameScene extends Scene {
  static readonly KEY = "GameScene";
  private readonly inputTarget: HTMLElement;
  private controls?: InputManager;
  private keyboard?: KeyboardInput;
  private gamepad?: GamepadInput;
  private inputDebug?: InputDebugOverlay;
  private touch?: TouchInput;
  private run?: RunSystem;
  private records?: RecordStore;
  private courseView?: CourseView;
  private playerView?: PlayerView;
  private skipNextDelta = true;
  private nextHudRefresh = 0;
  private restartAt = 0;

  constructor(inputTarget: HTMLElement) {
    super(GameScene.KEY);
    this.inputTarget = inputTarget;
  }

  create(): void {
    try {
      this.setupInput();
      this.drawLandscape();
      this.records = new RecordStore();
      this.run = new RunSystem(this.records.value);
      const projection = new PerspectiveSystem();
      this.courseView = new CourseView(this, projection);
      this.playerView = new PlayerView(this, projection);
      this.playerView.render(this.run.player.state);
      this.game.events.on(GAME_EVENTS.restart, this.restart, this);
      const debug = new URLSearchParams(window.location.search).get("debugInput");
      if (debug === "1") {
        this.inputDebug = new InputDebugOverlay(this);
      }
      this.game.events.emit(GAME_EVENTS.ready);
      this.publishSnapshot();
    } catch (error) {
      this.game.events.emit(GAME_EVENTS.error, error);
    }
  }

  update(time: number, delta: number): void {
    if (!this.controls || !this.keyboard || !this.gamepad || !this.run) return;
    const inputActive = this.keyboard.isActive || (this.touch?.isActive ?? false);
    const document = this.inputTarget.ownerDocument;
    const active = document.visibilityState !== "hidden" && document.hasFocus();
    const input = this.controls.update(inputActive);
    if (active && this.run.status === "running") {
      const ended = this.run.update(input, this.skipNextDelta ? 0 : delta);
      this.skipNextDelta = false;
      if (ended) {
        this.controls.reset();
        this.records?.save(this.run.bestDistance);
        this.restartAt = time + 600;
        this.nextHudRefresh = 0;
      }
    } else if (active && this.run.status === "gameover" && input.jumpPressed && time >= this.restartAt) {
      this.restart();
    } else {
      this.skipNextDelta = true;
    }
    this.courseView?.render(this.run.player.state.distanceTravelled, this.run.elapsedSeconds, this.run.obstacles.boxes);
    this.playerView?.render(this.run.player.state);
    this.inputDebug?.update(time, input, inputActive, this.gamepad.status, this.run.player.state);
    if (time >= this.nextHudRefresh) {
      this.nextHudRefresh = time + RUN_CONFIG.hudRefreshMs;
      this.publishSnapshot();
    }
  }

  private publishSnapshot(): void {
    const document = this.inputTarget.ownerDocument;
    this.game.events.emit(GAME_EVENTS.snapshot, this.run?.snapshot(
      document.visibilityState === "hidden" || !document.hasFocus(),
      (this.keyboard?.isActive ?? false) || (this.touch?.isActive ?? false),
    ));
  }

  private restart(): void {
    if (!this.run || this.run.status !== "gameover") return;
    this.run.restart();
    this.controls?.reset();
    this.courseView?.reset();
    this.skipNextDelta = true;
    this.nextHudRefresh = 0;
    this.publishSnapshot();
  }

  private setupInput(): void {
    const keyboard = new KeyboardInput(this.inputTarget);
    const gamepad = new GamepadInput();
    const touch = new TouchInput(this.inputTarget);
    const controls = new InputManager(keyboard, gamepad, touch);
    this.keyboard = keyboard;
    this.gamepad = gamepad;
    this.touch = touch;
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
      if (document.visibilityState === "hidden") { reset(); this.publishSnapshot(); }
    };
    const onWindowBlur = () => { reset(); this.publishSnapshot(); };
    this.inputTarget.addEventListener("blur", reset);
    window?.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibility);

    const cleanup = () => {
      this.inputTarget.removeEventListener("blur", reset);
      window?.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      controls.destroy();
      this.game.events.off(GAME_EVENTS.restart, this.restart, this);
      this.courseView?.reset();
      this.controls = this.keyboard = this.gamepad = this.inputDebug = this.touch = undefined;
      this.run = this.playerView = this.courseView = this.records = undefined;
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
