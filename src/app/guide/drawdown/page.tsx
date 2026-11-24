import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "Drawdown and return",
  description:
    "How realized P&L drawdown, equity drawdown, and Modified Dietz differ. Equity drawdown stays unknown without equity snapshots.",
  keywords: ["equity drawdown", "realized drawdown", "Modified Dietz", "deposits and withdrawals"],
  alternates: { canonical: "/guide/drawdown/" },
};

export default function DrawdownGuidePage() {
  return (
    <GuideArticle kicker="DRAWDOWN" title="Drawdown and return answer different questions">
      <p>
        The overview can show three different numbers. Each one depends on fields the file actually contains. A missing input stays unknown, not zero. If you open the sample on the{" "}
        <Link href="/#records">closed-trade board</Link>, those three numbers are intentionally different so the labels can be checked. The sample figures are fictional.
      </p>
      <h2>Realized P&amp;L drawdown</h2>
      <p>
        Closed net P&amp;L is added in time order. The drawdown is how far that cumulative line falls from its own peak. Cash flows are excluded, and so is any floating open-position result. That is why it is not called equity drawdown.
      </p>
      <h2>Equity drawdown</h2>
      <p>
        Equity includes the floating result of open positions. Deals alone leave the path during a trade unknown. This site computes equity drawdown only when at least two equity snapshots are supplied, and it says the path between snapshots was not recorded. A single equity reading can be shown. It is not a drawdown.
      </p>
      <h2>A balance drop from its high</h2>
      <p>
        With a starting balance, the board draws realized balance: starting balance, plus cash flows, plus closed net P&amp;L. A withdrawal lowers that balance. The drop from the high includes cash flows, so it is labeled separately and is not used as the drawdown statistic.
      </p>
      <h2>Modified Dietz</h2>
      <p>
        A return also depends on when money arrived. Modified Dietz on realized balance weights each cash flow by how long it stayed. It is not an equity time-weighted return. It stays unavailable without a starting balance, when the period is not positive, or when the denominator is not positive. A positive return can still sit next to a deep drawdown, so the two numbers do not replace each other.
      </p>
      <p>
        Symbol, month, and fee summaries live in the <Link href="/tools/#journal">local journal</Link> after you import records. They still only rearrange closed-trade fields.
      </p>
    </GuideArticle>
  );
}
