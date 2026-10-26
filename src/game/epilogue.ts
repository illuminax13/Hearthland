import { eraName, relationWord, TRAIT_LABEL } from "./content";
import { averageSoil, countTrees } from "./mutate";
import type { GameState } from "./types";

export function writeEpilogue(s: GameState): string[] {
  const name = s.familyName;
  const heir = typeof s.flags.closingHeir === "string" ? s.flags.closingHeir : "a cousin";
  const trees = countTrees(s);
  const soil = averageSoil(s);
  const sold = s.soldParcels.includes("east");
  const harrow = s.families.harrow.relation;
  const voss = s.families.voss.relation;
  const pike = s.families.pike.relation;
  const years = `${s.genRecords[0]?.startYear ?? 1925}–${s.year}`;

  const heads = s.genRecords
    .map((g) => {
      const kids = g.children.map((c) => c.name + (c.heir ? " (heir)" : c.left ? " (left)" : "")).join(", ");
      return `${g.name} (${g.startYear}–${g.endYear}${g.spouse ? `, with ${g.spouse}` : ""})${kids ? ` — children: ${kids}` : ""}`;
    })
    .join("; ");

  const memoryLine =
    s.memories.slice(0, 3).join(" ") ||
    "The town's stories about them are ordinary, which is a kind of survival.";

  const land = sold
    ? "The east acre left the family and, in time, grew a roof that sold coffee to the highway."
    : "The east acre is still under the name, which the town finds old-fashioned and, quietly, impressive.";

  const orchard =
    trees.total === 0
      ? "Nobody left an orchard. The rise grows grass and the future has to plant its own shade."
      : trees.mature > 0
        ? `${trees.total} apple ${trees.total === 1 ? "tree stands" : "trees stand"} on the rise, ${trees.mature} of them old enough to pay rent in fruit.`
        : `${trees.total} young apple ${trees.total === 1 ? "tree was" : "trees were"} left in trust, not yet keeping their promise.`;

  const debt =
    s.debt <= 0
      ? "The jar is clear of the bank."
      : `The bank still holds a note of $${s.debt}.`;

  const machine = s.machines.tractor
    ? "A tractor rusts politely by the barn, still the loudest thing the family ever agreed to."
    : s.machines.plow
      ? "The horse plow hangs in the barn, wood worn where a century of hands agreed."
      : "The tools on the wall are still mostly hand tools.";

  const pikeLine =
    pike <= -25
      ? `The Pikes call it a feud and will keep calling it that.`
      : pike >= 40
        ? `The Pikes, against their own habit, speak of the ${name}s as people who showed up.`
        : `The Pikes remain ${relationWord(pike)}, which is about as warm as that woodlot gets.`;

  const harrowLine =
    harrow >= 40
      ? `The Harrows still bring food when someone on the lane is sick.`
      : harrow <= -15
        ? `The Harrows nod and do not stop.`
        : `The Harrows are ${relationWord(harrow)}, a balance of pies and ordinary days.`;

  const vossLine =
    voss >= 30
      ? `At Voss's, the name still gets a better pencil.`
      : `Voss's ledger has the name in it, neither in red nor in legend.`;

  const contract = s.contract
    ? "For a while the place was a corn contract with a house attached. The soil took notes."
    : "It stayed a mixed farm, which fed fewer schemes and more suppers.";

  const record = heads ? `${heads}.` : "The records are thin.";
  const p1 = `From ${years}, the ${name} family kept a farm at the edge of Hearthland while the century changed its tools and its prices. ${record} When the book closes, ${heir} is the name people say will carry the keys past the page.`;

  const p2 = `${land} ${orchard} The ground averages ${soil} out of 100 — ${soil >= 70 ? "dark, rested enough to be a gift" : soil >= 45 ? "worked, still willing" : "tired, and honest about it"}. ${machine} ${debt} The jar holds $${s.money}. ${contract} What the town repeats most often: ${memoryLine}`;

  const p3 = `${harrowLine} ${vossLine} ${pikeLine} In the era they call ${eraName(s.year)}, the valley is louder than it was in 1925, but the lane to the farmhouse is the same mud. Travelers who ask about the ${name}s get a story about weather, a story about money, and, if they wait, a story about somebody who planted a thing they would not live to pick. The dog's descendants still believe the porch is theirs.`;

  return [p1, p2, p3];
}

export function traitPhrase(traits: string[]): string {
  if (!traits.length) return "steady";
  return traits
    .map((id) => TRAIT_LABEL[id as keyof typeof TRAIT_LABEL] ?? id)
    .join(", ");
}
