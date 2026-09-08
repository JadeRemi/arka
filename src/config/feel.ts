/**
 * Every number that decides how the game *feels*, in one place.
 *
 * Gameplay code reads from here and hard-codes nothing, so tuning is a matter of editing this
 * file rather than hunting constants through the simulation. Anything a designer would want to
 * try during a balance pass belongs in this file; anything structural does not.
 */

export const LIVES = 3;

export const BALL = {
  radius: 7.5,

  /** Speed at level 1, px/s. */
  baseSpeed: 400,
  /** Added per level as `speedPerLevel * sqrt(level - 1)`, so the curve flattens out. */
  speedPerLevel: 26,
  /** No level's base speed goes past this. */
  speedCeiling: 760,
  /** How far above the level's base speed the clamp allows a rally to climb. */
  maxSpeedHeadroom: 210,
  /** Lower clamp, as a fraction of the level's base speed. */
  minSpeedRatio: 0.72,

  /**
   * Speed multiplier on every paddle hit. Compounding, so it stays small: at 1.008 a
   * thirty-hit rally is +27%, which is tense; the 1.015 this started at reached +56% and made
   * long rallies unreadable.
   */
  rallyRamp: 1.008,
  /**
   * Fraction of the excess over base speed shed per second. Lets a hot rally cool off if the
   * player survives it, so a single long exchange cannot leave the ball permanently too fast.
   */
  rallyRelax: 0.07,

  /** Steering: how far the outgoing angle bends at the very edge of the paddle. */
  maxBendDeg: 60,
  /** Fraction of the paddle's own velocity added to the ball's horizontal speed. */
  paddleVxTransfer: 0.35,
  /** Spin picked up from paddle movement and from where on the paddle the ball landed. */
  spinFromPaddleVx: 0.02,
  spinFromOffset: 1.6,

  /** Lateral acceleration per unit of spin — enough to curve a shot, not to steer it. */
  magnus: 26,
  spinDecay: 0.985,
  maxSpin: 14,

  restitution: 0.995,
  trailLength: 26,
} as const;

export const PADDLE = {
  /** Width at level 1. */
  baseWidth: 126,
  /** Width lost per level as `widthPerLevel * sqrt(level - 1)`. */
  widthPerLevel: 8,
  minWidth: 84,
  /** Set-piece levels hand a little width back. */
  setPieceBonus: 16,

  height: 16,
  /** Critically damped follow. High enough to feel direct, low enough to carry inertia. */
  stiffness: 780,
  keySpeed: 900,
  /** How fast the visible width eases toward a power-up's target width, per second. */
  resizeRate: 7,
} as const;

export const WALL_LAYOUT = {
  /**
   * Fraction of the field height a *full-height* wall occupies. Cell height is derived from
   * this and `gridRows`, so a level with fewer rows fills proportionally less. Deriving it
   * from the grid allocation instead left even a tall level looking like a thin strip.
   */
  bandHeight: 0.64,
  /** Rows in the tallest level. The grid is allocated for exactly this. */
  gridRows: 12,
  cols: 13,
  /** Empty rows left above the first brick row. */
  topMargin: 0.35,
  /** Visual inset so bricks read as separate plates rather than one slab. */
  gap: 3,
} as const;

export const DIFFICULTY = {
  /** Level 1 already fills a third of the field; a sparser opener read as an empty screen. */
  minRows: 7,
  /** Must not exceed `WALL_LAYOUT.gridRows`, which is what the grid allocates. */
  maxRows: WALL_LAYOUT.gridRows,
  /** Rows added per level. 0.5 means one more row every two levels. */
  rowsPerLevel: 0.5,

  /** Share of a layout allowed to be a non-standard brick kind. */
  exoticPerLevel: 0.035,
  exoticMax: 0.35,
  exoticSetPieceBonus: 0.08,

  /** Every Nth level is a set piece: more structure, wider paddle, different rhythm. */
  setPieceEvery: 5,

  /** Target total-HP band as a fraction of the grid cells, for generation retries. */
  hpBandLow: 0.3,
  hpBandHigh: 1.15,
} as const;

export const DROPS = {
  /** Chance a destroyed brick drops a capsule at level 1. */
  chance: 0.12,
  /** Added per level. */
  chancePerLevel: 0.002,
  chanceMax: 0.2,

  /** Terminal fall speed of a capsule, px/s. */
  fallSpeed: 132,
  /** Downward acceleration until it reaches `fallSpeed`. */
  gravity: 240,
  /** Sideways sway amplitude and rate, which is what makes a capsule read as floating. */
  swayAmplitude: 7,
  swayRate: 3.1,

  width: 46,
  height: 22,
  /** Score for catching one, before combo and level multipliers. */
  catchScore: 75,

  /** How long a hazard drop is on screen before it is worth dodging — purely cosmetic warning. */
  hazardPulseRate: 9,
} as const;

export const FX = {
  shakeMax: 7,
  shardCap: 2200,
  dustCap: 3000,
  sparkCap: 800,
} as const;

export const PACING = {
  /** Seconds the level-intro card holds before the ball can be launched. */
  levelIntro: 2.3,
  /** Seconds the ball stays docked after a life is lost. */
  respawn: 0.9,
  /** Screen-transition length. */
  transition: 0.42,
} as const;
