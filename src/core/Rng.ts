/**
 * sfc32 ("Small Fast Counting", PractRand). Pure 32-bit arithmetic, so it is exactly
 * reproducible in JS with no 64-bit emulation, and it passes PractRand where a bare
 * xorshift32 or LCG does not. Determinism matters here: a level is stored as a seed, never
 * as data, and the generation tests replay seeds.
 */
export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed = 0x2545f491, sequence = 0x9e3779b9) {
    this.seed(seed, sequence);
  }

  seed(seed: number, sequence = 0x9e3779b9): void {
    this.a = (seed ^ 0x9e3779b9) >>> 0;
    this.b = (sequence ^ 0x243f6a88) >>> 0;
    this.c = (Math.imul(seed, 0x85ebca6b) ^ sequence) >>> 0;
    this.d = 1;
    for (let i = 0; i < 12; i++) this.nextUint();
  }

  /** 32-bit unsigned. */
  nextUint(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** [0, 1) */
  float(): number {
    return this.nextUint() / 4294967296;
  }

  /** [lo, hi) */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.float();
  }

  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.float() * (hi - lo + 1));
  }

  bool(p = 0.5): boolean {
    return this.float() < p;
  }

  sign(): number {
    return this.nextUint() & 1 ? 1 : -1;
  }

  /** Symmetric jitter in [-m, m]. */
  jitter(m: number): number {
    return (this.float() * 2 - 1) * m;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: empty array");
    return items[Math.floor(this.float() * items.length)] as T;
  }

  /** Index into `weights`, with probability proportional to each value. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return 0;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] as number;
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      const t = items[i] as T;
      items[i] = items[j] as T;
      items[j] = t;
    }
    return items;
  }

  fork(salt: number): Rng {
    return new Rng(this.nextUint() ^ salt, this.nextUint());
  }
}

export function hashSeed(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    h = (h ^ (p | 0)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
