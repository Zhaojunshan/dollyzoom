import type { Metadata } from "next";
import Link from "next/link";

import { DemoButton } from "@/components/DemoButton";
import { Disclosure } from "@/components/Disclosure";
import { OverviewApp } from "@/components/OverviewApp";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} ${SITE_NAME_EN}`,
  description:
    "查看已平仓结果和风险，而不是交易信号。默认未连接。仓位计算免费。示例数据必须手动打开，并一直标为 DEMO。",
  keywords: ["已平仓交易记录", "MT5 交易日记", "仓位计算", "回撤", "费用"],
  alternates: { canonical: "/" },
};

const guides = [
  {
    href: "/guide/position-size/",
    title: "仓位怎么算",
    text: "用你自己的 tick size 和 tick value。黄金不能套用外汇的 0.0001。",
  },
  {
    href: "/guide/drawdown/",
    title: "回撤和收益不是同一个数",
    text: "已实现盈亏回撤、权益回撤和修正迪茨收益率各有前提。算不出就保持未知。",
  },
  {
    href: "/guide/mt5-journal/",
    title: "MT5 日记只收已平仓",
    text: "成交不是完成的回合。未平仓不进公开表。",
  },
];

export default function HomePage() {
  return (
    <main id="main" className="flex-1">
      <section className="border-b border-card-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:items-end">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-accent">CLOSED RECORDS · 非实时 · 非经纪商</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-tight">
              看清已平仓结果，也看清风险
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              {SITE_NAME_EN} 用来整理已经结束的交易：笔数、费用、回撤和余额各是什么。它不推送行情，不给进出场信号，也不保证赚钱。没有发布你的记录时，页面保持未连接。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#records" className="btn btn-primary">
                查看平仓记录
              </a>
              <Link href="/tools/#size" className="btn btn-ghost">
                免费使用仓位计算
              </Link>
              <DemoButton />
            </div>
            <p id="demo-cta-note" className="mt-3 max-w-2xl text-xs leading-5 text-muted">
              「查看示例」只会打开一份虚构界面，并在整页保留 DEMO 标记。它不是你的账户，也不会变成已发布记录。
            </p>
          </div>
          <ul className="grid gap-2 text-sm">
            {[
              ["01", "先看已平仓", "公开页不放未平仓，也不做成信号流。"],
              ["02", "免费先算风险", "仓位计算器现在就能用，合约规格由你填写。"],
              ["03", "订阅还没开放", "更进一步的分析如果收费，会先写在价格页，现在不能付款。"],
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
            需要 JavaScript 才能读取静态数据文件。未连接时页面不会显示业绩数字。
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
            <h2 className="text-xl font-semibold">从免费工具到以后可能的订阅</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              现在的路径是：先看平仓记录，再用仓位计算和本地日记核对费用与回撤。这些都免费，而且不会被锁住。计划中的订阅只打算覆盖还没做出来的持续分析，不出售“稳赚”或跟单。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link href="/tools/#journal" className="btn btn-ghost">
              打开本地日记
            </Link>
            <Link href="/pricing/" className="btn btn-primary">
              看免费和计划中的差别
            </Link>
          </div>
        </div>
      </section>

      <section id="method" className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 text-sm leading-7 sm:px-6">
        <h2 className="text-xl font-semibold">这些数字怎么算</h2>
        <p>
          一条已平仓记录是一个完全平掉的回合，不是 MT5 里的单笔成交。部分平仓要等剩余手数为零后才合并成一条；还有剩余仓位的不进入公开表。反向开仓 inout 这份格式不支持，导出时整笔排除。更完整的说明在{" "}
          <Link href="/guide/mt5-journal/" className="text-accent underline underline-offset-4">
            MT5 日记
          </Link>
          。
        </p>
        <p>净盈亏等于价格盈亏加佣金加库存费。出入金改变余额，但不算盈亏，也不进入胜率。没有已平仓记录时，胜率是未知，不是 0%。</p>
        <p>
          已实现余额需要期初余额。权益回撤只在至少两个权益快照都给出时计算。不能用成交单独还原盯市权益。修正迪茨收益率算不了就显示不可用。对照说明见{" "}
          <Link href="/guide/drawdown/" className="text-accent underline underline-offset-4">
            回撤和收益
          </Link>
          。
        </p>
      </section>
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <Disclosure />
      </div>
    </main>
  );
}
