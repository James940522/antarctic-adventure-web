"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LocalPlayer } from "@/game/types/local-player.types";
import type { RankingEntry } from "@/game/types/ranking.types";
import { RankingStore } from "@/game/systems/RankingStore";
import { formatKilometers } from "@/game/utils/formatDistance";
import styles from "./RankingBoard.module.css";

function Crown({ rank }: { rank: number }) {
  return <svg className={styles.crown} data-rank={rank} viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 5 5 4-8 4 8 5-5-2 12H5Z" /><path d="M5 22h14" /></svg>;
}
function RankingRow({ row, playerId }: { row: RankingEntry; playerId: string }) {
  const own = row.playerId === playerId;
  return <tr className={own ? styles.own : undefined} aria-label={own ? `내 순위 ${row.rank}위` : undefined}>
    <td className={styles.rank}><span className={styles.srOnly}>{row.rank <= 3 ? `${row.rank}위` : ""}</span>{row.rank <= 3 ? <Crown rank={row.rank} /> : row.rank}</td>
    <td className={styles.name}>{own && <span className={styles.you}>YOU</span>}<span>{row.nickname}</span><small className={styles.mobileDetails}>STAGE {row.stage} · {formatKilometers(row.distance)}</small></td>
    <td className={styles.score}>{row.score.toLocaleString()}</td>
    <td className={styles.detail}>{row.stage}</td><td className={styles.detail}>{formatKilometers(row.distance)}</td>
  </tr>;
}

export function RankingBoard({ player, onClose, onMenu, onRetry, onNickname }: {
  player: LocalPlayer; onClose: () => void; onMenu: () => void; onRetry: () => void; onNickname: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [store] = useState(() => new RankingStore(player.id));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal(); title.current?.focus(); void store.load();
    return () => { store.dispose(); element?.close(); };
  }, [store]);
  const data = state.data;
  const mine = data?.myRanking;
  const outside = mine && !data.rankings.some(row => row.playerId === player.id);
  return <dialog ref={dialog} className={styles.screen} aria-labelledby="ranking-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      buttons[(index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }}>
    <div className={styles.layout}>
      <header className={styles.brand}><strong>WHITE HORIZON</strong><span>ANTARCTIC RUN</span><p>하얀 대륙 위에, 나만의 기록을 남기세요.</p></header>
      <main className={styles.board}>
        <div className={styles.heading}><h2 ref={title} tabIndex={-1} id="ranking-title">RANKING BOARD</h2><p>최고 SCORE 기준 · 직접 저장한 기록 · TOP 100</p></div>
        {state.status === "loading" && <p className={styles.feedback} role="status">기록을 불러오는 중…</p>}
        {state.status === "error" && <div className={styles.feedback} role="alert"><p>랭킹을 불러오지 못했습니다.</p><button type="button" className={styles.secondary} onClick={() => { void store.load(); }}>다시 시도</button></div>}
        {state.status === "ready" && data?.rankings.length === 0 && <div className={styles.feedback}><p>아직 등록된 탐험 기록이 없습니다.</p><small>첫 기록의 주인공이 되어보세요.</small></div>}
        {state.status === "ready" && Boolean(data?.rankings.length) && <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="상위 100명 랭킹 목록">
          <table className={styles.table}><caption className={styles.srOnly}>플레이어별 최고 기록 순위</caption>
            <thead><tr><th scope="col">#</th><th scope="col">닉네임</th><th scope="col">SCORE</th><th scope="col" className={styles.detail}>STAGE</th><th scope="col" className={styles.detail}>DISTANCE</th></tr></thead>
            <tbody>{data!.rankings.map(row => <RankingRow key={row.playerId} row={row} playerId={player.id} />)}</tbody>
          </table>
          {outside && <><p className={styles.outsideLabel}>TOP 100 밖의 내 순위</p><table className={styles.table}><tbody><RankingRow row={mine} playerId={player.id} /></tbody></table></>}
        </div>}
      </main>
      <aside className={styles.personal} aria-label="내 온라인 기록">
        <div><span>내 최고 SCORE</span><strong>{state.status === "ready" && mine ? mine.score.toLocaleString() : state.status === "loading" ? "…" : "—"}</strong>{mine && <small>{formatKilometers(mine.distance)} · STAGE {mine.stage}</small>}</div>
        <div><span>현재 순위</span><strong>{state.status === "ready" ? mine ? `${mine.rank.toLocaleString()} / ${data!.totalPlayers.toLocaleString()}` : "미등록" : state.status === "loading" ? "…" : "—"}</strong><small>{mine ? `최고 기록 이름: ${mine.nickname}` : "직접 저장한 기록만 반영됩니다."}</small></div>
      </aside>
      <footer className={styles.footer}>
        <nav className={styles.actions} aria-label="랭킹 메뉴">
          <button type="button" className={styles.secondary} onClick={onMenu}>메인 메뉴</button>
          <button type="button" className={styles.primary} onClick={onRetry}>다시 도전<small>더 멀리, 더 빠르게</small></button>
          <button type="button" className={styles.secondary} onClick={onNickname}>닉네임 변경<small>{player.nickname}</small></button>
        </nav><p>← → 버튼 이동 · ENTER 선택 · ESC 이전 화면</p>
      </footer>
    </div>
  </dialog>;
}
