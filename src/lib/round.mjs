/** Decimal helpers for money and lot sizes. Avoid treating unknown as zero. */

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
}

export function roundVol(value) {
  return Math.round((value + Number.EPSILON) * 1e8) / 1e8;
}

/** Parse a plain decimal. Rejects blanks, exponents, and partial numbers. */
export function parseUserNumber(raw) {
  if (typeof raw !== "string") return Number.NaN;
  const text = raw.trim().replace(/,/g, "");
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return Number.NaN;
  const value = Number(text);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function isIsoTime(value) {
  if (typeof value !== "string" || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

/** Scaled ratio that stays exact for 8-decimal prices such as 0.01. */
export function decimalRatio(numerator, denominator) {
  const scale = 1e8;
  const top = Math.round(numerator * scale);
  const bottom = Math.round(denominator * scale);
  if (bottom === 0) return Number.NaN;
  return top / bottom;
}
