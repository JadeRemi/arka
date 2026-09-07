import { describe, expect, it } from "vitest";
import { MIN_VERTICAL_RATIO, clampSpeed, enforceAngle } from "./constraints";

describe("clampSpeed", () => {
  it("raises a slow ball to the minimum without changing direction", () => {
    const v = { x: 3, y: 4 };
    clampSpeed(v, 100, 800);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(100, 6);
    expect(v.x / v.y).toBeCloseTo(3 / 4, 6);
  });

  it("caps a fast ball at the maximum", () => {
    const v = { x: 3000, y: 0 };
    clampSpeed(v, 100, 800);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(800, 6);
  });

  it("gives a dead ball a definite launch direction", () => {
    const v = { x: 0, y: 0 };
    clampSpeed(v, 250, 800);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(250, 6);
  });
});

describe("enforceAngle", () => {
  it("lifts a near-horizontal ball to the minimum vertical ratio", () => {
    const v = { x: 400, y: 2 };
    enforceAngle(v);
    const s = Math.hypot(v.x, v.y);
    expect(Math.abs(v.y) / s).toBeCloseTo(MIN_VERTICAL_RATIO, 5);
  });

  it("preserves speed exactly when correcting the angle", () => {
    const v = { x: -500, y: 1 };
    const before = Math.hypot(v.x, v.y);
    enforceAngle(v);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(before, 6);
    expect(v.x).toBeLessThan(0);
  });

  it("nudges a perfectly vertical ball off the axis", () => {
    const v = { x: 0, y: -420 };
    enforceAngle(v);
    expect(Math.abs(v.x)).toBeGreaterThan(0);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(420, 6);
  });

  it("leaves a healthy angle untouched", () => {
    const v = { x: 300, y: -300 };
    enforceAngle(v);
    expect(v.x).toBeCloseTo(300, 9);
    expect(v.y).toBeCloseTo(-300, 9);
  });

  it("is deterministic for a zero-vertical input", () => {
    const a = { x: 100, y: 0 };
    const b = { x: 100, y: 0 };
    enforceAngle(a);
    enforceAngle(b);
    expect(a).toEqual(b);
  });
});
