export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const inQuad: Easing = (t) => t * t;
export const outQuad: Easing = (t) => 1 - (1 - t) * (1 - t);
export const inOutQuad: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
export const outCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const inCubic: Easing = (t) => t * t * t;
export const outQuint: Easing = (t) => 1 - (1 - t) ** 5;
export const outExpo: Easing = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const inExpo: Easing = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10));

export const outBack: Easing = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

export const outElastic: Easing = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const p = (2 * Math.PI) / 3;
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * p) + 1;
};

export const outBounce: Easing = (t) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
