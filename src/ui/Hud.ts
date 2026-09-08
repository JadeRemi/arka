import { POWERUP_TABLE, type PowerUpId } from "../config/powerups";
import { DESIGN_W } from "../core/Viewport";
import { MAX_COMBO } from "../game/Score";
import type { World } from "../game/World";
import { FIELD } from "../game/field";
import { damp } from "../math/scalar";
import { setDitherFill } from "../render/dither";
import { BONE, EMBER, NEON, STEEL, VOID, shade, withAlpha } from "../render/palette";
import { pathChamferRect } from "../render/shapes";
import { drawText, measureText } from "../render/text";

/**
 * The HUD occupies the 76 px band above the field and has to fit six things without any of
 * them touching, so the layout is explicit rather than incremental: three rows at fixed
 * baselines, and each row owns its horizontal thirds.
 *
 *   row 1  labels          score        level        lives
 *   row 2  values          digits       digits       pips
 *   row 3  status          bricks/balls combo meter  active power-ups
 *
 * The combo multiplier is the loudest element by design: it is the only stat the player can
 * influence mid-rally, so it gets the meter and the colour shift.
 */
const LABEL_Y = 8;
const VALUE_Y = 22;
const VALUE_SIZE = 20;
/** Row 3 has to finish above the field's ceiling wall, which starts at FIELD.y - WALL = 64. */
const ROW3_Y = 49;
const CHIP_H = 14;

export class Hud {
  /** Score is eased toward the real total, so it rolls up like an odometer. */
  private displayScore = 0;
  private comboPulse = 0;
  private lastCombo = 0;
  private readonly activeScratch: PowerUpId[] = [];

  update(world: World, dt: number): void {
    this.displayScore = damp(this.displayScore, world.score.total, 7, dt);
    if (world.score.combo > this.lastCombo) this.comboPulse = 1;
    this.lastCombo = world.score.combo;
    this.comboPulse *= Math.exp(-6 * dt);
  }

  draw(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const left = FIELD.x;
    const right = FIELD.x + FIELD.w;
    const centre = DESIGN_W * 0.5;
    const score = Math.round(this.displayScore);

    label(ctx, "score", left, "left");
    // No glow on the value: it bled over the label above and the status row below.
    drawText(ctx, pad(score, 8), left, VALUE_Y, {
      size: VALUE_SIZE,
      color: BONE[2],
      weight: "heavy",
      tracking: 0.12,
      shadow: { dx: 0.02, dy: 0.07, color: withAlpha(VOID[0], 0.95) },
    });

    label(ctx, "level", centre, "center");
    drawText(ctx, pad(world.level, 2), centre, VALUE_Y, {
      size: VALUE_SIZE,
      color: BONE[2],
      weight: "heavy",
      align: "center",
      tracking: 0.2,
      shadow: { dx: 0.02, dy: 0.07, color: withAlpha(VOID[0], 0.95) },
    });

    label(ctx, "lives", right, "right");
    for (let i = 0; i < Math.min(world.lives, 6); i++) {
      const x = right - 24 - i * 28;
      const y = VALUE_Y + 5;
      pathChamferRect(ctx, x, y, 20, 7, 3);
      ctx.save();
      ctx.clip();
      setDitherFill(ctx, NEON[2], BONE[2], 0.6);
      ctx.fillRect(x, y, 20, 7);
      ctx.restore();
      ctx.strokeStyle = withAlpha(BONE[2], 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (world.lives > 6) {
      drawText(ctx, `+${world.lives - 6}`, right - 24 - 6 * 28 - 8, VALUE_Y + 3, {
        size: 10,
        color: NEON[0],
        align: "right",
        weight: "heavy",
      });
    }

    this.drawStatusLeft(ctx, world);
    this.drawCombo(ctx, world, time);
    this.drawChips(ctx, world, time);
    this.drawGuardLine(ctx, world, time);
  }

  /** Bricks remaining, plus the ball count while a disrupt is running. */
  private drawStatusLeft(ctx: CanvasRenderingContext2D, world: World): void {
    const remaining = world.grid.countBlocking();
    const urgent = remaining <= 3;
    let text = `${remaining} left`;
    if (world.ballCount > 1) text += `  ·  ${world.ballCount} balls`;
    drawText(ctx, text, FIELD.x, ROW3_Y, {
      size: 10,
      color: urgent ? EMBER[2] : BONE[0],
      tracking: 0.24,
      weight: urgent ? "heavy" : "regular",
      alpha: urgent ? 1 : 0.75,
      shadow: { dx: 0, dy: 0.1, color: withAlpha(VOID[0], 0.9) },
    });
  }

  private drawCombo(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const combo = world.score.combo;
    if (combo <= 0) return;
    const t = Math.min(1, combo / MAX_COMBO);
    const w = 150;
    const x = DESIGN_W * 0.5 - w * 0.5;
    const y = ROW3_Y;
    const hot = t > 0.5;

    pathChamferRect(ctx, x, y, w, 8, 3);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = withAlpha(VOID[0], 0.7);
    ctx.fillRect(x, y, w, 8);
    setDitherFill(ctx, NEON[0], hot ? EMBER[2] : NEON[3], 0.3 + t * 0.6);
    ctx.fillRect(x, y, w * t, 8);
    ctx.restore();
    ctx.strokeStyle = withAlpha(BONE[2], 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();

    const scale = 1 + this.comboPulse * 0.3;
    drawText(ctx, `x${world.score.comboMultiplier.toFixed(1)}`, x + w + 10, y - 3, {
      size: 13 * scale,
      color: hot ? EMBER[2] : BONE[1],
      weight: "heavy",
      tracking: 0.1,
      glow: hot
        ? { color: EMBER[1], width: 0.1, alpha: 0.4 + 0.25 * Math.sin(time * 9) }
        : undefined,
    });
    drawText(ctx, `${combo}`, x - 10, y - 3, {
      size: 12,
      color: STEEL[3],
      align: "right",
      tracking: 0.2,
    });
  }

  /**
   * Active power-ups as right-aligned chips that drain with their timers. Knowing an effect
   * is about to end matters as much as knowing it is running, so each one flashes at 25% left.
   */
  private drawChips(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    const ids = world.effects.activeIds(this.activeScratch);
    const guards = world.effects.guardCharges;
    let x = FIELD.x + FIELD.w;

    if (guards > 0) {
      x = chip(ctx, x, `g  guard${guards > 1 ? ` x${guards}` : ""}`, STEEL, 1, false, 1);
    }

    for (const id of ids) {
      const spec = POWERUP_TABLE[id];
      const frac = world.effects.fractionLeft(id);
      const ending = frac < 0.25;
      const blink = ending ? 0.45 + 0.55 * Math.abs(Math.sin(time * 8)) : 1;
      x = chip(ctx, x, `${spec.glyph}  ${spec.name}`, spec.ramp, frac, spec.hazard, blink);
    }
  }

  /** A shield line along the floor, so a banked guard is visible where it will matter. */
  private drawGuardLine(ctx: CanvasRenderingContext2D, world: World, time: number): void {
    if (world.effects.guardCharges <= 0) return;
    const y = FIELD.y + FIELD.h - 2;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.22 + 0.12 * Math.sin(time * 3);
    setDitherFill(ctx, VOID[0], STEEL[3], 0.55);
    ctx.fillRect(FIELD.x, y - 5, FIELD.w, 5);
    ctx.restore();
  }

  reset(): void {
    this.displayScore = 0;
    this.comboPulse = 0;
    this.lastCombo = 0;
  }
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  align: "left" | "center" | "right",
): void {
  drawText(ctx, text, x, LABEL_Y, {
    size: 10,
    color: STEEL[3],
    tracking: 0.42,
    align,
    weight: "light",
  });
}

/** Draws one right-aligned chip ending at `right`; returns the next chip's right edge. */
function chip(
  ctx: CanvasRenderingContext2D,
  right: number,
  text: string,
  ramp: readonly string[],
  frac: number,
  hazard: boolean,
  blink: number,
): number {
  const style = { size: 10, color: BONE[1], tracking: 0.2 } as const;
  const w = measureText(text, style) + 16;
  const x = right - w;

  pathChamferRect(ctx, x, ROW3_Y - 4, w, CHIP_H, 4);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = withAlpha(VOID[0], 0.78);
  ctx.fillRect(x, ROW3_Y - 4, w, CHIP_H);
  setDitherFill(ctx, shade(ramp, 0), shade(ramp, 3), 0.38);
  ctx.fillRect(x, ROW3_Y - 4, w * frac, CHIP_H);
  ctx.restore();
  ctx.strokeStyle = withAlpha(hazard ? EMBER[1] : shade(ramp, 3), 0.55 * blink);
  ctx.lineWidth = 1;
  ctx.stroke();

  drawText(ctx, text, x + 8, ROW3_Y, {
    ...style,
    color: hazard ? EMBER[2] : BONE[1],
    alpha: blink,
  });

  return x - 6;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}
