import assert from "node:assert/strict";
import test from "node:test";

import { buildBreakdown } from "../src/lib/breakdown.mjs";
import { buildViewModel, parseFeed } from "../src/lib/performanceFeed.mjs";

function trade(overrides) {
  return {
    id: "t",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    openTime: "2026-10-01T00:00:00Z",
    closeTime: "2026-10-05T02:00:00Z",
    openPrice: 1,
    closePrice: 1,
    profit: 100,
    commission: -10,
    swap: -5,
    partialCloses: 1,
    note: null,
    net: 85,
    ...overrides,
  };
}

test("symbol and month breakdowns use closed-trade fields only", () => {
  const view = {
    status: "ready",
    currency: "USD",
    timezone: "Asia/Shanghai",
    grossProfit: 120,
    fees: -20,
    trades: [
      trade({ symbol: "XAUUSD", profit: 20, commission: -6, swap: -4, net: 10, closeTime: "2026-10-05T02:00:00Z" }),
      trade({ id: "b", symbol: "EURUSD", profit: 100, commission: -8, swap: -2, net: 90, closeTime: "2026-11-02T16:30:00Z" }),
    ],
  };
  const breakdown = buildBreakdown(view);
  assert.equal(breakdown.available, true);
  assert.deepEqual(
    breakdown.symbols.map((row) => row.symbol),
    ["EURUSD", "XAUUSD"],
  );
  assert.equal(breakdown.symbols[1].net, 10);
  assert.equal(breakdown.symbols[1].fees, -10);
  assert.equal(breakdown.months[0].month, "2026-10");
  assert.equal(breakdown.months[1].month, "2026-11");
  assert.equal(breakdown.zoneLabel, "Asia/Shanghai");
  assert.equal(breakdown.feeDrag.rate, -20 / 120);
  assert.equal(JSON.stringify(breakdown).includes("positions"), false);
});

test("fee drag stays unknown when price P&L is not positive", () => {
  const losing = buildBreakdown({
    status: "ready",
    currency: "USD",
    timezone: "UTC",
    grossProfit: -30,
    fees: -8,
    trades: [trade({ profit: -30, commission: -6, swap: -2, net: -38 })],
  });
  assert.equal(losing.feeDrag, null);
  assert.equal(losing.symbols[0].fees, -8);

  const empty = buildBreakdown({
    status: "ready",
    currency: "USD",
    timezone: null,
    grossProfit: 0,
    fees: 0,
    trades: [],
  });
  assert.equal(empty.available, true);
  assert.equal(empty.reason, "no-closed-trades");
  assert.equal(empty.feeDrag, null);
  assert.deepEqual(empty.symbols, []);
  assert.equal(empty.zoneLabel.includes("没有时区"), true);
});

test("an unconnected view does not become a zero breakdown", () => {
  const production = parseFeed({
    schemaVersion: "1",
    source: "unconnected",
    asOf: null,
    timezone: null,
    currency: null,
    account: { class: "unknown", verified: false, label: null },
    freshness: { kind: "unconnected", note: "尚未发布任何交易记录。这不是延迟行情，也没有连接终端。" },
    startingBalance: null,
    startingBalanceTime: null,
    overview: { balance: null, equity: null, balanceAsOf: null, equityAsOf: null },
    equitySnapshots: [],
    cashflows: [],
    closedTrades: [],
    warnings: [],
  });
  const view = buildViewModel(production.feed, Date.parse("2026-11-24T00:00:00Z"));
  const breakdown = buildBreakdown(view);
  assert.equal(breakdown.available, false);
  assert.equal(breakdown.feeDrag, null);
  assert.equal(breakdown.symbols.length, 0);
  assert.equal(JSON.stringify(breakdown).includes("0.00"), false);
});
