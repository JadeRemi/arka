import { DROPS } from "../config/feel";
import { POWERUP_LIST, powerUpAt, type PowerUpSpec } from "../config/powerups";
import type { Aabb } from "../math/aabb";

const CAP = 24;

/**
 * Falling power-up capsules. A fixed-capacity pool like every other particle system, but with
 * a real hitbox: the paddle collects one on overlap, and anything that reaches the floor is
 * simply lost.
 */
export class DropPool {
  count = 0;
  private cursor = 0;
  readonly x = new Float32Array(CAP);
  readonly y = new Float32Array(CAP);
  readonly vy = new Float32Array(CAP);
  /** Index into the power-up registry. */
  readonly kind = new Int8Array(CAP);
  /** Seconds alive, drives the sway and the hazard pulse. */
  readonly age = new Float32Array(CAP);
  /** Spawn x, so the sway is an offset rather than a drift. */
  readonly originX = new Float32Array(CAP);

  spawn(x: number, y: number, kindIndex: number): void {
    const i = this.count < CAP ? this.count++ : (this.cursor = (this.cursor + 1) % CAP);
    this.x[i] = x;
    this.originX[i] = x;
    this.y[i] = y;
    this.vy[i] = 20;
    this.kind[i] = kindIndex;
    this.age[i] = 0;
  }

  specAt(i: number): PowerUpSpec {
    return powerUpAt(this.kind[i] as number);
  }

  step(dt: number, floorY: number): void {
    for (let i = 0; i < this.count; i++) {
      this.age[i] = (this.age[i] as number) + dt;
      this.vy[i] = Math.min(DROPS.fallSpeed, (this.vy[i] as number) + DROPS.gravity * dt);
      this.y[i] = (this.y[i] as number) + (this.vy[i] as number) * dt;
      // Sway is an offset from the spawn column, so a capsule stays catchable.
      this.x[i] =
        (this.originX[i] as number) +
        Math.sin((this.age[i] as number) * DROPS.swayRate) * DROPS.swayAmplitude;
      if ((this.y[i] as number) > floorY) {
        this.kill(i);
        i--;
      }
    }
  }

  /** Removes and returns the registry index of the first capsule overlapping `box`. */
  collect(box: Aabb): number {
    const halfW = DROPS.width * 0.5;
    const halfH = DROPS.height * 0.5;
    for (let i = 0; i < this.count; i++) {
      const cx = this.x[i] as number;
      const cy = this.y[i] as number;
      if (
        cx + halfW > box.x &&
        cx - halfW < box.x + box.w &&
        cy + halfH > box.y &&
        cy - halfH < box.y + box.h
      ) {
        const kind = this.kind[i] as number;
        this.kill(i);
        return kind;
      }
    }
    return -1;
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last] as number;
    this.originX[i] = this.originX[last] as number;
    this.y[i] = this.y[last] as number;
    this.vy[i] = this.vy[last] as number;
    this.kind[i] = this.kind[last] as number;
    this.age[i] = this.age[last] as number;
  }

  reset(): void {
    this.count = 0;
    this.cursor = 0;
  }
}

export const POWERUP_COUNT = POWERUP_LIST.length;
