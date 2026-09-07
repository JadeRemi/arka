import type { Rng } from "../core/Rng";

/**
 * Fixed-capacity particle pools backed by typed arrays. Nothing is allocated after
 * construction and dead slots are recycled by a free-list-free swap: `count` is the live
 * prefix, and killing particle `i` moves the last live one into its slot. That keeps the
 * update loop a flat scan with no branches on liveness and no GC sawtooth mid-rally.
 *
 * On overflow the oldest slot is overwritten via a rotating cursor rather than a random index,
 * so a replayed seed produces an identical frame.
 */

const DUST_CAP = 3000;
const SPARK_CAP = 800;
const RING_CAP = 48;
const POP_CAP = 64;

interface Pool {
  count: number;
}

export class DustPool implements Pool {
  count = 0;
  private cursor = 0;
  readonly x = new Float32Array(DUST_CAP);
  readonly y = new Float32Array(DUST_CAP);
  readonly vx = new Float32Array(DUST_CAP);
  readonly vy = new Float32Array(DUST_CAP);
  readonly life = new Float32Array(DUST_CAP);
  readonly maxLife = new Float32Array(DUST_CAP);
  readonly size = new Float32Array(DUST_CAP);
  readonly tint = new Uint8Array(DUST_CAP);

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    tint: number,
  ): void {
    const i = this.count < DUST_CAP ? this.count++ : (this.cursor = (this.cursor + 1) % DUST_CAP);
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = size;
    this.tint[i] = tint;
  }

  step(dt: number): void {
    const drag = Math.exp(-1.9 * dt);
    for (let i = 0; i < this.count; i++) {
      this.life[i] = (this.life[i] as number) - dt;
      if ((this.life[i] as number) <= 0) {
        this.swapKill(i);
        i--;
        continue;
      }
      this.vx[i] = (this.vx[i] as number) * drag;
      this.vy[i] = (this.vy[i] as number) * drag + 210 * dt;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
    }
  }

  private swapKill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last] as number;
    this.y[i] = this.y[last] as number;
    this.vx[i] = this.vx[last] as number;
    this.vy[i] = this.vy[last] as number;
    this.life[i] = this.life[last] as number;
    this.maxLife[i] = this.maxLife[last] as number;
    this.size[i] = this.size[last] as number;
    this.tint[i] = this.tint[last] as number;
  }

  reset(): void {
    this.count = 0;
  }
}

export class SparkPool implements Pool {
  count = 0;
  private cursor = 0;
  readonly x = new Float32Array(SPARK_CAP);
  readonly y = new Float32Array(SPARK_CAP);
  readonly vx = new Float32Array(SPARK_CAP);
  readonly vy = new Float32Array(SPARK_CAP);
  readonly life = new Float32Array(SPARK_CAP);
  readonly maxLife = new Float32Array(SPARK_CAP);
  readonly tint = new Uint8Array(SPARK_CAP);

  spawn(x: number, y: number, vx: number, vy: number, life: number, tint: number): void {
    const i =
      this.count < SPARK_CAP ? this.count++ : (this.cursor = (this.cursor + 1) % SPARK_CAP);
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.tint[i] = tint;
  }

  step(dt: number): void {
    const drag = Math.exp(-3.4 * dt);
    for (let i = 0; i < this.count; i++) {
      this.life[i] = (this.life[i] as number) - dt;
      if ((this.life[i] as number) <= 0) {
        const last = --this.count;
        if (i !== last) {
          this.x[i] = this.x[last] as number;
          this.y[i] = this.y[last] as number;
          this.vx[i] = this.vx[last] as number;
          this.vy[i] = this.vy[last] as number;
          this.life[i] = this.life[last] as number;
          this.maxLife[i] = this.maxLife[last] as number;
          this.tint[i] = this.tint[last] as number;
        }
        i--;
        continue;
      }
      this.vx[i] = (this.vx[i] as number) * drag;
      this.vy[i] = (this.vy[i] as number) * drag + 600 * dt;
      this.x[i] = (this.x[i] as number) + (this.vx[i] as number) * dt;
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
    }
  }

  reset(): void {
    this.count = 0;
  }
}

export class RingPool implements Pool {
  count = 0;
  readonly x = new Float32Array(RING_CAP);
  readonly y = new Float32Array(RING_CAP);
  readonly life = new Float32Array(RING_CAP);
  readonly maxLife = new Float32Array(RING_CAP);
  readonly radius = new Float32Array(RING_CAP);
  readonly tint = new Uint8Array(RING_CAP);

  spawn(x: number, y: number, radius: number, life: number, tint: number): void {
    const i = this.count < RING_CAP ? this.count++ : 0;
    this.x[i] = x;
    this.y[i] = y;
    this.radius[i] = radius;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.tint[i] = tint;
  }

  step(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      this.life[i] = (this.life[i] as number) - dt;
      if ((this.life[i] as number) <= 0) {
        const last = --this.count;
        if (i !== last) {
          this.x[i] = this.x[last] as number;
          this.y[i] = this.y[last] as number;
          this.life[i] = this.life[last] as number;
          this.maxLife[i] = this.maxLife[last] as number;
          this.radius[i] = this.radius[last] as number;
          this.tint[i] = this.tint[last] as number;
        }
        i--;
      }
    }
  }

  reset(): void {
    this.count = 0;
  }
}

export interface ScorePop {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  value: number;
  hot: boolean;
}

/** Floating score numbers. A small object pool, since they carry a string to render. */
export class PopPool {
  readonly items: ScorePop[] = Array.from({ length: POP_CAP }, () => ({
    x: 0,
    y: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    value: 0,
    hot: false,
  }));
  count = 0;

  spawn(x: number, y: number, value: number, hot: boolean): void {
    const i = this.count < POP_CAP ? this.count++ : 0;
    const p = this.items[i] as ScorePop;
    p.x = x;
    p.y = y;
    p.vy = -46;
    p.life = 0.85;
    p.maxLife = 0.85;
    p.value = value;
    p.hot = hot;
  }

  step(dt: number): void {
    for (let i = 0; i < this.count; i++) {
      const p = this.items[i] as ScorePop;
      p.life -= dt;
      if (p.life <= 0) {
        const last = --this.count;
        if (i !== last) {
          this.items[i] = this.items[last] as ScorePop;
          this.items[last] = p;
        }
        i--;
        continue;
      }
      p.vy *= Math.exp(-2.2 * dt);
      p.y += p.vy * dt;
    }
  }

  reset(): void {
    this.count = 0;
  }
}

/** Cone of dust puffed out along a normal. */
export function burstDust(
  pool: DustPool,
  rng: Rng,
  x: number,
  y: number,
  nx: number,
  ny: number,
  n: number,
  power: number,
  tint: number,
): void {
  for (let i = 0; i < n; i++) {
    const spread = rng.jitter(0.9);
    const c = Math.cos(spread);
    const s = Math.sin(spread);
    const dx = nx * c - ny * s;
    const dy = nx * s + ny * c;
    const sp = power * rng.range(0.35, 1);
    pool.spawn(
      x + rng.jitter(4),
      y + rng.jitter(4),
      dx * sp,
      dy * sp,
      rng.range(0.35, 0.95),
      rng.range(1.6, 4.6),
      tint,
    );
  }
}

/** Tight fan of sparks, tuned to read as metal-on-metal. */
export function burstSparks(
  pool: SparkPool,
  rng: Rng,
  x: number,
  y: number,
  nx: number,
  ny: number,
  n: number,
  power: number,
  tint: number,
): void {
  for (let i = 0; i < n; i++) {
    const spread = rng.jitter(0.55);
    const c = Math.cos(spread);
    const s = Math.sin(spread);
    pool.spawn(
      x,
      y,
      (nx * c - ny * s) * power * rng.range(0.6, 1.4),
      (nx * s + ny * c) * power * rng.range(0.6, 1.4),
      rng.range(0.14, 0.4),
      tint,
    );
  }
}
