import { COLS, ROWS, type Dir, type GameState, type Tile } from "./types";
import { DIRS } from "./util";

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < COLS && y < ROWS;
}

export function tileAt(s: GameState, x: number, y: number): Tile {
  return s.tiles[y * COLS + x]!;
}

export function facingOf(s: GameState): { x: number; y: number } {
  const d = DIRS[s.player.facing];
  return { x: s.player.x + d.x, y: s.player.y + d.y };
}

export function facingTile(s: GameState): Tile | null {
  const f = facingOf(s);
  if (!inBounds(f.x, f.y)) return null;
  return tileAt(s, f.x, f.y);
}

export function turnLeft(d: Dir): Dir {
  return ({ n: "w", w: "s", s: "e", e: "n" } as const)[d];
}

export function turnRight(d: Dir): Dir {
  return ({ n: "e", e: "s", s: "w", w: "n" } as const)[d];
}

export function eachTile(s: GameState, fn: (t: Tile, x: number, y: number) => void): void {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) fn(tileAt(s, x, y), x, y);
  }
}
