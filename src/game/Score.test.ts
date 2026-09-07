import { describe, expect, it } from "vitest";
import { FLAWLESS_BONUS, LEVEL_CLEAR_BASE, MAX_COMBO, Score } from "./Score";

describe("Score", () => {
  it("awards base points at combo zero on level one", () => {
    const s = new Score();
    s.beginLevel(1);
    expect(s.award(100)).toBe(100);
    expect(s.total).toBe(100);
  });

  it("scales with the combo", () => {
    const s = new Score();
    s.beginLevel(1);
    s.award(100); // combo 0 -> 1.0x
    expect(s.award(100)).toBe(110); // combo 1 -> 1.1x
    expect(s.award(100)).toBe(120); // combo 2 -> 1.2x
  });

  it("caps the combo multiplier", () => {
    const s = new Score();
    s.beginLevel(1);
    for (let i = 0; i < MAX_COMBO + 20; i++) s.award(100);
    expect(s.comboMultiplier).toBeCloseTo(1 + 0.1 * MAX_COMBO, 9);
  });

  it("scales with the level", () => {
    const s = new Score();
    s.beginLevel(11);
    expect(s.levelMultiplier).toBeCloseTo(1.5, 9);
    expect(s.award(100)).toBe(150);
  });

  it("resets the combo on a paddle touch", () => {
    const s = new Score();
    s.beginLevel(1);
    s.award(100);
    s.award(100);
    expect(s.combo).toBe(2);
    s.breakCombo();
    expect(s.combo).toBe(0);
    expect(s.bestCombo).toBe(2);
  });

  it("scores nothing for an indestructible brick", () => {
    const s = new Score();
    s.beginLevel(1);
    expect(s.award(0)).toBe(0);
    expect(s.combo).toBe(0);
  });

  it("pays the flawless bonus only when no life was lost", () => {
    const a = new Score();
    a.beginLevel(3);
    a.levelSeconds = 999;
    expect(a.finishLevel().flawless).toBe(FLAWLESS_BONUS);

    const b = new Score();
    b.beginLevel(3);
    b.levelSeconds = 999;
    b.loseLife();
    expect(b.finishLevel().flawless).toBe(0);
  });

  it("pays a time bonus that decays to zero", () => {
    const s = new Score();
    s.beginLevel(1);
    s.levelSeconds = 20;
    expect(s.finishLevel().time).toBe(40 * 25);

    const slow = new Score();
    slow.beginLevel(1);
    slow.levelSeconds = 120;
    expect(slow.finishLevel().time).toBe(0);
  });

  it("adds the level clear bonus scaled by level", () => {
    const s = new Score();
    s.beginLevel(4);
    s.levelSeconds = 999;
    const b = s.finishLevel();
    expect(b.clear).toBe(LEVEL_CLEAR_BASE * 4);
    expect(s.total).toBe(b.total);
  });

  it("clears everything on reset", () => {
    const s = new Score();
    s.beginLevel(5);
    s.award(500);
    s.reset();
    expect(s.total).toBe(0);
    expect(s.level).toBe(1);
    expect(s.bestCombo).toBe(0);
  });
});
