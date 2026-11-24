import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "MT5 closed-trade journal",
  description:
    "An MT5 deal is not one closed trade. Partial closes are combined only when the position is flat. Open positions and account secrets stay off the public page.",
  keywords: ["MT5 trade journal", "closed trades", "partial close", "deals and positions"],
  alternates: { canonical: "/guide/mt5-journal/" },
};

export default function Mt5JournalGuidePage() {
  return (
    <GuideArticle kicker="MT5 JOURNAL" title="The journal keeps finished round turns">
      <p>
        One MT5 deal is a single open, close, or balance change. The public page and the local journal use a round turn that is fully flat.{" "}
        <Link href="/#records">View closed trades</Link> stays unconnected until a file is published.
      </p>
      <h2>What counts as closed</h2>
      <ul>
        <li>Opened volume on one position is matched by one or more closing volumes.</li>
        <li>Several partial closes become one row after the position is flat. Net P&amp;L adds price result, commission, and swap.</li>
        <li>A remainder that is still open is omitted from the table and from the win rate.</li>
        <li>A reversing in/out deal is outside this format. The whole position is dropped instead of guessing which part closed.</li>
        <li>Balance deals are cash flows. Credit adjustments are ignored. Neither is trade P&amp;L.</li>
      </ul>
      <h2>Public and local are different</h2>
      <p>
        The read-only exporter writes a file on your computer and marks it local-only. The site refuses to display a file that still has that mark. After you confirm it has no login, server, or open positions, you copy it into the public data file yourself.{" "}
        <Link href="/tools/#journal">Importing a local journal</Link> does not do that step. The rows stay in this browser.
      </p>
      <h2>What is absent</h2>
      <p>
        There is no live or delayed quote, no open-position feed, and no button on the page that attaches to a terminal. An equity curve is not invented from deals. If later analysis is priced, the place to read that is{" "}
        <Link href="/pricing/">pricing</Link>, and it cannot be bought now.
      </p>
    </GuideArticle>
  );
}
