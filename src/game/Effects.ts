import {
  MULTIBALL_SPLIT,
  POWERUP_IDS,
  POWERUP_LIST,
  indexOfPowerUp,
  type PowerUpId,
  type PowerUpSpec,
} from "../config/powerups";

/**
 * Which power-ups are currently running, and what they add up to.
 *
 * Remaining time is a flat array indexed by registry position, so the whole set is one
 * allocation for the life of the run. The derived getters multiply every active modifier
 * together — which is why adding a modifier-based power-up to the registry needs no change
 * here or in the simulation.
 */
export class Effects {
  private readonly remaining = new Float32Array(POWERUP_LIST.length);
  /** One-shot floor saves banked from the guard power-up. */
  guardCharges = 0;
  /** Set for one step when a multiball pickup lands, so the world can split the ball. */
  pendingSplits = 0;
  /** Set for one step when an extra-life pickup lands. */
  pendingLives = 0;

  reset(): void {
    this.remaining.fill(0);
    this.guardCharges = 0;
    this.pendingSplits = 0;
    this.pendingLives = 0;
  }

  /** Timed effects end with the level; banked guards do not. */
  resetTimed(): void {
    this.remaining.fill(0);
    this.pendingSplits = 0;
    this.pendingLives = 0;
  }

  collect(spec: PowerUpSpec): void {
    if (spec.duration > 0) {
      const i = indexOfPowerUp(spec.id);
      if (i >= 0) {
        // Re-collecting refreshes rather than stacking, so a lucky streak cannot make an
        // effect effectively permanent.
        this.remaining[i] = spec.duration;
        this.cancelOpposite(spec);
      }
      return;
    }
    switch (spec.action) {
      case "multiball":
        this.pendingSplits += MULTIBALL_SPLIT;
        break;
      case "life":
        this.pendingLives += 1;
        break;
      case "guard":
        this.guardCharges += 1;
        break;
      case undefined:
        break;
    }
  }

  /**
   * Two modifiers pulling the same value in opposite directions would silently cancel out and
   * leave the player unable to tell which is running, so picking one up clears the other.
   */
  private cancelOpposite(spec: PowerUpSpec): void {
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      const other = POWERUP_LIST[i] as PowerUpSpec;
      if (other.id === spec.id) continue;
      if ((this.remaining[i] as number) <= 0) continue;
      const paddleClash =
        spec.paddleScale !== undefined &&
        other.paddleScale !== undefined &&
        (spec.paddleScale - 1) * (other.paddleScale - 1) < 0;
      const speedClash =
        spec.ballSpeedScale !== undefined &&
        other.ballSpeedScale !== undefined &&
        (spec.ballSpeedScale - 1) * (other.ballSpeedScale - 1) < 0;
      if (paddleClash || speedClash) this.remaining[i] = 0;
    }
  }

  step(dt: number): void {
    for (let i = 0; i < this.remaining.length; i++) {
      const t = this.remaining[i] as number;
      if (t <= 0) continue;
      this.remaining[i] = Math.max(0, t - dt);
    }
  }

  isActive(id: PowerUpId): boolean {
    const i = indexOfPowerUp(id);
    return i >= 0 && (this.remaining[i] as number) > 0;
  }

  timeLeft(id: PowerUpId): number {
    const i = indexOfPowerUp(id);
    return i >= 0 ? (this.remaining[i] as number) : 0;
  }

  /** Remaining time as a 0..1 fraction of the effect's full duration, for the HUD. */
  fractionLeft(id: PowerUpId): number {
    const spec = POWERUP_LIST[indexOfPowerUp(id)];
    if (!spec || spec.duration <= 0) return 0;
    return this.timeLeft(id) / spec.duration;
  }

  get paddleScale(): number {
    let k = 1;
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      if ((this.remaining[i] as number) <= 0) continue;
      k *= (POWERUP_LIST[i] as PowerUpSpec).paddleScale ?? 1;
    }
    return k;
  }

  get ballSpeedScale(): number {
    let k = 1;
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      if ((this.remaining[i] as number) <= 0) continue;
      k *= (POWERUP_LIST[i] as PowerUpSpec).ballSpeedScale ?? 1;
    }
    return k;
  }

  get ballRadiusScale(): number {
    let k = 1;
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      if ((this.remaining[i] as number) <= 0) continue;
      k *= (POWERUP_LIST[i] as PowerUpSpec).ballRadiusScale ?? 1;
    }
    return k;
  }

  get catchBall(): boolean {
    return this.anyFlag("catchBall");
  }

  get pierce(): boolean {
    return this.anyFlag("pierce");
  }

  private anyFlag(key: "catchBall" | "pierce"): boolean {
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      if ((this.remaining[i] as number) <= 0) continue;
      if ((POWERUP_LIST[i] as PowerUpSpec)[key] === true) return true;
    }
    return false;
  }

  /** Active timed effects, newest-agnostic order (registry order), for the HUD. */
  activeIds(out: PowerUpId[]): PowerUpId[] {
    out.length = 0;
    for (let i = 0; i < POWERUP_LIST.length; i++) {
      if ((this.remaining[i] as number) > 0) out.push(POWERUP_IDS[i] as PowerUpId);
    }
    return out;
  }
}
