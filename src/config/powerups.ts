import { EMBER, NEON, STEEL, type Ramp } from "../render/palette";

/**
 * The power-up registry.
 *
 * Adding one is a single row in `POWERUP_TABLE`. Effects are declared as data rather than
 * written as code: the timed fields are *modifiers* the world multiplies together while the
 * capsule is active, and `action` covers the handful of effects that fire once on pickup.
 * That keeps the world's per-step maths a fixed expression no matter how many entries exist —
 * a new modifier-based power-up needs no change to the simulation at all.
 *
 * Set a `weight` of 0 to keep an entry defined but stop it dropping.
 */

export const POWERUP_IDS = [
  "expand",
  "shrink",
  "slow",
  "speed",
  "multi",
  "catch",
  "pierce",
  "life",
  "guard",
] as const;

export type PowerUpId = (typeof POWERUP_IDS)[number];

/** Fires once when collected; everything else is a timed modifier. */
export type PowerUpAction = "multiball" | "life" | "guard";

export interface PowerUpSpec {
  readonly id: PowerUpId;
  /** Single glyph stamped on the capsule, in the tradition of the arcade original. */
  readonly glyph: string;
  /** Name shown in the HUD while active. */
  readonly name: string;
  readonly ramp: Ramp;
  /** Hazards are worth dodging. They pulse, and the HUD marks them. */
  readonly hazard: boolean;
  /** Relative drop weight. 0 disables the entry without deleting it. */
  readonly weight: number;
  /** Seconds the effect lasts. 0 means it resolves instantly via `action`. */
  readonly duration: number;

  // --- timed modifiers, multiplied across everything currently active ---
  /** Scales the paddle's width. */
  readonly paddleScale?: number;
  /** Scales the ball's target speed band. */
  readonly ballSpeedScale?: number;
  /** Scales the ball's radius. */
  readonly ballRadiusScale?: number;
  /** The ball docks to the paddle on contact instead of bouncing. */
  readonly catchBall?: boolean;
  /** The ball destroys bricks without reflecting off them. */
  readonly pierce?: boolean;

  // --- one-shot ---
  readonly action?: PowerUpAction;
}

export const POWERUP_TABLE: Readonly<Record<PowerUpId, PowerUpSpec>> = {
  expand: {
    id: "expand",
    glyph: "E",
    name: "expand",
    ramp: NEON,
    hazard: false,
    weight: 14,
    duration: 18,
    paddleScale: 1.45,
  },
  shrink: {
    id: "shrink",
    glyph: "N",
    name: "narrow",
    ramp: EMBER,
    hazard: true,
    weight: 7,
    duration: 13,
    paddleScale: 0.68,
  },
  slow: {
    id: "slow",
    glyph: "S",
    name: "slow",
    ramp: NEON,
    hazard: false,
    weight: 10,
    duration: 12,
    ballSpeedScale: 0.76,
  },
  speed: {
    id: "speed",
    glyph: "F",
    name: "fast",
    ramp: EMBER,
    hazard: true,
    weight: 7,
    duration: 10,
    ballSpeedScale: 1.28,
  },
  multi: {
    id: "multi",
    glyph: "D",
    name: "disrupt",
    ramp: NEON,
    hazard: false,
    weight: 8,
    duration: 0,
    action: "multiball",
  },
  catch: {
    id: "catch",
    glyph: "C",
    name: "catch",
    ramp: NEON,
    hazard: false,
    weight: 9,
    duration: 16,
    catchBall: true,
  },
  pierce: {
    id: "pierce",
    glyph: "B",
    name: "breaker",
    ramp: EMBER,
    hazard: false,
    weight: 6,
    duration: 8,
    pierce: true,
    ballRadiusScale: 1.2,
  },
  life: {
    id: "life",
    glyph: "P",
    name: "extra ball",
    ramp: EMBER,
    hazard: false,
    weight: 3,
    duration: 0,
    action: "life",
  },
  guard: {
    id: "guard",
    glyph: "G",
    name: "guard",
    ramp: STEEL,
    hazard: false,
    weight: 4,
    duration: 0,
    action: "guard",
  },
};

export const POWERUP_LIST: readonly PowerUpSpec[] = POWERUP_IDS.map((id) => POWERUP_TABLE[id]);

/** Drop weights in registry order, for `Rng.weighted`. */
export const POWERUP_WEIGHTS: readonly number[] = POWERUP_LIST.map((p) => p.weight);

export function powerUpAt(index: number): PowerUpSpec {
  return POWERUP_LIST[index] ?? (POWERUP_LIST[0] as PowerUpSpec);
}

export function indexOfPowerUp(id: PowerUpId): number {
  return POWERUP_IDS.indexOf(id);
}

/** Balls added per `multiball` pickup. */
export const MULTIBALL_SPLIT = 2;
/** Hard cap on simultaneous balls, so a chain of pickups cannot melt the frame budget. */
export const MAX_BALLS = 6;
