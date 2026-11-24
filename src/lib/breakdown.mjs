/**
 * Browser-local summaries of closed trades already on a view model.
 * Ratios stay null when the denominator is not a positive price result.
 * Nothing here predicts the next trade.
 */

import { roundMoney } from "./round.mjs";

function monthKey(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const zone = timeZone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    if (!year || !month) return null;
    return `${year}-${month}`;
  } catch {
    return null;
  }
}

function blankRow() {
  return { tradeCount: 0, wins: 0, losses: 0, flats: 0, net: 0, fees: 0, gross: 0 };
}

function finish(row) {
  return {
    tradeCount: row.tradeCount,
    wins: row.wins,
    losses: row.losses,
    flats: row.flats,
    net: roundMoney(row.net),
    fees: roundMoney(row.fees),
    gross: roundMoney(row.gross),
    winRate: row.tradeCount === 0 ? null : row.wins / row.tradeCount,
  };
}

/**
 * @param {{ status?: string, currency?: string | null, timezone?: string | null, fees?: number | null, grossProfit?: number | null, trades?: { symbol: string, closeTime: string, net: number, profit: number, commission: number, swap: number }[] }} view
 */
export function buildBreakdown(view) {
  if (!view || view.status === "unconnected") {
    return {
      available: false,
      reason: "unconnected",
      currency: null,
      zoneLabel: null,
      symbols: [],
      months: [],
      feeDrag: null,
    };
  }

  const trades = Array.isArray(view.trades) ? view.trades : [];
  const symbols = new Map();
  const months = new Map();
  const zoneLabel = view.timezone || "UTC (the file did not declare a time zone)";
  let monthFailed = false;

  for (const trade of trades) {
    const fees = trade.commission + trade.swap;
    const symbolRow = symbols.get(trade.symbol) ?? blankRow();
    symbolRow.tradeCount += 1;
    if (trade.net > 0) symbolRow.wins += 1;
    else if (trade.net < 0) symbolRow.losses += 1;
    else symbolRow.flats += 1;
    symbolRow.net += trade.net;
    symbolRow.fees += fees;
    symbolRow.gross += trade.profit;
    symbols.set(trade.symbol, symbolRow);

    const month = monthKey(trade.closeTime, view.timezone);
    if (!month) {
      monthFailed = true;
      continue;
    }
    const monthRow = months.get(month) ?? blankRow();
    monthRow.tradeCount += 1;
    if (trade.net > 0) monthRow.wins += 1;
    else if (trade.net < 0) monthRow.losses += 1;
    else monthRow.flats += 1;
    monthRow.net += trade.net;
    monthRow.fees += fees;
    monthRow.gross += trade.profit;
    months.set(month, monthRow);
  }

  const gross = view.grossProfit;
  const fees = view.fees;
  const feeDrag =
    typeof gross === "number" && gross > 0 && typeof fees === "number"
      ? {
          rate: fees / gross,
          fees,
          gross,
          basis: "fees-over-positive-price-pnl",
        }
      : null;

  return {
    available: true,
    reason: trades.length === 0 ? "no-closed-trades" : null,
    currency: view.currency ?? null,
    zoneLabel,
    symbols: [...symbols.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([symbol, row]) => ({ symbol, ...finish(row) })),
    months: monthFailed
      ? []
      : [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, row]) => ({ month, ...finish(row) })),
    feeDrag,
  };
}
