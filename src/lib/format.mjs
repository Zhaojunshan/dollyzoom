const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value, currency) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = money.format(value);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatSignedMoney(value, currency) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  const body = formatMoney(Math.abs(value), currency);
  if (value > 0) return `+${body}`;
  if (value < 0) return `−${body}`;
  return body;
}

export function signedWord(value) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "Unknown";
  if (value > 0) return "Gain";
  if (value < 0) return "Loss";
  return "Flat";
}

export function formatPrice(value) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

export function formatLots(value) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

export function formatPercent(rate) {
  if (rate == null || typeof rate !== "number" || !Number.isFinite(rate)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(rate);
}

export function formatPlainPercent(rate) {
  if (rate == null || typeof rate !== "number" || !Number.isFinite(rate)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate);
}

export function formatTime(iso, timeZone) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (!timeZone) return `${iso} (time zone unknown)`;
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return `${formatted} ${timeZone}`;
  } catch {
    return `${iso} (invalid time zone)`;
  }
}

export function formatAge(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs)) return "time unknown";
  const abs = Math.abs(ageMs);
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (abs < hour) return "less than 1 hour";
  if (abs < day) {
    const hours = Math.floor(abs / hour);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(abs / day);
  return `${days} day${days === 1 ? "" : "s"}`;
}
