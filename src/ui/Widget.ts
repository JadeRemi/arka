import type { Aabb } from "../math/aabb";
import { contains } from "../math/aabb";

export type WidgetState = "idle" | "hover" | "active" | "disabled";

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  pressed: boolean;
  released: boolean;
}

/**
 * A minimal retained-mode widget tree. Canvas has no controls of its own, and the brief rules
 * out HTML ones, so hover/active/focus state has to be modelled here — that state is the only
 * thing that makes a drawn rectangle feel like a button.
 */
export abstract class Widget {
  readonly rect: Aabb = { x: 0, y: 0, w: 0, h: 0 };
  enabled = true;
  focusable = true;
  hovered = false;
  held = false;
  /** 0..1 eased hover weight, so states cross-fade instead of snapping. */
  hoverBlend = 0;
  pressBlend = 0;
  onPress: (() => void) | undefined;

  constructor(x: number, y: number, w: number, h: number) {
    this.rect.x = x;
    this.rect.y = y;
    this.rect.w = w;
    this.rect.h = h;
  }

  get state(): WidgetState {
    if (!this.enabled) return "disabled";
    if (this.held) return "active";
    if (this.hovered) return "hover";
    return "idle";
  }

  /** Returns true if this widget consumed the pointer press. */
  update(pointer: PointerState, focused: boolean, dt: number): boolean {
    const inside = this.enabled && contains(this.rect, pointer.x, pointer.y);
    this.hovered = inside || (focused && this.enabled);

    let consumed = false;
    if (inside && pointer.pressed) {
      this.held = true;
      consumed = true;
    }
    if (this.held && pointer.released) {
      this.held = false;
      if (inside) this.fire();
    }
    if (!pointer.down) this.held = false;

    const rate = Math.min(1, dt * 14);
    this.hoverBlend += ((this.hovered ? 1 : 0) - this.hoverBlend) * rate;
    this.pressBlend += ((this.held ? 1 : 0) - this.pressBlend) * Math.min(1, dt * 24);
    return consumed;
  }

  fire(): void {
    if (this.enabled) this.onPress?.();
  }

  abstract draw(ctx: CanvasRenderingContext2D, focused: boolean, time: number): void;
}

/**
 * Owns focus order and pointer dispatch for one screen. Keyboard navigation is not an
 * afterthought here: the brief calls for stylized interactive elements, and an element you
 * cannot reach without a mouse is not finished.
 */
export class WidgetTree {
  readonly widgets: Widget[] = [];
  focusIndex = 0;

  add<T extends Widget>(widget: T): T {
    this.widgets.push(widget);
    return widget;
  }

  clear(): void {
    this.widgets.length = 0;
    this.focusIndex = 0;
  }

  private focusables(): Widget[] {
    return this.widgets.filter((w) => w.focusable && w.enabled);
  }

  moveFocus(delta: number): void {
    const list = this.focusables();
    if (list.length === 0) return;
    this.focusIndex = (this.focusIndex + delta + list.length) % list.length;
  }

  get focused(): Widget | undefined {
    const list = this.focusables();
    if (list.length === 0) return undefined;
    if (this.focusIndex >= list.length) this.focusIndex = 0;
    return list[this.focusIndex];
  }

  activateFocused(): void {
    this.focused?.fire();
  }

  update(pointer: PointerState, dt: number, keyboardFocus: boolean): void {
    const focused = keyboardFocus ? this.focused : undefined;
    // Top-down, so a widget drawn later wins the pointer.
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const w = this.widgets[i] as Widget;
      w.update(pointer, w === focused, dt);
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, keyboardFocus: boolean): void {
    const focused = keyboardFocus ? this.focused : undefined;
    for (const w of this.widgets) w.draw(ctx, w === focused, time);
  }
}
