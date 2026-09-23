import { GAME_SIZE } from "./constants.ts";

// Keep the horizontal course and collision widths fixed; extend the scene vertically.
// Read the host's content size before CSS rotation, never its rotated screen bounds.
export function getViewportHeight(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return GAME_SIZE.height;
  return Math.max(1, Math.round(GAME_SIZE.width * height / width));
}
