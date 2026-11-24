import type { Metadata } from "next";
import Link from "next/link";

import { CandleBackdrop } from "@/components/CandleBackdrop";
import { DemoButton } from "@/components/DemoButton";
import { Disclosure } from "@/components/Disclosure";
import { OverviewApp } from "@/components/OverviewApp";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} — closed-trade record`,
  description:
    "See closed-trade results and risk, not signals. The public file starts unconnected. Position sizing is free. The sample view is opt-in and stays labeled DEMO.",
  keywords: ["closed trade journal", "MT5 trade journal", "position size calculator", "drawdown", "commission and swap"],
  alternates: { canonical: "/" },
};

const guides = [
  {
    href: "/guide/position-size/",
    title: "Size a position",
    text: "Use your own tick size and tick value. XAUUSD is not a 0.0001 FX pip.",
  },
  {
    href: "/guide/drawdown/",
    title: "Drawdown is not return",
    text: "Realized P&L drawdown, equity drawdown, and Modified Dietz each need different inputs.",
  },
  {
    href: "/guide/mt5-journal/",
    title: "An MT5 journal of closed trades",
    text: "A deal is not a finished round turn. Open positions stay off the public table.",
  },
];

export default function HomePage() {
  return (
    <main id="main" className="flex-1">
      <section className="relative overflow-hidden border-b border-card-border">
        <div className="absolute inset-0 hidden md:block">
          <CandleBackdrop />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(16rem,0.75fr)] lg:items-end">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-accent">CLOSED RECORDS · NOT LIVE · NOT A BROKER</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">
              Read the closed book. See the risk.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {SITE_NAME} keeps a closed-trade record: count, fees, drawdown, and balance, each named for what it actually is. It does not stream quotes, call entries, or promise a profit. Until you publish a file, the board stays unconnected.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#records" className="btn btn-primary">
                View closed trades
              </a>
              <Link href="/tools/#size" className="btn btn-ghost">
                Use the free position calculator
              </Link>
              <DemoButton />
            </div>
            <p id="demo-cta-note" className="mt-3 max-w-2xl text-xs leading-5 text-muted">
              “View sample” opens a fictional board and keeps a DEMO mark on it. It is not your account and it does not become the published file.
            </p>
            <p className="mt-4 hidden text-[11px] uppercase tracking-[0.14em] text-muted md:block">Illustrative chart — not market data</p>
          </div>
          <div className="relative h-36 overflow-hidden rounded-xl border border-card-border md:hidden">
            <CandleBackdrop />
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070d18] to-transparent px-4 pb-3 pt-8 text-[11px] uppercase tracking-[0.14em] text-muted">
              Illustrative chart — not market data
            </p>
          </div>
          <ul className="grid gap-2 text-sm">
            {[
              ["01", "Closed trades only", "The public view does not list open positions or a signal feed."],
              ["02", "Free risk math", "The position calculator works now, from the contract terms you type."],
              ["03", "No checkout yet", "Later analytics, if priced, will be described first. Nothing can be paid for here."],
            ].map(([index, title, text]) => (
              <li key={index} className="panel px-3 py-3">
                <p className="font-mono text-[11px] text-accent">{index}</p>
                <p className="mt-1 font-medium">{title}</p>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div id="records" className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6">
        <noscript>
          <p className="mb-4 rounded-xl border border-card-border bg-card px-4 py-4 text-sm leading-6">
            JavaScript is required to read the static data file. While it is unconnected, the page does not show performance figures.
          </p>
        </noscript>
        <OverviewApp />
      </div>

      <section className="mx-auto grid w-full max-w-6xl gap-3 px-4 pb-4 sm:px-6 md:grid-cols-3">
        {guides.map((guide) => (
          <Link key={guide.href} href={guide.href} className="panel block px-4 py-4 hover:bg-accent-soft">
            <h2 className="font-semibold">{guide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{guide.text}</p>
          </Link>
        ))}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="panel grid gap-4 px-4 py-5 md:grid-cols-[1.4fr_0.8fr] md:items-center">
          <div>
            <h2 className="text-xl font-semibold">Free tools now. A subscription only if it is built later.</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Start with the closed-trade board, then use the calculator and the local journal to check fees and drawdown. Those stay free and unlocked. A planned subscription would cover analysis that does not exist yet. It would not sell a profit or a copy-trading service.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link href="/tools/#journal" className="btn btn-ghost">
              Open the local journal
            </Link>
            <Link href="/pricing/" className="btn btn-primary">
              Compare free and planned
            </Link>
          </div>
        </div>
      </section>

      <section id="method" className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 text-sm leading-7 sm:px-6">
        <h2 className="text-xl font-semibold">How the figures are defined</h2>
        <p>
          One closed trade is a round turn whose volume is fully flat. It is not a single MT5 deal. Partial closes are combined only after the remainder is zero. A position that is still open stays off the public table. Reversing in/out deals are outside this format and are dropped on export. See the{" "}
          <Link href="/guide/mt5-journal/" className="text-accent underline underline-offset-4">
            MT5 journal note
          </Link>
          .
        </p>
        <p>Net P&amp;L is price result plus commission plus swap. Cash flows change balance and are excluded from win rate. With no closed trades, win rate is unknown, not 0%.</p>
        <p>
          A realized balance needs a starting balance. Equity drawdown is computed only when at least two equity snapshots are supplied. Deals cannot rebuild mark-to-market equity. Modified Dietz stays unavailable when it cannot be computed. See{" "}
          <Link href="/guide/drawdown/" className="text-accent underline underline-offset-4">
            drawdown and return
          </Link>
          .
        </p>
      </section>
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <Disclosure />
      </div>
    </main>
  );
}
