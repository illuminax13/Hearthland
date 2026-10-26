import { relationWord, seasonName } from "./content";
import { facingOf } from "./grid";
import type { GameState, Npc } from "./types";
import { actorAt, type Actor } from "./world";

export type TalkEffect =
  | { type: "leave" }
  | { type: "chat" }
  | { type: "gift" }
  | { type: "propose" }
  | { type: "together" }
  | { type: "attend" }
  | { type: "elder" }
  | { type: "kin" };

export interface TalkChoice {
  label: string;
  hint: string;
  effect: TalkEffect;
}

export interface TalkModel {
  actorKey: string;
  name: string;
  kicker: string;
  text: string;
  choices: TalkChoice[];
}

function leave(): TalkChoice {
  return { label: "Leave them to the day", hint: "Back to the lane.", effect: { type: "leave" } };
}

export function talkModel(s: GameState, actor: Actor): TalkModel {
  if (actor.kind === "child") {
    const child = s.children.find((c) => actor.key === `child:${c.id}`);
    const age = child ? s.year - child.bornYear : 0;
    return {
      actorKey: actor.key,
      name: actor.name,
      kicker: `Age ${age}`,
      text: childLine(s, actor.name, age),
      choices: [
        { label: "Stay a minute", hint: "Attention rises a little, once today.", effect: { type: "attend" } },
        leave(),
      ],
    };
  }
  if (actor.kind === "elder") {
    return {
      actorKey: actor.key,
      name: actor.name,
      kicker: "Retired",
      text: `${actor.name} pats the chair. "${s.elder?.partner ? s.elder.partner + " says you're doing it the hard way. I say the hard way is how this place stayed a farm." : "Don't sell the rise. I know you know. I'm saying it so the porch hears it."}"`,
      choices: [
        { label: "Listen", hint: "They've earned the minute.", effect: { type: "elder" } },
        leave(),
      ],
    };
  }
  if (actor.kind === "kin") {
    return {
      actorKey: actor.key,
      name: actor.name,
      kicker: "Kin",
      text: `${actor.name} leans on a post. "${actor.blurb}"`,
      choices: [
        { label: "Ask them to watch the lane", hint: "A small kindness, returned.", effect: { type: "kin" } },
        leave(),
      ],
    };
  }
  const npc = s.npcs.find((n) => actor.key === `npc:${n.id}`);
  if (!npc) {
    return { actorKey: actor.key, name: actor.name, kicker: "", text: actor.blurb, choices: [leave()] };
  }
  return npcTalk(s, npc, actor.key);
}

function childLine(s: GameState, name: string, age: number): string {
  if (age < 8) return `${name} shows you a beetle with the seriousness of a banker.`;
  if (s.season === "winter") return `${name} wants a story in which the farm wins. You own several. Not all of them are true.`;
  if (s.debt > 100) return `${name} has learned to read the jar. They don't like the number.`;
  return `${name} asks if the trees were here before the house. You tell the truth: some of them will be here after.`;
}

function npcTalk(s: GameState, npc: Npc, key: string): TalkModel {
  const kicker = `${relationWord(npc.relation)} · ${npc.family ? npc.family : "town"}`;
  const married = s.spouseId === npc.id;
  const text = lineFor(s, npc, married);
  const choices: TalkChoice[] = [];
  if (married) {
    choices.push({
      label: "Work the rest of the morning together",
      hint: "Once a day. Restores a little energy.",
      effect: { type: "together" },
    });
  } else if (npc.role === "suitor" && !s.spouseId) {
    choices.push({ label: "Talk a while", hint: "Closer, if you haven't already today.", effect: { type: "chat" } });
    choices.push({
      label: "Offer a basket",
      hint: "Costs 2 of your fullest crop. A faster way to be known.",
      effect: { type: "gift" },
    });
    if (npc.relation >= 60) {
      choices.push({
        label: "Ask to build a life here",
        hint: "Marriage. Children become possible. The house changes.",
        effect: { type: "propose" },
      });
    }
  } else {
    choices.push({ label: "Talk a while", hint: "The family ledger notices.", effect: { type: "chat" } });
  }
  choices.push(leave());
  return { actorKey: key, name: npc.name, kicker, text, choices };
}

function lineFor(s: GameState, npc: Npc, married: boolean): string {
  const season = seasonName(s.season).toLowerCase();
  if (married) {
    if (s.children.length === 0) return `"House is quieter than it will be," ${npc.name} says. "We should fix that before the ${season} is gone, or not. The lane doesn't set the clock."`;
    if (s.debt > 0) return `${npc.name} taps the jar. "$${s.debt} still has our name on it. We can be frightened or we can be early. I'd like early."`;
    return `${npc.name} hands you a cup. "The ${season} looks like work. It also looks like ours."`;
  }
  if (s.spouseId && npc.role === "suitor") {
    return `${npc.name} smiles without making it your problem. "I heard the house is spoken for. Good. This town needs more kitchens with two coats by the door."`;
  }
  switch (npc.id) {
    case "cal":
      if (s.year >= 1950) return `"If you buy the tractor, don't let it make you mean," Cal says. "Machines don't rest a field. You still have to."`;
      return `"Ground's ${s.weather === "drought" ? "thirsty" : "workable"} today," Cal says. He has dirt in the crease of his thumb and does not apologize for it.`;
    case "ruth":
      if (s.families.harrow.relation >= 40) return `Ruth squints at your hands. "You're doing it like your mother. That's either a blessing or a habit. I'll take it."`;
      if (s.families.harrow.relation <= -10) return `"Fence is in the right place," Ruth says. She does not offer pie.`;
      return `"You eating?" Ruth asks, which is her whole theology.`;
    case "mara":
      if (s.children.some((c) => !c.leftForCity && s.year - c.bornYear >= 6))
        return `"Send them to the schoolhouse when the rows allow," Mara says. "A farm can teach a child everything except how big the world argues."`;
      return `Mara has chalk on one cuff. "The ${season} term is short. Children grow on a faster calendar than wheat."`;
    case "ida":
      if (s.debt > 0) return `"Nell will be polite about the note," Ida says. "Polite is not the same as patient. Pay something before the spring interest, even if it's small."`;
      if (s.year >= 1930 && s.year <= 1933) return `"Don't bring me wheat and call it a plan," Ida says softly. "Bring me something a neighbor can boil."`;
      return `Ida glances at the board. "Prices are a weather of their own. Dress for them."`;
    case "nell":
      return `Nell taps the ledger. "Sell when you walk in, buy before you talk yourself into a tractor. ${s.money < 20 ? "And you are close to the bottom of the jar." : "Jar looks awake, at least."}"`;
    case "jonah":
      if (s.year >= 1950) return `"I can hear that tractor from the woodlot," Jonah says, delighted and a little betrayed that it might not be his. "Take me with you when you go to look."`;
      return `Jonah is oil up to the wrist from something that is not quite an engine yet. "Town's going to get smaller or the road's going to get shorter. I want the second one."`;
    case "harlan":
      if (s.families.pike.relation <= -20) return `Harlan looks past your shoulder. "Your name walks ahead of you. It isn't waving."`;
      if (s.stats.treesPlanted >= 3) return `"Those trees," Harlan says. It might be a compliment. He nods, which is the rest of it.`;
      return `"Woodlot's mine. Lane's everybody's. Don't mix them up."`;
    default:
      return npc.blurb;
  }
}

export function actorFromFacing(s: GameState): Actor | null {
  const f = facingOf(s);
  return actorAt(s, f.x, f.y);
}
