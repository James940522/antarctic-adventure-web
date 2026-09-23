import type { GameSnapshot } from "@/game/types/game.types";
import { formatDistance } from "@/game/utils/formatDistance";
import styles from "./GameViewport.module.css";
import { GameOverPanel } from "./GameOverPanel";
import type { LocalPlayer } from "@/game/types/local-player.types";

export function GameHud({ run, onRestart, onPause, onMenu, onRanking, player }: { run: GameSnapshot; onRestart: () => void; onPause: () => void; onMenu: () => void; onRanking?: () => void; player: LocalPlayer }) {
  const gameover = run.status === "gameover";
  // Fast Refresh can briefly retain a snapshot from before average tracking.
  const averageSpeed = run.averageSpeed?.toFixed(1) ?? "—";
  const bestAverageSpeed = run.bestAverageSpeed?.toFixed(1);
  const { next, arrival } = run.landmarks;
  return <div className={`${styles.hud} pointer-events-none absolute inset-0 text-slate-950`}>
    <div className={`${styles.hudTop} absolute inset-x-0 top-0 grid grid-cols-[1fr_1fr_1fr] items-start gap-[1%] bg-gradient-to-b from-slate-950/85 to-slate-950/0 px-[3%] pb-[5%] pt-[2%] text-white`}>
      <div>
        <p className="text-[clamp(8px,1.3cqw,12px)] font-bold tracking-widest text-cyan-200">WHITE HORIZON / ANTARCTIC RUN</p>
        <p className="text-[clamp(20px,4cqw,40px)] font-black leading-tight tabular-nums" aria-label={`전진 거리 ${Math.floor(run.distance)}미터`}>
          {formatDistance(run.distance)}
        </p>
        <p className="text-[clamp(9px,1.5cqw,14px)] font-bold tabular-nums text-lime-200">{gameover ? "SCORE" : "예상 SCORE"} {run.score.toLocaleString()}</p>
        <p className="text-[clamp(9px,1.5cqw,14px)] tabular-nums text-cyan-100" aria-label={`평균 속도 ${averageSpeed}미터 매초`}>평균 {averageSpeed} m/s</p>
      </div>
      <div aria-label="다음 랜드마크" className="min-w-0 text-center leading-snug">
        <p className="text-[clamp(8px,1.3cqw,12px)] font-bold tracking-[0.2em] text-cyan-200">{arrival ? "ARRIVED" : "NEXT"}</p>
        <p className="mt-[0.3cqw] break-keep text-[clamp(10px,1.7cqw,16px)] font-bold">{next?.name ?? "--"}</p>
        {next && <p className="text-[clamp(10px,1.7cqw,16px)] tabular-nums text-cyan-100">{arrival ? "도착!" : `${next.distanceRemaining.toLocaleString()} m`}</p>}
      </div>
      <div className="text-right text-[clamp(9px,1.5cqw,14px)]">
        <p className="tabular-nums">최장 거리 <strong>{formatDistance(run.bestDistance)}</strong></p>
        {bestAverageSpeed !== undefined && <p className="text-[clamp(8px,1.2cqw,12px)] tabular-nums text-slate-300">당시 평균 {bestAverageSpeed} m/s</p>}
        <p className="mt-1 font-bold tabular-nums text-lime-300" aria-label={`속도 ${run.speed}미터 매초`}>
          속도 {run.speed.toLocaleString()} <span className="font-normal">m/s</span>
        </p>
        <p className="mt-1 text-cyan-100">장애물은 점프로 회피</p>
        {!gameover && !run.pauseMenuOpen && <button type="button" onClick={onPause} aria-label="게임 일시정지" className="pointer-events-auto mt-1 min-h-11 rounded border border-white/30 bg-slate-950/40 px-3 text-xs text-white">Ⅱ 일시정지</button>}
      </div>
    </div>
    {!gameover && !run.paused && arrival && <div role="status" aria-label="랜드마크 도착" className="absolute inset-x-[15%] bottom-[3%] text-center text-slate-900">
      <p className="text-[clamp(10px,1.6cqw,16px)] font-bold">{arrival.name} 도착 · 곧 다시 출발합니다</p>
    </div>}
    {gameover ? <GameOverPanel key={run.runId} run={run} player={player} onRestart={onRestart} onMenu={onMenu} onRanking={onRanking} /> : run.paused && !run.pauseMenuOpen ? <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
      <p className="rounded bg-slate-950/80 px-4 py-2 text-sm text-white">일시정지 · 이 창으로 돌아오면 계속 달립니다</p>
    </div> : null}
    {run.status === "running" && !run.paused && <div className={`${styles.desktopHint} absolute inset-x-0 bottom-[3%] px-3 text-center text-[clamp(8px,1.3cqw,12px)] font-medium text-slate-600`}>
      {run.inputActive ? "← → 이동 · ↑ ↓ 속도 ±8 m/s · SPACE 점프 · 패드 지원" : "자동 전진 중 · 화면 클릭 또는 Tab으로 조작 시작"}
    </div>}
  </div>;
}
