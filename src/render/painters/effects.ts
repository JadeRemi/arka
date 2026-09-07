import type { DustPool, PopPool, RingPool, SparkPool } from "../../fx/Particles";
import type { ShardPool } from "../../fx/Fracture";
import { drawText } from "../text";
import { setDitherFill } from "../dither";
import { BONE, EMBER, NEON, STEEL, VOID, withAlpha } from "../palette";
import { pathPolygon } from "../shapes";

/** Tint index -> ramp. Keeps colour strings out of the typed-array pools. */
const TINTS: readonly (readonly string[])[] = [STEEL, NEON, BONE, EMBER, NEON];

function tint(i: number, step: number): string {
  const ramp = TINTS[i] ?? NEON;
  return ramp[Math.min(ramp.length - 1, step)] as string;
}

export function drawDust(ctx: CanvasRenderingContext2D, pool: DustPool): void {
  if (pool.count === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < pool.count; i++) {
    const life = (pool.life[i] as number) / (pool.maxLife[i] as number);
    const s = (pool.size[i] as number) * (0.35 + life * 0.9);
    ctx.globalAlpha = life * life * 0.5;
    setDitherFill(ctx, tint(pool.tint[i] as number, 0), tint(pool.tint[i] as number, 3), life);
    ctx.fillRect((pool.x[i] as number) - s * 0.5, (pool.y[i] as number) - s * 0.5, s, s);
  }
  ctx.restore();
}

export function drawSparks(ctx: CanvasRenderingContext2D, pool: SparkPool): void {
  if (pool.count === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < pool.count; i++) {
    const life = (pool.life[i] as number) / (pool.maxLife[i] as number);
    const x = pool.x[i] as number;
    const y = pool.y[i] as number;
    // Streak length follows velocity, so a spark reads as motion rather than a dot.
    const k = 0.026;
    ctx.globalAlpha = life * 0.9;
    ctx.strokeStyle = tint(pool.tint[i] as number, life > 0.6 ? 3 : 2);
    ctx.lineWidth = 1 + life * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (pool.vx[i] as number) * k, y - (pool.vy[i] as number) * k);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawRings(ctx: CanvasRenderingContext2D, pool: RingPool): void {
  if (pool.count === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < pool.count; i++) {
    const life = (pool.life[i] as number) / (pool.maxLife[i] as number);
    const grow = 1 - life;
    const r = (pool.radius[i] as number) * (0.25 + grow * 1.5);
    ctx.globalAlpha = life * life * 0.8;
    ctx.strokeStyle = tint(pool.tint[i] as number, 2);
    ctx.lineWidth = 1 + life * 5;
    ctx.beginPath();
    ctx.arc(pool.x[i] as number, pool.y[i] as number, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const SHARD = new Array<number>(8).fill(0);

export function drawShards(ctx: CanvasRenderingContext2D, pool: ShardPool): void {
  if (pool.count === 0) return;
  ctx.save();
  for (let i = 0; i < pool.count; i++) {
    const life = (pool.life[i] as number) / (pool.maxLife[i] as number);
    const a = pool.angle[i] as number;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const px = pool.x[i] as number;
    const py = pool.y[i] as number;
    const o = i * 8;

    for (let k = 0; k < 4; k++) {
      const lx = pool.poly[o + k * 2] as number;
      const ly = pool.poly[o + k * 2 + 1] as number;
      SHARD[k * 2] = px + lx * c - ly * s;
      SHARD[k * 2 + 1] = py + lx * s + ly * c;
    }

    const glass = (pool.glass[i] as number) === 1;
    ctx.globalAlpha = glass ? life * 0.6 : Math.min(1, life * 1.6);
    pathPolygon(ctx, SHARD);
    // Face brightness swings with the tumble angle, so shards flicker as they spin.
    const facing = 0.5 + 0.5 * Math.cos(a * 2);
    setDitherFill(ctx, tint(pool.tint[i] as number, 0), tint(pool.tint[i] as number, 3), facing);
    ctx.fill();
    ctx.strokeStyle = withAlpha(glass ? BONE[2] : VOID[0], glass ? 0.7 : 0.5);
    ctx.lineWidth = glass ? 1 : 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPops(ctx: CanvasRenderingContext2D, pool: PopPool): void {
  for (let i = 0; i < pool.count; i++) {
    const p = pool.items[i];
    if (!p) continue;
    const life = p.life / p.maxLife;
    drawText(ctx, `+${p.value}`, p.x, p.y, {
      size: p.hot ? 15 : 12,
      color: p.hot ? EMBER[2] : BONE[1],
      weight: p.hot ? "heavy" : "regular",
      align: "center",
      alpha: Math.min(1, life * 1.8),
      glow: p.hot ? { color: EMBER[1], width: 0.14, alpha: 0.6 } : undefined,
    });
  }
}
