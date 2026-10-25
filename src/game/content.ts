import type { CropId, EraId, GameState, Season, Trait } from "./types";
import { CENTURY_END } from "./types";

export interface CropDef {
  id: CropId;
  name: string;
  seedPrice: number;
  basePrice: number;
  baseYield: number;
  growDays: number;
  soilDrain: number;
  soilRestore: number;
  seasons: Season[];
  depression: number;
  wartime: number;
  blurb: string;
}

export const CROPS: Record<CropId, CropDef> = {
  wheat: {
    id: "wheat",
    name: "Wheat",
    seedPrice: 2,
    basePrice: 3,
    baseYield: 3,
    growDays: 4,
    soilDrain: 8,
    soilRestore: 0,
    seasons: ["spring", "summer", "autumn"],
    depression: 0.45,
    wartime: 1.85,
    blurb: "The staple. Prices swing when the country does.",
  },
  potato: {
    id: "potato",
    name: "Potatoes",
    seedPrice: 1,
    basePrice: 2,
    baseYield: 4,
    growDays: 5,
    soilDrain: 5,
    soilRestore: 0,
    seasons: ["spring", "summer", "autumn"],
    depression: 0.95,
    wartime: 1.15,
    blurb: "Ugly, filling, and honest in a bad year.",
  },
  beans: {
    id: "beans",
    name: "Beans",
    seedPrice: 1,
    basePrice: 2,
    baseYield: 2,
    growDays: 3,
    soilDrain: 2,
    soilRestore: 10,
    seasons: ["spring", "summer"],
    depression: 1,
    wartime: 1.1,
    blurb: "They feed the soil as much as they feed you.",
  },
  corn: {
    id: "corn",
    name: "Corn",
    seedPrice: 2,
    basePrice: 4,
    baseYield: 4,
    growDays: 8,
    soilDrain: 14,
    soilRestore: 0,
    seasons: ["spring", "summer"],
    depression: 0.6,
    wartime: 1.35,
    blurb: "A long crop. Heavy on the ground, loud at market.",
  },
};

export const CROP_ORDER: CropId[] = ["wheat", "potato", "beans", "corn"];

export const TRAIT_LABEL: Record<Trait, string> = {
  greenThumb: "Green thumb",
  frugal: "Frugal",
  restless: "Restless",
  hotTempered: "Hot-tempered",
};

export const TRAIT_LINE: Record<Trait, string> = {
  greenThumb: "The soil answers when they kneel.",
  frugal: "They know the price of a sack of seed before they speak.",
  restless: "Their eyes are always a little past the fence.",
  hotTempered: "They love fiercely and do not like being told to wait.",
};

export const PARCEL_INFO: Record<string, { name: string; note: string }> = {
  garden: { name: "Kitchen garden", note: "Close to the door. The first ground you work." },
  west: { name: "West field", note: "Open acreage. A plow earns its keep here." },
  orchard: { name: "Orchard rise", note: "Trees outlive the person who plants them." },
  creek: { name: "Creek bottom", note: "Silt-rich, and the first to flood." },
  east: { name: "East acre", note: "The field the county keeps offering to buy." },
};

export interface HeirloomDef {
  id: string;
  name: string;
  blurb: string;
  story: string;
}

export const HEIRLOOMS: Record<string, HeirloomDef> = {
  "mothers-seed-tin": {
    id: "mothers-seed-tin",
    name: "Mother's seed tin",
    blurb: "Each spring it still yields a handful of beans.",
    story: "The tin is dented and labeled in a hand you know by heart. Two handfuls of beans rattle inside, same as every spring.",
  },
  "fathers-ring": {
    id: "fathers-ring",
    name: "Father's ring",
    blurb: "People in town are softer with the person who wears it.",
    story: "The band is thin from being resized. When you turn it, the town seems to remember your father stood in doorways and listened.",
  },
  "seed-catalogue": {
    id: "seed-catalogue",
    name: "1918 seed catalogue",
    blurb: "Margins full of soil notes. You can read the ground exactly.",
    story: "Waterstained pages, penciled numbers beside each field. Whoever kept it believed dirt had a memory. They were right.",
  },
  "orchard-letter": {
    id: "orchard-letter",
    name: "Letter from the orchard",
    blurb: "Apple trees bear sooner and heavier.",
    story: "A letter folded around a pressed blossom: 'Leave the good trees standing. They are a letter we wrote to people we will not meet.'",
  },
  "war-bond": {
    id: "war-bond",
    name: "War bond certificate",
    blurb: "Pays a small sum every spring.",
    story: "The certificate is foxed at the edges. Once a year the bank still honors it, as if the war had agreed to pay you back slowly.",
  },
  "iou-harrow": {
    id: "iou-harrow",
    name: "Harrow IOU",
    blurb: "The Harrows begin the next generation in your debt, kindly.",
    story: "Ruth's handwriting: 'We don't forget a bucket of water.' The paper smells like pie spice.",
  },
  "iou-voss": {
    id: "iou-voss",
    name: "Voss IOU",
    blurb: "The store ledger starts kinder.",
    story: "Nell stamps the note PAID in red and then, inexplicably, hands it back. 'Keep it. Ledgers get lonely.'",
  },
  "iou-pike": {
    id: "iou-pike",
    name: "Pike IOU",
    blurb: "Old Pike's family starts closer to even.",
    story: "Harlan doesn't do speeches. He leaves a split shingle with your name and the words 'square enough.'",
  },
  "childs-drawing": {
    id: "childs-drawing",
    name: "Child's drawing",
    blurb: "A lopsided house. You work a little longer without noticing.",
    story: "Crayon sun, too big. Everyone is smiling and the dog has too many legs. It lives on the nail by the door.",
  },
  "fair-ribbon": {
    id: "fair-ribbon",
    name: "County fair ribbon",
    blurb: "Buyers pay a little more for a Whitaker bushel.",
    story: "Blue ribbon, faded to the color of creek water. The town still says the name like it won something.",
  },
  "tractor-key": {
    id: "tractor-key",
    name: "Brass tractor key",
    blurb: "The machine sips no fuel money in your hands.",
    story: "The key is warm from a pocket. Whoever kept it knew which cough meant the engine would catch.",
  },
  "dried-bouquet": {
    id: "dried-bouquet",
    name: "Dried bouquet",
    blurb: "Drought does not bite your yields as hard.",
    story: "Hedge flowers from the year the creek failed. They crumble if you squeeze them. You don't.",
  },
  "steadfast-deed": {
    id: "steadfast-deed",
    name: "Steadfast deed",
    blurb: "The ground you refused to sell is richer for the next hands.",
    story: "The deed was never fancy. Keeping it was the fancy part. The east acre is still under your name, and the soil knows it.",
  },
  "cancelled-note": {
    id: "cancelled-note",
    name: "Cancelled bank note",
    blurb: "Interest sits lighter on this family.",
    story: "PAID is stamped so hard it nearly cuts the paper. The bank still remembers your people finished what they started.",
  },
  "city-letter": {
    id: "city-letter",
    name: "Letter from the city",
    blurb: "An envelope with a little money arrives each spring.",
    story: "The postmark changes. The handwriting doesn't. They did not stay, and they did not disappear.",
  },
};

export const CHILD_NAMES = [
  "Ada",
  "Samuel",
  "Ruth",
  "June",
  "Miles",
  "Nora",
  "Hugh",
  "Esther",
  "Willa",
  "Otto",
  "Leah",
  "Calvin",
  "Iris",
  "Ned",
  "Fern",
  "Mae",
  "Silas",
  "Joe",
] as const;

export const DOG_NAMES = ["Biscuit", "Pepper", "Moth", "Captain", "Pebble", "Sunday", "Cinder"] as const;

export const COAT_HEX: Record<string, { shirt: string; pants: string; hat: string }> = {
  russet: { shirt: "#a24b3a", pants: "#3e4250", hat: "#6b3a2a" },
  indigo: { shirt: "#3d4f79", pants: "#3a332c", hat: "#2c3348" },
  moss: { shirt: "#4e6a44", pants: "#3e3428", hat: "#5a4030" },
};

export function eraOf(year: number): EraId {
  return year >= 1950 ? "mechanization" : "depression";
}

export function eraName(year: number): string {
  return year >= 1950 ? "Iron & Asphalt" : "Horse & Hard Times";
}

export function eraBlurb(year: number): string {
  if (year < 1930) return "Horse work, thin margins, and a town that still knows your mother.";
  if (year <= 1933) return "The Depression has reached the valley. Wheat is nearly worthless. Potatoes are not.";
  if (year < 1942) return "The worst of the crash has eased. The fields still remember it.";
  if (year <= 1945) return "War prices lift wheat. The store radio never quite turns off.";
  if (year < 1950) return "The war is over. Machines are a rumor with a price tag.";
  if (year < 1960) return "Tractors, pumps, and hybrid seed. The ground can be asked for more than it wants to give.";
  if (year < CENTURY_END) return "The highway hums past the ridge. Children measure the town against elsewhere.";
  return "The century you were lent is closing its book.";
}

export function sellPrice(s: GameState, id: CropId | "apple"): number {
  if (id === "apple") {
    let p = 5;
    if (s.year >= 1950) p = 6;
    if (s.specialtyApple) p += 1;
    p *= vossMod(s);
    if (s.activeHeirlooms.includes("fair-ribbon")) p *= 1.1;
    return Math.max(1, Math.round(p));
  }
  const crop = CROPS[id];
  let p = crop.basePrice;
  if (eraOf(s.year) === "mechanization") {
    if (id === "wheat") p *= 0.85;
    if (id === "corn") p *= 1.05;
    if (id === "beans") p *= 1.15;
  }
  if (s.year >= 1930 && s.year <= 1933) p *= crop.depression;
  if (s.year >= 1942 && s.year <= 1945) p *= crop.wartime;
  if (s.contract && id === "corn") p *= 1.5;
  p *= vossMod(s);
  if (s.activeHeirlooms.includes("fair-ribbon")) p *= 1.1;
  return Math.max(1, Math.round(p));
}

function vossMod(s: GameState): number {
  const v = s.families.voss.relation;
  const clamped = Math.max(-40, Math.min(60, v));
  return 1 + clamped / 400;
}

export function seedCost(s: GameState, id: CropId): number {
  let p = CROPS[id].seedPrice;
  if (s.year >= 1930 && s.year <= 1933) p *= 0.85;
  if (eraOf(s.year) === "mechanization") p *= 1.15;
  if (s.buffs.frugal) p *= 0.85;
  if (s.hybrid && (id === "corn" || id === "wheat")) p += 1;
  return Math.max(1, Math.round(p));
}

export function saplingCost(s: GameState): number {
  return s.year >= 1950 ? 18 : 14;
}

export function interestRate(s: GameState): number {
  let r = s.year < 1950 ? 0.1 : 0.07;
  if (s.buffs.frugal) r *= 0.75;
  if (s.activeHeirlooms.includes("cancelled-note")) r *= 0.5;
  return r;
}

export function tractorPrice(s: GameState): number {
  return s.tractorDiscount ? 340 : 420;
}

export function matureTreeAge(s: GameState): number {
  return s.activeHeirlooms.includes("orchard-letter") ? 3 : 4;
}

export function soilWord(n: number): string {
  if (n >= 80) return "rich";
  if (n >= 60) return "sound";
  if (n >= 40) return "thin";
  if (n >= 20) return "tired";
  return "exhausted";
}

export function relationWord(n: number): string {
  if (n >= 80) return "devoted";
  if (n >= 55) return "close";
  if (n >= 30) return "friendly";
  if (n >= 10) return "acquainted";
  if (n >= -10) return "polite";
  if (n >= -30) return "cool";
  if (n >= -60) return "bitter";
  return "a feud";
}

export function seasonName(season: Season): string {
  return season.slice(0, 1).toUpperCase() + season.slice(1);
}

export function morningBlurb(s: GameState): string {
  const pool: string[] = [];
  if (s.weather === "rain") pool.push("Rain on the shingles. The rows can wait for the can.");
  if (s.weather === "storm") pool.push("The storm knocks the weather vane sideways and keeps walking.");
  if (s.weather === "snow") pool.push("Snow piles on the fence rails. The fields are off duty.");
  if (s.weather === "drought") pool.push("The sky is a hard blue. The creek sounds thinner.");
  if (s.weather === "clear" && s.season === "spring") pool.push("The frost has lifted. Mud takes the shape of your boots.");
  if (s.season === "summer" && s.weather === "clear") pool.push("Heat sits on the lane. Even the dog walks slower.");
  if (s.season === "autumn") pool.push("The light goes amber by midafternoon.");
  if (s.year >= 1930 && s.year <= 1933) pool.push("The paper says banks back east are still shuttered.");
  if (s.year >= 1942 && s.year <= 1945) pool.push("War news leaks out of the store radio under the static.");
  if (s.year >= 1950 && s.year < 1960) pool.push("Somebody on the town road is talking about horsepower that isn't a horse.");
  if (s.year >= 1965) pool.push("At night the new highway hums beyond the ridge.");
  if (s.spouseId) pool.push("The kettle is already on. Someone else lives here now.");
  if (!pool.length) pool.push("A plain morning. The work is still there.");
  const i = Math.abs(hashYear(s.year, s.season, s.day)) % pool.length;
  return pool[i]!;
}

function hashYear(year: number, season: string, day: number): number {
  return year * 13 + season.length * 7 + day * 3;
}

export function emptyTraits(): Record<Trait, number> {
  return { greenThumb: 0, frugal: 0, restless: 0, hotTempered: 0 };
}

export function topTraits(traits: Record<Trait, number>, n = 2): Trait[] {
  return (Object.keys(traits) as Trait[])
    .filter((k) => traits[k] > 0)
    .sort((a, b) => traits[b] - traits[a])
    .slice(0, n);
}

export function traitBuffs(traits: Record<Trait, number>): GameState["buffs"] {
  const entries = Object.entries(traits) as [Trait, number][];
  const max = Math.max(0, ...entries.map(([, v]) => v));
  return {
    greenThumb: traits.greenThumb >= 6 || (traits.greenThumb >= 4 && traits.greenThumb === max),
    frugal: traits.frugal >= 6 || (traits.frugal >= 4 && traits.frugal === max),
    restless: traits.restless >= 6 || (traits.restless >= 4 && traits.restless === max),
    hotTempered: traits.hotTempered >= 6 || (traits.hotTempered >= 4 && traits.hotTempered === max),
  };
}
