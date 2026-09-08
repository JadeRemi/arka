import { DESIGN_H, DESIGN_W } from "../../core/Viewport";
import type { LevelBreakdown } from "../../game/Score";
import { clamp01 } from "../../math/scalar";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../../render/palette";
import { drawText } from "../../render/text";
import { drawPanel } from "../widgets/Panel";
import { Button } from "../widgets/Button";
import type { WidgetTree } from "../Widget";

export function dimBackdrop(ctx: CanvasRenderingContext2D, alpha: number): void {
  ctx.save();
  ctx.fillStyle = withAlpha(VOID[0], alpha);
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  ctx.restore();
}

export function buildPause(
  tree: WidgetTree,
  onResume: () => void,
  onRestart: () => void,
  onQuit: () => void,
): void {
  tree.clear();
  const w = 240;
  const x = DESIGN_W * 0.5 - w * 0.5;
  tree.add(new Button(x, 300, w, 50, "resume", "primary")).onPress = onResume;
  tree.add(new Button(x, 364, w, 44, "restart", "neutral")).onPress = onRestart;
  tree.add(new Button(x, 420, w, 44, "quit", "danger")).onPress = onQuit;
}

export function drawPause(ctx: CanvasRenderingContext2D): void {
  dimBackdrop(ctx, 0.72);
  drawPanel(ctx, DESIGN_W * 0.5 - 190, 200, 380, 300, "paused");
  drawText(ctx, "paused", DESIGN_W * 0.5, 236, {
    size: 42,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.3,
    glow: { color: NEON[1], width: 0.07, alpha: 0.4 },
  });
}

export function buildLevelClear(tree: WidgetTree, onNext: () => void): void {
  tree.clear();
  tree.add(new Button(DESIGN_W * 0.5 - 120, 496, 240, 52, "next level", "primary")).onPress =
    onNext;
}

/** `reveal` runs 0..1 and staggers the breakdown rows in, one per ~0.18. */
export function drawLevelClear(
  ctx: CanvasRenderingContext2D,
  level: number,
  breakdown: LevelBreakdown,
  total: number,
  reveal: number,
): void {
  dimBackdrop(ctx, 0.76);
  drawPanel(ctx, DESIGN_W * 0.5 - 250, 150, 500, 400, "cleared");

  drawText(ctx, `level ${level}`, DESIGN_W * 0.5, 186, {
    size: 15,
    color: STEEL[3],
    align: "center",
    tracking: 0.5,
    weight: "light",
  });
  drawText(ctx, "cleared", DESIGN_W * 0.5, 214, {
    size: 52,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.24,
    glow: { color: NEON[0], width: 0.07, alpha: 0.5 },
  });

  const rows: [string, number, boolean][] = [
    ["bricks", breakdown.bricks, false],
    ["clear bonus", breakdown.clear, false],
    ["time bonus", breakdown.time, false],
    ["flawless", breakdown.flawless, breakdown.flawless > 0],
  ];

  let y = 306;
  rows.forEach(([label, value, hot], i) => {
    const local = clamp01((reveal - i * 0.18) * 5);
    if (local <= 0) return;
    const x0 = DESIGN_W * 0.5 - 180;
    const x1 = DESIGN_W * 0.5 + 180;
    drawText(ctx, label, x0, y, {
      size: 15,
      color: STEEL[3],
      tracking: 0.22,
      alpha: local,
    });
    drawText(ctx, value.toString(), x1, y, {
      size: 17,
      color: hot ? EMBER[2] : BONE[1],
      weight: hot ? "heavy" : "regular",
      align: "right",
      tracking: 0.12,
      alpha: local,
    });
    y += 32;
  });

  const totalAlpha = clamp01((reveal - 0.78) * 4);
  if (totalAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = totalAlpha * 0.5;
    ctx.fillStyle = withAlpha(STEEL[2], 0.7);
    ctx.fillRect(DESIGN_W * 0.5 - 180, y + 2, 360, 1);
    ctx.restore();
    drawText(ctx, "total", DESIGN_W * 0.5 - 180, y + 18, {
      size: 15,
      color: STEEL[3],
      tracking: 0.3,
      alpha: totalAlpha,
    });
    drawText(ctx, total.toString(), DESIGN_W * 0.5 + 180, y + 14, {
      size: 24,
      color: BONE[2],
      weight: "heavy",
      align: "right",
      tracking: 0.12,
      alpha: totalAlpha,
      glow: { color: NEON[1], width: 0.06, alpha: 0.4 * totalAlpha },
    });
  }
}

export function buildGameOver(tree: WidgetTree, onRetry: () => void, onTitle: () => void): void {
  tree.clear();
  const w = 240;
  const x = DESIGN_W * 0.5 - w * 0.5;
  tree.add(new Button(x, 412, w, 52, "try again", "primary")).onPress = onRetry;
  tree.add(new Button(x, 478, w, 44, "title", "neutral")).onPress = onTitle;
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  total: number,
  level: number,
  bestCombo: number,
  isBest: boolean,
  time: number,
): void {
  dimBackdrop(ctx, 0.82);
  drawPanel(ctx, DESIGN_W * 0.5 - 230, 156, 460, 400, "run over");

  drawText(ctx, "game over", DESIGN_W * 0.5, 196, {
    size: 54,
    color: BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.2,
    shadow: { dx: 0.02, dy: 0.04, color: VOID[0] },
    glow: { color: EMBER[0], width: 0.07, alpha: 0.45 },
  });

  drawText(ctx, "final score", DESIGN_W * 0.5, 276, {
    size: 12,
    color: STEEL[3],
    align: "center",
    tracking: 0.5,
    weight: "light",
  });
  drawText(ctx, total.toString(), DESIGN_W * 0.5, 296, {
    size: 46,
    color: isBest ? EMBER[2] : BONE[2],
    weight: "heavy",
    align: "center",
    tracking: 0.12,
    glow: isBest
      ? { color: EMBER[1], width: 0.1, alpha: 0.5 + 0.3 * Math.sin(time * 5) }
      : { color: NEON[1], width: 0.05, alpha: 0.3 },
  });

  if (isBest) {
    drawText(ctx, "session best", DESIGN_W * 0.5, 354, {
      size: 12,
      color: EMBER[2],
      align: "center",
      tracking: 0.44,
      weight: "heavy",
      alpha: 0.6 + 0.35 * Math.sin(time * 6),
    });
  }

  drawText(ctx, `reached level ${level}   ·   best chain ${bestCombo}`, DESIGN_W * 0.5, 380, {
    size: 13,
    color: STEEL[3],
    align: "center",
    tracking: 0.24,
    weight: "light",
  });
}

export function drawLaunchPrompt(
  ctx: CanvasRenderingContext2D,
  time: number,
  touch = false,
): void {
  drawText(ctx, touch ? "tap to launch" : "space to launch", DESIGN_W * 0.5, DESIGN_H - 122, {
    size: 14,
    color: BONE[1],
    align: "center",
    tracking: 0.4,
    weight: "light",
    alpha: 0.45 + 0.35 * Math.sin(time * 4),
  });
}

/**
 * Shown when the mouse is not captured. Pointer lock needs a click to engage, so this is the
 * one piece of UI that has to tell the player something before the game can steer reliably.
 */
export function drawLockPrompt(ctx: CanvasRenderingContext2D, time: number): void {
  drawText(ctx, "click to capture the mouse", DESIGN_W * 0.5, DESIGN_H - 96, {
    size: 12,
    color: STEEL[3],
    align: "center",
    tracking: 0.36,
    weight: "light",
    alpha: 0.5 + 0.3 * Math.sin(time * 3),
  });
}

export function drawLifeLost(ctx: CanvasRenderingContext2D, lives: number): void {
  drawText(ctx, lives === 1 ? "last ball" : `${lives} balls left`, DESIGN_W * 0.5, 320, {
    size: 30,
    color: EMBER[1],
    align: "center",
    weight: "heavy",
    tracking: 0.24,
    glow: { color: EMBER[0], width: 0.08, alpha: 0.5 },
  });
}
