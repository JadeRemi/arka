import { describe, expect, it } from "vitest";
import { Effects } from "./Effects";
import { POWERUP_TABLE, POWERUP_LIST, MULTIBALL_SPLIT } from "../config/powerups";

describe("Effects", () => {
  it("starts with nothing running", () => {
    const fx = new Effects();
    expect(fx.paddleScale).toBe(1);
    expect(fx.ballSpeedScale).toBe(1);
    expect(fx.catchBall).toBe(false);
    expect(fx.pierce).toBe(false);
    expect(fx.guardCharges).toBe(0);
  });

  it("applies a timed modifier while it runs and drops it when it expires", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.expand);
    expect(fx.paddleScale).toBeCloseTo(POWERUP_TABLE.expand.paddleScale as number, 9);
    expect(fx.isActive("expand")).toBe(true);

    fx.step(POWERUP_TABLE.expand.duration + 0.01);
    expect(fx.isActive("expand")).toBe(false);
    expect(fx.paddleScale).toBe(1);
  });

  it("refreshes rather than stacks when the same capsule is caught twice", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.expand);
    fx.step(5);
    fx.collect(POWERUP_TABLE.expand);
    expect(fx.timeLeft("expand")).toBeCloseTo(POWERUP_TABLE.expand.duration, 6);
    // Still a single application, not the square of it.
    expect(fx.paddleScale).toBeCloseTo(POWERUP_TABLE.expand.paddleScale as number, 9);
  });

  it("cancels an opposing modifier instead of silently cancelling out", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.expand);
    fx.collect(POWERUP_TABLE.shrink);
    expect(fx.isActive("expand")).toBe(false);
    expect(fx.isActive("shrink")).toBe(true);
    expect(fx.paddleScale).toBeCloseTo(POWERUP_TABLE.shrink.paddleScale as number, 9);

    fx.collect(POWERUP_TABLE.slow);
    fx.collect(POWERUP_TABLE.speed);
    expect(fx.isActive("slow")).toBe(false);
    expect(fx.ballSpeedScale).toBeCloseTo(POWERUP_TABLE.speed.ballSpeedScale as number, 9);
  });

  it("keeps independent modifiers running together", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.expand);
    fx.collect(POWERUP_TABLE.slow);
    expect(fx.paddleScale).toBeGreaterThan(1);
    expect(fx.ballSpeedScale).toBeLessThan(1);
    expect(fx.activeIds([])).toEqual(["expand", "slow"]);
  });

  it("banks one-shot pickups instead of treating them as timed", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.multi);
    fx.collect(POWERUP_TABLE.life);
    fx.collect(POWERUP_TABLE.guard);
    expect(fx.pendingSplits).toBe(MULTIBALL_SPLIT);
    expect(fx.pendingLives).toBe(1);
    expect(fx.guardCharges).toBe(1);
    expect(fx.activeIds([])).toEqual([]);
  });

  it("clears timed effects between levels but keeps banked guards", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.expand);
    fx.collect(POWERUP_TABLE.guard);
    fx.resetTimed();
    expect(fx.isActive("expand")).toBe(false);
    expect(fx.guardCharges).toBe(1);
  });

  it("reports a draining fraction for the HUD", () => {
    const fx = new Effects();
    fx.collect(POWERUP_TABLE.slow);
    expect(fx.fractionLeft("slow")).toBeCloseTo(1, 6);
    fx.step(POWERUP_TABLE.slow.duration * 0.5);
    expect(fx.fractionLeft("slow")).toBeCloseTo(0.5, 5);
  });

  it("exposes every registry entry as a usable spec", () => {
    for (const spec of POWERUP_LIST) {
      expect(spec.glyph.length).toBeGreaterThan(0);
      expect(spec.weight).toBeGreaterThanOrEqual(0);
      // Either it lasts, or it resolves instantly through an action. Never neither.
      expect(spec.duration > 0 || spec.action !== undefined).toBe(true);
    }
  });
});
