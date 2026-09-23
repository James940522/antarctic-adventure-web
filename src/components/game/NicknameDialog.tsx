"use client";

import { useId, useState } from "react";
import { nicknameError, normalizeNickname } from "@/game/systems/LocalPlayerStore";
import { GameDialog } from "./GameDialog";
import styles from "./Menu.module.css";

export function NicknameDialog({ nickname, onSave, onClose }: {
  nickname?: string; onSave: (nickname: string) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const initial = nickname === undefined;
  return <GameDialog title={initial ? "탐험가의 이름" : "닉네임 변경"} onClose={onClose} dismissible={!initial}>
    <p className={styles.dialogText}>{initial ? "하얀 대륙에 남길 이름을 정해주세요." : "새 이름으로 다음 기록을 남겨보세요."}</p>
    <form onSubmit={event => {
      event.preventDefault();
      const invalid = nicknameError(value);
      if (invalid) { setError(invalid); return; }
      try { onSave(normalizeNickname(value)); }
      catch { setError("이름을 설정하지 못했습니다. 다시 시도해주세요."); }
    }}>
      <label className={styles.nicknameLabel} htmlFor={fieldId}>닉네임</label>
      <input id={fieldId} className={styles.nicknameInput} value={value} autoComplete="nickname" spellCheck={false}
        aria-invalid={Boolean(error)} aria-describedby={`${fieldId}-hint ${fieldId}-error`}
        onChange={event => { setValue(event.target.value); setError(null); }} />
      <p id={`${fieldId}-hint`} className={styles.nicknameHint}>2~12자 · 이 브라우저에 저장됩니다.</p>
      <p id={`${fieldId}-error`} className={styles.formError} role="alert">{error}</p>
      <div className={initial ? undefined : styles.dialogActions}>
        {!initial && <button type="button" className={styles.secondary} onClick={onClose}>취소</button>}
        <button type="submit" className={styles.primary}>{initial ? "탐험 시작" : "이름 저장"}</button>
      </div>
    </form>
  </GameDialog>;
}
