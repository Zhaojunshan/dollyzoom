"use client";

import { useEffect, useState } from "react";

import { BreakdownPanel } from "@/components/BreakdownPanel";
import { MetricGrid } from "@/components/MetricGrid";
import { SeriesChart } from "@/components/SeriesChart";
import { TradeTable } from "@/components/TradeTable";
import { formatAge, formatSignedMoney, formatTime } from "@/lib/format.mjs";
import { buildViewModel, parseFeed } from "@/lib/performanceFeed.mjs";
import { browserPublicPath } from "@/lib/site";

const DEMO_KEY = "tj.demo.v1";

type Mode = "pending" | "public" | "demo";
type Phase = "loading" | "error" | "sensitive" | "local-only" | "invalid" | "ready";

const WARNING_TEXT: Record<string, string> = {
  "still-open": "A position was still open and was left off the table",
  "unsupported-inout": "A reversing in/out deal is outside this format and was dropped",
  "volume-mismatch": "Closed volume did not match opened volume, so the position was dropped",
  "credit-ignored": "A credit adjustment was ignored and is not P&L",
  "missing-position-id": "A deal without a position id was dropped",
  "ignored-deal-type": "An unsupported deal type was dropped",
  "mixed-entry-side": "One position mixed entry sides and was dropped",
  "mixed-symbol": "One position mixed symbols and was dropped",
  "bad-deal": "A deal had unreadable fields and was dropped",
  "bad-time": "A time was invalid or out of order and was dropped",
  "ignored-zero-balance": "A zero balance adjustment was ignored",
  "verified-flag-ignored": "A verified flag in the file was ignored",
};

const ACCOUNT: Record<string, string> = {
  unknown: "Account type unknown",
  demo: "Demo account",
  live: "Live, self-reported, not verified",
  contest: "Contest, not verified",
};

const SOURCE: Record<string, string> = {
  unconnected: "Unconnected",
  demo: "Sample data DEMO",
  "manual-static-export": "Manually published snapshot",
  "local-journal": "Local journal",
};

export function OverviewApp() {
  const [mode, setMode] = useState<Mode>("pending");
  const [phase, setPhase] = useState<Phase>("loading");
  const [model, setModel] = useState<ReturnType<typeof buildViewModel> | null>(null);

  useEffect(() => {
    let cancel = false;
    const apply = () => {
      if (!cancel) setMode(window.localStorage.getItem(DEMO_KEY) === "1" ? "demo" : "public");
    };
    queueMicrotask(apply);
    window.addEventListener("tj-demo", apply);
    return () => {
      cancel = true;
      window.removeEventListener("tj-demo", apply);
    };
  }, []);

  useEffect(() => {
    if (mode === "pending") return;
    let cancel = false;
    (async () => {
      await Promise.resolve();
      if (cancel) return;
      setPhase("loading");
      setModel(null);
      try {
        const feedResponse = await fetch(browserPublicPath("/data/feed.json"), { cache: "no-store" });
        if (!feedResponse.ok) throw new Error("feed");
        const feed = await feedResponse.json();
        const path = mode === "demo" ? feed.demoPath : feed.performancePath;
        if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) throw new Error("path");
        const dataResponse = await fetch(browserPublicPath(path), { cache: "no-store" });
        if (!dataResponse.ok) throw new Error("data");
        const parsed = parseFeed(await dataResponse.json());
        if (cancel) return;
        if (!parsed.ok) {
          setPhase(parsed.error === "sensitive" ? "sensitive" : parsed.error === "local-only" ? "local-only" : "invalid");
          return;
        }
        if (mode === "demo" && parsed.feed.source !== "demo") {
          setPhase("invalid");
          return;
        }
        setModel(buildViewModel(parsed.feed, Date.now()));
        setPhase("ready");
      } catch {
        if (!cancel) setPhase("error");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode]);

  function setDemo(next: boolean) {
    window.localStorage.setItem(DEMO_KEY, next ? "1" : "0");
    setMode(next ? "demo" : "public");
  }

  return (
    <div className="mt-8 space-y-4">
      {mode === "demo" ? (
        <div className="rounded-xl border border-warning bg-warning-bg px-4 py-3 text-sm leading-6 text-warning" role="status">
          <p className="font-semibold">Sample data DEMO</p>
          <p>
            These figures are fictional and only show the interface. They are not your account and not a verified record. This mark stays until you close the sample. Closing it returns to the unconnected or published file and does not rewrite the sample as a real result.
          </p>
        </div>
      ) : null}

      {phase === "loading" ? (
        <p className="loading-pulse rounded-2xl border border-card-border bg-card px-4 py-8 text-sm text-muted" role="status">
          Reading the static data file…
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          The public data file could not be read. The page will not switch to the sample, and it will not fill the board with zeros.
        </p>
      ) : null}
      {phase === "sensitive" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          This file contains fields that must not be public, such as positions, a login, or a server. The page refused to show it.
        </p>
      ) : null}
      {phase === "local-only" ? (
        <p className="rounded-2xl border border-warning/30 bg-warning-bg px-4 py-4 text-sm leading-6" role="alert">
          This export is still marked local-only. The public page will not show it. Review it, remove localOnly, then copy it to public/data/performance.json yourself.
        </p>
      ) : null}
      {phase === "invalid" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          The data file is not in a recognized shape, or the sample file is not marked source demo. No performance figures are shown.
        </p>
      ) : null}

      {phase === "ready" && model ? <Dashboard model={model} /> : null}

      <div className="flex flex-wrap gap-2">
        {mode === "demo" ? (
          <button type="button" className="btn btn-primary" onClick={() => setDemo(false)}>
            Close sample and use the published file
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setDemo(true)}>
            View sample
          </button>
        )}
      </div>
    </div>
  );
}

function Dashboard({ model }: { model: NonNullable<ReturnType<typeof buildViewModel>> }) {
  const freshness =
    model.freshness.kind === "unconnected"
      ? "No as-of time. This is not a delayed quote."
      : model.freshness.kind === "stale"
        ? `This static snapshot is ${formatAge(model.freshness.ageMs)} old. It is an old file, not a delayed quote.`
        : model.freshness.kind === "undated"
          ? "The snapshot has no as-of time, so its age is unknown."
          : model.freshness.kind === "future"
            ? "The as-of time is later than this device's clock."
            : `Static snapshot, ${formatAge(model.freshness.ageMs)} after as-of. Not a live push.`;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-card-border bg-card px-4 py-4" aria-label="Connection status">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatusItem label="Data" value={SOURCE[model.source] ?? model.source} />
          <StatusItem label="Account" value={ACCOUNT[model.accountClass] ?? "Account type unknown"} />
          <StatusItem label="As of" value={model.asOf ? formatTime(model.asOf, model.timezone) : "Unknown"} />
          <StatusItem label="Currency" value={model.currency ?? "Unknown"} />
          <StatusItem label="Time zone" value={model.timezone ?? "Unknown"} />
        </dl>
        <p className="mt-3 text-sm leading-6 text-muted">{freshness}</p>
        <p className="text-sm leading-6 text-muted">{model.freshnessNote}</p>
        {model.label ? <p className="mt-1 text-sm">Label: {model.label}</p> : null}
        {model.freshness.kind === "stale" ? (
          <p className="mt-3 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning" role="status">
            This snapshot is older than 7 days. It is not described as delayed data.
          </p>
        ) : null}
        {model.balanceMismatch != null ? (
          <p className="mt-3 text-sm leading-6">
            Reconstructed balance and the exported point balance differ by {model.balanceMismatch}. Both numbers stay visible. The starting balance, a missing record, or the point reading may not agree.
          </p>
        ) : null}
      </section>

      {model.status === "unconnected" ? (
        <p className="rounded-2xl border border-dashed border-card-border bg-card px-4 py-4 text-sm leading-6">
          No trading record has been published. Account type, balance, equity, win rate, and the curves are unknown. The tiles use a dash, not a zero.
        </p>
      ) : null}

      <MetricGrid model={model} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SeriesChart
            title="Balance and equity"
            description="The blue line is realized balance, and only if the file includes a starting balance. The gold line appears only when equity snapshots are supplied. Without snapshots there is no equity line, and a balance drop is not called equity drawdown."
            currency={model.currency}
            timeZone={model.timezone}
            empty={
              model.status === "unconnected"
                ? "Unconnected, so no curve is drawn."
                : "A balance or equity curve cannot be drawn. Balance needs a starting balance. Equity needs at least two snapshots. Unknown is not drawn as zero."
            }
            series={[
              model.balanceSeries.available
                ? { id: "balance", label: "Realized balance", color: "#9ec1ff", points: model.balanceSeries.points }
                : { id: "balance", label: "Realized balance", color: "#9ec1ff", points: [] },
              model.equitySeries.points.length
                ? { id: "equity", label: "Equity snapshots", color: "#e6b84d", points: model.equitySeries.points }
                : { id: "equity", label: "Equity snapshots", color: "#e6b84d", points: [] },
            ]}
          />
        </div>
        <aside className="rounded-2xl border border-card-border bg-card px-4 py-4 text-sm leading-6 xl:col-span-2">
          <h3 className="font-semibold">Why the two lines can differ</h3>
          <p className="mt-2 text-muted">
            Realized balance moves only when a trade closes or cash moves in or out. Equity also includes the floating result of open positions. Deals alone leave that path unknown.
          </p>
          {model.equitySnapshotsNote ? <p className="mt-2">{model.equitySnapshotsNote}</p> : null}
          {model.balanceSeries.available ? (
            <p className="mt-2 text-muted">
              The balance drop from its high is {formatSignedMoney(model.balanceSeries.maxDrop, model.currency)}, including cash flows. A withdrawal lowers balance, so this number is not a drawdown statistic.
            </p>
          ) : (
            <p className="mt-2 text-muted">Realized balance curve: {model.balanceSeries.reason === "unconnected" ? "unconnected" : "starting balance or time is missing"}.</p>
          )}
        </aside>
      </div>

      <SeriesChart
        title="Cumulative realized P&L"
        description="Closed net P&L added up over time. It starts at zero, excludes cash flows, and is not an equity curve."
        currency={model.currency}
        timeZone={model.timezone}
        empty="There are no closed trades, or none have been published, so this cumulative line is absent."
        series={[
          {
            id: "pnl",
            label: "Cumulative net P&L",
            color: "#6ee7b7",
            points: model.realizedPnlDrawdown.points,
          },
        ]}
      />

      {model.warnings.length ? (
        <ul className="rounded-2xl border border-card-border bg-card px-4 py-3 text-sm leading-6">
          {model.warnings.map((warning) => (
            <li key={warning.code}>
              {WARNING_TEXT[warning.code] ?? warning.code} × {warning.count}
            </li>
          ))}
        </ul>
      ) : null}

      <TradeTable
        trades={model.trades}
        currency={model.currency}
        timeZone={model.timezone}
        empty={model.status === "unconnected" ? "No closed trades. The file is still unconnected, not an empty real history." : "This snapshot has no closed trades. Win rate is therefore unknown."}
      />
      <BreakdownPanel view={model} />
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-5">{value}</dd>
    </div>
  );
}
