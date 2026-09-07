/** Simulation rate. Fixed so physics is reproducible and tunnel-free at any display rate. */
export const SIM_HZ = 120;
export const DT = 1 / SIM_HZ;
/** Beyond this many steps in one frame we drop time rather than fall behind forever. */
const MAX_STEPS = 5;

export interface LoopHandlers {
  update(dt: number): void;
  /** `alpha` is the fraction of a step already elapsed, for positional interpolation. */
  draw(alpha: number): void;
}

/**
 * Fixed-timestep accumulator with interpolated rendering (Gaffer On Games, "Fix Your
 * Timestep!"). Pauses on blur and on visibility change, and resumes without a time spike.
 */
export class Loop {
  private handle = 0;
  private last = 0;
  private accumulator = 0;
  private running = false;
  private paused = false;

  /** Smoothed frame time in milliseconds, for the profiler. */
  frameMs = 0;
  steps = 0;

  private readonly tick = (now: number) => {
    this.handle = requestAnimationFrame(this.tick);

    let elapsed = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = 0;
    if (elapsed > 0.25) elapsed = 0.25;

    const t0 = performance.now();
    this.accumulator += elapsed;

    let steps = 0;
    while (this.accumulator >= DT && steps < MAX_STEPS) {
      this.handlers.update(DT);
      this.accumulator -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;
    this.steps = steps;

    this.handlers.draw(this.accumulator / DT);
    this.frameMs += (performance.now() - t0 - this.frameMs) * 0.1;
  };

  private readonly onVisibility = () => {
    if (document.hidden) this.suspend();
    else this.resume();
  };
  private readonly onBlur = () => this.suspend();
  private readonly onFocus = () => this.resume();

  constructor(private readonly handlers: LoopHandlers) {
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    this.accumulator = 0;
    this.handle = requestAnimationFrame(this.tick);
  }

  private suspend(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.handle);
    this.handle = 0;
  }

  private resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.last = performance.now();
    this.accumulator = 0;
    this.handle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.handle !== 0) cancelAnimationFrame(this.handle);
    this.handle = 0;
    this.running = false;
    this.paused = false;
  }

  dispose(): void {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
  }
}
