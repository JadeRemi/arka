import { DESIGN_W } from "../core/Viewport";
import { MAX_COMBO } from "../game/Score";
import type { World } from "../game/World";
import { damp } from "../math/scalar";
import { setDitherFill } from "../render/dither";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../render/palette";
import { pathChamferRect } from "../render/shapes";
import { drawText } from "../render/text";
import { FIELD } from "../game/field";

/**
 * The HUD's job is to make the combo multiplier the loudest number on screen — it is the only
 * stat the player can actively influence mid-rally, so it gets the meter and the colour shift.
 */
export class Hud {
  /** Score is eased toward the real total, so it rolls up like an odometer. */
  private displayScore = 0;
  private comboPulse = 0;
  private lastCombo = 0;

  update(world: World, dt: number): void {
    this.displayScore = damp(this.displayScore, world.score.total, 7, dt);
    if (world.score.combo > this.lastCombo) this.comboPulse = 1;
    this.lastCombo = world.score.combo;
    this.comboPulse *= Math.exp(-6 * dt);
  }

  draw(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    // The HUD lives in the 76 px band above the field, so the three rows are placed by hand:
    // labels at LABEL_Y, values at VALUE_Y (24 px cap height), the secondary row at SUB_Y.
    // Sizes and offsets here must stay in step or the score digits swallow the row below.
    const score = Math.round(this.displayScore);

    // Score, left.
    drawText(ctx, "score", FIELD.x, LABEL_Y, {
      size: 10,
      color: STEEL[3],
      tracking: 0.42,
      weight: "light",
    });
    drawText(ctx, pad(score, 8), FIELD.x, VALUE_Y, {
      size: 24,
      color: BONE[2],
      weight: "heavy",
      tracking: 0.14,
      shadow: { dx: 0.02, dy: 0.08, color: withAlpha(VOID[0], 0.95) },
    });

    // Level, centre.
    drawText(ctx, "level", DESIGN_W * 0.5, LABEL_Y, {
      size: 10,
      color: STEEL[3],
      tracking: 0.42,
      align: "center",
      weight: "light",
    });
    drawText(ctx, pad(world.level, 2), DESIGN_W * 0.5, VALUE_Y, {
      size: 24,
      color: BONE[2],
      weight: "heavy",
      align: "center",
      tracking: 0.2,
      shadow: { dx: 0, dy: 0.08, color: withAlpha(VOID[0], 0.9) },
    });

    // Lives, right, drawn as little paddle glyphs.
    const right = FIELD.x + FIELD.w;
    drawText(ctx, "lives", right, LABEL_Y, {
      size: 10,
      color: STEEL[3],
      tracking: 0.42,
      align: "right",
      weight: "light",
    });
    for (let i = 0; i < world.lives; i++) {
      const x = right - 26 - i * 30;
      const y = VALUE_Y + 8;
      pathChamferRect(ctx, x, y, 22, 7, 3);
      ctx.save();
      ctx.clip();
      setDitherFill(ctx, NEON[2], BONE[2], 0.6);
      ctx.fillRect(x, y, 22, 7);
      ctx.restore();
      ctx.strokeStyle = withAlpha(BONE[2], 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.drawCombo(ctx, world, time);
    this.drawBrickCount(ctx, world);
  }

  private drawCombo(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const combo = world.score.combo;
    if (combo <= 0) return;
    const t = Math.min(1, combo / MAX_COMBO);
    const w = 190;
    const x = DESIGN_W * 0.5 - w * 0.5;
    const y = SUB_Y + 1;
    const hot = t > 0.5;

    pathChamferRect(ctx, x, y, w, 9, 4);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = withAlpha(VOID[0], 0.7);
    ctx.fillRect(x, y, w, 9);
    setDitherFill(ctx, NEON[0], hot ? EMBER[2] : NEON[3], 0.3 + t * 0.6);
    ctx.fillRect(x, y, w * t, 9);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();

    const scale = 1 + this.comboPulse * 0.35;
    drawText(
      ctx,
      `x${world.score.comboMultiplier.toFixed(1)}`,
      x + w + 14,
      y - 4,
      {
        size: 15 * scale,
        color: hot ? EMBER[2] : BONE[1],
        weight: "heavy",
        tracking: 0.1,
        glow: hot ? { color: EMBER[1], width: 0.12, alpha: 0.5 + 0.3 * Math.sin(time * 9) } : undefined,
      },
    );
    drawText(ctx, `${combo} chain`, x - 14, y - 4, {
      size: 12,
      color: STEEL[3],
      align: "right",
      tracking: 0.2,
    });
  }

  private drawBrickCount(ctx: CanvasRenderingContext2D, world: World): void {
    const left = world.grid.countBlocking();
    drawText(ctx, `${left} left`, FIELD.x, SUB_Y, {
      size: 12,
      color: left <= 3 ? EMBER[2] : STEEL[3],
      tracking: 0.24,
      weight: left <= 3 ? "heavy" : "light",
    });
  }

  reset(): void {
    this.displayScore = 0;
    this.comboPulse = 0;
    this.lastCombo = 0;
  }
}

const LABEL_Y = 11;
const VALUE_Y = 27;
const SUB_Y = 58;

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}
