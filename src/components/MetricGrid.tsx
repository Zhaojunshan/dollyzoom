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
  unconnected: "尚未发布记录",
  "missing-starting-balance": "没有期初余额",
  "missing-time": "缺少时间",
  "no-equity-snapshots": "没有权益快照",
  "single-snapshot": "只有一个权益时点",
  "no-closed-trades": "没有已平仓记录",
  "non-positive-period": "时间区间不够",
  "non-positive-capital": "资金分母不是正数",
};

function reasonText(code: string | null) {
  if (!code) return "不可用";
  return REASONS[code] ?? "不可用";
}

function ratio(drop: number | null, peak: number | null) {
  if (drop == null || peak == null || !(peak > 0)) return null;
  return drop / peak;
}

export function MetricGrid({ model }: { model: Model }) {
  const currency = model.currency;
  const cards = [
    {
      label: "已平仓笔数",
      en: "Closed trades",
      value: model.tradeCount == null ? "—" : String(model.tradeCount),
      note: model.tradeCount == null ? "未知，不是 0" : `${model.wins ?? 0} 盈 · ${model.losses ?? 0} 亏 · ${model.flats ?? 0} 平`,
    },
    {
      label: "胜率",
      en: "Win rate",
      value: formatPlainPercent(model.winRate),
      note: "净盈亏大于 0 才算赢。没有记录时未知。",
    },
    {
      label: "净盈亏",
      en: "Net P&L",
      value: formatSignedMoney(model.netPnl, currency),
      word: signedWord(model.netPnl),
      note: "价格盈亏 + 佣金 + 库存费",
      tone: model.netPnl,
    },
    {
      label: "费用",
      en: "Commission + swap",
      value: formatSignedMoney(model.fees, currency),
      word: signedWord(model.fees),
      note: "已包含在净盈亏里，这里单独列出",
      tone: model.fees,
    },
    {
      label: "出入金净额",
      en: "Cashflows",
      value: formatSignedMoney(model.cashflowNet, currency),
      word: model.cashflowNet == null ? "未知" : "不是盈亏",
      note: "入金为正，出金为负。不计入胜率。",
    },
    {
      label: "推算已实现余额",
      en: "Realized balance",
      value: formatMoney(model.reconstructedBalance, currency),
      note: "需要期初余额。未知时保持空白。",
    },
    {
      label: "时点余额 / 权益",
      en: "Balance / equity",
      value:
        model.pointBalance == null && model.pointEquity == null
          ? "—"
          : `${formatMoney(model.pointBalance, currency)} / ${formatMoney(model.pointEquity, currency)}`,
      note: "导出时点的读数。权益可以不同于余额。",
    },
    {
      label: "已实现盈亏回撤",
      en: "Realized P&L drawdown",
      value: formatSignedMoney(model.realizedPnlDrawdown.maxDrawdown, currency),
      word: signedWord(model.realizedPnlDrawdown.maxDrawdown),
      note: model.realizedPnlDrawdown.available
        ? `相对累计净盈亏峰值 ${formatPercent(ratio(model.realizedPnlDrawdown.maxDrawdown, model.realizedPnlDrawdown.peak))}。不是权益回撤。`
        : `${reasonText(model.realizedPnlDrawdown.reason ?? "no-closed-trades")}。不是权益回撤。`,
      tone: model.realizedPnlDrawdown.maxDrawdown,
    },
    {
      label: "权益回撤",
      en: "Equity drawdown",
      value: formatSignedMoney(model.equitySeries.drawdown, currency),
      word: signedWord(model.equitySeries.drawdown),
      note: model.equitySeries.drawdown == null
        ? `${reasonText(model.equitySeries.drawdownReason)}。不能用成交代替。`
        : `只基于快照，相对峰值 ${formatPercent(ratio(model.equitySeries.drawdown, model.equitySeries.drawdownPeak))}。快照之间未知。`,
      tone: model.equitySeries.drawdown,
    },
    {
      label: "已实现余额收益率",
      en: "Modified Dietz",
      value: model.dietz.available ? formatPercent(model.dietz.rate) : "—",
      note: model.dietz.available ? "修正迪茨，基于已实现余额，不是权益时间加权收益。" : `${reasonText(model.dietz.reason)}，所以收益率不可用。`,
    },
  ];

  return (
    <section aria-label="摘要指标">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <article key={card.en} className="rounded-2xl border border-card-border bg-card px-3 py-3 sm:px-4">
            <h3 className="text-sm font-medium leading-5">
              {card.label}
              <span className="mt-0.5 block text-[11px] font-normal text-muted">{card.en}</span>
            </h3>
            <p className={`num mt-3 text-lg leading-6 sm:text-xl ${card.tone != null && card.tone < 0 ? "text-negative" : card.tone != null && card.tone > 0 ? "text-positive" : ""}`}>
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
