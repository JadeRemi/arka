import type { Aabb } from "../math/aabb";
import { Brick } from "./Brick";
import { CELL_H, CELL_W, GRID_COLS, GRID_ROWS, cellX, cellY, brickHeight, brickWidth } from "./field";

/**
 * Bricks live in a fixed grid, so the broad phase is arithmetic: a sweep's bounding box maps
 * straight to a range of cells. That removes any need for a spatial tree and keeps the whole
 * collision pass allocation-free.
 */
export class BrickGrid {
  readonly cols = GRID_COLS;
  readonly rows = GRID_ROWS;
  /** Row-major, `undefined` where no brick was placed. */
  private readonly cells: (Brick | undefined)[] = Array.from<Brick | undefined>({
    length: GRID_COLS * GRID_ROWS,
  }).fill(undefined);
  readonly bricks: Brick[] = [];
  /** Scratch buffer for query results; reused, so consume it before the next query. */
  private readonly query: Brick[] = [];

  clear(): void {
    this.cells.fill(undefined);
    this.bricks.length = 0;
  }

  place(col: number, row: number, kind: number, mirrorFlip: boolean): Brick {
    const brick = new Brick();
    brick.init(
      col,
      row,
      cellX(col) + 1.5,
      cellY(row) + 1.5,
      brickWidth(),
      brickHeight(),
      kind,
      mirrorFlip,
    );
    this.cells[row * this.cols + col] = brick;
    this.bricks.push(brick);
    return brick;
  }

  at(col: number, row: number): Brick | undefined {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return undefined;
    return this.cells[row * this.cols + col];
  }

  /** Live bricks whose cells intersect `box`. The returned array is reused between calls. */
  near(box: Aabb): Brick[] {
    const out = this.query;
    out.length = 0;
    const c0 = Math.max(0, Math.floor((box.x - cellX(0)) / CELL_W) - 1);
    const c1 = Math.min(this.cols - 1, Math.floor((box.x + box.w - cellX(0)) / CELL_W) + 1);
    const r0 = Math.max(0, Math.floor((box.y - cellY(0)) / CELL_H) - 1);
    const r1 = Math.min(this.rows - 1, Math.floor((box.y + box.h - cellY(0)) / CELL_H) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const b = this.cells[r * this.cols + c];
        if (b && b.alive) out.push(b);
      }
    }
    return out;
  }

  /** Live bricks within `radius` cells of (col, row), Chebyshev-ish with a circular falloff. */
  blastTargets(col: number, row: number, radius: number, out: Brick[]): Brick[] {
    out.length = 0;
    const r = Math.ceil(radius);
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (dc === 0 && dr === 0) continue;
        if (Math.hypot(dc, dr) > radius + 0.001) continue;
        const b = this.at(col + dc, row + dr);
        if (b && b.alive) out.push(b);
      }
    }
    return out;
  }

  /** Bricks that still stand between the player and a level clear. */
  countBlocking(): number {
    let n = 0;
    for (const b of this.bricks) if (b.blocksClear) n++;
    return n;
  }

  countAlive(): number {
    let n = 0;
    for (const b of this.bricks) if (b.alive) n++;
    return n;
  }
}
