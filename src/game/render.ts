import { hash } from "./util";
import { COAT_HEX } from "./content";
import { COLS, ROWS, type Coat, type Dir, type GameState, type Season } from "./types";
import { actors, type Actor } from "./world";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  text?: string;
  size: number;
}

export interface Scene {
  zoom: number;
  camX: number;
  camY: number;
  playerX: number;
  playerY: number;
  facing: Dir;
  step: number;
  moving: boolean;
  dogX: number;
  dogY: number;
  chickens: { x: number; y: number; bob: number }[];
  catX: number;
  catY: number;
  particles: Particle[];
  time: number;
  showNames: boolean;
}

const INK = "#2a2118";

export function drawWorld(ctx: CanvasRenderingContext2D, s: GameState, view: Scene): void {
  const { zoom } = view;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = sky(s);
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = s.tiles[y * COLS + x]!;
      const p = worldToScreen(view, x * 16, y * 16);
      if (p.x > w + 20 || p.y > h + 20 || p.x < -20 * zoom || p.y < -20 * zoom) continue;
      drawGround(ctx, zoom, p.x, p.y, t.g, t.decor, t.soil, t.tilled, !!t.crop?.watered, s.season, x, y, s.year, !!t.parcel && !s.soldParcels.includes(t.parcel));
      if (t.crop) drawCrop(ctx, zoom, p.x, p.y, t.crop.id, t.crop.prog, t.crop.prog >= growOf(t.crop.id), view.time, x);
      if (t.decor === "neighborCrop") drawCrop(ctx, zoom, p.x, p.y, "wheat", 3, false, view.time, x);
      if (t.decor === "flower") drawFlower(ctx, zoom, p.x, p.y, x, y);
      if (t.decor === "reed") drawReed(ctx, zoom, p.x, p.y);
      if (t.decor === "stone") {
        ctx.fillStyle = "#8d887f";
        ctx.fillRect(p.x + 5 * zoom, p.y + 9 * zoom, 5 * zoom, 3 * zoom);
      }
    }
  }

  type Sprite = { y: number; draw: () => void };
  const sprites: Sprite[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = s.tiles[y * COLS + x]!;
      if (t.decor === "tree") {
        const p = worldToScreen(view, x * 16, y * 16);
        sprites.push({ y: (y + 1) * 16, draw: () => drawWildTree(ctx, zoom, p.x, p.y, s.season, x, y) });
      }
      if (t.tree) {
        const p = worldToScreen(view, x * 16, y * 16);
        const mature = t.tree.age >= (s.activeHeirlooms.includes("orchard-letter") ? 3 : 4);
        sprites.push({
          y: (y + 1) * 16,
          draw: () => drawAppleTree(ctx, zoom, p.x, p.y, t.tree!.age, t.tree!.fruit, mature, s.season),
        });
      }
    }
  }

  for (const b of s.buildings) {
    const p = worldToScreen(view, b.x * 16, b.y * 16);
    sprites.push({
      y: (b.y + b.h) * 16,
      draw: () => drawBuilding(ctx, zoom, p.x, p.y, b.kind, b.w, b.h, b.roof, b.wall, s.minutes, view.time, b.label),
    });
  }

  for (const a of actors(s)) {
    const p = worldToScreen(view, a.x * 16, a.y * 16);
    sprites.push({
      y: (a.y + 1) * 16,
      draw: () => {
        drawPerson(ctx, zoom, p.x, p.y, {
          shirt: a.shirt,
          pants: a.pants,
          hair: a.hair,
          hat: a.hat,
          facing: "s",
          step: Math.sin(view.time / 400 + a.x) > 0 ? 1 : 0,
          small: a.small,
        });
        if (view.showNames && near(view, a.x, a.y)) label(ctx, p.x + 8 * zoom, p.y - 2 * zoom, a.name);
      },
    });
  }

  for (const c of view.chickens) {
    const p = worldToScreen(view, c.x * 16, c.y * 16);
    sprites.push({ y: c.y * 16 + 14, draw: () => drawChicken(ctx, zoom, p.x, p.y, c.bob) });
  }
  const cat = worldToScreen(view, view.catX * 16, view.catY * 16);
  sprites.push({ y: view.catY * 16 + 14, draw: () => drawCat(ctx, zoom, cat.x, cat.y, view.time) });

  const dog = worldToScreen(view, view.dogX * 16, view.dogY * 16);
  sprites.push({ y: view.dogY * 16 + 14, draw: () => drawDog(ctx, zoom, dog.x, dog.y, view.time) });

  const pp = worldToScreen(view, view.playerX * 16, view.playerY * 16);
  const coat = COAT_HEX[s.coat] ?? COAT_HEX.russet!;
  sprites.push({
    y: view.playerY * 16 + 16,
    draw: () => {
      drawPerson(ctx, zoom, pp.x, pp.y, {
        shirt: coat.shirt,
        pants: coat.pants,
        hair: "#3a2a22",
        hat: coat.hat,
        facing: view.facing,
        step: view.moving ? view.step : 0,
        small: false,
      });
    },
  });

  sprites.sort((a, b) => a.y - b.y);
  for (const sp of sprites) sp.draw();

  drawFacing(ctx, view, s);
  drawWeather(ctx, view, s);
  drawGrade(ctx, s);
  for (const particle of view.particles) drawParticle(ctx, view, particle);
  drawMinimap(ctx, s, view);
}

function growOf(id: string): number {
  if (id === "wheat") return 4;
  if (id === "potato") return 5;
  if (id === "beans") return 3;
  return 8;
}

function near(view: Scene, x: number, y: number): boolean {
  return Math.abs(view.playerX - x) + Math.abs(view.playerY - y) <= 3;
}

export function worldToScreen(view: Scene, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - view.camX) * view.zoom, y: (wy - view.camY) * view.zoom };
}

function sky(s: GameState): string {
  if (s.season === "winter") return "#c5d4de";
  if (s.season === "autumn") return "#e7c59a";
  if (s.season === "summer") return "#8ec8ea";
  return "#9fd0ef";
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  z: number,
  sx: number,
  sy: number,
  g: string,
  decor: string,
  soil: number,
  tilled: boolean,
  watered: boolean,
  season: Season,
  x: number,
  y: number,
  year: number,
  owned: boolean,
): void {
  if (g === "water") {
    const shift = Math.floor((Date.now() / 280 + x) % 3);
    ctx.fillStyle = shift === 0 ? "#3f8ea8" : "#357f98";
    ctx.fillRect(sx, sy, 16 * z, 16 * z);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(sx, sy + ((y + shift) % 4) * 4 * z, 16 * z, z);
    return;
  }
  if (g === "path" || g === "asphalt" || g === "gravel") {
    ctx.fillStyle = g === "asphalt" ? "#5e656c" : g === "gravel" ? "#b7aa96" : "#c6ae84";
    ctx.fillRect(sx, sy, 16 * z, 16 * z);
    ctx.fillStyle = g === "asphalt" ? "#6c747c" : "rgba(90,70,40,0.25)";
    if ((x + y) % 2 === 0) ctx.fillRect(sx + 3 * z, sy + 8 * z, 2 * z, z);
    if (g === "asphalt" && year >= 1950 && y === 25 && x % 4 === 0) {
      ctx.fillStyle = "#d8d2a4";
      ctx.fillRect(sx, sy + 7 * z, 8 * z, z);
    }
    return;
  }
  const winter = season === "winter";
  const autumn = season === "autumn";
  const grasses = winter
    ? ["#e7eef2", "#d5e2ea", "#f4f7f8"]
    : autumn
      ? ["#c4a15a", "#b48b3e", "#d0ae68"]
      : ["#6eae4e", "#62a046", "#7dba58", "#58943c"];
  ctx.fillStyle = grasses[hash(x, y) % grasses.length]!;
  ctx.fillRect(sx, sy, 16 * z, 16 * z);
  if (owned && !tilled) {
    ctx.fillStyle = season === "winter" ? "rgba(90, 110, 120, 0.18)" : "rgba(92, 64, 28, 0.16)";
    ctx.fillRect(sx, sy, 16 * z, 16 * z);
  }
  if (!winter && decor === "none" && hash(x, y + 4) % 3 === 0) {
    ctx.fillStyle = autumn ? "#8c6a30" : "#4f8a38";
    ctx.fillRect(sx + (hash(x, y) % 10) * z, sy + 10 * z, z, 3 * z);
  }
  if (tilled || soil) {
    /* soil tint lives on tilled tiles below */
  }
  if (tilled) {
    const rich = Math.max(0, Math.min(1, soil / 100));
    const cr = Math.round(150 - rich * 70);
    const cg = Math.round(110 - rich * 50);
    const cb = Math.round(70 - rich * 30);
    ctx.fillStyle = watered ? `rgb(${cr - 20},${cg - 10},${cb})` : `rgb(${cr},${cg},${cb})`;
    ctx.fillRect(sx, sy, 16 * z, 16 * z);
    ctx.fillStyle = "rgba(40,24,12,0.35)";
    for (let i = 3; i < 16; i += 4) ctx.fillRect(sx, sy + i * z, 16 * z, z);
  }
}

function drawCrop(
  ctx: CanvasRenderingContext2D,
  z: number,
  sx: number,
  sy: number,
  id: string,
  prog: number,
  ripe: boolean,
  time: number,
  x: number,
): void {
  const sway = Math.sin(time / 300 + x) > 0 ? 0 : z;
  if (id === "wheat") {
    ctx.fillStyle = ripe ? "#e2c15a" : "#d8b84a";
    const h = 4 + Math.min(8, prog * 2);
    for (const dx of [4, 8, 11]) ctx.fillRect(sx + dx * z + sway, sy + (14 - h) * z, z, h * z);
    if (ripe) {
      ctx.fillStyle = "#f3dd86";
      ctx.fillRect(sx + 4 * z + sway, sy + (13 - h) * z, z, 2 * z);
    }
    return;
  }
  if (id === "corn") {
    const h = 5 + Math.min(9, prog);
    ctx.fillStyle = ripe ? "#3f8a32" : "#2f7a34";
    ctx.fillRect(sx + 7 * z, sy + (15 - h) * z, 2 * z, h * z);
    ctx.fillStyle = "#8fd15a";
    ctx.fillRect(sx + 4 * z, sy + (12 - Math.min(6, prog)) * z, 3 * z, 2 * z);
    if (ripe) {
      ctx.fillStyle = "#f0d35a";
      ctx.fillRect(sx + 5 * z, sy + (10 - Math.min(4, prog)) * z, 3 * z, 4 * z);
    }
    return;
  }
  if (id === "beans") {
    ctx.fillStyle = "#6b4632";
    ctx.fillRect(sx + 8 * z, sy + 6 * z, z, 8 * z);
    ctx.fillStyle = ripe ? "#3c8c45" : "#2f6e38";
    ctx.fillRect(sx + 5 * z, sy + 7 * z, 6 * z, 4 * z);
    if (ripe) {
      ctx.fillStyle = "#d8e08a";
      ctx.fillRect(sx + 6 * z, sy + 8 * z, 2 * z, 2 * z);
    }
    return;
  }
  ctx.fillStyle = ripe ? "#6d8a3a" : "#4f7a32";
  ctx.beginPath();
  ctx.ellipse(sx + 8 * z, sy + 10 * z, 5 * z, 3 * z + Math.min(prog, 4) * z * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ripe) {
    ctx.fillStyle = "#c4a06a";
    ctx.fillRect(sx + 6 * z, sy + 12 * z, 2 * z, 2 * z);
    ctx.fillRect(sx + 9 * z, sy + 12 * z, 2 * z, 2 * z);
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, x: number, y: number): void {
  ctx.fillStyle = "#3f7a34";
  ctx.fillRect(sx + 8 * z, sy + 10 * z, z, 4 * z);
  ctx.fillStyle = hash(x, y) % 2 === 0 ? "#f0d0d8" : "#f2e39a";
  ctx.fillRect(sx + 7 * z, sy + 8 * z, 3 * z, 2 * z);
}

function drawReed(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number): void {
  ctx.fillStyle = "#6a8f4a";
  ctx.fillRect(sx + 4 * z, sy + 6 * z, z, 8 * z);
  ctx.fillRect(sx + 8 * z, sy + 4 * z, z, 10 * z);
}

function drawWildTree(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, season: Season, x: number, y: number): void {
  ctx.fillStyle = "rgba(40,30,20,0.25)";
  ctx.fillRect(sx + 4 * z, sy + 13 * z, 8 * z, 2 * z);
  ctx.fillStyle = "#6b4632";
  ctx.fillRect(sx + 7 * z, sy + 8 * z, 2 * z, 7 * z);
  const leaf = season === "autumn" ? "#d06a2b" : season === "winter" ? "#d5e0e6" : season === "spring" && hash(x, y) % 2 === 0 ? "#e7b7c8" : "#2f7a3a";
  ctx.fillStyle = leaf;
  ctx.fillRect(sx + 3 * z, sy + z, 10 * z, 8 * z);
  ctx.fillStyle = season === "winter" ? "#edf3f6" : "#3e8f48";
  ctx.fillRect(sx + 5 * z, sy + 2 * z, 4 * z, 3 * z);
}

function drawAppleTree(
  ctx: CanvasRenderingContext2D,
  z: number,
  sx: number,
  sy: number,
  age: number,
  fruit: boolean,
  mature: boolean,
  season: Season,
): void {
  ctx.fillStyle = "rgba(40,30,20,0.25)";
  ctx.fillRect(sx + 4 * z, sy + 13 * z, 8 * z, 2 * z);
  if (age <= 0) {
    ctx.fillStyle = "#6b4632";
    ctx.fillRect(sx + 7 * z, sy + 8 * z, z, 6 * z);
    ctx.fillStyle = "#8fbf62";
    ctx.fillRect(sx + 6 * z, sy + 6 * z, 3 * z, 2 * z);
    return;
  }
  const tall = mature ? 8 : 5;
  ctx.fillStyle = "#6b4632";
  ctx.fillRect(sx + 7 * z, sy + (14 - tall) * z, 2 * z, tall * z);
  const leaf = season === "winter" ? "#c5d0d6" : season === "autumn" ? "#e07a32" : "#348a3e";
  ctx.fillStyle = leaf;
  const crown = mature ? 12 : 8;
  ctx.fillRect(sx + (8 - crown / 2) * z, sy + (8 - (mature ? 6 : 3)) * z, crown * z, (mature ? 8 : 5) * z);
  if (fruit && season !== "winter") {
    ctx.fillStyle = "#d64545";
    ctx.fillRect(sx + 5 * z, sy + 5 * z, 2 * z, 2 * z);
    ctx.fillRect(sx + 9 * z, sy + 6 * z, 2 * z, 2 * z);
    ctx.fillRect(sx + 7 * z, sy + 8 * z, 2 * z, 2 * z);
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  z: number,
  sx: number,
  sy: number,
  kind: string,
  w: number,
  h: number,
  roof: string,
  wall: string,
  minutes: number,
  time: number,
  label: string,
): void {
  const pw = w * 16;
  const ph = h * 16;
  ctx.fillStyle = "rgba(40,30,20,0.2)";
  ctx.fillRect(sx + 2 * z, sy + ph * z - 2 * z, pw * z, 3 * z);
  if (kind === "sign") {
    ctx.fillStyle = "#6b4632";
    ctx.fillRect(sx + 6 * z, sy + 4 * z, 2 * z, 10 * z);
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(sx + 2 * z, sy, 14 * z, 8 * z);
    ctx.fillStyle = INK;
    ctx.font = `${7 * z}px Georgia, serif`;
    ctx.fillText("SOLD", sx + 3 * z, sy + 6 * z);
    return;
  }
  if (kind === "pump") {
    ctx.fillStyle = "#6d7680";
    ctx.fillRect(sx + 6 * z, sy + 6 * z, 4 * z, 8 * z);
    ctx.fillStyle = "#3e4750";
    ctx.fillRect(sx + 4 * z, sy + 4 * z, 8 * z, 3 * z);
    ctx.fillStyle = "#9aa3aa";
    ctx.fillRect(sx + 10 * z, sy + 8 * z, 4 * z, 2 * z);
    return;
  }
  const roofH = kind === "church" ? 16 : 10;
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(sx - 2 * z, sy + roofH * z);
  ctx.lineTo(sx + (pw / 2) * z, sy - (kind === "church" ? 10 : 4) * z);
  ctx.lineTo(sx + (pw + 2) * z, sy + roofH * z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = wall;
  ctx.fillRect(sx + z, sy + roofH * z, (pw - 2) * z, (ph - roofH) * z);
  ctx.fillStyle = "rgba(90,60,40,0.35)";
  if (kind === "farmhouse" || kind === "cabin") {
    ctx.fillRect(sx + z, sy + roofH * z, z, (ph - roofH) * z);
    ctx.fillRect(sx + (pw - 4) * z, sy + roofH * z, z, (ph - roofH) * z);
  }
  const night = minutes > 11 * 60;
  ctx.fillStyle = night ? "#f3d27a" : "#9ec4d4";
  const winY = sy + (roofH + 3) * z;
  ctx.fillRect(sx + 4 * z, winY, 3 * z, 4 * z);
  ctx.fillRect(sx + (pw - 8) * z, winY, 3 * z, 4 * z);
  if (kind !== "barn") {
    ctx.fillStyle = "#4a2e22";
    ctx.fillRect(sx + (pw / 2 - 2) * z, sy + (ph - 8) * z, 4 * z, 8 * z);
  } else {
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(sx + 4 * z, sy + (ph - 10) * z, (pw - 8) * z, 10 * z);
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(sx + 6 * z, sy + (roofH + 2) * z, 2 * z, 2 * z);
  }
  if (kind === "church") {
    ctx.fillStyle = roof;
    ctx.fillRect(sx + (pw / 2 - 1) * z, sy - 16 * z, 2 * z, 8 * z);
    ctx.fillRect(sx + (pw / 2 - 3) * z, sy - 14 * z, 6 * z, 2 * z);
  }
  if (kind === "farmhouse" || kind === "cabin" || kind === "store") {
    ctx.fillStyle = "#6e5344";
    ctx.fillRect(sx + (pw - 6) * z, sy - z, 3 * z, 6 * z);
    ctx.fillStyle = "rgba(80,80,80,0.35)";
    const puff = (time / 200) % 8;
    ctx.fillRect(sx + (pw - 5) * z, sy - puff * z, 2 * z, 2 * z);
  }
  if (kind === "diner") {
    ctx.fillStyle = "#f4ecd8";
    ctx.fillRect(sx + 2 * z, sy + (roofH + 1) * z, (pw - 4) * z, 5 * z);
    ctx.fillStyle = "#9c3b3b";
    ctx.font = `${5 * z}px Georgia, serif`;
    ctx.fillText("DINER", sx + 4 * z, sy + (roofH + 5) * z);
  }
  if (label && kind !== "diner" && kind !== "sign") {
    /* names come from people, not roofs */
  }
}

interface PersonStyle {
  shirt: string;
  pants: string;
  hair: string;
  hat: string;
  facing: Dir;
  step: number;
  small: boolean;
}

function drawPerson(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, p: PersonStyle): void {
  const sc = p.small ? 0.75 : 1;
  const bob = p.step ? z : 0;
  const top = sy + (p.small ? 4 : 0) * z - bob;
  ctx.fillStyle = "rgba(40,30,20,0.28)";
  ctx.beginPath();
  ctx.ellipse(sx + 8 * z, sy + 14 * z, 4 * z, 1.6 * z, 0, 0, Math.PI * 2);
  ctx.fill();
  const leg = p.step ? 1 : 0;
  ctx.fillStyle = p.pants;
  ctx.fillRect(sx + (6 - leg) * z, top + 9 * z * sc, 2 * z, 4 * z);
  ctx.fillRect(sx + (9 + leg) * z, top + 9 * z * sc, 2 * z, 4 * z);
  ctx.fillStyle = p.shirt;
  ctx.fillRect(sx + 5 * z, top + 5 * z, 6 * z, 5 * z);
  ctx.fillStyle = "#f0c9a0";
  ctx.fillRect(sx + 5 * z, top + z, 6 * z, 4 * z);
  ctx.fillStyle = p.hair;
  ctx.fillRect(sx + 5 * z, top, 6 * z, 2 * z);
  if (p.facing === "s") {
    ctx.fillStyle = INK;
    ctx.fillRect(sx + 6 * z, top + 2 * z, z, z);
    ctx.fillRect(sx + 9 * z, top + 2 * z, z, z);
  } else if (p.facing === "n") {
    ctx.fillStyle = p.hair;
    ctx.fillRect(sx + 5 * z, top + z, 6 * z, 3 * z);
  }
  ctx.fillStyle = p.hat;
  ctx.fillRect(sx + 4 * z, top - z, 8 * z, 2 * z);
  ctx.fillRect(sx + 5 * z, top - 2 * z, 6 * z, z);
}

function drawChicken(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, bob: number): void {
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(sx + 5 * z, sy + (9 + bob) * z, 5 * z, 4 * z);
  ctx.fillStyle = "#e24b3a";
  ctx.fillRect(sx + 9 * z, sy + (10 + bob) * z, 2 * z, z);
  ctx.fillStyle = "#f0c04a";
  ctx.fillRect(sx + 6 * z, sy + (13 + bob) * z, z, 2 * z);
}

function drawCat(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, time: number): void {
  const tail = Math.sin(time / 200) > 0 ? 0 : z;
  ctx.fillStyle = "#6a5648";
  ctx.fillRect(sx + 5 * z, sy + 10 * z, 6 * z, 3 * z);
  ctx.fillRect(sx + 9 * z, sy + 8 * z + tail, 3 * z, z);
  ctx.fillRect(sx + 5 * z, sy + 8 * z, 2 * z, 2 * z);
}

function drawDog(ctx: CanvasRenderingContext2D, z: number, sx: number, sy: number, time: number): void {
  const wag = Math.sin(time / 120) > 0 ? 1 : -1;
  ctx.fillStyle = "#c47a3a";
  ctx.fillRect(sx + 4 * z, sy + 9 * z, 7 * z, 4 * z);
  ctx.fillRect(sx + 9 * z, sy + 7 * z, 3 * z, 3 * z);
  ctx.fillStyle = "#8a4e28";
  ctx.fillRect(sx + 2 * z, sy + (8 + wag) * z, 2 * z, z);
  ctx.fillStyle = INK;
  ctx.fillRect(sx + 11 * z, sy + 8 * z, z, z);
}

function drawFacing(ctx: CanvasRenderingContext2D, view: Scene, s: GameState): void {
  const dx = view.facing === "w" ? -1 : view.facing === "e" ? 1 : 0;
  const dy = view.facing === "n" ? -1 : view.facing === "s" ? 1 : 0;
  const tx = Math.round(view.playerX) + dx;
  const ty = Math.round(view.playerY) + dy;
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
  const p = worldToScreen(view, tx * 16, ty * 16);
  ctx.strokeStyle = "rgba(255,244,220,0.8)";
  ctx.lineWidth = Math.max(1, view.zoom / 2);
  ctx.strokeRect(p.x + view.zoom, p.y + view.zoom, 14 * view.zoom, 14 * view.zoom);
  void s;
}

function drawWeather(ctx: CanvasRenderingContext2D, view: Scene, s: GameState): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (s.weather === "rain" || s.weather === "storm") {
    ctx.strokeStyle = s.weather === "storm" ? "rgba(210,230,240,0.55)" : "rgba(200,220,230,0.4)";
    ctx.lineWidth = 1;
    const n = s.weather === "storm" ? 80 : 46;
    for (let i = 0; i < n; i++) {
      const x = ((i * 97 + view.time / 8) % (w + 40)) - 20;
      const y = ((i * 53 + view.time / 3) % (h + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 10);
      ctx.stroke();
    }
  }
  if (s.weather === "snow" || s.season === "winter") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 40; i++) {
      const x = (i * 80 + view.time / 12) % w;
      const y = (i * 47 + view.time / 10) % h;
      ctx.fillRect(x, y, view.zoom, view.zoom);
    }
  }
  if (s.season === "autumn" && s.weather === "clear") {
    ctx.fillStyle = "#e07a32";
    for (let i = 0; i < 12; i++) {
      const x = (i * 120 + view.time / 20) % w;
      const y = (i * 70 + view.time / 16) % h;
      ctx.fillRect(x, y, view.zoom + 1, view.zoom);
    }
  }
  if (s.season === "spring" && s.weather === "clear") {
    ctx.fillStyle = "rgba(255,210,220,0.9)";
    for (let i = 0; i < 10; i++) {
      const x = (i * 140 + Math.sin(view.time / 600 + i) * 20) % w;
      const y = (i * 90 + view.time / 30) % h;
      ctx.fillRect(x, y, view.zoom, view.zoom);
    }
  }
}

function drawGrade(ctx: CanvasRenderingContext2D, s: GameState): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const t = s.minutes / (16 * 60);
  let alpha = 0;
  let color = "rgba(40,50,90,0)";
  if (t > 0.72) {
    alpha = Math.min(0.45, (t - 0.72) * 1.3);
    color = `rgba(28, 36, 72, ${alpha})`;
  } else if (t < 0.08) {
    color = "rgba(255, 214, 160, 0.14)";
  } else if (s.season === "autumn") color = "rgba(220, 140, 60, 0.08)";
  if (s.weather === "drought") color = "rgba(196, 150, 70, 0.16)";
  if (s.weather === "storm") color = "rgba(30, 40, 55, 0.22)";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createLinearGradient(0, 0, 0, h);
  vg.addColorStop(0, "rgba(20,16,12,0.18)");
  vg.addColorStop(0.2, "rgba(20,16,12,0)");
  vg.addColorStop(0.8, "rgba(20,16,12,0)");
  vg.addColorStop(1, "rgba(20,16,12,0.28)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function drawParticle(ctx: CanvasRenderingContext2D, view: Scene, p: Particle): void {
  const pos = worldToScreen(view, p.x * 16, p.y * 16);
  const alpha = Math.max(0, p.life / p.max);
  ctx.globalAlpha = alpha;
  if (p.text) {
    ctx.fillStyle = p.color;
    ctx.font = `bold ${Math.max(12, view.zoom * 5)}px Georgia, serif`;
    ctx.fillText(p.text, pos.x, pos.y);
  } else {
    ctx.fillStyle = p.color;
    ctx.fillRect(pos.x, pos.y, p.size * view.zoom, p.size * view.zoom);
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx: CanvasRenderingContext2D, s: GameState, view: Scene): void {
  const scale = 3;
  const ox = ctx.canvas.width - COLS * scale - 18;
  const oy = 108;
  ctx.fillStyle = "rgba(28, 22, 16, 0.72)";
  ctx.fillRect(ox - 4, oy - 4, COLS * scale + 8, ROWS * scale + 8);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = s.tiles[y * COLS + x]!;
      let color = "#6a9a48";
      if (t.g === "water") color = "#3d88a4";
      else if (t.g === "path") color = "#c6ae84";
      else if (t.g === "asphalt") color = "#66707a";
      else if (t.g === "gravel") color = "#b7aa96";
      else if (t.parcel && !s.soldParcels.includes(t.parcel)) color = t.soil > 60 ? "#8a5a32" : "#b08968";
      else if (t.decor === "tree" || t.tree) color = "#2f6a38";
      if (s.season === "winter" && t.g === "grass" && !t.parcel) color = "#d5e0e6";
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
  ctx.fillStyle = "#f4ecd8";
  ctx.fillRect(ox + Math.round(view.playerX) * scale, oy + Math.round(view.playerY) * scale, scale + 1, scale + 1);
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, text: string): void {
  ctx.font = "12px Georgia, serif";
  ctx.textAlign = "center";
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(28,22,16,0.75)";
  ctx.fillRect(x - w / 2 - 4, y - 12, w + 8, 16);
  ctx.fillStyle = "#f6efe2";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

export function drawPortrait(
  canvas: HTMLCanvasElement,
  opts: { shirt: string; hair: string; pants: string; hat?: string; coat?: Coat },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const coat = opts.coat ? COAT_HEX[opts.coat] : null;
  canvas.width = 64;
  canvas.height = 64;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#efe2cc";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#d7c4a4";
  ctx.fillRect(0, 40, 64, 24);
  drawPerson(ctx, 3, 8, 10, {
    shirt: coat?.shirt ?? opts.shirt,
    pants: coat?.pants ?? opts.pants,
    hair: opts.hair,
    hat: opts.hat ?? coat?.hat ?? opts.hair,
    facing: "s",
    step: 0,
    small: false,
  });
}

export function actorLook(a: Actor): { shirt: string; hair: string; pants: string; hat: string } {
  return { shirt: a.shirt, hair: a.hair, pants: a.pants, hat: a.hat };
}
