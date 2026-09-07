import { EMBER, NEON, STEEL, type Ramp, rowRamp } from "../render/palette";

/**
 * A const object rather than an `enum`: the kind of a cell travels through `Int8Array`s in the
 * level generator, and a real enum makes every one of those comparisons a type error for no
 * safety gain.
 */
export const BrickKind = {
  Standard: 0,
  Reinforced: 1,
  Steel: 2,
  Explosive: 3,
  Glass: 4,
  Regenerating: 5,
  Mirror: 6,
} as const;

export type BrickKind = (typeof BrickKind)[keyof typeof BrickKind];

export const ALL_KINDS: readonly BrickKind[] = [
  BrickKind.Standard,
  BrickKind.Reinforced,
  BrickKind.Steel,
  BrickKind.Explosive,
  BrickKind.Glass,
  BrickKind.Regenerating,
  BrickKind.Mirror,
];

export interface KindSpec {
  readonly name: string;
  /** Number of hits to destroy. `Infinity` for indestructible. */
  readonly hp: number;
  readonly score: number;
  /** False for Glass — the ball keeps going instead of reflecting. */
  readonly reflects: boolean;
  /** Explosive only: blast radius, in brick widths. */
  readonly blastRadius: number;
  /** Regenerating only: seconds until it rebuilds, and how many times it may. */
  readonly rebuildDelay: number;
  readonly rebuildLimit: number;
  /** Shards produced by a break, as a multiplier of the default fracture count. */
  readonly shardScale: number;
  /** True for Mirror — its reflection normal follows the diagonal, not the hit face. */
  readonly diagonal: boolean;
  /** Counts toward the level-clear condition. */
  readonly clearable: boolean;
}

const D: Omit<KindSpec, "name" | "hp" | "score"> = {
  reflects: true,
  blastRadius: 0,
  rebuildDelay: 0,
  rebuildLimit: 0,
  shardScale: 1,
  diagonal: false,
  clearable: true,
};

export const KINDS: Readonly<Record<BrickKind, KindSpec>> = {
  [BrickKind.Standard]: { ...D, name: "standard", hp: 1, score: 100 },
  [BrickKind.Reinforced]: { ...D, name: "reinforced", hp: 3, score: 250, shardScale: 1.4 },
  [BrickKind.Steel]: {
    ...D,
    name: "steel",
    hp: Number.POSITIVE_INFINITY,
    score: 0,
    clearable: false,
  },
  [BrickKind.Explosive]: {
    ...D,
    name: "explosive",
    hp: 1,
    score: 300,
    blastRadius: 1.6,
    shardScale: 1.8,
  },
  [BrickKind.Glass]: {
    ...D,
    name: "glass",
    hp: 1,
    score: 150,
    reflects: false,
    shardScale: 3,
  },
  [BrickKind.Regenerating]: {
    ...D,
    name: "regenerating",
    hp: 1,
    score: 120,
    rebuildDelay: 8,
    rebuildLimit: 3,
  },
  [BrickKind.Mirror]: { ...D, name: "mirror", hp: 2, score: 200, diagonal: true },
};

/** Spec lookup for a raw grid value. Generator code carries kinds as plain numbers. */
export function specFor(kind: number): KindSpec {
  return KINDS[kind as BrickKind] ?? KINDS[BrickKind.Standard];
}

/** Base ramp a brick paints from. Standard bricks band by row; the rest are identifiable. */
export function kindRamp(kind: BrickKind, row: number): Ramp {
  switch (kind) {
    case BrickKind.Standard:
      return rowRamp(row);
    case BrickKind.Reinforced:
    case BrickKind.Steel:
    case BrickKind.Mirror:
      return STEEL;
    case BrickKind.Explosive:
      return EMBER;
    case BrickKind.Glass:
    case BrickKind.Regenerating:
      return NEON;
  }
}
