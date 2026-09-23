import type { RankingsResponse } from "../types/ranking.types.ts";
import { parseRankings } from "./ranking-response.ts";

type RankingState =
  | { status: "loading" | "error"; data: null }
  | { status: "ready"; data: RankingsResponse };
export class RankingStore {
  private state: RankingState = { status: "loading", data: null };
  private readonly listeners = new Set<() => void>();
  private controller?: AbortController;
  private timeout?: ReturnType<typeof setTimeout>;
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
    this.dispose();
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => {
      controller.abort();
      if (this.controller === controller) this.setState({ status: "error", data: null });
    }, 15000);
    this.timeout = timeout;
    this.setState({ status: "loading", data: null });
    try {
      const response = await this.request(`/api/rankings?playerId=${encodeURIComponent(this.playerId)}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Rankings unavailable.");
      const data = parseRankings(await response.json());
      if (this.controller === controller && !controller.signal.aborted) this.setState({ status: "ready", data });
    } catch {
      if (this.controller === controller && !controller.signal.aborted) this.setState({ status: "error", data: null });
    } finally {
      clearTimeout(timeout);
      if (this.controller === controller) this.timeout = undefined;
    }
  };
  dispose = () => {
    clearTimeout(this.timeout);
    this.timeout = undefined;
    const controller = this.controller;
    this.controller = undefined;
    controller?.abort();
  };
}
