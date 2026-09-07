import type { Aabb } from "../math/aabb";
import { BrickKind, KINDS, specFor, type KindSpec } from "./kinds";

export class Brick {
  readonly bounds: Aabb = { x: 0, y: 0, w: 0, h: 0 };
  kind: BrickKind = BrickKind.Standard;
  spec: KindSpec = KINDS[BrickKind.Standard];
  row = 0;
  col = 0;
  hp = 1;
  alive = true;
  /** Seconds until a Regenerating brick returns; 0 when it is not rebuilding. */
  rebuildIn = 0;
  rebuildsLeft = 0;
  /** Decaying 0..1 used for the hit flash and the squash-recoil on the painter. */
  flash = 0;
  /** Mirror bricks face one of the two diagonals; picked at generation time. */
  mirrorFlip = false;
  /** Set while an explosive chain is waiting to reach this brick. */
  fuse = 0;

  init(
    col: number,
    row: number,
    x: number,
    y: number,
    w: number,
    h: number,
    kind: number,
    mirrorFlip: boolean,
  ): void {
    this.col = col;
    this.row = row;
    this.bounds.x = x;
    this.bounds.y = y;
    this.bounds.w = w;
    this.bounds.h = h;
    this.spec = specFor(kind);
    this.kind = kind as BrickKind;
    this.hp = this.spec.hp;
    this.alive = true;
    this.rebuildIn = 0;
    this.rebuildsLeft = this.spec.rebuildLimit;
    this.flash = 0;
    this.mirrorFlip = mirrorFlip;
    this.fuse = 0;
  }

  get indestructible(): boolean {
    return !Number.isFinite(this.spec.hp);
  }

  /**
   * True when this brick still stands between the player and a level clear.
   *
   * A pending rebuild counts, regardless of how many rebuilds remain after it: the last
   * rebuild is already scheduled at the moment `rebuildsLeft` hits zero, and treating that
   * brick as cleared would end the level while it was still on its way back.
   */
  get blocksClear(): boolean {
    if (!this.spec.clearable) return false;
    return this.alive || this.rebuildIn > 0;
  }

  /** Applies one hit. Returns true if the brick was destroyed by it. */
  damage(amount = 1): boolean {
    this.flash = 1;
    if (this.indestructible) return false;
    this.hp -= amount;
    if (this.hp > 0) return false;
    this.alive = false;
    if (this.rebuildsLeft > 0) {
      this.rebuildsLeft--;
      this.rebuildIn = this.spec.rebuildDelay;
    }
    return true;
  }

  /** 0..1 damage progress, drives the crack overlay on Reinforced bricks. */
  get wear(): number {
    if (!Number.isFinite(this.spec.hp) || this.spec.hp <= 1) return 0;
    return 1 - Math.max(0, this.hp - 1) / (this.spec.hp - 1);
  }
}
