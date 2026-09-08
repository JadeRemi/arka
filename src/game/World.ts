import { BALL, DROPS, LIVES, PACING } from "../config/feel";
import { MAX_BALLS, POWERUP_WEIGHTS, powerUpAt, type PowerUpSpec } from "../config/powerups";
import { Rng, hashSeed } from "../core/Rng";
import type { Aabb } from "../math/aabb";
import { clamp } from "../math/scalar";
import { sweptCircleAabb, type Sweep } from "../physics/swept";
import { clampSpeed, enforceAngle } from "../physics/constraints";
import { Ball } from "./Ball";
import type { Brick } from "./Brick";
import { BrickGrid } from "./BrickGrid";
import { DropPool } from "./Drops";
import { Effects } from "./Effects";
import { Paddle } from "./Paddle";
import { Score } from "./Score";
import { BrickKind } from "./kinds";
import { CELL_W, GRID_COLS, fieldBottom, fieldLeft, fieldRight, fieldTop, paddleY } from "./field";
import type { LevelSpec } from "../level/generate";
import { DustPool, PopPool, RingPool, SparkPool, burstDust, burstSparks } from "../fx/Particles";
import { ShardPool, fracture } from "../fx/Fracture";
import { Shake } from "../fx/Shake";

export const START_LIVES = LIVES;
/** Sub-steps of the collision resolution loop per simulation step. */
const MAX_ITERATIONS = 4;
/** Back-off from the contact point, so the next sweep does not start already touching. */
const SKIN = 0.01;
const MAX_BEND = (BALL.maxBendDeg * Math.PI) / 180;
/** Seconds between links of an explosive chain. */
const FUSE_DELAY = 0.06;

export type WorldEvent =
  | { type: "brick.hit"; brick: Brick }
  | { type: "brick.break"; brick: Brick; points: number }
  | { type: "brick.steel"; brick: Brick }
  | { type: "explosion"; x: number; y: number }
  | { type: "paddle" }
  | { type: "wall" }
  | { type: "powerup"; spec: PowerUpSpec; points: number }
  | { type: "guard"; chargesLeft: number }
  | { type: "ball.lost"; ballsLeft: number }
  | { type: "life.lost"; livesLeft: number }
  | { type: "level.clear" }
  | { type: "game.over" };

const WALL_LEFT: Aabb = { x: 0, y: 0, w: 0, h: 0 };
const WALL_RIGHT: Aabb = { x: 0, y: 0, w: 0, h: 0 };
const CEILING: Aabb = { x: 0, y: 0, w: 0, h: 0 };
const SWEEP_BOX: Aabb = { x: 0, y: 0, w: 0, h: 0 };

interface Contact {
  t: number;
  nx: number;
  ny: number;
  brick: Brick | undefined;
  paddle: boolean;
  wall: boolean;
  passThrough: boolean;
}

/**
 * One level's simulation: entities, collision resolution and the rules that turn a contact
 * into damage, score and effects.
 *
 * Collision is resolved with an earliest-time-of-impact loop rather than by testing overlaps
 * after moving. At 760 px/s a 120 Hz step moves the ball 6.3 px against a 22 px brick — close
 * enough that discrete testing would already mis-order contacts, and outright tunnel once the
 * frame rate dips.
 *
 * Balls are a list rather than a single entity, because the disrupt power-up splits them. The
 * list is a pool of `MAX_BALLS` reused objects; a lost ball is swapped out of the live prefix
 * rather than freed, so a multiball chain never allocates mid-rally.
 */
export class World {
  readonly grid = new BrickGrid();
  readonly paddle = new Paddle();
  readonly score = new Score();
  readonly shake = new Shake();
  readonly effects = new Effects();

  readonly dust = new DustPool();
  readonly sparks = new SparkPool();
  readonly rings = new RingPool();
  readonly pops = new PopPool();
  readonly shards = new ShardPool();
  readonly drops = new DropPool();

  /** Reused ball objects. `balls` is the live prefix of this pool. */
  private readonly ballPool: Ball[] = Array.from({ length: MAX_BALLS }, () => new Ball());
  readonly balls: Ball[] = [];

  lives = START_LIVES;
  level = 1;
  spec: LevelSpec | undefined;
  cleared = false;
  gameOver = false;
  /** Freeze the ball briefly after a life is lost, so the reset is legible. */
  respawnDelay = 0;
  /** Holds the ball while the level-intro card is on screen. */
  introDelay = 0;
  elapsed = 0;

  private rng = new Rng(1);
  private readonly events: WorldEvent[] = [];
  private readonly fusing: Brick[] = [];
  private readonly blastScratch: Brick[] = [];
  private readonly contact: Contact = {
    t: 1,
    nx: 0,
    ny: 0,
    brick: undefined,
    paddle: false,
    wall: false,
    passThrough: false,
  };

  constructor() {
    WALL_LEFT.x = fieldLeft() - 200;
    WALL_LEFT.y = fieldTop() - 400;
    WALL_LEFT.w = 200;
    WALL_LEFT.h = fieldBottom() - fieldTop() + 800;
    WALL_RIGHT.x = fieldRight();
    WALL_RIGHT.y = WALL_LEFT.y;
    WALL_RIGHT.w = 200;
    WALL_RIGHT.h = WALL_LEFT.h;
    CEILING.x = fieldLeft() - 200;
    CEILING.y = fieldTop() - 200;
    CEILING.w = fieldRight() - fieldLeft() + 400;
    CEILING.h = 200;
    this.balls.push(this.ballPool[0] as Ball);
  }

  /** The ball the camera and the HUD follow. */
  get ball(): Ball {
    return (this.balls[0] ?? this.ballPool[0]) as Ball;
  }

  get ballCount(): number {
    return this.balls.length;
  }

  /** True while every live ball is sitting on the paddle. */
  get allDocked(): boolean {
    for (const b of this.balls) if (!b.docked) return false;
    return this.balls.length > 0;
  }

  /**
   * Resets run-scoped state only. Loading the first level is the caller's job, because the
   * level spec is generated outside the world — calling `loadLevel` from here would either
   * throw on a fresh world or load a level twice.
   */
  startRun(seed: number): void {
    this.score.reset();
    this.lives = START_LIVES;
    this.gameOver = false;
    this.effects.reset();
    this.rng = new Rng(hashSeed(seed, 0x9e3779b9));
  }

  loadLevel(level: number, seed: number, spec: LevelSpec): void {
    this.level = level;
    this.spec = spec;

    this.rng = new Rng(hashSeed(seed, level, 0x27d4eb2d));
    this.grid.clear();

    const { kinds, flips, rows } = spec;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const k = kinds[r * GRID_COLS + c] as number;
        if (k < 0) continue;
        this.grid.place(c, r, k, flips[r * GRID_COLS + c] === 1);
      }
    }

    this.effects.resetTimed();
    this.paddle.reset(spec.tuning.paddleWidth);
    this.resetBalls();
    this.applyEffectModifiers();

    this.dust.reset();
    this.sparks.reset();
    this.rings.reset();
    this.pops.reset();
    this.shards.reset();
    this.drops.reset();
    this.shake.reset();
    this.fusing.length = 0;
    this.cleared = false;
    this.respawnDelay = 0;
    this.introDelay = PACING.levelIntro;
    this.elapsed = 0;
    this.score.beginLevel(level);
  }

  private resetBalls(): void {
    this.balls.length = 0;
    const first = this.ballPool[0] as Ball;
    this.balls.push(first);
    this.dockOnPaddle(first, 0);
  }

  private dockOnPaddle(ball: Ball, offset: number): void {
    ball.dock(this.paddle.x + offset, this.paddle.bounds.y - ball.radius - 2, offset);
  }

  /** Keeps docked balls riding the paddle, clamped so one cannot hang off the end. */
  private rideDockedBalls(): void {
    const limit = Math.max(0, this.paddle.halfWidth - 6);
    for (const ball of this.balls) {
      if (!ball.docked) continue;
      ball.dockOffset = clamp(ball.dockOffset, -limit, limit);
      ball.pos.x = this.paddle.x + ball.dockOffset;
      ball.pos.y = this.paddle.bounds.y - ball.radius - 2;
      ball.prev.x = ball.pos.x;
      ball.prev.y = ball.pos.y;
    }
  }

  /** Launches every docked ball. Blocked while the intro card or a respawn is holding. */
  launch(): void {
    if (this.respawnDelay > 0 || this.introDelay > 0) return;
    const speed = this.targetSpeed;
    let n = 0;
    for (const ball of this.balls) {
      if (!ball.docked) continue;
      const bias = clamp(this.paddle.vx / 700, -1, 1);
      const spread = this.balls.length > 1 ? (n - (this.balls.length - 1) / 2) * 0.34 : 0;
      ball.launch(speed, bias * 0.6 + spread + this.rng.jitter(0.1));
      n++;
    }
  }

  /** The level's target speed, after power-up modifiers. */
  get targetSpeed(): number {
    const base = this.spec ? this.spec.tuning.ballSpeed : BALL.baseSpeed;
    return base * this.effects.ballSpeedScale;
  }

  drainEvents(out: WorldEvent[]): void {
    out.push(...this.events);
    this.events.length = 0;
  }

  /** Pushes the current power-up modifiers into the paddle and every ball. */
  private applyEffectModifiers(): void {
    const spec = this.spec;
    const paddleBase = spec ? spec.tuning.paddleWidth : this.paddle.targetWidth;
    this.paddle.targetWidth = paddleBase * this.effects.paddleScale;

    const scale = this.effects.ballSpeedScale;
    const min = (spec ? spec.tuning.ballMinSpeed : BALL.baseSpeed * BALL.minSpeedRatio) * scale;
    const max = (spec ? spec.tuning.ballMaxSpeed : BALL.baseSpeed + BALL.maxSpeedHeadroom) * scale;
    const radius = BALL.radius * this.effects.ballRadiusScale;
    for (const ball of this.balls) {
      ball.minSpeed = min;
      ball.maxSpeed = max;
      ball.radius = radius;
    }
  }

  step(dt: number, pointerX: number | undefined, axis: number, pointerActive: boolean): void {
    if (this.gameOver) {
      this.stepEffects(dt);
      return;
    }

    this.elapsed += dt;
    if (this.introDelay > 0) this.introDelay = Math.max(0, this.introDelay - dt);
    if (!this.cleared && this.introDelay <= 0) this.score.tick(dt);

    if (pointerActive && pointerX !== undefined) this.paddle.setTarget(pointerX);
    this.paddle.nudge(axis, dt);
    this.paddle.step(dt);

    this.effects.step(dt);
    this.resolvePendingPickups();
    this.applyEffectModifiers();

    if (this.respawnDelay > 0) this.respawnDelay -= dt;

    const held = this.respawnDelay > 0 || this.introDelay > 0;
    this.rideDockedBalls();

    if (this.allDocked) {
      this.paddle.charge = Math.min(1, this.paddle.charge + dt * 3);
    } else {
      this.paddle.charge = Math.max(0, this.paddle.charge - dt * 6);
    }

    if (!held) {
      const target = this.targetSpeed;
      for (let i = 0; i < this.balls.length; i++) {
        const ball = this.balls[i] as Ball;
        if (ball.docked) continue;
        ball.integrate(dt, target);
        this.advanceBall(ball, dt);
        if (!ball.alive) {
          this.balls.splice(i, 1);
          i--;
        }
      }
      if (this.balls.length === 0) this.loseLife();
    }

    this.drops.step(dt, fieldBottom());
    this.collectDrops();

    this.stepFuses(dt);
    this.stepRegeneration(dt);
    this.stepEffects(dt);

    if (!this.cleared && this.grid.countBlocking() === 0) {
      this.cleared = true;
      this.events.push({ type: "level.clear" });
    }
  }

  /** Applies the one-shot pickups the effects tracker banked during this step. */
  private resolvePendingPickups(): void {
    while (this.effects.pendingLives > 0) {
      this.effects.pendingLives--;
      this.lives++;
    }
    if (this.effects.pendingSplits > 0) {
      const splits = this.effects.pendingSplits;
      this.effects.pendingSplits = 0;
      this.splitBalls(splits);
    }
  }

  /** Adds up to `count` balls, fanned off whichever ball is currently in play. */
  private splitBalls(count: number): void {
    const source = this.balls.find((b) => !b.docked) ?? this.balls[0];
    if (!source) return;
    for (let i = 0; i < count && this.balls.length < MAX_BALLS; i++) {
      const fresh = this.ballPool[this.balls.length] as Ball;
      const offset = (i % 2 === 0 ? 1 : -1) * (0.42 + Math.floor(i / 2) * 0.3);
      if (source.docked) {
        this.dockOnPaddle(fresh, source.dockOffset + (i + 1) * 12 * (i % 2 === 0 ? 1 : -1));
      } else {
        fresh.spawnFrom(source, offset);
      }
      this.balls.push(fresh);
    }
    this.applyEffectModifiers();
    this.rings.spawn(source.pos.x, source.pos.y, 30, 0.32, 1);
    this.shake.add(0.12);
  }

  private collectDrops(): void {
    const index = this.drops.collect(this.paddle.bounds);
    if (index < 0) return;
    const spec = powerUpAt(index);
    this.effects.collect(spec);
    this.applyEffectModifiers();

    const points = this.score.awardFlat(DROPS.catchScore);
    this.pops.spawn(this.paddle.x, this.paddle.bounds.y - 22, points, !spec.hazard);
    this.rings.spawn(this.paddle.x, this.paddle.bounds.y, 26, 0.3, spec.hazard ? 3 : 1);
    burstSparks(this.sparks, this.rng, this.paddle.x, this.paddle.bounds.y, 0, -1, 10, 200, spec.hazard ? 3 : 4);
    this.paddle.recoil = 1;
    this.shake.add(spec.hazard ? 0.2 : 0.1);
    this.events.push({ type: "powerup", spec, points });
  }

  private stepEffects(dt: number): void {
    this.dust.step(dt);
    this.sparks.step(dt);
    this.rings.step(dt);
    this.pops.step(dt);
    this.shards.step(dt, fieldBottom() + 60);
    this.shake.step(dt);
    for (const b of this.grid.bricks) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5.5);
    }
  }

  /** Earliest-TOI resolution loop. Consumes the step in at most MAX_ITERATIONS pieces. */
  private advanceBall(ball: Ball, dt: number): void {
    ball.prev.x = ball.pos.x;
    ball.prev.y = ball.pos.y;

    let remaining = dt;

    for (let iter = 0; iter < MAX_ITERATIONS && remaining > 1e-7; iter++) {
      const dx = ball.vel.x * remaining;
      const dy = ball.vel.y * remaining;

      const hit = this.findEarliest(ball, dx, dy);
      if (!hit) {
        ball.pos.x += dx;
        ball.pos.y += dy;
        remaining = 0;
        break;
      }

      const advance = Math.max(0, hit.t - SKIN);
      ball.pos.x += dx * advance;
      ball.pos.y += dy * advance;
      remaining *= 1 - hit.t;

      if (hit.passThrough) {
        // Glass, or any brick while the breaker power-up runs: register the break but keep
        // travelling. Nudge past the plate so the same brick cannot be re-hit this step.
        ball.pos.x += dx * 0.02;
        ball.pos.y += dy * 0.02;
        if (hit.brick) this.hitBrick(ball, hit.brick, hit.nx, hit.ny);
        continue;
      }

      this.reflect(ball, hit);

      if (hit.brick) this.hitBrick(ball, hit.brick, hit.nx, hit.ny);
      else if (hit.paddle) this.hitPaddle(ball);
      else if (hit.wall) {
        this.events.push({ type: "wall" });
        this.shake.add(0.05);
        burstSparks(this.sparks, this.rng, ball.pos.x, ball.pos.y, hit.nx, hit.ny, 4, 130, 0);
      }
      if (ball.docked) return;
    }

    if (remaining > 1e-7) {
      // Iterations exhausted: the ball is wedged. Push it clear along the last normal rather
      // than leaving it to vibrate inside geometry.
      ball.pos.x += this.contact.nx * 2;
      ball.pos.y += this.contact.ny * 2;
    }

    ball.pushTrail();

    if (ball.pos.y - ball.radius > fieldBottom()) this.loseBall(ball);
  }

  private findEarliest(ball: Ball, dx: number, dy: number): Contact | undefined {
    const c = this.contact;
    c.t = Number.POSITIVE_INFINITY;
    c.brick = undefined;
    c.paddle = false;
    c.wall = false;
    c.passThrough = false;

    const consider = (
      s: Sweep | null,
      brick: Brick | undefined,
      paddle: boolean,
      wall: boolean,
      passThrough: boolean,
    ): void => {
      if (!s || s.t >= c.t) return;
      c.t = s.t;
      c.nx = s.nx;
      c.ny = s.ny;
      c.brick = brick;
      c.paddle = paddle;
      c.wall = wall;
      c.passThrough = passThrough;
    };

    const p = ball.pos;
    const d = { x: dx, y: dy };
    const r = ball.radius;

    consider(sweptCircleAabb(p, d, WALL_LEFT, r), undefined, false, true, false);
    consider(sweptCircleAabb(p, d, WALL_RIGHT, r), undefined, false, true, false);
    consider(sweptCircleAabb(p, d, CEILING, r), undefined, false, true, false);

    // The paddle only counts when the ball is descending; otherwise a ball leaving the paddle
    // can immediately re-collide with it and get pinned.
    if (ball.vel.y > 0) {
      consider(sweptCircleAabb(p, d, this.paddle.bounds, r), undefined, true, false, false);
    }

    SWEEP_BOX.x = Math.min(p.x, p.x + dx) - r;
    SWEEP_BOX.y = Math.min(p.y, p.y + dy) - r;
    SWEEP_BOX.w = Math.abs(dx) + r * 2;
    SWEEP_BOX.h = Math.abs(dy) + r * 2;

    const pierce = this.effects.pierce;
    for (const brick of this.grid.near(SWEEP_BOX)) {
      const s = sweptCircleAabb(p, d, brick.bounds, r);
      if (!s) continue;
      // Steel keeps reflecting even under the breaker power-up; nothing gets through it.
      const through = !brick.spec.reflects || (pierce && !brick.indestructible);
      consider(s, brick, false, false, through);
    }

    return Number.isFinite(c.t) ? c : undefined;
  }

  private reflect(ball: Ball, hit: Contact): void {
    const v = ball.vel;
    let nx = hit.nx;
    let ny = hit.ny;

    if (hit.brick?.spec.diagonal) {
      // Mirror brick: the face normal is replaced by the brick's diagonal, so the ball is
      // turned 90 degrees rather than simply sent back.
      const flip = hit.brick.mirrorFlip;
      const s = Math.SQRT1_2;
      const dx = flip ? s : -s;
      const dy = s;
      const facing = v.x * dx + v.y * dy > 0 ? -1 : 1;
      nx = dx * facing;
      ny = dy * facing;
    }

    const dot = v.x * nx + v.y * ny;
    if (dot > 0) return;
    const j = (1 + BALL.restitution) * dot;
    v.x -= j * nx;
    v.y -= j * ny;
    clampSpeed(v, ball.minSpeed, ball.maxSpeed);
    enforceAngle(v);
  }

  private hitPaddle(ball: Ball): void {
    const paddle = this.paddle;
    const u = paddle.offsetAt(ball.pos.x);

    paddle.recoil = 1;
    this.score.breakCombo();
    this.shake.add(0.06);
    burstDust(this.dust, this.rng, ball.pos.x, paddle.bounds.y, 0, -1, 6, 90, 1);
    this.events.push({ type: "paddle" });

    if (this.effects.catchBall) {
      // Catch: the ball sticks where it landed and waits for another launch.
      this.dockOnPaddle(ball, clamp(ball.pos.x - paddle.x, -paddle.halfWidth, paddle.halfWidth));
      return;
    }

    // Steer by rotating the outgoing velocity toward the paddle edge the ball landed on. This
    // is the control the player actually plays with, so it overrides the pure reflection.
    const speed = Math.hypot(ball.vel.x, ball.vel.y) * BALL.rallyRamp;
    const bend = u * MAX_BEND;
    ball.vel.x = Math.sin(bend) * speed;
    ball.vel.y = -Math.cos(bend) * speed;

    // Paddle momentum transfers as sideways speed and as spin, which then curves the flight.
    ball.vel.x += paddle.vx * BALL.paddleVxTransfer;
    ball.addSpin(paddle.vx * BALL.spinFromPaddleVx + u * BALL.spinFromOffset);

    clampSpeed(ball.vel, ball.minSpeed, ball.maxSpeed);
    enforceAngle(ball.vel);
  }

  private hitBrick(ball: Ball, brick: Brick, nx: number, ny: number): void {
    const hx = ball.pos.x;
    const hy = ball.pos.y;

    if (brick.indestructible) {
      brick.damage(0);
      this.shake.add(0.11);
      burstSparks(this.sparks, this.rng, hx, hy, nx, ny, 12, 260, 2);
      this.events.push({ type: "brick.steel", brick });
      return;
    }

    const destroyed = brick.damage(1);
    if (!destroyed) {
      this.shake.add(0.07);
      burstDust(this.dust, this.rng, hx, hy, nx, ny, 7, 130, 1);
      burstSparks(this.sparks, this.rng, hx, hy, nx, ny, 5, 170, 1);
      this.events.push({ type: "brick.hit", brick });
      return;
    }

    this.breakBrick(brick, hx, hy, nx, ny, ball.vel.x, ball.vel.y);
  }

  private breakBrick(
    brick: Brick,
    hx: number,
    hy: number,
    nx: number,
    ny: number,
    inheritVx: number,
    inheritVy: number,
  ): void {
    const points = this.score.award(brick.spec.score);
    const glass = brick.kind === BrickKind.Glass;
    const tint = tintFor(brick.kind);

    fracture(
      this.shards,
      this.rng,
      brick.bounds,
      hx,
      hy,
      nx,
      ny,
      inheritVx,
      inheritVy,
      brick.spec.shardScale,
      tint,
      glass,
    );
    burstDust(this.dust, this.rng, hx, hy, nx, ny, glass ? 20 : 12, 170, tint);
    burstSparks(this.sparks, this.rng, hx, hy, nx, ny, 8, 220, tint);
    this.rings.spawn(
      brick.bounds.x + brick.bounds.w * 0.5,
      brick.bounds.y + brick.bounds.h * 0.5,
      brick.spec.blastRadius > 0 ? CELL_W * brick.spec.blastRadius : 26,
      brick.spec.blastRadius > 0 ? 0.45 : 0.26,
      tint,
    );
    this.pops.spawn(
      brick.bounds.x + brick.bounds.w * 0.5,
      brick.bounds.y,
      points,
      this.score.combo > 6,
    );
    this.shake.add(brick.spec.blastRadius > 0 ? 0.42 : 0.13);

    this.maybeDrop(brick);
    this.events.push({ type: "brick.break", brick, points });

    if (brick.spec.blastRadius > 0) this.detonate(brick);
  }

  /** Rolls for a power-up capsule, weighted by the brick kind's own drop bias. */
  private maybeDrop(brick: Brick): void {
    const bias = brick.spec.dropBias;
    if (bias <= 0) return;
    const chance = (this.spec ? this.spec.tuning.dropChance : DROPS.chance) * bias;
    if (!this.rng.bool(Math.min(0.6, chance))) return;
    const index = this.rng.weighted(POWERUP_WEIGHTS);
    this.drops.spawn(
      brick.bounds.x + brick.bounds.w * 0.5,
      brick.bounds.y + brick.bounds.h * 0.5,
      index,
    );
  }

  /** Queues neighbours of an exploded brick with a short fuse, so chains read as a cascade. */
  private detonate(source: Brick): void {
    this.shake.pulse(0.8);
    this.events.push({
      type: "explosion",
      x: source.bounds.x + source.bounds.w * 0.5,
      y: source.bounds.y + source.bounds.h * 0.5,
    });
    const targets = this.grid.blastTargets(
      source.col,
      source.row,
      source.spec.blastRadius,
      this.blastScratch,
    );
    for (const t of targets) {
      if (t.indestructible || t.fuse > 0) continue;
      t.fuse = FUSE_DELAY;
      this.fusing.push(t);
    }
  }

  private stepFuses(dt: number): void {
    for (let i = 0; i < this.fusing.length; i++) {
      const b = this.fusing[i] as Brick;
      b.fuse -= dt;
      if (b.fuse > 0) continue;
      b.fuse = 0;
      this.fusing.splice(i, 1);
      i--;
      if (!b.alive) continue;

      // A blast removes the brick outright; reinforced plates do not survive an explosion.
      b.hp = 0;
      b.alive = false;
      if (b.rebuildsLeft > 0) {
        b.rebuildsLeft--;
        b.rebuildIn = b.spec.rebuildDelay;
      }
      const cx = b.bounds.x + b.bounds.w * 0.5;
      const cy = b.bounds.y + b.bounds.h * 0.5;
      this.breakBrick(b, cx, cy, 0, -1, 0, 0);
    }
  }

  private stepRegeneration(dt: number): void {
    if (this.cleared) return;
    for (const b of this.grid.bricks) {
      if (b.alive || b.rebuildIn <= 0) continue;
      b.rebuildIn -= dt;
      if (b.rebuildIn > 0) continue;
      b.rebuildIn = 0;
      b.alive = true;
      b.hp = Number.isFinite(b.spec.hp) ? b.spec.hp : 1;
      b.flash = 1;
      this.rings.spawn(
        b.bounds.x + b.bounds.w * 0.5,
        b.bounds.y + b.bounds.h * 0.5,
        22,
        0.3,
        tintFor(b.kind),
      );
    }
  }

  /**
   * One ball has fallen out of play. With several in the air this costs nothing; on the last
   * one a banked guard charge is spent to save it, and only then is a life lost.
   */
  private loseBall(ball: Ball): void {
    const isLast = this.balls.length <= 1;

    if (isLast && this.effects.guardCharges > 0) {
      this.effects.guardCharges--;
      ball.pos.y = fieldBottom() - ball.radius - 2;
      ball.vel.y = -Math.abs(ball.vel.y);
      clampSpeed(ball.vel, ball.minSpeed, ball.maxSpeed);
      enforceAngle(ball.vel);
      this.rings.spawn(ball.pos.x, fieldBottom() - 6, 60, 0.5, 2);
      burstSparks(this.sparks, this.rng, ball.pos.x, fieldBottom() - 6, 0, -1, 22, 300, 2);
      this.shake.add(0.3);
      this.shake.pulse(0.5);
      this.events.push({ type: "guard", chargesLeft: this.effects.guardCharges });
      return;
    }

    ball.alive = false;
    burstDust(this.dust, this.rng, ball.pos.x, fieldBottom(), 0, -1, 14, 180, 0);
    if (!isLast) this.events.push({ type: "ball.lost", ballsLeft: this.balls.length - 1 });
  }

  /** Every ball is gone: spend a life and re-dock, or end the run. */
  private loseLife(): void {
    this.lives--;
    this.score.loseLife();
    this.effects.resetTimed();
    this.shake.add(0.5);
    this.shake.pulse(0.6);
    this.drops.reset();

    this.resetBalls();
    this.applyEffectModifiers();
    this.respawnDelay = PACING.respawn;

    if (this.lives <= 0) {
      this.gameOver = true;
      this.events.push({ type: "game.over" });
    } else {
      this.events.push({ type: "life.lost", livesLeft: this.lives });
    }
  }
}

/** Tint index consumed by the painters; keeps the pools free of colour strings. */
export function tintFor(kind: BrickKind): number {
  switch (kind) {
    case BrickKind.Explosive:
      return 3;
    case BrickKind.Steel:
    case BrickKind.Reinforced:
    case BrickKind.Mirror:
      return 2;
    case BrickKind.Glass:
    case BrickKind.Regenerating:
      return 4;
    default:
      return 1;
  }
}

export { paddleY };
