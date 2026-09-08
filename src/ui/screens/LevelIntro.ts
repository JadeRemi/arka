import { ARCHETYPE_BLURBS, ARCHETYPE_LABELS } from "../../level/archetypes";
import type { LevelSpec } from "../../level/generate";
import { DESIGN_W } from "../../core/Viewport";
import { FIELD } from "../../game/field";
import { clamp01 } from "../../math/scalar";
import { outCubic, outQuint } from "../../math/easing";
import { setDitherFill } from "../../render/dither";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { strokeCornerBrackets } from "../../render/shapes";
import { drawText, measureText } from "../../render/text";

/**
 * The card shown at the top of every level.
 *
 * A procedurally generated wall gives the player no chance to recognise it, so the card names
 * the archetype before play starts — the difference between "another random wall" and "this is
 * a sentinel, the core is shielded". It is drawn over the live field rather than over a
 * blackout so the layout is already readable behind it.
 *
 * `t` runs 0..1 across the hold: it slides in, sits, then slides out.
 */
export function drawLevelIntro(ctx: CanvasRenderingContext2D, spec: LevelSpec, t: number): void {
  const p = clamp01(t);
  // In over the first 22%, out over the last 22%, holding in between.
  const inT = outQuint(clamp01(p / 0.22));
  const outT = outCubic(clamp01((p - 0.78) / 0.22));
  const alpha = inT * (1 - outT);
  if (alpha <= 0.002) return;

  const label = ARCHETYPE_LABELS[spec.archetype];
  const blurb = ARCHETYPE_BLURBS[spec.archetype];
  // Sits low in the rally space rather than over the wall: the card names the layout, so
  // covering the layout while it does that defeats the point.
  const cy = FIELD.y + FIELD.h * 0.74;
  const cx = DESIGN_W * 0.5;

  // The card slides in from the left and out to the right, so the motion has direction.
  const slide = (1 - inT) * -120 + outT * 120;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(slide, 0);

  const numberText = `level ${spec.level.toString().padStart(2, "0")}`;
  const titleSize = 62;
  const titleW = measureText(label, {
    size: titleSize,
    color: BONE[2],
    weight: "heavy",
    tracking: 0.24,
  });
  const bandW = Math.max(titleW + 120, 460);
  const bandH = 152;
  const bx = cx - bandW * 0.5;
  const by = cy - bandH * 0.5;

  // A dithered plate rather than a solid one, so the field still shows through it.
  ctx.save();
  ctx.globalAlpha = alpha * 0.82;
  setDitherFill(ctx, VOID[0], STEEL[0], 0.34);
  ctx.fillRect(bx, by, bandW, bandH);
  ctx.restore();

  // Edge rules, brightest at the moment the card lands.
  ctx.strokeStyle = withAlpha(NEON[0], 0.35 + inT * 0.45);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bx, by + 0.5);
  ctx.lineTo(bx + bandW, by + 0.5);
  ctx.moveTo(bx, by + bandH - 0.5);
  ctx.lineTo(bx + bandW, by + bandH - 0.5);
  ctx.stroke();
  strokeCornerBrackets(ctx, bx - 8, by - 8, bandW + 16, bandH + 16, 18, withAlpha(STEEL[3], 0.5), 2);

  drawText(ctx, numberText, cx, by + 18, {
    size: 13,
    color: STEEL[3],
    align: "center",
    tracking: 0.62,
    weight: "light",
  });

  drawText(ctx, label, cx, by + 46, {
    size: titleSize,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.24,
    shadow: { dx: 0.02, dy: 0.05, color: VOID[0] },
    // Kept deliberately faint: a stronger glow bled over the two small lines either side of
    // the title and made both of them unreadable.
    glow: { color: NEON[1], width: 0.035, alpha: 0.22 * inT },
  });

  const footer = spec.tuning.setPiece
    ? `${blurb}  ·  set piece  ·  ${spec.destructible} bricks`
    : `${blurb}  ·  ${spec.destructible} bricks`;
  drawText(ctx, footer, cx, by + bandH - 24, {
    size: 12,
    color: spec.tuning.setPiece ? EMBER[2] : STEEL[3],
    align: "center",
    tracking: 0.32,
    weight: "light",
  });

  ctx.restore();
}
