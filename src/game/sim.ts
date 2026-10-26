import { nextSeason, nightsUntilWinter, seasonKey } from "./calendar";
import {
  CHILD_NAMES,
  COAT_HEX,
  CROP_ORDER,
  CROPS,
  DOG_NAMES,
  emptyTraits,
  eraBlurb,
  HEIRLOOMS,
  interestRate,
  morningBlurb,
  saplingCost,
  seasonName,
  seedCost,
  sellPrice,
  soilWord,
  topTraits,
  TRAIT_LABEL,
  tractorPrice,
  traitBuffs,
} from "./content";
import { actorFromFacing, type TalkEffect } from "./dialogue";
import { writeEpilogue } from "./epilogue";
import { EVENTS, getEvent } from "./events";
import { eachTile, facingOf, facingTile, inBounds, tileAt, turnLeft, turnRight } from "./grid";
import {
  addMoney,
  averageSoil,
  bumpFamily,
  bumpNpc,
  countTrees,
  grantHeirloom,
  harvestAppleTile,
  harvestCropTile,
  logLine,
  markTutorial,
  memory,
  recomputeEnergy,
  spendEnergy,
  tooDark,
} from "./mutate";
import {
  DAYS_PER_SEASON,
  MAJORITY_AGE,
  type ActionResult,
  type Coat,
  type CropId,
  type Dir,
  type GameState,
  type Npc,
  type ParcelId,
  type Season,
  type Tile,
  type Trait,
  type Weather,
} from "./types";
import { clamp, DIRS } from "./util";
import { actors, buildMap, childAge, isFarmable, START, syncWorld } from "./world";

const COATS: Coat[] = ["russet", "indigo", "moss"];

const NEXT_SUITOR: Record<string, string[]> = {
  cal: ["Ned Harrow", "Bess Harrow", "Paul Harrow"],
  mara: ["Leah Ellison", "Thomas Ellison", "Willa Ellison"],
  ida: ["Fern Voss", "Otto Voss", "Mae Voss"],
  jonah: ["Silas Pike", "Iris Pike", "Joe Pike"],
};

export interface NewGameOptions {
  given: string;
  family: string;
  coat: Coat;
}

export function createNewGame(opts: NewGameOptions): GameState {
  const built = buildMap();
  const given = opts.given.trim().slice(0, 18) || "Ellis";
  const family = opts.family.trim().slice(0, 18) || "Whitaker";
  const s: GameState = {
    version: 1,
    familyName: family,
    playerName: given,
    coat: opts.coat,
    year: 1925,
    season: "spring",
    day: 1,
    minutes: 30,
    energy: 100,
    maxEnergy: 100,
    maxEnergyPenalty: 0,
    money: 42,
    debt: 0,
    generation: 1,
    age: 24,
    stewardStart: 1925,
    buffs: { greenThumb: false, frugal: false, restless: false, hotTempered: false },
    seeds: { wheat: 8, potato: 6, beans: 4, corn: 2 },
    harvest: { wheat: 0, potato: 0, beans: 0, corn: 0 },
    apples: 0,
    saplings: 1,
    compost: 1,
    selected: "wheat",
    machines: { plow: false, tractor: false, irrigation: false },
    tiles: built.tiles,
    buildings: built.buildings,
    npcs: built.npcs,
    families: {
      harrow: { id: "harrow", name: "the Harrows", relation: 16 },
      voss: { id: "voss", name: "the Vosses", relation: 6 },
      pike: { id: "pike", name: "the Pikes", relation: 0 },
    },
    spouseId: null,
    spouseSince: 0,
    children: [],
    kin: [],
    elder: null,
    keptHeirlooms: ["mothers-seed-tin", "fathers-ring", "seed-catalogue"],
    activeHeirlooms: ["mothers-seed-tin", "fathers-ring", "seed-catalogue"],
    seenEvents: [],
    queue: [],
    pendingEvent: null,
    pendingStories: [],
    resumeScreen: "play",
    successionForced: false,
    finalSuccession: false,
    flags: {},
    memories: ["Took the farm in the spring of 1925 with a seed tin and a thin jar."],
    log: ["The county wrote your name on the tax line."],
    genRecords: [],
    stats: { harvested: 0, earned: 0, treesPlanted: 0, days: 0 },
    weather: "clear",
    talkedToday: [],
    familyTimeKey: "",
    tutorial: {
      till: false,
      plant: false,
      water: false,
      sleep: false,
      harvest: false,
      sell: false,
      talk: false,
      tree: false,
      rewarded: false,
    },
    player: { x: START.x, y: START.y, facing: "s" },
    dog: { name: "Biscuit", bornYear: 1923 },
    gameOver: false,
    epilogue: null,
    soldParcels: [],
    borrowedYear: 0,
    helpedToday: false,
    nextId: 1,
    oddJobDay: -1,
    churchSeason: "",
    contract: false,
    hybrid: false,
    tractorDiscount: false,
    horseLoyal: false,
    specialtyApple: false,
    remittance: 0,
  };
  const startRel: Record<string, number> = { cal: 14, ruth: 16, mara: 11, ida: 9, nell: 6, jonah: 3, harlan: 0 };
  for (const n of s.npcs) n.relation = startRel[n.id] ?? n.relation;
  syncWorld(s);
  recomputeEnergy(s);
  return s;
}

export function createPreview(): GameState {
  const s = createNewGame({ given: "Ellis", family: "Whitaker", coat: "russet" });
  const stage: { x: number; y: number; id: CropId; prog: number }[] = [
    { x: 10, y: 17, id: "wheat", prog: 4 },
    { x: 11, y: 17, id: "wheat", prog: 3 },
    { x: 12, y: 17, id: "wheat", prog: 2 },
    { x: 13, y: 17, id: "beans", prog: 3 },
    { x: 14, y: 17, id: "potato", prog: 2 },
    { x: 10, y: 18, id: "corn", prog: 2 },
    { x: 11, y: 18, id: "wheat", prog: 1 },
  ];
  for (const c of stage) {
    const t = tileAt(s, c.x, c.y);
    t.tilled = true;
    t.crop = { id: c.id, prog: c.prog, dry: 0, watered: true };
  }
  for (const [x, y] of [
    [11, 8],
    [13, 8],
    [15, 7],
  ] as const) {
    const t = tileAt(s, x, y);
    t.tree = { kind: "apple", age: 6, fruit: true };
    t.solid = true;
  }
  s.minutes = 90;
  s.money = 64;
  s.apples = 4;
  return s;
}

export function tutorialLine(s: GameState): string | null {
  const t = s.tutorial;
  if (!t.till) return "Till the garden: face the ground south of the door and press E.";
  if (!t.plant) return "Press 1–4 for a seed, then E on tilled soil.";
  if (!t.water) return "Water the new planting with E.";
  if (!t.sleep) return "Face the farmhouse from the porch and press E to sleep.";
  if (!t.harvest) return "Ripe crops show their color. E gathers a row.";
  if (!t.sell) return "Follow the lane south into town and sell at Voss's.";
  if (!t.talk) return "Face someone and press E. The town keeps a ledger too.";
  if (!t.tree) return "Press 5 for the apple sapling and plant it. It is for someone not born yet.";
  return null;
}

export function hint(s: GameState): string {
  const actor = actorFromFacing(s);
  if (actor) return `E  Talk to ${actor.name}`;
  const f = facingOf(s);
  if (!inBounds(f.x, f.y)) return "The lane ends here.";
  const t = tileAt(s, f.x, f.y);
  if (t.interact === "home") return "E  Home — sleep, family, ledger";
  if (t.interact === "market") return "E  Voss's market";
  if (t.interact === "church") return "E  Sit a minute in the church";
  if (t.interact === "school") return "E  The schoolhouse";
  if (t.interact === "board") return "E  Odd job on the town board";
  if (s.player && tileAt(s, s.player.x, s.player.y).interact === "home" && t.solid) return "E  Step inside";
  if (t.tree) {
    if (t.tree.fruit) return "E  Pick apples";
    const age = t.tree.age;
    return age >= 4 || (s.activeHeirlooms.includes("orchard-letter") && age >= 3)
      ? "Apple tree, resting until autumn"
      : `Sapling, ${age} year${age === 1 ? "" : "s"} in the ground`;
  }
  if (t.crop) {
    const def = CROPS[t.crop.id];
    if (t.crop.prog >= def.growDays) return `E  Harvest ${def.name.toLowerCase()}`;
    const water = t.crop.watered ? "watered" : "thirsty";
    return `${def.name}, day ${t.crop.prog}/${def.growDays}, ${water} · ${soilText(s, t)}`;
  }
  if (isFarmable(s, t)) {
    if (s.season === "winter") return `Resting ground · ${soilText(s, t)}`;
    if (t.tilled) {
      const what = s.selected === "apple" ? "apple sapling" : CROPS[s.selected].name.toLowerCase();
      return `E  Plant ${what} · ${soilText(s, t)}`;
    }
    const tool = s.machines.tractor ? "tractor" : s.machines.plow ? "plow" : "hoe";
    return `E  Till with the ${tool} · ${soilText(s, t)}`;
  }
  if (t.g === "water") return "Creek water, cold even in August.";
  if (t.decor === "tree") return "A wild tree. Not yours to cut.";
  return `${seasonName(s.season)} on the lane.`;
}

function soilText(s: GameState, t: Tile): string {
  if (s.activeHeirlooms.includes("seed-catalogue")) return `soil ${t.soil}`;
  return `${soilWord(t.soil)} soil`;
}

export function tryMove(s: GameState, dir: Dir): boolean {
  const d = DIRS[dir];
  const nx = s.player.x + d.x;
  const ny = s.player.y + d.y;
  s.player.facing = dir;
  if (!inBounds(nx, ny)) return false;
  if (tileAt(s, nx, ny).solid) return false;
  s.player.x = nx;
  s.player.y = ny;
  for (const n of s.npcs) {
    if (n.x === nx && n.y === ny) {
      const spot = nudge(s, n.originX, n.originY);
      if (spot) {
        n.x = spot.x;
        n.y = spot.y;
      }
    }
  }
  return true;
}

function nudge(s: GameState, x: number, y: number): { x: number; y: number } | null {
  const options = [
    { x, y },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  for (const o of options) {
    if (!inBounds(o.x, o.y)) continue;
    if (tileAt(s, o.x, o.y).solid) continue;
    if (o.x === s.player.x && o.y === s.player.y) continue;
    return o;
  }
  return null;
}

export function selectSeed(s: GameState, id: CropId | "apple"): void {
  s.selected = id;
}

export function interact(s: GameState): ActionResult {
  const actor = actorFromFacing(s);
  if (actor) return { ok: true, open: "talk", actorKey: actor.key, sfx: "ui" };

  const faced = facingTile(s);
  const stood = tileAt(s, s.player.x, s.player.y);

  if (faced?.crop && faced.crop.prog >= CROPS[faced.crop.id].growDays) return harvest(s);
  if (faced?.crop && !faced.crop.watered && s.weather !== "rain" && s.weather !== "storm") return water(s);
  if (faced?.tree?.fruit) return pickApples(s);
  if (faced && isFarmable(s, faced) && !faced.crop && faced.tilled && s.season !== "winter") return plant(s);
  if (faced && isFarmable(s, faced) && !faced.crop && !faced.tilled) return till(s);
  if (faced?.interact) return useInteract(s, faced.interact);
  if (stood.interact && faced?.solid) return useInteract(s, stood.interact);
  if (faced?.crop) return fail("This row is already watered.");
  if (s.season === "winter" && faced && isFarmable(s, faced)) {
    return { ok: false, toast: "Nothing grows in this freeze. Mend, sell, and talk." };
  }
  return { ok: false, toast: "Nothing here wants your hands." };
}

function fail(toast: string): ActionResult {
  return { ok: false, toast, sfx: "ui" };
}

function maybeCollapse(s: GameState, result: ActionResult): ActionResult {
  if (result.ok && (s.energy <= 0 || s.minutes >= 16.5 * 60)) {
    const slept = sleepThrough(s);
    const lines = [`You work until the day folds you into bed.`, ...(slept.summary?.lines ?? [])];
    return { ...slept, collapse: true, summary: { title: slept.summary?.title ?? "A long day", lines } };
  }
  return finishTutorial(s, result);
}

function finishTutorial(s: GameState, result: ActionResult): ActionResult {
  const t = s.tutorial;
  const done = t.till && t.plant && t.water && t.sleep && t.harvest && t.sell && t.talk && t.tree;
  if (done && !t.rewarded) {
    t.rewarded = true;
    s.money += 10;
    logLine(s, "The valley feels less like a test. +$10.");
    return { ...result, toast: result.toast ? `${result.toast} The first lessons pay $10.` : "The first lessons pay $10." };
  }
  return result;
}

function till(s: GameState): ActionResult {
  if (tooDark(s)) return fail("Too dark to till. The house lamp is on.");
  const tractor = s.machines.tractor;
  const plow = s.machines.plow && !tractor;
  let cost = 6;
  let minutes = 25;
  if (plow) {
    cost = s.horseLoyal ? 8 : 10;
    minutes = 40;
  }
  if (tractor) {
    cost = 14;
    minutes = 35;
    if (!s.activeHeirlooms.includes("tractor-key")) {
      if (s.money < 1) return fail("The tractor wants a dollar of fuel.");
      s.money -= 1;
    }
  }
  if (!spendEnergy(s, cost, minutes)) return fail(s.energy < cost ? "You're too tired to break ground." : "Too dark to till.");
  const spots = actionTiles(s, tractor ? "block" : plow ? "line" : "one");
  let n = 0;
  const floats: ActionResult["floats"] = [];
  for (const spot of spots) {
    if (!inBounds(spot.x, spot.y)) continue;
    const t = tileAt(s, spot.x, spot.y);
    if (!isFarmable(s, t) || t.crop || t.tilled) continue;
    t.tilled = true;
    t.worked = true;
    n++;
    floats.push({ x: spot.x, y: spot.y, text: "tilled", color: "#e7d7b8" });
  }
  if (!n) return fail("Nothing there will take the hoe.");
  markTutorial(s, "till");
  return maybeCollapse(s, { ok: true, toast: n > 1 ? `Turned ${n} tiles.` : "The soil opens.", sfx: "hoe", floats });
}

function plant(s: GameState): ActionResult {
  if (s.season === "winter") return fail("The ground is shut for the winter.");
  if (tooDark(s)) return fail("Too dark to plant.");
  const f = facingOf(s);
  if (!inBounds(f.x, f.y)) return fail("Nothing to plant.");
  const t = tileAt(s, f.x, f.y);
  if (!isFarmable(s, t) || !t.tilled || t.crop || t.tree) return fail("That ground isn't ready.");
  if (s.selected === "apple") {
    if (s.saplings <= 0) return fail("No saplings. The peddler or the market might.");
    if (!spendEnergy(s, 4, 20)) return fail("Too tired to plant a tree.");
    s.saplings -= 1;
    t.tree = { kind: "apple", age: 0, fruit: false };
    t.tilled = false;
    t.solid = true;
    t.worked = true;
    s.stats.treesPlanted += 1;
    markTutorial(s, "tree");
    if (countTrees(s).total >= 4) grantHeirloom(s, "orchard-letter");
    return maybeCollapse(s, {
      ok: true,
      toast: "A thin tree. Someone else may eat from it.",
      sfx: "plant",
      floats: [{ x: f.x, y: f.y, text: "planted", color: "#d7ecb4" }],
    });
  }
  const id = s.selected;
  const def = CROPS[id];
  if (!def.seasons.includes(s.season)) return fail(`${def.name} doesn't go in the ground in ${s.season}.`);
  if (s.seeds[id] <= 0) return fail(`No ${def.name.toLowerCase()} seed. Voss's still has sacks.`);
  const nights = nightsUntilWinter(s);
  if (!spendEnergy(s, 3, 20)) return fail("Too tired to plant.");
  s.seeds[id] -= 1;
  t.crop = { id, prog: 0, dry: 0, watered: false };
  t.worked = true;
  markTutorial(s, "plant");
  const warn = nights < def.growDays ? " It may not ripen before the frost." : "";
  return maybeCollapse(s, {
    ok: true,
    toast: `Planted ${def.name.toLowerCase()}.${warn}`,
    sfx: "plant",
    floats: [{ x: f.x, y: f.y, text: def.name, color: "#f2e2b0" }],
  });
}

function water(s: GameState): ActionResult {
  if (s.season === "winter") return fail("Ice in the can.");
  if (s.weather === "rain" || s.weather === "storm") return fail("The sky is already doing this.");
  if (tooDark(s)) return fail("Too dark to water.");
  const extra = s.weather === "drought" && !s.activeHeirlooms.includes("dried-bouquet") ? 2 : 0;
  if (!spendEnergy(s, 6 + extra, 30)) return fail("Too tired to haul water.");
  let n = 0;
  const floats: ActionResult["floats"] = [];
  for (const spot of actionTiles(s, "row")) {
    if (!inBounds(spot.x, spot.y)) continue;
    const t = tileAt(s, spot.x, spot.y);
    if (!t.crop || t.crop.watered) continue;
    t.crop.watered = true;
    n++;
    floats.push({ x: spot.x, y: spot.y, text: "watered", color: "#b7dff0" });
  }
  if (!n) return fail("Nothing thirsty in reach.");
  markTutorial(s, "water");
  return maybeCollapse(s, { ok: true, toast: n > 1 ? `Watered ${n}.` : "Watered.", sfx: "water", floats });
}

function harvest(s: GameState): ActionResult {
  if (tooDark(s)) return fail("Too dark to harvest. Leave it for first light.");
  if (!spendEnergy(s, s.machines.tractor ? 8 : 6, s.machines.tractor ? 30 : 35)) return fail("Too tired to harvest.");
  if (s.machines.tractor && !s.activeHeirlooms.includes("tractor-key")) {
    if (s.money < 1) return fail("No fuel in the tractor.");
    s.money -= 1;
  }
  const mode = s.machines.tractor ? "block" : "row";
  let n = 0;
  let gained = 0;
  let cropName = "crop";
  const floats: ActionResult["floats"] = [];
  for (const spot of actionTiles(s, mode)) {
    if (!inBounds(spot.x, spot.y)) continue;
    const t = tileAt(s, spot.x, spot.y);
    if (!t.crop || t.crop.prog < CROPS[t.crop.id].growDays) continue;
    cropName = CROPS[t.crop.id].name;
    const amount = harvestCropTile(s, spot.x, spot.y);
    gained += amount;
    n++;
    floats.push({ x: spot.x, y: spot.y, text: `+${amount}`, color: "#f6e27a" });
  }
  if (!n) return fail("Nothing ripe in reach.");
  markTutorial(s, "harvest");
  return maybeCollapse(s, {
    ok: true,
    toast: `Brought in ${gained} ${cropName.toLowerCase()}.`,
    sfx: "harvest",
    floats,
  });
}

function pickApples(s: GameState): ActionResult {
  if (tooDark(s)) return fail("Too dark under the branches.");
  const f = facingOf(s);
  if (!spendEnergy(s, 5, 20)) return fail("Too tired to pick.");
  const amount = harvestAppleTile(s, f.x, f.y);
  if (!amount) return fail("No fruit on this tree.");
  markTutorial(s, "harvest");
  return maybeCollapse(s, {
    ok: true,
    toast: `Picked ${amount} apples.`,
    sfx: "harvest",
    floats: [{ x: f.x, y: f.y, text: `+${amount}`, color: "#f0a0a8" }],
  });
}

function actionTiles(s: GameState, shape: "one" | "line" | "row" | "block"): { x: number; y: number }[] {
  const f = facingOf(s);
  const forward = DIRS[s.player.facing];
  if (shape === "one") return [f];
  if (shape === "line") {
    return [0, 1, 2].map((i) => ({ x: f.x + forward.x * i, y: f.y + forward.y * i }));
  }
  const left = DIRS[turnLeft(s.player.facing)];
  const right = DIRS[turnRight(s.player.facing)];
  if (shape === "row") {
    return [f, { x: f.x + left.x, y: f.y + left.y }, { x: f.x + right.x, y: f.y + right.y }];
  }
  const spots: { x: number; y: number }[] = [];
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) spots.push({ x: f.x + x, y: f.y + y });
  return spots;
}

function useInteract(s: GameState, kind: NonNullable<Tile["interact"]>): ActionResult {
  if (kind === "home") return { ok: true, open: "home", sfx: "ui" };
  if (kind === "market") return { ok: true, open: "shop", sfx: "ui" };
  if (kind === "school") return { ok: true, toast: "Chalk dust and the smell of wet wool. Mara keeps the future in rows of desks.", sfx: "ui" };
  if (kind === "church") return church(s);
  if (kind === "board") return oddJob(s);
  return fail("Nothing to do.");
}

function church(s: GameState): ActionResult {
  if (s.churchSeason === seasonKey(s)) return { ok: true, toast: "You've already sat with the quiet this season.", sfx: "ui" };
  if (!spendEnergy(s, 4, 30)) return fail("Too tired to sit still, somehow.");
  s.churchSeason = seasonKey(s);
  bumpFamily(s, "harrow", 2);
  bumpFamily(s, "voss", 2);
  bumpFamily(s, "pike", 2);
  return maybeCollapse(s, { ok: true, toast: "You were seen at church. The town files that under good.", sfx: "ui" });
}

function oddJob(s: GameState): ActionResult {
  if (s.oddJobDay === s.stats.days) return fail("The board is picked clean for today.");
  if (tooDark(s)) return fail("Nobody hires after dark.");
  const pay = s.season === "winter" ? 9 : 7;
  if (!spendEnergy(s, 18, 90)) return fail("You don't have the afternoon left in you.");
  s.oddJobDay = s.stats.days;
  addMoney(s, pay);
  return maybeCollapse(s, {
    ok: true,
    toast: `Odd job done. +$${pay}.`,
    sfx: "coin",
    floats: [{ x: s.player.x, y: s.player.y, text: `+$${pay}`, color: "#f6e27a" }],
  });
}

export function useCompost(s: GameState): ActionResult {
  if (s.compost <= 0) return fail("No compost. The market sells it.");
  const f = facingOf(s);
  if (!inBounds(f.x, f.y)) return fail("Face a field tile.");
  const t = tileAt(s, f.x, f.y);
  if (!t.parcel || s.soldParcels.includes(t.parcel)) return fail("Compost wants your own ground.");
  if (!spendEnergy(s, 5, 20)) return fail("Too tired to spread it.");
  s.compost -= 1;
  t.soil = clamp(t.soil + 16, 0, 100);
  return maybeCollapse(s, {
    ok: true,
    toast: `Soil lifts to ${t.soil}.`,
    sfx: "plant",
    floats: [{ x: f.x, y: f.y, text: "+soil", color: "#d7c09a" }],
  });
}

export function sleepThrough(s: GameState): ActionResult {
  const lines: string[] = [];
  const rain = s.weather === "rain" || s.weather === "storm";
  let matured = 0;
  if (s.season !== "winter") {
    eachTile(s, (t) => {
      if (!t.crop) return;
      const watered = t.crop.watered || rain;
      if (watered) {
        t.crop.prog += 1;
        t.crop.dry = 0;
      } else t.crop.dry += 1;
      t.crop.watered = false;
      if (t.crop.prog === CROPS[t.crop.id].growDays) matured += 1;
    });
  }
  if (matured) lines.push(`${matured} planting${matured === 1 ? "" : "s"} came ready in the dark.`);
  s.day += 1;
  s.stats.days += 1;
  if (s.day > DAYS_PER_SEASON) {
    s.day = 1;
    lines.push(...advanceSeason(s));
  }
  wakeMorning(s, lines);
  markTutorial(s, "sleep");
  return finishTutorial(s, {
    ok: true,
    sfx: "night",
    summary: { title: `${seasonName(s.season)} ${s.day}, ${s.year}`, lines },
  });
}

function wakeMorning(s: GameState, lines: string[]): void {
  s.minutes = 20;
  s.energy = s.maxEnergy;
  s.talkedToday = [];
  s.helpedToday = false;
  s.player.x = START.x;
  s.player.y = START.y;
  s.player.facing = "s";
  s.weather = rollWeather(s);
  const help = morningHelp(s);
  if (help) lines.push(help);
  showNextEvent(s);
  lines.push(morningBlurb(s));
}

export function rollWeather(s: GameState): Weather {
  if (s.flags.droughtLock === `${s.year}:${s.season}`) return "drought";
  const r = Math.random();
  if (s.season === "winter") return r < 0.62 ? "snow" : "clear";
  if (s.season === "spring") return r < 0.42 ? "rain" : "clear";
  if (s.season === "summer") return r < 0.2 ? "rain" : r < 0.28 ? "storm" : "clear";
  return r < 0.3 ? "rain" : "clear";
}

function morningHelp(s: GameState): string | null {
  const bits: string[] = [];
  if (s.machines.irrigation && s.season !== "winter") {
    let n = 0;
    eachTile(s, (t) => {
      if (!t.crop) return;
      if (t.parcel === "garden" || t.parcel === "creek" || t.parcel === "orchard") {
        t.crop.watered = true;
        n++;
      }
    });
    if (n) bits.push("The pump soaks the garden, the rise, and the creek bottom.");
  }
  if (s.spouseId && s.season !== "winter") {
    const spouse = s.npcs.find((n) => n.id === s.spouseId);
    let n = 0;
    eachTile(s, (t) => {
      if (n >= 2 || !t.crop || t.crop.watered) return;
      t.crop.watered = true;
      n++;
    });
    if (n && spouse) bits.push(`${spouse.name} watered ${n} planting${n === 1 ? "" : "s"} before you were up.`);
  }
  return bits.join(" ");
}

function advanceSeason(s: GameState): string[] {
  const nxt = nextSeason(s.season);
  const lines: string[] = [];
  lines.push(...applyFallow(s));
  if (nxt === "autumn") {
    let fruit = 0;
    eachTile(s, (t) => {
      if (t.tree && t.tree.age >= treeMature(s)) {
        t.tree.fruit = true;
        fruit++;
      }
    });
    if (fruit) lines.push(`${fruit} apple ${fruit === 1 ? "tree sets" : "trees set"} fruit.`);
  }
  if (nxt === "winter") lines.push(...winterFields(s));
  if (nxt === "spring") lines.push(...onNewYear(s));
  else {
    s.season = nxt;
    lines.push(seasonBanner(s.season, s.year));
  }
  enqueueSeasonEvents(s);
  return lines;
}

function treeMature(s: GameState): number {
  return s.activeHeirlooms.includes("orchard-letter") ? 3 : 4;
}

function applyFallow(s: GameState): string[] {
  const bonus = (s.season === "winter" || s.season === "autumn" ? 8 : 5) + (s.activeHeirlooms.includes("seed-catalogue") ? 3 : 0);
  let n = 0;
  eachTile(s, (t) => {
    if (t.tree) {
      t.soil = clamp(t.soil + 2, 0, 100);
      return;
    }
    if (!isFarmable(s, t)) {
      t.worked = false;
      return;
    }
    if (!t.worked && !t.crop) {
      t.soil = clamp(t.soil + bonus, 0, 100);
      n++;
    }
    t.worked = false;
  });
  return n ? [`${n} resting tiles drank a little strength back.`] : [];
}

function winterFields(s: GameState): string[] {
  let saved = 0;
  let dead = 0;
  let fruit = 0;
  eachTile(s, (t, x, y) => {
    if (t.crop) {
      if (t.crop.prog >= CROPS[t.crop.id].growDays) {
        harvestCropTile(s, x, y);
        saved++;
      } else {
        t.crop = null;
        t.soil = clamp(t.soil - 2, 0, 100);
        dead++;
      }
    }
    if (t.tree?.fruit) {
      t.tree.fruit = false;
      fruit++;
    }
  });
  const lines = ["Frost walks the rows."];
  if (saved) lines.push(`You pulled ${saved} ripe planting${saved === 1 ? "" : "s"} by lantern.`);
  if (dead) lines.push(`The cold took ${dead} that weren't ready.`);
  if (fruit) lines.push("Unpicked apples feed the deer.");
  return lines;
}

function seasonBanner(season: Season, year: number): string {
  if (season === "summer") return `Summer ${year}. The days get expensive.`;
  if (season === "autumn") return `Autumn ${year}. What you saved is what you'll sell.`;
  if (season === "winter") return `Winter ${year}. The field clock stops. The house clock doesn't.`;
  return `Spring ${year}.`;
}

export function onNewYear(s: GameState): string[] {
  s.year += 1;
  s.season = "spring";
  s.age += 1;
  const lines = [`Spring ${s.year}. You are ${s.age}.`];
  for (const n of s.npcs) n.age += 1;
  eachTile(s, (t) => {
    if (t.tree) t.tree.age += 1;
  });
  if (s.debt > 0) {
    const due = Math.max(1, Math.round(s.debt * interestRate(s)));
    s.debt += due;
    lines.push(`Interest adds $${due}. The note stands at $${s.debt}.`);
  }
  if (s.activeHeirlooms.includes("mothers-seed-tin")) {
    s.seeds.beans += 2;
    lines.push("Two handfuls of beans leave your mother's tin.");
  }
  if (s.activeHeirlooms.includes("war-bond")) {
    addMoney(s, 12);
    lines.push("The war bond pays $12.");
  }
  if (s.remittance > 0) {
    addMoney(s, s.remittance);
    lines.push(`A letter from the city holds $${s.remittance}.`);
  }
  if (s.spouseId && s.children.length < 3 && s.year - s.spouseSince >= 1) {
    const force = s.flags.ensureChild === true && s.children.length < 2;
    const first = s.children.length === 0;
    if (force || first || Math.random() < 0.4) {
      const child = makeChild(s);
      s.children.push(child);
      lines.push(`${child.name} is born. The house learns a new name.`);
      memory(s, `${child.name} born in ${s.year}.`);
    }
  }
  if (s.year === 1950) lines.push("The decade turns. Iron is coming down the town road.");
  lines.push(...collectGrants(s));
  lines.push(eraBlurb(s.year));
  return lines;
}

function collectGrants(s: GameState): string[] {
  const lines: string[] = [];
  if (countTrees(s).total >= 4 && grantHeirloom(s, "orchard-letter")) lines.push("You write the orchard down, like a relative.");
  if (s.children.some((c) => c.attention >= 8) && grantHeirloom(s, "childs-drawing")) {
    lines.push("A drawing of the house appears on the nail by the door.");
  }
  if (s.year >= 1934 && !s.soldParcels.includes("east") && grantHeirloom(s, "steadfast-deed")) {
    lines.push("The east acre is still yours. That endurance is worth keeping in the box.");
  }
  return lines;
}

function makeChild(s: GameState, traits?: Record<Trait, number>, name?: string) {
  const used = new Set([...s.children.map((c) => c.name), ...s.kin.map((k) => k.name), s.playerName]);
  const picked = name ?? CHILD_NAMES.find((n) => !used.has(n)) ?? `Robin ${s.nextId}`;
  return {
    id: `c${s.nextId++}`,
    name: picked,
    bornYear: s.year,
    coat: COATS[s.nextId % COATS.length]!,
    traits: traits ? { ...traits } : emptyTraits(),
    attention: 1,
    leftForCity: false,
    askedCity: false,
  };
}

export function enqueueSeasonEvents(s: GameState): void {
  const ready = EVENTS.filter((e) => {
    if (e.once && s.seenEvents.includes(e.id)) return false;
    if (s.queue.includes(e.id) || s.pendingEvent === e.id) return false;
    return e.test(s);
  });
  const stories = ready.filter((e) => e.priority >= 90).sort((a, b) => a.priority - b.priority);
  if (stories.length) {
    for (const e of stories) s.queue.push(e.id);
    return;
  }
  const family = ready.find((e) => e.id === "family-time");
  if (family) {
    s.queue.push(family.id);
    return;
  }
  const ambient = ready.filter((e) => e.priority < 90 && Math.random() < e.chance);
  if (!ambient.length) return;
  ambient.sort((a, b) => b.priority - a.priority);
  s.queue.push(ambient[0]!.id);
}

export function showNextEvent(s: GameState): void {
  if (s.pendingEvent) return;
  const id = s.queue.shift();
  if (!id) return;
  s.pendingEvent = id;
  const ev = getEvent(id);
  if (ev?.once && !s.seenEvents.includes(id)) s.seenEvents.push(id);
}

export function resolveChoice(s: GameState, index: number): import("./types").ChoiceOutcome {
  const id = s.pendingEvent;
  const ev = id ? getEvent(id) : undefined;
  if (!ev) return { text: "The moment passes." };
  const choices = ev.choices(s);
  const choice = choices[index] ?? choices[0];
  if (!choice) return { text: "Nothing to decide." };
  const outcome = choice.apply(s);
  s.flags[`last:${ev.id}`] = s.year;
  s.pendingEvent = null;
  logLine(s, outcome.text);
  if (outcome.final) s.finalSuccession = true;
  if (outcome.forced) s.successionForced = true;
  if (outcome.succession) s.resumeScreen = "succession";
  for (const line of collectGrants(s)) logLine(s, line);
  recomputeEnergy(s);
  return outcome;
}

export function openFamilyEvent(s: GameState): boolean {
  const ev = getEvent("family-time");
  if (!ev || !ev.test(s)) return false;
  s.pendingEvent = "family-time";
  return true;
}

export function applyTalk(s: GameState, actorKey: string, effect: TalkEffect): ActionResult {
  if (effect.type === "leave") return { ok: true };
  const actor = actors(s).find((a) => a.key === actorKey);
  if (!actor) return fail("They've stepped away.");
  if (effect.type === "attend") {
    const child = s.children.find((c) => actorKey === `child:${c.id}`);
    if (!child) return fail("The yard is empty.");
    const flag = `attend:${child.id}:${s.stats.days}`;
    if (s.flags[flag]) return { ok: true, toast: `${child.name} is busy with a bug.` };
    s.flags[flag] = true;
    child.attention += 1;
    markTutorial(s, "talk");
    return finishTutorial(s, { ok: true, toast: `${child.name} leans into you for a minute.`, sfx: "ui" });
  }
  if (effect.type === "elder") return { ok: true, toast: "You listen. It costs nothing and is not nothing.", sfx: "ui" };
  if (effect.type === "kin") {
    s.energy = clamp(s.energy + 6, 0, s.maxEnergy);
    return { ok: true, toast: `${actor.name} watches the lane. You breathe.`, sfx: "ui" };
  }
  const npc = s.npcs.find((n) => actorKey === `npc:${n.id}`);
  if (!npc) return fail("They've gone in.");
  if (effect.type === "chat") return chat(s, npc);
  if (effect.type === "gift") return gift(s, npc);
  if (effect.type === "propose") return propose(s, npc);
  if (effect.type === "together") {
    if (s.flags.togetherDay === s.stats.days) return { ok: true, toast: "You already spent the morning shoulder to shoulder." };
    s.flags.togetherDay = s.stats.days;
    s.energy = clamp(s.energy + 14, 0, s.maxEnergy);
    bumpNpc(s, npc.id, 2);
    return { ok: true, toast: "The work goes faster when someone hums.", sfx: "ui" };
  }
  return { ok: true };
}

function chat(s: GameState, npc: Npc): ActionResult {
  const repeat = s.talkedToday.includes(npc.id);
  const gain = repeat ? 3 : npc.role === "suitor" ? 12 : 7;
  if (!repeat) s.talkedToday.push(npc.id);
  bumpNpc(s, npc.id, gain);
  markTutorial(s, "talk");
  const word = repeat ? `${npc.name} has already given you the good part of the day.` : `${npc.name} stays a little longer in the conversation.`;
  return finishTutorial(s, { ok: true, toast: word, sfx: "ui" });
}

function gift(s: GameState, npc: Npc): ActionResult {
  const flag = `gift:${npc.id}:${seasonKey(s)}`;
  if (s.flags[flag]) return fail(`You already brought ${npc.name} a basket this season.`);
  const best = fullest(s);
  if (!best) return fail("You need at least 2 of something harvested.");
  if (best === "apple") s.apples -= 2;
  else s.harvest[best] -= 2;
  s.flags[flag] = true;
  bumpNpc(s, npc.id, 18);
  markTutorial(s, "talk");
  return finishTutorial(s, { ok: true, toast: `${npc.name} takes the basket like it matters.`, sfx: "coin" });
}

function fullest(s: GameState): CropId | "apple" | null {
  let best: CropId | "apple" | null = null;
  let n = 0;
  for (const id of CROP_ORDER) {
    if (s.harvest[id] > n) {
      best = id;
      n = s.harvest[id];
    }
  }
  if (s.apples > n) {
    best = "apple";
    n = s.apples;
  }
  return n >= 2 ? best : null;
}

function propose(s: GameState, npc: Npc): ActionResult {
  if (s.spouseId) return fail("You are already married.");
  if (npc.relation < 60) return fail(`${npc.name} is not ready to answer that.`);
  const text = marry(s, npc.id);
  return { ok: true, toast: text, sfx: "chime" };
}

export function marry(s: GameState, npcId: string): string {
  const npc = s.npcs.find((n) => n.id === npcId);
  if (!npc) return "There's no one by that name.";
  if (s.spouseId) return "The house is already a marriage.";
  s.spouseId = npc.id;
  s.spouseSince = s.year;
  npc.role = "spouse";
  npc.relation = Math.max(80, npc.relation);
  npc.homeX = 13;
  npc.homeY = 16;
  npc.x = 13;
  npc.y = 16;
  if (npc.family) bumpFamily(s, npc.family, 18);
  memory(s, `Married ${npc.name} in ${s.year}.`);
  logLine(s, `Married ${npc.name}.`);
  return `${npc.name} says yes. The walk home is a different length.`;
}

export interface ShopRow {
  id: string;
  label: string;
  hint: string;
  disabled?: boolean;
}

export function shopRows(s: GameState): ShopRow[] {
  const rows: ShopRow[] = [];
  for (const id of CROP_ORDER) {
    if (s.harvest[id] <= 0) continue;
    const p = sellPrice(s, id);
    rows.push({ id: `sell:${id}`, label: `Sell ${CROPS[id].name.toLowerCase()} ×${s.harvest[id]}`, hint: `$${p} each · $${p * s.harvest[id]}` });
  }
  if (s.apples > 0) {
    const p = sellPrice(s, "apple");
    rows.push({ id: "sell:apple", label: `Sell apples ×${s.apples}`, hint: `$${p} each · $${p * s.apples}` });
  }
  if (CROP_ORDER.some((id) => s.harvest[id] > 0) || s.apples > 0) {
    rows.push({ id: "sell:all", label: "Sell everything", hint: "Empty the wagon." });
  }
  for (const id of CROP_ORDER) {
    const cost = seedCost(s, id);
    rows.push({
      id: `buy:${id}`,
      label: `Buy ${CROPS[id].name.toLowerCase()} seed`,
      hint: `$${cost} · you have ${s.seeds[id]}`,
      disabled: s.money < cost,
    });
  }
  const sap = saplingCost(s);
  rows.push({
    id: "buy:sapling",
    label: "Buy apple sapling",
    hint: `$${sap} · a decade of shade, eventually`,
    disabled: s.money < sap,
  });
  rows.push({
    id: "buy:compost",
    label: "Buy compost",
    hint: `$6 · you have ${s.compost}`,
    disabled: s.money < 6,
  });
  if (!s.machines.plow) {
    rows.push({ id: "buy:plow", label: "Buy a horse plow", hint: "$55 · till three deep", disabled: s.money < 55 });
  }
  if (!s.machines.tractor && s.year >= 1950) {
    const price = tractorPrice(s);
    rows.push({
      id: "buy:tractor",
      label: "Buy the tractor",
      hint: `$${price} · tills and harvests in a square, sips fuel`,
      disabled: s.money < price,
    });
  }
  if (!s.machines.irrigation && s.year >= 1950) {
    rows.push({
      id: "buy:irrigation",
      label: "Buy a creek pump",
      hint: "$170 · waters garden, orchard, and creek bottom each morning",
      disabled: s.money < 170,
    });
  }
  if (s.debt > 0) {
    rows.push({ id: "pay:25", label: "Pay $25 on the note", hint: `Debt $${s.debt}`, disabled: s.money <= 0 });
    rows.push({ id: "pay:all", label: "Pay all you can", hint: `Debt $${s.debt}`, disabled: s.money <= 0 });
  }
  if (s.borrowedYear !== s.year && s.debt < 360) {
    rows.push({ id: "borrow", label: "Borrow $100 from the bank", hint: `Interest about ${Math.round(interestRate(s) * 100)}% each spring` });
  }
  return rows;
}

export function applyShop(s: GameState, id: string): ActionResult {
  if (id === "sell:all") {
    let total = 0;
    for (const crop of CROP_ORDER) total += sellAmount(s, crop, s.harvest[crop]);
    total += sellAmount(s, "apple", s.apples);
    if (!total) return fail("The wagon is empty.");
    markTutorial(s, "sell");
    return finishTutorial(s, { ok: true, toast: `The counter pays $${total}.`, sfx: "coin" });
  }
  if (id.startsWith("sell:")) {
    const crop = id.slice(5) as CropId | "apple";
    const have = crop === "apple" ? s.apples : s.harvest[crop];
    const total = sellAmount(s, crop, have);
    if (!total) return fail("Nothing of that to sell.");
    markTutorial(s, "sell");
    return finishTutorial(s, { ok: true, toast: `Sold for $${total}.`, sfx: "coin" });
  }
  if (id.startsWith("buy:")) {
    const item = id.slice(4);
    if (item === "sapling") {
      const cost = saplingCost(s);
      if (s.money < cost) return fail("Not enough in the jar.");
      s.money -= cost;
      s.saplings += 1;
      return { ok: true, toast: "A sapling, roots damp in burlap.", sfx: "coin" };
    }
    if (item === "compost") {
      if (s.money < 6) return fail("Not enough in the jar.");
      s.money -= 6;
      s.compost += 1;
      return { ok: true, toast: "Compost for tired ground.", sfx: "coin" };
    }
    if (item === "plow") {
      if (s.money < 55) return fail("The plow costs $55.");
      s.money -= 55;
      s.machines.plow = true;
      memory(s, `Bought a horse plow in ${s.year}.`);
      return { ok: true, toast: "The plow will throw three furrows for one sweat.", sfx: "coin" };
    }
    if (item === "tractor") {
      const price = tractorPrice(s);
      if (s.year < 1950) return fail("Nobody in the valley is selling one yet.");
      if (s.money < price) return fail(`The tractor is $${price}.`);
      s.money -= price;
      s.machines.tractor = true;
      grantHeirloom(s, "tractor-key");
      memory(s, `Bought a tractor in ${s.year}.`);
      return { ok: true, toast: "It coughs, then it stays running. The horses look unemployed.", sfx: "chime" };
    }
    if (item === "irrigation") {
      if (s.year < 1950) return fail("The pump arrives with the machine age.");
      if (s.money < 170) return fail("The pump is $170.");
      s.money -= 170;
      s.machines.irrigation = true;
      syncWorld(s);
      memory(s, `Put a pump on the creek in ${s.year}.`);
      return { ok: true, toast: "The pump sits by the creek and drinks diesel and arguments.", sfx: "chime" };
    }
    const crop = item as CropId;
    if (!CROPS[crop]) return fail("Nell squints at the order.");
    const cost = seedCost(s, crop);
    if (s.money < cost) return fail("Not enough in the jar.");
    s.money -= cost;
    s.seeds[crop] += 1;
    return { ok: true, toast: `${CROPS[crop].name} seed, one sack.`, sfx: "coin" };
  }
  if (id === "pay:25" || id === "pay:all") {
    const want = id === "pay:all" ? s.debt : 25;
    const paid = payDebt(s, want);
    if (!paid) return fail("Nothing to pay with.");
    return { ok: true, toast: `Paid $${paid}. The note is $${s.debt}.`, sfx: "coin" };
  }
  if (id === "borrow") {
    if (s.borrowedYear === s.year) return fail("The bank already obliged you this year.");
    s.borrowedYear = s.year;
    s.money += 100;
    s.debt += 100;
    memory(s, `Borrowed from the bank in ${s.year}.`);
    return { ok: true, toast: "A hundred dollars, and a longer memory at the bank.", sfx: "coin" };
  }
  return fail("The ledger doesn't have that line.");
}

function sellAmount(s: GameState, id: CropId | "apple", qty: number): number {
  if (qty <= 0) return 0;
  const price = sellPrice(s, id);
  const total = price * qty;
  if (id === "apple") s.apples = 0;
  else s.harvest[id] = 0;
  addMoney(s, total);
  if (s.families.voss.relation < 40) bumpFamily(s, "voss", 1);
  return total;
}

export function payDebt(s: GameState, amount: number): number {
  const paid = Math.max(0, Math.min(s.money, s.debt, Math.round(amount)));
  s.money -= paid;
  s.debt -= paid;
  if (paid > 0 && s.debt === 0) {
    grantHeirloom(s, "cancelled-note");
    memory(s, `Cleared the bank note in ${s.year}.`);
    logLine(s, "The note is cancelled.");
  }
  return paid;
}

export interface PassResult {
  stories: string[];
  epilogue: string[] | null;
  heirName: string;
}

export function passFarm(s: GameState, heirId: string, keepIds: string[]): PassResult {
  const heir = s.children.find((c) => c.id === heirId && !c.leftForCity) ?? null;
  const cousin = !heir;
  const heirName = heir ? `${heir.name} ${s.familyName}` : `Rowan ${s.familyName}`;
  const spouse = s.npcs.find((n) => n.id === s.spouseId);
  s.genRecords.push({
    generation: s.generation,
    name: `${s.playerName} ${s.familyName}`,
    coat: s.coat,
    startYear: s.stewardStart,
    endYear: s.year,
    spouse: spouse?.name ?? null,
    children: s.children.map((c) => ({
      name: c.name,
      traits: topTraits(c.traits).map((t) => TRAIT_LABEL[t]),
      heir: c.id === heir?.id,
      left: c.leftForCity,
    })),
    line: s.memories[0] ?? "Kept the ground.",
  });
  s.flags.closingHeir = heir ? heir.name : "Rowan";
  const ending = s.generation >= 3 || s.finalSuccession;
  if (ending) {
    s.epilogue = writeEpilogue(s);
    s.gameOver = true;
    s.resumeScreen = "epilogue";
    s.pendingEvent = null;
    s.queue = [];
    s.successionForced = false;
    return { stories: [], epilogue: s.epilogue, heirName };
  }

  const coat = heir?.coat ?? "indigo";
  const buffs = heir ? traitBuffs(heir.traits) : { greenThumb: false, frugal: true, restless: false, hotTempered: false };
  const age = heir ? Math.max(MAJORITY_AGE, childAge(s, heir)) : 18;
  const keep = keepIds.filter((id, i, arr) => HEIRLOOMS[id] && s.keptHeirlooms.includes(id) && arr.indexOf(id) === i).slice(0, 3);
  const partnerName = spouse?.name ?? null;
  s.elder = { name: s.playerName, partner: partnerName };
  s.kin = s.children
    .filter((c) => c.id !== heir?.id && !c.leftForCity)
    .slice(0, 2)
    .map((c) => ({
      id: c.id,
      name: c.name,
      coat: c.coat,
      note: `${c.name} stayed. ${topTraits(c.traits).map((t) => TRAIT_LABEL[t]).join(" and ") || "Steady hands."}`,
    }));

  if (s.year - s.dog.bornYear >= 12) {
    const old = s.dog.name;
    const next = DOG_NAMES.find((n) => n !== old) ?? "Pebble";
    s.dog = { name: next, bornYear: s.year };
    memory(s, `${old} was buried on the rise. ${next} took the porch.`);
  }

  for (const fam of Object.values(s.families)) fam.relation = clamp(Math.round(fam.relation * 0.78), -100, 100);
  if (spouse) renewSuitor(s, spouse);
  for (const n of s.npcs) {
    if (n.role === "suitor" && n.age >= 48) renewSuitor(s, n);
    else if (n.role === "suitor") {
      n.x = n.originX;
      n.y = n.originY;
      n.homeX = n.originX;
      n.homeY = n.originY;
    }
  }

  s.playerName = heir?.name ?? "Rowan";
  s.coat = coat;
  s.age = age;
  s.buffs = buffs;
  s.generation += 1;
  s.stewardStart = s.year;
  s.spouseId = null;
  s.spouseSince = 0;
  s.children = [];
  s.activeHeirlooms = keep;
  s.maxEnergyPenalty = 0;
  s.player.x = START.x;
  s.player.y = START.y;
  s.player.facing = "s";
  s.minutes = 30;
  s.season = "spring";
  s.day = 1;
  s.weather = "clear";
  s.talkedToday = [];
  s.familyTimeKey = "";
  s.pendingEvent = null;
  s.queue = [];
  s.successionForced = false;
  s.finalSuccession = false;
  s.resumeScreen = "stories";
  delete s.flags.deferRetire;
  delete s.flags.droughtLock;
  eachTile(s, (t) => {
    t.crop = null;
  });
  if (buffs.hotTempered) {
    bumpFamily(s, "harrow", -5);
    bumpFamily(s, "voss", -5);
    bumpFamily(s, "pike", -5);
  }
  if (keep.includes("fathers-ring")) {
    for (const n of s.npcs) if (n.role === "suitor") n.relation = clamp(n.relation + 12, 0, 100);
  }
  if (keep.includes("steadfast-deed")) {
    eachTile(s, (t) => {
      if (t.parcel && !s.soldParcels.includes(t.parcel)) t.soil = clamp(t.soil + 8, 0, 100);
    });
  }
  if (keep.includes("iou-harrow")) bumpFamily(s, "harrow", 20);
  if (keep.includes("iou-voss")) bumpFamily(s, "voss", 20);
  if (keep.includes("iou-pike")) bumpFamily(s, "pike", 20);
  recomputeEnergy(s);
  s.energy = s.maxEnergy;
  syncWorld(s);
  const stories = keep.map((id) => HEIRLOOMS[id]!.story);
  if (cousin) stories.unshift(`No child was ready. Rowan ${s.familyName}, a cousin with a cardboard suitcase, takes the spare room and the morning chores.`);
  stories.unshift(`${s.year}. ${s.playerName} ${s.familyName}, ${s.age}, opens the door on a farm already mid-sentence.`);
  s.pendingStories = stories;
  logLine(s, `${s.playerName} takes the keys.`);
  memory(s, `${heirName} took the farm in ${s.year}.`);
  return { stories, epilogue: null, heirName: s.playerName };
}

function renewSuitor(s: GameState, n: Npc): void {
  const pool = NEXT_SUITOR[n.id] ?? [n.name];
  const used = new Set(s.npcs.map((p) => p.name));
  n.name = pool.find((p) => !used.has(p)) ?? pool[0]!;
  n.age = 23;
  n.role = "suitor";
  n.x = n.originX;
  n.y = n.originY;
  n.homeX = n.originX;
  n.homeY = n.originY;
  const fam = n.family ? s.families[n.family].relation : 0;
  n.relation = clamp(Math.round(fam / 3) + 8, 0, 34);
  n.blurb = `Next in line where ${n.family ? s.families[n.family].name : "the town"} expects a face.`;
}

export function debugAdvanceYear(s: GameState, opts?: { ensureChild?: boolean }): ActionResult {
  if (opts?.ensureChild) s.flags.ensureChild = true;
  let pulled = 0;
  eachTile(s, (t, x, y) => {
    if (t.crop && t.crop.prog >= CROPS[t.crop.id].growDays) {
      pulled += harvestCropTile(s, x, y);
      return;
    }
    if (t.crop) t.crop = null;
  });
  const lines = [...applyFallow(s), ...onNewYear(s)];
  if (pulled) lines.unshift(`The skipped year still brought in ${pulled} from what was ripe.`);
  delete s.flags.ensureChild;
  s.day = 1;
  s.minutes = 20;
  wakeParts(s);
  enqueueSeasonEvents(s);
  showNextEvent(s);
  lines.push(morningBlurb(s));
  return { ok: true, sfx: "night", summary: { title: `A year turns — ${s.year}`, lines } };
}

function wakeParts(s: GameState): void {
  s.energy = s.maxEnergy;
  s.talkedToday = [];
  s.weather = rollWeather(s);
  s.player.x = START.x;
  s.player.y = START.y;
  s.player.facing = "s";
  syncWorld(s);
}

export function debugPrepareSuccession(s: GameState): void {
  const target = s.generation <= 1 ? Math.max(s.year, 1941) : Math.max(s.year, s.stewardStart + 16);
  s.year = target;
  s.season = "spring";
  s.day = 1;
  if (!s.spouseId) {
    const suitor = s.npcs.find((n) => n.role === "suitor");
    if (suitor) marry(s, suitor.id);
  }
  const namePair = [
    ["Ada", "Miles"],
    ["June", "Otto"],
    ["Willa", "Silas"],
  ][Math.min(2, Math.max(0, s.generation - 1))] ?? ["Fern", "Ned"];
  if (!s.children.some((c) => !c.leftForCity)) {
    s.children.push(
      makeChild(s, { greenThumb: 8, frugal: 3, restless: 1, hotTempered: 0 }, namePair[0]),
      makeChild(s, { greenThumb: 1, frugal: 4, restless: 8, hotTempered: 6 }, namePair[1]),
    );
  }
  const kids = s.children.filter((c) => !c.leftForCity);
  if (kids[0]) {
    kids[0].bornYear = s.year - 16;
    kids[0].traits = { greenThumb: 8, frugal: 3, restless: 1, hotTempered: 0 };
    kids[0].attention = 9;
    kids[0].leftForCity = false;
  }
  if (kids[1]) {
    kids[1].bornYear = s.year - 11;
    kids[1].traits = { greenThumb: 1, frugal: 4, restless: 8, hotTempered: 6 };
    kids[1].attention = 5;
  }
  s.age = Math.max(s.age, 40);
  if (s.year - s.stewardStart < 16) s.stewardStart = s.year - 16;
  if (s.debt < 40) s.debt = 80;
  const plot = tileAt(s, 12, 8);
  if (!plot.tree && plot.parcel === "orchard") {
    plot.tree = { kind: "apple", age: 6, fruit: true };
    plot.solid = true;
    s.stats.treesPlanted = Math.max(s.stats.treesPlanted, 1);
  }
  grantHeirloom(s, "childs-drawing");
  s.finalSuccession = false;
  s.successionForced = false;
  syncWorld(s);
  logLine(s, "The years gather themselves for a handing-over.");
}

export function debugForceEvent(s: GameState): string {
  const prefer = ["welcome-pie", "drought", "sell-east", "depression", "fair", "tractor-age"];
  const id = prefer.find((candidate) => getEvent(candidate) && (candidate === "drought" || !s.seenEvents.includes(candidate))) ?? "drought";
  s.pendingEvent = id;
  return id;
}

export function debugToEpilogue(s: GameState): string[] {
  const years = [1941, 1958, 1975];
  let guard = 0;
  while (!s.gameOver && guard++ < 5) {
    s.year = years[Math.min(s.generation, 3) - 1] ?? 1975;
    if (s.generation >= 3) s.finalSuccession = true;
    debugPrepareSuccession(s);
    s.year = years[Math.min(s.generation, 3) - 1] ?? 1975;
    const heir = s.children.find((c) => !c.leftForCity);
    passFarm(s, heir?.id ?? "cousin", s.keptHeirlooms.slice(0, 3));
  }
  return s.epilogue ?? writeEpilogue(s);
}

export function farmSummary(s: GameState): { soil: number; trees: number; acres: string } {
  const tiles = countOwnedTiles(s);
  return {
    soil: averageSoil(s),
    trees: countTrees(s).total,
    acres: tiles,
  };
}

function countOwnedTiles(s: GameState): string {
  const names: ParcelId[] = ["garden", "west", "orchard", "creek", "east"];
  const kept = names.filter((id) => !s.soldParcels.includes(id));
  return kept.join(", ");
}

export function coatColors(coat: Coat): { shirt: string; pants: string; hat: string } {
  return COAT_HEX[coat] ?? COAT_HEX.russet!;
}

export function soilAt(s: GameState, x: number, y: number): number {
  if (!inBounds(x, y)) return 0;
  return tileAt(s, x, y).soil;
}
