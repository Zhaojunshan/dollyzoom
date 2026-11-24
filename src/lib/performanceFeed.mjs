/**
 * Public performance feed.
 * Unknown money stays null. A connected empty history may use a real zero.
 * Equity drawdown is computed only from supplied equity snapshots.
 */

import { isIsoTime, roundMoney } from "./round.mjs";

export const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @typedef {object} ClosedTrade
 * @property {string} id
 * @property {string} symbol
 * @property {"buy" | "sell"} side
 * @property {number} volume
 * @property {string} openTime
 * @property {string} closeTime
 * @property {number} openPrice
 * @property {number} closePrice
 * @property {number} profit
 * @property {number} commission
 * @property {number} swap
 * @property {number} partialCloses
 * @property {string | null} note
 */

/**
 * @typedef {object} PerformanceFeed
 * @property {string} schemaVersion
 * @property {"unconnected" | "manual-static-export" | "demo" | "local-journal"} source
 * @property {string | null} asOf
 * @property {string | null} timezone
 * @property {string | null} currency
 * @property {{ class: string, verified: false, label: string | null }} account
 * @property {{ kind: string, note: string }} freshness
 * @property {number | null} startingBalance
 * @property {string | null} startingBalanceTime
 * @property {{ balance: number | null, equity: number | null, balanceAsOf: string | null, equityAsOf: string | null }} overview
 * @property {{ time: string, equity: number, balance: number | null }[]} equitySnapshots
 * @property {string | null} equitySnapshotsNote
 * @property {{ id: string, time: string, type: "deposit" | "withdrawal", amount: number }[]} cashflows
 * @property {ClosedTrade[]} closedTrades
 * @property {{ code: string, count: number }[]} warnings
 * @property {string[]} limits
 */

/**
 * @typedef {object} ViewTrade
 * @property {string} id
 * @property {string} symbol
 * @property {"buy" | "sell"} side
 * @property {number} volume
 * @property {string} openTime
 * @property {string} closeTime
 * @property {number} openPrice
 * @property {number} closePrice
 * @property {number} profit
 * @property {number} commission
 * @property {number} swap
 * @property {number} partialCloses
 * @property {string | null} note
 * @property {number} net
 */

/**
 * @typedef {object} ViewModel
 * @property {"unconnected" | "ready"} status
 * @property {string} source
 * @property {string} accountClass
 * @property {false} verified
 * @property {string | null} currency
 * @property {string | null} timezone
 * @property {string | null} asOf
 * @property {string | null} label
 * @property {{ kind: string, ageMs: number | null }} freshness
 * @property {string} freshnessNote
 * @property {string | null} equitySnapshotsNote
 * @property {{ code: string, count: number }[]} warnings
 * @property {string[]} limits
 * @property {number | null} tradeCount
 * @property {number | null} wins
 * @property {number | null} losses
 * @property {number | null} flats
 * @property {number | null} winRate
 * @property {number | null} netPnl
 * @property {number | null} grossProfit
 * @property {number | null} fees
 * @property {number | null} cashflowNet
 * @property {number | null} pointBalance
 * @property {number | null} pointEquity
 * @property {number | null} reconstructedBalance
 * @property {number | null} balanceMismatch
 * @property {{ available: boolean, reason: string | null, points: { time: string, value: number }[], maxDrop: number | null, label: string }} balanceSeries
 * @property {{ available: boolean, reason: string | null, points: { time: string, value: number }[], current: number | null, drawdown: number | null, drawdownPeak: number | null, drawdownReason: string | null, label: string }} equitySeries
 * @property {{ available: boolean, reason: string | null, maxDrawdown: number | null, peak: number | null, points: { time: string, value: number }[], label: string }} realizedPnlDrawdown
 * @property {{ available: boolean, reason: string | null, rate: number | null, basis: string, gain: number | null }} dietz
 * @property {ViewTrade[]} trades
 */

const FORBIDDEN_KEYS = new Set([
  "password",
  "login",
  "server",
  "accountnumber",
  "accountid",
  "account_number",
  "investor",
  "investorpassword",
  "session",
  "token",
  "secret",
  "apikey",
  "api_key",
  "positions",
  "openpositions",
  "open_positions",
  "orders",
  "deals",
]);

const SOURCES = new Set(["unconnected", "manual-static-export", "demo", "local-journal"]);
const CLASSES = new Set(["unknown", "demo", "live", "contest"]);
const WARNING_CODES = new Set([
  "still-open",
  "unsupported-inout",
  "volume-mismatch",
  "credit-ignored",
  "missing-position-id",
  "ignored-deal-type",
  "mixed-entry-side",
  "mixed-symbol",
  "bad-deal",
  "bad-time",
  "ignored-zero-balance",
  "verified-flag-ignored",
]);

export function containsForbidden(value) {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (FORBIDDEN_KEYS.has(normalized)) return true;
      stack.push(child);
    }
  }
  return false;
}

function invalid() {
  return { ok: false, error: "invalid" };
}

function finiteOrNull(value) {
  if (value == null) return { ok: true, value: null };
  if (typeof value !== "number" || !Number.isFinite(value)) return { ok: false };
  return { ok: true, value };
}

export function tradeNet(trade) {
  return roundMoney(trade.profit + trade.commission + trade.swap);
}

export function signedCashflow(cashflow) {
  return cashflow.type === "withdrawal" ? -cashflow.amount : cashflow.amount;
}

function parseTrades(list) {
  if (!Array.isArray(list) || list.length > 5000) return null;
  const value = [];
  for (const trade of list) {
    if (!trade || typeof trade !== "object") return null;
    if (typeof trade.id !== "string" || !trade.id || trade.id.length > 40) return null;
    if (typeof trade.symbol !== "string" || !/^[A-Z0-9._]{1,24}$/.test(trade.symbol)) return null;
    if (trade.side !== "buy" && trade.side !== "sell") return null;
    if (typeof trade.volume !== "number" || !Number.isFinite(trade.volume) || trade.volume <= 0) return null;
    if (!isIsoTime(trade.openTime) || !isIsoTime(trade.closeTime)) return null;
    if (Date.parse(trade.closeTime) < Date.parse(trade.openTime)) return null;
    for (const key of ["openPrice", "closePrice", "profit", "commission", "swap"]) {
      if (typeof trade[key] !== "number" || !Number.isFinite(trade[key])) return null;
    }
    if (!Number.isInteger(trade.partialCloses) || trade.partialCloses < 1) return null;
    if (trade.note != null && trade.note !== "aggregated-partial-closes") return null;
    value.push({
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      volume: trade.volume,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      profit: trade.profit,
      commission: trade.commission,
      swap: trade.swap,
      partialCloses: trade.partialCloses,
      note: trade.note ?? null,
    });
  }
  return value;
}

function parseCashflows(list) {
  if (!Array.isArray(list) || list.length > 5000) return null;
  const value = [];
  for (const cashflow of list) {
    if (!cashflow || typeof cashflow !== "object") return null;
    if (typeof cashflow.id !== "string" || !cashflow.id) return null;
    if (!isIsoTime(cashflow.time)) return null;
    if (cashflow.type !== "deposit" && cashflow.type !== "withdrawal") return null;
    if (typeof cashflow.amount !== "number" || !Number.isFinite(cashflow.amount) || cashflow.amount <= 0) {
      return null;
    }
    value.push({
      id: cashflow.id,
      time: cashflow.time,
      type: cashflow.type,
      amount: cashflow.amount,
    });
  }
  return value;
}

function parseSnapshots(list) {
  if (!Array.isArray(list) || list.length > 5000) return null;
  const value = [];
  for (const shot of list) {
    if (!shot || typeof shot !== "object") return null;
    if (!isIsoTime(shot.time)) return null;
    if (typeof shot.equity !== "number" || !Number.isFinite(shot.equity)) return null;
    if (shot.balance != null && (typeof shot.balance !== "number" || !Number.isFinite(shot.balance))) return null;
    value.push({
      time: shot.time,
      equity: shot.equity,
      balance: shot.balance ?? null,
    });
  }
  value.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  return value;
}

function parseWarnings(list) {
  if (!Array.isArray(list)) return null;
  const value = [];
  for (const warning of list) {
    if (!warning || typeof warning !== "object") return null;
    if (!WARNING_CODES.has(warning.code)) return null;
    if (!Number.isInteger(warning.count) || warning.count < 1) return null;
    value.push({ code: warning.code, count: warning.count });
  }
  return value;
}

/**
 * @param {unknown} input
 * @returns {{ ok: false, error: "invalid" | "sensitive" | "local-only" } | { ok: true, feed: PerformanceFeed }}
 */
export function parseFeed(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
  if (containsForbidden(input)) return { ok: false, error: "sensitive" };
  if (input.localOnly === true) return { ok: false, error: "local-only" };
  if (input.schemaVersion !== "1") return invalid();
  if (!SOURCES.has(input.source)) return invalid();

  const account = input.account;
  if (!account || typeof account !== "object" || !CLASSES.has(account.class)) return invalid();
  if (typeof account.verified !== "boolean") return invalid();
  if (account.label != null && (typeof account.label !== "string" || account.label.length > 40)) return invalid();

  if (input.currency != null && !/^[A-Z]{3}$/.test(input.currency)) return invalid();
  if (input.timezone != null && (typeof input.timezone !== "string" || input.timezone.length > 64)) return invalid();
  if (input.asOf != null && !isIsoTime(input.asOf)) return invalid();
  if (!input.freshness || typeof input.freshness.note !== "string" || input.freshness.note.length > 400) return invalid();
  if (!["unconnected", "static-snapshot"].includes(input.freshness.kind)) return invalid();

  const startingBalance = finiteOrNull(input.startingBalance);
  if (!startingBalance.ok) return invalid();
  if (input.startingBalanceTime != null && !isIsoTime(input.startingBalanceTime)) return invalid();
  if (startingBalance.value == null && input.startingBalanceTime != null) return invalid();

  const overview = input.overview;
  if (!overview || typeof overview !== "object") return invalid();
  const pointBalance = finiteOrNull(overview.balance);
  const pointEquity = finiteOrNull(overview.equity);
  if (!pointBalance.ok || !pointEquity.ok) return invalid();
  if (overview.balanceAsOf != null && !isIsoTime(overview.balanceAsOf)) return invalid();
  if (overview.equityAsOf != null && !isIsoTime(overview.equityAsOf)) return invalid();
  if (pointBalance.value != null && overview.balanceAsOf == null) return invalid();
  if (pointEquity.value != null && overview.equityAsOf == null) return invalid();

  const trades = parseTrades(input.closedTrades);
  const cashflows = parseCashflows(input.cashflows);
  const snapshots = parseSnapshots(input.equitySnapshots);
  const warnings = parseWarnings(input.warnings ?? []);
  if (!trades || !cashflows || !snapshots || !warnings) return invalid();

  if (input.source === "unconnected") {
    const empty =
      trades.length === 0 &&
      cashflows.length === 0 &&
      snapshots.length === 0 &&
      startingBalance.value == null &&
      pointBalance.value == null &&
      pointEquity.value == null &&
      input.currency == null &&
      input.asOf == null &&
      account.class === "unknown" &&
      input.freshness.kind === "unconnected";
    if (!empty) return invalid();
  } else if (input.freshness.kind === "unconnected") {
    return invalid();
  }

  const feedWarnings = account.verified ? [{ code: "verified-flag-ignored", count: 1 }, ...warnings] : warnings;
  const limits = Array.isArray(input.limits)
    ? input.limits.filter((item) => typeof item === "string" && item.length > 0 && item.length < 80)
    : [];

  return {
    ok: true,
    feed: {
      schemaVersion: "1",
      source: input.source,
      asOf: input.asOf ?? null,
      timezone: input.timezone ?? null,
      currency: input.currency ?? null,
      account: {
        class: account.class,
        verified: false,
        label: account.label ?? null,
      },
      freshness: { kind: input.freshness.kind, note: input.freshness.note },
      startingBalance: startingBalance.value,
      startingBalanceTime: input.startingBalanceTime ?? null,
      overview: {
        balance: pointBalance.value,
        equity: pointEquity.value,
        balanceAsOf: overview.balanceAsOf ?? null,
        equityAsOf: overview.equityAsOf ?? null,
      },
      equitySnapshots: snapshots,
      equitySnapshotsNote: typeof input.equitySnapshotsNote === "string" ? input.equitySnapshotsNote : null,
      cashflows,
      closedTrades: trades,
      warnings: feedWarnings,
      limits,
    },
  };
}

export function freshnessOf(feed, nowMs) {
  if (feed.source === "unconnected" || feed.freshness.kind === "unconnected") {
    return { kind: "unconnected", ageMs: null };
  }
  if (!feed.asOf) return { kind: "undated", ageMs: null };
  const ageMs = nowMs - Date.parse(feed.asOf);
  if (!Number.isFinite(ageMs)) return { kind: "undated", ageMs: null };
  if (ageMs > STALE_AFTER_MS) return { kind: "stale", ageMs };
  if (ageMs < -5 * 60 * 1000) return { kind: "future", ageMs };
  return { kind: "snapshot", ageMs };
}

function buildBalanceSeries(feed, trades) {
  const label = "Realized balance (starting balance + cash flows + closed net P&L)";
  if (feed.startingBalance == null) {
    return { available: false, reason: "missing-starting-balance", points: [], maxDrop: null, label };
  }
  const events = [
    ...feed.cashflows.map((cashflow) => ({
      time: cashflow.time,
      delta: signedCashflow(cashflow),
      kind: 0,
    })),
    ...trades.map((trade) => ({ time: trade.closeTime, delta: tradeNet(trade), kind: 1 })),
  ].sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.kind - b.kind);

  const startTime = feed.startingBalanceTime || events[0]?.time || feed.asOf;
  if (!startTime) {
    return { available: false, reason: "missing-time", points: [], maxDrop: null, label };
  }

  let balance = feed.startingBalance;
  let peak = balance;
  let maxDrop = 0;
  const points = [{ time: startTime, value: roundMoney(balance) }];
  for (const event of events) {
    balance = roundMoney(balance + event.delta);
    points.push({ time: event.time, value: balance });
    if (balance > peak) peak = balance;
    const drop = roundMoney(balance - peak);
    if (drop < maxDrop) maxDrop = drop;
  }
  if (feed.asOf && Date.parse(feed.asOf) > Date.parse(points[points.length - 1].time)) {
    points.push({ time: feed.asOf, value: balance });
  }
  return { available: true, reason: null, points, maxDrop, label };
}

function buildPnlDrawdown(trades) {
  const label = "Realized P&L drawdown (closed net P&L only, not equity drawdown)";
  if (trades.length === 0) {
    return { available: false, reason: "no-closed-trades", maxDrawdown: null, peak: null, points: [], label };
  }
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const points = [];
  for (const trade of trades) {
    cumulative = roundMoney(cumulative + tradeNet(trade));
    points.push({ time: trade.closeTime, value: cumulative });
    if (cumulative > peak) peak = cumulative;
    const drawdown = roundMoney(cumulative - peak);
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }
  return { available: true, reason: null, maxDrawdown, peak, points, label };
}

function buildEquitySeries(snapshots) {
  const label = "Equity drawdown (supplied snapshots only; the path between snapshots is unknown)";
  if (snapshots.length === 0) {
    return {
      available: false,
      reason: "no-equity-snapshots",
      points: [],
      current: null,
      drawdown: null,
      drawdownPeak: null,
      drawdownReason: "no-equity-snapshots",
      label,
    };
  }
  const points = snapshots.map((shot) => ({ time: shot.time, value: shot.equity }));
  const current = points[points.length - 1].value;
  if (points.length < 2) {
    return {
      available: true,
      reason: null,
      points,
      current,
      drawdown: null,
      drawdownPeak: null,
      drawdownReason: "single-snapshot",
      label,
    };
  }
  let peak = points[0].value;
  let drawdown = 0;
  for (const point of points) {
    if (point.value > peak) peak = point.value;
    const drop = roundMoney(point.value - peak);
    if (drop < drawdown) drawdown = drop;
  }
  return {
    available: true,
    reason: null,
    points,
    current,
    drawdown,
    drawdownPeak: peak,
    drawdownReason: null,
    label,
  };
}

function buildDietz(feed, balanceSeries) {
  const basis = "realized-balance-modified-dietz";
  if (!balanceSeries.available) {
    return { available: false, reason: balanceSeries.reason, rate: null, basis, gain: null };
  }
  const start = balanceSeries.points[0];
  const end = balanceSeries.points[balanceSeries.points.length - 1];
  const startMs = Date.parse(start.time);
  const endMs = Date.parse(end.time);
  const period = endMs - startMs;
  if (!(period > 0)) {
    return { available: false, reason: "non-positive-period", rate: null, basis, gain: null };
  }
  let weighted = 0;
  let netCash = 0;
  for (const cashflow of feed.cashflows) {
    const time = Date.parse(cashflow.time);
    if (time < startMs || time > endMs) continue;
    const signed = signedCashflow(cashflow);
    const weight = (endMs - time) / period;
    netCash += signed;
    weighted += signed * weight;
  }
  const gain = end.value - start.value - netCash;
  const denominator = start.value + weighted;
  if (!(denominator > 0) || !Number.isFinite(gain)) {
    return { available: false, reason: "non-positive-capital", rate: null, basis, gain: null };
  }
  return { available: true, reason: null, rate: gain / denominator, basis, gain: roundMoney(gain) };
}

function emptyMetrics(feed, nowMs) {
  return {
    status: "unconnected",
    source: feed.source,
    accountClass: feed.account.class,
    verified: false,
    currency: feed.currency,
    timezone: feed.timezone,
    asOf: feed.asOf,
    label: feed.account.label,
    freshness: freshnessOf(feed, nowMs),
    freshnessNote: feed.freshness.note,
    equitySnapshotsNote: feed.equitySnapshotsNote,
    warnings: feed.warnings,
    limits: feed.limits,
    tradeCount: null,
    wins: null,
    losses: null,
    flats: null,
    winRate: null,
    netPnl: null,
    grossProfit: null,
    fees: null,
    cashflowNet: null,
    pointBalance: null,
    pointEquity: null,
    reconstructedBalance: null,
    balanceMismatch: null,
    balanceSeries: {
      available: false,
      reason: "unconnected",
      points: [],
      maxDrop: null,
      label: "Realized balance",
    },
    equitySeries: {
      available: false,
      reason: "unconnected",
      points: [],
      current: null,
      drawdown: null,
      drawdownPeak: null,
      drawdownReason: "unconnected",
      label: "Equity",
    },
    realizedPnlDrawdown: {
      available: false,
      reason: "unconnected",
      maxDrawdown: null,
      peak: null,
      points: [],
      label: "Realized P&L drawdown",
    },
    dietz: {
      available: false,
      reason: "unconnected",
      rate: null,
      basis: "realized-balance-modified-dietz",
      gain: null,
    },
    trades: [],
  };
}

/**
 * @param {PerformanceFeed} feed
 * @param {number} [nowMs]
 * @returns {ViewModel}
 */
export function buildViewModel(feed, nowMs = Date.now()) {
  if (feed.source === "unconnected") return emptyMetrics(feed, nowMs);

  const trades = [...feed.closedTrades].sort((a, b) => Date.parse(a.closeTime) - Date.parse(b.closeTime));
  const nets = trades.map(tradeNet);
  const wins = nets.filter((net) => net > 0).length;
  const losses = nets.filter((net) => net < 0).length;
  const flats = nets.filter((net) => net === 0).length;
  const netPnl = roundMoney(nets.reduce((total, net) => total + net, 0));
  const grossProfit = roundMoney(trades.reduce((total, trade) => total + trade.profit, 0));
  const fees = roundMoney(trades.reduce((total, trade) => total + trade.commission + trade.swap, 0));
  const cashflowNet = roundMoney(feed.cashflows.reduce((total, cashflow) => total + signedCashflow(cashflow), 0));
  const balanceSeries = buildBalanceSeries(feed, trades);
  const reconstructedBalance =
    feed.startingBalance == null ? null : roundMoney(feed.startingBalance + cashflowNet + netPnl);
  const pointBalance = feed.overview.balance;
  const balanceMismatch =
    reconstructedBalance != null && pointBalance != null && Math.abs(reconstructedBalance - pointBalance) > 0.01
      ? roundMoney(pointBalance - reconstructedBalance)
      : null;

  return {
    status: "ready",
    source: feed.source,
    accountClass: feed.account.class,
    verified: false,
    currency: feed.currency,
    timezone: feed.timezone,
    asOf: feed.asOf,
    label: feed.account.label,
    freshness: freshnessOf(feed, nowMs),
    freshnessNote: feed.freshness.note,
    equitySnapshotsNote: feed.equitySnapshotsNote,
    warnings: feed.warnings,
    limits: feed.limits,
    tradeCount: trades.length,
    wins,
    losses,
    flats,
    winRate: trades.length === 0 ? null : wins / trades.length,
    netPnl,
    grossProfit,
    fees,
    cashflowNet,
    pointBalance,
    pointEquity: feed.overview.equity,
    reconstructedBalance,
    balanceMismatch,
    balanceSeries,
    equitySeries: buildEquitySeries(feed.equitySnapshots),
    realizedPnlDrawdown: buildPnlDrawdown(trades),
    dietz: buildDietz(feed, balanceSeries),
    trades: trades.map((trade) => ({ ...trade, net: tradeNet(trade) })),
  };
}
