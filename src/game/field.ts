import { DESIGN_H, DESIGN_W } from "../core/Viewport";
import type { Aabb } from "../math/aabb";

/** Play-field geometry. Single source of truth for layout, generation and rendering. */
export const FIELD: Aabb = { x: 96, y: 76, w: DESIGN_W - 192, h: DESIGN_H - 76 - 26 };

export const WALL = 12;
export const HUD_H = 76;

export const GRID_COLS = 13;
export const GRID_ROWS = 16;
/** Bricks occupy the top portion of the grid; the rest is the rally space. */
export const BRICK_TOP = 1;

export const CELL_W = FIELD.w / GRID_COLS;
export const CELL_H = 30;
/** Visual inset so bricks read as separate plates rather than a solid slab. */
export const BRICK_GAP = 3;

export function cellX(col: number): number {
  return FIELD.x + col * CELL_W;
}

export function cellY(row: number): number {
  return FIELD.y + (BRICK_TOP + row) * CELL_H;
}

export function brickWidth(): number {
  return CELL_W - BRICK_GAP;
}

export function brickHeight(): number {
  return CELL_H - BRICK_GAP;
}

export function fieldLeft(): number {
  return FIELD.x;
}

export function fieldRight(): number {
  return FIELD.x + FIELD.w;
}

export function fieldTop(): number {
  return FIELD.y;
}

/** The ball is lost below this line. Deliberately past the field edge, so the fall is visible. */
export function fieldBottom(): number {
  return FIELD.y + FIELD.h + 40;
}

export function paddleY(): number {
  return FIELD.y + FIELD.h - 40;
}
