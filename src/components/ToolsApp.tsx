"use client";

import { useEffect, useMemo, useState } from "react";

import { MetricGrid } from "@/components/MetricGrid";
import { TradeTable } from "@/components/TradeTable";
import { formatLots, formatSignedMoney } from "@/lib/format.mjs";
import { journalToCsv, parseJournalText } from "@/lib/journalImport.mjs";
import { buildViewModel, parseFeed, type PerformanceFeed } from "@/lib/performanceFeed.mjs";
import { calculatePositionSize } from "@/lib/positionSize.mjs";
import { browserPublicPath, PLANNED_MONTHLY_USD } from "@/lib/site";

const JOURNAL_KEY = "tj.journal.v1";

const FIELD_ERROR: Record<string, string> = {
  tickSize: "Tick size 需要是大于 0 的价格间隔。",
  tickValue: "Tick value 需要是大于 0 的金额：账户货币 / 每 1 手 / 每个 tick。",
  volumeStep: "手数步长需要大于 0。",
  minLot: "最小手数需要大于 0。",
  maxLot: "最大手数需要大于 0，并且不小于最小手数。",
  stopDistance: "止损距离需要是大于 0 的价格差，不是某个品种默认的“点”。",
  riskAmount: "风险金额需要大于 0。",
  accountCurrency: "账户货币用三位字母，例如 USD。",
  "minLot-step": "最小手数必须是手数步长的整数倍。",
  "maxLot-step": "最大手数必须是手数步长的整数倍。",
  lossPerLot: "按这些输入算不出每手亏损。",
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
            setErrors(["浏览器里的旧日记格式不能用，没有加载。"]);
          } else {
            setJournal(stored);
          }
        } catch {
          setErrors(["浏览器里的日记无法读取。"]);
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
      setErrors(["请先勾选：导入只留在这台浏览器，不会因此公开。"]);
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
    setImportNote("已保存在这台浏览器。没有上传，也没有写入公开概览。");
  }

  async function loadSample() {
    const response = await fetch(browserPublicPath("/data/demo-performance.json"), { cache: "no-store" });
    if (!response.ok) {
      setErrors(["虚构示例文件没有读到。"]);
      return;
    }
    const parsed = parseFeed(await response.json());
    if (!parsed.ok || parsed.feed.source !== "demo") {
      setErrors(["示例文件不能载入本地日记。"]);
      return;
    }
    saveJournal({
      ...parsed.feed,
      source: "local-journal",
      account: { class: "unknown", verified: false, label: "本地日记" },
      freshness: { kind: "static-snapshot", note: "由虚构示例载入的本地日记，未发布。" },
    });
    setErrors([]);
    setImportNote("虚构示例已放进本地日记，并标成未发布。公开概览不会因此改变。");
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
    setImportNote("本地日记已从这台浏览器删除。");
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-2xl border border-card-border bg-card px-4 py-5 sm:px-5" aria-labelledby="size-heading">
        <h2 id="size-heading" className="text-xl font-semibold">
          仓位计算 <span className="text-base font-normal text-muted">Position size</span>
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          手数按风险金额向下取整到手数步长，避免四舍五入后亏得比计划多。请自己填写 tick size 和 tick value。这里没有品种表，也不会把黄金当成 0.0001 的外汇点值。
        </p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
          <Field label="账户货币 Account currency" value={form.accountCurrency} placeholder="USD" inputMode="text" onChange={(value) => update("accountCurrency", value)} />
          <Field label="Tick size" value={form.tickSize} placeholder="价格最小变动，例如 0.01" onChange={(value) => update("tickSize", value)} />
          <Field label="Tick value / 1 手" value={form.tickValue} placeholder="账户货币，每个 tick" onChange={(value) => update("tickValue", value)} />
          <Field label="手数步长 Volume step" value={form.volumeStep} placeholder="例如 0.01" onChange={(value) => update("volumeStep", value)} />
          <Field label="最小手数 Min lot" value={form.minLot} placeholder="例如 0.01" onChange={(value) => update("minLot", value)} />
          <Field label="最大手数 Max lot，可空" value={form.maxLot} placeholder="不限制就留空" onChange={(value) => update("maxLot", value)} />
          <Field label="止损距离 Stop distance" value={form.stopDistance} placeholder="价格单位，不是默认点数" onChange={(value) => update("stopDistance", value)} />
          <Field label="风险金额 Risk amount" value={form.riskAmount} placeholder="账户货币" onChange={(value) => update("riskAmount", value)} />
        </form>
        <div className="mt-4 rounded-xl bg-background px-3 py-3 text-sm leading-6" aria-live="polite">
          {!formStarted ? (
            <p>填写合约规格和风险金额后，这里给出向下取整的手数。空白不是 0。</p>
          ) : result.ok ? (
            <>
              <p>
                建议手数 <span className="num font-medium">{formatLots(result.lots)}</span>
                {result.belowMin ? "。低于最小手数，所以不建议为了凑手数而放大风险。" : null}
                {result.capped ? "。已按最大手数封顶。" : null}
              </p>
              <p>
                触及止损时的预计亏损{" "}
                <span className="num font-medium">{formatSignedMoney(-result.estimatedLoss, result.accountCurrency)}</span>
                。未使用的风险额度 <span className="num">{formatLots(result.unusedRisk)}</span> {result.accountCurrency}。
              </p>
              <p className="text-muted">
                原始手数 {formatLots(result.rawLots)}，每手止损约 {formatLots(result.lossPerLot)} {result.accountCurrency}。这只是算术，不会连接终端，也不会下单。
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

      <section className="rounded-2xl border border-card-border bg-card px-4 py-5 sm:px-5" aria-labelledby="journal-heading">
        <h2 id="journal-heading" className="text-xl font-semibold">
          本地日记 <span className="text-base font-normal text-muted">Local journal</span>
        </h2>
        <p className="mt-2 rounded-xl bg-warning-bg px-3 py-3 text-sm leading-6 text-warning">
          导入的文件只保存在这台浏览器。它不会因为导入就公开，也不会送到服务器。请不要把账号、密码或服务器名放进文件。换浏览器或清除站点数据后，日记会消失。
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>我知道这次导入只留在本地，不会发布到网站。</span>
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm">
            <span className="sr-only">选择 CSV 或 JSON</span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json"
              disabled={!acknowledged}
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white disabled:opacity-50"
            />
          </label>
          <button type="button" className="rounded-full border border-card-border px-4 py-2 text-sm" onClick={() => void loadSample()}>
            把虚构示例载入本地日记
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          CSV 表头：recordType,symbol,side,volume,openTime,closeTime,openPrice,closePrice,profit,commission,swap,time,amount,cashflowType。交易行用
          trade，出入金行用 cashflow，金额写正数，方向写 deposit 或 withdrawal。JSON 使用 closedTrades 和 cashflows。账户货币在计算表单里填写；留空时按 USD 读取 CSV。
        </p>
        {errors.length ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-negative" role="alert">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {importNote ? <p className="mt-3 text-sm">{importNote}</p> : null}
        {!journalReady ? <p className="mt-4 text-sm text-muted">正在读取这台浏览器里的日记…</p> : null}
        {journalReady && !journal ? <p className="mt-4 text-sm leading-6 text-muted">还没有本地日记。公开概览不会显示这里的内容。</p> : null}
        {journal && view ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm font-medium">未发布 · 只在这台浏览器</p>
            <MetricGrid model={view} />
            <TradeTable
              trades={view.trades}
              currency={view.currency}
              timeZone={view.timezone}
              empty="本地日记里没有已平仓记录。"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm text-white" onClick={exportCsv}>
                导出 CSV
              </button>
              <button type="button" className="rounded-full border border-card-border px-4 py-2 text-sm" onClick={clearJournal}>
                清除本地日记
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-dashed border-card-border px-4 py-5 sm:px-5" aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="text-xl font-semibold">
          进阶分析 · 计划中
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          更细的统计和风险报告还没做。示意价格是 ${PLANNED_MONTHLY_USD}/月，只说明以后可能怎么收费，现在不能购买，也没有付款成功或登录。
        </p>
        <button type="button" className="mt-4 cursor-not-allowed rounded-full bg-card-border px-4 py-2 text-sm" disabled>
          订阅尚未开放
        </button>
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
