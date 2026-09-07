import { vec2, type Vec2 } from "../math/vec2";
import { clampSpeed, enforceAngle } from "../physics/constraints";

export const BALL_RADIUS = 7.5;
export const TRAIL_LENGTH = 26;

/** Lateral acceleration per unit of spin. Small: enough to curve a shot, not to steer it. */
const MAGNUS = 26;
const SPIN_DECAY = 0.985;
const MAX_SPIN = 14;

export class Ball {
  readonly pos: Vec2 = vec2();
  readonly vel: Vec2 = vec2();
  /** Position at the start of the current step, for render interpolation. */
  readonly prev: Vec2 = vec2();
  radius = BALL_RADIUS;
  spin = 0;
  docked = true;
  minSpeed = 200;
  maxSpeed = 900;
  /** Ring buffer of past positions for the trail; `trailHead` is the next write index. */
  readonly trail = new Float32Array(TRAIL_LENGTH * 2);
  trailHead = 0;
  trailFilled = 0;

  dock(x: number, y: number): void {
    this.pos.x = x;
    this.pos.y = y;
    this.prev.x = x;
    this.prev.y = y;
    this.vel.x = 0;
    this.vel.y = 0;
    this.spin = 0;
    this.docked = true;
    this.trailHead = 0;
    this.trailFilled = 0;
  }

  launch(speed: number, angle: number): void {
    this.docked = false;
    this.vel.x = Math.sin(angle) * speed;
    this.vel.y = -Math.cos(angle) * speed;
    enforceAngle(this.vel);
  }

  addSpin(amount: number): void {
    this.spin += amount;
    if (this.spin > MAX_SPIN) this.spin = MAX_SPIN;
    else if (this.spin < -MAX_SPIN) this.spin = -MAX_SPIN;
  }

  /** Applies spin curvature and the speed/angle guards. Position is advanced by the sweep. */
  integrate(dt: number): void {
    if (this.docked) return;
    const s = Math.hypot(this.vel.x, this.vel.y);
    if (s > 1e-6 && this.spin !== 0) {
      // Magnus-style force: perpendicular to travel, signed by spin.
      const ax = (-this.vel.y / s) * this.spin * MAGNUS;
      const ay = (this.vel.x / s) * this.spin * MAGNUS;
      this.vel.x += ax * dt;
      this.vel.y += ay * dt;
    }
    this.spin *= SPIN_DECAY;
    if (Math.abs(this.spin) < 0.01) this.spin = 0;
    clampSpeed(this.vel, this.minSpeed, this.maxSpeed);
    enforceAngle(this.vel);
  }

  pushTrail(): void {
    const i = this.trailHead * 2;
    this.trail[i] = this.pos.x;
    this.trail[i + 1] = this.pos.y;
    this.trailHead = (this.trailHead + 1) % TRAIL_LENGTH;
    if (this.trailFilled < TRAIL_LENGTH) this.trailFilled++;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }
}
