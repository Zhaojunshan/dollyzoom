"use client";

import { useMemo, useState } from "react";

import { formatPrice, formatSignedMoney, formatTime, signedWord } from "@/lib/format.mjs";

type Trade = {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  openTime: string;
  closeTime: string;
  openPrice: number;
  closePrice: number;
  profit: number;
  commission: number;
  swap: number;
  partialCloses: number;
  net: number;
};

const PAGE_SIZE = 8;

export function TradeTable({
  trades,
  currency,
  timeZone,
  empty,
}: {
  trades: Trade[];
  currency: string | null;
  timeZone: string | null;
  empty: string;
}) {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return trades.filter((trade) => {
      if (symbol && !trade.symbol.toLowerCase().includes(symbol.trim().toLowerCase())) return false;
      if (side !== "all" && trade.side !== side) return false;
      if (outcome === "win" && !(trade.net > 0)) return false;
      if (outcome === "loss" && !(trade.net < 0)) return false;
      if (outcome === "flat" && trade.net !== 0) return false;
      return true;
    });
  }, [outcome, side, symbol, trades]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function update(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <section className="rounded-2xl border border-card-border bg-card px-3 py-4 sm:px-4" aria-labelledby="closed-trades-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h2 id="closed-trades-heading" className="text-lg font-semibold">
            Closed trades
          </h2>
          <p className="mt-1 text-sm text-muted">Fully closed round turns only. Open positions are not listed.</p>
        </div>
        <p className="text-sm text-muted">
          {filtered.length === 0 ? "0 matches" : `${start + 1}–${start + visible.length} of ${filtered.length}`}
        </p>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(event) => event.preventDefault()}>
        <label className="block text-sm">
          <span className="text-muted">Symbol</span>
          <input
            value={symbol}
            onChange={(event) => update(setSymbol, event.target.value)}
            className="mt-1 w-full rounded-xl border border-card-border bg-background px-3 py-2"
            placeholder="For example EURUSD"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Side</span>
          <select
            value={side}
            onChange={(event) => update(setSide, event.target.value)}
            className="mt-1 w-full rounded-xl border border-card-border bg-background px-3 py-2"
          >
            <option value="all">All</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted">Result</span>
          <select
            value={outcome}
            onChange={(event) => update(setOutcome, event.target.value)}
            className="mt-1 w-full rounded-xl border border-card-border bg-background px-3 py-2"
          >
            <option value="all">All</option>
            <option value="win">Net gain</option>
            <option value="loss">Net loss</option>
            <option value="flat">Flat</option>
          </select>
        </label>
      </form>

      {visible.length === 0 ? (
        <p className="mt-4 px-1 text-sm leading-6 text-muted">{trades.length === 0 ? empty : "No closed trades match these filters."}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Closed trades</caption>
              <thead className="text-muted">
                <tr>
                  {["Symbol", "Side", "Lots", "Close time", "Open / close", "Price P&L", "Fees", "Net"].map((heading) => (
                    <th key={heading} scope="col" className="px-2 py-2 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((trade) => (
                  <tr key={trade.id} className="border-t border-card-border align-top">
                    <td className="px-2 py-3 font-medium">
                      {trade.symbol}
                      {trade.partialCloses > 1 ? (
                        <span className="mt-1 block text-xs font-normal text-muted">Partial closes combined × {trade.partialCloses}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3">{trade.side === "buy" ? "Buy" : "Sell"}</td>
                    <td className="num px-2 py-3">{formatPrice(trade.volume)}</td>
                    <td className="px-2 py-3">
                      <time dateTime={trade.closeTime}>{formatTime(trade.closeTime, timeZone)}</time>
                    </td>
                    <td className="num px-2 py-3">
                      {formatPrice(trade.openPrice)} → {formatPrice(trade.closePrice)}
                    </td>
                    <td className="num px-2 py-3">{formatSignedMoney(trade.profit, currency)}</td>
                    <td className="num px-2 py-3">
                      {formatSignedMoney(trade.commission + trade.swap, currency)}
                    </td>
                    <td className={`num px-2 py-3 ${trade.net < 0 ? "text-negative" : trade.net > 0 ? "text-positive" : ""}`}>
                      <span className="sr-only">{signedWord(trade.net)}</span>
                      {formatSignedMoney(trade.net, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-3 md:hidden">
            {visible.map((trade) => (
              <li key={trade.id} className="rounded-xl border border-card-border px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {trade.symbol} · {trade.side === "buy" ? "Buy" : "Sell"}
                    </p>
                    <p className="text-sm text-muted">{formatPrice(trade.volume)} lots</p>
                  </div>
                  <p className={`num text-right ${trade.net < 0 ? "text-negative" : trade.net > 0 ? "text-positive" : ""}`}>
                    <span className="sr-only">{signedWord(trade.net)}</span>
                    {formatSignedMoney(trade.net, currency)}
                  </p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">Close</dt>
                    <dd>
                      <time dateTime={trade.closeTime}>{formatTime(trade.closeTime, timeZone)}</time>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Price</dt>
                    <dd className="num">
                      {formatPrice(trade.openPrice)} → {formatPrice(trade.closePrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Price P&L</dt>
                    <dd className="num">{formatSignedMoney(trade.profit, currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Commission + swap</dt>
                    <dd className="num">{formatSignedMoney(trade.commission + trade.swap, currency)}</dd>
                  </div>
                </dl>
                {trade.partialCloses > 1 ? <p className="mt-2 text-xs text-muted">Partial closes combined × {trade.partialCloses}</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3 px-1">
          <button
            type="button"
            className="rounded-full border border-card-border px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
          >
            Previous
          </button>
          <p className="text-sm text-muted">
            Page {current} of {pages}
          </p>
          <button
            type="button"
            className="rounded-full border border-card-border px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={() => setPage(current + 1)}
            disabled={current === pages}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
