export function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function percentileFromZ(z?: number): number | undefined {
  if (z === undefined || !Number.isFinite(z)) return undefined;
  return normalCdf(z) * 100;
}

export function zFromLms(value: number, l: number, m: number, s: number): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(l) || !Number.isFinite(m) || !Number.isFinite(s)) {
    return Number.NaN;
  }
  if (Math.abs(l) < 1e-7) return Math.log(value / m) / s;
  return (Math.pow(value / m, l) - 1) / (l * s);
}

export function valueFromLms(z: number, l: number, m: number, s: number): number {
  if (Math.abs(l) < 1e-7) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function round(value?: number, digits = 1): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}
