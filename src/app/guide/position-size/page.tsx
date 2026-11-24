import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "仓位和 tick",
  description:
    "仓位计算需要你自己的 tick size、tick value、手数步长和止损价格距离。XAUUSD 不能套用外汇 0.0001 点值。",
  keywords: ["仓位计算", "tick size", "tick value", "XAUUSD 手数", "手数步长"],
  alternates: { canonical: "/guide/position-size/" },
};

export default function PositionSizeGuidePage() {
  return (
    <GuideArticle kicker="POSITION SIZE" title="仓位按你的合约规格算">
      <p>
        <Link href="/tools/#size">免费仓位计算</Link>
        只做算术：风险金额除以每手止损金额，再向下取整到手数步长。它不查询行情，也不发送订单。
      </p>
      <h2>要填的四个规格</h2>
      <ul>
        <li>Tick size：价格的最小变动，单位是报价，不是“点”的习惯叫法。</li>
        <li>Tick value：每 1 手、每跳动一个 tick，账户货币变动多少。必须是账户货币。</li>
        <li>手数步长和最小手数：经纪商允许的下单增量。最小手数必须是步长的整数倍。</li>
        <li>止损距离：开仓价到止损价的价格差，用和 tick size 相同的价格单位。</li>
      </ul>
      <h2>XAUUSD 为什么容易填错</h2>
      <p>
        外汇里常见的 0.0001 不是黄金的 tick。黄金报价的最小变动、一手对应多少盎司，以及一跳值多少账户货币，都随经纪商的合约说明变化。本站没有内置黄金表，也不会用某个“标准点值”代替你的规格。规格不清楚时，计算器应该停下来，而不是给出一个看起来能下的手数。
      </p>
      <h2>为什么向下取整</h2>
      <p>
        向上取整会让触及止损时的亏损超过你填写的风险金额。向下取整之后，预计亏损小于或等于风险金额，差额留在“未使用的风险额度”里。如果取整后小于最小手数，结果是 0 手，并说明不能为了凑最小手数而放大风险。
      </p>
      <p>空白输入保持空白，不会被当成 0 手的建议。0 手只在计算完成、且无法在风险内下单时出现。</p>
    </GuideArticle>
  );
}
