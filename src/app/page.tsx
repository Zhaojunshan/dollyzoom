import type { Metadata } from "next";

import { Disclosure } from "@/components/Disclosure";
import { OverviewApp } from "@/components/OverviewApp";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE_NAME} ${SITE_NAME_EN}`,
  description: "已平仓交易记录概览。默认未连接，不展示虚构业绩，也不提供实时持仓或交易信号。",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="text-sm text-muted">{SITE_NAME_EN}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">已平仓记录</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          这是一份公开的交易观察页，用来在你手动发布静态文件之后展示已经平仓的结果。当前默认没有连接任何账户。未连接时，胜率、盈亏和曲线保持未知。
        </p>
      </header>
      <noscript>
        <p className="mt-6 rounded-2xl border border-card-border bg-card px-4 py-4 text-sm leading-6">
          需要 JavaScript 才能读取 public/data/performance.json。未连接时页面不会显示业绩数字。
        </p>
      </noscript>
      <OverviewApp />
      <section id="method" className="mt-10 max-w-3xl space-y-3 text-sm leading-7">
        <h2 className="text-xl font-semibold">这些数字怎么算</h2>
        <p>
          一条已平仓记录是一个完全平掉的回合，不是 MT5 里的单笔成交。部分平仓要等剩余手数为零后才合并成一条；还有剩余仓位的不进入公开表。反向开仓 inout 这份格式不支持，导出时整笔排除。
        </p>
        <p>净盈亏等于价格盈亏加佣金加库存费。佣金和库存费沿用成交里的符号，成本通常是负数。出入金改变余额，但不算盈亏，也不进入胜率。</p>
        <p>胜率是净盈亏大于零的笔数除以已平仓笔数。打平不算赢。没有已平仓记录时，胜率是未知，不是 0%。</p>
        <p>
          已实现余额需要文件里的期初余额。权益回撤只在至少两个权益快照都给出时计算，并注明快照之间的路径未知。不能用成交单独还原盯市权益。修正迪茨收益率只在期初余额、时间和出入金都足够时计算，并标明它是已实现余额口径，不是权益时间加权收益。算不了就显示不可用。
        </p>
        <p>货币和时区来自数据文件。缺了就标成未知，不会改成 0 或某个默认时区。</p>
      </section>
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
