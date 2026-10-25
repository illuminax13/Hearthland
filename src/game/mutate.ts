import {
  CROPS,
  HEIRLOOMS,
  matureTreeAge,
  sellPrice,
  type CropDef,
} from "./content";
import { eachTile, tileAt } from "./grid";
import type { CropId, FamilyId, GameState, Tile } from "./types";
import { clamp } from "./util";
import { isFarmable } from "./world";

export function logLine(s: GameState, text: string): void {
  s.log.unshift(text);
  s.log = s.log.slice(0, 48);
}

export function memory(s: GameState, text: string): void {
  if (s.memories.includes(text)) return;
  s.memories.unshift(text);
  s.memories = s.memories.slice(0, 24);
}

export function bumpFamily(s: GameState, id: FamilyId, amount: number): void {
  const f = s.families[id];
  f.relation = clamp(f.relation + amount, -100, 100);
}

export function bumpNpc(s: GameState, id: string, amount: number): void {
  const n = s.npcs.find((p) => p.id === id);
  if (!n) return;
  n.relation = clamp(n.relation + amount, -100, 100);
  if (n.family) bumpFamily(s, n.family, Math.round(amount * 0.45));
}

export function addMoney(s: GameState, amount: number): void {
  s.money = Math.max(0, Math.round(s.money + amount));
  if (amount > 0) s.stats.earned += amount;
}

export function grantHeirloom(s: GameState, id: string): boolean {
  if (!HEIRLOOMS[id]) return false;
  if (s.keptHeirlooms.includes(id)) return false;
  s.keptHeirlooms.push(id);
  logLine(s, `The heirloom box gains ${HEIRLOOMS[id]!.name}.`);
  return true;
}

export function recomputeEnergy(s: GameState): void {
  let max = 100;
  if (s.buffs.restless) max += 15;
  if (s.activeHeirlooms.includes("childs-drawing")) max += 10;
  max -= s.maxEnergyPenalty;
  s.maxEnergy = Math.max(60, max);
  s.energy = clamp(s.energy, 0, s.maxEnergy);
}

export function yieldOf(s: GameState, tile: Tile, crop: CropDef): number {
  let y = crop.baseYield;
  if (tile.soil >= 75) y += 1;
  if (tile.soil < 45) y -= 1;
  if (tile.soil < 25) y -= 1;
  if (tile.crop && tile.crop.dry >= 2) y -= 1;
  if (s.buffs.greenThumb) y += 1;
  if (s.hybrid && (crop.id === "corn" || crop.id === "wheat")) y += 1;
  if (s.weather === "drought" && !s.activeHeirlooms.includes("dried-bouquet")) y -= 1;
  return Math.max(1, y);
}

export function appleYield(s: GameState, tile: Tile): number {
  let y = 3;
  if (tile.soil >= 70) y += 1;
  if (s.buffs.greenThumb) y += 1;
  if (s.activeHeirlooms.includes("orchard-letter")) y += 1;
  if (s.specialtyApple) y += 0;
  return y;
}

export function harvestCropTile(s: GameState, x: number, y: number, penalty = 0): number {
  const t = tileAt(s, x, y);
  if (!t.crop) return 0;
  const def = CROPS[t.crop.id];
  const amount = Math.max(1, yieldOf(s, t, def) - penalty);
  s.harvest[t.crop.id] += amount;
  s.stats.harvested += amount;
  let drain = def.soilDrain;
  if (s.hybrid && (def.id === "corn" || def.id === "wheat")) drain += 4;
  if (s.contract && def.id === "corn") drain += 4;
  t.soil = clamp(t.soil - drain + def.soilRestore, 0, 100);
  t.crop = null;
  return amount;
}

export function harvestAppleTile(s: GameState, x: number, y: number): number {
  const t = tileAt(s, x, y);
  if (!t.tree?.fruit) return 0;
  const amount = appleYield(s, t);
  s.apples += amount;
  s.stats.harvested += amount;
  t.tree.fruit = false;
  t.soil = clamp(t.soil - 1, 0, 100);
  return amount;
}

export function priceLabel(s: GameState, id: CropId | "apple"): string {
  return `$${sellPrice(s, id)}`;
}

export function treeReady(s: GameState, tile: Tile): boolean {
  return !!tile.tree && tile.tree.age >= matureTreeAge(s);
}

export function countTrees(s: GameState): { total: number; mature: number; fruit: number } {
  let total = 0;
  let mature = 0;
  let fruit = 0;
  eachTile(s, (t) => {
    if (!t.tree) return;
    total++;
    if (treeReady(s, t)) mature++;
    if (t.tree.fruit) fruit++;
  });
  return { total, mature, fruit };
}

export function farmableCount(s: GameState): number {
  let n = 0;
  eachTile(s, (t) => {
    if (isFarmable(s, t)) n++;
  });
  return n;
}

export function averageSoil(s: GameState): number {
  let sum = 0;
  let n = 0;
  eachTile(s, (t) => {
    if (!t.parcel || s.soldParcels.includes(t.parcel)) return;
    sum += t.soil;
    n++;
  });
  return n ? Math.round(sum / n) : 0;
}

export function spendEnergy(s: GameState, cost: number, minutes: number): boolean {
  const energyCost = s.buffs.hotTempered ? Math.max(1, cost - 1) : cost;
  if (s.energy < energyCost) return false;
  if (s.minutes >= 15.5 * 60 && cost > 2) return false;
  s.energy -= energyCost;
  s.minutes += minutes;
  return true;
}

export function tooDark(s: GameState): boolean {
  return s.minutes >= 15.5 * 60;
}

export function markTutorial<K extends keyof GameState["tutorial"]>(s: GameState, key: K): void {
  if (key === "rewarded") return;
  s.tutorial[key] = true as GameState["tutorial"][K];
}
