/**
 * MT5 deals are not completed trades.
 * Supported limited format:
 * - entry "in" plus entry "out" or "out_by" on the same position id
 * - a position is closed only when closed volume matches opened volume
 * - several outs are one closed trade after the position is flat
 * - a remainder still open is omitted (not a public closed trade)
 * - entry "inout" is unsupported and the whole position is omitted
 * - balance deals are cashflows, never P&L
 * - credit deals are ignored
 * Position ids and deal tickets are not copied into the result.
 */

import { isIsoTime, roundMoney, roundVol } from "./round.mjs";

const VOL_EPS = 1e-8;

function warn(warnings, code) {
  const found = warnings.find((item) => item.code === code);
  if (found) found.count += 1;
  else warnings.push({ code, count: 1 });
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function byTime(a, b) {
  return Date.parse(a.time) - Date.parse(b.time) || a._index - b._index;
}

function weightedPrice(rows) {
  const volume = sum(rows, (row) => row.volume);
  const priced = sum(rows, (row) => row.price * row.volume);
  return priced / volume;
}

function opposite(type) {
  if (type === "buy") return "sell";
  if (type === "sell") return "buy";
  return null;
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function closePosition(rows, warnings) {
  if (rows.some((row) => row.entry === "inout")) {
    warn(warnings, "unsupported-inout");
    return null;
  }

  const ins = rows.filter((row) => row.entry === "in");
  const outs = rows.filter((row) => row.entry === "out" || row.entry === "out_by");
  const unknown = rows.filter(
    (row) => row.entry !== "in" && row.entry !== "out" && row.entry !== "out_by",
  );
  if (unknown.length || ins.length === 0) {
    warn(warnings, "ignored-deal-type");
    return null;
  }
  if (outs.length === 0) {
    warn(warnings, "still-open");
    return null;
  }

  const symbols = new Set(rows.map((row) => row.symbol));
  if (symbols.size !== 1 || !rows[0].symbol) {
    warn(warnings, "mixed-symbol");
    return null;
  }

  const entrySides = new Set(ins.map((row) => row.type));
  const closeSide = opposite(ins[0].type);
  if (entrySides.size !== 1 || outs.some((row) => row.type !== closeSide)) {
    warn(warnings, "mixed-entry-side");
    return null;
  }

  for (const row of rows) {
    if (
      !isIsoTime(row.time) ||
      !finiteNumber(row.volume) ||
      row.volume <= 0 ||
      !finiteNumber(row.price) ||
      !finiteNumber(row.profit) ||
      !finiteNumber(row.commission) ||
      !finiteNumber(row.swap)
    ) {
      warn(warnings, "bad-deal");
      return null;
    }
  }

  const volumeIn = roundVol(sum(ins, (row) => row.volume));
  const volumeOut = roundVol(sum(outs, (row) => row.volume));
  if (volumeOut + VOL_EPS < volumeIn) {
    warn(warnings, "still-open");
    return null;
  }
  if (volumeOut > volumeIn + VOL_EPS) {
    warn(warnings, "volume-mismatch");
    return null;
  }

  const earliestIn = [...ins].sort(byTime)[0];
  const latestOut = [...outs].sort(byTime)[outs.length - 1];
  if (Date.parse(latestOut.time) < Date.parse(earliestIn.time)) {
    warn(warnings, "bad-time");
    return null;
  }

  return {
    symbol: rows[0].symbol,
    side: earliestIn.type,
    volume: volumeIn,
    openTime: earliestIn.time,
    closeTime: latestOut.time,
    openPrice: roundMoney(weightedPrice(ins)),
    closePrice: roundMoney(weightedPrice(outs)),
    profit: roundMoney(sum(rows, (row) => row.profit)),
    commission: roundMoney(sum(rows, (row) => row.commission)),
    swap: roundMoney(sum(rows, (row) => row.swap)),
    partialCloses: outs.length,
    note: outs.length > 1 ? "aggregated-partial-closes" : null,
  };
}

export function aggregateDeals(deals) {
  if (!Array.isArray(deals)) {
    throw new TypeError("deals must be an array");
  }

  const warnings = [];
  const cashflows = [];
  const groups = new Map();
  const order = [];

  deals.forEach((deal, index) => {
    const type = deal?.type;
    if (type === "balance") {
      const profit = deal.profit;
      if (!finiteNumber(profit) || profit === 0 || !isIsoTime(deal.time)) {
        warn(warnings, profit === 0 ? "ignored-zero-balance" : "bad-deal");
        return;
      }
      cashflows.push({
        time: deal.time,
        type: profit > 0 ? "deposit" : "withdrawal",
        amount: roundMoney(Math.abs(profit)),
      });
      return;
    }
    if (type === "credit") {
      warn(warnings, "credit-ignored");
      return;
    }
    if (type !== "buy" && type !== "sell") {
      warn(warnings, "ignored-deal-type");
      return;
    }
    if (deal.positionId == null || deal.positionId === "") {
      warn(warnings, "missing-position-id");
      return;
    }
    const key = String(deal.positionId);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key).push({ ...deal, _index: index });
  });

  const closed = [];
  for (const key of order) {
    const trade = closePosition(groups.get(key), warnings);
    if (trade) closed.push(trade);
  }

  closed.sort((a, b) => Date.parse(a.closeTime) - Date.parse(b.closeTime) || a.symbol.localeCompare(b.symbol));
  closed.forEach((trade, index) => {
    trade.id = `closed-${index + 1}`;
  });

  cashflows.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  cashflows.forEach((cashflow, index) => {
    cashflow.id = `cashflow-${index + 1}`;
  });

  warnings.sort((a, b) => a.code.localeCompare(b.code));
  return { closedTrades: closed, cashflows, warnings };
}
