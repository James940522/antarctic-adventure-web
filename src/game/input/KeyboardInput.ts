import { createDeviceInput, type InputSource } from "./input.types.ts";

const GAME_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS", "Space", "Escape",
]);

export class KeyboardInput implements InputSource {
  private readonly target: HTMLElement;
  private readonly keys = new Set<string>();
  private readonly state = createDeviceInput();
  private jumpPending = false;
  private upPending = false;
  private downPending = false;
  private pausePending = false;

  constructor(target: HTMLElement) {
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.reset);
    target.ownerDocument.defaultView?.addEventListener("blur", this.reset);
    target.ownerDocument.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  get isActive(): boolean {
    const document = this.target.ownerDocument;
    return document.activeElement === this.target
      && document.visibilityState !== "hidden"
      && document.hasFocus();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.isActive || !GAME_KEYS.has(event.code)
      || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

    event.preventDefault();
    // Repeats after losing focus must not re-arm a key that was reset.
    if (event.repeat) return;
    if (event.code === "Escape" && !this.keys.has("Escape")) this.pausePending = true;
    if (event.code === "Space" && !this.keys.has("Space")) this.jumpPending = true;
    if ((event.code === "ArrowUp" || event.code === "KeyW")
      && !this.keys.has("ArrowUp") && !this.keys.has("KeyW")) this.upPending = true;
    if ((event.code === "ArrowDown" || event.code === "KeyS")
      && !this.keys.has("ArrowDown") && !this.keys.has("KeyS")) this.downPending = true;
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (this.isActive && GAME_KEYS.has(event.code)) event.preventDefault();
    this.keys.delete(event.code);
  };

  private onVisibilityChange = (): void => {
    if (this.target.ownerDocument.visibilityState === "hidden") this.reset();
  };

  read() {
    this.state.pause = this.keys.has("Escape");
    this.state.pausePressed = this.pausePending;
    this.pausePending = false;
    this.state.left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    this.state.right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    this.state.up = this.upPending || this.keys.has("ArrowUp") || this.keys.has("KeyW");
    this.state.down = this.downPending || this.keys.has("ArrowDown") || this.keys.has("KeyS");
    this.upPending = this.downPending = false;
    this.state.jump = this.keys.has("Space");
    // Preserve a short down/up tap even when both events precede the next frame.
    this.state.jumpPressed = this.jumpPending;
    this.jumpPending = false;
    return this.state;
  }

  reset = (): void => {
    this.keys.clear();
    this.jumpPending = false;
    this.upPending = this.downPending = false;
    this.pausePending = this.state.pause = this.state.pausePressed = false;
    this.state.left = this.state.right = this.state.up = this.state.down = false;
    this.state.jump = this.state.jumpPressed = false;
  };

  destroy(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.reset);
    this.target.ownerDocument.defaultView?.removeEventListener("blur", this.reset);
    this.target.ownerDocument.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.reset();
  }
}
