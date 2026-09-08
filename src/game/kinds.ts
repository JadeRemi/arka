import { BLOCK_TABLE, BrickKind, type BlockSpec } from "../config/blocks";
import { rowRamp, type Ramp } from "../render/palette";

/**
 * Thin accessor layer over the block registry in `config/blocks.ts`. The data lives there so
 * a balance pass never has to touch gameplay code; this file only resolves raw grid values
 * (which travel through `Int8Array`s) into specs.
 */

export { BrickKind };
export type { BlockSpec as KindSpec };
export { ALL_KINDS, EXOTIC_KINDS } from "../config/blocks";

export const KINDS = BLOCK_TABLE;

/** Spec lookup for a raw grid value. Generator code carries kinds as plain numbers. */
export function specFor(kind: number): BlockSpec {
  return BLOCK_TABLE[kind as BrickKind] ?? BLOCK_TABLE[BrickKind.Standard];
}

/**
 * Base ramp a brick paints from. A kind with no ramp of its own bands by row, which is what
 * makes a wall of plain bricks read as banded rather than flat.
 */
export function kindRamp(kind: BrickKind, row: number): Ramp {
  return specFor(kind).ramp ?? rowRamp(row);
}
