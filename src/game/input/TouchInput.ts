import { createDeviceInput, type InputSource } from "./input.types.ts";

const ACTIONS = ["left", "right", "jump", "up", "down"] as const;
export type TouchAction = typeof ACTIONS[number];

export class TouchInput implements InputSource {
  private readonly target?: HTMLElement;
  private readonly pointers = new Map<number, TouchAction>();
  private readonly captures = new Map<number, HTMLButtonElement>();
  private readonly pending = new Set<TouchAction>();
  private readonly state = createDeviceInput();

  constructor(target?: HTMLElement) {
    this.target = target;
    target?.addEventListener("pointerdown", this.onPointerDown);
    target?.addEventListener("lostpointercapture", this.onPointerUp);
    target?.addEventListener("keydown", this.onKeyDown);
    target?.addEventListener("keyup", this.onKeyUp);
    target?.addEventListener("focusout", this.onFocusOut);
    target?.addEventListener("click", this.onClick);
    const window = target?.ownerDocument.defaultView;
    window?.addEventListener("pointerup", this.onPointerUp);
    window?.addEventListener("pointercancel", this.onPointerUp);
    window?.addEventListener("blur", this.reset);
    window?.addEventListener("resize", this.reset);
    target?.ownerDocument.addEventListener("visibilitychange", this.onVisibility);
  }

  get isActive(): boolean { return this.pointers.size > 0 || this.pending.size > 0; }

  press(id: number, action: TouchAction): void {
    if (this.pointers.has(id)) return;
    if (!this.held(action)) this.pending.add(action);
    this.pointers.set(id, action);
    this.updateButtons();
  }

  release(id: number): void {
    this.pointers.delete(id);
    const button = this.captures.get(id);
    this.captures.delete(id);
    if (button?.hasPointerCapture(id)) button.releasePointerCapture(id);
    this.updateButtons();
  }

  read() {
    this.state.left = this.held("left") || this.pending.has("left");
    this.state.right = this.held("right") || this.pending.has("right");
    this.state.up = this.held("up") || this.pending.has("up");
    this.state.down = this.held("down") || this.pending.has("down");
    this.state.jump = this.held("jump");
    this.state.jumpPressed = this.pending.has("jump");
    this.pending.clear();
    return this.state;
  }

  reset = (): void => {
    const hadInput = this.isActive || this.captures.size > 0;
    this.pointers.clear();
    this.pending.clear();
    for (const [id, button] of this.captures) {
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    this.captures.clear();
    Object.assign(this.state, createDeviceInput());
    if (hadInput) this.updateButtons();
  };

  destroy(): void {
    this.reset();
    const target = this.target;
    target?.removeEventListener("pointerdown", this.onPointerDown);
    target?.removeEventListener("lostpointercapture", this.onPointerUp);
    target?.removeEventListener("keydown", this.onKeyDown);
    target?.removeEventListener("keyup", this.onKeyUp);
    target?.removeEventListener("focusout", this.onFocusOut);
    target?.removeEventListener("click", this.onClick);
    const window = target?.ownerDocument.defaultView;
    window?.removeEventListener("pointerup", this.onPointerUp);
    window?.removeEventListener("pointercancel", this.onPointerUp);
    window?.removeEventListener("blur", this.reset);
    window?.removeEventListener("resize", this.reset);
    target?.ownerDocument.removeEventListener("visibilitychange", this.onVisibility);
  }

  private held(action: TouchAction): boolean {
    for (const held of this.pointers.values()) if (held === action) return true;
    return false;
  }

  private buttonFor(event: Event): HTMLButtonElement | null {
    const button = (event.target as Element | null)?.closest?.<HTMLButtonElement>("button[data-game-action]");
    return button && !button.disabled && this.target?.contains(button) ? button : null;
  }

  private actionFor(button: HTMLButtonElement): TouchAction | undefined {
    return ACTIONS.find((action) => action === button.dataset.gameAction);
  }

  private onPointerDown = (event: PointerEvent): void => {
    const button = this.buttonFor(event);
    if (!button || (event.pointerType === "mouse" && event.button !== 0)) return;
    const action = this.actionFor(button);
    if (!action) return;
    event.preventDefault();
    this.target?.focus({ preventScroll: true });
    this.press(event.pointerId, action);
    // Capture keeps a finger held when it slides off the button. Window listeners
    // also release it when capture is unavailable or interrupted by the browser.
    try { button.setPointerCapture(event.pointerId); this.captures.set(event.pointerId, button); }
    catch { /* Synthetic/accessibility input may have no active pointer. */ }
  };

  private onPointerUp = (event: PointerEvent): void => {
    const action = this.pointers.get(event.pointerId);
    this.release(event.pointerId);
    if (event.type !== "pointerup" && action && !this.held(action)) this.pending.delete(action);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    const button = this.buttonFor(event);
    if (!button || !["Space", "Enter"].includes(event.code)) return;
    event.preventDefault();
    const action = this.actionFor(button);
    if (action && !event.repeat) this.press(-1 - ACTIONS.indexOf(action), action);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const button = this.buttonFor(event);
    if (!button || !["Space", "Enter"].includes(event.code)) return;
    event.preventDefault();
    const action = this.actionFor(button);
    if (action) this.release(-1 - ACTIONS.indexOf(action));
  };

  private onFocusOut = (event: FocusEvent): void => {
    const button = this.buttonFor(event);
    const action = button && this.actionFor(button);
    if (action) this.release(-1 - ACTIONS.indexOf(action));
  };

  private onClick = (event: MouseEvent): void => {
    const button = this.buttonFor(event);
    if (!button || event.detail !== 0) return;
    const action = this.actionFor(button);
    if (action) { this.press(-100, action); this.release(-100); }
  };

  private onVisibility = (): void => {
    if (this.target?.ownerDocument.visibilityState === "hidden") this.reset();
  };

  private updateButtons(): void {
    this.target?.querySelectorAll<HTMLButtonElement>("button[data-game-action]").forEach((button) => {
      const action = this.actionFor(button);
      button.dataset.pressed = String(Boolean(action && this.held(action)));
    });
  }
}
