import styles from "./GameViewport.module.css";

export function TouchControls({ disabled }: { disabled: boolean }) {
  return <div className={styles.controls} role="group" aria-label="터치 조작">
    {(["left", "right"] as const).map((direction) => <div key={direction} className={styles.handControls} role="group" aria-label={direction === "left" ? "왼손 조작" : "오른손 조작"}>
      <button type="button" className={`${styles.control} ${styles.jump}`} data-game-action="jump" aria-label="점프" disabled={disabled}>점프</button>
      <button type="button" className={`${styles.control} ${styles.speed}`} data-game-action="up" aria-label="속도 올리기" disabled={disabled}><span aria-hidden="true">↑<small>속도</small></span></button>
      <button type="button" className={`${styles.control} ${styles.speed}`} data-game-action="down" aria-label="속도 내리기" disabled={disabled}><span aria-hidden="true">↓<small>속도</small></span></button>
      <button type="button" className={`${styles.control} ${styles.direction}`} data-game-action={direction} aria-label={direction === "left" ? "왼쪽으로 이동" : "오른쪽으로 이동"} disabled={disabled}>{direction === "left" ? "←" : "→"}</button>
    </div>)}
  </div>;
}
