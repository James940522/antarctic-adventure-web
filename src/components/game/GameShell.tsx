"use client";

import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { BackgroundMusic } from "@/game/systems/BackgroundMusic";
import { AudioPreferences } from "@/game/systems/AudioPreferences";
import { LocalPlayerStore } from "@/game/systems/LocalPlayerStore";
import type { LocalPlayer } from "@/game/types/local-player.types";
import { GameCanvas } from "./GameCanvas";
import { GameDialog } from "./GameDialog";
import { MainMenu } from "./MainMenu";
import { NicknameDialog } from "./NicknameDialog";
import { RankingBoard } from "./RankingBoard";
import { appReducer, INITIAL_APP_STATE } from "./menu-state";
import styles from "./Menu.module.css";

const audioPreferences = new AudioPreferences();
const players = new LocalPlayerStore();
const getServerMuted = () => undefined;

export function GameShell() {
  const [app, dispatch] = useReducer(appReducer, INITIAL_APP_STATE);
  const soundPreference = useSyncExternalStore<boolean | null | undefined>(audioPreferences.subscribe, audioPreferences.getSnapshot, getServerMuted);
  const muted = soundPreference !== false;
  const player = useSyncExternalStore<LocalPlayer | null | undefined>(players.subscribe, players.getSnapshot, getServerMuted);
  const [editingNickname, setEditingNickname] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [gameSession, setGameSession] = useState(0);
  const [gameAudible, setGameAudible] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const music = useRef<BackgroundMusic | null>(null);
  const onPlaybackChange = useCallback((playing: boolean) => setGameAudible(playing), []);
  const onRestarted = useCallback(() => music.current?.restartGame(), []);
  const onMenu = useCallback(() => { setGameAudible(false); dispatch({ type: "menu" }); }, []);
  const onMute = () => audioPreferences.setMuted(!audioPreferences.getSnapshot());
  const openRanking = () => setRankingOpen(true);
  const retryFromRanking = () => {
    setRankingOpen(false); setGameAudible(false); setGameSession(value => value + 1);
    music.current?.restartGame();
    dispatch({ type: "select-mode", mode: "classic" });
  };

  useEffect(() => {
    const preventBrowserSelection = (event: Event) => {
      const target = event.target;
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
      if (element?.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      event.preventDefault();
    };
    document.addEventListener("dblclick", preventBrowserSelection);
    document.addEventListener("contextmenu", preventBrowserSelection);
    document.addEventListener("selectstart", preventBrowserSelection);
    return () => {
      document.removeEventListener("dblclick", preventBrowserSelection);
      document.removeEventListener("contextmenu", preventBrowserSelection);
      document.removeEventListener("selectstart", preventBrowserSelection);
    };
  }, []);

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
    {app.screen === "menu" || !player ? <MainMenu modal={app.modal} muted={muted} onMute={onMute}
      player={player ?? null} onNickname={() => setEditingNickname(true)} onRanking={openRanking}
      onSelect={mode => { if (!player) return; setGameAudible(false); dispatch({ type: "select-mode", mode }); }}
      onDeveloper={() => dispatch({ type: "developer" })} onClose={() => dispatch({ type: "close-modal" })} />
      : <GameCanvas key={gameSession} player={player} onMenu={onMenu} onRanking={openRanking} onPlaybackChange={onPlaybackChange} onRestarted={onRestarted} muted={muted} onMute={onMute} />}
    {rankingOpen && player && <RankingBoard player={player} onClose={() => setRankingOpen(false)}
      onMenu={() => { setRankingOpen(false); onMenu(); }} onRetry={retryFromRanking} onNickname={() => setEditingNickname(true)} />}
    {soundPreference !== undefined && soundPreference !== null && (player === null || editingNickname) &&
      <NicknameDialog nickname={player?.nickname} onClose={() => setEditingNickname(false)}
        onSave={nickname => { players.setNickname(nickname); setEditingNickname(false); }} />}
    {soundPreference === null && <GameDialog title="배경음악 선택" onClose={() => audioPreferences.setMuted(true)}>
      <p className={styles.dialogText}>음악과 함께 플레이할까요?<br />선택은 저장되며, 언제든 메뉴에서 바꿀 수 있어요.</p>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.primary} onClick={() => audioPreferences.setMuted(false)}>BGM 켜고 시작</button>
        <button type="button" className={styles.secondary} onClick={() => audioPreferences.setMuted(true)}>소리 없이 시작</button>
      </div>
    </GameDialog>}
  </>;
}
