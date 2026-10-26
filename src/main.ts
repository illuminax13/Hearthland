import "./style.css";
import { Game } from "./game/game";

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const hud = document.querySelector<HTMLElement>("#hud");
const overlay = document.querySelector<HTMLElement>("#overlay");
const touch = document.querySelector<HTMLElement>("#touch");

if (!canvas || !hud || !overlay || !touch) {
  throw new Error("Hearthland is missing its page.");
}

const game = new Game(canvas, hud, overlay, touch);
game.start();
