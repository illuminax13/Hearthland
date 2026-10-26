import { DAYS_PER_SEASON, HARD_STEWARD_YEARS, MAJORITY_AGE, MIN_STEWARD_YEARS, CENTURY_END, type GameState, type Season } from "./types";

export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

export function nextSeason(season: Season): Season {
  return SEASONS[(SEASONS.indexOf(season) + 1) % 4]!;
}

export function nightsUntilWinter(s: GameState): number {
  const left = DAYS_PER_SEASON - s.day + 1;
  if (s.season === "winter") return 0;
  if (s.season === "autumn") return left;
  if (s.season === "summer") return left + DAYS_PER_SEASON;
  return left + DAYS_PER_SEASON * 2;
}

export function seasonKey(s: GameState): string {
  return `${s.year}:${s.season}`;
}

export function yearsSince(s: GameState, id: string): number {
  const v = s.flags[`last:${id}`];
  return typeof v === "number" ? s.year - v : 99;
}

export function eligibleChildren(s: GameState): GameState["children"] {
  return s.children.filter((c) => !c.leftForCity && s.year - c.bornYear >= MAJORITY_AGE);
}

export function retirementHard(s: GameState): boolean {
  const years = s.year - s.stewardStart;
  return years >= HARD_STEWARD_YEARS || s.age >= 68;
}

export function retirementReady(s: GameState): boolean {
  if (s.gameOver || s.year >= CENTURY_END) return false;
  if (s.season !== "spring" && s.season !== "summer") return false;
  if (s.year === 1942 && s.season === "spring") return false;
  if (s.flags.deferRetire === s.year) return false;
  const years = s.year - s.stewardStart;
  if (retirementHard(s)) return true;
  return years >= MIN_STEWARD_YEARS && eligibleChildren(s).length > 0;
}
