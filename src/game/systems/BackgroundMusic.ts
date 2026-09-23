import { AUDIO_TRACKS } from "../config/audio.ts";

export type AudioPort = Pick<HTMLAudioElement, "src" | "currentTime" | "loop" | "volume" | "muted" | "play" | "pause" | "load" | "removeAttribute">;

/** One audio element for both screens; pause preserves position, screen changes reset it. */
export class BackgroundMusic {
  private readonly audio: AudioPort;
  private screen: "menu" | "game" = "menu";
  private paused = false;
  private active = true;
  private unlocked = false;
  private destroyed = false;

  constructor(audio: AudioPort) {
    this.audio = audio;
    audio.loop = true;
    audio.volume = 0.35;
    audio.src = AUDIO_TRACKS.menu;
  }

  setScreen(screen: "menu" | "game", paused = false): void {
    if (this.destroyed) return;
    if (screen !== this.screen) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.src = AUDIO_TRACKS[screen];
      this.screen = screen;
    }
    this.paused = paused;
    this.sync();
  }

  setActive(active: boolean): void { this.active = active; this.sync(); }
  setMuted(muted: boolean): void { this.audio.muted = muted; this.sync(); }
  unlock(): void { this.unlocked = true; this.sync(); }

  private sync(): void {
    if (this.destroyed) return;
    if (!this.unlocked || !this.active || this.paused || this.audio.muted) { this.audio.pause(); return; }
    // Autoplay, device and asset failures are non-fatal; another gesture retries.
    try { void this.audio.play().catch(() => {}); } catch { /* Optional audio cannot block the game. */ }
  }

  destroy(): void {
    this.destroyed = true;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }
}
