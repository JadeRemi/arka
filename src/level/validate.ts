import { GRID_COLS } from "../game/field";
import { BrickKind, specFor } from "../game/kinds";
import type { KindMap } from "./kinds";

const idx = (c: number, r: number): number => r * GRID_COLS + c;

export interface ValidationResult {
  /** Sum of HP over every destructible brick. */
  totalHp: number;
  destructible: number;
  /** Bricks that had to be downgraded or removed to make the level finishable. */
  repaired: number;
}

/**
 * Guarantees the level can actually be finished. A procedural layout can wall a destructible
 * brick behind indestructible steel, which would leave the player with no way to clear the
 * level and no feedback about why — the single worst failure mode of generated content.
 *
 * The check: flood-fill the empty space from the open rally area below the wall, treating any
 * non-steel cell as passable (the ball will eventually break through those). Every
 * destructible brick must touch that reachable space. Anything that does not is removed, and
 * steel that seals a pocket is downgraded to reinforced.
 */
export function validate(kinds: KindMap, rows: number): ValidationResult {
  const size = GRID_COLS * rows;
  let repaired = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const reach = new Uint8Array(size);
    const stack: number[] = [];

    // Seed from every cell on the bottom row that is not steel — that is where the ball comes
    // from — plus the side columns, which the ball can travel up.
    for (let c = 0; c < GRID_COLS; c++) {
      const i = idx(c, rows - 1);
      if (kinds[i] !== BrickKind.Steel) stack.push(i);
    }
    for (let r = 0; r < rows; r++) {
      for (const c of [0, GRID_COLS - 1]) {
        const i = idx(c, r);
        if (kinds[i] === -1) stack.push(i);
      }
    }

    while (stack.length > 0) {
      const i = stack.pop() as number;
      if (reach[i]) continue;
      if (kinds[i] === BrickKind.Steel) continue;
      reach[i] = 1;
      const c = i % GRID_COLS;
      const r = (i - c) / GRID_COLS;
      if (c > 0) stack.push(idx(c - 1, r));
      if (c < GRID_COLS - 1) stack.push(idx(c + 1, r));
      if (r > 0) stack.push(idx(c, r - 1));
      if (r < rows - 1) stack.push(idx(c, r + 1));
    }

    // Any destructible brick outside the reachable set is sealed in. Free it by demoting the
    // steel that encloses it; if that is not possible, remove the brick.
    let sealed = 0;
    for (let i = 0; i < size; i++) {
      const k = kinds[i] as number;
      if (k === -1 || k === BrickKind.Steel) continue;
      if (reach[i]) continue;
      sealed++;
      const c = i % GRID_COLS;
      const r = (i - c) / GRID_COLS;
      const demoted = demoteNeighbourSteel(kinds, rows, c, r);
      if (!demoted) {
        kinds[i] = -1;
      }
      repaired++;
    }
    if (sealed === 0) break;
  }

  // Final sweep: anything still unreachable is removed outright, so the invariant holds.
  const reach = reachable(kinds, rows);
  let totalHp = 0;
  let destructible = 0;
  for (let i = 0; i < size; i++) {
    const k = kinds[i] as number;
    if (k === -1) continue;
    if (k === BrickKind.Steel) continue;
    if (!reach[i]) {
      kinds[i] = -1;
      repaired++;
      continue;
    }
    destructible++;
    const spec = specFor(k);
    totalHp += Number.isFinite(spec.hp) ? spec.hp : 0;
  }

  return { totalHp, destructible, repaired };
}

/** Cells the ball can eventually occupy, treating steel as solid and all else as passable. */
export function reachable(kinds: KindMap, rows: number): Uint8Array {
  const size = GRID_COLS * rows;
  const reach = new Uint8Array(size);
  const stack: number[] = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const i = idx(c, rows - 1);
    if (kinds[i] !== BrickKind.Steel) stack.push(i);
  }
  for (let r = 0; r < rows; r++) {
    for (const c of [0, GRID_COLS - 1]) {
      const i = idx(c, r);
      if (kinds[i] === -1) stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    if (reach[i]) continue;
    if (kinds[i] === BrickKind.Steel) continue;
    reach[i] = 1;
    const c = i % GRID_COLS;
    const r = (i - c) / GRID_COLS;
    if (c > 0) stack.push(idx(c - 1, r));
    if (c < GRID_COLS - 1) stack.push(idx(c + 1, r));
    if (r > 0) stack.push(idx(c, r - 1));
    if (r < rows - 1) stack.push(idx(c, r + 1));
  }
  return reach;
}

function demoteNeighbourSteel(kinds: KindMap, rows: number, c: number, r: number): boolean {
  const around: [number, number][] = [
    [c - 1, r],
    [c + 1, r],
    [c, r - 1],
    [c, r + 1],
  ];
  for (const [cc, rr] of around) {
    if (cc < 0 || cc >= GRID_COLS || rr < 0 || rr >= rows) continue;
    const i = idx(cc, rr);
    if (kinds[i] === BrickKind.Steel) {
      kinds[i] = BrickKind.Reinforced;
      return true;
    }
  }
  return false;
}
