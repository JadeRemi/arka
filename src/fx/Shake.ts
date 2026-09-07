import { hash21 } from "../math/scalar";

const MAX_OFFSET = 7;

/**
 * Screen shake as decaying value noise rather than random jitter: sampling a smooth hash at a
 * moving time coordinate gives a shake that feels like an impulse travelling through the
 * cabinet, where per-frame randomness just looks like static.
 */
export class Shake {
  private amplitude = 0;
  private time = 0;
  offsetX = 0;
  offsetY = 0;
  /** 0..1, drives the chromatic pulse in the post pass. */
  chroma = 0;

  add(amount: number): void {
    this.amplitude = Math.min(1, this.amplitude + amount);
  }

  pulse(amount: number): void {
    this.chroma = Math.min(1, this.chroma + amount);
  }

  step(dt: number): void {
    this.time += dt;
    this.amplitude *= Math.exp(-7.5 * dt);
    this.chroma *= Math.exp(-6 * dt);
    if (this.amplitude < 0.002) {
      this.amplitude = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    const t = this.time * 46;
    const i = Math.floor(t);
    const f = t - i;
    const s = f * f * (3 - 2 * f);
    const ax = lerpNoise(i, 17, s);
    const ay = lerpNoise(i, 91, s);
    const a = this.amplitude * this.amplitude * MAX_OFFSET;
    this.offsetX = ax * a;
    this.offsetY = ay * a;
  }

  reset(): void {
    this.amplitude = 0;
    this.chroma = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}

function lerpNoise(i: number, salt: number, s: number): number {
  const a = hash21(i, salt) * 2 - 1;
  const b = hash21(i + 1, salt) * 2 - 1;
  return a + (b - a) * s;
}
