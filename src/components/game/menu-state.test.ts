import assert from "node:assert/strict";
import test from "node:test";
import { appReducer, DEVELOPER, INITIAL_APP_STATE } from "./menu-state.ts";

test("only classic mounts a game and returning to the menu clears mode and modal", () => {
  let state = INITIAL_APP_STATE;
  for (let cycle = 0; cycle < 3; cycle++) {
    assert.deepEqual(state, { screen: "menu", mode: null, modal: null });
    state = appReducer(state, { type: "select-mode", mode: "classic" });
    assert.deepEqual(state, { screen: "game", mode: "classic", modal: null });
    assert.equal(appReducer(state, { type: "developer" }), state);
    state = appReducer(state, { type: "menu" });
  }
});

test("gaze remains on the menu and closing either modal keeps the game unmounted", () => {
  const gaze = appReducer(INITIAL_APP_STATE, { type: "select-mode", mode: "gaze" });
  assert.deepEqual(gaze, { screen: "menu", mode: null, modal: "development" });
  assert.deepEqual(appReducer(gaze, { type: "close-modal" }), INITIAL_APP_STATE);
  const developer = appReducer(INITIAL_APP_STATE, { type: "developer" });
  assert.equal(developer.modal, "developer");
  assert.deepEqual(appReducer(developer, { type: "close-modal" }), INITIAL_APP_STATE);
});

test("developer contact destinations match the supplied links", () => {
  assert.deepEqual(DEVELOPER, {
    name: "James", email: "james940522@gmail.com", mailto: "mailto:james940522@gmail.com",
    github: "https://github.com/James940522", instagram: "https://www.instagram.com/james.7507/",
  });
});
