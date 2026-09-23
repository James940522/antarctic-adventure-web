/** Formatting only: simulation and records always keep meters. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.floor(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}
