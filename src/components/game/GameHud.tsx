import type { GameSnapshot } from "@/game/types/game.types";
import { formatDistance } from "@/game/utils/formatDistance";
import styles from "./GameViewport.module.css";

export function GameHud({ run, onRestart }: { run: GameSnapshot; onRestart: () => void }) {
  const gameover = run.status === "gameover";
  // Fast Refresh can briefly retain a snapshot from before average tracking.
  const averageSpeed = run.averageSpeed?.toFixed(1) ?? "—";
  const bestAverageSpeed = run.bestAverageSpeed?.toFixed(1);
  const { next, arrival } = run.landmarks;
  return <div className={`${styles.hud} pointer-events-none absolute inset-0 text-slate-950`}>
    <div className={`${styles.hudTop} absolute inset-x-0 top-0 grid grid-cols-[1fr_1fr_1fr] items-start gap-[1%] bg-gradient-to-b from-slate-950/85 to-slate-950/0 px-[3%] pb-[5%] pt-[2%] text-white`}>
      <div>
        <p className="text-[clamp(8px,1.3cqw,12px)] font-bold tracking-widest text-cyan-200">ANTARCTIC / 거리 도전</p>
        <p className="text-[clamp(20px,4cqw,40px)] font-black leading-tight tabular-nums" aria-label={`이동 거리 ${run.distance}미터`}>
          {formatDistance(run.distance)}
        </p>
        <p className="text-[clamp(9px,1.5cqw,14px)] tabular-nums text-cyan-100" aria-label={`평균 속도 ${averageSpeed}미터 매초`}>평균 {averageSpeed} m/s</p>
      </div>
      <div aria-label="다음 랜드마크" className="min-w-0 text-center leading-snug">
        <p className="text-[clamp(8px,1.3cqw,12px)] font-bold tracking-[0.2em] text-cyan-200">{arrival ? "ARRIVED" : "NEXT"}</p>
        <p className="mt-[0.3cqw] break-keep text-[clamp(10px,1.7cqw,16px)] font-bold">{next?.name ?? "--"}</p>
        {next && <p className="text-[clamp(10px,1.7cqw,16px)] tabular-nums text-cyan-100">{arrival ? "도착!" : `${next.distanceRemaining.toLocaleString()} m`}</p>}
      </div>
      <div className="text-right text-[clamp(9px,1.5cqw,14px)]">
        <p className="tabular-nums">최고 기록 <strong>{formatDistance(run.bestDistance)}</strong></p>
        {bestAverageSpeed !== undefined && <p className="text-[clamp(8px,1.2cqw,12px)] tabular-nums text-slate-300">당시 평균 {bestAverageSpeed} m/s</p>}
        <p className="mt-1 font-bold tabular-nums text-lime-300" aria-label={`속도 ${run.speed}미터 매초`}>
          속도 {run.speed.toLocaleString()} <span className="font-normal">m/s</span>
        </p>
        <p className="mt-1 text-cyan-100">난이도 {run.boxesPerRow} · 한 줄 최대 {run.boxesPerRow}개</p>
      </div>
    </div>
    {!gameover && !run.paused && arrival && <div role="status" aria-label="랜드마크 도착" className="absolute inset-x-[15%] bottom-[3%] text-center text-slate-900">
      <p className="text-[clamp(10px,1.6cqw,16px)] font-bold">{arrival.name} 도착 · 곧 다시 출발합니다</p>
    </div>}
    {gameover ? <div className="absolute inset-0 grid place-items-center bg-slate-950/55 p-3">
      <div role="status" className="pointer-events-auto max-h-full max-w-md overflow-y-auto rounded-xl border border-white/20 bg-slate-950/95 px-4 py-2 text-center text-white shadow-xl sm:px-10 sm:py-7">
        <p className="text-[10px] font-bold tracking-[0.25em] text-lime-300 sm:text-xs">{run.newRecord ? "NEW RECORD" : "TRY AGAIN"}</p>
        <h2 className="mt-1 text-lg font-black sm:text-3xl">게임 오버</h2>
        <p className="mt-1 text-xs tabular-nums text-cyan-100 sm:mt-2 sm:text-base">평균 <strong>{averageSpeed} m/s</strong>로</p>
        <p className="my-1 text-2xl font-black tabular-nums sm:my-2 sm:text-5xl">{(run.distance / 1000).toFixed(3)} km <span className="text-xs font-medium sm:text-base">주행</span></p>
        <p className="text-[10px] tabular-nums text-slate-300 sm:text-sm">최고 기록 {(run.bestDistance / 1000).toFixed(3)} km · {bestAverageSpeed !== undefined ? `평균 ${bestAverageSpeed} m/s` : "평균 미측정"}</p>
        <p className="mt-1 text-[9px] text-slate-400 sm:text-xs">평균 속도는 실제 주행 시간 기준 · 정지/일시정지 제외</p>
        <button type="button" onClick={onRestart} className="mt-2 rounded bg-lime-300 px-6 py-1.5 text-xs font-bold text-slate-950 hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-3 sm:py-2 sm:text-sm">다시 도전</button>
        <p className="mt-2 hidden text-xs text-slate-400 sm:block">화면 선택 후 Space / 패드 남쪽 버튼으로도 재시작</p>
      </div>
    </div> : run.paused ? <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
      <p className="rounded bg-slate-950/80 px-4 py-2 text-sm text-white">일시정지 · 이 창으로 돌아오면 계속 달립니다</p>
    </div> : null}
    {run.status === "running" && !run.paused && <div className={`${styles.desktopHint} absolute inset-x-0 bottom-[3%] px-3 text-center text-[clamp(8px,1.3cqw,12px)] font-medium text-slate-600`}>
      {run.inputActive ? "← → 이동 · ↑ ↓ 속도 ±8 m/s · SPACE 점프 · 패드 지원" : "자동 전진 중 · 화면 클릭 또는 Tab으로 조작 시작"}
    </div>}
  </div>;
}
