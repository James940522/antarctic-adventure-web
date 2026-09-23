import { GAME_SIZE, PLAYER_VIEW } from "../config/constants.ts";

export const ITEM_TYPES = ["ghost-penguin"] as const;
export type ItemType = typeof ITEM_TYPES[number];
export type ItemEffectType = "ghost";

export const ITEM_CONFIG = {
  frameName: "artwork",
  minSpawnGapMeters: 3000,
  maxSpawnGapMeters: 4000,
  unsafeRetryGapMeters: 10,
  obstacleClearanceMeters: 12,
  pickupHalfDepth: 20,
} as const;

export const ITEM_VIEW_CONFIG = {
  minWidth: 32, // Logical pixels: keep the pickup readable at the horizon.
  pulseSeconds: 1.8,
  borderWidth: 1,
  minSparkleRadius: 6,
  haloColor: 0xff3548,
  backingColor: 0x632638,
  sparkleColor: 0xff5262,
} as const;

export const GHOST_CONFIG = {
  durationSeconds: 10,
  warningSeconds: 5,
  opacity: 0.55,
  blinkSlowIntervalSeconds: 0.5,
  blinkFastIntervalSeconds: 0.12,
  countdownPopSeconds: 0.32,
  countdownYRatio: 0.27,
} as const;

export type ItemDefinition = {
  assetKey: string;
  assetPath: string;
  assetFrame: readonly [x: number, y: number, width: number, height: number];
  visualWidth: number;
  pickupHalfWidth: number;
  pickupHeight: number;
  effect: { type: ItemEffectType; durationSeconds: number };
};

const nearHalfWidth = GAME_SIZE.width / 2 - PLAYER_VIEW.screenMargin;
export const ITEM_DEFINITIONS: Readonly<Record<ItemType, ItemDefinition>> = {
  "ghost-penguin": {
    assetKey: "item-ghost-penguin",
    assetPath: "/asset/img/item/item_ghost_penguin.png",
    // Texture frame only: the supplied PNG and its rounded border stay untouched.
    assetFrame: [64, 64, 1128, 1128],
    visualWidth: 84,
    pickupHalfWidth: 42 / nearHalfWidth,
    pickupHeight: 84,
    effect: { type: "ghost", durationSeconds: GHOST_CONFIG.durationSeconds },
  },
};

export type GameItem = {
  id: number;
  type: ItemType;
  courseX: number;
  distance: number;
};
