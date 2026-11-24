import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Notes",
  description: "How position size, drawdown, return, and an MT5 closed-trade journal are defined here. No live quotes and no profit promise.",
  keywords: ["position size", "drawdown", "MT5 closed trades"],
  alternates: { canonical: "/guide/" },
};

const articles = [
  {
    href: "/guide/position-size/",
    title: "Position size and ticks",
    text: "Risk amount, volume step, and why XAUUSD is not an FX pip of 0.0001.",
  },
  {
    href: "/guide/drawdown/",
    title: "Drawdown and return",
    text: "When realized P&L drawdown, equity drawdown, and Modified Dietz are available.",
  },
  {
    href: "/guide/mt5-journal/",
    title: "MT5 journal",
    text: "How deals, partial closes, and open positions enter or stay off the public table.",
  },
];

export default function GuideIndexPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-accent">NOTES</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Notes</h1>
      <p className="mt-3 text-sm leading-7 text-muted">
        These pages explain the calculations this site actually performs. They do not quote a live market, and they do not treat the sample board as a market conclusion.
      </p>
      <div className="mt-6 grid gap-3">
        {articles.map((article) => (
          <Link key={article.href} href={article.href} className="panel block px-4 py-4 hover:bg-accent-soft">
            <h2 className="font-semibold">{article.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{article.text}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
