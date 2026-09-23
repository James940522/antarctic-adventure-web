import { Scene, Scenes, Scale, type GameObjects } from "phaser";

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
import { ItemView } from "@/game/systems/ItemView";
import { LandmarkSystem } from "@/game/systems/LandmarkSystem";
import { LandmarkView } from "@/game/systems/LandmarkView";
import type { GameSnapshot } from "@/game/types/game.types";
import { ObstacleDebugScenario } from "@/game/systems/ObstacleDebugScenario";

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
  private itemView?: ItemView;
  private playerView?: PlayerView;
  private landmarks?: LandmarkSystem;
  private projection?: PerspectiveSystem;
  private scenery?: GameObjects.Graphics;
  private skipNextDelta = true;
  private nextHudRefresh = 0;
  private restartAt = 0;
  private obstacleDebug?: ObstacleDebugScenario;
  private obstacleDebugText?: GameObjects.Text;

  constructor(inputTarget: HTMLElement) {
    super(GameScene.KEY);
    this.inputTarget = inputTarget;
  }

  create(): void {
    try {
      this.setupInput();
      this.drawLandscape();
      this.records = new RecordStore();
      const projection = new PerspectiveSystem(this.scale.height);
      this.projection = projection;
      this.landmarks = new LandmarkSystem(new LandmarkView(this, projection), (landmark) => {
        this.game.events.emit(GAME_EVENTS.landmarkArrived, landmark);
        this.nextHudRefresh = 0;
      });
      this.run = new RunSystem(this.records.value, Math.random, this.landmarks);
      if (process.env.NODE_ENV === "development") {
        this.obstacleDebug = ObstacleDebugScenario.fromSearch(window.location.search);
        if (this.obstacleDebug) {
          this.obstacleDebug.reset(this.run);
          this.obstacleDebugText = this.add.text(480, 110, "", {
            fontSize: "14px", color: "#ffffff", backgroundColor: "#173b51", padding: { x: 8, y: 5 },
          }).setOrigin(0.5, 0).setDepth(1001);
        }
      }
      this.courseView = new CourseView(this, projection);
      this.itemView = new ItemView(this, projection);
      this.playerView = new PlayerView(this, projection);
      this.playerView.render(this.run.player.state);
      this.scale.on(Scale.Events.RESIZE, this.resizeViewport, this);
      this.game.events.on(GAME_EVENTS.restart, this.restart, this);
      this.game.events.on(GAME_EVENTS.pause, this.setPaused, this);
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
    const previousStatus = this.run.status;
    const input = this.controls.update(active && (inputActive || this.run.isPaused));
    if (this.controls.pausePressed) this.setPaused(!this.run.isPaused);
    if (active && !this.run.isPaused && previousStatus !== "gameover") {
      const ended = this.run.update(this.obstacleDebug?.input(this.run, input) ?? input, this.skipNextDelta ? 0 : delta);
      this.skipNextDelta = false;
      if (previousStatus !== this.run.status) {
        this.controls.reset();
        this.nextHudRefresh = 0;
        this.game.canvas.setAttribute("aria-label", this.run.status === "celebrating"
          ? "랜드마크 앞에서 뒤돌아 날개를 들고 기뻐하는 펭귄"
          : "눈 덮인 남극의 지평선을 향해 달리는 펭귄의 뒷모습");
      }
      if (ended) {
        this.controls.reset();
        if (this.records) {
          this.run.newRecord = this.records.save(this.run.bestRecord);
          this.run.bestRecord = this.records.value;
        }
        this.restartAt = time + 600;
        this.nextHudRefresh = 0;
      }
    } else if (active && this.run.status === "gameover" && input.jumpPressed && time >= this.restartAt) {
      this.restart();
    } else {
      this.skipNextDelta = true;
    }
    if (this.projection) this.projection.viewDistance = this.run.obstacles.viewDistance;
    if (this.obstacleDebug) this.obstacleDebugText?.setText(this.obstacleDebug.label(this.run));
    this.courseView?.render(this.run.player.state.distanceTravelled, this.run.obstacles.items);
    this.itemView?.render(this.run.player.state.distanceTravelled, this.run.items.items, this.run.effects.ghostSeconds);
    this.playerView?.render(this.run.player.state, this.landmarks?.celebrationElapsedSeconds ?? null, this.run.effects.ghostSeconds);
    this.inputDebug?.update(time, input, inputActive, this.gamepad.status, this.run.player.state, this.landmarks);
    if (time >= this.nextHudRefresh) {
      this.nextHudRefresh = time + RUN_CONFIG.hudRefreshMs;
      this.publishSnapshot();
    }
  }

  private publishSnapshot(): void {
    if (!this.run || !this.landmarks) return;
    if (this.obstacleDebug) this.game.canvas.setAttribute("aria-label", this.obstacleDebug.label(this.run));
    const document = this.inputTarget.ownerDocument;
    const snapshot: GameSnapshot = {
      ...this.run.snapshot(
        document.visibilityState === "hidden" || !document.hasFocus(),
        (this.keyboard?.isActive ?? false) || (this.touch?.isActive ?? false),
      ),
      landmarks: this.landmarks.snapshot(),
    };
    this.game.events.emit(GAME_EVENTS.snapshot, snapshot);
  }

  private restart(): void {
    if (!this.run || this.run.status !== "gameover") return;
    this.run.restart();
    this.obstacleDebug?.reset(this.run);
    this.controls?.reset();
    this.courseView?.reset();
    this.itemView?.reset();
    this.skipNextDelta = true;
    this.nextHudRefresh = 0;
    this.game.events.emit(GAME_EVENTS.restarted);
    this.publishSnapshot();
  }

  private setPaused(paused: boolean): void {
    if (!this.run?.setPaused(paused)) return;
    this.controls?.reset();
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
    controls.reset();

    // Reset synchronously even if the hidden tab's game loop stops updating.
    const document = this.inputTarget.ownerDocument;
    const window = document.defaultView;
    const reset = () => {
      controls.reset();
      this.run?.player.clearBufferedJump();
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
      this.scale.off(Scale.Events.RESIZE, this.resizeViewport, this);
      this.game.events.off(GAME_EVENTS.restart, this.restart, this);
      this.game.events.off(GAME_EVENTS.pause, this.setPaused, this);
      this.courseView?.reset();
      this.itemView?.destroy();
      this.landmarks?.reset();
      this.controls = this.keyboard = this.gamepad = this.inputDebug = this.touch = undefined;
      this.run = this.playerView = this.courseView = this.records = undefined;
      this.itemView = undefined;
      this.landmarks = undefined;
      this.projection = this.scenery = undefined;
      this.obstacleDebugText?.destroy();
      this.obstacleDebug = this.obstacleDebugText = undefined;
      this.skipNextDelta = true;
      this.events.off(Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Scenes.Events.DESTROY, cleanup);
    };
    this.events.once(Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Scenes.Events.DESTROY, cleanup);
  }

  private resizeViewport(): void {
    if (!this.projection) return;
    this.projection.height = this.scale.height;
    this.drawLandscape();
    this.courseView?.resize();
    this.landmarks?.render();
    this.controls?.reset();
    this.run?.player.clearBufferedJump();
  }

  private drawLandscape(): void {
    const { width, height } = this.scale;
    const horizonY = Math.round(height * SCENE_LAYOUT.horizonRatio);
    const scenery = this.scenery ??= this.add.graphics().setDepth(0);
    scenery.clear();

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
