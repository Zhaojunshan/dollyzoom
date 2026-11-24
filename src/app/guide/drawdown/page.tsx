import type { Metadata } from "next";
import Link from "next/link";

import { GuideArticle } from "@/components/GuideArticle";

export const metadata: Metadata = {
  title: "回撤和收益",
  description: "已实现盈亏回撤、权益回撤和修正迪茨收益率的区别。没有权益快照时，权益回撤保持未知。",
  keywords: ["权益回撤", "已实现回撤", "修正迪茨", "出入金"],
  alternates: { canonical: "/guide/drawdown/" },
};

export default function DrawdownGuidePage() {
  return (
    <GuideArticle kicker="DRAWDOWN" title="回撤和收益率回答的是不同问题">
      <p>
        概览上可能同时出现三个数。它们都依赖文件里真实给出的字段。缺了哪一项，对应的数就是未知，而不是 0。打开
        <Link href="/#records"> 平仓记录 </Link>
        里的示例时，这三个数会故意不一样，用来看标签；那些数字是虚构的。
      </p>
      <h2>已实现盈亏回撤</h2>
      <p>
        把已平仓净盈亏按时间累加，再看这条累计线从自己的高点回落多少。它不含出入金，也不含未平仓浮动。所以它不能叫做权益回撤。
      </p>
      <h2>权益回撤</h2>
      <p>
        权益包含未平仓的浮动结果。只有成交时，持仓期间的路径是未知的。本站只在你提供至少两个权益快照时计算，并写明快照之间的波动没有被记录。一个时点的权益可以显示，但构不成回撤。
      </p>
      <h2>余额自高点回落</h2>
      <p>
        如果有期初余额，页面会画出已实现余额：期初余额加上出入金，再加上已平仓净盈亏。出金会让余额下降。这个从高点的落差含有出入金，因此单独标注，不用作回撤指标。
      </p>
      <h2>修正迪茨收益率</h2>
      <p>
        收益率还要看资金在什么时候进来。已实现余额的修正迪茨把出入金按停留时间加权。它不是权益的时间加权收益。没有期初余额、时间区间无效，或分母不是正数时，收益率不可用。一个为正的收益率仍然可以伴随很深的回撤，所以这两个数不能互相代替。
      </p>
      <p>
        更细的月份和费用汇总在 <Link href="/tools/#journal">本地日记</Link>
        ，前提是你已经导入记录。那仍然只是已平仓字段的整理。
      </p>
    </GuideArticle>
  );
}
