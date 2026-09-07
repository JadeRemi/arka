import { DESIGN_H, DESIGN_W } from "../../core/Viewport";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { setDitherFill } from "../../render/dither";
import { drawText, measureText } from "../../render/text";
import { Button } from "../widgets/Button";
import type { WidgetTree } from "../Widget";

export interface TitleActions {
  onStart(): void;
  onOptions(): void;
}

export function buildTitle(tree: WidgetTree, actions: TitleActions): void {
  tree.clear();
  const w = 260;
  const x = DESIGN_W * 0.5 - w * 0.5;

  const start = tree.add(new Button(x, 396, w, 58, "start", "primary"));
  start.onPress = () => actions.onStart();

  const options = tree.add(new Button(x, 470, w, 46, "options", "neutral"));
  options.onPress = () => actions.onOptions();
}

export function drawTitle(ctx: CanvasRenderingContext2D, time: number, best: number): void {
  const cx = DESIGN_W * 0.5;

  // Wordmark: oversized dithered display type with a hard shadow and a scan sweep.
  const size = 132;
  const label = "arka";
  const width = measureText(label, { size, color: BONE[2], tracking: 0.3, weight: "heavy" });

  ctx.save();
  ctx.globalAlpha = 0.35;
  setDitherFill(ctx, VOID[0], NEON[2], 0.5);
  ctx.fillRect(cx - width * 0.5 - 30, 150, width + 60, size + 34);
  ctx.restore();

  drawText(ctx, label, cx, 168, {
    size,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.3,
    shadow: { dx: 0.035, dy: 0.05, color: VOID[0] },
    glow: { color: NEON[1], width: 0.06, alpha: 0.5 },
    dither: { a: NEON[0], b: BONE[2], t: 0.62 + 0.18 * Math.sin(time * 1.4) },
  });

  drawText(ctx, "a canvas arkanoid", cx, 300, {
    size: 17,
    color: STEEL[3],
    align: "center",
    tracking: 0.62,
    weight: "light",
  });

  // Divider.
  ctx.save();
  ctx.globalAlpha = 0.5;
  setDitherFill(ctx, VOID[0], STEEL[2], 0.6);
  ctx.fillRect(cx - 180, 336, 360, 2);
  ctx.restore();

  drawText(ctx, "procedural levels", cx, 356, {
    size: 12,
    color: withAlpha(NEON[0], 0.75),
    align: "center",
    tracking: 0.5,
    weight: "light",
  });

  if (best > 0) {
    drawText(ctx, `best  ${best}`, cx, DESIGN_H - 118, {
      size: 15,
      color: EMBER[2],
      align: "center",
      weight: "heavy",
      tracking: 0.24,
    });
  }

  drawText(ctx, "mouse or arrows to move  ·  space to launch  ·  esc to pause", cx, DESIGN_H - 62, {
    size: 11,
    color: STEEL[2],
    align: "center",
    tracking: 0.3,
    weight: "light",
    alpha: 0.6 + 0.2 * Math.sin(time * 2),
  });
}
