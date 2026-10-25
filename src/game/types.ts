export const SAVE_VERSION = 1 as const;

export const COLS = 40;
export const ROWS = 32;
export const DAYS_PER_SEASON = 5;
export const MAJORITY_AGE = 15;
export const MIN_STEWARD_YEARS = 16;
export const HARD_STEWARD_YEARS = 26;
export const CENTURY_END = 1975;

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Dir = "n" | "s" | "e" | "w";
export type CropId = "wheat" | "potato" | "beans" | "corn";
export type ParcelId = "garden" | "west" | "orchard" | "creek" | "east";
export type FamilyId = "harrow" | "voss" | "pike";
export type Coat = "russet" | "indigo" | "moss";
export type Trait = "greenThumb" | "frugal" | "restless" | "hotTempered";
export type Ground = "grass" | "path" | "water" | "gravel" | "asphalt";
export type Decor = "none" | "tree" | "flower" | "reed" | "stone" | "neighborCrop";
export type Interact = "home" | "market" | "church" | "school" | "board" | null;
export type Weather = "clear" | "rain" | "storm" | "snow" | "drought";
export type EraId = "depression" | "mechanization";

export interface CropState {
  id: CropId;
  prog: number;
  dry: number;
  watered: boolean;
}

export interface TreeState {
  kind: "apple";
  age: number;
  fruit: boolean;
}

export interface Tile {
  g: Ground;
  decor: Decor;
  parcel: ParcelId | null;
  soil: number;
  tilled: boolean;
  crop: CropState | null;
  tree: TreeState | null;
  worked: boolean;
  solid: boolean;
  interact: Interact;
  road: "town" | "dirt" | null;
  bridge: boolean;
}

export interface Building {
  id: string;
  kind: "farmhouse" | "barn" | "cabin" | "store" | "school" | "church" | "diner" | "sign" | "pump";
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  wall: string;
  label: string;
}

export interface Npc {
  id: string;
  name: string;
  role: "suitor" | "neighbor" | "spouse" | "vendor";
  family: FamilyId | null;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  originX: number;
  originY: number;
  relation: number;
  age: number;
  shirt: string;
  hair: string;
  pants: string;
  blurb: string;
}

export interface Family {
  id: FamilyId;
  name: string;
  relation: number;
}

export interface Child {
  id: string;
  name: string;
  bornYear: number;
  coat: Coat;
  traits: Record<Trait, number>;
  attention: number;
  leftForCity: boolean;
  askedCity: boolean;
}

export interface Kin {
  id: string;
  name: string;
  coat: Coat;
  note: string;
}

export interface Elder {
  name: string;
  partner: string | null;
}

export interface Buffs {
  greenThumb: boolean;
  frugal: boolean;
  restless: boolean;
  hotTempered: boolean;
}

export interface GenRecord {
  generation: number;
  name: string;
  coat: Coat;
  startYear: number;
  endYear: number;
  spouse: string | null;
  children: { name: string; traits: string[]; heir: boolean; left: boolean }[];
  line: string;
}

export interface Stats {
  harvested: number;
  earned: number;
  treesPlanted: number;
  days: number;
}

export interface Tutorial {
  till: boolean;
  plant: boolean;
  water: boolean;
  sleep: boolean;
  harvest: boolean;
  sell: boolean;
  talk: boolean;
  tree: boolean;
  rewarded: boolean;
}

export interface DogState {
  name: string;
  bornYear: number;
}

export interface GameState {
  version: typeof SAVE_VERSION;
  familyName: string;
  playerName: string;
  coat: Coat;
  year: number;
  season: Season;
  day: number;
  minutes: number;
  energy: number;
  maxEnergy: number;
  maxEnergyPenalty: number;
  money: number;
  debt: number;
  generation: number;
  age: number;
  stewardStart: number;
  buffs: Buffs;
  seeds: Record<CropId, number>;
  harvest: Record<CropId, number>;
  apples: number;
  saplings: number;
  compost: number;
  selected: CropId | "apple";
  machines: { plow: boolean; tractor: boolean; irrigation: boolean };
  tiles: Tile[];
  buildings: Building[];
  npcs: Npc[];
  families: Record<FamilyId, Family>;
  spouseId: string | null;
  spouseSince: number;
  children: Child[];
  kin: Kin[];
  elder: Elder | null;
  keptHeirlooms: string[];
  activeHeirlooms: string[];
  seenEvents: string[];
  queue: string[];
  pendingEvent: string | null;
  pendingStories: string[];
  resumeScreen: "play" | "succession" | "epilogue" | "stories";
  successionForced: boolean;
  finalSuccession: boolean;
  flags: Record<string, number | boolean | string>;
  memories: string[];
  log: string[];
  genRecords: GenRecord[];
  stats: Stats;
  weather: Weather;
  talkedToday: string[];
  familyTimeKey: string;
  tutorial: Tutorial;
  player: { x: number; y: number; facing: Dir };
  dog: DogState;
  gameOver: boolean;
  epilogue: string[] | null;
  soldParcels: ParcelId[];
  borrowedYear: number;
  helpedToday: boolean;
  nextId: number;
  oddJobDay: number;
  churchSeason: string;
  contract: boolean;
  hybrid: boolean;
  tractorDiscount: boolean;
  horseLoyal: boolean;
  specialtyApple: boolean;
  remittance: number;
}

export interface ChoiceOutcome {
  text: string;
  succession?: boolean;
  epilogue?: boolean;
  forced?: boolean;
  final?: boolean;
}

export interface ActionResult {
  ok: boolean;
  toast?: string;
  sfx?: string;
  floats?: { x: number; y: number; text: string; color: string }[];
  open?: "shop" | "home" | "talk";
  actorKey?: string;
  summary?: { title: string; lines: string[] };
  collapse?: boolean;
}
