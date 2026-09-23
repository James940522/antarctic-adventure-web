/** Display whole meters with thousands separators; simulation and records keep meters. */
export function formatDistance(meters: number): string {
  return `${Math.floor(meters).toLocaleString("ko-KR")} m`;
}
