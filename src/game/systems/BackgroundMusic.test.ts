import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { AUDIO_TRACKS } from "../config/audio.ts";
import { BackgroundMusic, type AudioPort } from "./BackgroundMusic.ts";

function fixture() {
  const state = { playing: false, fail: false, calls: 0 };
  const audio: AudioPort = {
    src: "", currentTime: 0, loop: false, volume: 1, muted: false,
    play() { state.calls++; if (state.fail) return Promise.reject(new Error("NotAllowedError")); state.playing = true; return Promise.resolve(); },
    pause() { state.playing = false; }, load() {}, removeAttribute() { audio.src = ""; },
  };
  return { state, audio, music: new BackgroundMusic(audio) };
}

test("BGM uses existing assets and switches a single element while pause preserves position", () => {
  for (const path of Object.values(AUDIO_TRACKS)) assert.equal(existsSync(new URL(`../../../public${path}`, import.meta.url)), true);
  const { music, audio, state } = fixture();
  assert.equal(state.calls, 0);
  music.unlock();
  assert.equal(state.playing, true);
  assert.equal(audio.src, AUDIO_TRACKS.menu);
  audio.currentTime = 12;
  music.setScreen("game", true);
  assert.equal(state.playing, false);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.src, AUDIO_TRACKS.game);
  music.setScreen("game");
  audio.currentTime = 7;
  music.setScreen("game", true);
  assert.equal(state.playing, false);
  assert.equal(audio.currentTime, 7);
  music.setScreen("game");
  assert.equal(state.playing, true);
  assert.equal(audio.currentTime, 7);
  assert.equal(audio.loop, true);
  music.setScreen("menu");
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.src, AUDIO_TRACKS.menu);
  music.destroy();
  assert.equal(state.playing, false);
  assert.equal(audio.src, "");
  music.unlock();
  assert.equal(state.playing, false);
});

test("audio rejection is non-fatal and mute, visibility and manual pause all prevent playback", async () => {
  const { music, audio, state } = fixture();
  state.fail = true;
  music.unlock();
  await Promise.resolve();
  assert.equal(state.playing, false);
  state.fail = false;
  music.unlock();
  assert.equal(state.playing, true);
  music.setActive(false);
  music.unlock();
  assert.equal(state.playing, false);
  music.setActive(true);
  assert.equal(state.playing, true);
  music.setMuted(true);
  music.unlock();
  assert.equal(audio.muted, true);
  assert.equal(state.playing, false);
  music.setScreen("game", true);
  music.setMuted(false);
  assert.equal(state.playing, false);
  music.setScreen("game");
  assert.equal(state.playing, true);
  music.destroy();
});

test("retry rewinds game BGM without overriding pause or mute, while resume keeps its position", () => {
  const { music, audio, state } = fixture();
  music.unlock();
  audio.currentTime = 5;
  music.restartGame();
  assert.equal(audio.currentTime, 5); // A stale game event must not rewind the menu.
  music.setScreen("game");
  for (let retry = 0; retry < 3; retry++) {
    audio.currentTime = 12;
    music.setScreen("game", true); // Game over stops playback.
    music.restartGame();
    assert.equal(audio.currentTime, 0);
    assert.equal(state.playing, false);
    assert.equal(audio.src, AUDIO_TRACKS.game);
    music.setScreen("game");
    assert.equal(state.playing, true);
    audio.currentTime = 4;
    music.setScreen("game", true);
    music.setScreen("game");
    assert.equal(audio.currentTime, 4); // Ordinary pause/resume must not rewind.
  }
  music.setMuted(true);
  music.restartGame();
  assert.equal(audio.currentTime, 0);
  assert.equal(state.playing, false);
  music.setMuted(false);
  assert.equal(state.playing, true);
  music.destroy();
  audio.currentTime = 7;
  music.restartGame();
  assert.equal(audio.currentTime, 7);
});
