import type { Rng } from "../core/Rng";
import { GRID_COLS } from "../game/field";
import { BrickKind } from "../game/kinds";
import type { Mask } from "./archetypes";
import type { Tuning } from "./tuning";

export type KindMap = Int8Array;

const idx = (c: number, r: number): number => r * GRID_COLS + c;

function neighbours(mask: Mask, rows: number, c: number, r: number): number {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0 && dr === 0) continue;
      const cc = c + dc;
      const rr = r + dr;
      if (cc < 0 || cc >= GRID_COLS || rr < 0 || rr >= rows) continue;
      n += mask[idx(cc, rr)] as number;
    }
  }
  return n;
}

/**
 * Assigns a kind to every filled cell. The exotic budget from the tuning curve caps how much
 * of the layout can be non-standard, and each kind is placed where it reads as deliberate
 * rather than sprinkled: steel at structural positions, explosives inside dense clusters,
 * glass along exposed edges.
 */
export function assignKinds(rng: Rng, mask: Mask, rows: number, tuning: Tuning): KindMap {
  const kinds = new Int8Array(GRID_COLS * rows).fill(-1);
  const filled: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (mask[idx(c, r)]) {
        kinds[idx(c, r)] = BrickKind.Standard;
        filled.push(idx(c, r));
      }
    }
  }
  if (filled.length === 0) return kinds;

  let budget = Math.floor(filled.length * tuning.exoticBudget);
  if (budget <= 0) return kinds;

  const spend = (n: number): number => {
    const take = Math.min(n, budget);
    budget -= take;
    return take;
  };

  // Weight how the budget is divided between kinds; steel is capped hard so it can never
  // dominate a layout and turn the level into a maze of indestructibles.
  const steelShare = tuning.setPiece ? 0.34 : 0.18;
  const wantSteel = spend(Math.min(Math.floor(filled.length * 0.12), Math.round(budget * steelShare)));
  const wantExplosive = spend(Math.round(budget * 0.3));
  const wantReinforced = spend(Math.round(budget * 0.45));
  const wantGlass = spend(Math.round(budget * 0.4));
  const wantMirror = spend(Math.round(budget * 0.5));
  const wantRegen = spend(budget);

  const scored = (score: (c: number, r: number) => number): number[] =>
    filled
      .filter((i) => kinds[i] === BrickKind.Standard)
      .map((i) => ({ i, s: score(i % GRID_COLS, Math.floor(i / GRID_COLS)) + rng.jitter(0.4) }))
      .sort((a, b) => b.s - a.s)
      .map((e) => e.i);

  // Steel: high neighbour count and near an edge — reads as load-bearing structure.
  place(kinds, scored((c, r) => neighbours(mask, rows, c, r) * 0.5 + edgeBias(c, r, rows)), wantSteel, BrickKind.Steel);

  // Explosive: deep inside clusters, where a chain has somewhere to go.
  place(kinds, scored((c, r) => neighbours(mask, rows, c, r)), wantExplosive, BrickKind.Explosive);

  // Reinforced: upper rows, so the wall gets harder the deeper you dig.
  place(kinds, scored((_c, r) => (rows - r) * 0.6), wantReinforced, BrickKind.Reinforced);

  // Glass: exposed cells, where a pass-through actually opens a lane.
  place(kinds, scored((c, r) => 8 - neighbours(mask, rows, c, r) + (c === 0 || c === GRID_COLS - 1 ? 1 : 0)), wantGlass, BrickKind.Glass);

  // Mirror: edges of the layout, where a diagonal deflection sends the ball somewhere new.
  place(kinds, scored((c, r) => edgeBias(c, r, rows) * 2), wantMirror, BrickKind.Mirror);

  // Regenerating: whatever is left, spread out.
  place(kinds, scored(() => 0), wantRegen, BrickKind.Regenerating);

  return kinds;
}

function edgeBias(c: number, r: number, rows: number): number {
  const dc = Math.min(c, GRID_COLS - 1 - c) / (GRID_COLS / 2);
  const dr = Math.min(r, rows - 1 - r) / Math.max(1, rows / 2);
  return 1 - Math.min(dc, dr);
}

function place(kinds: KindMap, order: number[], count: number, kind: BrickKind): void {
  let placed = 0;
  for (const i of order) {
    if (placed >= count) break;
    if (kinds[i] !== BrickKind.Standard) continue;
    kinds[i] = kind;
    placed++;
  }
}
