import type { Rng } from "../core/Rng";
import { GRID_COLS } from "../game/field";

export type Mask = Uint8Array;

export type ArchetypeId = "mirror" | "rings" | "automaton" | "lattice" | "sentinel";

export const ARCHETYPES: readonly ArchetypeId[] = [
  "mirror",
  "rings",
  "automaton",
  "lattice",
  "sentinel",
];

/**
 * Display names for the level-intro card. The generator ids are mechanical; these are what the
 * player is told, and they should describe the shape they are about to face.
 */
export const ARCHETYPE_LABELS: Readonly<Record<ArchetypeId, string>> = {
  mirror: "mirrored",
  rings: "concentric",
  automaton: "overgrowth",
  lattice: "lattice",
  sentinel: "sentinel",
};

export const ARCHETYPE_BLURBS: Readonly<Record<ArchetypeId, string>> = {
  mirror: "symmetrical wall",
  rings: "nested shells",
  automaton: "organic mass",
  lattice: "woven diagonals",
  sentinel: "shielded core",
};

export function makeMask(rows: number): Mask {
  return new Uint8Array(GRID_COLS * rows);
}

const idx = (c: number, r: number): number => r * GRID_COLS + c;

/** Weighted archetype choice. Early levels stay readable; the organic ones arrive later. */
export function pickArchetype(rng: Rng, level: number): ArchetypeId {
  const l = Math.max(1, level);
  const weights = [
    l < 3 ? 6 : 3, // mirror
    l < 2 ? 1 : 3, // rings
    l < 4 ? 0.3 : 3, // automaton
    l < 5 ? 0.3 : 2.5, // lattice
    l < 7 ? 0.2 : 2.5, // sentinel
  ];
  return ARCHETYPES[rng.weighted(weights)] as ArchetypeId;
}

export function buildMask(rng: Rng, id: ArchetypeId, rows: number, density: number): Mask {
  switch (id) {
    case "mirror":
      return mirror(rng, rows, density);
    case "rings":
      return rings(rng, rows);
    case "automaton":
      return automaton(rng, rows, density);
    case "lattice":
      return lattice(rng, rows);
    case "sentinel":
      return sentinel(rng, rows);
  }
}

/** Generate the left half with weighted noise, mirror it. Always reads as intentional. */
function mirror(rng: Rng, rows: number, density: number): Mask {
  const m = makeMask(rows);
  const half = Math.ceil(GRID_COLS / 2);
  for (let r = 0; r < rows; r++) {
    // Rows thin out toward the bottom so the wall has an eroded silhouette.
    const p = density * (1 - r / (rows + 2)) + 0.18;
    for (let c = 0; c < half; c++) {
      const on = rng.bool(p) ? 1 : 0;
      m[idx(c, r)] = on;
      m[idx(GRID_COLS - 1 - c, r)] = on;
    }
  }
  return m;
}

/** Concentric rounded rectangles with gaps punched through them. */
function rings(rng: Rng, rows: number): Mask {
  const m = makeMask(rows);
  const cx = (GRID_COLS - 1) / 2;
  const cy = (rows - 1) / 2;
  const bands = rng.int(2, 3);
  const thickness = rng.range(0.7, 1.1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const d = Math.max(Math.abs(c - cx) / (GRID_COLS / 2), Math.abs(r - cy) / (rows / 2));
      const band = d * bands * 2;
      const inBand = Math.abs((band % 2) - 1) > 1 - thickness * 0.5;
      m[idx(c, r)] = inBand ? 1 : 0;
    }
  }
  // Punch radial gaps so the interior is reachable.
  const gaps = rng.int(2, 4);
  for (let g = 0; g < gaps; g++) {
    const col = rng.int(1, GRID_COLS - 2);
    for (let r = 0; r < rows; r++) if (rng.bool(0.8)) m[idx(col, r)] = 0;
  }
  return m;
}

/** Random fill, then smoothing generations. Produces organic caverns. */
function automaton(rng: Rng, rows: number, density: number): Mask {
  let m = makeMask(rows);
  for (let i = 0; i < m.length; i++) m[i] = rng.bool(density) ? 1 : 0;

  for (let gen = 0; gen < 3; gen++) {
    const next = makeMask(rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dc === 0 && dr === 0) continue;
            const cc = c + dc;
            const rr = r + dr;
            if (cc < 0 || cc >= GRID_COLS || rr < 0 || rr >= rows) continue;
            n += m[idx(cc, rr)] as number;
          }
        }
        // B678 / S345678: grows blobs, erodes speckle.
        next[idx(c, r)] = (m[idx(c, r)] ? n >= 3 : n >= 6) ? 1 : 0;
      }
    }
    m = next;
  }
  return m;
}

/** Diagonal weave with nodes at the crossings. */
function lattice(rng: Rng, rows: number): Mask {
  const m = makeMask(rows);
  const pitch = rng.int(3, 4);
  const thick = rng.bool(0.5) ? 1 : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const a = (c + r) % pitch;
      const b = (c - r + GRID_COLS * 4) % pitch;
      m[idx(c, r)] = a === 0 || b === 0 || (thick && (a === 1 || b === 1)) ? 1 : 0;
    }
  }
  return m;
}

/** A dense core inside a shell, with a moat between them. */
function sentinel(rng: Rng, rows: number): Mask {
  const m = makeMask(rows);
  const inset = rng.int(2, 3);
  const coreTop = Math.max(1, Math.floor(rows * 0.35));
  const coreBottom = Math.min(rows - 1, coreTop + rng.int(1, 3));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const onShell = r === 0 || c === 0 || c === GRID_COLS - 1;
      const inCore = r >= coreTop && r <= coreBottom && c >= inset && c < GRID_COLS - inset;
      m[idx(c, r)] = onShell || inCore ? 1 : 0;
    }
  }
  // Break the shell so the core is not sealed off.
  for (let i = 0; i < rng.int(2, 4); i++) {
    m[idx(rng.int(1, GRID_COLS - 2), 0)] = 0;
  }
  for (let r = 1; r < rows; r++) {
    if (rng.bool(0.4)) m[idx(0, r)] = 0;
    if (rng.bool(0.4)) m[idx(GRID_COLS - 1, r)] = 0;
  }
  return m;
}
