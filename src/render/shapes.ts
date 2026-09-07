type Ctx = CanvasRenderingContext2D;

/** Rounded rect as a path. `roundRect` exists but is not on every target we care about. */
export function pathRoundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Rect with the corners cut off at 45 degrees — the house shape for plates and panels. */
export function pathChamferRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
): void {
  const cc = Math.min(c, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + cc, y);
  ctx.lineTo(x + w - cc, y);
  ctx.lineTo(x + w, y + cc);
  ctx.lineTo(x + w, y + h - cc);
  ctx.lineTo(x + w - cc, y + h);
  ctx.lineTo(x + cc, y + h);
  ctx.lineTo(x, y + h - cc);
  ctx.lineTo(x, y + cc);
  ctx.closePath();
}

/** Corner brackets, the retro-panel idiom: four L shapes instead of a full border. */
export function strokeCornerBrackets(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
  width: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
  ctx.restore();
}

export function pathPolygon(ctx: Ctx, points: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0] as number, points[1] as number);
  for (let i = 2; i + 1 < points.length; i += 2) {
    ctx.lineTo(points[i] as number, points[i + 1] as number);
  }
  ctx.closePath();
}
