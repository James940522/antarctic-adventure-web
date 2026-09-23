import { GameDialog } from "./GameDialog";
import styles from "./Menu.module.css";

export function PauseOverlay({ onResume, onMenu, muted, onMute }: { onResume: () => void; onMenu: () => void; muted: boolean; onMute: () => void }) {
  return <GameDialog title="일시정지" onClose={onResume} pause>
    <p className={styles.dialogText}>잠깐 쉬어가도 괜찮아요.<br />이 자리에서 계속 달릴 수 있어요.</p>
    <div className={styles.dialogActions}>
      <button type="button" className={styles.primary} onClick={onResume}>계속하기</button>
      <button type="button" className={styles.secondary} onClick={onMenu}>메인 메뉴</button>
    </div>
    <button type="button" className={styles.soundToggle} aria-label={muted ? "BGM 소리 켜기" : "BGM 소리 끄기"} aria-pressed={!muted} onClick={onMute}>♪ BGM {muted ? "OFF" : "ON"}</button>
    <p className={styles.dialogHint}>ESC / 패드 Menu로 계속하기</p>
  </GameDialog>;
}
