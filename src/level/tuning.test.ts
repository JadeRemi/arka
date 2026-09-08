import { describe, expect, it } from "vitest";
import { tuningFor } from "./tuning";
import { BALL, DIFFICULTY, PADDLE } from "../config/feel";

describe("tuningFor", () => {
  it("starts at the configured baseline", () => {
    const t = tuningFor(1);
    expect(t.ballSpeed).toBeCloseTo(BALL.baseSpeed, 6);
    expect(t.paddleWidth).toBeCloseTo(PADDLE.baseWidth, 6);
    expect(t.rows).toBe(DIFFICULTY.minRows);
  });

  it("raises ball speed monotonically but never past the ceiling", () => {
    let prev = 0;
    for (let l = 1; l <= 300; l++) {
      const t = tuningFor(l);
      expect(t.ballSpeed).toBeGreaterThanOrEqual(prev);
      expect(t.ballSpeed).toBeLessThanOrEqual(BALL.speedCeiling);
      prev = t.ballSpeed;
    }
  });

  it("keeps the speed clamp bracketing the target speed", () => {
    for (let l = 1; l <= 60; l++) {
      const t = tuningFor(l);
      expect(t.ballMinSpeed).toBeLessThan(t.ballSpeed);
      expect(t.ballMaxSpeed).toBeGreaterThan(t.ballSpeed);
    }
  });

  it("shrinks the paddle gradually and never below the floor", () => {
    for (let l = 1; l <= 300; l++) {
      const t = tuningFor(l);
      expect(t.paddleWidth).toBeGreaterThanOrEqual(PADDLE.minWidth);
      expect(t.paddleWidth).toBeLessThanOrEqual(PADDLE.baseWidth + PADDLE.setPieceBonus);
    }
  });

  it("does not hit the paddle floor early — the old linear curve bottomed out by level 16", () => {
    expect(tuningFor(16).paddleWidth).toBeGreaterThan(PADDLE.minWidth + 4);
  });

  it("grows rows to the cap and stops", () => {
    expect(tuningFor(1).rows).toBe(DIFFICULTY.minRows);
    expect(tuningFor(400).rows).toBe(DIFFICULTY.maxRows);
    let prev = 0;
    for (let l = 1; l <= 60; l++) {
      const rows = tuningFor(l).rows;
      expect(rows).toBeGreaterThanOrEqual(prev);
      prev = rows;
    }
  });

  it("marks every Nth level a set piece and hands back paddle width", () => {
    const n = DIFFICULTY.setPieceEvery;
    expect(tuningFor(n).setPiece).toBe(true);
    expect(tuningFor(n + 1).setPiece).toBe(false);
    expect(tuningFor(n).paddleWidth).toBeGreaterThan(tuningFor(n + 1).paddleWidth);
  });

  it("ramps the exotic budget from nothing and caps it", () => {
    expect(tuningFor(1).exoticBudget).toBe(0);
    for (let l = 1; l <= 300; l++) {
      expect(tuningFor(l).exoticBudget).toBeLessThanOrEqual(
        DIFFICULTY.exoticMax + DIFFICULTY.exoticSetPieceBonus + 1e-9,
      );
    }
  });

  it("ramps the drop chance and caps it", () => {
    expect(tuningFor(1).dropChance).toBeGreaterThan(0);
    let prev = 0;
    for (let l = 1; l <= 300; l++) {
      const c = tuningFor(l).dropChance;
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c).toBeLessThanOrEqual(0.2);
      prev = c;
    }
  });
});
