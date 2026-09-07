const HISTORY = 120;

/** Dev-only frame diagnostics. Fixed-size ring buffer, no allocation while sampling. */
export class Profiler {
  visible = false;
  private readonly frames = new Float32Array(HISTORY);
  private cursor = 0;
  readonly counters = new Map<string, number>();

  sample(frameMs: number): void {
    this.frames[this.cursor] = frameMs;
    this.cursor = (this.cursor + 1) % HISTORY;
  }

  count(key: string, value: number): void {
    this.counters.set(key, value);
  }

  frameAt(i: number): number {
    return this.frames[(this.cursor + i) % HISTORY] ?? 0;
  }

  get length(): number {
    return HISTORY;
  }

  get worst(): number {
    let m = 0;
    for (const f of this.frames) if (f > m) m = f;
    return m;
  }

  get average(): number {
    let s = 0;
    for (const f of this.frames) s += f;
    return s / HISTORY;
  }
}
