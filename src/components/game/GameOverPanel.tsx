"use client";

import { useState, useSyncExternalStore } from "react";
import { createGameRecord, ManualRecordSave } from "@/game/systems/ManualRecordSave";
import type { GameSnapshot } from "@/game/types/game.types";
import type { LocalPlayer } from "@/game/types/local-player.types";
import { formatDistance } from "@/game/utils/formatDistance";
import { SCORE_CONFIG } from "@/game/config/constants";
import styles from "./GameOverPanel.module.css";

export function GameOverPanel({ run, player, onRestart, onMenu, onRanking }: {
  run: GameSnapshot; player: LocalPlayer; onRestart: () => void; onMenu: () => void; onRanking?: () => void;
}) {
  const [record] = useState(() => createGameRecord(run, player));
  const [save] = useState(() => new ManualRecordSave(record));
  const state = useSyncExternalStore(save.subscribe, save.getSnapshot, save.getSnapshot);
  return <div className={styles.overlay}>
    <section className={styles.panel} aria-label="탐험 결과">
      <div className={styles.summary}>
        <p className={styles.eyebrow}>{run.newRecord ? "NEW DISTANCE RECORD" : "EXPEDITION RESULT"}</p>
        <h2 className={styles.title}>GAME OVER</h2>
        <p className={styles.nickname}>{record.nickname}의 탐험</p>
        <dl className={styles.stats}>
          <div><dt>SCORE</dt><dd>{run.score.toLocaleString()}</dd></div>
          <div><dt>STAGE</dt><dd>{run.stage}</dd></div>
          <div><dt>DISTANCE</dt><dd>{formatDistance(run.distance)}</dd></div>
        </dl>
        <p className={styles.average}>평균 <strong>{run.averageSpeed.toFixed(1)} m/s</strong>로 <strong>{formatDistance(run.distance)}</strong> 전진</p>
        <p className={styles.note}>점수 = 거리(m) × 평균 속도 ÷ {SCORE_CONFIG.referenceSpeed} · 반올림</p>
        <p className={styles.best}>이 브라우저 최장 거리 {formatDistance(run.bestDistance)}<br />
          당시 평균 {run.bestAverageSpeed === null ? "미측정" : `${run.bestAverageSpeed.toFixed(1)} m/s`}</p>
      </div>
      <div className={styles.actions}>
        <p className={styles.saveHint}>온라인 기록은 직접 저장한 판만 등록됩니다.</p>
        <button type="button" className={styles.primary} disabled={state.status === "saving" || state.status === "saved"}
          onClick={() => { void save.save(); }}>
          {state.status === "saving" ? "기록 저장 중…" : state.status === "saved" ? "✓ 저장 완료" : state.status === "error" ? "기록 저장 다시 시도" : "내 기록 저장하기"}
        </button>
        <p className={styles.saveStatus} role="status" data-error={state.status === "error"}>{state.message ?? (state.status === "saving" ? "기록을 등록하고 있습니다." : "저장하지 않은 기록은 랭킹에 반영되지 않습니다.")}</p>
        <div className={styles.secondaryActions}>
          <button type="button" className={styles.secondary} onClick={onRestart}>다시 도전</button>
          <button type="button" className={styles.secondary} disabled={!onRanking || state.status === "saving"} onClick={onRanking}>랭킹 보기</button>
        </div>
        <button type="button" className={styles.menu} onClick={onMenu}>메인 메뉴</button>
      </div>
    </section>
  </div>;
}
