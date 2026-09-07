export const MAX_COMBO = 30;
export const LEVEL_CLEAR_BASE = 1000;
export const FLAWLESS_BONUS = 2500;
export const TIME_BONUS_WINDOW = 60;
export const TIME_BONUS_RATE = 25;

export interface LevelBreakdown {
  bricks: number;
  clear: number;
  time: number;
  flawless: number;
  total: number;
}

/**
 * Score exists for the session only — the brief rules out any save system, so there is no
 * persistence layer here by design.
 *
 * The combo multiplier counts bricks broken since the last paddle touch. That is the one rule
 * that rewards long rallies over safe play, so it is the number the HUD makes loudest.
 */
export class Score {
  total = 0;
  combo = 0;
  bestCombo = 0;
  level = 1;
  /** Score earned inside the current level, for the clear breakdown. */
  levelBricks = 0;
  levelSeconds = 0;
  lostLifeThisLevel = false;

  reset(): void {
    this.total = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.level = 1;
    this.levelBricks = 0;
    this.levelSeconds = 0;
    this.lostLifeThisLevel = false;
  }

  beginLevel(level: number): void {
    this.level = level;
    this.combo = 0;
    this.levelBricks = 0;
    this.levelSeconds = 0;
    this.lostLifeThisLevel = false;
  }

  tick(dt: number): void {
    this.levelSeconds += dt;
  }

  get comboMultiplier(): number {
    return 1 + 0.1 * Math.min(this.combo, MAX_COMBO);
  }

  get levelMultiplier(): number {
    return 1 + 0.05 * (this.level - 1);
  }

  /** Registers a broken brick and returns the points it was worth. */
  award(base: number): number {
    if (base <= 0) return 0;
    const points = Math.round(base * this.comboMultiplier * this.levelMultiplier);
    this.total += points;
    this.levelBricks += points;
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    return points;
  }

  /** Called on every paddle contact — this is what makes the combo a risk/reward decision. */
  breakCombo(): void {
    this.combo = 0;
  }

  loseLife(): void {
    this.combo = 0;
    this.lostLifeThisLevel = true;
  }

  finishLevel(): LevelBreakdown {
    const clear = LEVEL_CLEAR_BASE * this.level;
    const time = Math.max(0, Math.ceil(TIME_BONUS_WINDOW - this.levelSeconds)) * TIME_BONUS_RATE;
    const flawless = this.lostLifeThisLevel ? 0 : FLAWLESS_BONUS;
    const bonus = clear + time + flawless;
    this.total += bonus;
    return { bricks: this.levelBricks, clear, time, flawless, total: bonus };
  }
}
