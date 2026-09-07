export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function set(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function copy(out: Vec2, a: Vec2): Vec2 {
  out.x = a.x;
  out.y = a.y;
  return out;
}

export function add(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function sub(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  return out;
}

export function scale(out: Vec2, a: Vec2, s: number): Vec2 {
  out.x = a.x * s;
  out.y = a.y * s;
  return out;
}

export function addScaled(out: Vec2, a: Vec2, b: Vec2, s: number): Vec2 {
  out.x = a.x + b.x * s;
  out.y = a.y + b.y * s;
  return out;
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function len(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function lenSq(a: Vec2): number {
  return a.x * a.x + a.y * a.y;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function normalize(out: Vec2, a: Vec2): Vec2 {
  const l = Math.hypot(a.x, a.y);
  if (l === 0) return set(out, 0, 0);
  out.x = a.x / l;
  out.y = a.y / l;
  return out;
}

/** Left-hand perpendicular. */
export function perp(out: Vec2, a: Vec2): Vec2 {
  const x = a.x;
  out.x = -a.y;
  out.y = x;
  return out;
}

/** Mirror `a` about the plane with unit normal `n`, with restitution `e` on the normal axis. */
export function reflect(out: Vec2, a: Vec2, n: Vec2, e = 1): Vec2 {
  const d = (1 + e) * (a.x * n.x + a.y * n.y);
  out.x = a.x - d * n.x;
  out.y = a.y - d * n.y;
  return out;
}

export function rotate(out: Vec2, a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const x = a.x;
  out.x = x * c - a.y * s;
  out.y = x * s + a.y * c;
  return out;
}

export function setLength(out: Vec2, a: Vec2, l: number): Vec2 {
  normalize(out, a);
  out.x *= l;
  out.y *= l;
  return out;
}
