import { formatMoney, formatPercent, formatPlainPercent, formatSignedMoney, signedWord } from "@/lib/format.mjs";

type Model = {
  currency: string | null;
  tradeCount: number | null;
  wins: number | null;
  losses: number | null;
  flats: number | null;
  winRate: number | null;
  netPnl: number | null;
  fees: number | null;
  cashflowNet: number | null;
  pointBalance: number | null;
  pointEquity: number | null;
  reconstructedBalance: number | null;
  realizedPnlDrawdown: { available: boolean; maxDrawdown: number | null; peak: number | null; reason?: string | null; label: string };
  equitySeries: { drawdown: number | null; drawdownPeak: number | null; drawdownReason: string | null; label: string };
  dietz: { available: boolean; rate: number | null; reason: string | null };
};

const REASONS: Record<string, string> = {
  unconnected: "No record has been published",
  "missing-starting-balance": "No starting balance",
  "missing-time": "A time is missing",
  "no-equity-snapshots": "No equity snapshots",
  "single-snapshot": "Only one equity reading",
  "no-closed-trades": "No closed trades",
  "non-positive-period": "The time span is not positive",
  "non-positive-capital": "The capital denominator is not positive",
};

function reasonText(code: string | null) {
  if (!code) return "Unavailable";
  return REASONS[code] ?? "Unavailable";
}

function ratio(drop: number | null, peak: number | null) {
  if (drop == null || peak == null || !(peak > 0)) return null;
  return drop / peak;
}

export function MetricGrid({ model }: { model: Model }) {
  const currency = model.currency;
  const cards = [
    {
      label: "Closed trades",
      value: model.tradeCount == null ? "—" : String(model.tradeCount),
      note: model.tradeCount == null ? "Unknown, not zero" : `${model.wins ?? 0} wins · ${model.losses ?? 0} losses · ${model.flats ?? 0} flat`,
    },
    {
      label: "Win rate",
      value: formatPlainPercent(model.winRate),
      note: "A win is net P&L above zero. Unknown when there are no trades.",
    },
    {
      label: "Net P&L",
      value: formatSignedMoney(model.netPnl, currency),
      word: signedWord(model.netPnl),
      note: "Price result + commission + swap",
      tone: model.netPnl,
    },
    {
      label: "Fees",
      value: formatSignedMoney(model.fees, currency),
      word: signedWord(model.fees),
      note: "Already inside net P&L. Shown again so the cost is visible.",
      tone: model.fees,
    },
    {
      label: "Cash flows",
      value: formatSignedMoney(model.cashflowNet, currency),
      word: model.cashflowNet == null ? "Unknown" : "Not P&L",
      note: "Deposits positive, withdrawals negative. Excluded from win rate.",
    },
    {
      label: "Realized balance",
      value: formatMoney(model.reconstructedBalance, currency),
      note: "Needs a starting balance. Stays blank when unknown.",
    },
    {
      label: "Point balance / equity",
      value:
        model.pointBalance == null && model.pointEquity == null
          ? "—"
          : `${formatMoney(model.pointBalance, currency)} / ${formatMoney(model.pointEquity, currency)}`,
      note: "One reading at export time. Equity can differ from balance.",
    },
    {
      label: "Realized P&L drawdown",
      value: formatSignedMoney(model.realizedPnlDrawdown.maxDrawdown, currency),
      word: signedWord(model.realizedPnlDrawdown.maxDrawdown),
      note: model.realizedPnlDrawdown.available
        ? `${formatPercent(ratio(model.realizedPnlDrawdown.maxDrawdown, model.realizedPnlDrawdown.peak))} from the cumulative net-P&L peak. Not equity drawdown.`
        : `${reasonText(model.realizedPnlDrawdown.reason ?? "no-closed-trades")}. Not equity drawdown.`,
      tone: model.realizedPnlDrawdown.maxDrawdown,
    },
    {
      label: "Equity drawdown",
      value: formatSignedMoney(model.equitySeries.drawdown, currency),
      word: signedWord(model.equitySeries.drawdown),
      note:
        model.equitySeries.drawdown == null
          ? `${reasonText(model.equitySeries.drawdownReason)}. Deals cannot stand in for it.`
          : `Snapshots only, ${formatPercent(ratio(model.equitySeries.drawdown, model.equitySeries.drawdownPeak))} from the snapshot peak. The path between snapshots is unknown.`,
      tone: model.equitySeries.drawdown,
    },
    {
      label: "Realized-balance return",
      value: model.dietz.available ? formatPercent(model.dietz.rate) : "—",
      note: model.dietz.available
        ? "Modified Dietz on realized balance. Not an equity time-weighted return."
        : `${reasonText(model.dietz.reason)}, so the return stays unavailable.`,
    },
  ];

  return (
    <section aria-label="Summary">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-card-border bg-card px-3 py-3 sm:px-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{card.label}</h3>
            <p className={`num mt-2 text-lg leading-6 sm:text-xl ${card.tone != null && card.tone < 0 ? "text-negative" : card.tone != null && card.tone > 0 ? "text-positive" : ""}`}>
              {card.word ? <span className="sr-only">{card.word}</span> : null}
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">{card.note}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
