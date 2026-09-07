/**
 * A locked palette. Nothing in the game may use a colour that is not defined here — that one
 * rule is what makes hand-drawn canvas art read as a coherent retro piece instead of a
 * collection of unrelated hex values.
 *
 * Ramps are ordered dark to light, so "one step darker" is an index operation, which is how
 * every bevel, shadow and hit flash is derived.
 */

export const VOID = ["#07060f", "#0d0b1c", "#141232", "#1d1a47"] as const;
export const STEEL = ["#2b2f52", "#3d4470", "#566093", "#7b86b8"] as const;
export const EMBER = ["#ff5d4a", "#ff8a3d", "#ffc24b", "#fff2b8"] as const;
export const NEON = ["#2de2c8", "#29b8e6", "#6a7cff", "#b98cff"] as const;
export const BONE = ["#cfd6ff", "#eef1ff", "#ffffff"] as const;

export type Ramp = readonly string[];

export const RAMPS = { VOID, STEEL, EMBER, NEON, BONE } as const;

/** Clamped ramp lookup, so `shade(EMBER, i + 1)` is safe at the ends. */
export function shade(ramp: Ramp, index: number): string {
  const i = index < 0 ? 0 : index >= ramp.length ? ramp.length - 1 : index | 0;
  return ramp[i] as string;
}

export const INK = {
  bg: VOID[0],
  fieldFloor: VOID[1],
  fieldWall: STEEL[0],
  frame: STEEL[2],
  frameLit: STEEL[3],
  text: BONE[1],
  textDim: STEEL[3],
  textHot: EMBER[2],
  ball: BONE[2],
  ballGlow: NEON[0],
  paddle: NEON[1],
  paddleEdge: NEON[0],
  danger: EMBER[0],
} as const;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const rgbCache = new Map<string, Rgb>();

export function toRgb(hex: string): Rgb {
  const hit = rgbCache.get(hex);
  if (hit) return hit;
  const n = parseInt(hex.slice(1), 16);
  const rgb: Rgb = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  rgbCache.set(hex, rgb);
  return rgb;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

export function withAlpha(hex: string, alpha: number): string {
  const c = toRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/** Per-row brick hue, cycling the NEON and EMBER ramps so a wall reads as banded. */
export function rowRamp(row: number): Ramp {
  const table: Ramp[] = [NEON, NEON, EMBER, EMBER, NEON, EMBER, NEON, EMBER, EMBER];
  return table[row % table.length] as Ramp;
}
