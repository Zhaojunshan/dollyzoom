import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { aggregateDeals } from "../src/lib/deals.mjs";
import { buildViewModel, parseFeed, tradeNet } from "../src/lib/performanceFeed.mjs";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/partial-closes.json", import.meta.url), "utf8"));

function connectedFeed(overrides = {}) {
  return {
    schemaVersion: "1",
    source: "manual-static-export",
    asOf: "2026-06-01T00:00:00Z",
    timezone: "UTC",
    currency: "USD",
    account: { class: "demo", verified: false, label: null },
    freshness: { kind: "static-snapshot", note: "测试快照，不是延迟行情。" },
    startingBalance: null,
    startingBalanceTime: null,
    overview: { balance: null, equity: null, balanceAsOf: null, equityAsOf: null },
    equitySnapshots: [],
    cashflows: [],
    closedTrades: [],
    warnings: [],
    ...overrides,
  };
}

function trade(overrides) {
  return {
    id: "t1",
    symbol: "EURUSD",
    side: "buy",
    volume: 0.1,
    openTime: "2026-01-01T00:00:00Z",
    closeTime: "2026-01-02T00:00:00Z",
    openPrice: 1,
    closePrice: 1,
    profit: 0,
    commission: 0,
    swap: 0,
    partialCloses: 1,
    note: null,
    ...overrides,
  };
}

test("partial closes aggregate only after the position is flat", () => {
  const result = aggregateDeals(fixture.deals);
  const encoded = JSON.stringify(result);
  assert.equal(result.closedTrades.length, 2);
  assert.equal(encoded.includes("ticket-should-not-leak"), false);
  assert.equal(encoded.includes("p-inout"), false);
  assert.equal(encoded.includes("p-gold"), false);

  const gold = result.closedTrades[0];
  assert.equal(gold.symbol, "XAUUSD");
  assert.equal(gold.volume, 1);
  assert.equal(gold.partialCloses, 2);
  assert.equal(gold.note, "aggregated-partial-closes");
  assert.equal(gold.closePrice, 2304);
  assert.equal(gold.profit, 40);
  assert.equal(gold.commission, -8);
  assert.equal(gold.swap, -2);
  assert.equal(tradeNet(gold), 30);

  const fee = result.closedTrades[1];
  assert.equal(fee.symbol, "EURUSD");
  assert.equal(tradeNet(fee), -2);
  assert.equal(result.cashflows.map((item) => item.type).join(","), "deposit,withdrawal");
  assert.equal(result.cashflows[0].amount, 1000);
  assert.equal(result.cashflows[1].amount, 200);
  assert.ok(result.warnings.some((item) => item.code === "still-open"));
  assert.ok(result.warnings.some((item) => item.code === "unsupported-inout"));
  assert.ok(result.warnings.some((item) => item.code === "credit-ignored"));
  assert.ok(result.warnings.some((item) => item.code === "missing-position-id"));
});

test("python aggregation matches the javascript rules", () => {
  const python = spawnSync(
    "python3",
    ["scripts/mt5_closed_export.py", "--aggregate-fixture", "fixtures/partial-closes.json"],
    { encoding: "utf8" },
  );
  assert.equal(python.status, 0, python.stderr);
  assert.deepEqual(JSON.parse(python.stdout), aggregateDeals(fixture.deals));
});

test("fees are inside net P&L and cashflows are not", () => {
  const parsed = parseFeed(
    connectedFeed({
      startingBalance: 10000,
      startingBalanceTime: "2026-01-01T00:00:00Z",
      cashflows: [
        { id: "cashflow-1", time: "2026-01-15T00:00:00Z", type: "deposit", amount: 2000 },
        { id: "cashflow-2", time: "2026-02-01T00:00:00Z", type: "withdrawal", amount: 500 },
      ],
      closedTrades: [
        trade({
          id: "fee",
          profit: 10,
          commission: -6,
          swap: -8,
          closeTime: "2026-03-01T00:00:00Z",
        }),
      ],
    }),
  );
  assert.equal(parsed.ok, true);
  const view = buildViewModel(parsed.feed, Date.parse("2026-06-02T00:00:00Z"));
  assert.equal(view.netPnl, -4);
  assert.equal(view.wins, 0);
  assert.equal(view.losses, 1);
  assert.equal(view.cashflowNet, 1500);
  assert.equal(view.reconstructedBalance, 11496);
  assert.notEqual(view.netPnl, view.grossProfit);
});

test("modified dietz uses cashflow timing and stays unavailable without a starting balance", () => {
  const start = Date.parse("2026-01-01T00:00:00Z");
  const end = Date.parse("2027-01-01T00:00:00Z");
  const midpoint = new Date(start + (end - start) / 2).toISOString();
  const parsed = parseFeed(
    connectedFeed({
      asOf: "2027-01-01T00:00:00Z",
      startingBalance: 10000,
      startingBalanceTime: "2026-01-01T00:00:00Z",
      cashflows: [{ id: "cashflow-1", time: midpoint, type: "deposit", amount: 2000 }],
      closedTrades: [
        trade({
          profit: 1000,
          closeTime: "2026-12-01T00:00:00Z",
        }),
      ],
    }),
  );
  const view = buildViewModel(parsed.feed, end);
  assert.equal(view.dietz.available, true);
  assert.equal(view.dietz.basis, "realized-balance-modified-dietz");
  assert.equal(view.dietz.gain, 1000);
  assert.ok(Math.abs(view.dietz.rate - 1000 / 11000) < 1e-12);

  const missing = parseFeed(connectedFeed());
  const missingView = buildViewModel(missing.feed, end);
  assert.equal(missingView.dietz.available, false);
  assert.equal(missingView.dietz.rate, null);
  assert.equal(missingView.reconstructedBalance, null);
});

test("equity drawdown is not invented from closed deals", () => {
  const parsed = parseFeed(
    connectedFeed({
      startingBalance: 1000,
      startingBalanceTime: "2026-01-01T00:00:00Z",
      closedTrades: [
        trade({ id: "a", profit: 100, closeTime: "2026-02-01T00:00:00Z" }),
        trade({ id: "b", profit: -40, closeTime: "2026-03-01T00:00:00Z" }),
      ],
      equitySnapshots: [
        { time: "2026-02-01T00:00:00Z", equity: 1100 },
        { time: "2026-02-15T00:00:00Z", equity: 900 },
      ],
    }),
  );
  const view = buildViewModel(parsed.feed, Date.parse("2026-06-02T00:00:00Z"));
  assert.equal(view.realizedPnlDrawdown.maxDrawdown, -40);
  assert.equal(view.equitySeries.drawdown, -200);
  assert.notEqual(view.equitySeries.drawdown, view.realizedPnlDrawdown.maxDrawdown);
  assert.match(view.equitySeries.label, /权益/);
  assert.match(view.realizedPnlDrawdown.label, /不是权益回撤/);

  const noShots = parseFeed(
    connectedFeed({
      closedTrades: [trade({ profit: -5 })],
    }),
  );
  const bare = buildViewModel(noShots.feed, Date.parse("2026-06-02T00:00:00Z"));
  assert.equal(bare.equitySeries.drawdown, null);
  assert.equal(bare.equitySeries.drawdownReason, "no-equity-snapshots");
  assert.equal(bare.pointEquity, null);
});

test("a published empty history is not the same as an unconnected file", () => {
  const empty = buildViewModel(parseFeed(connectedFeed()).feed, Date.parse("2026-06-02T00:00:00Z"));
  assert.equal(empty.tradeCount, 0);
  assert.equal(empty.winRate, null);
  assert.equal(empty.netPnl, 0);
  assert.equal(empty.wins, 0);

  const production = JSON.parse(readFileSync(new URL("../public/data/performance.json", import.meta.url), "utf8"));
  const parsed = parseFeed(production);
  assert.equal(parsed.ok, true);
  const view = buildViewModel(parsed.feed, Date.parse("2026-11-24T00:00:00Z"));
  assert.equal(view.status, "unconnected");
  assert.equal(view.tradeCount, null);
  assert.equal(view.netPnl, null);
  assert.equal(view.winRate, null);
  assert.equal(view.pointBalance, null);
  assert.equal(view.pointEquity, null);
  assert.equal(view.cashflowNet, null);
  assert.equal(view.freshness.kind, "unconnected");
});

test("stale means an old static file, not a delayed quote", () => {
  const parsed = parseFeed(connectedFeed({ asOf: "2026-01-01T00:00:00Z" }));
  const view = buildViewModel(parsed.feed, Date.parse("2026-11-24T00:00:00Z"));
  assert.equal(view.freshness.kind, "stale");
  assert.equal(JSON.stringify(view.freshness).includes("delay"), false);
});

test("demo snapshot stays labelled and does not claim verification", () => {
  const demo = JSON.parse(readFileSync(new URL("../public/data/demo-performance.json", import.meta.url), "utf8"));
  const parsed = parseFeed(demo);
  assert.equal(parsed.ok, true);
  const view = buildViewModel(parsed.feed, Date.parse("2026-11-24T00:00:00Z"));
  assert.equal(view.source, "demo");
  assert.equal(view.accountClass, "demo");
  assert.equal(view.verified, false);
  assert.equal(view.tradeCount, 4);
  assert.equal(view.winRate, 0.5);
  assert.equal(view.netPnl, 53);
  assert.equal(view.fees, -37);
  assert.equal(view.cashflowNet, 1500);
  assert.equal(view.reconstructedBalance, 11553);
  assert.equal(view.realizedPnlDrawdown.maxDrawdown, -91);
  assert.equal(view.equitySeries.drawdown, -840);
  assert.equal(view.balanceMismatch, null);
  assert.equal(view.freshness.kind, "snapshot");
});
