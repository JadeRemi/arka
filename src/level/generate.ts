import { Rng, hashSeed } from "../core/Rng";
import { GRID_COLS } from "../game/field";
import { BrickKind } from "../game/kinds";
import { buildMask, pickArchetype, type ArchetypeId } from "./archetypes";
import { assignKinds, type KindMap } from "./kinds";
import { validate } from "./validate";
import { tuningFor, type Tuning } from "./tuning";

export interface LevelSpec {
  readonly level: number;
  readonly seed: number;
  readonly archetype: ArchetypeId;
  readonly rows: number;
  /** Row-major, length `GRID_COLS * rows`. -1 means empty. */
  readonly kinds: KindMap;
  /** Per-brick diagonal orientation for Mirror bricks. */
  readonly flips: Uint8Array;
  readonly tuning: Tuning;
  readonly destructible: number;
  readonly totalHp: number;
  /** Drives which background variant the level paints. */
  readonly backdropSeed: number;
}

const MAX_ATTEMPTS = 8;

/**
 * Builds a level from `(level, seed)` alone. Nothing is stored — a level is reproduced by
 * replaying its seed, which is also what makes the generation tests possible.
 *
 * Generation is a retry loop rather than a single pass: an archetype plus a density can land
 * outside the HP band or produce a layout that validation had to gut, and it is cheaper to
 * roll again than to try to repair a bad layout into a good one.
 */
export function generateLevel(level: number, seed: number): LevelSpec {
  const tuning = tuningFor(level);
  const rows = tuning.rows;

  let best: { kinds: KindMap; flips: Uint8Array; archetype: ArchetypeId; hp: number; n: number } | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = new Rng(hashSeed(seed, level, attempt), hashSeed(level, attempt, 0x5bf03635));
    const archetype = pickArchetype(rng, level);
    const density = 0.5 + rng.jitter(0.14) + Math.min(0.16, level * 0.012) + attempt * 0.04;

    const mask = buildMask(rng, archetype, rows, Math.min(0.9, density));
    if (countMask(mask) < rows * 2) continue;

    const kinds = assignKinds(rng, mask, rows, tuning);
    const flips = new Uint8Array(GRID_COLS * rows);
    for (let i = 0; i < flips.length; i++) {
      if (kinds[i] === BrickKind.Mirror) flips[i] = rng.bool() ? 1 : 0;
    }

    const result = validate(kinds, rows);
    if (result.destructible === 0) continue;

    const candidate = {
      kinds,
      flips,
      archetype,
      hp: result.totalHp,
      n: result.destructible,
    };

    const inBand = result.totalHp >= tuning.hpMin && result.totalHp <= tuning.hpMax;
    if (inBand) {
      best = candidate;
      break;
    }
    // Keep whichever attempt sits closest to the band, in case none lands inside it.
    if (!best || bandDistance(candidate.hp, tuning) < bandDistance(best.hp, tuning)) {
      best = candidate;
    }
  }

  if (!best) {
    // Guaranteed-valid fallback: a plain solid wall. Reached only if every archetype attempt
    // degenerated, which the tests assert does not happen for real seeds.
    const kinds = new Int8Array(GRID_COLS * rows).fill(-1);
    for (let r = 0; r < Math.min(rows, 4); r++) {
      for (let c = 0; c < GRID_COLS; c++) kinds[r * GRID_COLS + c] = BrickKind.Standard;
    }
    const result = validate(kinds, rows);
    best = {
      kinds,
      flips: new Uint8Array(GRID_COLS * rows),
      archetype: "mirror",
      hp: result.totalHp,
      n: result.destructible,
    };
  }

  return {
    level,
    seed,
    archetype: best.archetype,
    rows,
    kinds: best.kinds,
    flips: best.flips,
    tuning,
    destructible: best.n,
    totalHp: best.hp,
    backdropSeed: hashSeed(seed, level, 0x1b873593),
  };
}

function bandDistance(hp: number, tuning: Tuning): number {
  if (hp < tuning.hpMin) return tuning.hpMin - hp;
  if (hp > tuning.hpMax) return hp - tuning.hpMax;
  return 0;
}

function countMask(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) n += v;
  return n;
}
