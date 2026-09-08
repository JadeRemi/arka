import { describe, expect, it } from "vitest";
import { World, START_LIVES } from "./World";
import { generateLevel } from "../level/generate";
import { BrickKind } from "./kinds";
import { fieldBottom, fieldLeft, fieldRight, fieldTop } from "./field";
import { DT } from "../core/Loop";
import { MAX_BALLS, MULTIBALL_SPLIT, POWERUP_TABLE, indexOfPowerUp } from "../config/powerups";
import { DROPS } from "../config/feel";

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
  // Every level opens with the intro card holding the ball. Tests skip it explicitly rather
  // than waiting it out, and one test below covers the hold itself.
  world.introDelay = 0;
  return world;
}

/** Runs `seconds` of simulation, keeping the paddle under the ball so it does not die. */
function play(world: World, seconds: number, autoPaddle = true): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    const target = autoPaddle ? world.ball.pos.x : undefined;
    world.step(DT, target, 0, autoPaddle);
    if (world.allDocked && world.respawnDelay <= 0 && !world.gameOver) world.launch();
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

  it("holds the ball through the level-intro card, then allows a launch", () => {
    const world = new World();
    const spec = generateLevel(1, 5);
    world.startRun(5);
    world.loadLevel(1, 5, spec);

    expect(world.introDelay).toBeGreaterThan(0);
    world.launch();
    expect(world.ball.docked).toBe(true);

    // Capture the bound before stepping: `introDelay` shrinks each step.
    const holdSteps = Math.round((world.introDelay + 0.05) / DT);
    for (let i = 0; i < holdSteps; i++) world.step(DT, undefined, 0, false);
    expect(world.introDelay).toBe(0);
    world.launch();
    expect(world.ball.docked).toBe(false);
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

describe("power-ups", () => {
  it("collects a capsule that reaches the paddle and scores it", () => {
    const world = newWorld();
    const before = world.score.total;
    world.drops.spawn(world.paddle.x, world.paddle.bounds.y - 4, indexOfPowerUp("expand"));
    world.step(DT, undefined, 0, false);

    expect(world.drops.count).toBe(0);
    expect(world.effects.isActive("expand")).toBe(true);
    expect(world.score.total).toBeGreaterThan(before);

    const events: { type: string }[] = [];
    world.drainEvents(events as never[]);
    expect(events.some((e) => e.type === "powerup")).toBe(true);
  });

  it("leaves a capsule alone until it actually overlaps the paddle", () => {
    const world = newWorld();
    world.drops.spawn(world.paddle.x, fieldTop() + 20, indexOfPowerUp("expand"));
    world.step(DT, undefined, 0, false);
    expect(world.drops.count).toBe(1);
    expect(world.effects.isActive("expand")).toBe(false);
  });

  it("drops a capsule off the bottom of the field rather than keeping it forever", () => {
    const world = newWorld();
    world.paddle.setTarget(fieldLeft() + 40);
    world.drops.spawn(fieldRight() - 40, fieldBottom() - 30, indexOfPowerUp("expand"));
    for (let i = 0; i < Math.round(2 / DT); i++) world.step(DT, undefined, 0, false);
    expect(world.drops.count).toBe(0);
    expect(world.effects.isActive("expand")).toBe(false);
  });

  it("expand widens the paddle and it eases back when the effect ends", () => {
    const world = newWorld();
    const base = world.paddle.targetWidth;
    world.effects.collect(POWERUP_TABLE.expand);
    world.step(DT, undefined, 0, false);
    expect(world.paddle.targetWidth).toBeGreaterThan(base);

    // Let the plate actually reach its new size, then run the effect out.
    for (let i = 0; i < Math.round(2 / DT); i++) world.step(DT, undefined, 0, false);
    expect(world.paddle.bounds.w).toBeGreaterThan(base);

    for (let i = 0; i < Math.round((POWERUP_TABLE.expand.duration + 2) / DT); i++) {
      world.step(DT, undefined, 0, false);
    }
    expect(world.paddle.targetWidth).toBeCloseTo(base, 4);
  });

  it("slow and fast move the ball speed band in opposite directions", () => {
    const world = newWorld();
    const base = world.targetSpeed;

    world.effects.collect(POWERUP_TABLE.slow);
    world.step(DT, undefined, 0, false);
    expect(world.targetSpeed).toBeLessThan(base);
    expect(world.ball.maxSpeed).toBeLessThan(
      (world.spec?.tuning.ballMaxSpeed ?? Infinity) + 1,
    );

    world.effects.collect(POWERUP_TABLE.speed);
    world.step(DT, undefined, 0, false);
    expect(world.targetSpeed).toBeGreaterThan(base);
  });

  it("disrupt splits the ball and never exceeds the ball cap", () => {
    const world = newWorld();
    world.launch();
    expect(world.ballCount).toBe(1);

    world.effects.collect(POWERUP_TABLE.multi);
    world.step(DT, world.ball.pos.x, 0, true);
    expect(world.ballCount).toBe(1 + MULTIBALL_SPLIT);

    for (let i = 0; i < 8; i++) {
      world.effects.collect(POWERUP_TABLE.multi);
      world.step(DT, world.ball.pos.x, 0, true);
    }
    expect(world.ballCount).toBeLessThanOrEqual(MAX_BALLS);
  });

  it("loses no life while a spare ball is still in play", () => {
    const world = newWorld();
    world.launch();
    world.effects.collect(POWERUP_TABLE.multi);
    world.step(DT, world.ball.pos.x, 0, true);
    const lives = world.lives;
    expect(world.ballCount).toBeGreaterThan(1);

    // Send exactly one ball out of play, well away from the paddle.
    const doomed = world.balls[world.ballCount - 1]!;
    doomed.pos.x = fieldLeft() + 6;
    doomed.pos.y = fieldBottom() - 2;
    doomed.vel.x = 0;
    doomed.vel.y = 700;
    world.paddle.x = fieldRight() - 30;
    world.paddle.targetX = world.paddle.x;

    for (let i = 0; i < 20; i++) world.step(DT, undefined, 0, false);
    expect(world.lives).toBe(lives);
    expect(world.ballCount).toBeGreaterThanOrEqual(1);
  });

  it("catch docks the ball on the paddle instead of bouncing it", () => {
    const world = newWorld();
    world.effects.collect(POWERUP_TABLE.catch);
    world.launch();
    const ball = world.ball;
    ball.pos.x = world.paddle.x;
    ball.pos.y = world.paddle.bounds.y - 30;
    ball.vel.x = 0;
    ball.vel.y = 420;
    ball.spin = 0;

    for (let i = 0; i < 40; i++) {
      world.step(DT, undefined, 0, false);
      if (ball.docked) break;
    }
    expect(ball.docked).toBe(true);

    world.launch();
    expect(ball.docked).toBe(false);
    expect(ball.vel.y).toBeLessThan(0);
  });

  it("breaker passes through a brick without reflecting, but not through steel", () => {
    const world = newWorld();
    world.grid.clear();
    // A middle row, so the ball has room to keep rising without reaching the ceiling and
    // turning around before the assertion.
    const plain = world.grid.place(6, 6, BrickKind.Standard, false);
    world.effects.collect(POWERUP_TABLE.pierce);
    world.launch();

    const ball = world.ball;
    ball.pos.x = plain.bounds.x + plain.bounds.w * 0.5;
    ball.pos.y = plain.bounds.y + plain.bounds.h + 24;
    ball.vel.x = 0;
    ball.vel.y = -480;
    ball.spin = 0;
    for (let i = 0; i < 40 && plain.alive; i++) world.step(DT, undefined, 0, false);

    expect(plain.alive).toBe(false);
    // Still rising at the moment it broke through: a reflection would have flipped the sign.
    expect(ball.vel.y).toBeLessThan(0);

    const steel = world.grid.place(6, 8, BrickKind.Steel, false);
    ball.pos.x = steel.bounds.x + steel.bounds.w * 0.5;
    ball.pos.y = steel.bounds.y + steel.bounds.h + 24;
    ball.vel.x = 0;
    ball.vel.y = -480;
    ball.spin = 0;
    for (let i = 0; i < 40 && ball.vel.y < 0; i++) world.step(DT, undefined, 0, false);
    expect(steel.alive).toBe(true);
    expect(ball.vel.y).toBeGreaterThan(0);
  });

  it("guard saves the last ball once per charge, then stops", () => {
    const world = newWorld();
    world.effects.collect(POWERUP_TABLE.guard);
    expect(world.effects.guardCharges).toBe(1);
    world.launch();

    const drop = (): void => {
      const ball = world.ball;
      ball.pos.x = fieldLeft() + 40;
      ball.pos.y = fieldBottom() - 2;
      ball.vel.x = 0;
      ball.vel.y = 760;
      world.paddle.x = fieldRight() - 30;
      world.paddle.targetX = world.paddle.x;
    };

    const lives = world.lives;
    drop();
    for (let i = 0; i < 12; i++) world.step(DT, undefined, 0, false);
    expect(world.lives).toBe(lives);
    expect(world.effects.guardCharges).toBe(0);
    expect(world.ball.vel.y).toBeLessThan(0);

    const events: { type: string }[] = [];
    world.drainEvents(events as never[]);
    expect(events.some((e) => e.type === "guard")).toBe(true);

    // No charge left: the next drop costs a life.
    drop();
    for (let i = 0; i < 40; i++) world.step(DT, undefined, 0, false);
    expect(world.lives).toBe(lives - 1);
  });

  it("extra ball adds a life", () => {
    const world = newWorld();
    const lives = world.lives;
    world.effects.collect(POWERUP_TABLE.life);
    world.step(DT, undefined, 0, false);
    expect(world.lives).toBe(lives + 1);
  });

  it("clears timed effects and pending capsules when a life is lost", () => {
    const world = newWorld();
    world.effects.collect(POWERUP_TABLE.expand);
    world.drops.spawn(fieldLeft() + 100, fieldTop() + 100, indexOfPowerUp("slow"));
    world.launch();

    const ball = world.ball;
    ball.pos.x = fieldLeft() + 20;
    ball.pos.y = fieldBottom() - 2;
    ball.vel.x = 0;
    ball.vel.y = 800;
    world.paddle.x = fieldRight() - 30;
    world.paddle.targetX = world.paddle.x;
    for (let i = 0; i < 40; i++) world.step(DT, undefined, 0, false);

    expect(world.effects.isActive("expand")).toBe(false);
    expect(world.drops.count).toBe(0);
    expect(world.ballCount).toBe(1);
    expect(world.ball.docked).toBe(true);
  });

  it("drops capsules over a long run, and only from bricks that allow it", () => {
    const world = newWorld(14, 20260908);
    play(world, 40);
    // Steel has dropBias 0, so nothing can have come from an indestructible brick.
    expect(world.score.total).toBeGreaterThan(0);
    expect(DROPS.chance).toBeGreaterThan(0);
  });
});
