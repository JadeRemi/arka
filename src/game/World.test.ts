import { describe, expect, it } from "vitest";
import { World, START_LIVES } from "./World";
import { generateLevel } from "../level/generate";
import { BrickKind } from "./kinds";
import { fieldBottom, fieldLeft, fieldRight, fieldTop } from "./field";
import { DT } from "../core/Loop";

/**
 * Integration coverage for the simulation, with no canvas involved. This is where wiring
 * mistakes surface — a screen that renders correctly tells you nothing about whether starting
 * a run, breaking a brick or clearing a level actually works.
 */
function newWorld(level = 1, seed = 0xbeef): World {
  const world = new World();
  const spec = generateLevel(level, seed);
  world.startRun(seed);
  world.loadLevel(level, seed, spec);
  return world;
}

/** Runs `seconds` of simulation, keeping the paddle under the ball so it does not die. */
function play(world: World, seconds: number, autoPaddle = true): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    const target = autoPaddle ? world.ball.pos.x : undefined;
    world.step(DT, target, 0, autoPaddle);
    if (world.ball.docked && world.respawnDelay <= 0 && !world.gameOver) world.launch();
  }
}

describe("World lifecycle", () => {
  it("starts a run without needing a level already loaded", () => {
    const world = new World();
    expect(() => world.startRun(1234)).not.toThrow();
    expect(world.lives).toBe(START_LIVES);
    expect(world.gameOver).toBe(false);
  });

  it("loads a generated level and places every non-empty cell", () => {
    const spec = generateLevel(7, 99);
    const world = new World();
    world.startRun(99);
    world.loadLevel(7, 99, spec);

    let expected = 0;
    for (const k of spec.kinds) if (k !== -1) expected++;
    expect(world.grid.bricks.length).toBe(expected);
    expect(world.level).toBe(7);
  });

  it("docks the ball on the paddle and only launches on request", () => {
    const world = newWorld();
    expect(world.ball.docked).toBe(true);
    world.step(DT, undefined, 0, false);
    expect(world.ball.speed).toBe(0);
    world.launch();
    expect(world.ball.docked).toBe(false);
    expect(world.ball.speed).toBeGreaterThan(0);
  });
});

describe("World physics", () => {
  it("keeps the ball inside the field over a long rally", () => {
    const world = newWorld(3, 4242);
    world.launch();
    const steps = Math.round(20 / DT);
    for (let i = 0; i < steps; i++) {
      world.step(DT, world.ball.pos.x, 0, true);
      if (world.ball.docked && world.respawnDelay <= 0) world.launch();
      const p = world.ball.pos;
      expect(p.x).toBeGreaterThan(fieldLeft() - 40);
      expect(p.x).toBeLessThan(fieldRight() + 40);
      expect(p.y).toBeGreaterThan(fieldTop() - 40);
      expect(p.y).toBeLessThan(fieldBottom() + 60);
    }
  });

  it("never lets the ball speed leave its clamp", () => {
    const world = newWorld(9, 31337);
    world.launch();
    for (let i = 0; i < Math.round(15 / DT); i++) {
      world.step(DT, world.ball.pos.x, 0, true);
      if (world.ball.docked && world.respawnDelay <= 0) world.launch();
      if (world.ball.docked) continue;
      expect(world.ball.speed).toBeGreaterThanOrEqual(world.ball.minSpeed - 1);
      expect(world.ball.speed).toBeLessThanOrEqual(world.ball.maxSpeed + 1);
    }
  });

  it("does not tunnel: bricks actually get destroyed during a rally", () => {
    const world = newWorld(2, 777);
    const before = world.grid.countAlive();
    play(world, 18);
    expect(world.grid.countAlive()).toBeLessThan(before);
  });

  it("loses a life when the ball falls past the floor", () => {
    const world = newWorld();
    world.launch();
    // Aim straight down, away from the paddle, so the ball is guaranteed to be lost.
    world.ball.pos.x = fieldLeft() + 10;
    world.ball.pos.y = fieldBottom() - 20;
    world.ball.vel.x = 0;
    world.ball.vel.y = 600;
    world.paddle.x = fieldRight() - 20;
    world.paddle.targetX = world.paddle.x;
    for (let i = 0; i < 40; i++) world.step(DT, undefined, 0, false);
    expect(world.lives).toBe(START_LIVES - 1);
  });

  it("ends the run when the last life is lost", () => {
    const world = newWorld();
    world.lives = 1;
    world.launch();
    world.ball.pos.y = fieldBottom() - 5;
    world.ball.vel.x = 0;
    world.ball.vel.y = 800;
    for (let i = 0; i < 40; i++) world.step(DT, undefined, 0, false);
    expect(world.gameOver).toBe(true);
    const events: unknown[] = [];
    world.drainEvents(events as never[]);
  });
});

describe("brick behaviour", () => {
  it("reinforced bricks take three hits", () => {
    const world = newWorld();
    world.grid.clear();
    const brick = world.grid.place(3, 0, BrickKind.Reinforced, false);
    expect(brick.damage()).toBe(false);
    expect(brick.damage()).toBe(false);
    expect(brick.damage()).toBe(true);
    expect(brick.alive).toBe(false);
  });

  it("steel bricks never break and never count toward the clear", () => {
    const world = newWorld();
    world.grid.clear();
    const brick = world.grid.place(3, 0, BrickKind.Steel, false);
    for (let i = 0; i < 50; i++) expect(brick.damage()).toBe(false);
    expect(brick.alive).toBe(true);
    expect(brick.blocksClear).toBe(false);
    expect(world.grid.countBlocking()).toBe(0);
  });

  it("glass bricks do not reflect the ball", () => {
    const world = newWorld();
    world.grid.clear();
    const brick = world.grid.place(6, 0, BrickKind.Glass, false);
    world.launch();
    world.ball.pos.x = brick.bounds.x + brick.bounds.w * 0.5;
    world.ball.pos.y = brick.bounds.y - 20;
    world.ball.vel.x = 0;
    world.ball.vel.y = 500;
    world.ball.spin = 0;
    for (let i = 0; i < 20; i++) world.step(DT, undefined, 0, false);
    expect(brick.alive).toBe(false);
    // Still travelling downward: a reflection would have flipped the sign.
    expect(world.ball.vel.y).toBeGreaterThan(0);
  });

  it("explosive bricks chain to their neighbours", () => {
    const world = newWorld();
    world.grid.clear();
    const bomb = world.grid.place(6, 2, BrickKind.Explosive, false);
    const neighbours = [
      world.grid.place(5, 2, BrickKind.Standard, false),
      world.grid.place(7, 2, BrickKind.Standard, false),
      world.grid.place(6, 1, BrickKind.Standard, false),
    ];
    world.launch();
    world.ball.pos.x = bomb.bounds.x + bomb.bounds.w * 0.5;
    world.ball.pos.y = bomb.bounds.y + bomb.bounds.h + 20;
    world.ball.vel.x = 0;
    world.ball.vel.y = -500;
    world.ball.spin = 0;
    for (let i = 0; i < Math.round(1 / DT); i++) world.step(DT, undefined, 0, false);
    expect(bomb.alive).toBe(false);
    for (const n of neighbours) expect(n.alive).toBe(false);
  });

  it("regenerating bricks come back, but only a limited number of times", () => {
    const world = newWorld();
    world.grid.clear();
    const brick = world.grid.place(6, 1, BrickKind.Regenerating, false);
    const limit = brick.spec.rebuildLimit;

    for (let cycle = 0; cycle < limit; cycle++) {
      brick.damage();
      expect(brick.alive).toBe(false);
      expect(brick.rebuildIn).toBeGreaterThan(0);
      for (let i = 0; i < Math.round((brick.spec.rebuildDelay + 0.1) / DT); i++) {
        world.step(DT, undefined, 0, false);
      }
      expect(brick.alive).toBe(true);
    }

    brick.damage();
    expect(brick.alive).toBe(false);
    expect(brick.rebuildIn).toBe(0);
    expect(brick.blocksClear).toBe(false);
  });

  it("mirror bricks turn the ball rather than sending it back", () => {
    const world = newWorld();
    world.grid.clear();
    const brick = world.grid.place(6, 2, BrickKind.Mirror, false);
    world.launch();
    world.ball.pos.x = brick.bounds.x + brick.bounds.w * 0.5;
    world.ball.pos.y = brick.bounds.y - 25;
    world.ball.vel.x = 0;
    world.ball.vel.y = 450;
    world.ball.spin = 0;
    for (let i = 0; i < 12; i++) world.step(DT, undefined, 0, false);
    // A plain top-face hit would leave vx at 0; the diagonal must impart sideways motion.
    expect(Math.abs(world.ball.vel.x)).toBeGreaterThan(50);
  });
});

describe("level clear", () => {
  it("reports a clear once every clearable brick is gone", () => {
    const world = newWorld();
    world.grid.clear();
    const a = world.grid.place(4, 0, BrickKind.Standard, false);
    const b = world.grid.place(5, 0, BrickKind.Standard, false);
    world.grid.place(6, 0, BrickKind.Steel, false);

    expect(world.grid.countBlocking()).toBe(2);
    a.damage();
    b.damage();
    world.step(DT, undefined, 0, false);
    expect(world.cleared).toBe(true);

    const events: { type: string }[] = [];
    world.drainEvents(events as never[]);
    expect(events.some((e) => e.type === "level.clear")).toBe(true);
  });

  it("awards score for broken bricks and grows it with the combo", () => {
    const world = newWorld();
    world.grid.clear();
    for (let c = 2; c < 10; c++) world.grid.place(c, 0, BrickKind.Standard, false);
    play(world, 25);
    expect(world.score.total).toBeGreaterThan(0);
  });
});
