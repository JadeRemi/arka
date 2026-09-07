import { clamp } from "../math/scalar";

export interface Tuning {
  readonly ballSpeed: number;
  readonly ballMaxSpeed: number;
  readonly paddleWidth: number;
  readonly rows: number;
  /** Fraction of the layout allowed to be a non-standard kind, 0..1. */
  readonly exoticBudget: number;
  /** Target total HP band; generation retries until it lands inside. */
  readonly hpMin: number;
  readonly hpMax: number;
  readonly setPiece: boolean;
}

/**
 * The difficulty curve. Deliberately sub-linear in speed (sqrt) so late levels stay playable,
 * while paddle width and brick count carry most of the pressure. Every fifth level is a set
 * piece: more structure, a wider paddle, and a different rhythm.
 */
export function tuningFor(level: number): Tuning {
  const l = Math.max(1, level);
  const setPiece = l % 5 === 0;
  const rows = clamp(4 + Math.floor(l / 3), 4, 9);
  const cells = rows * 13;
  return {
    ballSpeed: Math.min(780, 380 + 14 * Math.sqrt(l) * 3),
    ballMaxSpeed: Math.min(1000, 620 + 22 * Math.sqrt(l) * 3),
    paddleWidth: clamp(120 - 3 * l, 72, 120) + (setPiece ? 18 : 0),
    rows,
    exoticBudget: clamp((l - 1) * 0.035, 0, 0.35) + (setPiece ? 0.08 : 0),
    hpMin: Math.round(cells * 0.3),
    hpMax: Math.round(cells * 1.15),
    setPiece,
  };
}
