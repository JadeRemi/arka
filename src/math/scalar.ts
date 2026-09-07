export const TAU = Math.PI * 2;
export const EPS = 1e-6;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return b - a === 0 ? 0 : (v - a) / (b - a);
}

export function sign(v: number): number {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}

/** Frame-rate independent exponential approach: fraction of the gap closed in `dt`. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/** Deterministic 0..1 hash, used for twinkle and jitter where a PRNG stream is inconvenient. */
export function hash11(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hash21(a: number, b: number): number {
  return hash11(Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1));
}
