"use client";

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { BackgroundMusic } from "@/game/systems/BackgroundMusic";
import { AudioPreferences } from "@/game/systems/AudioPreferences";
import { GameCanvas } from "./GameCanvas";
import { GameDialog } from "./GameDialog";
import { MainMenu } from "./MainMenu";
import { appReducer, INITIAL_APP_STATE } from "./menu-state";
import styles from "./Menu.module.css";

const audioPreferences = new AudioPreferences();
const getServerMuted = () => undefined;

export function GameShell() {
  const [app, dispatch] = useReducer(appReducer, INITIAL_APP_STATE);
  const soundPreference = useSyncExternalStore<boolean | null | undefined>(audioPreferences.subscribe, audioPreferences.getSnapshot, getServerMuted);
  const muted = soundPreference !== false;
  const [gameAudible, setGameAudible] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const music = useRef<BackgroundMusic | null>(null);
  const onPlaybackChange = useCallback((playing: boolean) => setGameAudible(playing), []);
  const onRestarted = useCallback(() => music.current?.restartGame(), []);
  const onMenu = useCallback(() => { setGameAudible(false); dispatch({ type: "menu" }); }, []);
  const onMute = () => audioPreferences.setMuted(!audioPreferences.getSnapshot());

  useEffect(() => {
    if (!audio.current) return;
    const controller = new BackgroundMusic(audio.current);
    music.current = controller;
    const syncMuted = () => controller.setMuted(audioPreferences.getSnapshot() !== false);
    // Restore before any gesture can unlock playback, including hydration.
    syncMuted();
    const unsubscribeMuted = audioPreferences.subscribe(syncMuted);
    const unlock = () => controller.unlock();
    const visibility = () => controller.setActive(document.visibilityState !== "hidden" && document.hasFocus());
    const blur = () => controller.setActive(false);
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", blur);
    visibility();
    return () => {
      unsubscribeMuted();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", blur);
      controller.destroy();
      music.current = null;
    };
  }, []);

  useEffect(() => { music.current?.setScreen(app.screen, app.screen === "game" && !gameAudible); }, [app.screen, gameAudible]);

  return <>
    <audio ref={audio} preload="metadata" hidden aria-hidden="true" />
    {app.screen === "menu" ? <MainMenu modal={app.modal} muted={muted} onMute={onMute}
      onSelect={mode => { setGameAudible(false); dispatch({ type: "select-mode", mode }); }}
      onDeveloper={() => dispatch({ type: "developer" })} onClose={() => dispatch({ type: "close-modal" })} />
      : <GameCanvas onMenu={onMenu} onPlaybackChange={onPlaybackChange} onRestarted={onRestarted} muted={muted} onMute={onMute} />}
    {soundPreference === null && <GameDialog title="배경음악 선택" onClose={() => audioPreferences.setMuted(true)}>
      <p className={styles.dialogText}>음악과 함께 플레이할까요?<br />선택은 저장되며, 언제든 메뉴에서 바꿀 수 있어요.</p>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.primary} onClick={() => audioPreferences.setMuted(false)}>BGM 켜고 시작</button>
        <button type="button" className={styles.secondary} onClick={() => audioPreferences.setMuted(true)}>소리 없이 시작</button>
      </div>
    </GameDialog>}
  </>;
}
