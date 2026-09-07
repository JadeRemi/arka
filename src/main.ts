import { Game } from "./app/Game";
import { Input } from "./core/Input";
import { Loop } from "./core/Loop";
import { Viewport } from "./core/Viewport";

const canvas = document.getElementById("stage");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("main: #stage canvas not found");
}

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const game = new Game(viewport, input);

const loop = new Loop({
  update: (dt) => game.update(dt),
  draw: (alpha) => {
    game.draw(alpha);
    game.sampleFrame(loop.frameMs);
  },
});

/**
 * A run loop must not outlive its page: on navigation the RAF handle, the listeners and the
 * offscreen buffers all have to go, or a reloaded tab leaves a simulation running behind it.
 */
function shutdown(): void {
  loop.dispose();
  game.dispose();
  input.dispose();
  viewport.dispose();
}

window.addEventListener("pagehide", shutdown);
window.addEventListener("beforeunload", shutdown);

loop.start();
canvas.focus();
