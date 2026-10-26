# Hearthland

A generational farming life sim. One family, one farm, from 1925 toward 1975. You walk the rows, and what you do to the soil, the neighbors, and the children becomes the next generation's map.

This first version is a static browser game: TypeScript, Vite, and Canvas. No install beyond a browser. Art is drawn in code.

## Play it online

After GitHub Pages is enabled, the game is served from:

`https://<your-github-user>.github.io/Hearthland/`

**One-time setup.** In the repository settings, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds `main` and deploys the `dist` folder. Vite is configured with `base: "/Hearthland/"` so asset paths match that project site. Nothing else needs to be pointed at a `docs/` folder or a `gh-pages` branch.

## Run it locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/Hearthland/](http://localhost:5173/Hearthland/). The `/Hearthland/` path is required because it matches the GitHub Pages base.

```bash
npm run build
```

That typechecks, runs a scripted playthrough (new game through a succession, then the end of the century), and writes a static site to `dist/`. `npm run preview` serves that build.

## Controls

| Key | Action |
| --- | --- |
| WASD or arrow keys | Walk |
| E or Space | Use the tile or person you are facing |
| 1–4 | Select wheat, potatoes, beans, or corn |
| 5 | Select the apple sapling |
| C | Spread compost on the faced tile |
| H | How to play |
| L | Ledger (soil, money, neighbors, memory) |
| K | Family and the heirloom box |
| Esc | Menu, or close the open panel |
| M | Mute or unmute the valley |
| Enter or 1–3 | Confirm a card or pick a choice |
| F | Debug: live one year in a single night |
| G | Debug: raise an heir and open succession |
| V | Debug: force an event card |
| 0 | Debug: jump to the end-of-century summary |

The line at the bottom of the screen says what E will do. Sleep from the farmhouse porch (face the house and press E). The game saves in `localStorage` when you sleep, decide, sell, or pass the farm. Continue is on the title screen.

## What's in this version

**Two eras, three generations.** 1925–1949 is Horse & Hard Times: depression prices (1930–1933), wartime wheat (1942–1945), a horse plow, and loans at a higher rate. From 1950, Iron & Asphalt changes the rules, not just the road: wheat is worth less as a commodity, apples pay better, the store sells a tractor and a creek pump, hybrid seed yields more and tires the ground faster, and a supermarket corn contract is a real offer. A generation runs about sixteen years, or until age and the work say stop. The third handing-over, or the year 1975, ends on a family tree and a short account of how the town remembers you.

**The day.** Five-day seasons. Till, plant, water, and harvest. Wheat, potatoes, beans, and corn, plus apple trees that need years. Energy and clock both run out. Rain waters the rows. Drought, frost, and flood do not care about your plans. A spouse waters a couple of tiles in the morning. The pump, once you own it, waters the garden, the orchard rise, and the creek bottom.

**The ground.** Every farmed tile has soil from 0 to 100. Harvesting spends it (corn spends a lot; beans give some back). Fallow seasons and winter rest it. Compost lifts a tile. The tint of tilled earth is the rough reading; the old seed catalogue shows the number. Trees and tired dirt are still there for the next name on the deed.

**The town.** The Harrows, the Vosses, and the Pikes keep a score that barely fades when someone dies. You can marry Cal Harrow, Mara Ellison, Ida Voss, or Jonah Pike. Children age with the calendar. Autumn and winter you choose how to spend time with them, and that pushes them toward green thumb, frugal, restless, or hot-tempered. Those traits become the next farmer's small advantages and problems. A feud or a favor can come back as an event in a later generation.

**The box.** You can keep three heirlooms at a succession: the seed tin, your father's ring, the 1918 catalogue, and anything the years add (a war bond, a fair ribbon, a drawing, a cancelled note, a letter from the city). The ones you pick show up as a short story and a rule change. Debt, machines, sold land, and reputation come along whether you pick them or not.

**The east acre** can be sold. It does not come back. After 1950 a sold acre grows a diner instead of a crop.

## Layout

- `src/game/content.ts` — crops, prices, eras, heirlooms, traits
- `src/game/events.ts` — event cards and their consequences
- `src/game/world.ts` — the valley, parcels, and people
- `src/game/sim.ts` — the day, the year, marriage, succession
- `src/game/render.ts` — the canvas
- `src/game/ui.ts` — panels
- `scripts/check.ts` — a headless playthrough used by `npm run build`

Adding a crop is a `CROPS` entry. Adding an era is a branch in the price and shop rules plus events gated on the year. Adding a generation mostly means letting the century run longer than 1975 and not ending on generation 3.

## Ideas for later

- A third and fourth era (the farm crisis, then a present-day season with different weather and a shorter town)
- Livestock, and a kitchen that turns crops into something other than a sack
- Neighbors who farm their own land, so a feud shows up as a fence and a fallow field, not only a number
- Interiors, and a Saturday that is not a workday
- More than one save, and a family tree you can open without waiting for the last page
- Richer courtship than one conversation and a basket
