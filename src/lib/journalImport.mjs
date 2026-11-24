/**
 * Browser-local journal import. This module never publishes and never calls
 * the network. Imported rows stay in the object returned to the caller.
 */

import { containsForbidden, parseFeed } from "./performanceFeed.mjs";
import { isIsoTime, parseUserNumber } from "./round.mjs";

export const CSV_HEADER =
  "recordType,symbol,side,volume,openTime,closeTime,openPrice,closePrice,profit,commission,swap,time,amount,cashflowType";

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function journalToCsv(feed) {
  const lines = [CSV_HEADER];
  for (const trade of feed.closedTrades) {
    lines.push(
      [
        "trade",
        trade.symbol,
        trade.side,
        trade.volume,
        trade.openTime,
        trade.closeTime,
        trade.openPrice,
        trade.closePrice,
        trade.profit,
        trade.commission,
        trade.swap,
        "",
        "",
        "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  for (const cashflow of feed.cashflows) {
    lines.push(
      ["cashflow", "", "", "", "", "", "", "", "", "", "", cashflow.time, cashflow.amount, cashflow.type]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function splitCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

function numberAt(row, index, label, errors, line) {
  const value = parseUserNumber(row[index] ?? "");
  if (!Number.isFinite(value)) errors.push(`Row ${line}: ${label} is not a valid number`);
  return value;
}

function journalFromParts({ currency, timezone, startingBalance, startingBalanceTime, cashflows, closedTrades }) {
  const feed = {
    schemaVersion: "1",
    source: "local-journal",
    asOf: "2026-01-01T00:00:00Z",
    timezone,
    currency,
    account: { class: "unknown", verified: false, label: "Local journal" },
    freshness: { kind: "static-snapshot", note: "Browser-local journal. Not published." },
    startingBalance,
    startingBalanceTime,
    overview: { balance: null, equity: null, balanceAsOf: null, equityAsOf: null },
    equitySnapshots: [],
    equitySnapshotsNote: null,
    cashflows,
    closedTrades,
    warnings: [],
    limits: ["local-only"],
  };
  const parsed = parseFeed(feed);
  if (!parsed.ok) return { ok: false, errors: [parsed.error === "sensitive" ? "The file contains fields that must not be stored" : "The records are not in a supported shape"] };
  return { ok: true, journal: { ...parsed.feed, published: false } };
}

function contextFrom(input, errors) {
  const currency = typeof input.currency === "string" ? input.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("Enter a three-letter account currency, for example USD");
  const timezone = typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim() : null;
  if (timezone && timezone.length > 64) errors.push("The time zone name is too long");
  let startingBalance = null;
  const balanceText = typeof input.startingBalance === "string" ? input.startingBalance.trim() : "";
  if (balanceText) {
    startingBalance = parseUserNumber(balanceText);
    if (!Number.isFinite(startingBalance)) errors.push("Starting balance is not a valid number");
  }
  const startingBalanceTime =
    typeof input.startingBalanceTime === "string" && input.startingBalanceTime.trim()
      ? input.startingBalanceTime.trim()
      : null;
  if (startingBalanceTime && !isIsoTime(startingBalanceTime)) errors.push("Starting-balance time is not a valid timestamp");
  if (startingBalance == null && startingBalanceTime) errors.push("A starting-balance time was provided without a starting balance");
  return { currency, timezone, startingBalance, startingBalanceTime };
}

/**
 * @param {string} text
 * @param {{ currency?: string, timezone?: string, startingBalance?: string, startingBalanceTime?: string }} context
 * @returns {{ ok: false, errors: string[] } | { ok: true, journal: import("./performanceFeed.mjs").PerformanceFeed & { published: false } }}
 */
export function parseJournalText(text, context) {
  const errors = [];
  const shared = contextFrom(context, errors);
  if (errors.length) return { ok: false, errors };
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return { ok: false, errors: ["The file is empty"] };
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJournalJson(trimmed, shared);
  return parseJournalCsv(trimmed, shared);
}

function parseJournalJson(text, shared) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The JSON could not be parsed"] };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["JSON must be an object"] };
  }
  if (containsForbidden(data)) return { ok: false, errors: ["The file contains fields that must not be stored"] };
  const trades = Array.isArray(data.closedTrades) ? data.closedTrades : null;
  const cashflows = Array.isArray(data.cashflows) ? data.cashflows : [];
  if (!trades) return { ok: false, errors: ["JSON needs a closedTrades array"] };
  return journalFromParts({
    currency: data.currency || shared.currency,
    timezone: data.timezone ?? shared.timezone,
    startingBalance: data.startingBalance ?? shared.startingBalance,
    startingBalanceTime: data.startingBalanceTime ?? shared.startingBalanceTime,
    cashflows: cashflows.map((cashflow, index) => ({
      id: typeof cashflow.id === "string" && cashflow.id ? cashflow.id : `cashflow-${index + 1}`,
      time: cashflow.time,
      type: cashflow.type,
      amount: cashflow.amount,
    })),
    closedTrades: trades.map((trade, index) => ({
      id: typeof trade.id === "string" && trade.id ? trade.id : `local-${index + 1}`,
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
      partialCloses: trade.partialCloses || 1,
      note: trade.note === "aggregated-partial-closes" ? trade.note : null,
    })),
  });
}

function parseJournalCsv(text, shared) {
  const rows = splitCsv(text);
  if (rows.length < 2) return { ok: false, errors: ["CSV needs a header and at least one row"] };
  const header = rows[0].map((cell) => cell.trim()).join(",");
  if (header !== CSV_HEADER) return { ok: false, errors: ["The CSV header does not match the documented columns"] };

  const errors = [];
  const closedTrades = [];
  const cashflows = [];
  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    if (row.length !== 14) {
      errors.push(`Row ${line}: expected 14 columns`);
      return;
    }
    const recordType = row[0].trim();
    if (recordType === "trade") {
      const volume = numberAt(row, 3, "volume", errors, line);
      const openPrice = numberAt(row, 6, "open price", errors, line);
      const closePrice = numberAt(row, 7, "close price", errors, line);
      const profit = numberAt(row, 8, "price P&L", errors, line);
      const commission = numberAt(row, 9, "commission", errors, line);
      const swap = numberAt(row, 10, "swap", errors, line);
      const side = row[2].trim();
      const openTime = row[4].trim();
      const closeTime = row[5].trim();
      if (!(volume > 0)) errors.push(`Row ${line}: volume must be greater than 0`);
      if (side !== "buy" && side !== "sell") errors.push(`Row ${line}: side must be buy or sell`);
      if (!isIsoTime(openTime) || !isIsoTime(closeTime)) errors.push(`Row ${line}: open or close time is invalid`);
      else if (Date.parse(closeTime) < Date.parse(openTime)) errors.push(`Row ${line}: close time is earlier than open time`);
      if (row[11].trim() || row[12].trim() || row[13].trim()) {
        errors.push(`Row ${line}: a trade row must leave the cash-flow columns empty`);
      }
      closedTrades.push({
        id: `local-${closedTrades.length + 1}`,
        symbol: row[1].trim(),
        side,
        volume,
        openTime,
        closeTime,
        openPrice,
        closePrice,
        profit,
        commission,
        swap,
        partialCloses: 1,
        note: null,
      });
      return;
    }
    if (recordType === "cashflow") {
      const amount = numberAt(row, 12, "cash-flow amount", errors, line);
      const type = row[13].trim();
      const time = row[11].trim();
      if (type !== "deposit" && type !== "withdrawal") errors.push(`Row ${line}: cash-flow type must be deposit or withdrawal`);
      if (!isIsoTime(time)) errors.push(`Row ${line}: cash-flow time is invalid`);
      if (!(amount > 0)) errors.push(`Row ${line}: cash-flow amount must be positive; use the type for direction`);
      cashflows.push({
        id: `cashflow-${cashflows.length + 1}`,
        time,
        type,
        amount,
      });
      return;
    }
    errors.push(`Row ${line}: recordType must be trade or cashflow`);
  });
  if (errors.length) return { ok: false, errors };
  return journalFromParts({ ...shared, cashflows, closedTrades });
}
