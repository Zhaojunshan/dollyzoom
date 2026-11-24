import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { journalToCsv, parseJournalText } from "../src/lib/journalImport.mjs";
import { containsForbidden, parseFeed } from "../src/lib/performanceFeed.mjs";
import { calculatePositionSize } from "../src/lib/positionSize.mjs";

const context = {
  currency: "USD",
  timezone: "UTC",
  startingBalance: "10000",
  startingBalanceTime: "2026-01-01T00:00:00Z",
};

test("invalid journal rows are rejected and sensitive payloads are not echoed", () => {
  const bad = parseJournalText(
    [
      "recordType,symbol,side,volume,openTime,closeTime,openPrice,closePrice,profit,commission,swap,time,amount,cashflowType",
      "trade,EURUSD,buy,0,2026-02-01T00:00:00Z,2026-01-01T00:00:00Z,1,1,5,-1,0,,,",
    ].join("\n"),
    context,
  );
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((error) => error.includes("手数")));
  assert.ok(bad.errors.some((error) => error.includes("平仓时间")));

  const hidden = {
    currency: "USD",
    closedTrades: [
      {
        id: "local-1",
        symbol: "EURUSD",
        side: "buy",
        volume: 0.1,
        openTime: "2026-01-01T00:00:00Z",
        closeTime: "2026-01-02T00:00:00Z",
        openPrice: 1,
        closePrice: 1.1,
        profit: 10,
        commission: -1,
        swap: 0,
        partialCloses: 1,
        note: null,
      },
    ],
    positions: [{ symbol: "LIVEPOS-XYZ", volume: 9 }],
    password: "should-not-echo",
    login: 123456,
    server: "Broker-Live",
  };
  const rejected = parseJournalText(JSON.stringify(hidden), context);
  assert.equal(rejected.ok, false);
  const encoded = JSON.stringify(rejected);
  assert.equal(encoded.includes("LIVEPOS-XYZ"), false);
  assert.equal(encoded.includes("should-not-echo"), false);
  assert.equal(encoded.includes("Broker-Live"), false);
  assert.equal(encoded.includes("123456"), false);
});

test("a valid local journal can round-trip to CSV without becoming public", () => {
  const csv = [
    "recordType,symbol,side,volume,openTime,closeTime,openPrice,closePrice,profit,commission,swap,time,amount,cashflowType",
    "trade,XAUUSD,buy,0.10,2026-01-01T00:00:00Z,2026-01-02T00:00:00Z,2300,2310,20,-3,-1,,,",
    "cashflow,,,,,,,,,,,2026-01-03T00:00:00Z,500,withdrawal",
  ].join("\n");
  const imported = parseJournalText(csv, context);
  assert.equal(imported.ok, true);
  assert.equal(imported.journal.published, false);
  assert.equal(imported.journal.source, "local-journal");
  assert.equal(imported.journal.closedTrades[0].symbol, "XAUUSD");
  assert.equal(imported.journal.cashflows[0].type, "withdrawal");
  const again = parseJournalText(journalToCsv(imported.journal), context);
  assert.equal(again.ok, true);
  assert.equal(again.journal.closedTrades[0].profit, 20);
  assert.equal(again.journal.cashflows[0].amount, 500);
});

test("position size floors to the volume step and has no gold pip default", () => {
  const sized = calculatePositionSize({
    tickSize: "0.01",
    tickValue: "1",
    volumeStep: "0.01",
    minLot: "0.01",
    maxLot: "",
    stopDistance: "0.50",
    riskAmount: "30.4",
    accountCurrency: "usd",
  });
  assert.equal(sized.ok, true);
  assert.equal(sized.ticks, 50);
  assert.equal(sized.lots, 0.6);
  assert.equal(sized.estimatedLoss, 30);
  assert.equal(sized.accountCurrency, "USD");
  assert.ok(sized.rawLots > sized.lots);

  const oddStep = calculatePositionSize({
    tickSize: "0.01",
    tickValue: "1",
    volumeStep: "0.03",
    minLot: "0.03",
    maxLot: "",
    stopDistance: "1",
    riskAmount: "10",
    accountCurrency: "USD",
  });
  assert.equal(oddStep.ok, true);
  assert.equal(oddStep.lots, 0.09);
  assert.equal(oddStep.estimatedLoss, 9);

  const tooSmall = calculatePositionSize({
    tickSize: "0.01",
    tickValue: "1",
    volumeStep: "0.01",
    minLot: "0.01",
    maxLot: "",
    stopDistance: "0.50",
    riskAmount: "0.40",
    accountCurrency: "USD",
  });
  assert.equal(tooSmall.ok, true);
  assert.equal(tooSmall.belowMin, true);
  assert.equal(tooSmall.lots, 0);
  assert.equal(tooSmall.estimatedLoss, 0);

  for (const [field, value] of [
    ["tickSize", "0"],
    ["tickValue", "-1"],
    ["stopDistance", ""],
    ["accountCurrency", "US"],
  ]) {
    const result = calculatePositionSize({
      tickSize: "0.01",
      tickValue: "1",
      volumeStep: "0.01",
      minLot: "0.01",
      maxLot: "",
      stopDistance: "0.5",
      riskAmount: "10",
      accountCurrency: "USD",
      [field]: value,
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(field));
  }

  const misaligned = calculatePositionSize({
    tickSize: "0.01",
    tickValue: "1",
    volumeStep: "0.01",
    minLot: "0.015",
    maxLot: "",
    stopDistance: "0.5",
    riskAmount: "10",
    accountCurrency: "USD",
  });
  assert.deepEqual(misaligned.errors, ["minLot-step"]);
  assert.equal(calculatePositionSize.toString().includes("XAUUSD"), false);
});

test("public files and the exporter do not carry a live-trade payload", () => {
  const publicFiles = [
    "public/data/performance.json",
    "public/data/demo-performance.json",
    "public/data/feed.json",
  ];
  for (const file of publicFiles) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.equal(containsForbidden(JSON.parse(text)), false);
    assert.equal(/password|login|openPositions|order_send/i.test(text), false);
  }
  const production = parseFeed(JSON.parse(readFileSync(new URL("../public/data/performance.json", import.meta.url), "utf8")));
  assert.equal(production.feed.source, "unconnected");
  assert.equal(production.feed.account.class, "unknown");

  const poisoned = parseFeed({
    schemaVersion: "1",
    source: "manual-static-export",
    positions: [{ id: "OPEN-NOW" }],
    asOf: "2026-01-01T00:00:00Z",
    timezone: "UTC",
    currency: "USD",
    account: { class: "live", verified: true, label: null },
    freshness: { kind: "static-snapshot", note: "no" },
    startingBalance: null,
    startingBalanceTime: null,
    overview: { balance: 1, equity: 1, balanceAsOf: "2026-01-01T00:00:00Z", equityAsOf: "2026-01-01T00:00:00Z" },
    equitySnapshots: [],
    cashflows: [],
    closedTrades: [],
    warnings: [],
  });
  assert.equal(poisoned.ok, false);
  assert.equal(poisoned.error, "sensitive");
  assert.equal(JSON.stringify(poisoned).includes("OPEN-NOW"), false);

  const localOnly = parseFeed({
    schemaVersion: "1",
    source: "manual-static-export",
    localOnly: true,
    asOf: null,
    timezone: null,
    currency: null,
    account: { class: "unknown", verified: false, label: null },
    freshness: { kind: "static-snapshot", note: "local" },
    startingBalance: null,
    startingBalanceTime: null,
    overview: { balance: null, equity: null, balanceAsOf: null, equityAsOf: null },
    equitySnapshots: [],
    cashflows: [],
    closedTrades: [],
    warnings: [],
  });
  assert.equal(localOnly.error, "local-only");

  const exporter = readFileSync(new URL("../scripts/mt5_closed_export.py", import.meta.url), "utf8");
  for (const banned of ["order_send", "order_check", "positions_get", "orders_get", "history_orders_get", "mt5.login"]) {
    assert.equal(exporter.includes(banned), false, banned);
  }

  const roots = ["src/app", "src/components", "public"];
  const skip = new Set();
  for (const root of roots) {
    walk(root, (file) => {
      if (!/\.(tsx|ts|json|css|html|js|mjs)$/.test(file)) return;
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("creem.io"), false, file);
      assert.equal(text.includes("dolly-zoom"), false, file);
      assert.equal(text.includes("order_send"), false, file);
    }, skip);
  }
});

function walk(dir, visit, skip) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (skip.has(path)) continue;
    const info = statSync(path);
    if (info.isDirectory()) walk(path, visit, skip);
    else visit(path);
  }
}
