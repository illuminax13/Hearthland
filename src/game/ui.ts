import { eligibleChildren, retirementHard } from "./calendar";
import {
  CROPS,
  CROP_ORDER,
  eraBlurb,
  eraName,
  HEIRLOOMS,
  interestRate,
  PARCEL_INFO,
  relationWord,
  seasonName,
  TRAIT_LABEL,
  TRAIT_LINE,
  topTraits,
} from "./content";
import type { TalkModel } from "./dialogue";
import { getEvent } from "./events";
import { averageSoil, countTrees } from "./mutate";
import { farmSummary, hint, shopRows, tutorialLine } from "./sim";
import { drawPortrait } from "./render";
import type { Child, Coat, GameState } from "./types";
import { clockLabel, esc } from "./util";
import { actors, childAge, parcelAverages } from "./world";

export type Screen =
  | "title"
  | "new"
  | "help"
  | "play"
  | "summary"
  | "event"
  | "talk"
  | "shop"
  | "home"
  | "ledger"
  | "family"
  | "pause"
  | "succession"
  | "stories"
  | "epilogue";

export interface UiBag {
  screen: Screen;
  state: GameState | null;
  hasSave: boolean;
  summary: { title: string; lines: string[] } | null;
  talk: TalkModel | null;
  toast: string;
  heirId: string | null;
  keeps: string[];
  returnTo: Screen;
}

export function hudHtml(bag: UiBag): string {
  const s = bag.state;
  if (!s || bag.screen !== "play") return "";
  const energy = Math.max(0, Math.min(100, (s.energy / s.maxEnergy) * 100));
  const quest = tutorialLine(s);
  const seeds = CROP_ORDER.map((id) => {
    const on = s.selected === id ? " on" : "";
    return `<button class="${on}" data-act="seed:${id}">${CROPS[id].name}<small>×${s.seeds[id]}</small></button>`;
  }).join("");
  const sapOn = s.selected === "apple" ? " on" : "";
  return `
    <div class="hud-top">
      <div class="brand">
        <b>The ${esc(s.familyName)}s</b>
        <span>${esc(s.playerName)} · age ${s.age} · gen ${s.generation}</span><br />
        <span>${seasonName(s.season)} ${s.day}, ${s.year} · ${clockLabel(s.minutes)}</span><br />
        <span>${esc(eraName(s.year))}</span>
      </div>
      <div class="stats">
        <strong>$${s.money}</strong><br />
        <span>Debt $${s.debt}</span>
        <div class="energy" title="Energy"><i style="width:${energy}%"></i></div>
        <span>${s.weather} · ${s.energy}/${s.maxEnergy}</span>
      </div>
    </div>
    <div class="hud-bottom">
      <div class="hint">${esc(quest ?? hint(s))}</div>
      <div class="seeds">
        ${seeds}
        <button class="${sapOn}" data-act="seed:apple">Sapling<small>×${s.saplings}</small></button>
      </div>
      <div class="hud-actions">
        <button class="tiny" data-act="family">Family</button>
        <button class="tiny" data-act="ledger">Ledger</button>
        <button class="tiny" data-act="help">Help</button>
        <button class="tiny" data-act="pause">Menu</button>
      </div>
    </div>
    ${bag.toast ? `<div class="toast">${esc(bag.toast)}</div>` : ""}
  `;
}

export function overlayHtml(bag: UiBag): string {
  switch (bag.screen) {
    case "title":
      return title(bag);
    case "new":
      return newGame(bag);
    case "help":
      return help(bag);
    case "summary":
      return summary(bag);
    case "event":
      return eventCard(bag);
    case "talk":
      return talk(bag);
    case "shop":
      return shop(bag);
    case "home":
      return home(bag);
    case "ledger":
      return ledger(bag);
    case "family":
      return family(bag);
    case "pause":
      return pause(bag);
    case "succession":
      return succession(bag);
    case "stories":
      return stories(bag);
    case "epilogue":
      return epilogue(bag);
    default:
      return "";
  }
}

function sheet(inner: string, wide = false): string {
  return `<div class="sheet"><div class="panel${wide ? " wide" : ""}">${inner}</div></div>`;
}

function title(bag: UiBag): string {
  return sheet(`
    <p class="kicker">A generational farm</p>
    <h1>HEARTHLAND</h1>
    <p class="subtitle">One family. One farm. A century that keeps the receipts.</p>
    <p class="lede">It is 1925. The house is sound, the east acre is still in the name, and your mother's seed tin rattles when you pick it up. What you plant, spend, and forgive becomes the ground the next child inherits.</p>
    <div class="row">
      <button class="primary" data-act="new">New game</button>
      ${bag.hasSave ? `<button data-act="continue">Continue</button>` : ""}
      <button class="ghost" data-act="help">How to play</button>
    </div>
  `);
}

function newGame(bag: UiBag): string {
  return sheet(`
    <p class="kicker">Spring, 1925</p>
    <h2>Whose name goes on the deed?</h2>
    <p>You start at 24, with a garden, four fields, a sapling, and not much money. The town already has opinions.</p>
    ${bag.hasSave ? `<p class="muted">Starting over replaces the family saved in this browser.</p>` : ""}
    <label for="given">Your name</label>
    <input id="given" type="text" maxlength="18" value="Ellis" />
    <label for="family">Family name</label>
    <input id="family" type="text" maxlength="18" value="Whitaker" />
    <label>Coat</label>
    <div class="coats">
      <button type="button" data-act="coat:russet" title="Russet"><i class="swatch" style="background:#a24b3a"></i></button>
      <button type="button" data-act="coat:indigo" title="Indigo"><i class="swatch" style="background:#3d4f79"></i></button>
      <button type="button" data-act="coat:moss" title="Moss"><i class="swatch" style="background:#4e6a44"></i></button>
    </div>
    <p id="coat-label">Coat: russet</p>
    <div class="row">
      <button class="primary" data-act="begin">Take the keys</button>
      <button data-act="title">Back</button>
    </div>
  `);
}

function help(bag: UiBag): string {
  const back = bag.state ? "close" : "title";
  return sheet(`
    <p class="kicker">Field notes</p>
    <h2>How a day works</h2>
    <p>Walk the farm. Face a tile and press Use — the E key, or the round button on a phone. The hint at the bottom tells you what Use will do. Energy and daylight both run out; sleep in the farmhouse to put the day away.</p>
    <div class="help-keys">
      <b>WASD / arrows</b><span>Walk</span>
      <b>Pad</b><span>Walk, on a touch screen</span>
      <b>E / Space / Use</b><span>Use what you're facing</span>
      <b>1–4</b><span>Wheat, potatoes, beans, corn</span>
      <b>5</b><span>Apple sapling</span>
      <b>C / Compost</b><span>Spread compost on the faced tile</span>
      <b>H</b><span>This page</span>
      <b>L / K</b><span>Ledger / family</span>
      <b>Esc / Menu</b><span>Menu, or close a panel</span>
      <b>M</b><span>Mute the valley</span>
      <b>F</b><span>Debug: skip one year</span>
      <b>G</b><span>Debug: gather an heir and open succession</span>
      <b>V</b><span>Debug: force an event card</span>
      <b>0</b><span>Debug: jump to the end of the century</span>
    </div>
    <hr class="rule" />
    <p>Soil tires if you take from it and don't rest it or plant beans. Apple trees need years. Debts, neighbors, and the box under the bed all survive a funeral or a retirement. In 1950 the prices, the machines, and the town's arguments change — not just the paint.</p>
    <div class="row sticky-actions"><button class="primary" data-act="${back}">${bag.state ? "Back to the farm" : "Back"}</button></div>
  `);
}

function summary(bag: UiBag): string {
  const lines = bag.summary?.lines ?? [];
  return sheet(`
    <p class="kicker">Morning</p>
    <h2>${esc(bag.summary?.title ?? "A new day")}</h2>
    <ul class="clean">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    <div class="row sticky-actions"><button class="primary" data-act="close">Begin the day</button></div>
  `);
}

function eventCard(bag: UiBag): string {
  const s = bag.state;
  const ev = s?.pendingEvent ? getEvent(s.pendingEvent) : undefined;
  if (!s || !ev) return "";
  const choices = ev.choices(s);
  return sheet(`
    <p class="kicker">${s.year} · ${seasonName(s.season)}</p>
    <h2>${esc(ev.title)}</h2>
    <p class="lede">${esc(ev.body(s))}</p>
    ${choices
      .map(
        (c, i) =>
          `<button class="choice" data-act="event:${i}">${esc(c.label)}<small>${esc(c.hint)}</small></button>`,
      )
      .join("")}
  `);
}

function talk(bag: UiBag): string {
  const t = bag.talk;
  if (!t) return "";
  return sheet(`
    <div class="person">
      <canvas class="bust" data-bust="${esc(t.actorKey)}" width="64" height="64"></canvas>
      <div>
        <p class="kicker">${esc(t.kicker)}</p>
        <h2>${esc(t.name)}</h2>
      </div>
    </div>
    <p class="lede">${esc(t.text)}</p>
    ${t.choices
      .map(
        (c, i) =>
          `<button class="choice" data-act="talk:${i}">${esc(c.label)}<small>${esc(c.hint)}</small></button>`,
      )
      .join("")}
  `);
}

function shop(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const rows = shopRows(s);
  return sheet(`
    <p class="kicker">Voss's</p>
    <h2>The counter</h2>
    <p>Jar $${s.money}. Note $${s.debt}. Interest this spring would be ${Math.round(interestRate(s) * 100)}%.</p>
    ${rows
      .map(
        (r) =>
          `<button class="choice" data-act="shop:${esc(r.id)}" ${r.disabled ? "disabled" : ""}>${esc(r.label)}<small>${esc(r.hint)}</small></button>`,
      )
      .join("")}
    <div class="row sticky-actions"><button data-act="close">Leave the store</button></div>
  `);
}

function home(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const early = s.minutes < 4 * 60;
  return sheet(`
    <p class="kicker">The farmhouse</p>
    <h2>${esc(s.playerName)}'s kitchen</h2>
    <p>${early ? "The day is barely started. Sleeping now spends it." : "The stove is a good argument for ending the day."} ${esc(s.dog.name)} is already on the rug.</p>
    <div class="row sticky-actions">
      <button class="primary" data-act="sleep">Sleep until morning</button>
      <button data-act="family">Family</button>
      <button data-act="ledger">Ledger</button>
      <button data-act="close">Back outside</button>
    </div>
  `);
}

function ledger(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const parts = parcelAverages(s)
    .map((p) => {
      const info = PARCEL_INFO[p.id];
      const sold = s.soldParcels.includes(p.id);
      return `<div class="card"><b>${esc(info?.name ?? p.id)}</b><br />${sold ? "Sold." : `Soil ${p.avg} across ${p.tiles} tiles.`}<br /><span class="muted">${esc(info?.note ?? "")}</span></div>`;
    })
    .join("");
  const machines = [
    s.machines.plow ? "Horse plow" : null,
    s.machines.tractor ? "Tractor" : null,
    s.machines.irrigation ? "Creek pump" : null,
  ].filter(Boolean);
  const trees = countTrees(s);
  return sheet(`
    <p class="kicker">${esc(eraName(s.year))}</p>
    <h2>Ledger</h2>
    <p>${esc(eraBlurb(s.year))}</p>
    <p>Soil average ${averageSoil(s)}. Apple trees ${trees.total}, bearing age ${trees.mature}. Harvested, lifetime: ${s.stats.harvested}. Earned: $${s.stats.earned}.</p>
    <div class="grid-2">${parts}</div>
    <p>Machines: ${machines.length ? esc(machines.join(", ")) : "Hands, and a hoe."} ${s.contract ? "A corn contract is in the drawer." : ""} ${s.hybrid ? "Hybrid seed is in the bin." : ""}</p>
    <p>Harrows ${s.families.harrow.relation} (${relationWord(s.families.harrow.relation)}). Vosses ${s.families.voss.relation} (${relationWord(s.families.voss.relation)}). Pikes ${s.families.pike.relation} (${relationWord(s.families.pike.relation)}).</p>
    <h3>Remembered</h3>
    <ul class="clean">${s.memories.slice(0, 6).map((m) => `<li>${esc(m)}</li>`).join("") || "<li>Nothing written yet.</li>"}</ul>
    <h3>Recent</h3>
    <ul class="log">${s.log.slice(0, 8).map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
    <div class="row sticky-actions"><button class="primary" data-act="close">Close</button></div>
  `, true);
}

function family(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const spouse = s.npcs.find((n) => n.id === s.spouseId);
  const kids = s.children
    .map((c) => childCard(s, c))
    .join("");
  const canFamily = !!getEvent("family-time")?.test(s);
  return sheet(`
    <p class="kicker">Household</p>
    <h2>${esc(s.playerName)} ${esc(s.familyName)}</h2>
    <p>${spouse ? `Married to ${esc(spouse.name)} since ${s.spouseSince}.` : "Unmarried. The lane has a few people who might change that."} Dog: ${esc(s.dog.name)}. ${s.elder ? `${esc(s.elder.name)} keeps the porch.` : ""}</p>
    ${kids || "<p>No children yet. A marriage and a few springs will see to that.</p>"}
    <h3>In the box</h3>
    <ul class="clean">${s.keptHeirlooms.map((id) => `<li><b>${esc(HEIRLOOMS[id]?.name ?? id)}</b> — ${esc(HEIRLOOMS[id]?.blurb ?? "")}${s.activeHeirlooms.includes(id) ? " (with you)" : ""}</li>`).join("")}</ul>
    <div class="row sticky-actions">
      ${canFamily ? `<button class="primary" data-act="family-time">Spend the season with them</button>` : ""}
      <button data-act="close">Close</button>
    </div>
  `, true);
}

function childCard(s: GameState, c: Child): string {
  const age = childAge(s, c);
  const traits = (Object.keys(c.traits) as (keyof typeof c.traits)[])
    .map((k) => {
      const pct = Math.min(100, c.traits[k] * 10);
      return `<div>${esc(TRAIT_LABEL[k])} <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    })
    .join("");
  const top = topTraits(c.traits, 1)[0];
  return `<div class="card person">
    <canvas class="bust" data-coat="${c.coat}" data-hair="#3a2a22" width="64" height="64"></canvas>
    <div>
      <b>${esc(c.name)}</b> · ${c.leftForCity ? `left for the city at ${age}` : `age ${age}`}
      <div class="muted">${top ? esc(TRAIT_LINE[top]) : "Still becoming someone."} Attention ${c.attention}.</div>
      <div class="bars">${traits}</div>
    </div>
  </div>`;
}

function pause(bag: UiBag): string {
  return sheet(`
    <p class="kicker">Paused</p>
    <h2>The day will wait</h2>
    <div class="row">
      <button class="primary" data-act="close">Resume</button>
      <button data-act="save">Save</button>
      <button data-act="help">How to play</button>
      <button data-act="sound">Mute / sound</button>
      <button class="danger" data-act="title">Title screen</button>
    </div>
    <h3>Shortcuts</h3>
    <p class="muted">Same as the F, G, V, and 0 keys. Useful on a phone, where there is no keyboard.</p>
    <div class="row">
      <button data-act="debug-year">Skip a year</button>
      <button data-act="debug-event">An event</button>
      <button data-act="debug-heir">Succession</button>
      <button data-act="debug-end">End of the century</button>
    </div>
    <p class="muted">${bag.hasSave ? "A save is already in this browser. Saving again replaces it." : "Nothing saved yet."}</p>
  `);
}

function succession(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const final = s.finalSuccession || s.generation >= 3;
  const hard = s.successionForced || retirementHard(s) || final;
  const eligible = new Set(eligibleChildren(s).map((c) => c.id));
  const cards = s.children
    .map((c) => {
      const age = childAge(s, c);
      const allowed = !c.leftForCity && (final || eligible.has(c.id));
      const on = bag.heirId === c.id ? " on" : "";
      const top = topTraits(c.traits, 2);
      return `<button class="card${on}" data-act="heir:${esc(c.id)}" ${allowed ? "" : "disabled"}>
        <canvas class="bust" data-coat="${esc(c.coat)}" data-hair="#3a2a22" width="64" height="64"></canvas>
        <b>${esc(c.name)}</b> · age ${age}${c.leftForCity ? " · gone to the city" : ""}${!allowed && !c.leftForCity ? " · too young" : ""}
        <div class="muted">${top.length ? top.map((t) => esc(TRAIT_LINE[t])).join(" ") : "Steady, and not yet marked by the work."}</div>
        <div>${top.map((t) => esc(TRAIT_LABEL[t])).join(" · ") || "No strong trait"}</div>
      </button>`;
    })
    .join("");
  const cousinOn = bag.heirId === "cousin" ? " on" : "";
  const keeps = s.keptHeirlooms
    .map((id) => {
      const on = bag.keeps.includes(id) ? " on" : "";
      const def = HEIRLOOMS[id];
      return `<button class="card${on}" data-act="keep:${esc(id)}"><b>${esc(def?.name ?? id)}</b><div class="muted">${esc(def?.blurb ?? "")}</div></button>`;
    })
    .join("");
  const farm = farmSummary(s);
  return sheet(`
    <p class="kicker">${final ? "Last page" : `Generation ${s.generation} steps back`}</p>
    <h2>${final ? "Who does the town remember holding the keys?" : "Who takes the morning chores?"}</h2>
    <p>${s.year}. The jar has $${s.money}, the note is $${s.debt}, the soil averages ${farm.soil}, and the trees number ${farm.trees}. Fields still in the name: ${esc(farm.acres)}. Pass up to three things from the box. The rest stays in the house, but only the chosen three keep their luck.</p>
    <div class="grid-2">${cards}</div>
    <button class="choice${cousinOn}" data-act="heir:cousin">A cousin, Rowan, if no child should have it<small>Steady and a little frugal. The suitcase is cardboard.</small></button>
    <h3>Heirloom box · ${bag.keeps.length}/3</h3>
    <div class="grid-2">${keeps}</div>
    <div class="row sticky-actions">
      <button class="primary" data-act="confirm-heir" ${bag.heirId ? "" : "disabled"}>Hand over the keys</button>
      ${hard ? "" : `<button data-act="defer">Not this spring</button>`}
    </div>
  `, true);
}

function stories(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const lines = s.pendingStories.length ? s.pendingStories : ["The house is yours."];
  return sheet(`
    <p class="kicker">${esc(s.playerName)} ${esc(s.familyName)}</p>
    <h2>What the house still says</h2>
    ${lines.map((l) => `<p class="lede">${esc(l)}</p>`).join("")}
    <div class="row sticky-actions"><button class="primary" data-act="close">Open the door</button></div>
  `);
}

function epilogue(bag: UiBag): string {
  const s = bag.state;
  if (!s) return "";
  const paras = s.epilogue ?? [];
  const tree = s.genRecords
    .map((g) => {
      const kids = g.children
        .map((c) => `${esc(c.name)}${c.heir ? " — heir" : ""}${c.left ? " — left" : ""}${c.traits.length ? ` (${esc(c.traits.join(", "))})` : ""}`)
        .join("; ");
      return `<div class="card"><b>Gen ${g.generation}: ${esc(g.name)}</b><br />${g.startYear}–${g.endYear}${g.spouse ? ` · with ${esc(g.spouse)}` : ""}<br /><span class="muted">${kids || "No children recorded."}</span><br />${esc(g.line)}</div>`;
    })
    .join("");
  const trees = countTrees(s);
  return sheet(`
    <p class="kicker">End of the century</p>
    <h2>How the town tells it</h2>
    <div class="tree">${tree}</div>
    <hr class="rule" />
    <p>Left on the place: $${s.money} in the jar, $${s.debt} on the note, soil ${averageSoil(s)}, ${trees.total} apple trees (${trees.mature} of age). ${s.soldParcels.includes("east") ? "The east acre is gone." : "The east acre remains."}</p>
    ${paras.map((p) => `<p class="ep">${esc(p)}</p>`).join("")}
    <div class="row sticky-actions">
      <button class="primary" data-act="title">Title screen</button>
    </div>
  `, true);
}

export function paintPortraits(root: ParentNode, bag: UiBag): void {
  const canvases = root.querySelectorAll<HTMLCanvasElement>("canvas[data-bust], canvas[data-coat]");
  canvases.forEach((canvas) => {
    const actorKey = canvas.dataset.bust;
    if (actorKey && bag.state) {
      const actor = findActor(bag, actorKey);
      if (!actor) return;
      paint(canvas, actor.shirt, actor.hair, actor.pants, actor.hat);
      return;
    }
    if (canvas.dataset.coat) {
      paint(canvas, "#888", canvas.dataset.hair ?? "#333", "#333", undefined, canvas.dataset.coat);
    }
  });
}

function findActor(bag: UiBag, key: string): { shirt: string; hair: string; pants: string; hat: string } | null {
  if (!bag.state) return null;
  const actor = actors(bag.state).find((a) => a.key === key);
  if (!actor) return null;
  return { shirt: actor.shirt, hair: actor.hair, pants: actor.pants, hat: actor.hat };
}

function paint(canvas: HTMLCanvasElement, shirt: string, hair: string, pants: string, hat?: string, coat?: string): void {
  const allowed: Coat[] = ["russet", "indigo", "moss"];
  const parsed = allowed.find((c) => c === coat);
  drawPortrait(canvas, { shirt, hair, pants, hat, coat: parsed });
}
