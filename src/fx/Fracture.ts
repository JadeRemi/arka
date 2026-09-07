import type { Rng } from "../core/Rng";
import type { Aabb } from "../math/aabb";

const SHARD_CAP = 2200;
/** Vertices per shard. Splitting a rectangle only ever yields quads. */
const V = 4;

/**
 * Brick fracture: the rectangle is split recursively along its longer axis with a jittered
 * cut, producing 6-10 convex quads. Real Voronoi shards would look no better at this size and
 * cost a diagram per break, so recursive splitting is the right trade here.
 *
 * Shards are stored flat: `poly` holds 8 floats per shard (4 local-space corners relative to
 * the shard's own centroid), so rotation is a per-shard transform at draw time and the
 * simulation only touches position, velocity and angle.
 */
export class ShardPool {
  count = 0;
  private cursor = 0;
  readonly x = new Float32Array(SHARD_CAP);
  readonly y = new Float32Array(SHARD_CAP);
  readonly vx = new Float32Array(SHARD_CAP);
  readonly vy = new Float32Array(SHARD_CAP);
  readonly angle = new Float32Array(SHARD_CAP);
  readonly spin = new Float32Array(SHARD_CAP);
  readonly life = new Float32Array(SHARD_CAP);
  readonly maxLife = new Float32Array(SHARD_CAP);
  readonly tint = new Uint8Array(SHARD_CAP);
  readonly glass = new Uint8Array(SHARD_CAP);
  readonly poly = new Float32Array(SHARD_CAP * V * 2);

  private alloc(): number {
    return this.count < SHARD_CAP
      ? this.count++
      : (this.cursor = (this.cursor + 1) % SHARD_CAP);
  }

  spawn(
    cx: number,
    cy: number,
    corners: readonly number[],
    vx: number,
    vy: number,
    spin: number,
    life: number,
    tint: number,
    glass: boolean,
  ): void {
    const i = this.alloc();
    this.x[i] = cx;
    this.y[i] = cy;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.angle[i] = 0;
    this.spin[i] = spin;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.tint[i] = tint;
    this.glass[i] = glass ? 1 : 0;
    const o = i * V * 2;
    for (let k = 0; k < V * 2; k++) this.poly[o + k] = corners[k] as number;
  }

  step(dt: number, floorY: number): void {
    const drag = Math.exp(-0.7 * dt);
    for (let i = 0; i < this.count; i++) {
      this.life[i] = (this.life[i] as number) - dt;
      if ((this.life[i] as number) <= 0 || (this.y[i] as number) > floorY) {
        const last = --this.count;
        if (i !== last) this.move(last, i);
        i--;
        continue;
      }
      this.vx[i] = (this.vx[i] as number) * drag;
      this.vy[i] = (this.vy[i] as number) * drag + 1400 * dt;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
      this.angle[i] = (this.angle[i] as number) + (this.spin[i] as number) * dt;
    }
  }

  private move(from: number, to: number): void {
    this.x[to] = this.x[from] as number;
    this.y[to] = this.y[from] as number;
    this.vx[to] = this.vx[from] as number;
    this.vy[to] = this.vy[from] as number;
    this.angle[to] = this.angle[from] as number;
    this.spin[to] = this.spin[from] as number;
    this.life[to] = this.life[from] as number;
    this.maxLife[to] = this.maxLife[from] as number;
    this.tint[to] = this.tint[from] as number;
    this.glass[to] = this.glass[from] as number;
    const a = from * V * 2;
    const b = to * V * 2;
    for (let k = 0; k < V * 2; k++) this.poly[b + k] = this.poly[a + k] as number;
  }

  reset(): void {
    this.count = 0;
    this.cursor = 0;
  }
}

interface Piece {
  x: number;
  y: number;
  w: number;
  h: number;
}

const pieces: Piece[] = [];
const corners = new Array<number>(V * 2).fill(0);

/** Recursive jittered split along the longer axis. Depth 3 gives 8 pieces before merging. */
function split(rng: Rng, x: number, y: number, w: number, h: number, depth: number): void {
  if (depth === 0 || (w < 5 && h < 5)) {
    pieces.push({ x, y, w, h });
    return;
  }
  if (w >= h) {
    const cut = w * (0.5 + rng.jitter(0.18));
    split(rng, x, y, cut, h, depth - 1);
    split(rng, x + cut, y, w - cut, h, depth - 1);
  } else {
    const cut = h * (0.5 + rng.jitter(0.18));
    split(rng, x, y, w, cut, depth - 1);
    split(rng, x, y + cut, w, h - cut, depth - 1);
  }
}

/**
 * Shatters `box` into shards flying away from an impact at (`hitX`, `hitY`) along the impact
 * normal, with the ball's own momentum partly inherited so the debris reads as pushed rather
 * than merely dropped.
 */
export function fracture(
  pool: ShardPool,
  rng: Rng,
  box: Aabb,
  hitX: number,
  hitY: number,
  nx: number,
  ny: number,
  inheritVx: number,
  inheritVy: number,
  scale: number,
  tint: number,
  glass: boolean,
): void {
  pieces.length = 0;
  const depth = scale >= 2.5 ? 4 : scale >= 1.3 ? 3 : 3;
  split(rng, box.x, box.y, box.w, box.h, depth);

  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;

  for (const p of pieces) {
    const px = p.x + p.w * 0.5;
    const py = p.y + p.h * 0.5;

    // Local corners, jittered so no two shards share an edge exactly.
    const jx = p.w * 0.12;
    const jy = p.h * 0.12;
    corners[0] = -p.w / 2 + rng.jitter(jx);
    corners[1] = -p.h / 2 + rng.jitter(jy);
    corners[2] = p.w / 2 + rng.jitter(jx);
    corners[3] = -p.h / 2 + rng.jitter(jy);
    corners[4] = p.w / 2 + rng.jitter(jx);
    corners[5] = p.h / 2 + rng.jitter(jy);
    corners[6] = -p.w / 2 + rng.jitter(jx);
    corners[7] = p.h / 2 + rng.jitter(jy);

    // Outward from the brick centre, biased along the impact normal.
    let ox = px - cx;
    let oy = py - cy;
    const ol = Math.hypot(ox, oy) || 1;
    ox /= ol;
    oy /= ol;

    // Shards nearer the impact point leave faster.
    const prox = 1 - Math.min(1, Math.hypot(px - hitX, py - hitY) / (box.w * 0.9));
    const power = rng.range(140, 320) * (0.55 + prox * 0.9);

    pool.spawn(
      px,
      py,
      corners,
      (ox * 0.7 - nx * 1.1) * power + inheritVx * 0.3 + rng.jitter(40),
      (oy * 0.7 - ny * 1.1) * power + inheritVy * 0.3 + rng.jitter(40),
      rng.jitter(11) * (0.4 + prox),
      rng.range(0.85, 1.45),
      tint,
      glass,
    );
  }
}
