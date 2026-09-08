import type { Viewport } from "./Viewport";

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
    this.pointerX = this.viewport.toDesignX(e.clientX);
    this.pointerY = this.viewport.toDesignY(e.clientY);
    this.pointerActive = true;
    if (e.pointerType === "touch" || e.pointerType === "pen") this.touchMode = true;
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
    window.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("contextmenu", this.onContextMenu);
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
  }

  dispose(): void {
    const c = this.viewport.canvas;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    c.removeEventListener("pointermove", this.onPointerMove);
    c.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onWindowPointerMove);
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
