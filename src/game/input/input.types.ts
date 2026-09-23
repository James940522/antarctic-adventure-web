export type GameInputState = {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  jump: boolean;
  horizontalAxis: number;
  verticalAxis: number;
  jumpPressed: boolean;
  jumpReleased: boolean;
};

// Digital directions remain separate from analog axes until devices are merged.
export type DeviceInputState = {
  pause: boolean;
  pausePressed: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  horizontalAxis: number;
  verticalAxis: number;
  jump: boolean;
  jumpPressed: boolean;
};

export interface InputSource {
  read(): Readonly<DeviceInputState>;
  reset(): void;
  destroy(): void;
}

export function createDeviceInput(): DeviceInputState {
  return {
    pause: false,
    pausePressed: false,
    left: false,
    right: false,
    up: false,
    down: false,
    horizontalAxis: 0,
    verticalAxis: 0,
    jump: false,
    jumpPressed: false,
  };
}
