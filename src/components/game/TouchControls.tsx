import styles from "./GameViewport.module.css";

export function TouchControls({ disabled }: { disabled: boolean }) {
  return <div className={styles.controls} role="group" aria-label="터치 조작">
    <button type="button" className={`${styles.control} ${styles.left}`} data-game-action="left" aria-label="왼쪽으로 이동" disabled={disabled}>←</button>
    <button type="button" className={`${styles.control} ${styles.speed}`} data-game-action="down" aria-label="한 단 감속" disabled={disabled}>−</button>
    <button type="button" className={`${styles.control} ${styles.jump}`} data-game-action="jump" aria-label="점프" disabled={disabled}>점프 ↑</button>
    <button type="button" className={`${styles.control} ${styles.speed}`} data-game-action="up" aria-label="한 단 가속" disabled={disabled}>＋</button>
    <button type="button" className={`${styles.control} ${styles.right}`} data-game-action="right" aria-label="오른쪽으로 이동" disabled={disabled}>→</button>
  </div>;
}
