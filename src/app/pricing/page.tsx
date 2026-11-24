import type { Metadata } from "next";

import { Disclosure } from "@/components/Disclosure";
import { PLANNED_MONTHLY_USD } from "@/lib/site";

export const metadata: Metadata = {
  title: "价格",
  description: "交易观察目前免费。计划中的分析订阅尚未开放，不能在本站购买。",
  alternates: { canonical: "/pricing/" },
};

export default function PricingPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">价格</h1>
        <p className="mt-3 text-base leading-7 text-muted">
          现在能用的部分免费。付费订阅尚未开放，本页没有结账，也没有付款成功状态。
        </p>
      </header>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-card-border bg-card px-5 py-5">
          <h2 className="text-lg font-semibold">现在可用</h2>
          <p className="mt-1 text-sm text-muted">免费</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
            <li>公开的已平仓概览。要等你审阅并手动发布静态 JSON 之后才有你的数字。</li>
            <li>本地仓位计算，使用你填写的 tick size 和 tick value。</li>
            <li>本地日记导入、统计和 CSV 导出。只留在浏览器。</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-dashed border-card-border bg-card px-5 py-5">
          <h2 className="text-lg font-semibold">计划中的分析</h2>
          <p className="mt-1 text-sm text-muted">示意 ${PLANNED_MONTHLY_USD}/月 · 暂不可购买</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
            <li>更完整的日记统计、筛选和风险报告。</li>
            <li>这些工具用来整理记录和核对风险，不提供收益保证。</li>
            <li>价格只是计划说明，不是报价，也不能在这里付款。</li>
          </ul>
          <button type="button" className="mt-5 cursor-not-allowed rounded-full bg-card-border px-4 py-2 text-sm" disabled>
            订阅尚未开放
          </button>
        </article>
        <article className="rounded-2xl border border-card-border bg-card px-5 py-5">
          <h2 className="text-lg font-semibold">不会做成的东西</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6">
            <li>实时或“延迟”喊单，以及未平仓信号。</li>
            <li>自动跟单、代客下单或账户托管。</li>
            <li>把示例数据说成真实或已验证收益。</li>
            <li>在支付服务商还没选定之前接上收款。</li>
          </ul>
        </article>
      </div>
      <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
        本站目前不销售订阅，也不通过本站收款。以后如果开放，会先写明服务商、价格和取消方式。在那之前，任何“已付款”或“已开通”的提示都不是这个产品。
      </p>
      <div className="mt-8">
        <Disclosure />
      </div>
    </main>
  );
}
