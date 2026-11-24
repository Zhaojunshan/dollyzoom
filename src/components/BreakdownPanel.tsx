import { buildBreakdown } from "@/lib/breakdown.mjs";
import { formatPercent, formatPlainPercent, formatSignedMoney, signedWord } from "@/lib/format.mjs";

type View = Parameters<typeof buildBreakdown>[0];

export function BreakdownPanel({ view }: { view: View }) {
  const breakdown = buildBreakdown(view);
  const currency = breakdown.currency;

  return (
    <section className="min-w-0 max-w-full rounded-xl border border-card-border bg-card px-3 py-4 sm:px-4" aria-labelledby="breakdown-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="breakdown-heading" className="text-base font-semibold">
          Symbol, month, and fees
        </h2>
        <p className="text-xs text-muted">Closed-trade fields only. Not a forecast.</p>
      </div>
      {!breakdown.available ? (
        <p className="mt-3 text-sm leading-6 text-muted">Unconnected, so there is no symbol split, month split, or fee drag. Those figures are not shown as zero.</p>
      ) : breakdown.reason === "no-closed-trades" ? (
        <p className="mt-3 text-sm leading-6 text-muted">This connected file has no closed trades. Fee drag needs positive price P&amp;L, so it stays unavailable.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-card-border bg-background px-3 py-3 text-sm leading-6">
            <p className="text-xs uppercase tracking-wide text-muted">Fee drag</p>
            {breakdown.feeDrag ? (
              <p className="num mt-1 text-lg">
                <span className="sr-only">{signedWord(breakdown.feeDrag.fees)}</span>
                {formatPercent(breakdown.feeDrag.rate)}
                <span className="ml-2 text-sm text-muted">
                  {formatSignedMoney(breakdown.feeDrag.fees, currency)} / price P&amp;L {formatSignedMoney(breakdown.feeDrag.gross, currency)}
                </span>
              </p>
            ) : (
              <p className="mt-1">— Price P&amp;L is not positive, so the ratio is unavailable. The fee total is still in the summary above.</p>
            )}
            <p className="mt-1 text-muted">The ratio only compares fees with price P&amp;L. It is not an edge and not an estimate of the next trade.</p>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-xs text-muted">By symbol. Time zone: {breakdown.zoneLabel}</caption>
              <thead className="text-muted">
                <tr>
                  {["Symbol", "Trades", "Win rate", "Net P&L", "Fees"].map((heading) => (
                    <th key={heading} scope="col" className="px-2 py-2 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.symbols.map((row) => (
                  <tr key={row.symbol} className="border-t border-card-border">
                    <th scope="row" className="px-2 py-2 font-medium">
                      {row.symbol}
                    </th>
                    <td className="num px-2 py-2">{row.tradeCount}</td>
                    <td className="num px-2 py-2">{formatPlainPercent(row.winRate)}</td>
                    <td className={`num px-2 py-2 ${row.net < 0 ? "text-negative" : row.net > 0 ? "text-positive" : ""}`}>
                      <span className="sr-only">{signedWord(row.net)}</span>
                      {formatSignedMoney(row.net, currency)}
                    </td>
                    <td className="num px-2 py-2">
                      <span className="sr-only">{signedWord(row.fees)}</span>
                      {formatSignedMoney(row.fees, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {breakdown.months.length ? (
            <div className="max-w-full overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left text-xs text-muted">By close month ({breakdown.zoneLabel})</caption>
                <thead className="text-muted">
                  <tr>
                    {["Month", "Trades", "Net P&L", "Fees"].map((heading) => (
                      <th key={heading} scope="col" className="px-2 py-2 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {breakdown.months.map((row) => (
                    <tr key={row.month} className="border-t border-card-border">
                      <th scope="row" className="px-2 py-2 font-medium">
                        {row.month}
                      </th>
                      <td className="num px-2 py-2">{row.tradeCount}</td>
                      <td className={`num px-2 py-2 ${row.net < 0 ? "text-negative" : row.net > 0 ? "text-positive" : ""}`}>
                        <span className="sr-only">{signedWord(row.net)}</span>
                        {formatSignedMoney(row.net, currency)}
                      </td>
                      <td className="num px-2 py-2">{formatSignedMoney(row.fees, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">Close times could not be grouped by month, so there is no month table.</p>
          )}
        </div>
      )}
    </section>
  );
}
