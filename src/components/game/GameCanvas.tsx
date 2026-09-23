"use client";

import type { Game } from "phaser";
import { useEffect, useRef, useState } from "react";

import { GAME_EVENTS } from "@/game/config/constants";
import { GameHud } from "@/components/game/GameHud";
import { TouchControls } from "@/components/game/TouchControls";
import styles from "./GameViewport.module.css";
import type { GameSnapshot } from "@/game/types/game.types";

type LoadStatus = "loading" | "ready" | "error";

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputTargetRef = useRef<HTMLElement>(null);
  const teardownRef = useRef<Promise<void>>(Promise.resolve());
  const gameRef = useRef<Game | undefined>(undefined);
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

    let cancelled = false;
    let failed = false;
    let game: Game | undefined;
    let bootTimeout: ReturnType<typeof setTimeout> | undefined;

    const destroyGame = () => {
      if (!game) return;
      const retiringGame = game;
      game = undefined;
      if (gameRef.current === retiringGame) gameRef.current = undefined;

      // Phaser destroys on its next frame. Wait before creating a replacement.
      teardownRef.current = new Promise<void>((resolve) => {
        retiringGame.events.once("destroy", () => resolve());
        retiringGame.destroy(true, false);
      });
      retiringGame.canvas?.remove();
    };

    const onError = (error: unknown) => {
      clearTimeout(bootTimeout);
      if (cancelled || failed) return;
      failed = true;
      console.error("Failed to initialize Antarctic Adventure:", error);
      setStatus("error");
      destroyGame();
    };

    const initialize = async () => {
      try {
        const { createGame } = await import("@/game/create-game");
        await teardownRef.current;
        if (cancelled) return;

        setStatus("loading");
        bootTimeout = setTimeout(
          () => onError(new Error("Game scene initialization timed out.")),
          15_000,
        );
        game = createGame(mount, {
          onReady: () => {
            clearTimeout(bootTimeout);
            if (!cancelled && !failed) setStatus("ready");
          },
          onError,
          onSnapshot: (snapshot) => { if (!cancelled && !failed && snapshot) setRun(snapshot); },
        }, inputTarget);
        gameRef.current = game;
      } catch (error) {
        onError(error);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      clearTimeout(bootTimeout);
      destroyGame();
      mount.remove();
    };
  }, [attempt]);

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
        위아래 방향키 또는 W S를 한 번씩 눌러 1~3단 속도를 바꿉니다. Space로 점프합니다.
        박스에 닿으면 게임오버이며 이동 거리로 기록을 겨룹니다. 게임패드도 같은 조작을 지원합니다.
        태블릿 이하에서는 좌우 이동·점프·감속·가속 버튼을 사용할 수 있습니다.
      </p>
      <div className={styles.surface}>
      <div ref={containerRef} className={styles.mount} />

      {status === "ready" && run && <GameHud run={run} onRestart={() => {
        gameRef.current?.events.emit(GAME_EVENTS.restart);
        inputTargetRef.current?.focus({ preventScroll: true });
      }} />}

      {status === "loading" && (
        <p
          role="status"
          className="absolute inset-0 grid place-items-center text-sm text-slate-700"
        >
          남극으로 가는 중…
        </p>
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
              setAttempt((value) => value + 1);
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      <noscript>
        <p className="absolute inset-0 grid place-items-center bg-sky-50 p-4 text-center text-slate-800">
          게임을 실행하려면 JavaScript를 켜 주세요.
        </p>
      </noscript>
      </div>
      <TouchControls disabled={status !== "ready" || run?.status === "gameover"} />
    </section>
    </div>
  );
}
