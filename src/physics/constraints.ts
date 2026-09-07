import type { Vec2 } from "../math/vec2";
import { clamp } from "../math/scalar";

/**
 * Guards against the two ways an arkanoid ball goes degenerate: it grinds along a wall
 * because its vertical component collapsed, or it drifts to a speed the level was not tuned
 * for. Both are unfixable once they happen, so they are prevented every step.
 */

/** Minimum |vy| as a fraction of total speed. Below this the ball can never come back down. */
export const MIN_VERTICAL_RATIO = 0.22;
/** Minimum |vx| as a fraction of total speed, so a perfectly vertical rally cannot lock in. */
export const MIN_HORIZONTAL_RATIO = 0.06;

export function clampSpeed(v: Vec2, min: number, max: number): void {
  const s = Math.hypot(v.x, v.y);
  if (s < 1e-6) {
    v.x = 0;
    v.y = -min;
    return;
  }
  const target = clamp(s, min, max);
  if (target !== s) {
    const k = target / s;
    v.x *= k;
    v.y *= k;
  }
}

/**
 * Rotates the velocity away from horizontal (and away from perfectly vertical) while keeping
 * its magnitude, so no energy is added or removed. Fully deterministic: an exactly-zero
 * component resolves to +1, never to a random sign, so replaying a seed replays the rally.
 */
export function enforceAngle(v: Vec2): void {
  const s = Math.hypot(v.x, v.y);
  if (s < 1e-6) return;

  let ny = v.y / s;
  let nx = v.x / s;

  if (Math.abs(ny) < MIN_VERTICAL_RATIO) {
    const sy = ny === 0 ? 1 : Math.sign(ny);
    ny = MIN_VERTICAL_RATIO * sy;
    nx = Math.sign(nx || 1) * Math.sqrt(Math.max(0, 1 - ny * ny));
  } else if (Math.abs(nx) < MIN_HORIZONTAL_RATIO) {
    const sx = nx === 0 ? 1 : Math.sign(nx);
    nx = MIN_HORIZONTAL_RATIO * sx;
    ny = Math.sign(ny) * Math.sqrt(Math.max(0, 1 - nx * nx));
  } else {
    return;
  }

  v.x = nx * s;
  v.y = ny * s;
}
