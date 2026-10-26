import { COAT_HEX } from "./content";
import { eachTile, tileAt } from "./grid";
import {
  COLS,
  ROWS,
  type Building,
  type Child,
  type Decor,
  type GameState,
  type Ground,
  type Kin,
  type Npc,
  type ParcelId,
  type Tile,
} from "./types";
import { hash } from "./util";

export const START = { x: 11, y: 16 };

export interface Actor {
  key: string;
  kind: "npc" | "child" | "elder" | "kin";
  name: string;
  x: number;
  y: number;
  shirt: string;
  pants: string;
  hair: string;
  hat: string;
  small: boolean;
  blurb: string;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function rect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x0, y0, x1, y1 };
}

function makeTile(): Tile {
  return {
    g: "grass",
    decor: "none",
    parcel: null,
    soil: 55,
    tilled: false,
    crop: null,
    tree: null,
    worked: false,
    solid: false,
    interact: null,
    road: null,
    bridge: false,
  };
}

function paintRect(
  tiles: Tile[],
  r: Rect,
  fn: (t: Tile, x: number, y: number) => void,
): void {
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
      fn(tiles[y * COLS + x]!, x, y);
    }
  }
}

function setGround(tiles: Tile[], r: Rect, g: Ground, road: Tile["road"] = null): void {
  paintRect(tiles, r, (t) => {
    t.g = g;
    t.road = road;
    t.parcel = null;
    t.decor = "none";
  });
}

const PARCELS: { id: ParcelId; r: Rect; soil: number }[] = [
  { id: "orchard", r: rect(10, 7, 16, 9), soil: 70 },
  { id: "west", r: rect(2, 14, 7, 20), soil: 66 },
  { id: "garden", r: rect(10, 17, 15, 20), soil: 76 },
  { id: "creek", r: rect(22, 17, 25, 21), soil: 84 },
  { id: "east", r: rect(27, 17, 35, 22), soil: 68 },
];

export function buildMap(): { tiles: Tile[]; buildings: Building[]; npcs: Npc[] } {
  const tiles: Tile[] = [];
  for (let i = 0; i < COLS * ROWS; i++) tiles.push(makeTile());

  for (let y = 0; y <= 5; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tiles[y * COLS + x]!;
      if (hash(x, y) % 3 === 0) {
        t.decor = "tree";
        t.solid = true;
      }
    }
  }

  const clearTree = (r: Rect) => {
    paintRect(tiles, r, (t) => {
      if (t.decor === "tree") {
        t.decor = "none";
        t.solid = false;
      }
    });
  };

  setGround(tiles, rect(1, 6, 38, 6), "path", "dirt");
  setGround(tiles, rect(18, 6, 18, 31), "path", "dirt");
  setGround(tiles, rect(1, 10, 18, 10), "path", "dirt");
  setGround(tiles, rect(8, 16, 18, 16), "path", "dirt");
  setGround(tiles, rect(18, 15, 37, 15), "path", "dirt");
  setGround(tiles, rect(4, 25, 36, 25), "path", "town");
  setGround(tiles, rect(10, 30, 35, 30), "path", "dirt");
  setGround(tiles, rect(12, 25, 12, 30), "path", "dirt");
  setGround(tiles, rect(22, 25, 22, 30), "path", "dirt");
  setGround(tiles, rect(31, 25, 31, 30), "path", "dirt");

  paintRect(tiles, rect(20, 12, 39, 12), (t) => {
    t.g = "water";
    t.solid = true;
    t.parcel = null;
    t.decor = "none";
    t.road = null;
  });
  paintRect(tiles, rect(20, 13, 21, 14), (t) => {
    t.g = "water";
    t.solid = true;
    t.parcel = null;
    t.decor = "none";
  });
  paintRect(tiles, rect(19, 13, 19, 14), (t) => {
    if (t.g !== "path") t.decor = "reed";
  });

  for (const p of PARCELS) {
    paintRect(tiles, p.r, (t, x, y) => {
      if (t.g === "path" || t.g === "water" || t.g === "asphalt") return;
      t.parcel = p.id;
      t.soil = p.soil + ((hash(x, y) % 11) - 5);
      if (hash(x + 3, y + 9) % 17 === 0) t.decor = "flower";
    });
  }

  clearTree(rect(2, 1, 12, 5));
  clearTree(rect(16, 1, 22, 5));

  paintRect(tiles, rect(2, 11, 6, 12), (t, x, y) => {
    if (t.g === "grass") t.decor = hash(x, y) % 2 === 0 ? "neighborCrop" : "none";
  });

  const buildings: Building[] = [
    { id: "pike", kind: "cabin", x: 3, y: 1, w: 4, h: 3, roof: "#6e4a32", wall: "#cbb592", label: "Pike" },
    { id: "harrow", kind: "farmhouse", x: 2, y: 7, w: 4, h: 3, roof: "#8d4b32", wall: "#f0ddc4", label: "Harrow" },
    { id: "home", kind: "farmhouse", x: 9, y: 13, w: 5, h: 3, roof: "#9c3b3b", wall: "#f4e6cf", label: "Home" },
    { id: "barn", kind: "barn", x: 15, y: 13, w: 3, h: 3, roof: "#7a3e2e", wall: "#8d5a3a", label: "Barn" },
    { id: "church", kind: "church", x: 10, y: 27, w: 4, h: 3, roof: "#d8d2c4", wall: "#f7f1e4", label: "Church" },
    { id: "school", kind: "school", x: 20, y: 27, w: 4, h: 3, roof: "#3f6b4a", wall: "#f3e7d2", label: "School" },
    { id: "market", kind: "store", x: 29, y: 27, w: 4, h: 3, roof: "#355f86", wall: "#f6edd9", label: "Voss's" },
  ];

  const tilesRef = { tiles };
  occupyBuildings(tilesRef.tiles, buildings);

  const door = (x: number, y: number, kind: Tile["interact"]) => {
    const t = tiles[y * COLS + x];
    if (!t) return;
    t.interact = kind;
    t.solid = false;
    t.g = t.g === "water" ? "path" : t.g;
  };
  door(4, 4, null);
  door(3, 10, null);
  door(11, 16, "home");
  door(12, 30, "church");
  door(22, 30, "school");
  door(31, 30, "market");
  const board = tiles[25 * COLS + 27]!;
  board.interact = "board";
  board.solid = false;

  const npcs: Npc[] = [
    npc("cal", "Cal Harrow", "suitor", "harrow", 8, 10, 22, "#6d8f55", "#3a2a22", "#3e4250", "A Harrow son with shoulders built for a plow and a voice that stays low."),
    npc("ruth", "Ruth Harrow", "neighbor", "harrow", 5, 10, 54, "#a24b3a", "#5c4034", "#3a332c", "She feeds the lane. She also remembers every favor and every slight."),
    npc("mara", "Mara Ellison", "suitor", "voss", 24, 30, 26, "#3d4f79", "#2a2118", "#4a3b46", "The schoolteacher. She reads the valley the way other people read weather."),
    npc("ida", "Ida Voss", "suitor", "voss", 33, 30, 24, "#8d4d3a", "#6b3a2a", "#2c3344", "Keeps a private ledger in her head. Warm, once the numbers are done."),
    npc("nell", "Nell Voss", "vendor", "voss", 32, 30, 31, "#c47a4a", "#3a2a22", "#343048", "Runs the counter. The family name is on the sign; her pencil is on the receipt."),
    npc("jonah", "Jonah Pike", "suitor", "pike", 9, 4, 23, "#4e6a44", "#1d1a17", "#3a332c", "Fixes bicycles now and engines the moment they exist. Always half turned toward the road."),
    npc("harlan", "Harlan Pike", "neighbor", "pike", 6, 4, 61, "#6b5344", "#d8d2c8", "#2a261f", "Few words, all of them about land, trees, or something your people did."),
  ];

  sprinkle(tiles);
  return { tiles, buildings, npcs };
}

function npc(
  id: string,
  name: string,
  role: Npc["role"],
  family: Npc["family"],
  x: number,
  y: number,
  age: number,
  shirt: string,
  hair: string,
  pants: string,
  blurb: string,
): Npc {
  return {
    id,
    name,
    role,
    family,
    x,
    y,
    homeX: x,
    homeY: y,
    originX: x,
    originY: y,
    relation: role === "suitor" ? 8 : 4,
    age,
    shirt,
    hair,
    pants,
    blurb,
  };
}

function sprinkle(tiles: Tile[]): void {
  for (let y = 26; y < 32; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tiles[y * COLS + x]!;
      if (t.g === "grass" && t.decor === "none" && hash(x, y) % 11 === 0) t.decor = "flower";
      if (t.g === "grass" && hash(x, y) % 29 === 0) t.decor = "stone";
    }
  }
  const accents: [number, number][] = [
    [6, 28],
    [36, 28],
    [8, 8],
    [17, 8],
  ];
  for (const [x, y] of accents) {
    const t = tiles[y * COLS + x];
    if (t && t.g === "grass" && !t.solid) {
      t.decor = "tree";
      t.solid = true;
    }
  }
}

function occupyBuildings(tiles: Tile[], buildings: Building[]): void {
  for (const b of buildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        const t = tiles[y * COLS + x];
        if (!t) continue;
        t.solid = true;
        t.parcel = null;
        t.decor = "none";
        if (t.g === "water") t.g = "grass";
      }
    }
  }
}

export function syncWorld(s: GameState): void {
  eachTile(s, (t) => {
    if (t.road === "town") t.g = s.year >= 1950 ? "asphalt" : "path";
    if (s.soldParcels.includes("east") && t.parcel === "east") {
      t.g = "gravel";
      t.crop = null;
      t.tree = null;
      t.tilled = false;
    }
  });

  s.buildings = s.buildings.filter((b) => !["billboard", "diner", "pump"].includes(b.id));
  if (s.soldParcels.includes("east")) {
    if (s.year >= 1950) {
      s.buildings.push({
        id: "diner",
        kind: "diner",
        x: 30,
        y: 18,
        w: 4,
        h: 3,
        roof: "#c4553a",
        wall: "#efe6d4",
        label: "Route Diner",
      });
    } else {
      s.buildings.push({
        id: "billboard",
        kind: "sign",
        x: 31,
        y: 19,
        w: 2,
        h: 1,
        roof: "#d2c4a4",
        wall: "#efe6d4",
        label: "SOLD",
      });
    }
  }
  if (s.machines.irrigation) {
    s.buildings.push({
      id: "pump",
      kind: "pump",
      x: 22,
      y: 16,
      w: 1,
      h: 1,
      roof: "#5c6670",
      wall: "#8d9398",
      label: "Pump",
    });
  }

  eachTile(s, (t) => {
    t.solid = t.g === "water" || t.decor === "tree" || t.tree !== null;
  });
  occupyBuildings(s.tiles, s.buildings);
  const home = tileAt(s, 11, 16);
  home.interact = "home";
  home.solid = false;
  const church = tileAt(s, 12, 30);
  church.interact = "church";
  church.solid = false;
  const school = tileAt(s, 22, 30);
  school.interact = "school";
  school.solid = false;
  const market = tileAt(s, 31, 30);
  market.interact = "market";
  market.solid = false;
  const board = tileAt(s, 27, 25);
  board.interact = "board";
  board.solid = false;
}

export function isFarmable(s: GameState, t: Tile): boolean {
  if (!t.parcel) return false;
  if (t.solid) return false;
  if (t.tree) return false;
  if (t.g === "water" || t.g === "path" || t.g === "asphalt" || t.g === "gravel") return false;
  if (s.soldParcels.includes(t.parcel)) return false;
  return true;
}

export function actors(s: GameState): Actor[] {
  const list: Actor[] = [];
  for (const n of s.npcs) {
    const hat = n.role === "spouse" ? "#6b3a2a" : n.hair;
    list.push({
      key: `npc:${n.id}`,
      kind: "npc",
      name: n.name,
      x: n.x,
      y: n.y,
      shirt: n.shirt,
      pants: n.pants,
      hair: n.hair,
      hat: n.role === "neighbor" && n.age > 50 ? n.hair : hat,
      small: false,
      blurb: n.blurb,
    });
  }
  const spots: [number, number][] = [
    [19, 16],
    [20, 16],
    [19, 17],
  ];
  let si = 0;
  for (const c of s.children) {
    if (c.leftForCity) continue;
    const age = s.year - c.bornYear;
    if (age < 5) continue;
    const spot = spots[si % spots.length]!;
    si++;
    const coat = COAT_HEX[c.coat]!;
    list.push({
      key: `child:${c.id}`,
      kind: "child",
      name: c.name,
      x: spot[0],
      y: spot[1],
      shirt: coat.shirt,
      pants: coat.pants,
      hair: "#3a2a22",
      hat: coat.hat,
      small: age < 12,
      blurb: `${c.name}, ${age}, is somewhere between the porch and the rows.`,
    });
  }
  if (s.elder) {
    list.push({
      key: "elder",
      kind: "elder",
      name: s.elder.name,
      x: 9,
      y: 16,
      shirt: "#cbb592",
      pants: "#3e4250",
      hair: "#d8d2c8",
      hat: "#6b5344",
      small: false,
      blurb: `${s.elder.name} keeps the porch chair warm and the advice unasked-for.`,
    });
  }
  s.kin.slice(0, 2).forEach((k, i) => {
    const coat = COAT_HEX[k.coat]!;
    list.push({
      key: `kin:${k.id}`,
      kind: "kin",
      name: k.name,
      x: 19,
      y: 18 + i,
      shirt: coat.shirt,
      pants: coat.pants,
      hair: "#3a2a22",
      hat: coat.hat,
      small: false,
      blurb: k.note,
    });
  });
  return list;
}

export function actorAt(s: GameState, x: number, y: number): Actor | null {
  return actors(s).find((a) => a.x === x && a.y === y) ?? null;
}

export function decorName(d: Decor): string {
  if (d === "neighborCrop") return "a neighbor's row";
  if (d === "tree") return "a tree";
  return d;
}

export function childAge(s: GameState, c: Child): number {
  return s.year - c.bornYear;
}

export function kinLine(k: Kin): string {
  return k.note;
}

export function parcelAverages(s: GameState): { id: ParcelId; name: string; avg: number; tiles: number }[] {
  const acc = new Map<ParcelId, { sum: number; n: number }>();
  eachTile(s, (t) => {
    if (!t.parcel || s.soldParcels.includes(t.parcel)) return;
    const a = acc.get(t.parcel) ?? { sum: 0, n: 0 };
    a.sum += t.soil;
    a.n++;
    acc.set(t.parcel, a);
  });
  return [...acc.entries()].map(([id, v]) => ({
    id,
    name: id,
    avg: v.n ? Math.round(v.sum / v.n) : 0,
    tiles: v.n,
  }));
}
