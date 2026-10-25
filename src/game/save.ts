import { recomputeEnergy } from "./mutate";
import { SAVE_VERSION, COLS, ROWS, type GameState } from "./types";
import { syncWorld } from "./world";

const KEY = "hearthland-save-v1";

export function saveGame(state: GameState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function hasSave(): boolean {
  return !!localStorage.getItem(KEY);
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    if (state.version !== SAVE_VERSION || state.tiles?.length !== COLS * ROWS) return null;
    if (!state.player || !state.families || !state.npcs) return null;
    for (const n of state.npcs) {
      n.originX ??= n.homeX;
      n.originY ??= n.homeY;
    }
    for (const t of state.tiles) t.worked ??= false;
    state.queue ??= [];
    state.pendingStories ??= [];
    state.kin ??= [];
    state.memories ??= [];
    state.log ??= [];
    state.genRecords ??= [];
    syncWorld(state);
    recomputeEnergy(state);
    return state;
  } catch {
    return null;
  }
}
