import type { Metadata } from "next";
import Link from "next/link";

import { Disclosure } from "@/components/Disclosure";
import { PLANNED_MONTHLY_USD } from "@/lib/site";

export const metadata: Metadata = {
  title: "价格",
  description:
    "已平仓概览、仓位计算和本地日记分析现在免费。计划中的持续分析示意 $9/月，订阅尚未开放，本站不能付款。",
  keywords: ["交易日记价格", "免费仓位计算", "计划中的分析订阅"],
  alternates: { canonical: "/pricing/" },
};

const rows = [
  ["已平仓概览、筛选和曲线", "免费，数据未发布时保持未知", "仍免费"],
  ["仓位计算（自填 tick）", "免费，现在可用", "仍免费"],
  ["本地日记、品种/月份、费用拖累、CSV", "免费，只留在浏览器", "仍免费"],
  ["多段账户对照", "没有", "计划中，现在不可用"],
  ["更长的风险报告和固定导出模板", "没有", "计划中，现在不可用"],
  ["交易信号、跟单、自动下单", "不做", "不做"],
  ["结账和登录", "没有", "尚未开放，没有付款按钮"],
];

export default function PricingPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium tracking-[0.16em] text-accent">FREE NOW · PRO NOT OPEN</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">先免费使用，订阅以后再说</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
        能核对平仓、费用和仓位的部分现在就能用，没有被做成试用墙。计划中的订阅如果开放，卖的是还没做出来的持续分析，不是收益承诺。示意价格 ${PLANNED_MONTHLY_USD}/月，不是报价，也不能在这里付款。
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/#records" className="btn btn-primary">
          查看平仓记录
        </Link>
        <Link href="/tools/#size" className="btn btn-ghost">
          免费使用仓位计算
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">免费功能与计划中功能</caption>
          <thead className="bg-card text-muted">
            <tr>
              <th scope="col" className="px-3 py-3 font-medium">
                能力
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                现在
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                计划中 · ${PLANNED_MONTHLY_USD}/月示意
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([feature, now, later]) => (
              <tr key={feature} className="border-t border-card-border align-top">
                <th scope="row" className="px-3 py-3 font-medium">
                  {feature}
                </th>
                <td className="px-3 py-3">{now}</td>
                <td className="px-3 py-3 text-muted">{later}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel mt-6 px-4 py-5">
        <h2 className="text-lg font-semibold">为什么以后可能收费</h2>
        <p className="mt-2 text-sm leading-7 text-muted">
          免费工具解决单次计算和一份本地日记。如果以后做持续的对照和更长的报告，维护这些分析才是收费的理由。在那之前，价格页只负责把“已经能用”和“还没做”分开。没有倒计时，没有已订阅人数，也没有付款成功状态。
        </p>
        <button type="button" className="btn btn-ghost mt-4 cursor-not-allowed opacity-60" disabled>
          订阅尚未开放
        </button>
      </section>
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
