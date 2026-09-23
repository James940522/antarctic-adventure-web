"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { BackgroundMusic } from "@/game/systems/BackgroundMusic";
import { GameCanvas } from "./GameCanvas";
import { MainMenu } from "./MainMenu";
import { appReducer, INITIAL_APP_STATE } from "./menu-state";

export function GameShell() {
  const [app, dispatch] = useReducer(appReducer, INITIAL_APP_STATE);
  const [muted, setMuted] = useState(false);
  const [gameAudible, setGameAudible] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const music = useRef<BackgroundMusic | null>(null);
  const onPlaybackChange = useCallback((playing: boolean) => setGameAudible(playing), []);
  const onMenu = useCallback(() => { setGameAudible(false); dispatch({ type: "menu" }); }, []);
  const onMute = () => setMuted(value => !value);

  useEffect(() => {
    if (!audio.current) return;
    const controller = new BackgroundMusic(audio.current);
    music.current = controller;
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
  useEffect(() => { music.current?.setMuted(muted); }, [muted]);

  return <>
    <audio ref={audio} preload="metadata" hidden aria-hidden="true" />
    {app.screen === "menu" ? <MainMenu modal={app.modal} muted={muted} onMute={onMute}
      onSelect={mode => { setGameAudible(false); dispatch({ type: "select-mode", mode }); }}
      onDeveloper={() => dispatch({ type: "developer" })} onClose={() => dispatch({ type: "close-modal" })} />
      : <GameCanvas onMenu={onMenu} onPlaybackChange={onPlaybackChange} muted={muted} onMute={onMute} />}
  </>;
}
