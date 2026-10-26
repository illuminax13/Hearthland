import { Soundboard } from "./audio";
import { eligibleChildren } from "./calendar";
import { talkModel } from "./dialogue";
import type { Particle, Scene } from "./render";
import { drawWorld } from "./render";
import { hasSave, loadGame, saveGame } from "./save";
import {
  applyShop,
  applyTalk,
  createNewGame,
  createPreview,
  debugAdvanceYear,
  debugForceEvent,
  debugPrepareSuccession,
  debugToEpilogue,
  interact,
  openFamilyEvent,
  passFarm,
  resolveChoice,
  selectSeed,
  sleepThrough,
  tryMove,
  useCompost,
  type NewGameOptions,
} from "./sim";
import { COLS, ROWS, type Coat, type Dir, type GameState } from "./types";
import { clamp } from "./util";
import { actors } from "./world";
import { hudHtml, overlayHtml, paintPortraits, type Screen, type UiBag } from "./ui";

const MOVE_TIME = 0.14;

export class Game {
  private preview = createPreview();
  private state: GameState | null = null;
  private screen: Screen = "title";
  private summary: UiBag["summary"] = null;
  private talk: UiBag["talk"] = null;
  private toast = "";
  private toastLeft = 0;
  private heirId: string | null = null;
  private keeps: string[] = [];
  private draftCoat: Coat = "russet";
  private returnTo: Screen = "title";
  private domSig = "";
  private keys = new Set<string>();
  private moveLeft = 0;
  private moving = false;
  private fromX = 0;
  private fromY = 0;
  private toX = 0;
  private toY = 0;
  private step = 0;
  private camX = 160;
  private camY = 200;
  private snap = true;
  private dogX = 11;
  private dogY = 17;
  private chickens = [
    { x: 15.3, y: 16.15, bob: 0, vx: 0.15 },
    { x: 16.7, y: 16.35, bob: 1, vx: -0.12 },
  ];
  private catX = 30.5;
  private catY = 30.15;
  private particles: Particle[] = [];
  private last = 0;
  private audio = new Soundboard();
  private touchDir: Dir | null = null;
  private cssW = 320;
  private cssH = 240;
  private dpr = 1;
  private touchMode = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private hud: HTMLElement,
    private overlay: HTMLElement,
    private touch: HTMLElement,
  ) {
    this.touchMode = window.matchMedia("(pointer: coarse)").matches;
    this.bindTouch();
    this.syncChrome();
    this.resize();
    const onResize = () => this.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("scroll", onResize);
    window.matchMedia("(pointer: coarse)").addEventListener("change", (e) => {
      this.touchMode = e.matches || this.touchMode;
      this.syncChrome();
      this.resize();
    });
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" && !this.touchMode) {
        this.touchMode = true;
        this.syncChrome();
        this.resize();
      }
    });
    document.addEventListener(
      "touchmove",
      (e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest(".sheet, .panel, .log, input, textarea")) return;
        e.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("contextmenu", (e) => {
      if (this.touchMode) e.preventDefault();
    });
    window.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    this.overlay.addEventListener("click", (e) => this.onClick(e));
    this.hud.addEventListener("click", (e) => this.onClick(e));
    this.refresh();
  }

  start(): void {
    requestAnimationFrame((t) => this.frame(t));
  }

  private frame(t: number): void {
    const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016);
    this.last = t;
    try {
      this.update(dt, t);
      this.draw(t);
    } catch (err) {
      console.error(err);
      this.say("Something in the valley snagged. The day was saved if it could be.");
      if (this.state) saveGame(this.state);
    }
    requestAnimationFrame((now) => this.frame(now));
  }

  private update(dt: number, time: number): void {
    this.audio.update(this.current().season);
    if (this.toastLeft > 0) {
      this.toastLeft -= dt;
      if (this.toastLeft <= 0) {
        this.toast = "";
        this.refresh();
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const c of this.chickens) {
      c.x += c.vx * dt;
      if (c.x > 17.2 || c.x < 14.8) c.vx *= -1;
      c.bob = Math.sin(time / 180 + c.x) > 0 ? 0 : 1;
    }
    const player = this.drawPlayer();
    this.dogX += (player.x - 0.45 - this.dogX) * Math.min(1, dt * 3);
    this.dogY += (player.y + 0.35 - this.dogY) * Math.min(1, dt * 3);
    if (this.screen === "play") this.control(dt);
  }

  private control(dt: number): void {
    const s = this.state;
    if (!s) return;
    if (this.moving) {
      this.moveLeft -= dt;
      if (this.moveLeft <= 0) this.moving = false;
      return;
    }
    const dir = this.heldDir();
    if (!dir) return;
    const prevX = s.player.x;
    const prevY = s.player.y;
    if (!tryMove(s, dir)) {
      this.refresh();
      return;
    }
    this.moving = true;
    this.moveLeft = MOVE_TIME;
    this.fromX = prevX;
    this.fromY = prevY;
    this.toX = s.player.x;
    this.toY = s.player.y;
    this.step = this.step ? 0 : 1;
    this.refresh();
  }

  private heldDir(): Dir | null {
    if (this.touchDir) return this.touchDir;
    if (this.keys.has("w") || this.keys.has("arrowup")) return "n";
    if (this.keys.has("s") || this.keys.has("arrowdown")) return "s";
    if (this.keys.has("a") || this.keys.has("arrowleft")) return "w";
    if (this.keys.has("d") || this.keys.has("arrowright")) return "e";
    return null;
  }

  private draw(time: number): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const s = this.screen === "title" || this.screen === "new" || !this.state ? this.preview : this.state;
    const zoom = this.zoom();
    const player = this.screen === "title" || this.screen === "new" || !this.state
      ? { x: 11, y: 16, facing: "s" as Dir }
      : this.drawPlayer();
    const viewW = this.canvas.width / zoom;
    const viewH = this.canvas.height / zoom;
    const mapW = COLS * 16;
    const mapH = ROWS * 16;
    let targetX = player.x * 16 + 8 - viewW / 2;
    let targetY = player.y * 16 + 8 - viewH / 2;
    if (viewW >= mapW) targetX = (mapW - viewW) / 2;
    else targetX = clamp(targetX, 0, mapW - viewW);
    if (viewH >= mapH) targetY = (mapH - viewH) / 2;
    else targetY = clamp(targetY, 0, mapH - viewH);
    if (this.snap) {
      this.camX = targetX;
      this.camY = targetY;
      this.snap = false;
    } else {
      this.camX += (targetX - this.camX) * 0.18;
      this.camY += (targetY - this.camY) * 0.18;
    }
    const scene: Scene = {
      zoom,
      camX: Math.round(this.camX * zoom) / zoom,
      camY: Math.round(this.camY * zoom) / zoom,
      playerX: player.x,
      playerY: player.y,
      facing: player.facing,
      step: this.step,
      moving: this.moving,
      dogX: this.dogX,
      dogY: this.dogY,
      chickens: this.chickens,
      catX: this.catX,
      catY: this.catY,
      particles: this.particles,
      time,
      showNames: this.screen === "play" || this.screen === "title",
      ui: this.dpr,
      mapTop: (this.touchMode && this.screen === "play" ? 10 : 108) * this.dpr,
    };
    drawWorld(ctx, s, scene);
  }

  private drawPlayer(): { x: number; y: number; facing: Dir } {
    const s = this.state;
    if (!s) return { x: 11, y: 16, facing: "s" };
    if (!this.moving) return { x: s.player.x, y: s.player.y, facing: s.player.facing };
    const t = 1 - Math.max(0, this.moveLeft) / MOVE_TIME;
    return {
      x: this.fromX + (this.toX - this.fromX) * t,
      y: this.fromY + (this.toY - this.fromY) * t,
      facing: s.player.facing,
    };
  }

  private zoom(): number {
    const cssMin = Math.min(this.cssW, this.cssH);
    const cssZoom = Math.max(2, Math.min(4, Math.floor(cssMin / 200)));
    return Math.max(2, Math.round(cssZoom * this.dpr));
  }

  private resize(): void {
    const vv = window.visualViewport;
    const height = Math.round(vv?.height ?? window.innerHeight);
    const top = Math.round(vv?.offsetTop ?? 0);
    document.documentElement.style.setProperty("--app-h", `${height}px`);
    document.documentElement.style.setProperty("--app-top", `${top}px`);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));
    const nextW = Math.max(1, Math.round(cssW * dpr));
    const nextH = Math.max(1, Math.round(cssH * dpr));
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    if (this.canvas.width !== nextW || this.canvas.height !== nextH) {
      this.canvas.width = nextW;
      this.canvas.height = nextH;
    }
  }

  private syncChrome(): void {
    document.documentElement.classList.toggle("touch", this.touchMode);
    document.documentElement.classList.toggle("playing", this.screen === "play" && !!this.state);
  }

  private bindTouch(): void {
    const pad = this.touch.querySelector<HTMLElement>(".pad");
    if (pad) {
      const point = (e: PointerEvent) => {
        const buttons = [...pad.querySelectorAll<HTMLElement>("[data-dir]")];
        let best: { dir: Dir; d: number } | null = null;
        for (const b of buttons) {
          const dir = b.dataset.dir;
          if (dir !== "n" && dir !== "s" && dir !== "e" && dir !== "w") continue;
          const r = b.getBoundingClientRect();
          const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
          if (!best || d < best.d) best = { dir, d };
        }
        this.setTouchDir(best && best.d <= 78 ? best.dir : null);
      };
      pad.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pad.setPointerCapture(e.pointerId);
        this.audio.unlock();
        point(e);
      });
      pad.addEventListener("pointermove", (e) => {
        if (!pad.hasPointerCapture(e.pointerId)) return;
        point(e);
      });
      const clear = (e: PointerEvent) => {
        if (pad.hasPointerCapture(e.pointerId)) pad.releasePointerCapture(e.pointerId);
        this.setTouchDir(null);
      };
      pad.addEventListener("pointerup", clear);
      pad.addEventListener("pointercancel", clear);
    }
    this.touch.querySelector("#touch-use")?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.audio.unlock();
      this.doInteract();
    });
    this.touch.querySelector("#touch-compost")?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.audio.unlock();
      if (this.state && this.screen === "play") this.after(useCompost(this.state));
    });
  }

  private setTouchDir(dir: Dir | null): void {
    this.touchDir = dir;
    this.touch.querySelectorAll<HTMLElement>("[data-dir]").forEach((el) => {
      el.classList.toggle("held", el.dataset.dir === dir);
    });
  }

  private current(): GameState {
    return this.state ?? this.preview;
  }

  private onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const key = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key) || key === " ") e.preventDefault();
    this.audio.unlock();
    if (key === "escape") {
      this.onEscape();
      return;
    }
    if (e.key === "Enter") {
      const btn =
        this.overlay.querySelector<HTMLButtonElement>(".primary:not(:disabled)") ??
        this.overlay.querySelector<HTMLButtonElement>(".choice:not(:disabled)");
      btn?.click();
      return;
    }
    if (this.screen === "event" || this.screen === "talk") {
      const n = Number(e.key);
      if (n >= 1 && n <= 9) this.act(this.screen === "event" ? `event:${n - 1}` : `talk:${n - 1}`);
      return;
    }
    if (this.screen !== "play" || !this.state) {
      this.keys.add(key);
      return;
    }
    if (e.repeat) {
      this.keys.add(key);
      return;
    }
    this.keys.add(key);
    if (key === "e" || e.key === " ") this.doInteract();
    else if (key === "1") this.pickSeed("wheat");
    else if (key === "2") this.pickSeed("potato");
    else if (key === "3") this.pickSeed("beans");
    else if (key === "4") this.pickSeed("corn");
    else if (key === "5") this.pickSeed("apple");
    else if (key === "c") this.after(useCompost(this.state));
    else if (key === "h" || key === "?") this.openHelp();
    else if (key === "l") this.screen = "ledger";
    else if (key === "k") this.screen = "family";
    else if (key === "m") this.say(this.audio.toggle() ? "The valley goes quiet." : "The valley hums again.");
    else if (key === "f") this.after(debugAdvanceYear(this.state));
    else if (key === "g") {
      debugPrepareSuccession(this.state);
      this.state.resumeScreen = "succession";
      this.screen = "succession";
      this.armSuccession();
      this.say("The years gather for a handing-over.");
    } else if (key === "v") {
      debugForceEvent(this.state);
      this.screen = "event";
    } else if (e.key === "0") {
      debugToEpilogue(this.state);
      this.screen = "epilogue";
      saveGame(this.state);
    }
    this.refresh();
  }

  private onEscape(): void {
    if (this.screen === "play") {
      this.returnTo = "play";
      this.screen = "pause";
    } else if (this.screen === "pause" || this.screen === "help" || this.screen === "ledger" || this.screen === "family" || this.screen === "shop" || this.screen === "home" || this.screen === "talk") {
      this.closePanel();
    } else if (this.screen === "summary") this.closeSummary();
    this.refresh();
  }

  private onClick(e: MouseEvent): void {
    const node = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
    if (!node) return;
    const act = node.dataset.act;
    if (!act || (node as HTMLButtonElement).disabled) return;
    this.audio.unlock();
    this.audio.play("ui");
    this.act(act);
  }

  private act(act: string): void {
    if (act === "title") {
      if (this.state) saveGame(this.state);
      this.screen = "title";
      this.snap = true;
      this.refresh();
      return;
    }
    if (act === "new") {
      this.draftCoat = "russet";
      this.screen = "new";
      this.refresh();
      return;
    }
    if (act === "help") {
      this.openHelp();
      this.refresh();
      return;
    }
    if (act === "continue") {
      const loaded = loadGame();
      if (!loaded) {
        this.say("No save was in the cupboard.");
        this.refresh();
        return;
      }
      this.adopt(loaded);
      return;
    }
    if (act.startsWith("coat:")) {
      this.draftCoat = act.slice(5) as Coat;
      const label = document.getElementById("coat-label");
      if (label) label.textContent = `Coat: ${this.draftCoat}`;
      return;
    }
    if (act === "begin") {
      const given = (document.getElementById("given") as HTMLInputElement | null)?.value ?? "Ellis";
      const family = (document.getElementById("family") as HTMLInputElement | null)?.value ?? "Whitaker";
      this.begin({ given, family, coat: this.draftCoat });
      return;
    }
    const s = this.state;
    if (!s) {
      if (act === "close") this.screen = "title";
      this.refresh();
      return;
    }
    if (act === "close") {
      if (this.screen === "summary") this.closeSummary();
      else if (this.screen === "stories") {
        s.pendingStories = [];
        s.resumeScreen = "play";
        this.screen = "play";
      } else if (this.screen === "help") {
        s.flags.seenHelp = true;
        this.closePanel();
      } else this.closePanel();
      saveGame(s);
      this.refresh();
      return;
    }
    if (act === "sleep") {
      this.after(sleepThrough(s));
      return;
    }
    if (act === "family") {
      this.returnTo = this.screen === "play" ? "play" : this.screen;
      this.screen = "family";
      this.refresh();
      return;
    }
    if (act === "ledger") {
      this.screen = "ledger";
      this.refresh();
      return;
    }
    if (act === "pause") {
      this.screen = "pause";
      this.refresh();
      return;
    }
    if (act === "save") {
      saveGame(s);
      this.say("Saved in this browser.");
      this.refresh();
      return;
    }
    if (act === "debug-year") {
      this.after(debugAdvanceYear(s));
      return;
    }
    if (act === "debug-event") {
      debugForceEvent(s);
      this.screen = "event";
      this.refresh();
      return;
    }
    if (act === "debug-heir") {
      debugPrepareSuccession(s);
      s.resumeScreen = "succession";
      this.screen = "succession";
      this.armSuccession();
      this.say("The years gather for a handing-over.");
      this.refresh();
      return;
    }
    if (act === "debug-end") {
      debugToEpilogue(s);
      this.screen = "epilogue";
      saveGame(s);
      this.refresh();
      return;
    }
    if (act === "sound") {
      this.say(this.audio.toggle() ? "The valley goes quiet." : "The valley hums again.");
      this.refresh();
      return;
    }
    if (act === "family-time") {
      if (openFamilyEvent(s)) this.screen = "event";
      this.refresh();
      return;
    }
    if (act.startsWith("seed:")) {
      const id = act.slice(5);
      if (id === "apple" || id === "wheat" || id === "potato" || id === "beans" || id === "corn") {
        this.pickSeed(id);
      }
      return;
    }
    if (act.startsWith("event:")) {
      const outcome = resolveChoice(s, Number(act.slice(6)));
      this.audio.play("chime");
      this.say(outcome.text);
      if (outcome.succession) {
        s.resumeScreen = "succession";
        this.screen = "succession";
        this.armSuccession();
      } else if (s.gameOver) this.screen = "epilogue";
      else this.screen = "play";
      saveGame(s);
      this.refresh();
      return;
    }
    if (act.startsWith("talk:")) {
      if (!this.talk) return;
      const choice = this.talk.choices[Number(act.slice(5))];
      if (!choice) return;
      const result = applyTalk(s, this.talk.actorKey, choice.effect);
      if (choice.effect.type !== "leave") this.after(result, true);
      this.screen = "play";
      this.talk = null;
      this.refresh();
      return;
    }
    if (act.startsWith("shop:")) {
      this.after(applyShop(s, act.slice(5)), true);
      saveGame(s);
      this.refresh();
      return;
    }
    if (act.startsWith("heir:")) {
      this.heirId = act.slice(5);
      this.refresh();
      return;
    }
    if (act.startsWith("keep:")) {
      const id = act.slice(5);
      if (this.keeps.includes(id)) this.keeps = this.keeps.filter((k) => k !== id);
      else if (this.keeps.length < 3) this.keeps = [...this.keeps, id];
      else this.say("Three things. That's the rule of the box.");
      this.refresh();
      return;
    }
    if (act === "confirm-heir" && this.heirId) {
      const result = passFarm(s, this.heirId, this.keeps);
      this.heirId = null;
      this.keeps = [];
      this.snap = true;
      this.moving = false;
      this.screen = result.epilogue ? "epilogue" : "stories";
      saveGame(s);
      this.refresh();
      return;
    }
    if (act === "defer") {
      s.flags.deferRetire = s.year;
      s.resumeScreen = "play";
      s.successionForced = false;
      this.screen = "play";
      this.say("You hang the keys back up.");
      saveGame(s);
      this.refresh();
    }
  }

  private armSuccession(): void {
    if (!this.state) return;
    const first = eligibleChildren(this.state)[0];
    this.heirId = first?.id ?? "cousin";
    this.keeps = [];
  }

  private begin(opts: NewGameOptions): void {
    this.state = createNewGame(opts);
    this.screen = "help";
    this.returnTo = "play";
    this.snap = true;
    this.moving = false;
    this.dogX = this.state.player.x;
    this.dogY = this.state.player.y + 0.4;
    saveGame(this.state);
    this.say(`The ${this.state.familyName} farm is yours.`);
    this.refresh();
  }

  private adopt(state: GameState): void {
    this.state = state;
    this.snap = true;
    this.moving = false;
    if (state.gameOver) this.screen = "epilogue";
    else if (state.resumeScreen === "succession") {
      this.screen = "succession";
      this.armSuccession();
    }
    else if (state.resumeScreen === "stories" && state.pendingStories.length) this.screen = "stories";
    else if (state.pendingEvent) this.screen = "event";
    else this.screen = "play";
    this.say(`Welcome back, ${state.playerName}.`);
    this.refresh();
  }

  private doInteract(): void {
    if (!this.state || this.screen !== "play") return;
    const result = interact(this.state);
    if (result.open === "talk" && result.actorKey) {
      const actor = actors(this.state).find((a) => a.key === result.actorKey);
      this.talk = actor ? talkModel(this.state, actor) : null;
      this.screen = this.talk ? "talk" : "play";
    } else if (result.open === "shop") this.screen = "shop";
    else if (result.open === "home") this.screen = "home";
    this.after(result, true);
    this.refresh();
  }

  private pickSeed(id: "wheat" | "potato" | "beans" | "corn" | "apple"): void {
    if (!this.state) return;
    selectSeed(this.state, id);
    this.refresh();
  }

  private after(result: { ok: boolean; toast?: string; sfx?: string; floats?: { x: number; y: number; text: string; color: string }[]; summary?: { title: string; lines: string[] } }, keepScreen = false): void {
    if (result.toast) this.say(result.toast);
    if (result.sfx) this.audio.play(result.sfx);
    for (const f of result.floats ?? []) {
      this.particles.push({
        x: f.x + 0.2,
        y: f.y,
        vx: 0,
        vy: -0.8,
        life: 1.1,
        max: 1.1,
        color: f.color,
        text: f.text,
        size: 1,
      });
    }
    if (result.summary) {
      this.summary = result.summary;
      this.screen = "summary";
      this.snap = true;
      this.moving = false;
      if (this.state) saveGame(this.state);
    } else if (!keepScreen && this.screen !== "shop") {
      /* stay */
    }
    this.refresh();
  }

  private closeSummary(): void {
    if (!this.state) {
      this.screen = "play";
      return;
    }
    this.summary = null;
    if (this.state.pendingEvent) this.screen = "event";
    else this.screen = "play";
  }

  private closePanel(): void {
    if (this.screen === "help" && !this.state) {
      this.screen = "title";
      return;
    }
    this.screen = "play";
    if (this.state) this.state.resumeScreen = "play";
  }

  private openHelp(): void {
    this.returnTo = this.state ? "play" : "title";
    this.screen = "help";
  }

  private say(text: string): void {
    this.toast = text;
    this.toastLeft = 3.6;
  }

  private bag(): UiBag {
    return {
      screen: this.screen,
      state: this.state,
      hasSave: hasSave(),
      summary: this.summary,
      talk: this.talk,
      toast: this.toast,
      heirId: this.heirId,
      keeps: this.keeps,
      returnTo: this.returnTo,
    };
  }

  private refresh(): void {
    if (this.screen !== "play") this.setTouchDir(null);
    this.syncChrome();
    const bag = this.bag();
    const sig = JSON.stringify({
      screen: bag.screen,
      toast: bag.toast,
      heir: bag.heirId,
      keeps: bag.keeps,
      has: bag.hasSave,
      sum: bag.summary?.title ?? "",
      lines: bag.summary?.lines?.length ?? 0,
      talk: bag.talk?.text ?? "",
      fp: fingerprint(bag.state),
    });
    if (sig === this.domSig) return;
    this.domSig = sig;
    this.hud.innerHTML = hudHtml(bag);
    this.overlay.innerHTML = overlayHtml(bag);
    paintPortraits(this.overlay, bag);
    this.resize();
  }
}

function fingerprint(s: GameState | null): string {
  if (!s) return "0";
  return [
    s.playerName,
    s.familyName,
    s.generation,
    s.year,
    s.season,
    s.day,
    s.minutes,
    s.money,
    s.debt,
    s.energy,
    s.weather,
    s.player.x,
    s.player.y,
    s.player.facing,
    s.selected,
    s.pendingEvent ?? "",
    s.resumeScreen,
    s.seeds.wheat,
    s.seeds.potato,
    s.seeds.beans,
    s.seeds.corn,
    s.harvest.wheat,
    s.harvest.corn,
    s.apples,
    s.saplings,
    s.compost,
    s.spouseId ?? "",
    s.children.length,
    Object.values(s.tutorial).map((v) => (v ? 1 : 0)).join(""),
    s.gameOver ? 1 : 0,
    s.keptHeirlooms.length,
    s.soldParcels.join("."),
  ].join(":");
}
