export interface Aabb {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function aabb(x = 0, y = 0, w = 0, h = 0): Aabb {
  return { x, y, w, h };
}

export function right(b: Aabb): number {
  return b.x + b.w;
}

export function bottom(b: Aabb): number {
  return b.y + b.h;
}

export function centerX(b: Aabb): number {
  return b.x + b.w * 0.5;
}

export function centerY(b: Aabb): number {
  return b.y + b.h * 0.5;
}

export function contains(b: Aabb, px: number, py: number): boolean {
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function expand(out: Aabb, b: Aabb, m: number): Aabb {
  out.x = b.x - m;
  out.y = b.y - m;
  out.w = b.w + m * 2;
  out.h = b.h + m * 2;
  return out;
}

export function inset(out: Aabb, b: Aabb, m: number): Aabb {
  return expand(out, b, -m);
}
