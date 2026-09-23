import assert from "node:assert/strict";
import test from "node:test";
import { AUDIO_MUTED_KEY } from "../config/audio.ts";
import { AudioPreferences } from "./AudioPreferences.ts";
import { BackgroundMusic, type AudioPort } from "./BackgroundMusic.ts";

test("mute and unmute survive a fresh session without writing the default over a saved preference", () => {
  const data = new Map([[AUDIO_MUTED_KEY, "true"]]);
  let reads = 0;
  const storage = () => ({
    getItem: (key: string) => { reads++; return data.get(key) ?? null; },
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  const preferences = new AudioPreferences(storage);
  assert.equal(reads, 0, "module/SSR construction must not read browser storage");
  assert.equal(preferences.getSnapshot(), true);
  assert.equal(data.get(AUDIO_MUTED_KEY), "true");
  preferences.setMuted(false);
  assert.equal(new AudioPreferences(storage).getSnapshot(), false);
  preferences.setMuted(true);
  assert.equal(new AudioPreferences(storage).getSnapshot(), true);
});

test("missing, malformed, denied and quota-full storage never break the in-session choice", () => {
  for (const raw of [null, "", "garbage", "{}", "1"]) {
    const preferences = new AudioPreferences(() => ({ getItem: () => raw, setItem: () => {} }));
    assert.equal(preferences.getSnapshot(), null, "an absent or invalid choice asks before playing");
  }
  for (const storage of [
    () => null,
    () => { throw new Error("Denied"); },
    () => ({ getItem: () => "false", setItem: () => { throw new Error("Quota"); } }),
  ]) {
    const preferences = new AudioPreferences(storage);
    assert.ok(preferences.getSnapshot() === null || preferences.getSnapshot() === false);
    preferences.setMuted(true);
    assert.equal(preferences.getSnapshot(), true);
    preferences.setMuted(false);
    assert.equal(preferences.getSnapshot(), false);
  }
});

test("restored mute blocks the first gesture and subsequent music transitions until explicitly unmuted", () => {
  const preferences = new AudioPreferences(() => ({ getItem: () => "true", setItem: () => {} }));
  let plays = 0;
  const audio: AudioPort = {
    src: "", currentTime: 0, loop: false, volume: 1, muted: false,
    play: () => { plays++; return Promise.resolve(); },
    pause() {}, load() {}, removeAttribute() {},
  };
  const music = new BackgroundMusic(audio);
  const sync = () => music.setMuted(preferences.getSnapshot() !== false);
  sync();
  const unsubscribe = preferences.subscribe(sync);
  music.unlock();
  music.setScreen("game");
  music.restartGame();
  music.setScreen("menu");
  assert.equal(audio.muted, true);
  assert.equal(plays, 0);
  preferences.setMuted(false);
  assert.equal(audio.muted, false);
  assert.equal(plays, 1);
  unsubscribe();
  preferences.setMuted(true);
  assert.equal(audio.muted, false, "unmounted subscribers are removed");
  music.destroy();
});

test("a first visit stays silent through gestures until the player chooses to enable music", () => {
  const preferences = new AudioPreferences(() => null);
  let plays = 0;
  const audio: AudioPort = {
    src: "", currentTime: 0, loop: false, volume: 1, muted: false,
    play: () => { plays++; return Promise.resolve(); },
    pause() {}, load() {}, removeAttribute() {},
  };
  const music = new BackgroundMusic(audio);
  const sync = () => music.setMuted(preferences.getSnapshot() !== false);
  sync();
  const unsubscribe = preferences.subscribe(sync);
  music.unlock();
  assert.equal(preferences.getSnapshot(), null);
  assert.equal(audio.muted, true);
  assert.equal(plays, 0);
  preferences.setMuted(true);
  music.unlock();
  assert.equal(plays, 0);
  preferences.setMuted(false);
  assert.equal(plays, 1);
  unsubscribe();
  music.destroy();
});
