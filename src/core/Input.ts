import { INPUT } from "../config/feel";
import { accumulateLocked, movementToDesign } from "./pointer";
import { DESIGN_H, DESIGN_W, type Viewport } from "./Viewport";

export type KeyName = string;

/**
 * Keyboard + pointer, normalized into design space. Edge state (`pressed`/`released`) is
 * latched for exactly one simulation step, so game logic can poll it instead of subscribing
 * to events — which keeps input out of the event-callback order and therefore deterministic.
 */
export class Input {
  pointerX = 0;
  pointerY = 0;
  pointerDown = false;
  pointerPressed = false;
  pointerReleased = false;
  pointerActive = false;
  /**
   * Sticky once a touch or pen is seen. Sticky rather than per-event because the UI layout
   * depends on it, and a layout that flickered between touch and mouse sizing as the player
   * switched hands would be worse than picking one and staying there.
   */
  touchMode = false;
  /** True when the platform reports a coarse pointer, before any input has arrived. */
  readonly coarsePointer: boolean;

  /**
   * Pointer lock state. Without it the cursor can leave the window mid-rally, absolute
   * coordinates stop arriving, and the paddle freezes with no way to recover short of moving
   * the mouse back over the canvas.
   */
  locked = false;
  /** Latched for one step when the lock is lost, so the game can pause rather than freeze. */
  lockLost = false;
  /** Set when a lock request was refused, so the UI can prompt for the click that fixes it. */
  lockFailed = false;
  private wantLock = false;
  private lockBounds = { min: 0, max: DESIGN_W };

  private readonly down = new Set<KeyName>();
  private readonly justDown = new Set<KeyName>();
  private readonly justUp = new Set<KeyName>();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = normalizeKey(e);
    if (BLOCKED_KEYS.has(k)) e.preventDefault();
    this.down.add(k);
    this.justDown.add(k);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const k = normalizeKey(e);
    this.down.delete(k);
    this.justUp.add(k);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") this.touchMode = true;
    this.pointerActive = true;

    if (this.locked) {
      // Locked: the browser reports relative movement only, so integrate it instead.
      const { dpr, scale } = this.viewport;
      this.pointerX = accumulateLocked(
        this.pointerX,
        movementToDesign(e.movementX, dpr, scale, INPUT.mouseSensitivity),
        this.lockBounds.min,
        this.lockBounds.max,
      );
      this.pointerY = accumulateLocked(
        this.pointerY,
        movementToDesign(e.movementY, dpr, scale, INPUT.mouseSensitivity),
        0,
        DESIGN_H,
      );
      return;
    }

    this.pointerX = this.viewport.toDesignX(e.clientX);
    this.pointerY = this.viewport.toDesignY(e.clientY);
  };

  private readonly onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    this.pointerDown = true;
    this.pointerPressed = true;
    this.viewport.canvas.focus();
  };

  private readonly onPointerUp = () => {
    this.pointerDown = false;
    this.pointerReleased = true;
  };

  private readonly onWindowPointerMove = (e: PointerEvent) => {
    if (!this.pointerDown) return;
    this.onPointerMove(e);
  };

  private readonly onContextMenu = (e: Event) => e.preventDefault();

  private readonly onWindowBlur = () => {
    this.down.clear();
    this.pointerDown = false;
  };

  private readonly onLockChange = () => {
    const locked = document.pointerLockElement === this.viewport.canvas;
    if (this.locked && !locked) this.lockLost = true;
    this.locked = locked;
    if (locked) this.lockFailed = false;
  };

  private readonly onLockError = () => {
    this.locked = false;
    // Almost always "no transient user activation": the request came from a keypress-driven
    // state change rather than a click. Recoverable — the next click in the field will take.
    this.lockFailed = true;
  };

  constructor(private readonly viewport: Viewport) {
    const c = viewport.canvas;
    c.tabIndex = 0;
    this.coarsePointer =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false;
    this.touchMode = this.coarsePointer;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
    c.addEventListener("pointermove", this.onPointerMove, { passive: true });
    c.addEventListener("pointerdown", this.onPointerDown);
    // A touch that starts outside the canvas still has to steer the paddle, so dragging is
    // tracked on the window rather than only on the element the touch began on.
    window.addEventListener("pointermove", this.onWindowPointerMove, { passive: true });
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("pointerlockerror", this.onLockError);
    window.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("contextmenu", this.onContextMenu);
  }

  /**
   * Asks for pointer lock, keeping the paddle's legal x-range as the clamp for the virtual
   * cursor. Safe to call every frame: it no-ops once locked or already pending.
   */
  requestLock(min: number, max: number): void {
    this.lockBounds.min = Math.min(min, max);
    this.lockBounds.max = Math.max(min, max);
    if (this.locked || this.wantLock || this.touchMode) return;
    if (typeof this.viewport.canvas.requestPointerLock !== "function") return;

    this.wantLock = true;
    // `unadjustedMovement` bypasses OS mouse acceleration so the paddle tracks the hand
    // exactly. It is not universally supported, so a rejection retries without it.
    void this.tryLock({ unadjustedMovement: true })
      .catch(() => this.tryLock())
      .catch(() => {
        this.lockFailed = true;
      })
      .finally(() => {
        this.wantLock = false;
      });
  }

  /**
   * Normalizes the two shapes of `requestPointerLock`: older browsers return void and signal
   * failure through the `pointerlockerror` event, newer ones return a promise. Both come back
   * as a promise here so the caller has one path.
   */
  private tryLock(options?: { unadjustedMovement: boolean }): Promise<void> {
    try {
      const result: unknown = options
        ? this.viewport.canvas.requestPointerLock(options)
        : this.viewport.canvas.requestPointerLock();
      return result instanceof Promise ? (result as Promise<void>) : Promise.resolve();
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  releaseLock(): void {
    this.wantLock = false;
    this.lockFailed = false;
    if (document.pointerLockElement === this.viewport.canvas) document.exitPointerLock();
  }

  /**
   * Keeps the virtual cursor pinned to where the paddle actually is. Without this the two
   * drift apart whenever the paddle is clamped, and the pointer ends up leading it by the
   * size of the overshoot.
   */
  syncLockedPointer(x: number, min: number, max: number): void {
    this.lockBounds.min = Math.min(min, max);
    this.lockBounds.max = Math.max(min, max);
    if (this.locked) this.pointerX = x;
  }

  isDown(...keys: KeyName[]): boolean {
    for (const k of keys) if (this.down.has(k)) return true;
    return false;
  }

  wasPressed(...keys: KeyName[]): boolean {
    for (const k of keys) if (this.justDown.has(k)) return true;
    return false;
  }

  wasReleased(...keys: KeyName[]): boolean {
    for (const k of keys) if (this.justUp.has(k)) return true;
    return false;
  }

  /** -1, 0 or 1 from the arrow / A-D keys. */
  axisX(): number {
    let a = 0;
    if (this.isDown("ArrowLeft", "a")) a -= 1;
    if (this.isDown("ArrowRight", "d")) a += 1;
    return a;
  }

  /** Clear one-frame edges. Called at the end of every simulation step. */
  endStep(): void {
    this.justDown.clear();
    this.justUp.clear();
    this.pointerPressed = false;
    this.pointerReleased = false;
    this.lockLost = false;
  }

  dispose(): void {
    const c = this.viewport.canvas;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("pointerlockerror", this.onLockError);
    this.releaseLock();
    window.removeEventListener("pointerup", this.onPointerUp);
    c.removeEventListener("contextmenu", this.onContextMenu);
    this.down.clear();
  }
}

const BLOCKED_KEYS = new Set([
  " ",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Tab",
  "F3",
]);

function normalizeKey(e: KeyboardEvent): KeyName {
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}
