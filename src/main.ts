import "./style.css";
import { Game } from "./game/game";

const canvas = document.querySelector<HTMLCanvasElement>("#view");
const hud = document.querySelector<HTMLElement>("#hud");
const overlay = document.querySelector<HTMLElement>("#overlay");

if (!canvas || !hud || !overlay) {
  throw new Error("Hearthland is missing its page.");
}

const game = new Game(canvas, hud, overlay);
game.start();
