"use client";

import { useEffect, useRef, useState } from "react";

import { GameHud } from "@/components/game/GameHud";
import { TouchControls } from "@/components/game/TouchControls";
import { PauseOverlay } from "./PauseOverlay";
import { startGameSession, type GameSession } from "./game-session";
import styles from "./GameViewport.module.css";
import type { GameSnapshot } from "@/game/types/game.types";
import type { LocalPlayer } from "@/game/types/local-player.types";

type LoadStatus = "loading" | "ready" | "error";
type GameCanvasProps = {
  player: LocalPlayer;
  muted: boolean;
  onMenu: () => void;
  onRanking: () => void;
  onPlaybackChange: (playing: boolean) => void;
  onRestarted: () => void;
  onMute: () => void;
};

export function GameCanvas({ onMenu, onRanking, onPlaybackChange, onRestarted, muted, onMute, player }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputTargetRef = useRef<HTMLElement>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const [run, setRun] = useState<GameSnapshot | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const inputTarget = inputTargetRef.current;
    if (!container || !inputTarget) return;

    // Each effect owns its mount, so a retiring game cannot remove a new canvas.
    const mount = document.createElement("div");
    mount.className = "h-full w-full";
    container.append(mount);

    const session = startGameSession(mount, inputTarget, {
      onReady: () => setStatus("ready"),
      onError: error => {
        console.error("Failed to initialize Antarctic Adventure:", error);
        setStatus("error");
        setRun(null);
      },
      onSnapshot: setRun,
      onRestarted,
    });
    sessionRef.current = session;

    return () => {
      session.destroy();
      if (sessionRef.current === session) sessionRef.current = null;
      mount.remove();
    };
  }, [attempt, onRestarted]);

  useEffect(() => {
    if (status === "ready" && !run?.pauseMenuOpen) inputTargetRef.current?.focus({ preventScroll: true });
  }, [status, run?.pauseMenuOpen]);

  const playing = status === "ready" && Boolean(run) && !run?.paused && run?.status !== "gameover";
  useEffect(() => { onPlaybackChange(playing); }, [playing, onPlaybackChange]);

  const resume = () => sessionRef.current?.pause(false);

  return (
    <div className={styles.stage}>
    <section
      ref={inputTargetRef}
      aria-label="남극 모험 게임 화면"
      aria-busy={status === "loading"}
      data-state={status}
      className={styles.console}
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget || event.target instanceof HTMLCanvasElement) {
          event.currentTarget.focus({ preventScroll: true });
        }
      }}
    >
      <p className="sr-only">
        자동으로 전진합니다. 게임 화면을 클릭하거나 Tab으로 선택한 뒤 좌우 방향키 또는 A D로 이동하고,
        위아래 방향키 또는 W S를 한 번씩 눌러 속도를 초당 8미터씩 조절합니다.
        기본 속도는 초당 14미터에서 시작해 실제 주행 1분마다 초당 0.6미터씩 서서히 증가하며 상한은 없습니다. Space로 점프합니다.
        장애물에 닿으면 게임오버이며 13종 모두 점프로 피할 수 있습니다. 전체 폭 바리케이드는 점프로만 넘을 수 있습니다.
        이동 거리로 기록을 겨루고 게임패드도 같은 조작을 지원합니다.
        랜드마크에 도착하면 2.5초 동안 멈춰 기뻐한 뒤 자동으로 다시 출발합니다.
        태블릿 이하에서는 좌우 이동·점프·감속·가속 버튼을 사용할 수 있습니다.
      </p>
      <div className={styles.surface}>
      <div ref={containerRef} className={styles.mount} />

      {status === "ready" && run && <GameHud run={run} player={player} onRanking={onRanking} onPause={() => sessionRef.current?.pause(true)} onMenu={onMenu} onRestart={() => {
        sessionRef.current?.restart();
        inputTargetRef.current?.focus({ preventScroll: true });
      }} />}

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-sm text-slate-700">
          <p role="status">남극으로 가는 중…</p>
          <button type="button" onClick={onMenu} className="rounded px-4 py-2 underline">메인 메뉴</button>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-sky-50 p-4 text-center text-slate-800"
        >
          <p>게임 화면을 불러오지 못했습니다.</p>
          <button
            type="button"
            className="rounded bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-800"
            onClick={() => {
              setStatus("loading");
              setRun(null);
              setAttempt((value) => value + 1);
            }}
          >
            다시 시도
          </button>
          <button type="button" onClick={onMenu} className="rounded px-4 py-2 underline">메인 메뉴</button>
        </div>
      )}

      <noscript>
        <p className="absolute inset-0 grid place-items-center bg-sky-50 p-4 text-center text-slate-800">
          게임을 실행하려면 JavaScript를 켜 주세요.
        </p>
      </noscript>
      </div>
      {run?.status !== "gameover" && <TouchControls disabled={status !== "ready" || run?.status !== "running" || run.paused} />}
      {run?.pauseMenuOpen && <PauseOverlay onResume={resume} onMenu={onMenu} muted={muted} onMute={onMute} />}
    </section>
    </div>
  );
}
