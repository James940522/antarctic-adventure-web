/** Formatting only: simulation and records always keep meters. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.floor(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

/** Result/HUD distance is already in meters; convert once and preserve meter precision. */
export function formatKilometers(meters: number): string {
  return `${(meters / 1000).toFixed(3)} km`;
}
