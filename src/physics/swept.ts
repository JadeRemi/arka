import type { Aabb } from "../math/aabb";
import type { Vec2 } from "../math/vec2";

export type HitKind = "face" | "corner";

export interface Sweep {
  /** Fraction of the motion consumed before contact, in [0, 1]. */
  t: number;
  /** Unit surface normal pointing back toward the ball. */
  nx: number;
  ny: number;
  kind: HitKind;
}

/** Reused so the sweep loop never allocates. Copy the fields you need before the next call. */
const RESULT: Sweep = { t: 1, nx: 0, ny: 0, kind: "face" };

const NEAR_ZERO = 1e-9;

/**
 * Earliest contact of a circle of radius `r` moving from `p` by `d`, against the static box
 * `box`.
 *
 * The moving circle is reduced to a moving *point* by taking the Minkowski expansion of the
 * box by `r`: the box grown by `r` on every side, with the four corners rounded to radius `r`.
 * Testing the motion segment against that shape is exactly equivalent, and is what makes this
 * tunnel-free at any speed.
 *
 *   https://blog.hamaluik.ca/posts/swept-aabb-collision-using-minkowski-difference/
 *   https://emanueleferonato.com/2021/10/21/understanding-physics-continuous-collision-detection-using-swept-aabb-method-and-minkowski-sum/
 *   https://www.gamedev.net/articles/programming/general-and-gameplay-programming/swept-aabb-collision-detection-and-response-r3084/
 *
 * Returns `null` when there is no contact within the motion. Faces are preferred over corners
 * on a tie, which stops a ball travelling along a row of adjacent bricks from being ejected
 * sideways through the seam between two of them.
 */
export function sweptCircleAabb(p: Vec2, d: Vec2, box: Aabb, r: number): Sweep | null {
  const minX = box.x - r;
  const minY = box.y - r;
  const maxX = box.x + box.w + r;
  const maxY = box.y + box.h + r;

  // Already inside the expanded box: contact is immediate, push out along the shallowest axis.
  if (p.x > minX && p.x < maxX && p.y > minY && p.y < maxY) {
    const left = p.x - minX;
    const rightD = maxX - p.x;
    const top = p.y - minY;
    const bottomD = maxY - p.y;
    const m = Math.min(left, rightD, top, bottomD);
    RESULT.t = 0;
    RESULT.kind = "face";
    RESULT.nx = m === left ? -1 : m === rightD ? 1 : 0;
    RESULT.ny = m === top ? -1 : m === bottomD ? 1 : 0;
    if (RESULT.nx !== 0 && RESULT.ny !== 0) RESULT.ny = 0;
    if (RESULT.nx === 0 && RESULT.ny === 0) RESULT.ny = -1;
    return RESULT;
  }

  let bestT = Number.POSITIVE_INFINITY;
  let bestNx = 0;
  let bestNy = 0;
  let bestKind: HitKind = "face";

  // --- Faces: slab entry, valid only where the contact point lies on the flat span. ---
  if (Math.abs(d.x) > NEAR_ZERO) {
    const plane = d.x > 0 ? minX : maxX;
    const t = (plane - p.x) / d.x;
    if (t >= 0 && t <= 1) {
      const y = p.y + d.y * t;
      if (y >= box.y && y <= box.y + box.h && t < bestT) {
        bestT = t;
        bestNx = d.x > 0 ? -1 : 1;
        bestNy = 0;
        bestKind = "face";
      }
    }
  }
  if (Math.abs(d.y) > NEAR_ZERO) {
    const plane = d.y > 0 ? minY : maxY;
    const t = (plane - p.y) / d.y;
    if (t >= 0 && t <= 1) {
      const x = p.x + d.x * t;
      if (x >= box.x && x <= box.x + box.w && t < bestT) {
        bestT = t;
        bestNx = 0;
        bestNy = d.y > 0 ? -1 : 1;
        bestKind = "face";
      }
    }
  }

  if (bestT <= 0) {
    RESULT.t = 0;
    RESULT.nx = bestNx;
    RESULT.ny = bestNy;
    RESULT.kind = bestKind;
    return RESULT;
  }

  // --- Corners: the rounded parts of the expanded box, i.e. circles of radius r. ---
  const cx = [box.x, box.x + box.w, box.x, box.x + box.w];
  const cy = [box.y, box.y, box.y + box.h, box.y + box.h];
  for (let i = 0; i < 4; i++) {
    const t = segmentCircle(p.x, p.y, d.x, d.y, cx[i] as number, cy[i] as number, r);
    if (t !== null && t < bestT) {
      const hx = p.x + d.x * t - (cx[i] as number);
      const hy = p.y + d.y * t - (cy[i] as number);
      const l = Math.hypot(hx, hy);
      if (l > NEAR_ZERO) {
        bestT = t;
        bestNx = hx / l;
        bestNy = hy / l;
        bestKind = "corner";
      }
    }
  }

  if (!Number.isFinite(bestT) || bestT > 1) return null;

  RESULT.t = bestT < 0 ? 0 : bestT;
  RESULT.nx = bestNx;
  RESULT.ny = bestNy;
  RESULT.kind = bestKind;
  return RESULT;
}

/** Smallest t in [0,1] where the ray p + t*d first touches the circle (cx, cy, r). */
function segmentCircle(
  px: number,
  py: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const mx = px - cx;
  const my = py - cy;
  const a = dx * dx + dy * dy;
  if (a < NEAR_ZERO) return null;
  const b = 2 * (mx * dx + my * dy);
  const c = mx * mx + my * my - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t0 = (-b - sq) / (2 * a);
  if (t0 >= 0 && t0 <= 1) return t0;
  const t1 = (-b + sq) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  return null;
}

/** Copy a sweep result, for when it must outlive the next call. */
export function copySweep(out: Sweep, s: Sweep): Sweep {
  out.t = s.t;
  out.nx = s.nx;
  out.ny = s.ny;
  out.kind = s.kind;
  return out;
}
