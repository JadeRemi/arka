import { PADDLE } from "../config/feel";
import { clamp } from "../math/scalar";
import type { Aabb } from "../math/aabb";
import { fieldLeft, fieldRight, paddleY } from "./field";

const DAMPING = 2 * Math.sqrt(PADDLE.stiffness);

/**
 * The paddle is position-driven but simulated, not snapped. That gives it a genuine velocity,
 * which is what lets the player impart sideways momentum and spin to the ball — the whole
 * skill ceiling of the game depends on it.
 *
 * Width is a separate eased channel so the expand and narrow power-ups grow and shrink the
 * plate visibly instead of teleporting it to a new size.
 */
export class Paddle {
  readonly bounds: Aabb = { x: 0, y: paddleY(), w: PADDLE.baseWidth, h: PADDLE.height };
  /** Centre position and velocity along x. */
  x = 0;
  vx = 0;
  targetX = 0;
  /** Width the plate is easing toward; set by the world from the active power-ups. */
  targetWidth: number = PADDLE.baseWidth;
  /** Decaying 0..1 impact recoil, drives the squash on the painter. */
  recoil = 0;
  /** Blend 0..1 toward the "sticky" look while a ball is docked. */
  charge = 0;

  reset(width: number): void {
    this.bounds.w = width;
    this.targetWidth = width;
    this.bounds.h = PADDLE.height;
    this.bounds.y = paddleY();
    this.x = (fieldLeft() + fieldRight()) * 0.5;
    this.targetX = this.x;
    this.vx = 0;
    this.recoil = 0;
    this.charge = 0;
    this.syncBounds();
  }

  get halfWidth(): number {
    return this.bounds.w * 0.5;
  }

  get minX(): number {
    return fieldLeft() + this.halfWidth;
  }

  get maxX(): number {
    return fieldRight() - this.halfWidth;
  }

  setTarget(x: number): void {
    this.targetX = clamp(x, this.minX, this.maxX);
  }

  nudge(axis: number, dt: number): void {
    if (axis !== 0) this.setTarget(this.targetX + axis * PADDLE.keySpeed * dt);
  }

  step(dt: number): void {
    if (Math.abs(this.targetWidth - this.bounds.w) > 0.05) {
      this.bounds.w += (this.targetWidth - this.bounds.w) * Math.min(1, PADDLE.resizeRate * dt);
    } else {
      this.bounds.w = this.targetWidth;
    }

    const a = PADDLE.stiffness * (this.targetX - this.x) - DAMPING * this.vx;
    this.vx += a * dt;
    this.x += this.vx * dt;

    if (this.x < this.minX) {
      this.x = this.minX;
      this.vx = 0;
    } else if (this.x > this.maxX) {
      this.x = this.maxX;
      this.vx = 0;
    }
    this.recoil *= Math.exp(-9 * dt);
    this.syncBounds();
  }

  private syncBounds(): void {
    this.bounds.x = this.x - this.halfWidth;
  }

  /** Normalized hit offset in [-1, 1] for a contact at design-x `px`. */
  offsetAt(px: number): number {
    return clamp((px - this.x) / this.halfWidth, -1, 1);
  }
}
