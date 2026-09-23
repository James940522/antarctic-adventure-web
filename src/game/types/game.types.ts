import type { RunSnapshot } from "../systems/RunSystem";
import type { LandmarkSnapshot } from "../systems/LandmarkSystem";

export type GameSnapshot = RunSnapshot & { landmarks: LandmarkSnapshot };
