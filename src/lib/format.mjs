export function formatMoney(value, currency) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  const formatted = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "未知";
  if (value > 0) return "盈利";
  if (value < 0) return "亏损";
  return "持平";
}

export function formatPrice(value) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 8 }).format(value);
}

export function formatLots(value) {
  if (value == null || typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 8 }).format(value);
}

export function formatPercent(rate) {
  if (rate == null || typeof rate !== "number" || !Number.isFinite(rate)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(rate);
}

export function formatPlainPercent(rate) {
  if (rate == null || typeof rate !== "number" || !Number.isFinite(rate)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate);
}

export function formatTime(iso, timeZone) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  if (!timeZone) return `${iso}（时区未知）`;
  try {
    const formatted = new Intl.DateTimeFormat("zh-CN", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
    return `${formatted} ${timeZone}`;
  } catch {
    return `${iso}（时区无效）`;
  }
}

export function formatAge(ageMs) {
  if (ageMs == null || !Number.isFinite(ageMs)) return "时间未知";
  const abs = Math.abs(ageMs);
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (abs < hour) return "不到 1 小时";
  if (abs < day) return `${Math.floor(abs / hour)} 小时`;
  return `${Math.floor(abs / day)} 天`;
}
