"use client";

import { useEffect, useState } from "react";

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
  "still-open": "仍有未平完的仓位，未写入表格",
  "unsupported-inout": "反向开仓 inout 不在支持格式里，已整笔排除",
  "volume-mismatch": "平仓量对不上开仓量，该笔已排除",
  "credit-ignored": "信用额调整已忽略，不计入盈亏",
  "missing-position-id": "缺少持仓编号的成交已排除",
  "ignored-deal-type": "不支持的成交类型已排除",
  "mixed-entry-side": "同一笔持仓方向不一致，已排除",
  "mixed-symbol": "同一笔持仓出现多个品种，已排除",
  "bad-deal": "有字段无法读取的成交，已排除",
  "bad-time": "时间无效或顺序颠倒，已排除",
  "ignored-zero-balance": "金额为 0 的余额调整已忽略",
  "verified-flag-ignored": "文件里的已验证标记已忽略",
};

const ACCOUNT: Record<string, string> = {
  unknown: "账户类型未知",
  demo: "模拟账户 DEMO",
  live: "实盘 LIVE，自报且未验证",
  contest: "比赛账户 CONTEST，未验证",
};

const SOURCE: Record<string, string> = {
  unconnected: "未连接",
  demo: "示例数据 DEMO",
  "manual-static-export": "手动发布的静态快照",
  "local-journal": "本地日记",
};

export function OverviewApp() {
  const [mode, setMode] = useState<Mode>("pending");
  const [phase, setPhase] = useState<Phase>("loading");
  const [model, setModel] = useState<ReturnType<typeof buildViewModel> | null>(null);

  useEffect(() => {
    let cancel = false;
    queueMicrotask(() => {
      if (!cancel) setMode(window.localStorage.getItem(DEMO_KEY) === "1" ? "demo" : "public");
    });
    return () => {
      cancel = true;
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
        <div className="rounded-2xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm leading-6 text-warning" role="status">
          <p className="font-semibold">示例数据 DEMO</p>
          <p>
            这些数字是虚构的，只用来看界面。它们不是你的账户，也不是已验证战绩。这个标记会一直留着，直到你关闭示例。关闭后回到未连接或已发布文件，不会把示例写成真实结果。
          </p>
        </div>
      ) : null}

      {phase === "loading" ? (
        <p className="loading-pulse rounded-2xl border border-card-border bg-card px-4 py-8 text-sm text-muted" role="status">
          正在读取静态数据文件…
        </p>
      ) : null}
      {phase === "error" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          公开数据文件没有读到。页面不会自动改成示例数据，也不会用 0 填充。
        </p>
      ) : null}
      {phase === "sensitive" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          这份文件含有不应公开的字段，例如持仓、登录或服务器。页面已拒绝展示。
        </p>
      ) : null}
      {phase === "local-only" ? (
        <p className="rounded-2xl border border-warning/30 bg-warning-bg px-4 py-4 text-sm leading-6" role="alert">
          这份导出仍标记为只保存在本机。公开页不会展示它。请先审阅，去掉 localOnly，再手动放进 public/data/performance.json。
        </p>
      ) : null}
      {phase === "invalid" ? (
        <p className="rounded-2xl border border-negative/30 bg-danger-bg px-4 py-4 text-sm leading-6" role="alert">
          数据文件的格式无法识别，或示例文件没有标明 source 为 demo。没有显示任何业绩数字。
        </p>
      ) : null}

      {phase === "ready" && model ? <Dashboard model={model} /> : null}

      <div className="flex flex-wrap gap-2">
        {mode === "demo" ? (
          <button type="button" className="rounded-full bg-accent px-4 py-2 text-sm text-white" onClick={() => setDemo(false)}>
            关闭示例，回到已发布文件
          </button>
        ) : (
          <button type="button" className="rounded-full border border-card-border bg-card px-4 py-2 text-sm" onClick={() => setDemo(true)}>
            查看虚构示例
          </button>
        )}
      </div>
    </div>
  );
}

function Dashboard({ model }: { model: NonNullable<ReturnType<typeof buildViewModel>> }) {
  const freshness =
    model.freshness.kind === "unconnected"
      ? "没有 as-of。这不是延迟行情。"
      : model.freshness.kind === "stale"
        ? `静态快照已过去 ${formatAge(model.freshness.ageMs)}，只是旧文件，不是延迟报价。`
        : model.freshness.kind === "undated"
          ? "快照没有 as-of，不能判断新旧。"
          : model.freshness.kind === "future"
            ? "as-of 晚于这台设备的时钟。"
            : `静态快照，距 as-of ${formatAge(model.freshness.ageMs)}。不是实时推送。`;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-card-border bg-card px-4 py-4" aria-label="连接状态">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatusItem label="数据状态" value={SOURCE[model.source] ?? model.source} />
          <StatusItem label="账户" value={ACCOUNT[model.accountClass] ?? "账户类型未知"} />
          <StatusItem label="as of" value={model.asOf ? formatTime(model.asOf, model.timezone) : "未知"} />
          <StatusItem label="货币" value={model.currency ?? "未知"} />
          <StatusItem label="时区" value={model.timezone ?? "未知"} />
        </dl>
        <p className="mt-3 text-sm leading-6 text-muted">{freshness}</p>
        <p className="text-sm leading-6 text-muted">{model.freshnessNote}</p>
        {model.label ? <p className="mt-1 text-sm">标签：{model.label}</p> : null}
        {model.freshness.kind === "stale" ? (
          <p className="mt-3 rounded-xl bg-warning-bg px-3 py-2 text-sm text-warning" role="status">
            这份快照超过 7 天。它不会被描述成延迟数据。
          </p>
        ) : null}
        {model.balanceMismatch != null ? (
          <p className="mt-3 text-sm leading-6">
            推算余额和导出时点余额相差 {model.balanceMismatch}。两个数字都保留。可能是期初余额、缺失记录或时点读数不一致。
          </p>
        ) : null}
      </section>

      {model.status === "unconnected" ? (
        <p className="rounded-2xl border border-dashed border-card-border bg-card px-4 py-4 text-sm leading-6">
          还没有公开发布的交易记录。账户类型、余额、权益、胜率和曲线都是未知，下面的格子用破折号表示，不用 0 冒充。
        </p>
      ) : null}

      <MetricGrid model={model} />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SeriesChart
            title="余额与权益"
            description="绿线是已实现余额，前提是文件提供了期初余额。褐色线只有在文件带有权益快照时才出现。没有快照就不会画权益，也不会把余额回撤叫做权益回撤。"
            currency={model.currency}
            timeZone={model.timezone}
            empty={
              model.status === "unconnected"
                ? "未连接，所以不画曲线。"
                : "现在画不出余额或权益曲线。余额需要期初余额；权益需要至少两个快照。未知不会被画成 0。"
            }
            series={[
              model.balanceSeries.available
                ? { id: "balance", label: "已实现余额", color: "#1f4d3a", points: model.balanceSeries.points }
                : { id: "balance", label: "已实现余额", color: "#1f4d3a", points: [] },
              model.equitySeries.points.length
                ? { id: "equity", label: "权益快照", color: "#8a5a12", points: model.equitySeries.points }
                : { id: "equity", label: "权益快照", color: "#8a5a12", points: [] },
            ]}
          />
        </div>
        <aside className="rounded-2xl border border-card-border bg-card px-4 py-4 text-sm leading-6 xl:col-span-2">
          <h3 className="font-semibold">这两条线为什么可能不同</h3>
          <p className="mt-2 text-muted">
            已实现余额只在平仓、入金和出金时变化。权益还会包含未平仓的浮动结果。只有成交记录时，浮动路径是未知的。
          </p>
          {model.equitySnapshotsNote ? <p className="mt-2">{model.equitySnapshotsNote}</p> : null}
          {model.balanceSeries.available ? (
            <p className="mt-2 text-muted">
              余额自高点的回落是 {formatSignedMoney(model.balanceSeries.maxDrop, model.currency)}（含出入金）。出金会让余额下降，所以这个数不是回撤指标。
            </p>
          ) : (
            <p className="mt-2 text-muted">已实现余额曲线：{model.balanceSeries.reason === "unconnected" ? "未连接" : "缺少期初余额或时间"}。</p>
          )}
        </aside>
      </div>

      <SeriesChart
        title="已实现盈亏累计"
        description="只累加已平仓净盈亏。它从 0 开始，不包含出入金，也不是权益曲线。"
        currency={model.currency}
        timeZone={model.timezone}
        empty="没有已平仓记录，或记录尚未发布，所以没有这条累计线。"
        series={[
          {
            id: "pnl",
            label: "累计净盈亏",
            color: "#3d4f73",
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
        empty={model.status === "unconnected" ? "没有已平仓记录。文件仍是未连接，不是一份空的真实历史。" : "这份快照里没有已平仓记录。胜率因此未知。"}
      />
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
