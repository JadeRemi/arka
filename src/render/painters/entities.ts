import type { Ball } from "../../game/Ball";
import { TRAIL_LENGTH } from "../../game/Ball";
import type { Paddle } from "../../game/Paddle";
import { setDitherFill } from "../dither";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../palette";
import { pathChamferRect, pathRoundRect } from "../shapes";

export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, time: number): void {
  const { pos, radius } = ball;

  drawTrail(ctx, ball);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Outer bloom, cheap: two flat discs rather than a real blur.
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = NEON[0];
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Core, dithered so it does not read as a flat vector circle.
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.clip();
  setDitherFill(ctx, NEON[0], BONE[2], 0.72);
  ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
  setDitherFill(ctx, NEON[1], BONE[2], 0.25);
  ctx.fillRect(pos.x - radius, pos.y + radius * 0.15, radius * 2, radius);
  ctx.restore();

  // Spin indicator: a short arc that rotates with the accumulated spin.
  if (Math.abs(ball.spin) > 0.4) {
    ctx.save();
    ctx.strokeStyle = withAlpha(BONE[2], Math.min(0.85, Math.abs(ball.spin) / 8));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const phase = time * ball.spin * 1.6;
    ctx.arc(pos.x, pos.y, radius * 0.55, phase, phase + 1.9);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = BONE[2];
  ctx.beginPath();
  ctx.arc(pos.x - radius * 0.28, pos.y - radius * 0.32, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrail(ctx: CanvasRenderingContext2D, ball: Ball): void {
  if (ball.trailFilled < 3) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = ball.trailFilled;
  for (let k = 0; k < n; k++) {
    const idx = (ball.trailHead - 1 - k + TRAIL_LENGTH * 2) % TRAIL_LENGTH;
    const age = k / n;
    const x = ball.trail[idx * 2] as number;
    const y = ball.trail[idx * 2 + 1] as number;
    ctx.globalAlpha = (1 - age) * 0.24;
    setDitherFill(ctx, NEON[1], NEON[0], 1 - age);
    const r = ball.radius * (1 - age) * 0.95;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle, time: number): void {
  const b = paddle.bounds;
  const squash = paddle.recoil * 0.3;
  const h = b.h * (1 - squash * 0.35);
  const w = b.w * (1 + squash * 0.06);
  const x = paddle.x - w * 0.5;
  const y = b.y + (b.h - h) * 0.5;

  ctx.save();

  // Under-glow, so the paddle reads as powered rather than pasted on.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.16 + paddle.charge * 0.2;
  ctx.fillStyle = NEON[1];
  pathRoundRect(ctx, x - 10, y - 8, w + 20, h + 22, 12);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // Body.
  pathRoundRect(ctx, x, y, w, h, h * 0.46);
  ctx.save();
  ctx.clip();
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    setDitherFill(ctx, NEON[2], BONE[1], 0.85 - t * 0.75);
    ctx.fillRect(x, y + (h * i) / bands, w, h / bands + 1);
  }
  // End caps in a hotter tint, which makes the steering zones legible.
  const capW = w * 0.16;
  setDitherFill(ctx, NEON[0], EMBER[2], 0.35);
  ctx.fillRect(x, y, capW, h);
  ctx.fillRect(x + w - capW, y, capW, h);

  // Centre notch.
  ctx.fillStyle = withAlpha(VOID[0], 0.55);
  ctx.fillRect(paddle.x - 1, y + 2, 2, h - 4);
  ctx.restore();

  pathRoundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, h * 0.44);
  ctx.strokeStyle = withAlpha(BONE[2], 0.75);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Charge chevrons while the ball is docked, pointing where it will launch.
  if (paddle.charge > 0.05) {
    ctx.globalAlpha = paddle.charge * (0.45 + 0.35 * Math.sin(time * 7));
    ctx.strokeStyle = BONE[2];
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 2; i++) {
      const oy = y - 8 - i * 6;
      ctx.beginPath();
      ctx.moveTo(paddle.x - 7, oy + 5);
      ctx.lineTo(paddle.x, oy);
      ctx.lineTo(paddle.x + 7, oy + 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The field frame: walls, floor line and corner brackets. Drawn under everything else. */
export function drawField(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  wall: number,
): void {
  ctx.save();

  // Interior tint, so the play area separates from the parallax behind it.
  ctx.globalAlpha = 0.55;
  setDitherFill(ctx, VOID[0], VOID[2], 0.35);
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  // Walls.
  for (const wx of [x - wall, x + w]) {
    pathChamferRect(ctx, wx, y - wall, wall, h + wall, 4);
    ctx.save();
    ctx.clip();
    setDitherFill(ctx, VOID[1], STEEL[1], 0.45);
    ctx.fillRect(wx, y - wall, wall, h + wall);
    ctx.restore();
    ctx.strokeStyle = withAlpha(STEEL[3], 0.7);
    ctx.lineWidth = 1.2;
    pathChamferRect(ctx, wx + 0.6, y - wall + 0.6, wall - 1.2, h + wall - 1.2, 4);
    ctx.stroke();
  }

  // Ceiling.
  pathChamferRect(ctx, x - wall, y - wall, w + wall * 2, wall, 4);
  ctx.save();
  ctx.clip();
  setDitherFill(ctx, VOID[1], STEEL[2], 0.5);
  ctx.fillRect(x - wall, y - wall, w + wall * 2, wall);
  ctx.restore();
  ctx.strokeStyle = withAlpha(STEEL[3], 0.8);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Danger line at the bottom: dashes plus a dithered falloff.
  const dangerY = y + h - 4;
  ctx.globalAlpha = 0.5;
  setDitherFill(ctx, VOID[0], EMBER[0], 0.4);
  ctx.fillRect(x, dangerY, w, 4);
  ctx.globalAlpha = 0.22;
  setDitherFill(ctx, VOID[0], EMBER[0], 0.25);
  ctx.fillRect(x, dangerY - 26, w, 26);
  ctx.globalAlpha = 1;

  ctx.restore();
}
