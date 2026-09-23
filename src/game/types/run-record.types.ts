export type RunRecord = Readonly<{
  distance: number; // Whole meters; records are ranked by distance.
  averageSpeed: number | null; // m/s; null for records saved before speed tracking.
}>;
