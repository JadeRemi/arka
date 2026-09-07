import { GLYPHS, GLYPH_ADVANCE, GLYPH_H, KERNING, type Glyph } from "./glyphs";
import { setDitherFill } from "./dither";
import { withAlpha } from "./palette";

export type Align = "left" | "center" | "right";
export type Weight = "light" | "regular" | "heavy";

export interface TextStyle {
  /** Cap height in design pixels. Everything else scales from this. */
  size: number;
  color: string;
  weight?: Weight | undefined;
  align?: Align | undefined;
  /** Extra advance between glyphs, in cap-height units. */
  tracking?: number | undefined;
  /** Forward shear, in cap-height units of x-offset per unit of y. */
  italic?: number | undefined;
  alpha?: number | undefined;
  /** Hard offset shadow, in cap-height units. */
  shadow?: { dx: number; dy: number; color: string } | undefined;
  /** Outer glow pass, drawn beneath the strokes. */
  glow?: { color: string; width: number; alpha: number } | undefined;
  /** Fills the stroke with a dithered two-colour mix instead of a flat colour. */
  dither?: { a: string; b: string; t: number } | undefined;
}

const WEIGHT_WIDTH: Record<Weight, number> = { light: 0.09, regular: 0.15, heavy: 0.24 };

function glyphFor(ch: string): Glyph | undefined {
  return GLYPHS[ch];
}

function kern(prev: string, ch: string): number {
  return KERNING[prev + ch] ?? 0;
}

/** Advance width of `text` in design pixels for the given style. */
export function measureText(text: string, style: TextStyle): number {
  const unit = style.size / GLYPH_H;
  const tracking = (style.tracking ?? 0.12) * style.size;
  const upper = text.toUpperCase();
  let w = 0;
  let prev = "";
  for (const ch of upper) {
    if (prev) w += tracking + kern(prev, ch) * unit;
    w += GLYPH_ADVANCE * unit;
    prev = ch;
  }
  return Math.max(0, w - 0);
}

function tracePath(
  ctx: CanvasRenderingContext2D,
  text: string,
  originX: number,
  capTop: number,
  unit: number,
  tracking: number,
  shear: number,
): void {
  ctx.beginPath();
  let x = originX;
  let prev = "";
  for (const ch of text) {
    if (prev) x += tracking + kern(prev, ch) * unit;
    const glyph = glyphFor(ch);
    if (glyph) {
      for (const stroke of glyph) {
        for (let i = 0; i + 1 < stroke.length; i += 2) {
          const gy = stroke[i + 1] as number;
          const px = x + (stroke[i] as number) * unit + (GLYPH_H - gy) * shear * unit;
          const py = capTop + gy * unit;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
    }
    x += GLYPH_ADVANCE * unit;
    prev = ch;
  }
}

/**
 * Draws `text` with its cap line at `y`. Strokes are round-joined so the chamfered letterforms
 * read as a single continuous ribbon rather than a set of disconnected segments.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): number {
  const upper = text.toUpperCase();
  const unit = style.size / GLYPH_H;
  const tracking = (style.tracking ?? 0.12) * style.size;
  const shear = style.italic ?? 0;
  const width = measureText(upper, style);
  const align = style.align ?? "left";
  const originX = align === "center" ? x - width * 0.5 : align === "right" ? x - width : x;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = style.alpha ?? 1;
  ctx.lineWidth = Math.max(0.85, WEIGHT_WIDTH[style.weight ?? "regular"] * style.size);

  if (style.shadow) {
    tracePath(
      ctx,
      upper,
      originX + style.shadow.dx * style.size,
      y + style.shadow.dy * style.size,
      unit,
      tracking,
      shear,
    );
    ctx.strokeStyle = style.shadow.color;
    ctx.stroke();
  }

  tracePath(ctx, upper, originX, y, unit, tracking, shear);

  if (style.glow) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (style.alpha ?? 1) * style.glow.alpha;
    ctx.lineWidth += style.glow.width * style.size;
    ctx.strokeStyle = style.glow.color;
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = Math.max(0.85, WEIGHT_WIDTH[style.weight ?? "regular"] * style.size);
  }

  if (style.dither) {
    setDitherFill(ctx, style.dither.a, style.dither.b, style.dither.t);
    ctx.strokeStyle = ctx.fillStyle;
  } else {
    ctx.strokeStyle = style.color;
  }
  ctx.stroke();
  ctx.restore();

  return width;
}

/** Convenience wrapper for dim secondary copy. */
export function drawTextDim(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
  dim: number,
): number {
  return drawText(ctx, text, x, y, { ...style, color: withAlpha(style.color, dim) });
}

/** Greedy word wrap. Returns the lines; caller decides leading. */
export function wrapText(text: string, style: TextStyle, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate, style) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
