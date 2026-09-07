import { clamp01 } from "../math/scalar";

export const BAYER_N = 8;
const BAYER_SIZE = BAYER_N * BAYER_N;
/** 17 mix levels: 0/16 .. 16/16. Enough for smooth ramps, small enough to bake at boot. */
export const MIX_LEVELS = 17;
const CACHE_LIMIT = 512;

/**
 * Recursive Bayer construction: M(2n) is built from M(n) by the standard
 * [[4m, 4m+2], [4m+3, 4m+1]] expansion. Yields a permutation of 0..n*n-1.
 * Reference: https://en.wikipedia.org/wiki/Ordered_dithering
 */
export function buildBayer(n: number): Uint8Array {
  let size = 1;
  let m = new Uint8Array([0]);
  while (size < n) {
    const next = size * 2;
    const out = new Uint8Array(next * next);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = (m[y * size + x] as number) * 4;
        out[y * next + x] = v;
        out[y * next + x + size] = v + 2;
        out[(y + size) * next + x] = v + 3;
        out[(y + size) * next + x + size] = v + 1;
      }
    }
    m = out;
    size = next;
  }
  return m;
}

export const BAYER = buildBayer(BAYER_N);

/** Threshold in [0,1) for the tile pixel at (x, y). */
export function bayerThreshold(x: number, y: number): number {
  const i = (y & (BAYER_N - 1)) * BAYER_N + (x & (BAYER_N - 1));
  return (BAYER[i] as number) / BAYER_SIZE;
}

type Ctx2D = CanvasRenderingContext2D;

interface Entry {
  pattern: CanvasPattern;
}

/**
 * LRU pattern cache. A Map preserves insertion order, so evicting the oldest key is a
 * `keys().next()` — no separate list to maintain. Bounded so a long session cannot grow it
 * without limit.
 */
const cache = new Map<string, Entry>();

function remember(key: string, pattern: CanvasPattern): CanvasPattern {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { pattern });
  return pattern;
}

let scratch: CanvasRenderingContext2D | undefined;

function tileCtx(): CanvasRenderingContext2D {
  if (scratch) return scratch;
  const c = document.createElement("canvas");
  c.width = BAYER_N;
  c.height = BAYER_N;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("dither: 2D context unavailable");
  scratch = ctx;
  return ctx;
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * An 8x8 repeating pattern that mixes `a` and `b` at `level/16` using the Bayer threshold.
 * Baked once per (a, b, level) triple and reused for the life of the session.
 */
export function ditherPattern(ctx: Ctx2D, a: string, b: string, level: number): CanvasPattern {
  const lv = Math.round(clamp01(level / (MIX_LEVELS - 1)) * (MIX_LEVELS - 1));
  const key = `${a}|${b}|${lv}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.pattern;
  }

  const t = lv / (MIX_LEVELS - 1);
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);

  const tc = tileCtx();
  const img = tc.createImageData(BAYER_N, BAYER_N);
  const px = img.data;
  for (let y = 0; y < BAYER_N; y++) {
    for (let x = 0; x < BAYER_N; x++) {
      const i = (y * BAYER_N + x) * 4;
      const useB = t > bayerThreshold(x, y);
      px[i] = useB ? br : ar;
      px[i + 1] = useB ? bg : ag;
      px[i + 2] = useB ? bb : ab;
      px[i + 3] = 255;
    }
  }
  tc.putImageData(img, 0, 0);

  const pattern = ctx.createPattern(tc.canvas, "repeat");
  if (!pattern) throw new Error("dither: createPattern failed");
  return remember(key, pattern);
}

/**
 * Vertical dithered gradient. Drawn as horizontal bands whose mix level steps through the
 * ramp; the Bayer noise inside each band hides the step, so ~8 bands read as continuous.
 */
export function fillDitherV(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  top: string,
  bottom: string,
  bands = 10,
): void {
  const n = Math.max(1, Math.min(bands, MIX_LEVELS));
  const step = h / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    ctx.fillStyle = ditherPattern(ctx, top, bottom, t * (MIX_LEVELS - 1));
    const y0 = y + step * i;
    const y1 = i === n - 1 ? y + h : y + step * (i + 1);
    ctx.fillRect(x, y0, w, y1 - y0);
  }
}

/** Horizontal counterpart of {@link fillDitherV}. */
export function fillDitherH(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  left: string,
  right: string,
  bands = 10,
): void {
  const n = Math.max(1, Math.min(bands, MIX_LEVELS));
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    ctx.fillStyle = ditherPattern(ctx, left, right, t * (MIX_LEVELS - 1));
    const x0 = x + step * i;
    const x1 = i === n - 1 ? x + w : x + step * (i + 1);
    ctx.fillRect(x0, y, x1 - x0, h);
  }
}

/** Radial dithered gradient, drawn as concentric annuli from the outside in. */
export function fillDitherRadial(
  ctx: Ctx2D,
  cx: number,
  cy: number,
  radius: number,
  inner: string,
  outer: string,
  bands = 10,
): void {
  const n = Math.max(1, Math.min(bands, MIX_LEVELS));
  for (let i = n - 1; i >= 0; i--) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    ctx.fillStyle = ditherPattern(ctx, inner, outer, t * (MIX_LEVELS - 1));
    const r = radius * ((i + 1) / n);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Fill an arbitrary path with a flat dither mix, used for shards and silhouettes. */
export function setDitherFill(ctx: Ctx2D, a: string, b: string, t: number): void {
  ctx.fillStyle = ditherPattern(ctx, a, b, clamp01(t) * (MIX_LEVELS - 1));
}

export function clearDitherCache(): void {
  cache.clear();
}

export function ditherCacheSize(): number {
  return cache.size;
}
