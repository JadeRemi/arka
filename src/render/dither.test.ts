import { describe, expect, it } from "vitest";
import { BAYER, BAYER_N, bayerThreshold, buildBayer } from "./dither";

describe("Bayer matrix", () => {
  it("is a permutation of 0..n*n-1", () => {
    for (const n of [2, 4, 8, 16]) {
      const m = buildBayer(n);
      expect(m.length).toBe(n * n);
      const seen = new Set(m);
      expect(seen.size).toBe(n * n);
      expect(Math.min(...m)).toBe(0);
      expect(Math.max(...m)).toBe(n * n - 1);
    }
  });

  it("exports an 8x8 matrix", () => {
    expect(BAYER_N).toBe(8);
    expect(BAYER.length).toBe(64);
  });

  it("gives thresholds in [0,1) and wraps on the tile", () => {
    for (let y = 0; y < BAYER_N; y++) {
      for (let x = 0; x < BAYER_N; x++) {
        const t = bayerThreshold(x, y);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThan(1);
        expect(bayerThreshold(x + BAYER_N * 3, y + BAYER_N * 2)).toBeCloseTo(t, 12);
      }
    }
  });

  it("has a mean near 0.5, so a 50% mix covers half the tile", () => {
    let sum = 0;
    for (let y = 0; y < BAYER_N; y++) for (let x = 0; x < BAYER_N; x++) sum += bayerThreshold(x, y);
    expect(sum / 64).toBeCloseTo(0.5 - 1 / 128, 6);
  });
});
