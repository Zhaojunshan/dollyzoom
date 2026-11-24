"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BreakdownPanel } from "@/components/BreakdownPanel";
import { MetricGrid } from "@/components/MetricGrid";
import { TradeTable } from "@/components/TradeTable";
import { formatLots, formatSignedMoney } from "@/lib/format.mjs";
import { journalToCsv, parseJournalText } from "@/lib/journalImport.mjs";
import { buildViewModel, parseFeed, type PerformanceFeed } from "@/lib/performanceFeed.mjs";
import { calculatePositionSize } from "@/lib/positionSize.mjs";
import { browserPublicPath, PLANNED_MONTHLY_USD } from "@/lib/site";

const JOURNAL_KEY = "tj.journal.v1";

const FIELD_ERROR: Record<string, string> = {
  tickSize: "Tick size must be a price increment greater than 0.",
  tickValue: "Tick value must be greater than 0, in account currency per 1 lot per tick.",
  volumeStep: "Volume step must be greater than 0.",
  minLot: "Minimum lot must be greater than 0.",
  maxLot: "Maximum lot must be greater than 0 and at least the minimum lot.",
  stopDistance: "Stop distance must be a price difference greater than 0, not a default pip.",
  riskAmount: "Risk amount must be greater than 0.",
  accountCurrency: "Use a three-letter account currency, for example USD.",
  "minLot-step": "Minimum lot must be a whole number of volume steps.",
  "maxLot-step": "Maximum lot must be a whole number of volume steps.",
  lossPerLot: "These inputs do not produce a loss per lot.",
};

const EMPTY_FORM = {
  accountCurrency: "",
  tickSize: "",
  tickValue: "",
  volumeStep: "",
  minLot: "",
  maxLot: "",
  stopDistance: "",
  riskAmount: "",
};

export function ToolsApp() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [acknowledged, setAcknowledged] = useState(false);
  const [journal, setJournal] = useState<StoredJournal | null>(null);
  const [journalReady, setJournalReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [importNote, setImportNote] = useState("");

  useEffect(() => {
    let cancel = false;
    queueMicrotask(() => {
      if (cancel) return;
      const raw = window.localStorage.getItem(JOURNAL_KEY);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as StoredJournal;
          if (stored?.published !== false || stored?.feed?.source !== "local-journal") {
            setErrors(["A stored journal in this browser is not in a usable shape, so it was not loaded."]);
          } else {
            setJournal(stored);
          }
        } catch {
          setErrors(["The journal stored in this browser could not be read."]);
        }
      }
      setJournalReady(true);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const result = useMemo(() => calculatePositionSize(form), [form]);
  const formStarted = Object.values(form).some((value) => value.trim() !== "");
  const view = journal ? buildViewModel(journal.feed, Date.parse(journal.savedAt)) : null;

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function saveJournal(feed: StoredJournal["feed"]) {
    const stored = { published: false as const, savedAt: new Date().toISOString(), feed };
    window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(stored));
    setJournal(stored);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!acknowledged) {
      setErrors(["Check the box first: an import stays in this browser and is not published."]);
      return;
    }
    const text = await file.text();
    const parsed = parseJournalText(text, {
      currency: form.accountCurrency || "USD",
      timezone: "UTC",
      startingBalance: "",
      startingBalanceTime: "",
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setImportNote("");
      return;
    }
    saveJournal(parsed.journal);
    setErrors([]);
    setImportNote("Saved in this browser. Nothing was uploaded, and the public overview was not changed.");
  }

  async function loadSample() {
    const response = await fetch(browserPublicPath("/data/demo-performance.json"), { cache: "no-store" });
    if (!response.ok) {
      setErrors(["The fictional sample file could not be read."]);
      return;
    }
    const parsed = parseFeed(await response.json());
    if (!parsed.ok || parsed.feed.source !== "demo") {
      setErrors(["The sample file cannot be loaded into the local journal."]);
      return;
    }
    saveJournal({
      ...parsed.feed,
      source: "local-journal",
      account: { class: "unknown", verified: false, label: "Local journal" },
      freshness: { kind: "static-snapshot", note: "Local journal loaded from the fictional sample. Not published." },
    });
    setErrors([]);
    setImportNote("The fictional sample is in the local journal and marked unpublished. The public overview is unchanged.");
  }

  function exportCsv() {
    if (!journal) return;
    const blob = new Blob([journalToCsv(journal.feed)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trade-journal-local.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function clearJournal() {
    window.localStorage.removeItem(JOURNAL_KEY);
    setJournal(null);
    setImportNote("The local journal was removed from this browser.");
  }

  return (
    <div className="mt-8 space-y-8">
      <section id="size" className="panel px-4 py-5 sm:px-5" aria-labelledby="size-heading">
        <h2 id="size-heading" className="text-xl font-semibold">
          Position size
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Lots are floored to the volume step so rounding does not spend more than the risk amount. Type tick size and tick value yourself. There is no symbol table, and gold is not treated as a 0.0001 FX pip.{" "}
          <Link href="/guide/position-size/" className="text-accent underline underline-offset-4">
            Common XAUUSD mistakes
          </Link>
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <Field label="Account currency" value={form.accountCurrency} placeholder="USD" inputMode="text" onChange={(value) => update("accountCurrency", value)} />
          <Field label="Tick size" value={form.tickSize} placeholder="Minimum price change, for example 0.01" onChange={(value) => update("tickSize", value)} />
          <Field label="Tick value per 1 lot" value={form.tickValue} placeholder="Account currency per tick" onChange={(value) => update("tickValue", value)} />
          <Field label="Volume step" value={form.volumeStep} placeholder="For example 0.01" onChange={(value) => update("volumeStep", value)} />
          <Field label="Minimum lot" value={form.minLot} placeholder="For example 0.01" onChange={(value) => update("minLot", value)} />
          <Field label="Maximum lot, optional" value={form.maxLot} placeholder="Leave blank for no cap" onChange={(value) => update("maxLot", value)} />
          <Field label="Stop distance" value={form.stopDistance} placeholder="Price units, not a default pip" onChange={(value) => update("stopDistance", value)} />
          <Field label="Risk amount" value={form.riskAmount} placeholder="Account currency" onChange={(value) => update("riskAmount", value)} />
        </form>
        <div className="mt-4 rounded-xl bg-background px-3 py-3 text-sm leading-6" aria-live="polite">
          {!formStarted ? (
            <p>Enter the contract terms and a risk amount. The floored lot size appears here. A blank is not zero.</p>
          ) : result.ok ? (
            <>
              <p>
                Suggested lots <span className="num font-medium">{formatLots(result.lots)}</span>
                {result.belowMin ? ". That is below the minimum lot, so the size stays at zero instead of stretching the risk." : null}
                {result.capped ? ". Capped at the maximum lot." : null}
              </p>
              <p>
                Estimated loss if the stop is hit{" "}
                <span className="num font-medium">{formatSignedMoney(-result.estimatedLoss, result.accountCurrency)}</span>
                . Unused risk <span className="num">{formatLots(result.unusedRisk)}</span> {result.accountCurrency}.
              </p>
              <p className="text-muted">
                Raw lots {formatLots(result.rawLots)}. About {formatLots(result.lossPerLot)} {result.accountCurrency} per lot at the stop. Arithmetic only. No terminal connection and no order.
              </p>
            </>
          ) : (
            <ul>
              {result.errors.map((code) => (
                <li key={code}>{FIELD_ERROR[code] ?? code}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="journal" className="panel px-4 py-5 sm:px-5" aria-labelledby="journal-heading">
        <h2 id="journal-heading" className="text-xl font-semibold">
          Local journal
        </h2>
        <p className="mt-2 rounded-xl bg-warning-bg px-3 py-3 text-sm leading-6 text-warning">
          An imported file stays in this browser. Importing does not publish it and does not send it to a server. Do not put an account number, password, or server name in the file. Clearing site data, or switching browsers, removes the journal.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>I understand this import stays local and will not be published.</span>
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm">
            <span className="sr-only">Choose a CSV or JSON file</span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              disabled={!acknowledged}
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="block w-full max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-[#061018] disabled:opacity-50"
            />
          </label>
          <button type="button" className="rounded-full border border-card-border px-4 py-2 text-sm" onClick={() => void loadSample()}>
            Load the fictional sample into the local journal
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          CSV header: recordType,symbol,side,volume,openTime,closeTime,openPrice,closePrice,profit,commission,swap,time,amount,cashflowType. Use trade for a trade row and cashflow for cash, with a positive amount and type deposit or withdrawal. JSON uses closedTrades and cashflows. Account currency comes from the form above; a blank CSV import uses USD.
        </p>
        {errors.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-negative" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {importNote ? <p className="mt-3 text-sm">{importNote}</p> : null}
        {!journalReady ? <p className="mt-4 text-sm text-muted">Reading the journal stored in this browser…</p> : null}
        {journalReady && !journal ? <p className="mt-4 text-sm leading-6 text-muted">No local journal yet. The public overview does not show what you import here.</p> : null}
        {journal && view ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm font-medium">Unpublished · this browser only</p>
            <MetricGrid model={view} />
            <BreakdownPanel view={view} />
            <TradeTable
              trades={view.trades}
              currency={view.currency}
              timeZone={view.timezone}
              empty="The local journal has no closed trades."
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={exportCsv}>
                Export CSV
              </button>
              <Link href="/pricing/" className="btn btn-ghost">
                This analysis is free now
              </Link>
              <button type="button" className="btn btn-ghost" onClick={clearJournal}>
                Clear local journal
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel border-dashed px-4 py-5 sm:px-5" aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="text-xl font-semibold">
          Further analysis · planned
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Position sizing, the symbol and month summaries, fee drag, and CSV export are free and unlocked. What is not built is multi-period comparison and a longer risk report. ${PLANNED_MONTHLY_USD}/month is an illustration of a possible later price. Nothing can be purchased, and there is no payment-success state or login.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/pricing/" className="btn btn-ghost">
            Compare free and planned
          </Link>
          <button type="button" className="btn btn-ghost cursor-not-allowed opacity-60" disabled>
            Subscriptions are not yet open
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  inputMode = "decimal",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "text";
}) {
  const id = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return (
    <label htmlFor={id} className="block text-sm">
      <span>{label}</span>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-card-border bg-background px-3 py-2"
      />
    </label>
  );
}

type StoredJournal = {
  published: false;
  savedAt: string;
  feed: PerformanceFeed;
};
