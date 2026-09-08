import { PACING } from "../config/feel";
import { silentAudio, type Audio } from "../core/Audio";
import type { Input } from "../core/Input";
import type { LoopHandlers } from "../core/Loop";
import { Profiler } from "../core/Profiler";
import { DESIGN_H, DESIGN_W, type Viewport } from "../core/Viewport";
import { FIELD, WALL } from "../game/field";
import { World, type WorldEvent } from "../game/World";
import { generateLevel, type LevelSpec } from "../level/generate";
import { clamp01 } from "../math/scalar";
import { Background } from "../render/Background";
import { Post, type PostOptions } from "../render/Post";
import { drawBrick } from "../render/painters/bricks";
import { drawBall, drawField, drawPaddle } from "../render/painters/entities";
import { drawDust, drawPops, drawRings, drawShards, drawSparks } from "../render/painters/effects";
import { drawDrops } from "../render/painters/drops";
import { BONE, EMBER, STEEL, VOID, withAlpha } from "../render/palette";
import { drawText } from "../render/text";
import { Hud } from "../ui/Hud";
import { WidgetTree, type PointerState } from "../ui/Widget";
import { buildOptions, defaultSettings, drawOptions, type Settings } from "../ui/screens/Options";
import { buildTitle, drawTitle } from "../ui/screens/Title";
import { drawLevelIntro } from "../ui/screens/LevelIntro";
import { drawRotateHint } from "../ui/screens/RotateHint";
import { IconButton } from "../ui/widgets/IconButton";
import {
  buildGameOver,
  buildLevelClear,
  buildPause,
  drawGameOver,
  drawLaunchPrompt,
  drawLevelClear,
  drawLifeLost,
  drawLockPrompt,
  drawPause,
} from "../ui/screens/Overlays";
import type { LevelBreakdown } from "../game/Score";

type State = "title" | "options" | "playing" | "paused" | "levelClear" | "gameOver";

const TRANSITION = PACING.transition;
/** Hit margin added to every widget while touch input is in use. */
const TOUCH_HIT_PADDING = 14;

/**
 * Top-level state machine. Owns the single update path and the single draw path: `update` is
 * pure simulation and `draw` never mutates game state, which is what makes the interpolated
 * render safe.
 */
export class Game implements LoopHandlers {
  private state: State = "title";
  private previousState: State = "title";
  private readonly world = new World();
  private readonly background = new Background();
  private readonly post = new Post();
  private readonly hud = new Hud();
  private readonly tree = new WidgetTree();
  /** Always-on touch controls, dispatched separately from the per-screen tree. */
  private readonly touchTree = new WidgetTree();
  private touchPause: IconButton | undefined;
  private readonly profiler = new Profiler();
  private readonly settings: Settings = defaultSettings();
  private readonly audio: Audio = silentAudio;

  private readonly frame: CanvasRenderingContext2D;
  private readonly events: WorldEvent[] = [];
  private readonly pointer: PointerState = {
    x: 0,
    y: 0,
    down: false,
    pressed: false,
    released: false,
  };

  private time = 0;
  private runSeed = 0;
  private levelSpec: LevelSpec | undefined;
  private breakdown: LevelBreakdown | undefined;
  private revealT = 0;
  private transition = 0;
  private pendingState: State | undefined;
  private lifeLostFlash = 0;
  private bestScore = 0;
  private keyboardFocus = false;
  private disposed = false;
  private introSpec: LevelSpec | undefined;
  private introT = 0;

  constructor(
    private readonly viewport: Viewport,
    private readonly input: Input,
  ) {
    const c = document.createElement("canvas");
    c.width = DESIGN_W;
    c.height = DESIGN_H;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Game: 2D context unavailable");
    this.frame = ctx;

    this.touchPause = this.touchTree.add(new IconButton(DESIGN_W - 74, 14, 54, "pause"));
    this.touchPause.focusable = false;
    this.touchPause.onPress = () => {
      if (this.state === "playing") this.go("paused");
    };
    this.touchTree.setHitPadding(TOUCH_HIT_PADDING);

    this.runSeed = (Math.random() * 0xffffffff) >>> 0;
    this.background.build(this.runSeed);
    this.enterTitle();
  }

  // ---- state entry ------------------------------------------------------------------------

  private go(state: State): void {
    this.pendingState = state;
    this.transition = TRANSITION;
  }

  private applyState(state: State): void {
    this.previousState = this.state;
    this.state = state;
    // Every state other than play needs a real cursor to aim with, so the lock is dropped on
    // the way out rather than per-screen.
    if (state !== "playing") this.input.releaseLock();
    switch (state) {
      case "title":
        this.enterTitle();
        break;
      case "options":
        buildOptions(this.tree, this.settings, () => this.go(this.previousState === "paused" ? "paused" : "title"));
        break;
      case "playing":
        this.tree.clear();
        this.updateMouseLock();
        break;
      case "paused":
        buildPause(
          this.tree,
          () => this.go("playing"),
          () => this.startRun(),
          () => this.go("title"),
        );
        break;
      case "levelClear":
        this.revealT = 0;
        buildLevelClear(this.tree, () => this.nextLevel());
        break;
      case "gameOver":
        if (this.world.score.total > this.bestScore) this.bestScore = this.world.score.total;
        buildGameOver(
          this.tree,
          () => this.startRun(),
          () => this.go("title"),
        );
        break;
    }
  }

  private enterTitle(): void {
    buildTitle(this.tree, {
      onStart: () => this.startRun(),
      onOptions: () => this.go("options"),
    });
    this.state = "title";
  }

  private startRun(): void {
    this.runSeed = (Math.random() * 0xffffffff) >>> 0;
    this.levelSpec = generateLevel(1, this.runSeed);
    this.world.startRun(this.runSeed);
    this.world.loadLevel(1, this.runSeed, this.levelSpec);
    this.background.build(this.levelSpec.backdropSeed);
    this.hud.reset();
    this.breakdown = undefined;
    this.beginIntro();
    this.go("playing");
  }

  private nextLevel(): void {
    const level = this.world.level + 1;
    this.levelSpec = generateLevel(level, this.runSeed);
    this.world.loadLevel(level, this.runSeed, this.levelSpec);
    this.background.build(this.levelSpec.backdropSeed);
    this.beginIntro();
    this.go("playing");
  }

  private beginIntro(): void {
    this.introSpec = this.levelSpec;
    this.introT = PACING.levelIntro;
  }

  // ---- update -----------------------------------------------------------------------------

  update(dt: number): void {
    if (this.disposed) return;
    this.time += dt;
    this.lifeLostFlash = Math.max(0, this.lifeLostFlash - dt);

    if (this.transition > 0) {
      this.transition -= dt;
      // Swap state at the midpoint, while the wipe fully covers the screen.
      if (this.transition <= TRANSITION * 0.5 && this.pendingState) {
        const next = this.pendingState;
        this.pendingState = undefined;
        this.applyState(next);
      }
      if (this.transition < 0) this.transition = 0;
    }

    this.syncPointer();
    this.handleKeys();

    // Losing the lock mid-rally means the player pressed Escape or the window lost focus.
    // Pausing is the only sane response: the alternative is a live ball and a frozen paddle.
    if (this.input.lockLost && this.state === "playing" && !this.pendingState) {
      this.go("paused");
    }

    const uiActive = this.state !== "playing";
    if (uiActive) this.tree.update(this.pointer, dt, this.keyboardFocus);

    // The touch pause button lives outside the per-screen tree so it survives state changes,
    // and it swallows the press that would otherwise launch the ball.
    const touchVisible = this.input.touchMode && this.state === "playing";
    if (touchVisible) this.touchTree.update(this.pointer, dt, false);

    if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);

    if (this.state === "playing") this.updateMouseLock();

    if (this.state === "playing" || this.state === "levelClear") {
      const pointerX = this.input.pointerActive ? this.input.pointerX : undefined;
      const axis = this.input.axisX();
      if (axis !== 0) this.keyboardFocus = true;
      this.world.step(this.state === "playing" ? dt : dt, pointerX, axis, this.input.pointerActive);
      this.background.update(dt, this.world.ball.pos.x);
      this.hud.update(this.world, dt);
      this.drainWorldEvents();

      // Pin the virtual cursor to the paddle so the two cannot drift apart at the field edges.
      const paddle = this.world.paddle;
      this.input.syncLockedPointer(paddle.targetX, paddle.minX, paddle.maxX);
    }

    if (this.state === "levelClear") this.revealT = clamp01(this.revealT + dt * 0.9);

    this.input.endStep();
  }

  private syncPointer(): void {
    this.pointer.x = this.input.pointerX;
    this.pointer.y = this.input.pointerY;
    this.pointer.down = this.input.pointerDown;
    this.pointer.pressed = this.input.pointerPressed;
    this.pointer.released = this.input.pointerReleased;
    if (this.pointer.pressed) this.keyboardFocus = false;
  }

  private handleKeys(): void {
    const input = this.input;
    if (input.wasPressed("F3")) this.profiler.visible = !this.profiler.visible;

    if (input.wasPressed("Tab", "ArrowDown")) {
      this.keyboardFocus = true;
      this.tree.moveFocus(1);
    }
    if (input.wasPressed("ArrowUp")) {
      this.keyboardFocus = true;
      this.tree.moveFocus(-1);
    }

    switch (this.state) {
      case "title":
        if (input.wasPressed("Enter", " ")) {
          if (this.keyboardFocus) this.tree.activateFocused();
          else this.startRun();
        }
        break;

      case "options":
        if (input.wasPressed("Enter")) this.tree.activateFocused();
        if (input.wasPressed("Escape")) this.go(this.previousState === "paused" ? "paused" : "title");
        break;

      case "playing": {
        if (input.wasPressed("Escape", "p")) this.go("paused");
        const onPauseButton =
          this.input.touchMode &&
          this.touchPause !== undefined &&
          this.touchPause.hits(this.pointer.x, this.pointer.y);
        if (input.wasPressed(" ") || (this.pointer.pressed && !onPauseButton)) {
          this.world.launch();
        }
        // A click carries the transient user activation the lock request needs, so an earlier
        // refusal (from starting the level with the keyboard) recovers here.
        if (this.pointer.pressed && !onPauseButton) this.updateMouseLock();
        break;
      }

      case "paused":
        if (input.wasPressed("Escape", "p")) this.go("playing");
        if (input.wasPressed("Enter")) this.tree.activateFocused();
        break;

      case "levelClear":
        if (input.wasPressed("Enter", " ")) this.nextLevel();
        break;

      case "gameOver":
        if (input.wasPressed("Enter", " ")) this.startRun();
        if (input.wasPressed("Escape")) this.go("title");
        break;
    }
  }

  /** Holds the lock while playing with a mouse, if the player has not turned it off. */
  private updateMouseLock(): void {
    if (this.state !== "playing" || this.input.touchMode || !this.settings.mouseLock) {
      if (this.input.locked) this.input.releaseLock();
      return;
    }
    const paddle = this.world.paddle;
    this.input.requestLock(paddle.minX, paddle.maxX);
  }

  private drainWorldEvents(): void {
    this.events.length = 0;
    this.world.drainEvents(this.events);
    for (const e of this.events) {
      switch (e.type) {
        case "brick.hit":
          this.audio.play("brick.hit");
          break;
        case "brick.break":
          this.audio.play("brick.break");
          break;
        case "brick.steel":
          this.audio.play("brick.steel");
          break;
        case "explosion":
          this.audio.play("explosion");
          break;
        case "paddle":
          this.audio.play("paddle");
          break;
        case "wall":
          this.audio.play("wall");
          break;
        case "life.lost":
          this.audio.play("life.lost");
          this.lifeLostFlash = 1.4;
          break;
        case "level.clear":
          this.audio.play("level.clear");
          this.breakdown = this.world.score.finishLevel();
          this.go("levelClear");
          break;
        case "game.over":
          this.audio.play("game.over");
          this.go("gameOver");
          break;
      }
    }
  }

  // ---- draw -------------------------------------------------------------------------------

  draw(alpha: number): void {
    if (this.disposed) return;
    const ctx = this.frame;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = VOID[0];
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    this.background.draw(ctx, this.time);

    const showWorld = this.state !== "title" && this.state !== "options";
    if (showWorld) this.drawWorld(ctx, alpha);

    switch (this.state) {
      case "title":
        drawTitle(ctx, this.time, this.bestScore, this.input.touchMode);
        break;
      case "options":
        drawOptions(ctx);
        break;
      case "paused":
        drawPause(ctx);
        break;
      case "levelClear":
        if (this.breakdown) {
          drawLevelClear(
            ctx,
            this.world.level,
            this.breakdown,
            this.world.score.total,
            this.revealT,
          );
        }
        break;
      case "gameOver":
        drawGameOver(
          ctx,
          this.world.score.total,
          this.world.level,
          this.world.score.bestCombo,
          this.world.score.total >= this.bestScore && this.world.score.total > 0,
          this.time,
        );
        break;
      case "playing":
        if (this.introSpec && this.introT > 0) {
          drawLevelIntro(ctx, this.introSpec, 1 - this.introT / PACING.levelIntro);
        }
        if (
          this.world.allDocked &&
          this.world.respawnDelay <= 0 &&
          this.world.introDelay <= 0
        ) {
          drawLaunchPrompt(ctx, this.time, this.input.touchMode);
        }
        if (
          this.settings.mouseLock &&
          !this.input.touchMode &&
          !this.input.locked &&
          this.introT <= 0
        ) {
          drawLockPrompt(ctx, this.time);
        }
        if (this.lifeLostFlash > 0 && this.world.lives > 0) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, this.lifeLostFlash);
          drawLifeLost(ctx, this.world.lives);
          ctx.restore();
        }
        break;
    }

    this.tree.draw(ctx, this.time, this.keyboardFocus);
    if (this.input.touchMode && this.state === "playing") {
      this.touchTree.draw(ctx, this.time, false);
    }

    const options: PostOptions = {
      bloom: this.settings.bloom,
      scanlines: this.settings.scanlines,
      vignette: this.settings.vignette,
      chromatic: true,
    };
    this.post.apply(ctx, ctx.canvas, options, this.world.shake.chroma);

    if (this.transition > 0) {
      const t = 1 - Math.abs(this.transition / TRANSITION - 0.5) * 2;
      Post.wipe(ctx, t);
    }

    // A portrait touch device would letterbox the 16:9 field into an unplayable strip, so it
    // gets a rotate prompt over the top of everything instead.
    if (this.input.touchMode && this.viewport.deviceH > this.viewport.deviceW) {
      drawRotateHint(ctx, this.time);
    }

    if (this.profiler.visible) this.drawProfiler(ctx);

    // The cursor is only hidden during play. Hiding it everywhere left the menus with no
    // visible pointer at all, which made them guesswork with a mouse.
    this.viewport.canvas.classList.toggle("in-play", this.state === "playing");

    // Blit the design-space frame to the real canvas.
    this.viewport.begin();
    this.viewport.ctx.drawImage(ctx.canvas, 0, 0);
  }

  private drawWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const world = this.world;

    ctx.save();
    if (this.settings.shake) ctx.translate(world.shake.offsetX, world.shake.offsetY);

    drawField(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, WALL);

    for (const brick of world.grid.bricks) drawBrick(ctx, brick, this.time);

    drawShards(ctx, world.shards);
    drawDust(ctx, world.dust);
    drawRings(ctx, world.rings);
    drawSparks(ctx, world.sparks);

    drawPaddle(ctx, world.paddle, this.time);

    // Interpolate each ball between its previous and current step positions.
    for (const b of world.balls) {
      const realX = b.pos.x;
      const realY = b.pos.y;
      if (!b.docked) {
        b.pos.x = b.prev.x + (realX - b.prev.x) * alpha;
        b.pos.y = b.prev.y + (realY - b.prev.y) * alpha;
      }
      drawBall(ctx, b, this.time);
      b.pos.x = realX;
      b.pos.y = realY;
    }

    drawDrops(ctx, world.drops);
    drawPops(ctx, world.pops);
    ctx.restore();

    this.hud.draw(ctx, world, this.time);
  }

  private drawProfiler(ctx: CanvasRenderingContext2D): void {
    const w = 220;
    const h = 92;
    const x = DESIGN_W - w - 14;
    const y = DESIGN_H - h - 14;
    ctx.save();
    ctx.fillStyle = withAlpha(VOID[0], 0.8);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha(STEEL[2], 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    const graphH = 40;
    const n = this.profiler.length;
    for (let i = 0; i < n; i++) {
      const v = Math.min(1, this.profiler.frameAt(i) / 16.7);
      const bx = x + 6 + (i * (w - 12)) / n;
      const bh = v * graphH;
      ctx.fillStyle = v > 0.8 ? EMBER[0] : v > 0.5 ? EMBER[2] : BONE[0];
      ctx.fillRect(bx, y + 8 + graphH - bh, (w - 12) / n, bh);
    }

    drawText(
      ctx,
      `${this.profiler.average.toFixed(1)}ms  peak ${this.profiler.worst.toFixed(1)}`,
      x + 6,
      y + 56,
      { size: 10, color: BONE[1], tracking: 0.18 },
    );
    drawText(
      ctx,
      `shards ${this.world.shards.count}  dust ${this.world.dust.count}  bricks ${this.world.grid.countAlive()}`,
      x + 6,
      y + 72,
      { size: 9, color: STEEL[3], tracking: 0.14 },
    );
    ctx.restore();
  }

  sampleFrame(ms: number): void {
    this.profiler.sample(ms);
  }

  dispose(): void {
    this.disposed = true;
    this.input.releaseLock();
    this.post.dispose();
    this.tree.clear();
  }
}
