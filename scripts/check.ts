import { sellPrice } from "../src/game/content";
import { getEvent } from "../src/game/events";
import { tileAt } from "../src/game/grid";
import { eligibleChildren } from "../src/game/calendar";
import {
  createNewGame,
  debugAdvanceYear,
  debugToEpilogue,
  interact,
  marry,
  passFarm,
  resolveChoice,
  selectSeed,
  sleepThrough,
} from "../src/game/sim";
import { START } from "../src/game/world";

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

function drain(state: ReturnType<typeof createNewGame>, guard = 6): void {
  let left = guard;
  while (state.pendingEvent && left-- > 0) {
    const ev = getEvent(state.pendingEvent);
    if (!ev) throw new Error(`missing event ${state.pendingEvent}`);
    if (ev.id === "retirement" || ev.id === "century") return;
    const choices = ev.choices(state);
    const idx = choices.findIndex((c) => {
      const label = c.label.toLowerCase();
      return !["sell it", "take $", "sign for", "buy into", "let ", "keep every", "give them", "run them"].some((bad) =>
        label.includes(bad),
      );
    });
    resolveChoice(state, idx < 0 ? 0 : idx);
  }
}

const state = createNewGame({ given: "Ellis", family: "Whitaker", coat: "russet" });
assert(state.player.x === START.x && state.player.y === START.y, "start tile");
const garden = tileAt(state, START.x, START.y + 1);
assert(garden.parcel === "garden", "door faces the garden");

selectSeed(state, "wheat");
const tilled = interact(state);
assert(tilled.ok, tilled.toast ?? "till failed");
assert(garden.tilled, "garden tilled");
const planted = interact(state);
assert(planted.ok && garden.crop?.id === "wheat", planted.toast ?? "plant failed");
const watered = interact(state);
assert(watered.ok && garden.crop?.watered, watered.toast ?? "water failed");

for (let i = 0; i < 5; i++) sleepThrough(state);
assert(state.season === "summer" && state.year === 1925, `expected first summer, got ${state.season} ${state.year}`);
assert(state.pendingEvent === "welcome-pie", `expected Ruth's pie, got ${state.pendingEvent}`);
resolveChoice(state, 0);
assert(!state.pendingEvent, "pie resolved");

const married = marry(state, "cal");
assert(state.spouseId === "cal", married);

const watched = tileAt(state, 12, 8);
watched.tree = { kind: "apple", age: 1, fruit: false };
watched.solid = true;
state.debt = 50;
state.money = 80;

let safety = 0;
while (safety++ < 30 && eligibleChildren(state).length === 0) {
  debugAdvanceYear(state, { ensureChild: true });
  if (state.pendingEvent === "retirement" || state.pendingEvent === "century") break;
  drain(state);
}
assert(state.children.length > 0, "a child should be born");
assert(eligibleChildren(state).length > 0, "an heir should come of age");
const heir = eligibleChildren(state)[0]!;
const heirName = heir.name;
const yearBefore = state.year;
const debtNow = state.debt;
const treeAge = tileAt(state, 12, 8).tree?.age ?? 0;
const result = passFarm(state, heir.id, ["mothers-seed-tin"]);
assert(!result.epilogue, "first succession should continue");
assert(state.generation === 2, "generation 2");
assert(state.playerName === heirName, "heir becomes the farmer");
assert(state.year === yearBefore, "succession stays in the same spring");
assert(state.debt === debtNow && state.debt > 0, "debt carries");
assert(tileAt(state, 12, 8).tree?.kind === "apple", "tree remains");
assert((tileAt(state, 12, 8).tree?.age ?? 0) === treeAge && treeAge > 1, "tree age persists");
assert(tileAt(state, START.x, START.y + 1).parcel === "garden", "garden remains");
assert(state.activeHeirlooms.includes("mothers-seed-tin"), "chosen heirloom is active");
assert(!state.spouseId, "the heir is not already married");

const early = sellPrice(state, "wheat");
state.year = 1931;
const depression = sellPrice(state, "wheat");
state.year = 1943;
const wartime = sellPrice(state, "wheat");
state.year = 1955;
const modern = sellPrice(state, "wheat");
assert(depression < early, `depression wheat ${depression} should be under ${early}`);
assert(wartime > depression, "war pays better than the crash");
assert(modern !== wartime, "the machine age reprices wheat");

const ending = createNewGame({ given: "Ellis", family: "Whitaker", coat: "moss" });
debugToEpilogue(ending);
assert(ending.gameOver && ending.epilogue && ending.epilogue.length >= 2, "epilogue reachable");
assert(ending.epilogue!.some((p) => p.includes("Whitaker")), "epilogue names the family");
assert(ending.genRecords.length >= 3, "three generations recorded");

console.log("Hearthland playthrough check passed.");
console.log(`Gen records: ${ending.genRecords.map((g) => g.name).join(" → ")}`);
console.log(ending.epilogue![0]);
