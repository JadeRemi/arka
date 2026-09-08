/**
 * Pointer-lock maths, kept separate from the DOM so it can be tested.
 *
 * While the pointer is locked the browser stops reporting absolute coordinates and gives
 * relative `movementX`/`movementY` deltas instead. Those are in CSS pixels, so they have to be
 * converted into design space using the same factor `Viewport.toDesignX` applies — otherwise
 * the paddle moves at a different speed locked than unlocked, which feels broken even though
 * it works.
 */

/** CSS-pixel delta to design-space delta. Mirrors `Viewport.toDesign*`. */
export function movementToDesign(
  movement: number,
  dpr: number,
  scale: number,
  sensitivity: number,
): number {
  if (scale <= 0) return 0;
  return (movement * dpr * sensitivity) / scale;
}

/**
 * Accumulates a locked-pointer delta, clamped to a range.
 *
 * The clamp matters more than it looks: without it the virtual pointer drifts arbitrarily far
 * past the edge of the field, and coming back means crossing a dead zone the size of the
 * overshoot — the same "input does nothing" symptom that pointer lock is meant to fix.
 */
export function accumulateLocked(
  current: number,
  delta: number,
  min: number,
  max: number,
): number {
  const next = current + delta;
  if (next < min) return min;
  if (next > max) return max;
  return next;
}
