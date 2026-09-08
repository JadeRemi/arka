import { describe, expect, it } from "vitest";
import { accumulateLocked, movementToDesign } from "./pointer";

describe("movementToDesign", () => {
  it("matches the unlocked conversion factor at dpr 1", () => {
    // Viewport.toDesignX divides by scale after multiplying by dpr, so the delta must too.
    expect(movementToDesign(10, 1, 1, 1)).toBeCloseTo(10, 9);
    expect(movementToDesign(10, 1, 0.5, 1)).toBeCloseTo(20, 9);
    expect(movementToDesign(10, 1, 2, 1)).toBeCloseTo(5, 9);
  });

  it("scales with device pixel ratio", () => {
    expect(movementToDesign(10, 2, 2, 1)).toBeCloseTo(10, 9);
  });

  it("applies sensitivity linearly and preserves direction", () => {
    expect(movementToDesign(10, 1, 1, 1.5)).toBeCloseTo(15, 9);
    expect(movementToDesign(-10, 1, 1, 1.5)).toBeCloseTo(-15, 9);
  });

  it("returns zero rather than infinity for a degenerate scale", () => {
    expect(movementToDesign(10, 1, 0, 1)).toBe(0);
    expect(movementToDesign(10, 1, -1, 1)).toBe(0);
  });
});

describe("accumulateLocked", () => {
  it("adds the delta inside the range", () => {
    expect(accumulateLocked(100, 25, 0, 500)).toBe(125);
    expect(accumulateLocked(100, -25, 0, 500)).toBe(75);
  });

  it("clamps at both ends instead of drifting past them", () => {
    expect(accumulateLocked(10, -999, 0, 500)).toBe(0);
    expect(accumulateLocked(490, 999, 0, 500)).toBe(500);
  });

  it("responds immediately after being clamped — no dead zone to cross back", () => {
    // This is the whole point of clamping: an unclamped accumulator would sit at -9000 and
    // need 9000 px of travel before the paddle moved again.
    const pinned = accumulateLocked(10, -9000, 0, 500);
    expect(pinned).toBe(0);
    expect(accumulateLocked(pinned, 5, 0, 500)).toBe(5);
  });

  it("handles an inverted range without producing NaN", () => {
    expect(Number.isFinite(accumulateLocked(10, 5, 100, 0))).toBe(true);
  });
});
