import { describe, expect, it } from "vitest";
import { generateLevel } from "./generate";
import { reachable } from "./validate";
import { GRID_COLS } from "../game/field";
import { BrickKind, specFor } from "../game/kinds";

describe("generateLevel", () => {
  it("is deterministic for a given (level, seed)", () => {
    for (const level of [1, 4, 9, 17]) {
      const a = generateLevel(level, 0xc0ffee);
      const b = generateLevel(level, 0xc0ffee);
      expect(Array.from(a.kinds)).toEqual(Array.from(b.kinds));
      expect(Array.from(a.flips)).toEqual(Array.from(b.flips));
      expect(a.archetype).toBe(b.archetype);
    }
  });

  it("produces different layouts for different seeds", () => {
    const a = generateLevel(6, 1);
    const b = generateLevel(6, 2);
    expect(Array.from(a.kinds)).not.toEqual(Array.from(b.kinds));
  });

  it("always yields a clearable level across many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const level = 1 + (seed % 24);
      const spec = generateLevel(level, seed * 2654435761);
      expect(spec.destructible).toBeGreaterThan(0);

      // The invariant: no destructible brick may be sealed off by steel.
      const reach = reachable(spec.kinds, spec.rows);
      for (let i = 0; i < spec.kinds.length; i++) {
        const k = spec.kinds[i] as number;
        if (k === -1 || k === BrickKind.Steel) continue;
        expect(reach[i]).toBe(1);
      }
    }
  });

  it("keeps the grid dimensions consistent with the tuning curve", () => {
    for (let level = 1; level <= 30; level++) {
      const spec = generateLevel(level, 12345);
      expect(spec.rows).toBe(spec.tuning.rows);
      expect(spec.kinds.length).toBe(GRID_COLS * spec.rows);
      expect(spec.flips.length).toBe(GRID_COLS * spec.rows);
    }
  });

  it("lands total HP inside the difficulty band for the vast majority of seeds", () => {
    let inBand = 0;
    const n = 120;
    for (let seed = 0; seed < n; seed++) {
      const spec = generateLevel(1 + (seed % 20), seed * 40503);
      if (spec.totalHp >= spec.tuning.hpMin && spec.totalHp <= spec.tuning.hpMax) inBand++;
    }
    expect(inBand / n).toBeGreaterThan(0.9);
  });

  it("reports a total HP matching the kinds it emitted", () => {
    const spec = generateLevel(11, 777);
    let hp = 0;
    for (const k of spec.kinds) {
      if (k === -1) continue;
      const s = specFor(k);
      if (Number.isFinite(s.hp)) hp += s.hp;
    }
    expect(spec.totalHp).toBe(hp);
  });

  it("respects the exotic budget: early levels are plain", () => {
    const spec = generateLevel(1, 42);
    for (const k of spec.kinds) {
      if (k === -1) continue;
      expect(k).toBe(BrickKind.Standard);
    }
  });

  it("introduces exotic kinds by the later levels", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      for (const k of generateLevel(20, seed * 99991).kinds) if (k !== -1) seen.add(k);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it("never fills more than a fraction of the grid with steel", () => {
    for (let seed = 0; seed < 80; seed++) {
      const spec = generateLevel(1 + (seed % 25), seed * 7919);
      let steel = 0;
      let filled = 0;
      for (const k of spec.kinds) {
        if (k === -1) continue;
        filled++;
        if (k === BrickKind.Steel) steel++;
      }
      if (filled > 0) expect(steel / filled).toBeLessThan(0.35);
    }
  });
});
