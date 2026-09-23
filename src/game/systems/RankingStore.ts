import type { RankingsResponse } from "../types/ranking.types.ts";

type RankingState = { status: "loading" | "ready" | "error"; data: RankingsResponse | null };
export class RankingStore {
  private state: RankingState = { status: "loading", data: null };
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  private readonly playerId: string;
  private readonly request: typeof fetch;
  constructor(playerId: string, request: typeof fetch = fetch) {
    this.playerId = playerId;
    // Native browser fetch must not receive this store as its `this` value.
    this.request = (input, init) => request(input, init);
  }
  getSnapshot = (): RankingState => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private setState(state: RankingState) { this.state = state; for (const listener of this.listeners) listener(); }
  load = async (): Promise<void> => {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.setState({ status: "loading", data: null });
    try {
      const response = await this.request(`/api/rankings?playerId=${encodeURIComponent(this.playerId)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Rankings unavailable.");
      const data = await response.json() as RankingsResponse;
      if (!Array.isArray(data.rankings) || !Number.isInteger(data.totalPlayers) || data.totalPlayers < 0) throw new Error("Invalid rankings.");
      if (this.controller === controller) this.setState({ status: "ready", data });
    } catch {
      if (this.controller === controller) this.setState({ status: "error", data: null });
    } finally { clearTimeout(timeout); }
  };
  dispose = () => { this.controller?.abort(); this.controller = undefined; };
}
