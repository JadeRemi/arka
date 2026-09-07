import { describe, expect, it } from "vitest";
import { Rng, hashSeed } from "./Rng";

describe("Rng", () => {
  it("reproduces the same stream for the same seed", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 500; i++) expect(a.nextUint()).toBe(b.nextUint());
  });

  it("diverges for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    let same = 0;
    for (let i = 0; i < 200; i++) if (a.nextUint() === b.nextUint()) same++;
    expect(same).toBeLessThan(3);
  });

  it("stays inside its declared ranges", () => {
    const r = new Rng(99);
    for (let i = 0; i < 5000; i++) {
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it("has a roughly flat distribution", () => {
    const r = new Rng(7);
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i++) buckets[Math.floor(r.float() * 10)]!++;
    for (const b of buckets) expect(Math.abs(b - n / 10) / (n / 10)).toBeLessThan(0.05);
  });

  it("respects weights", () => {
    const r = new Rng(5);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[r.weighted([1, 0, 3])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.6);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.4);
  });

  it("hashSeed is stable and order dependent", () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
  });
});
