import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "Position size and ticks",
  description:
    "Position size needs your tick size, tick value, volume step, and stop distance. XAUUSD is not a 0.0001 FX pip.",
  keywords: ["position size", "tick size", "tick value", "XAUUSD lot size", "volume step"],
  alternates: { canonical: "/guide/position-size/" },
};

export default function PositionSizeGuidePage() {
  return (
    <GuideArticle kicker="POSITION SIZE" title="Size comes from your contract terms">
      <p>
        The <Link href="/tools/#size">free position calculator</Link> divides the risk amount by the loss per lot, then floors the result to the volume step. It does not look up a quote and it does not send an order.
      </p>
      <h2>Four inputs that have to be yours</h2>
      <ul>
        <li>Tick size: the smallest price change, in price units, not a habit name such as “pip”.</li>
        <li>Tick value: account-currency change for 1.00 lot when price moves one tick.</li>
        <li>Volume step and minimum lot: the broker’s order increment. The minimum must be a whole number of steps.</li>
        <li>Stop distance: the price gap from entry to the stop, in the same units as tick size.</li>
      </ul>
      <h2>Why XAUUSD is easy to mistype</h2>
      <p>
        The 0.0001 step common in FX is not a gold tick. The minimum gold price change, how many ounces one lot represents, and how much one tick is worth in the account currency all depend on that broker’s specification. This site has no built-in gold table and will not substitute a “standard pip value”. If the specification is unknown, the calculator should stop rather than print a lot size that only looks tradable.
      </p>
      <h2>Why the lot size is floored</h2>
      <p>
        Rounding up can make the loss at the stop larger than the risk amount you typed. Flooring keeps the estimated loss at or under that amount, and the remainder is shown as unused risk. If the floored size is below the minimum lot, the result is 0 lots, with a note that the risk should not be stretched just to reach the minimum.
      </p>
      <p>A blank input stays blank. It is not treated as a recommendation of 0 lots. Zero lots appears only after a completed calculation that cannot fit inside the risk.</p>
    </GuideArticle>
  );
}
