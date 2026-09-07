import type { Brick } from "../../game/Brick";
import { BrickKind } from "../../game/kinds";
import { kindRamp } from "../../game/kinds";
import { hash21 } from "../../math/scalar";
import { setDitherFill } from "../dither";
import { BONE, EMBER, NEON, STEEL, VOID, shade, withAlpha } from "../palette";
import { pathChamferRect } from "../shapes";

const CACHE_LIMIT = 128;

interface Baked {
  canvas: HTMLCanvasElement;
}

/**
 * Brick appearance is baked to a small offscreen canvas keyed by (kind, hp, row, size). There
 * are only a few dozen distinct combinations in play, so after the first frame of a level
 * every brick is a single `drawImage` instead of a dozen procedural draw calls.
 */
const cache = new Map<string, Baked>();
const PAD = 6;

function bake(brick: Brick): HTMLCanvasElement {
  const w = Math.ceil(brick.bounds.w);
  const h = Math.ceil(brick.bounds.h);
  const key = `${brick.kind}|${brick.hp}|${brick.row % 9}|${w}x${h}|${brick.mirrorFlip ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.canvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w + PAD * 2;
  canvas.height = h + PAD * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("bricks: 2D context unavailable");
  ctx.translate(PAD, PAD);
  paintFace(ctx, brick, w, h);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { canvas });
  return canvas;
}

function paintFace(ctx: CanvasRenderingContext2D, brick: Brick, w: number, h: number): void {
  const ramp = kindRamp(brick.kind, brick.row);
  const chamfer = 4;

  switch (brick.kind) {
    case BrickKind.Steel:
      paintPlate(ctx, w, h, chamfer, STEEL, 0.15, 0.85);
      paintSpecularSweep(ctx, w, h, chamfer);
      paintRivets(ctx, w, h, BONE[0], 0.5);
      break;

    case BrickKind.Reinforced:
      paintPlate(ctx, w, h, chamfer, STEEL, 0.3, 0.95);
      paintRivets(ctx, w, h, STEEL[3], 0.8);
      paintCracks(ctx, w, h, brick.wear, brick.col * 31 + brick.row * 7);
      break;

    case BrickKind.Explosive:
      paintPlate(ctx, w, h, chamfer, EMBER, 0.1, 0.75);
      paintCore(ctx, w, h);
      break;

    case BrickKind.Glass:
      paintGlass(ctx, w, h, chamfer);
      break;

    case BrickKind.Regenerating:
      paintPlate(ctx, w, h, chamfer, NEON, 0.15, 0.7);
      paintScanlines(ctx, w, h);
      break;

    case BrickKind.Mirror:
      paintMirror(ctx, w, h, chamfer, brick.mirrorFlip);
      break;

    case BrickKind.Standard:
      paintPlate(ctx, w, h, chamfer, ramp, 0.15, 0.8);
      break;
  }

  // Shared bevel: a lit top-left edge and a dark bottom-right one. Two strokes, and the whole
  // wall stops looking flat.
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(chamfer, 0.75);
  ctx.lineTo(w - chamfer, 0.75);
  ctx.moveTo(0.75, chamfer);
  ctx.lineTo(0.75, h - chamfer);
  ctx.strokeStyle = withAlpha(BONE[1], brick.kind === BrickKind.Glass ? 0.5 : 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(chamfer, h - 0.75);
  ctx.lineTo(w - chamfer, h - 0.75);
  ctx.moveTo(w - 0.75, chamfer);
  ctx.lineTo(w - 0.75, h - chamfer);
  ctx.strokeStyle = withAlpha(VOID[0], 0.6);
  ctx.stroke();
  ctx.restore();
}

function paintPlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chamfer: number,
  ramp: readonly string[],
  from: number,
  to: number,
): void {
  pathChamferRect(ctx, 0, 0, w, h, chamfer);
  ctx.save();
  ctx.clip();
  const bands = 7;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    setDitherFill(ctx, shade(ramp, 0), shade(ramp, ramp.length - 1), from + (to - from) * (1 - t));
    ctx.fillRect(0, (h * i) / bands, w, h / bands + 1);
  }
  ctx.restore();
}

function paintRivets(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  alpha: number,
): void {
  ctx.save();
  ctx.fillStyle = withAlpha(color, alpha);
  const r = 1.4;
  for (const x of [5, w - 5]) {
    for (const y of [5, h - 5]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintSpecularSweep(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chamfer: number,
): void {
  pathChamferRect(ctx, 0, 0, w, h, chamfer);
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.5;
  setDitherFill(ctx, VOID[0], BONE[1], 0.55);
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h);
  ctx.lineTo(w * 0.34, 0);
  ctx.lineTo(w * 0.48, 0);
  ctx.lineTo(w * 0.24, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintCracks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  wear: number,
  salt: number,
): void {
  if (wear <= 0) return;
  ctx.save();
  ctx.strokeStyle = withAlpha(VOID[0], 0.85);
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  const branches = Math.round(2 + wear * 4);
  for (let i = 0; i < branches; i++) {
    let x = w * hash21(salt, i * 3);
    let y = h * hash21(salt, i * 3 + 1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.round(wear * 3);
    for (let s = 0; s < segments; s++) {
      x += (hash21(salt + s, i * 7) - 0.5) * w * 0.4;
      y += (hash21(salt + s, i * 11) - 0.5) * h * 0.7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintCore(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const r = Math.min(w, h) * 0.3;
  setDitherFill(ctx, EMBER[3], EMBER[0], 0.7);
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = withAlpha(EMBER[3], 0.8);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, r + 2.5, 0, Math.PI * 2);
  ctx.stroke();
}

function paintGlass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chamfer: number,
): void {
  pathChamferRect(ctx, 0, 0, w, h, chamfer);
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.34;
  setDitherFill(ctx, VOID[2], NEON[1], 0.5);
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.5;
  // Refraction streaks: diagonal slivers at a shallow angle.
  setDitherFill(ctx, NEON[0], BONE[2], 0.4);
  for (let i = -h; i < w; i += 9) {
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.lineTo(i + h * 0.5, 0);
    ctx.lineTo(i + h * 0.5 + 2.2, 0);
    ctx.lineTo(i + 2.2, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  pathChamferRect(ctx, 0.9, 0.9, w - 1.8, h - 1.8, chamfer);
  ctx.strokeStyle = withAlpha(NEON[0], 0.9);
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function paintScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = VOID[0];
  for (let y = 1; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

function paintMirror(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  chamfer: number,
  flip: boolean,
): void {
  paintPlate(ctx, w, h, chamfer, STEEL, 0.05, 0.55);
  pathChamferRect(ctx, 0, 0, w, h, chamfer);
  ctx.save();
  ctx.clip();
  // The diagonal wedge, drawn light so the reflecting face is unmistakable.
  setDitherFill(ctx, STEEL[3], BONE[2], 0.55);
  ctx.beginPath();
  if (flip) {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
  } else {
    ctx.moveTo(w, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(BONE[2], 0.9);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (flip) {
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
  } else {
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawBrick(ctx: CanvasRenderingContext2D, brick: Brick, time: number): void {
  const b = brick.bounds;

  if (!brick.alive) {
    if (brick.rebuildIn > 0 && brick.rebuildsLeft >= 0) drawGhost(ctx, brick);
    return;
  }

  const canvas = bake(brick);

  // Explosive bricks pulse; a fuse makes them pulse fast, which is the only warning the
  // player gets before a chain reaches them.
  let glow = 0;
  if (brick.kind === BrickKind.Explosive) {
    glow = 0.35 + 0.35 * Math.sin(time * (brick.fuse > 0 ? 34 : 3.4) + brick.col);
  }

  const squash = brick.flash * 0.16;
  ctx.save();
  if (squash > 0.001) {
    ctx.translate(b.x + b.w * 0.5, b.y + b.h * 0.5);
    ctx.scale(1 + squash, 1 - squash * 0.6);
    ctx.translate(-(b.x + b.w * 0.5), -(b.y + b.h * 0.5));
  }
  ctx.drawImage(canvas, Math.round(b.x) - PAD, Math.round(b.y) - PAD);

  if (glow > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glow * 0.5;
    ctx.fillStyle = EMBER[1];
    pathChamferRect(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
  }

  if (brick.flash > 0.02) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = brick.flash * 0.75;
    ctx.fillStyle = BONE[2];
    pathChamferRect(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
  }
  ctx.restore();
}

/** Wireframe placeholder for a Regenerating brick mid-rebuild, with a scanline wipe. */
function drawGhost(ctx: CanvasRenderingContext2D, brick: Brick): void {
  const b = brick.bounds;
  const spec = brick.spec;
  if (spec.rebuildDelay <= 0) return;
  const progress = 1 - brick.rebuildIn / spec.rebuildDelay;

  ctx.save();
  ctx.globalAlpha = 0.2 + progress * 0.35;
  ctx.strokeStyle = NEON[0];
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  pathChamferRect(ctx, b.x, b.y, b.w, b.h, 4);
  ctx.stroke();
  ctx.setLineDash([]);

  const wipe = b.h * progress;
  ctx.globalAlpha = 0.25;
  setDitherFill(ctx, VOID[1], NEON[0], progress);
  ctx.fillRect(b.x, b.y + b.h - wipe, b.w, wipe);
  ctx.restore();
}

export function clearBrickCache(): void {
  cache.clear();
}
