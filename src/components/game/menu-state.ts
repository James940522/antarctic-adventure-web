export type GameMode = "classic" | "gaze";
export type MenuModal = "development" | "developer" | null;
export type AppState = {
  screen: "menu" | "game";
  mode: GameMode | null;
  modal: MenuModal;
};
export type AppAction =
  | { type: "select-mode"; mode: GameMode }
  | { type: "developer" }
  | { type: "close-modal" }
  | { type: "menu" };

export const INITIAL_APP_STATE: AppState = { screen: "menu", mode: null, modal: null };
export const DEVELOPER = {
  name: "James",
  email: "james940522@gmail.com",
  mailto: "mailto:james940522@gmail.com",
  github: "https://github.com/James940522",
  instagram: "https://www.instagram.com/james.7507/",
} as const;

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "select-mode":
      if (state.screen !== "menu") return state;
      return action.mode === "classic"
        ? { screen: "game", mode: "classic", modal: null }
        : { ...state, modal: "development" };
    case "developer": return state.screen === "menu" ? { ...state, modal: "developer" } : state;
    case "close-modal": return { ...state, modal: null };
    case "menu": return INITIAL_APP_STATE;
  }
}
