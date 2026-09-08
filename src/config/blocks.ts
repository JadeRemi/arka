import { EMBER, NEON, STEEL, type Ramp } from "../render/palette";

/**
 * The block registry.
 *
 * Adding a block type is three edits and nothing else:
 *   1. an id in `BrickKind` below,
 *   2. a row in `BLOCK_TABLE`,
 *   3. a `case` in `render/painters/bricks.ts` for how it looks.
 *
 * Everything else — generation budgets, collision response, scoring, the win condition,
 * fracture behaviour — reads the table, so no gameplay file needs to know the type exists.
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

export interface BlockSpec {
  readonly name: string;
  /** Hits to destroy. `Infinity` for indestructible. */
  readonly hp: number;
  readonly score: number;
  /** False means the ball keeps its velocity and passes through (Glass). */
  readonly reflects: boolean;
  /** Blast radius in brick widths; 0 for no explosion. */
  readonly blastRadius: number;
  /** Seconds until it rebuilds, and how many times it may. 0 disables. */
  readonly rebuildDelay: number;
  readonly rebuildLimit: number;
  /** Shards produced on a break, as a multiplier of the default fracture count. */
  readonly shardScale: number;
  /** True means the reflection normal follows the brick's diagonal, not the hit face. */
  readonly diagonal: boolean;
  /** Counts toward the level-clear condition. */
  readonly clearable: boolean;
  /** Relative likelihood of dropping a power-up when destroyed. */
  readonly dropBias: number;
  /** Which palette ramp the painter works from. `undefined` means band by row. */
  readonly ramp: Ramp | undefined;
  /** Weight in the generator's exotic budget. 0 means never placed automatically. */
  readonly generatorWeight: number;
}

const BASE = {
  reflects: true,
  blastRadius: 0,
  rebuildDelay: 0,
  rebuildLimit: 0,
  shardScale: 1,
  diagonal: false,
  clearable: true,
  dropBias: 1,
  ramp: undefined,
  generatorWeight: 1,
} satisfies Omit<BlockSpec, "name" | "hp" | "score">;

export const BLOCK_TABLE: Readonly<Record<BrickKind, BlockSpec>> = {
  [BrickKind.Standard]: {
    ...BASE,
    name: "standard",
    hp: 1,
    score: 100,
  },
  [BrickKind.Reinforced]: {
    ...BASE,
    name: "reinforced",
    hp: 3,
    score: 250,
    shardScale: 1.4,
    dropBias: 1.6,
    ramp: STEEL,
    generatorWeight: 0.45,
  },
  [BrickKind.Steel]: {
    ...BASE,
    name: "steel",
    hp: Number.POSITIVE_INFINITY,
    score: 0,
    clearable: false,
    dropBias: 0,
    ramp: STEEL,
    generatorWeight: 0.18,
  },
  [BrickKind.Explosive]: {
    ...BASE,
    name: "explosive",
    hp: 1,
    score: 300,
    blastRadius: 1.6,
    shardScale: 1.8,
    dropBias: 0.6,
    ramp: EMBER,
    generatorWeight: 0.3,
  },
  [BrickKind.Glass]: {
    ...BASE,
    name: "glass",
    hp: 1,
    score: 150,
    reflects: false,
    shardScale: 3,
    dropBias: 1.3,
    ramp: NEON,
    generatorWeight: 0.4,
  },
  [BrickKind.Regenerating]: {
    ...BASE,
    name: "regenerating",
    hp: 1,
    score: 120,
    rebuildDelay: 8,
    rebuildLimit: 3,
    dropBias: 0.8,
    ramp: NEON,
    generatorWeight: 0.35,
  },
  [BrickKind.Mirror]: {
    ...BASE,
    name: "mirror",
    hp: 2,
    score: 200,
    diagonal: true,
    dropBias: 1.4,
    ramp: STEEL,
    generatorWeight: 0.5,
  },
};

export const ALL_KINDS: readonly BrickKind[] = Object.keys(BLOCK_TABLE).map(
  (k) => Number(k) as BrickKind,
);

/** Kinds the generator may place from its exotic budget, in placement order. */
export const EXOTIC_KINDS: readonly BrickKind[] = [
  BrickKind.Steel,
  BrickKind.Explosive,
  BrickKind.Reinforced,
  BrickKind.Glass,
  BrickKind.Mirror,
  BrickKind.Regenerating,
];
