import { BALL, DIFFICULTY, DROPS, PADDLE } from "../config/feel";
import { GRID_COLS } from "../game/field";
import { clamp } from "../math/scalar";

export interface Tuning {
  /** The level's target ball speed, before power-up modifiers. */
  readonly ballSpeed: number;
  readonly ballMinSpeed: number;
  readonly ballMaxSpeed: number;
  readonly paddleWidth: number;
  readonly rows: number;
  /** Fraction of the layout allowed to be a non-standard kind, 0..1. */
  readonly exoticBudget: number;
  /** Chance a destroyed brick drops a power-up. */
  readonly dropChance: number;
  /** Target total HP band; generation retries until it lands inside. */
  readonly hpMin: number;
  readonly hpMax: number;
  readonly setPiece: boolean;
}

/**
 * The difficulty curve, entirely derived from `config/feel.ts`.
 *
 * Speed and paddle width both grow with `sqrt(level - 1)` rather than linearly: a linear
 * paddle shrink hit its floor by level 16 and a linear speed ramp outran the player long
 * before that. Under the square root the pressure keeps rising but never runs away, and most
 * of the added difficulty comes from brick count and exotic kinds instead.
 */
export function tuningFor(level: number): Tuning {
  const l = Math.max(1, level);
  const rise = Math.sqrt(l - 1);
  const setPiece = l % DIFFICULTY.setPieceEvery === 0;

  const rows = clamp(
    DIFFICULTY.minRows + Math.floor(l * DIFFICULTY.rowsPerLevel),
    DIFFICULTY.minRows,
    DIFFICULTY.maxRows,
  );
  const cells = rows * GRID_COLS;

  const ballSpeed = Math.min(BALL.speedCeiling, BALL.baseSpeed + BALL.speedPerLevel * rise);

  return {
    ballSpeed,
    ballMinSpeed: ballSpeed * BALL.minSpeedRatio,
    ballMaxSpeed: ballSpeed + BALL.maxSpeedHeadroom,
    paddleWidth:
      clamp(PADDLE.baseWidth - PADDLE.widthPerLevel * rise, PADDLE.minWidth, PADDLE.baseWidth) +
      (setPiece ? PADDLE.setPieceBonus : 0),
    rows,
    exoticBudget:
      clamp((l - 1) * DIFFICULTY.exoticPerLevel, 0, DIFFICULTY.exoticMax) +
      (setPiece ? DIFFICULTY.exoticSetPieceBonus : 0),
    dropChance: Math.min(DROPS.chanceMax, DROPS.chance + (l - 1) * DROPS.chancePerLevel),
    hpMin: Math.round(cells * DIFFICULTY.hpBandLow),
    hpMax: Math.round(cells * DIFFICULTY.hpBandHigh),
    setPiece,
  };
}
