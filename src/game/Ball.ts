import { BALL } from "../config/feel";
import { vec2, type Vec2 } from "../math/vec2";
import { clampSpeed, enforceAngle } from "../physics/constraints";

export const BALL_RADIUS = BALL.radius;
export const TRAIL_LENGTH = BALL.trailLength;

export class Ball {
  readonly pos: Vec2 = vec2();
  readonly vel: Vec2 = vec2();
  /** Position at the start of the current step, for render interpolation. */
  readonly prev: Vec2 = vec2();
  radius: number = BALL.radius;
  spin = 0;
  docked = true;
  /** Live speed clamp, recomputed each step from the level's tuning and active power-ups. */
  minSpeed = 200;
  maxSpeed = 900;
  /** Ring buffer of past positions for the trail; `trailHead` is the next write index. */
  readonly trail = new Float32Array(BALL.trailLength * 2);
  trailHead = 0;
  trailFilled = 0;
  /** Cleared when the ball falls out of play, so the world can compact its list. */
  alive = true;
  /** While docked, offset from the paddle centre — a caught ball rides where it landed. */
  dockOffset = 0;

  dock(x: number, y: number, offset = 0): void {
    this.dockOffset = offset;
    this.pos.x = x;
    this.pos.y = y;
    this.prev.x = x;
    this.prev.y = y;
    this.vel.x = 0;
    this.vel.y = 0;
    this.spin = 0;
    this.docked = true;
    this.alive = true;
    this.trailHead = 0;
    this.trailFilled = 0;
  }

  launch(speed: number, angle: number): void {
    this.docked = false;
    this.vel.x = Math.sin(angle) * speed;
    this.vel.y = -Math.cos(angle) * speed;
    enforceAngle(this.vel);
  }

  /** Places this ball mid-flight, used when a multiball pickup splits an existing one. */
  spawnFrom(source: Ball, angleOffset: number): void {
    this.pos.x = source.pos.x;
    this.pos.y = source.pos.y;
    this.prev.x = source.pos.x;
    this.prev.y = source.pos.y;
    this.radius = source.radius;
    this.minSpeed = source.minSpeed;
    this.maxSpeed = source.maxSpeed;
    this.docked = false;
    this.alive = true;
    this.spin = 0;
    this.trailHead = 0;
    this.trailFilled = 0;

    const speed = Math.hypot(source.vel.x, source.vel.y) || source.minSpeed;
    const base = Math.atan2(source.vel.y, source.vel.x);
    const a = base + angleOffset;
    this.vel.x = Math.cos(a) * speed;
    this.vel.y = Math.sin(a) * speed;
    enforceAngle(this.vel);
  }

  addSpin(amount: number): void {
    this.spin += amount;
    if (this.spin > BALL.maxSpin) this.spin = BALL.maxSpin;
    else if (this.spin < -BALL.maxSpin) this.spin = -BALL.maxSpin;
  }

  /**
   * Applies spin curvature, the rally cool-down and the speed/angle guards. Position is
   * advanced by the world's sweep, not here.
   */
  integrate(dt: number, targetSpeed: number): void {
    if (this.docked) return;

    const s = Math.hypot(this.vel.x, this.vel.y);
    if (s > 1e-6 && this.spin !== 0) {
      // Magnus-style force: perpendicular to travel, signed by spin.
      const ax = (-this.vel.y / s) * this.spin * BALL.magnus;
      const ay = (this.vel.x / s) * this.spin * BALL.magnus;
      this.vel.x += ax * dt;
      this.vel.y += ay * dt;
    }

    // Shed the excess a long rally accumulated, so surviving a hot exchange cools it off.
    if (s > targetSpeed) {
      const shed = (s - targetSpeed) * Math.min(1, BALL.rallyRelax * dt);
      const k = (s - shed) / s;
      this.vel.x *= k;
      this.vel.y *= k;
    }

    this.spin *= BALL.spinDecay;
    if (Math.abs(this.spin) < 0.01) this.spin = 0;
    clampSpeed(this.vel, this.minSpeed, this.maxSpeed);
    enforceAngle(this.vel);
  }

  pushTrail(): void {
    const i = this.trailHead * 2;
    this.trail[i] = this.pos.x;
    this.trail[i + 1] = this.pos.y;
    this.trailHead = (this.trailHead + 1) % BALL.trailLength;
    if (this.trailFilled < BALL.trailLength) this.trailFilled++;
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }
}
