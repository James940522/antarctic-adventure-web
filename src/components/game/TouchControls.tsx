import styles from "./GameViewport.module.css";

const actionButtons = {
  left: [
    { action: "jump", label: "점프", symbol: "점프" },
    { action: "down", label: "속도 내리기", symbol: "↓" },
  ],
  right: [
    { action: "up", label: "속도 올리기", symbol: "↑" },
    { action: "jump", label: "점프", symbol: "점프" },
  ],
} as const;

export function TouchControls({ disabled }: { disabled: boolean }) {
  return <div className={styles.controls} role="group" aria-label="터치 조작">
    {(["left", "right"] as const).map((direction) => <div key={direction} data-hand={direction} className={styles.handControls} role="group" aria-label={direction === "left" ? "왼손 조작" : "오른손 조작"}>
      {actionButtons[direction].map(({ action, label, symbol }) => <button key={action} type="button" className={`${styles.control} ${action === "jump" ? styles.jump : styles.speed}`} data-game-action={action} aria-label={label} disabled={disabled}>
        <span aria-hidden="true">{symbol}{action !== "jump" && <small>속도</small>}</span>
      </button>)}
      <button type="button" className={`${styles.control} ${styles.direction}`} data-game-action={direction} aria-label={direction === "left" ? "왼쪽으로 이동" : "오른쪽으로 이동"} disabled={disabled}><span aria-hidden="true">{direction === "left" ? "←" : "→"}</span></button>
    </div>)}
  </div>;
}
