import { describe, expect, it } from "vitest";
import { sweptCircleAabb } from "./swept";

const box = { x: 100, y: 100, w: 60, h: 20 };

describe("sweptCircleAabb", () => {
  it("hits the top face head-on and reports an upward normal", () => {
    const hit = sweptCircleAabb({ x: 130, y: 50 }, { x: 0, y: 100 }, box, 5);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe("face");
    expect(hit!.nx).toBe(0);
    expect(hit!.ny).toBe(-1);
    // Contact when the centre reaches y = 100 - r = 95, i.e. 45 of the 100 units travelled.
    expect(hit!.t).toBeCloseTo(0.45, 6);
  });

  it("hits the left face and reports a leftward normal", () => {
    const hit = sweptCircleAabb({ x: 40, y: 110 }, { x: 100, y: 0 }, box, 5);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe("face");
    expect(hit!.nx).toBe(-1);
    expect(hit!.t).toBeCloseTo(0.55, 6);
  });

  it("resolves a corner graze as a corner with a diagonal normal", () => {
    const hit = sweptCircleAabb({ x: 80, y: 80 }, { x: 30, y: 30 }, box, 6);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe("corner");
    expect(hit!.nx).toBeLessThan(0);
    expect(hit!.ny).toBeLessThan(0);
    expect(Math.hypot(hit!.nx, hit!.ny)).toBeCloseTo(1, 6);
  });

  it("misses when the path passes outside the expansion", () => {
    expect(sweptCircleAabb({ x: 0, y: 0 }, { x: 0, y: 90 }, box, 5)).toBeNull();
    expect(sweptCircleAabb({ x: 130, y: 50 }, { x: 0, y: 40 }, box, 5)).toBeNull();
  });

  it("does not tunnel through a thin brick at extreme speed", () => {
    const thin = { x: 0, y: 300, w: 400, h: 8 };
    // 3000 px/s at a 120 Hz step is 25 px of travel; the sweep must still catch an 8 px brick.
    const hit = sweptCircleAabb({ x: 200, y: 290 }, { x: 0, y: 3000 / 120 }, thin, 7);
    expect(hit).not.toBeNull();
    expect(hit!.ny).toBe(-1);

    // And at an absurd single-step displacement it still reports a contact inside the motion.
    const far = sweptCircleAabb({ x: 200, y: -5000 }, { x: 0, y: 10000 }, thin, 7);
    expect(far).not.toBeNull();
    expect(far!.t).toBeGreaterThan(0);
    expect(far!.t).toBeLessThan(1);
  });

  it("reports immediate contact when the circle starts overlapping", () => {
    const hit = sweptCircleAabb({ x: 130, y: 105 }, { x: 0, y: 5 }, box, 5);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBe(0);
    expect(hit!.ny).toBe(-1);
  });

  it("returns null for zero velocity outside the box", () => {
    expect(sweptCircleAabb({ x: 10, y: 10 }, { x: 0, y: 0 }, box, 5)).toBeNull();
  });

  it("treats an exact tangent as a contact at t<=1", () => {
    // Travels along y = 95, exactly r above the top face.
    const hit = sweptCircleAabb({ x: 60, y: 95 }, { x: 100, y: 0 }, box, 5);
    expect(hit).not.toBeNull();
    expect(hit!.t).toBeLessThanOrEqual(1);
  });

  it("prefers the face over the corner when both are reachable at the same time", () => {
    const hit = sweptCircleAabb({ x: 100, y: 60 }, { x: 0, y: 50 }, box, 5);
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe("face");
  });
});
