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
          品种、月份和费用
        </h2>
        <p className="text-xs text-muted">只按已平仓字段汇总，不预测下一笔。</p>
      </div>
      {!breakdown.available ? (
        <p className="mt-3 text-sm leading-6 text-muted">未连接，所以没有品种分布、月份分布或费用拖累。这些格子不会显示成 0。</p>
      ) : breakdown.reason === "no-closed-trades" ? (
        <p className="mt-3 text-sm leading-6 text-muted">这份已连接的记录里没有已平仓交易。费用拖累需要正的价格盈亏，因此现在不可用。</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-card-border bg-background px-3 py-3 text-sm leading-6">
            <p className="text-xs uppercase tracking-wide text-muted">费用拖累 Fee drag</p>
            {breakdown.feeDrag ? (
              <p className="num mt-1 text-lg">
                <span className="sr-only">{signedWord(breakdown.feeDrag.fees)}</span>
                {formatPercent(breakdown.feeDrag.rate)}
                <span className="ml-2 text-sm text-muted">
                  {formatSignedMoney(breakdown.feeDrag.fees, currency)} / 价格盈亏 {formatSignedMoney(breakdown.feeDrag.gross, currency)}
                </span>
              </p>
            ) : (
              <p className="mt-1">— 价格盈亏不是正数，比例不可用。费用本身仍在上面的摘要里。</p>
            )}
            <p className="mt-1 text-muted">这个比例只说明费用相对价格盈亏有多大，不是优势，也不是对未来的估计。</p>
          </div>
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="mb-2 text-left text-xs text-muted">按品种。时区：{breakdown.zoneLabel}</caption>
              <thead className="text-muted">
                <tr>
                  {["品种", "笔数", "胜率", "净盈亏", "费用"].map((heading) => (
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
                <caption className="mb-2 text-left text-xs text-muted">按平仓月份（{breakdown.zoneLabel}）</caption>
                <thead className="text-muted">
                  <tr>
                    {["月份", "笔数", "净盈亏", "费用"].map((heading) => (
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
            <p className="text-sm text-muted">平仓时间无法按月份归类，所以没有月份表。</p>
          )}
        </div>
      )}
    </section>
  );
}
