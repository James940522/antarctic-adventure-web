import { DEVELOPER, type GameMode, type MenuModal } from "./menu-state";
import { GameDialog } from "./GameDialog";
import styles from "./Menu.module.css";
import type { LocalPlayer } from "@/game/types/local-player.types";

export function MainMenu({ modal, onSelect, onDeveloper, onClose, muted, onMute, player, onNickname, onRanking }: {
  modal: MenuModal; onSelect: (mode: GameMode) => void; onDeveloper: () => void; onClose: () => void; muted: boolean; onMute: () => void;
  player: LocalPlayer | null; onNickname: () => void; onRanking: () => void;
}) {
  return <section className={styles.menu} aria-label="메인 메뉴">
    <div className={styles.menuContent}>
      <p className={styles.eyebrow}>작은 펭귄의 끝없는 모험</p>
      <h1 className={styles.title}>WHITE HORIZON<span>ANTARCTIC RUN</span></h1>
      <p className={styles.intro}>하얀 대륙 위에, 나만의 기록을 남기세요.</p>
      <div className={styles.menuActions}>
        <button type="button" disabled={!player} className={styles.primary} onClick={() => onSelect("classic")}><strong>클래식 버전</strong><small>CLASSIC MODE <span aria-hidden="true">→</span></small></button>
        <button type="button" disabled={!player} className={styles.secondary} onClick={onRanking}>랭킹 보드</button>
        <button type="button" disabled={!player} className={styles.secondary} onClick={() => onSelect("gaze")}><strong>시선추적 버전</strong><small>개발중 · COMING SOON</small></button>
      </div>
      <p className={styles.help}>← → 이동 · ↑ ↓ 속도 · SPACE 점프<br />ESC / 패드 Menu 일시정지 · 모바일 터치 지원</p>
      <div className={styles.menuFooter}>
        <button type="button" className={styles.developerButton} onClick={onNickname} aria-label="닉네임 변경">닉네임 변경 <span>{player?.nickname ?? "탐험가"}</span></button>
        <button type="button" className={styles.developerButton} onClick={onDeveloper}>DEVELOPER <span>James</span></button>
      </div>
    </div>
    <button type="button" className={styles.soundButton} aria-label={muted ? "BGM 소리 켜기" : "BGM 소리 끄기"} aria-pressed={!muted} onClick={onMute}>♪ {muted ? "OFF" : "ON"}</button>
    {modal === "development" && <GameDialog title="시선추적 버전" onClose={onClose}>
      <p className={styles.dialogText}>시선추적 버전은 현재 개발중입니다.<br />곧 새로운 방식으로 남극을 탐험해 보세요.</p>
      <button type="button" className={styles.primary} onClick={onClose}>확인</button>
    </GameDialog>}
    {modal === "developer" && <GameDialog title="Developer" onClose={onClose}>
      <p className={styles.developerName}>{DEVELOPER.name}</p>
      <div className={styles.socialLinks}>
        <a href={DEVELOPER.mailto} aria-label="James에게 이메일 보내기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></svg><span>Email</span></a>
        <a href={DEVELOPER.github} target="_blank" rel="noopener noreferrer" aria-label="James GitHub 열기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 19c-4 1-4-2-6-2m12 5v-4c0-1 .3-1.6.8-2.1 2.8-.3 5.7-1.3 5.7-6A4.7 4.7 0 0 0 20 6.6c.2-1 .2-2-.2-3-1.3 0-2.8.8-3.7 1.5a13 13 0 0 0-6.2 0C9 4.4 7.5 3.6 6.2 3.6c-.4 1-.4 2-.2 3a4.7 4.7 0 0 0-1.5 3.3c0 4.7 2.9 5.7 5.7 6-.5.5-.8 1.2-.8 2.1v4" /></svg><span>GitHub</span></a>
        <a href={DEVELOPER.linkedin} target="_blank" rel="noopener noreferrer" aria-label="James LinkedIn 열기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 10v7M11 17v-7m0 3a3 3 0 0 1 6 0v4" /><circle cx="7" cy="7" r=".5" /></svg><span>LinkedIn</span></a>
        <a href={DEVELOPER.instagram} target="_blank" rel="noopener noreferrer" aria-label="James Instagram 열기"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".5" /></svg><span>Instagram</span></a>
      </div>
      <p className={styles.email}>{DEVELOPER.email}</p>
      <button type="button" className={styles.secondary} onClick={onClose}>닫기</button>
    </GameDialog>}
  </section>;
}
