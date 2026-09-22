import type { RunSnapshot } from "@/game/systems/RunSystem";
import styles from "./GameViewport.module.css";

export function GameHud({ run, onRestart }: { run: RunSnapshot; onRestart: () => void }) {
  const gameover = run.status === "gameover";
  return <div className="pointer-events-none absolute inset-0 text-slate-950">
    <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-slate-950/85 to-slate-950/0 px-[3%] pb-[5%] pt-[2%] text-white">
      <div>
        <p className="text-[clamp(8px,1.3cqw,12px)] font-bold tracking-widest text-cyan-200">ANTARCTIC / 거리 도전</p>
        <p className="text-[clamp(20px,4cqw,40px)] font-black leading-tight tabular-nums" aria-label={`이동 거리 ${run.distance}미터`}>
          {run.distance.toLocaleString()}<span className="ml-1 text-sm font-normal">m</span>
        </p>
      </div>
      <div className="text-right text-[clamp(9px,1.5cqw,14px)]">
        <p className="tabular-nums">최고 기록 <strong>{run.bestDistance.toLocaleString()} m</strong></p>
        <div className="mt-1 flex justify-end gap-1" aria-label={`속도 ${run.speedLevel}단`}>
          {[1, 2, 3].map((level) => <span key={level} className={`rounded-sm px-2 py-0.5 font-bold ${level <= run.speedLevel ? "bg-lime-300 text-slate-950" : "bg-white/15 text-white/50"}`}>{level}단</span>)}
        </div>
        <p className="mt-1 text-cyan-100">난이도 {run.boxesPerRow} · 한 줄 최대 {run.boxesPerRow}개</p>
      </div>
    </div>
    {gameover ? <div className="absolute inset-0 grid place-items-center bg-slate-950/55 p-3">
      <div role="status" className="pointer-events-auto max-h-full max-w-md overflow-y-auto rounded-xl border border-white/20 bg-slate-950/95 px-4 py-2 text-center text-white shadow-xl sm:px-10 sm:py-7">
        <p className="text-[10px] font-bold tracking-[0.25em] text-lime-300 sm:text-xs">{run.newRecord ? "NEW RECORD" : "TRY AGAIN"}</p>
        <h2 className="mt-1 text-lg font-black sm:text-3xl">게임 오버</h2>
        <p className="my-1 text-2xl font-black tabular-nums sm:my-2 sm:text-5xl">{run.distance.toLocaleString()} <span className="text-base">m</span></p>
        <p className="text-[10px] text-slate-300 sm:text-sm">최고 기록 {run.bestDistance.toLocaleString()} m · 박스에 부딪혔어요</p>
        <button type="button" onClick={onRestart} className="mt-2 rounded bg-lime-300 px-6 py-1.5 text-xs font-bold text-slate-950 hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:mt-3 sm:py-2 sm:text-sm">다시 도전</button>
        <p className="mt-2 hidden text-xs text-slate-400 sm:block">화면 선택 후 Space / 패드 남쪽 버튼으로도 재시작</p>
      </div>
    </div> : run.paused ? <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
      <p className="rounded bg-slate-950/80 px-4 py-2 text-sm text-white">일시정지 · 이 창으로 돌아오면 계속 달립니다</p>
    </div> : null}
    {!gameover && !run.paused && <div className={`${styles.desktopHint} absolute inset-x-0 bottom-[3%] px-3 text-center text-[clamp(8px,1.3cqw,12px)] font-medium text-slate-600`}>
      {run.inputActive ? "← → 이동 · ↑ ↓ 한 단 변경 · SPACE 점프 · 패드 지원" : "자동 전진 중 · 화면 클릭 또는 Tab으로 조작 시작"}
    </div>}
  </div>;
}
